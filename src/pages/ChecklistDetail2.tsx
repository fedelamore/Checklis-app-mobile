import { useEffect, useState, ChangeEvent, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from 'sonner';
import { ArrowLeft, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SyncStatusBadge } from "@/components/SyncStatusBadge";
import { apiClient } from "@/services/api-client";
import { createFormResponse, saveFieldResponse, getFormResponseById } from "@/services/db/checklists-db";
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

type CampoTipo =
  | "texto_simples"
  | "texto_longo"
  | "cpf"
  | "leitura_automatica"
  | "data"
  | "foto"
  | "assinatura"
  | "select_unico"
  | "select_multiplo";

interface Campo {
  id?: number;
  id_formulario?: number;
  label: string;
  tipo: CampoTipo;
  opcoes?: string | null; // vem como string JSON
}

interface RespostaSalva {
  id: number;
  id_resposta: number;
  id_campo: number;
  valor: {
    tipo: CampoTipo;
    valor: any;
  };
  created_at: string;
  updated_at: string;
}

interface ChecklistData {
  id: number;
  titulo: string;
  campos: Campo[];
  resposta: Object;
  respostasSalvas?: Record<string, RespostaSalva>;
}

type FormValues = Record<string, any>;

const API_URL = import.meta.env.VITE_API_URL;

export function ChecklistForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [titulo, setTitulo] = useState<string>("");
  const [campos, setCampos] = useState<Campo[]>([]);
  const [checklistResposta, setChecklistResposta] = useState<Object>({});
  const [formValues, setFormValues] = useState<FormValues>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [localResponseId, setLocalResponseId] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [currentCameraKey, setCurrentCameraKey] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // ---------- BUSCA OS CAMPOS NA API (COM SUPORTE OFFLINE) ----------
  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const currentUserStr = localStorage.getItem('current_user');

        if (!currentUserStr) {
          toast.error('Usuário não encontrado. Faça login novamente.');
          navigate('/login');
          return;
        }

        const currentUser = JSON.parse(currentUserStr);
        const token = currentUser?.authorization?.token;

        if (!token) {
          toast.error('Token não encontrado. Faça login novamente.');
          navigate('/login');
          return;
        }

        // Usa o API Client que tem fallback offline
        const data: { data: ChecklistData } = await apiClient.getChecklist(Number(id));
        console.log("[ChecklistForm] data: ", data);

        setTitulo(data.data.titulo || "Checklist");
        setCampos(data.data.campos || []);
        setChecklistResposta(data.data.resposta);

        console.log("[ChecklistForm] data.data.resposta:", data.data.resposta);
        console.log("[ChecklistForm] data.data.id:", data.data.id);

        // Verifica se já existe uma resposta local para este checklist
        const { getFormResponsesByChecklistId, getFieldResponsesByResponseId, getFormResponseByServerResponseId } = await import("@/services/db/checklists-db");

        // Tenta encontrar resposta existente de 3 formas:
        // 1. Por checklistId local (URL param)
        let existingResponses = await getFormResponsesByChecklistId(Number(id));
        console.log("[ChecklistForm] Existing responses by checklistId:", existingResponses);

        // 2. Se não encontrou e tem resposta do servidor, busca por serverResponseId
        if (existingResponses.length === 0 && data.data.resposta && typeof data.data.resposta === 'object' && 'id' in data.data.resposta) {
          const serverResponseId = (data.data.resposta as any).id;
          console.log("[ChecklistForm] Tentando buscar por serverResponseId:", serverResponseId);
          const byServerResponse = await getFormResponseByServerResponseId(serverResponseId);
          if (byServerResponse) {
            existingResponses = [byServerResponse];
            console.log("[ChecklistForm] Found response by serverResponseId:", serverResponseId);
          }
        }

        let responseId: number;
        if (existingResponses.length > 0) {
          // Usa a resposta existente (a mais recente)
          responseId = existingResponses[existingResponses.length - 1].id!;
          console.log("[ChecklistForm] Using existing local response:", responseId);
        } else {
          // Cria uma nova resposta local no IndexedDB
          // Pega o serverResponseId se existir em data.data.resposta
          const serverResponseId = (data.data.resposta && typeof data.data.resposta === 'object' && 'id' in data.data.resposta)
            ? (data.data.resposta as any).id
            : null;

          console.log("[ChecklistForm] Creating new response with serverResponseId:", serverResponseId, "formId:", data.data.id);

          responseId = await createFormResponse(
            Number(id),
            data.data.id,
            serverResponseId
          );
          console.log("[ChecklistForm] Created new local response:", responseId, "with serverResponseId:", serverResponseId);
        }

        setLocalResponseId(responseId);

        // Carrega valores salvos localmente no IndexedDB
        const localFieldResponses = await getFieldResponsesByResponseId(responseId);
        console.log("[ChecklistForm] Local field responses:", localFieldResponses);

        // Cria mapa com valores salvos localmente
        // IMPORTANTE: Usa string como chave, igual ao getCampoKey()
        const localValuesMap = new Map<string, any>();
        localFieldResponses.forEach(field => {
          localValuesMap.set(String(field.fieldId), field.valor);
        });

        // Também carrega valores do servidor (se houver)
        const savedValues = data.data.respostasSalvas;
        const serverValuesMap = new Map<string, any>();
        if (savedValues && Object.keys(savedValues).length > 0) {
          Object.values(savedValues).forEach(resposta => {
            console.log("resposta: ", resposta)
            if (resposta.id_campo) {
              serverValuesMap.set(String(resposta.id_campo), resposta.valor.valor);
            }
          });
        }

        // inicializa valores (prioridade para valores locais)
        const init: FormValues = {};
        (data.data.campos || []).forEach((campo, index) => {
          const key = getCampoKey(campo, index);

          console.log("campo: ", campo)
          // Prioriza valor local, depois servidor, depois valor padrão
          // IMPORTANTE: usa key (string) para buscar no mapa
          const localValue = localValuesMap.get(key);
          const serverValue = serverValuesMap.get(key);
          const savedValue = localValue ?? serverValue;

          console.log("key:", key)
          init[key] = savedValue ?? (campo.tipo === "select_multiplo" ? [] : "");
        });
        console.log("init: ", init)
        setFormValues(init);
      } catch (err: any) {
        setError(err.message || "Erro inesperado");
        toast.error(err.message || "Erro ao carregar checklist");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);


  // chave única para cada campo
  function getCampoKey(campo: Campo, index: number) {
    return campo.id ? String(campo.id) : `campo_${index}`;
  }

  // ---------- FUNÇÕES DE CÂMERA ----------
  const openCamera = async (key: string, isLeituraAutomatica: boolean = false) => {
    console.log('[openCamera] Iniciando abertura da câmera para key:', key);

    try {
      // Verifica se está rodando em plataforma nativa (Android/iOS)
      const isNative = Capacitor.isNativePlatform();
      console.log('[openCamera] Is native platform:', isNative);

      if (isNative) {
        // Usa o plugin nativo do Capacitor
        console.log('[openCamera] Usando Capacitor Camera (nativo)');

        const image = await CapacitorCamera.getPhoto({
          quality: 80,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
        });

        console.log('[openCamera] Foto capturada via Capacitor');

        // Processa a foto capturada
        const imageDataUrl = image.dataUrl;
        if (!imageDataUrl) {
          toast.error('Erro ao capturar foto');
          return;
        }

        // Verifica se é campo de leitura automática
        const campoIndex = campos.findIndex((c, idx) => getCampoKey(c, idx) === key);
        const campo = campos[campoIndex];

        if (!campo) {
          console.error('[openCamera] Campo não encontrado');
          return;
        }

        let valorParaSalvar: any;

        if (campo.tipo === 'leitura_automatica') {
          // Para leitura automática, mantém o objeto com foto e ocrTexto
          const valorAtual = formValues[key] || {};
          valorParaSalvar = { ...valorAtual, foto: imageDataUrl };

          setFormValues((prev) => ({
            ...prev,
            [key]: valorParaSalvar,
          }));
        } else {
          // Para foto simples, salva apenas a string base64
          valorParaSalvar = imageDataUrl;

          setFormValues((prev) => ({
            ...prev,
            [key]: imageDataUrl,
          }));
        }

        // Salva offline e online usando a mesma função dos campos de texto
        await sendValueCampo(valorParaSalvar, campo, checklistResposta);
        toast.success('Foto capturada e salva com sucesso!');

      } else {
        // Usa a API web do navegador (fallback para web)
        console.log('[openCamera] Usando getUserMedia (web)');

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.error('[openCamera] API getUserMedia não disponível');
          toast.error('Seu navegador não suporta acesso à câmera');
          return;
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        });

        console.log('[openCamera] Permissão concedida! Stream:', mediaStream);

        setStream(mediaStream);
        setCurrentCameraKey(key);
        setIsCameraOpen(true);

        // Aguarda o videoRef estar disponível
        setTimeout(() => {
          if (videoRef.current) {
            console.log('[openCamera] VideoRef disponível, atribuindo stream');
            videoRef.current.srcObject = mediaStream;
          } else {
            console.error('[openCamera] VideoRef não disponível após timeout');
          }
        }, 100);
      }
    } catch (error: any) {
      console.error('[openCamera] Erro ao acessar câmera:', error);
      console.error('[openCamera] Error name:', error.name);
      console.error('[openCamera] Error message:', error.message);

      let errorMessage = 'Não foi possível acessar a câmera.';

      if (error.name === 'NotAllowedError' || error.message?.includes('denied')) {
        errorMessage = 'Permissão de câmera negada. Permita o acesso nas configurações do app.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'Nenhuma câmera encontrada no dispositivo.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Câmera está sendo usada por outro aplicativo.';
      }

      toast.error(errorMessage);
    }
  };

  const capturePhoto = async () => {
    console.log('[capturePhoto] Função chamada');
    console.log('[capturePhoto] videoRef.current:', videoRef.current);
    console.log('[capturePhoto] currentCameraKey:', currentCameraKey);

    if (!videoRef.current || !currentCameraKey) {
      console.error('[capturePhoto] Condição falhou - videoRef ou currentCameraKey ausente');
      return;
    }

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    console.log('[capturePhoto] Canvas criado - width:', canvas.width, 'height:', canvas.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('[capturePhoto] Não foi possível obter contexto do canvas');
      return;
    }

    ctx.drawImage(video, 0, 0);
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);

    console.log('[capturePhoto] Foto capturada, tamanho:', imageDataUrl.length, 'bytes');

    // Verifica se é campo de leitura automática
    const campoIndex = campos.findIndex((c, idx) => getCampoKey(c, idx) === currentCameraKey);
    const campo = campos[campoIndex];

    if (!campo) {
      console.error('[capturePhoto] Campo não encontrado');
      closeCamera();
      return;
    }

    let valorParaSalvar: any;

    if (campo.tipo === 'leitura_automatica') {
      // Para leitura automática, mantém o objeto com foto e ocrTexto
      const valorAtual = formValues[currentCameraKey] || {};
      valorParaSalvar = { ...valorAtual, foto: imageDataUrl };

      setFormValues((prev) => ({
        ...prev,
        [currentCameraKey]: valorParaSalvar,
      }));
    } else {
      // Para foto simples, salva apenas a string base64
      valorParaSalvar = imageDataUrl;

      setFormValues((prev) => ({
        ...prev,
        [currentCameraKey]: imageDataUrl,
      }));
    }

    // Salva offline e online usando a mesma função dos campos de texto
    await sendValueCampo(valorParaSalvar, campo, checklistResposta);

    closeCamera();
    toast.success('Foto capturada e salva com sucesso!');
  };

  const closeCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraOpen(false);
    setCurrentCameraKey(null);
  };

  // Limpa o stream quando o componente é desmontado
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Funções para assinatura em canvas
  const ensureCanvasScale = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
  };

  const getXY = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as any).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as any).clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    ensureCanvasScale();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getXY(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getXY(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (key: string) => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setFormValues((prev) => ({ ...prev, [key]: canvas.toDataURL() }));
    }
  };

  const clearSignature = (key: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setFormValues((prev) => ({ ...prev, [key]: "" }));
  };

  // Calcula progresso do formulário
  const calculateProgress = () => {
    const total = campos.length;
    if (total === 0) return 0;
    let completed = 0;
    campos.forEach((campo, index) => {
      const key = getCampoKey(campo, index);
      const valor = formValues[key];
      if (campo.tipo === "select_multiplo") {
        if (Array.isArray(valor) && valor.length > 0) completed++;
      } else if (valor) {
        completed++;
      }
    });
    return (completed / total) * 100;
  };

  // Verifica se o formulário está completo
  const isFormComplete = () => {
    return campos.every((campo, index) => {
      const key = getCampoKey(campo, index);
      const valor = formValues[key];
      if (campo.tipo === "select_multiplo") {
        return Array.isArray(valor) && valor.length > 0;
      }
      return !!valor;
    });
  };

  // ---------- HANDLERS DE MUDANÇA ----------
  function handleChange(
    campo: Campo,
    index: number,
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const key = getCampoKey(campo, index);

    // select múltiplo (checkbox)
    if (campo.tipo === "select_multiplo") {
      const checked = (e.target as HTMLInputElement).checked;
      const option = e.target.value;

      setFormValues((prev) => {
        const atual = Array.isArray(prev[key]) ? prev[key] : [];
        const newValue = checked ? [...atual, option] : atual.filter((v: string) => v !== option);

        // Salva imediatamente para checkboxes
        sendValueCampo(newValue, campo, checklistResposta);

        return { ...prev, [key]: newValue };
      });
      return;
    }

    // CPF com máscara simples
    if (campo.tipo === "cpf") {
      const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
      let masked = raw;
      if (raw.length > 3) masked = raw.slice(0, 3) + "." + raw.slice(3);
      if (raw.length > 6) masked = masked.slice(0, 7) + "." + raw.slice(6);
      if (raw.length > 9) masked = masked.slice(0, 11) + "-" + raw.slice(9);

      setFormValues((prev) => ({ ...prev, [key]: masked }));
      return;
    }

    // Para selects, salva imediatamente também
    if (campo.tipo === "select_unico") {
      setFormValues((prev) => ({ ...prev, [key]: e.target.value }));
      sendValueCampo(e.target.value, campo, checklistResposta);
      return;
    }

    // Para outros campos, apenas atualiza o estado (salva no onBlur)
    setFormValues((prev) => ({ ...prev, [key]: e.target.value }));
  }

  // Handler para onBlur - salva o valor quando o campo perde o foco
  function handleBlur(campo: Campo, index: number) {
    const key = getCampoKey(campo, index);
    const valor = formValues[key];
    console.log("handleBlur valor:", valor, "tipo:", typeof valor);


    if(valor !== "") {
      // Salva o valor atual no banco
      sendValueCampo(valor, campo, checklistResposta);
    }
  }

  async function sendValueCampo(valor: any, campo: Campo, resposta: any) {
    try {
      console.log("ENTROU")
      if (!localResponseId || !campo.id) return;
      console.log("DOIS")
      // Salva localmente  primeiro (sempre)
      await saveFieldResponse(
        localResponseId,
        campo.id,
        valor,
        campo.id,
        resposta?.id
      );

      console.log("[ChecklistForm] Field saved locally:", campo.id, valor);

      // Tenta sincronizar online (o API Client cuida disso)
      if (resposta?.id) {
        try {
          await apiClient.saveField(
            valor,
            campo.id,
            resposta.id,
            localResponseId
          );
          console.log("[ChecklistForm] Field synced online:", campo.id);
        } catch (error) {
          // Erro online não é crítico - já está salvo localmente
          console.warn("[ChecklistForm] Field not synced (offline or error):", error);
        }
      }
    } catch (error) {
      console.error('[ChecklistForm] Error saving field:', error);
    }
  }

  function handleFileChange(
    campo: Campo,
    index: number,
    e: ChangeEvent<HTMLInputElement>
  ) {
    const key = getCampoKey(campo, index);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormValues((prev) => ({ ...prev, [key]: reader.result as string }));
    };
    reader.readAsDataURL(file);
  }

  // options dos selects (vem em string JSON)
  function parseOpcoes(campo: Campo): string[] {
    if (!campo.opcoes) return [];
    try {
      const arr = JSON.parse(campo.opcoes);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  // ---------- SUBMIT (COM SUPORTE OFFLINE) ----------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!isFormComplete()) {
      toast.error("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    setSubmitting(true);
    try {
      console.log("[ChecklistForm] Submitting form values:", formValues);

      const currentUserStr = localStorage.getItem('current_user');
      if (!currentUserStr || !checklistResposta || !('id' in checklistResposta)) {
        toast.error('Usuário não encontrado. Faça login novamente.');
        navigate('/login');
        return;
      }

      const currentUser = JSON.parse(currentUserStr);
      const token = currentUser?.authorization?.token;

      if (!token) {
        toast.error('Token não encontrado. Faça login novamente.');
        navigate('/login');
        return;
      }

      // Usa o API Client que tem suporte offline
      const result = await apiClient.submitForm(
        Number(id),
        (checklistResposta as any).id,
        localResponseId || undefined
      );

      if (result.offline) {
        toast.success("Checklist salvo localmente! Será sincronizado quando estiver online.");
      } else {
        toast.success("Checklist enviado com sucesso!");
      }

      navigate("/checklists");
    } catch (err: any) {
      console.error("[ChecklistForm] Error submitting form:", err);
      // Mesmo com erro, pode estar salvo localmente
      toast.warning("Checklist salvo localmente. Verifique sua conexão.");
      navigate("/checklists");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- RENDERIZAÇÃO DINÂMICA ----------
  function renderCampo(campo: Campo, index: number) {
    const key = getCampoKey(campo, index);
    const valor = formValues[key];

    switch (campo.tipo) {
      case "texto_simples":
        return (
          <div key={key} className="space-y-2">
            <Label>{campo.label}</Label>
            <Input
              type="text"
              value={valor || ""}
              onChange={(e) => handleChange(campo, index, e)}
              onBlur={() => handleBlur(campo, index)}
              placeholder={`Digite ${campo.label.toLowerCase()}`}
            />
          </div>
        );

      case "texto_longo":
        return (
          <div key={key} className="space-y-2">
            <Label>{campo.label}</Label>
            <textarea
              rows={4}
              value={valor || ""}
              onChange={(e) => handleChange(campo, index, e)}
              onBlur={() => handleBlur(campo, index)}
              placeholder={`Digite ${campo.label.toLowerCase()}`}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        );

      case "cpf":
        return (
          <div key={key} className="space-y-2">
            <Label>{campo.label}</Label>
            <Input
              type="text"
              maxLength={14}
              inputMode="numeric"
              value={valor || ""}
              onChange={(e) => handleChange(campo, index, e)}
              onBlur={() => handleBlur(campo, index)}
              placeholder="000.000.000-00"
            />
          </div>
        );

      case "data":
        return (
          <div key={key} className="space-y-2">
            <Label>{campo.label}</Label>
            <Input
              type="date"
              value={valor || ""}
              onChange={(e) => handleChange(campo, index, e)}
              onBlur={() => handleBlur(campo, index)}
            />
          </div>
        );

      case "leitura_automatica":
        return (
          <div key={key} className="space-y-2">
            <Label>{campo.label}</Label>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                console.log('[Button Click] Leitura Automática - key:', key);
                openCamera(key, true);
              }}
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
            >
              {valor?.foto ? (
                <img
                  src={valor.foto}
                  alt={campo.label}
                  className="h-full object-cover rounded-lg"
                />
              ) : (
                <>
                  <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">
                    Capturar foto
                  </span>
                </>
              )}
            </button>
            <Input
              type="text"
              placeholder="Texto lido da imagem (OCR)"
              value={valor?.ocrTexto || ""}
              onChange={(e) =>
                setFormValues((prev) => ({
                  ...prev,
                  [key]: { ...(prev[key] || {}), ocrTexto: e.target.value },
                }))
              }
            />
          </div>
        );

      case "foto":
        return (
          <div key={key} className="space-y-2">
            <Label>{campo.label}</Label>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                console.log('[Button Click] Foto - key:', key);
                openCamera(key);
              }}
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
            >
              {valor ? (
                <img
                  src={valor}
                  alt={campo.label}
                  className="h-full object-cover rounded-lg"
                />
              ) : (
                <>
                  <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">
                    Capturar {campo.label.toLowerCase()}
                  </span>
                </>
              )}
            </button>
          </div>
        );

      case "assinatura":
        return (
          <div key={key} className="space-y-2">
            <Label>{campo.label}</Label>
            <div className="w-full h-40 border-2 border-border rounded-lg">
              <canvas
                ref={canvasRef}
                className="w-full h-full touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={() => stopDrawing(key)}
                onMouseLeave={() => stopDrawing(key)}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={() => stopDrawing(key)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => clearSignature(key)}
              className="w-full"
            >
              Limpar Assinatura
            </Button>
          </div>
        );

      case "select_unico": {
        const opcoes = parseOpcoes(campo);
        return (
          <div key={key} className="space-y-2">
            <Label>{campo.label}</Label>
            <select
              value={valor || ""}
              onChange={(e) => handleChange(campo, index, e)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Selecione...</option>
              {opcoes.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>
        );
      }

      case "select_multiplo": {
        const opcoes = parseOpcoes(campo);
        const selecionados: string[] = valor || [];
        return (
          <div key={key} className="space-y-2">
            <Label>{campo.label}</Label>
            <div className="space-y-2">
              {opcoes.map((op) => (
                <label key={op} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    value={op}
                    checked={selecionados.includes(op)}
                    onChange={(e) => handleChange(campo, index, e)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm">{op}</span>
                </label>
              ))}
            </div>
          </div>
        );
      }

      default:
        return (
          <div key={key} className="space-y-2">
            <p className="text-sm text-muted-foreground">Tipo de campo não suportado: {campo.tipo}</p>
          </div>
        );
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando checklist...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive">Erro: {error}</p>
          <Button onClick={() => navigate(-1)} variant="outline">
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="bg-primary text-primary-foreground p-4 flex items-center gap-3 sticky top-0 z-10">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-white/20 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold flex-1">{titulo}</h1>
        <SyncStatusBadge showDetails={false} />
      </header>

      <div className="p-4">
        <Card className="p-4 mb-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Progresso</span>
              <span className="text-muted-foreground">
                {Math.round(calculateProgress())}%
              </span>
            </div>
            <Progress value={calculateProgress()} />
          </div>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="p-6 space-y-4">
            {campos.map((campo, index) => renderCampo(campo, index))}
          </Card>

          <Button
            type="submit"
            disabled={!isFormComplete() || submitting}
            className="w-full h-12 text-base font-semibold"
          >
            {submitting ? "Enviando..." : "Enviar Checklist"}
          </Button>
        </form>
      </div>

      {/* Modal da Câmera */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex-1 relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-4 bg-black/80 flex gap-3 justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={closeCamera}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                console.log('[Modal] Botão Capturar clicado');
                capturePhoto();
              }}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              <Camera className="w-5 h-5 mr-2" />
              Capturar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChecklistForm;

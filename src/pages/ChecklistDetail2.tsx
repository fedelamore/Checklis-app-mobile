import { useEffect, useState, ChangeEvent, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from 'sonner';
import { ArrowLeft, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

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

  // ---------- BUSCA OS CAMPOS NA API ----------
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

        const res = await fetch(`${API_URL}/checklist/${id}`, {
          method: "GET", 
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": `Bearer ${token}`, 
            "X-Requested-With": "XMLHttpRequest", 
          },
        });
        if (!res.ok) throw new Error("Erro ao buscar checklist");

        const data: { data: ChecklistData } = await res.json();
        console.log("data: ", data);

        setTitulo(data.data.titulo || "Checklist");
        setCampos(data.data.campos || []);
        setChecklistResposta(data.data.resposta);
        console.log("checklistResposta: ", checklistResposta)
        const savedValues = data.data.respostasSalvas;
        const savedValuesMap = new Map<number, any>();
        if (savedValues && Object.keys(savedValues).length > 0) {
          Object.values(savedValues).forEach(resposta => {
            console.log("resposta: ", resposta)
            if (resposta.id_campo) {
              savedValuesMap.set(resposta.id_campo, resposta.valor.valor);
            }
          });
        }

        console.log("savedValuesMap: ", savedValuesMap)
        // inicializa valores
        const init: FormValues = {};
        (data.data.campos || []).forEach((campo, index) => {
          const key = getCampoKey(campo, index);

          console.log("campo: ", campo)
          const savedValue = campo.id ? savedValuesMap.get(campo.id) : undefined;
          console.log("savedValue: ", savedValue)
          init[key] = savedValue ?? (campo.tipo === "select_multiplo" ? [] : "");
        });
        console.log("init: ", init)
        setFormValues(init);
      } catch (err: any) {
        setError(err.message || "Erro inesperado");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  //salvar resposta por campo
  function salvarCampo() {

  }

  // chave única para cada campo
  function getCampoKey(campo: Campo, index: number) {
    return campo.id ? String(campo.id) : `campo_${index}`;
  }

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
        if (checked) return { ...prev, [key]: [...atual, option] };
        return { ...prev, [key]: atual.filter((v: string) => v !== option) };
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

    setFormValues((prev) => ({ ...prev, [key]: e.target.value }));

    console.log("campo!: ", campo)
    console.log("index!: ", index)
    console.log("e!: ", e)
    sendValueCampo(e.target.value, campo, checklistResposta)
  }

  async function sendValueCampo(valor, campo, resposta) {
    try {
      const currentUserStr = localStorage.getItem('current_user');
      if (!currentUserStr) {
        toast.error('Usuário não encontrado. Faça login novamente.');
        navigate('/login');
        return;
      }

      const currentUser = JSON.parse(currentUserStr);
      const token = currentUser?.authorization?.token;

      const res = await fetch(`${API_URL}/salvar_campo`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`, 
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ 
          valor: valor,
          id_campo: campo.id,
          id_resposta: resposta.id,
          web: 0
        }),
      });

      console.log('[auth] HTTP status', res.status);
    
      if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error('[auth] login error body', err);
          throw new Error(err?.message || 'Erro ao autenticar');
      }

      const data = (await res.json());
      console.log('sendValueCampo', data);
      return data;
    } catch (error) {
        console.error('[auth] loginRequest caught', error);
        throw error;
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

  // ---------- SUBMIT ----------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!isFormComplete()) {
      toast.error("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    setSubmitting(true);
    try {
      console.log("Valores do formulário:", formValues);

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

      const response = await fetch(`${API_URL}/checklist/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          id_resposta: checklistResposta.id
        })
      });

      toast.success("Checklist enviado com sucesso!");
      navigate("/checklists");
    } catch (err: any) {
      console.error(err);
      toast.error("Ocorreu um erro ao salvar o checklist.");
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
            />
          </div>
        );

      case "leitura_automatica":
        return (
          <div key={key} className="space-y-2">
            <Label>{campo.label}</Label>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors">
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
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setFormValues((prev) => ({
                      ...prev,
                      [key]: { ...(prev[key] || {}), foto: reader.result as string },
                    }));
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>
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
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors">
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
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFileChange(campo, index, e)}
              />
            </label>
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
        <h1 className="text-xl font-bold">{titulo}</h1>
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
    </div>
  );
}

export default ChecklistForm;

import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Smile, Frown, Meh } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { storage } from "@/utils/storage";
import { validateCPF, formatCPF, formatPlaca } from "@/utils/validators";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isReallyOnline } from "@/utils/connectivity";

type Limpeza = "limpo" | "regular" | "sujo" | "";

const CreateChecklist = () => {
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<{
    motorista: string;
    cpf: string;
    empresa: string;
    placa: string;
    odometro: string;
    limpeza: Limpeza;
  }>({
    motorista: "",
    cpf: "",
    empresa: "Local GPS",
    placa: "",
    odometro: "",
    limpeza: "",
  });

  const [photos, setPhotos] = useState<{
    odometroFoto: string;
    fotoFrente: string;
    fotoTraseira: string;
    fotoLateralDireita: string;
    fotoLateralEsquerda: string;
  }>({
    odometroFoto: "",
    fotoFrente: "",
    fotoTraseira: "",
    fotoLateralDireita: "",
    fotoLateralEsquerda: "",
  });

  const [assinatura, setAssinatura] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const handlePhotoCapture = (field: keyof typeof photos, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotos((prev) => ({ ...prev, [field]: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  // melhora a nitidez em telas com DPR alto (Android)
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

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) setAssinatura(canvas.toDataURL());
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setAssinatura("");
  };

  const calculateProgress = () => {
    let completed = 0;
    const total = 11;
    if (formData.motorista) completed++;
    if (formData.cpf && validateCPF(formData.cpf)) completed++;
    if (formData.empresa) completed++;
    if (formData.placa) completed++;
    if (formData.odometro) completed++;
    if (photos.odometroFoto) completed++;
    if (formData.limpeza) completed++;
    if (photos.fotoFrente) completed++;
    if (photos.fotoTraseira) completed++;
    if (photos.fotoLateralDireita) completed++;
    if (photos.fotoLateralEsquerda) completed++;
    return (completed / total) * 100;
  };

  const isFormComplete = () => {
    return (
      !!formData.motorista &&
      !!formData.cpf &&
      validateCPF(formData.cpf) &&
      !!formData.empresa &&
      !!formData.placa &&
      !!formData.odometro &&
      !!photos.odometroFoto &&
      !!formData.limpeza &&
      !!photos.fotoFrente &&
      !!photos.fotoTraseira &&
      !!photos.fotoLateralDireita &&
      !!photos.fotoLateralEsquerda &&
      !!assinatura
    );
  };

   const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (submitting) return;
      setSubmitting(true);

      try {
        if (!isFormComplete()) {
          toast.error("Por favor, preencha todos os campos obrigatórios.");
          setSubmitting(false);
          return;
        }
        //Checagem robusta no momento do clique
        const reallyOnline = await isReallyOnline();

        const checklist = {
          id: Date.now().toString(),
          motorista: formData.motorista,
          cpf: formData.cpf,
          empresa: formData.empresa,
          placa: formData.placa,
          odometro: formData.odometro,
          limpeza: formData.limpeza as Exclude<Limpeza, "">,
          ...photos,
          assinatura,
          dataCriacao: new Date().toISOString(),
          sincronizado: reallyOnline,
          pendente: !reallyOnline,
        };

        storage.saveChecklist(checklist);

        if (reallyOnline) {
              toast.success("Checklist criado e sincronizado com sucesso!");
              // ✅ sem query string; usa state para selecionar a aba
              navigate("/checklists", { state: { tab: "concluidos" } });
            } else {
              toast.info("Checklist salvo localmente. Será sincronizado quando houver conexão.");
              navigate("/checklists", { state: { tab: "pendentes" } });
            }
          } catch (err) {
            console.error(err);
            toast.error("Ocorreu um erro ao salvar o checklist.");
          } finally {
            setSubmitting(false);
          }
  };

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
        <h1 className="text-xl font-bold">Criar Checklist</h1>
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
            <h2 className="font-semibold text-lg">Informações do Motorista</h2>

            <div className="space-y-2">
              <Label htmlFor="motorista">Nome do Motorista *</Label>
              <Input
                id="motorista"
                value={formData.motorista}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, motorista: e.target.value }))
                }
                placeholder="Digite o nome completo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf">CPF *</Label>
              <Input
                id="cpf"
                value={formData.cpf}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, cpf: formatCPF(e.target.value) }))
                }
                placeholder="000.000.000-00"
                maxLength={14}
                required
              />
              {formData.cpf && !validateCPF(formData.cpf) && (
                <p className="text-xs text-destructive">CPF inválido</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="empresa">Empresa *</Label>
              <Input
                id="empresa"
                value={formData.empresa}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, empresa: e.target.value }))
                }
                placeholder="Nome da empresa"
                required
              />
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-lg">Informações do Veículo</h2>

            <div className="space-y-2">
              <Label htmlFor="placa">Placa do Veículo *</Label>
              <Input
                id="placa"
                value={formData.placa}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    placa: formatPlaca(e.target.value),
                  }))
                }
                placeholder="ABC1D23"
                maxLength={7}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="odometro">Odômetro (km) *</Label>
              <Input
                id="odometro"
                type="number"
                inputMode="numeric"
                value={formData.odometro}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, odometro: e.target.value }))
                }
                placeholder="Digite a quilometragem"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Foto do Odômetro *</Label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors">
                {photos.odometroFoto ? (
                  <img
                    src={photos.odometroFoto}
                    alt="Odômetro"
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
                  onChange={(e) =>
                    e.target.files?.[0] &&
                    handlePhotoCapture("odometroFoto", e.target.files[0])
                  }
                />
              </label>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-lg">Limpeza do Veículo *</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "limpo" as const, icon: Smile, label: "Limpo", color: "text-green-600" },
                { value: "regular" as const, icon: Meh, label: "Regular", color: "text-amber-600" },
                { value: "sujo" as const, icon: Frown, label: "Sujo", color: "text-red-600" },
              ].map(({ value, icon: Icon, label, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setFormData((p) => ({ ...p, limpeza: value }))
                  }
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                    formData.limpeza === value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-8 h-8",
                      formData.limpeza === value ? "text-primary" : color
                    )}
                  />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-lg">Fotos do Veículo *</h2>
            {[
              { field: "fotoFrente", label: "Frente" },
              { field: "fotoTraseira", label: "Traseira" },
              { field: "fotoLateralDireita", label: "Lateral Direita" },
              { field: "fotoLateralEsquerda", label: "Lateral Esquerda" },
            ].map(({ field, label }) => (
              <div key={field} className="space-y-2">
                <Label>{label}</Label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors">
                  {(photos as any)[field] ? (
                    <img
                      src={(photos as any)[field]}
                      alt={label}
                      className="h-full object-cover rounded-lg"
                    />
                  ) : (
                    <>
                      <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">
                        Capturar {label.toLowerCase()}
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) =>
                      e.target.files?.[0] &&
                      handlePhotoCapture(field as keyof typeof photos, e.target.files[0])
                    }
                  />
                </label>
              </div>
            ))}
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-lg">Assinatura Digital *</h2>
            <div className="space-y-2">
              <div className="w-full h-40 border-2 border-border rounded-lg">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full touch-none"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              <Button type="button" variant="outline" onClick={clearSignature} className="w-full">
                Limpar Assinatura
              </Button>
            </div>
          </Card>

          <Button
              type="submit"
              disabled={!isFormComplete() || submitting}
              className="w-full h-12 text-base font-semibold"
            >
              {isOnline ? "Enviar as" : "Salvar checklist"}
            </Button>
        </form>
      </div>
    </div>
  );
};

export default CreateChecklist;

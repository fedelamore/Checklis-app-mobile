import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, Smile, Frown, Meh } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { storage } from '@/utils/storage';
import { validateCPF, formatCPF, formatPlaca } from '@/utils/validators';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Checklist } from '@/types/checklist';

const EditChecklist = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  
  const [formData, setFormData] = useState({
    motorista: '',
    cpf: '',
    empresa: '',
    placa: '',
    odometro: '',
    limpeza: '' as 'limpo' | 'regular' | 'sujo' | '',
  });

  const [photos, setPhotos] = useState({
    odometroFoto: '',
    fotoFrente: '',
    fotoTraseira: '',
    fotoLateralDireita: '',
    fotoLateralEsquerda: '',
  });

  const [assinatura, setAssinatura] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (id) {
      const checklists = storage.getChecklists();
      const found = checklists.find(c => c.id === id);
      if (found) {
        setFormData({
          motorista: found.motorista,
          cpf: found.cpf,
          empresa: found.empresa,
          placa: found.placa,
          odometro: found.odometro,
          limpeza: found.limpeza,
        });
        setPhotos({
          odometroFoto: found.odometroFoto || '',
          fotoFrente: found.fotoFrente || '',
          fotoTraseira: found.fotoTraseira || '',
          fotoLateralDireita: found.fotoLateralDireita || '',
          fotoLateralEsquerda: found.fotoLateralEsquerda || '',
        });
        setAssinatura(found.assinatura || '');
        
        // Draw existing signature on canvas
        if (found.assinatura && canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          const img = new Image();
          img.onload = () => {
            ctx?.drawImage(img, 0, 0);
          };
          img.src = found.assinatura;
        }
      }
    }
  }, [id]);

  const handlePhotoCapture = (field: keyof typeof photos, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotos(prev => ({ ...prev, [field]: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setAssinatura(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setAssinatura('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!id) return;

    if (!validateCPF(formData.cpf)) {
      toast.error('CPF inválido');
      return;
    }

    if (!formData.limpeza) {
      toast.error('Selecione o status de limpeza do veículo');
      return;
    }

    const updatedChecklist: Checklist = {
      id,
      motorista: formData.motorista,
      cpf: formData.cpf,
      empresa: formData.empresa,
      placa: formData.placa,
      odometro: formData.odometro,
      limpeza: formData.limpeza as 'limpo' | 'regular' | 'sujo',
      ...photos,
      assinatura,
      dataCriacao: new Date().toISOString(),
      sincronizado: isOnline,
      pendente: !isOnline,
    };

    storage.updateChecklist(id, updatedChecklist);
    
    if (isOnline) {
      toast.success('Checklist atualizado e sincronizado com sucesso!');
    } else {
      toast.info('Checklist atualizado localmente. Será sincronizado quando houver conexão.');
    }

    navigate('/checklists');
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="bg-primary text-primary-foreground p-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/20 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Editar Checklist</h1>
      </header>

      <div className="p-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-lg">Informações do Motorista</h2>
            
            <div className="space-y-2">
              <Label htmlFor="motorista">Nome do Motorista *</Label>
              <Input
                id="motorista"
                value={formData.motorista}
                onChange={(e) => setFormData(prev => ({ ...prev, motorista: e.target.value }))}
                placeholder="Digite o nome completo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf">CPF *</Label>
              <Input
                id="cpf"
                value={formData.cpf}
                onChange={(e) => setFormData(prev => ({ ...prev, cpf: formatCPF(e.target.value) }))}
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
                onChange={(e) => setFormData(prev => ({ ...prev, empresa: e.target.value }))}
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
                onChange={(e) => setFormData(prev => ({ ...prev, placa: formatPlaca(e.target.value) }))}
                placeholder="ABC1234"
                maxLength={7}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="odometro">Odômetro (km) *</Label>
              <Input
                id="odometro"
                type="number"
                value={formData.odometro}
                onChange={(e) => setFormData(prev => ({ ...prev, odometro: e.target.value }))}
                placeholder="Digite a quilometragem"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Foto do Odômetro *</Label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors">
                {photos.odometroFoto ? (
                  <img src={photos.odometroFoto} alt="Odômetro" className="h-full object-cover rounded-lg" />
                ) : (
                  <>
                    <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Capturar foto</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handlePhotoCapture('odometroFoto', e.target.files[0])}
                />
              </label>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-lg">Limpeza do Veículo *</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'limpo', icon: Smile, label: 'Limpo', color: 'text-success' },
                { value: 'regular', icon: Meh, label: 'Regular', color: 'text-warning' },
                { value: 'sujo', icon: Frown, label: 'Sujo', color: 'text-destructive' },
              ].map(({ value, icon: Icon, label, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, limpeza: value as any }))}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                    formData.limpeza === value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Icon className={cn("w-8 h-8", formData.limpeza === value ? "text-primary" : color)} />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-lg">Fotos do Veículo *</h2>
            
            {[
              { field: 'fotoFrente', label: 'Frente' },
              { field: 'fotoTraseira', label: 'Traseira' },
              { field: 'fotoLateralDireita', label: 'Lateral Direita' },
              { field: 'fotoLateralEsquerda', label: 'Lateral Esquerda' },
            ].map(({ field, label }) => (
              <div key={field} className="space-y-2">
                <Label>{label}</Label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors">
                  {photos[field as keyof typeof photos] ? (
                    <img src={photos[field as keyof typeof photos]} alt={label} className="h-full object-cover rounded-lg" />
                  ) : (
                    <>
                      <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Capturar {label.toLowerCase()}</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handlePhotoCapture(field as keyof typeof photos, e.target.files[0])}
                  />
                </label>
              </div>
            ))}
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-lg">Assinatura Digital *</h2>
            <div className="space-y-2">
              <canvas
                ref={canvasRef}
                width={300}
                height={150}
                className="w-full border-2 border-border rounded-lg touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              <Button type="button" variant="outline" onClick={clearSignature} className="w-full">
                Limpar Assinatura
              </Button>
            </div>
          </Card>

          <Button type="submit" className="w-full h-12 text-base font-semibold">
            Atualizar Checklist
          </Button>
        </form>
      </div>
    </div>
  );
};

export default EditChecklist;

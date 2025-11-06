import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { storage } from '@/utils/storage';
import { Checklist } from '@/types/checklist';

const ChecklistDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [checklist, setChecklist] = useState<Checklist | null>(null);

  useEffect(() => {
    if (id) {
      const checklists = storage.getChecklists();
      const found = checklists.find(c => c.id === id);
      setChecklist(found || null);
    }
  }, [id]);

  if (!checklist) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Checklist não encontrado</p>
      </div>
    );
  }

  const limpezaEmoji = {
    limpo: '😊',
    regular: '😐',
    sujo: '😢'
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="bg-primary text-primary-foreground p-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/20 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Detalhes do Checklist</h1>
      </header>

      <div className="p-4 space-y-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Status</h2>
            <div className="flex items-center gap-2">
              {checklist.sincronizado ? (
                <>
                  <CheckCircle className="w-5 h-5 text-success" />
                  <span className="text-sm font-medium text-success">Sincronizado</span>
                </>
              ) : (
                <>
                  <Clock className="w-5 h-5 text-warning" />
                  <span className="text-sm font-medium text-warning">Pendente</span>
                </>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Criado em: {new Date(checklist.dataCriacao).toLocaleDateString()} às{' '}
            {new Date(checklist.dataCriacao).toLocaleTimeString()}
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-semibold text-lg">Informações do Motorista</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground">Nome</label>
              <p className="font-medium">{checklist.motorista}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">CPF</label>
              <p className="font-medium">{checklist.cpf}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Empresa</label>
              <p className="font-medium">{checklist.empresa}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-semibold text-lg">Informações do Veículo</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground">Placa</label>
              <p className="font-medium">{checklist.placa}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Odômetro</label>
              <p className="font-medium">{checklist.odometro} km</p>
            </div>
            {checklist.odometroFoto && (
              <div>
                <label className="text-sm text-muted-foreground">Foto do Odômetro</label>
                <img src={checklist.odometroFoto} alt="Odômetro" className="mt-2 rounded-lg w-full" />
              </div>
            )}
            <div>
              <label className="text-sm text-muted-foreground">Limpeza</label>
              <p className="font-medium text-2xl">{limpezaEmoji[checklist.limpeza]}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-semibold text-lg">Fotos do Veículo</h2>
          <div className="grid grid-cols-2 gap-4">
            {checklist.fotoFrente && (
              <div>
                <label className="text-sm text-muted-foreground">Frente</label>
                <img src={checklist.fotoFrente} alt="Frente" className="mt-2 rounded-lg w-full" />
              </div>
            )}
            {checklist.fotoTraseira && (
              <div>
                <label className="text-sm text-muted-foreground">Traseira</label>
                <img src={checklist.fotoTraseira} alt="Traseira" className="mt-2 rounded-lg w-full" />
              </div>
            )}
            {checklist.fotoLateralDireita && (
              <div>
                <label className="text-sm text-muted-foreground">Lateral Direita</label>
                <img src={checklist.fotoLateralDireita} alt="Lateral Direita" className="mt-2 rounded-lg w-full" />
              </div>
            )}
            {checklist.fotoLateralEsquerda && (
              <div>
                <label className="text-sm text-muted-foreground">Lateral Esquerda</label>
                <img src={checklist.fotoLateralEsquerda} alt="Lateral Esquerda" className="mt-2 rounded-lg w-full" />
              </div>
            )}
          </div>
        </Card>

        {checklist.assinatura && (
          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-lg">Assinatura Digital</h2>
            <img src={checklist.assinatura} alt="Assinatura" className="rounded-lg border border-border" />
          </Card>
        )}
      </div>
    </div>
  );
};

export default ChecklistDetail;

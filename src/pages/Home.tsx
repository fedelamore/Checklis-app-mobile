import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ClipboardList, Clock } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { storage } from '@/utils/storage';
import { Checklist } from '@/types/checklist';
import { Card } from '@/components/ui/card';

const Home = () => {
  const [pendingChecklists, setPendingChecklists] = useState<Checklist[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const user = storage.getUser();
    if (!user) {
      navigate('/login');
      return;
    }

    loadPendingChecklists();
  }, [navigate]);

  const loadPendingChecklists = () => {
    const checklists = storage.getChecklists();
    const pending = checklists.filter(c => !c.sincronizado);
    setPendingChecklists(pending);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Check className="w-6 h-6" strokeWidth={3} />
          <h1 className="text-xl font-bold">Início</h1>
        </div>
        <button
          onClick={() => navigate('/perfil')}
          className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center"
        >
          <User className="w-5 h-5" />
        </button>
      </header>

      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Checklists pendentes</h2>

        {pendingChecklists.length === 0 ? (
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <ClipboardList className="w-16 h-16 text-muted-foreground mb-4" strokeWidth={1.5} />
              <p className="text-muted-foreground">
                Nenhum checklist pendente de sincronização
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingChecklists.map((checklist) => (
              <Card
                key={checklist.id}
                className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/checklist/${checklist.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold">{checklist.motorista}</h3>
                    <p className="text-sm text-muted-foreground">
                      Placa: {checklist.placa} • {new Date(checklist.dataCriacao).toLocaleDateString()}
                    </p>
                  </div>
                  <Clock className="w-5 h-5 text-warning" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

const Check = ({ className, strokeWidth }: { className?: string; strokeWidth?: number }) => (
  <svg
    className={className}
    strokeWidth={strokeWidth}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
  >
    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default Home;

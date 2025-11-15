import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ClipboardList, Clock, RefreshCw } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { storage } from '@/utils/storage';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getUnsyncedFormResponses } from '@/services/db/checklists-db';
import { FormResponseDB } from '@/services/db';
import { syncManager } from '@/services/sync-manager';
import { toast } from 'sonner';

const Home = () => {
  const [pendingResponses, setPendingResponses] = useState<FormResponseDB[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const user = storage.getUser();
    if (!user) {
      navigate('/login');
      return;
    }

    loadPendingChecklists();
  }, [navigate]);

  const loadPendingChecklists = async () => {
    // Carrega respostas não sincronizadas do IndexedDB
    const unsynced = await getUnsyncedFormResponses();
    console.log('[Home] Unsynced responses:', unsynced);
    setPendingResponses(unsynced);
  };

  const handleManualSync = async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    toast.info('Iniciando sincronização...');

    try {
      await syncManager.syncAll();
      // Recarrega a lista após sincronizar
      await loadPendingChecklists();
    } catch (error) {
      console.error('[Home] Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Checklists pendentes de sincronização</h2>
          {pendingResponses.length > 0 && (
            <Button
              onClick={handleManualSync}
              disabled={isSyncing}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
            </Button>
          )}
        </div>

        {pendingResponses.length === 0 ? (
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
            {pendingResponses.map((response) => (
              <Card
                key={response.id}
                className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/checklist/${response.checklistId}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold">
                      Checklist #{response.checklistId}
                      {response.serverChecklistId && ` (Server: #${response.serverChecklistId})`}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Criado em: {new Date(response.createdAt).toLocaleString('pt-BR')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Status: {response.syncStatus === 'local_only' ? 'Apenas local' : response.syncStatus}
                      {response.isComplete && ' • Completo'}
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

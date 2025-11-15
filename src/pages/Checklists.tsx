import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; // ✅ importados
import { User, ClipboardList, Clock, CheckCircle, Pencil, Trash2 } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { storage } from '@/utils/storage';
import { Checklist, ChecklistApiResponse } from '@/types/checklist';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { apiClient } from '@/services/api-client';

const API_URL = import.meta.env.VITE_API_URL || '';

const Checklists = () => {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ Seleciona a aba inicial a partir do state
  const initialTab = useMemo(() => {
    const st = (location.state as any)?.tab;
    return st === 'pendentes' || st === 'concluidos' ? st : 'todos';
  }, [location.state]);

  useEffect(() => {
    loadChecklists();
  }, []);

  const loadChecklists = async () => {
    try {
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

      try {
        const response = await fetch(`${API_URL}/checklists`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result: ChecklistApiResponse = await response.json();

        if (result.success && result.data?.data) {
          setChecklists(result.data.data);

          // Salva a lista no localStorage para fallback offline
          storage.overwriteChecklists(result.data.data);

          // Download automático dos checklists em andamento para uso offline
          apiClient.downloadInProgressChecklistsForOffline(result.data.data).catch(err => {
            console.warn('[Checklists] Error auto-downloading checklists:', err);
          });
        } else {
          toast.error('Erro ao processar dados dos checklists');
        }
      } catch (fetchError) {
        console.warn('[Checklists] API fetch failed, trying local storage:', fetchError);

        // Tenta buscar do localStorage (fallback offline)
        const cachedChecklists = storage.getChecklists();
        if (cachedChecklists && cachedChecklists.length > 0) {
          console.log('[Checklists] Using cached checklists from localStorage');
          setChecklists(cachedChecklists);
          toast.info('Mostrando dados offline');
        } else {
          throw new Error('Sem conexão e sem dados offline disponíveis');
        }
      }
    } catch (error) {
      console.error('Erro ao carregar checklists:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar checklists');
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      storage.deleteChecklist?.(String(deleteId));
      loadChecklists();
      toast.success('Checklist excluído com sucesso');
      setDeleteId(null);
    }
  };

  const concluidos = checklists.filter(c => c.status === 'concluido');
  const pendentes = checklists.filter(c => c.status === 'em_andamento');

  // ✅ Datas seguras (evita RangeError)
  const formatDateParts = (iso?: string) => {
    try {
      const d = iso ? new Date(iso) : null;
      if (!d || isNaN(d.getTime())) return { date: '--/--/----', time: '--:--' };
      return { date: d.toLocaleDateString(), time: d.toLocaleTimeString() };
    } catch {
      return { date: '--/--/----', time: '--:--' };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'em_andamento':
        return 'Em andamento';
      case 'concluido':
        return 'Concluído';
      case 'cancelado':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'em_andamento':
        return 'text-warning';
      case 'concluido':
        return 'text-success';
      case 'cancelado':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  const ChecklistCard = ({ checklist }: { checklist: Checklist }) => {
    const { date, time } = formatDateParts(checklist.created_at);
    return (
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex-1 cursor-pointer"
            onClick={() => navigate(`/checklist/${checklist.id}`)}
          >
            <h3 className="font-semibold">{checklist.formulario.nome}</h3>
            <p className="text-sm text-muted-foreground">{checklist.formulario.descricao}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-sm font-medium ${getStatusColor(checklist.status)}`}>
                {getStatusLabel(checklist.status)}
              </span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">
                {date} às {time}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {checklist.status === 'concluido' ? (
              <CheckCircle className="w-5 h-5 text-success" />
            ) : (
              <Clock className="w-5 h-5 text-warning" />
            )}
            <button
              onClick={() => navigate(`/editar-checklist/${checklist.id}`)}
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
            >
              <Pencil className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => setDeleteId(checklist.id)}
              className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6" />
          <h1 className="text-xl font-bold">Checklists</h1>
        </div>
        <button
          onClick={() => navigate('/perfil')}
          className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center"
        >
          <User className="w-5 h-5" />
        </button>
      </header>

      <div className="p-4">
        <Tabs defaultValue={initialTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
            <TabsTrigger value="concluidos">Concluídos</TabsTrigger>
          </TabsList>

          <TabsContent value="todos" className="space-y-3">
            {checklists.length === 0 ? (
              <Card className="p-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <ClipboardList className="w-16 h-16 text-muted-foreground mb-4" strokeWidth={1.5} />
                  <p className="text-muted-foreground">Nenhum checklist criado</p>
                </div>
              </Card>
            ) : (
              checklists.map(checklist => (
                <ChecklistCard key={checklist.id} checklist={checklist} />
              ))
            )}
          </TabsContent>

          <TabsContent value="pendentes" className="space-y-3">
            {pendentes.length === 0 ? (
              <Card className="p-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <Clock className="w-16 h-16 text-muted-foreground mb-4" strokeWidth={1.5} />
                  <p className="text-muted-foreground">Nenhum checklist pendente</p>
                </div>
              </Card>
            ) : (
              pendentes.map(checklist => (
                <ChecklistCard key={checklist.id} checklist={checklist} />
              ))
            )}
          </TabsContent>

          <TabsContent value="concluidos" className="space-y-3">
            {concluidos.length === 0 ? (
              <Card className="p-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <CheckCircle className="w-16 h-16 text-muted-foreground mb-4" strokeWidth={1.5} />
                  <p className="text-muted-foreground">Nenhum checklist concluído</p>
                </div>
              </Card>
            ) : (
              concluidos.map(checklist => (
                <ChecklistCard key={checklist.id} checklist={checklist} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este checklist? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
};

export default Checklists;

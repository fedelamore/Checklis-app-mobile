import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; // ✅ importados
import { User, ClipboardList, Clock, CheckCircle, Pencil, Trash2 } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { storage } from '@/utils/storage';
import { Checklist } from '@/types/checklist';
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

const Checklists = () => {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
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

  // ✅ Normaliza os itens do storage (datas/ids)
  const loadChecklists = () => {
    const raw = storage.getChecklists?.() ?? [];

    const normalized = raw
      .filter(Boolean)
      .map((c: any) => {
        const data = c.dataCriacao || c.dataCriação || c.createdAt || c.dataCreation;
        const safeISO = (() => {
          try {
            const d = data ? new Date(data) : null;
            if (d && !isNaN(d.getTime())) return d.toISOString();
          } catch {}
          return new Date().toISOString();
        })();

        return {
          id: c.id ?? String(c.timestamp ?? Date.now()),
          motorista: c.motorista ?? '',
          placa: c.placa ?? '',
          dataCriacao: safeISO,
          sincronizado: !!c.sincronizado,
          pendente: !!c.pendente,
          ...c,
        } as Checklist;
      });

    setChecklists(normalized);

    if (typeof storage.overwriteChecklists === 'function') {
      storage.overwriteChecklists(normalized);
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      storage.deleteChecklist?.(deleteId);
      loadChecklists();
      toast.success('Checklist excluído com sucesso');
      setDeleteId(null);
    }
  };

  const concluidos = checklists.filter(c => c.sincronizado);
  const pendentes = checklists.filter(c => !c.sincronizado);

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

  const ChecklistCard = ({ checklist }: { checklist: Checklist }) => {
    const { date, time } = formatDateParts(checklist.dataCriacao); // ✅ agora existe
    return (
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex-1 cursor-pointer"
            onClick={() => navigate(`/checklist/${checklist.id}`)}
          >
            <h3 className="font-semibold">{checklist.motorista || 'Sem nome'}</h3>
            <p className="text-sm text-muted-foreground">Placa: {checklist.placa || '—'}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {date} às {time}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {checklist.sincronizado ? (
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

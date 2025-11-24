import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Checklists from "./pages/Checklists";
import CreateChecklist from "./pages/CreateChecklist2";
import EditChecklist from "./pages/EditChecklist";
import ChecklistDetail from "./pages/ChecklistDetail2";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { debugDatabaseSchema } from "./services/db";
import { useEffect } from "react";
import { LoadingProvider } from "./contexts/LoadingContext";
import AppLayout from './layouts/AppLayout';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const queryClient = new QueryClient();

const AppContent = () => {
  // Inicializa o hook de status online (que também gerencia sincronização automática)
  const { showSyncModal, confirmSync, cancelSync } = useOnlineStatus();

  // Debug do schema do banco na inicialização
  useEffect(() => {
    debugDatabaseSchema().then(result => {
      console.log('[App] Database schema debug result:', result);
    });

    // Registra handler para atualização do Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        console.log('[App] Service Worker ready:', registration);
      });

      // Força atualização do SW quando houver nova versão
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[App] Service Worker updated, reloading page...');
        window.location.reload();
      });
    }
  }, []);

  return (
    <>
      <BrowserRouter>
        <Routes>
            <Route element={<AppLayout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Home />} />
              <Route path="/checklists" element={<Checklists />} />
              <Route path="/criar-checklist" element={<CreateChecklist />} />
              <Route path="/editar-checklist/:id" element={<EditChecklist />} />
              <Route path="/checklist/:id" element={<ChecklistDetail />} />
              <Route path="/perfil" element={<Profile />} />
              <Route path="*" element={<NotFound />} />
            </Route>
        </Routes>
      </BrowserRouter>

      <AlertDialog open={showSyncModal} onOpenChange={cancelSync}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sincronizar dados</AlertDialogTitle>
            <AlertDialogDescription>
              Há checklists pendentes de sincronização. Clique em OK para sincronizar agora.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={confirmSync}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LoadingProvider>
        <Toaster />
        <Sonner />
        <AppContent />
      </LoadingProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

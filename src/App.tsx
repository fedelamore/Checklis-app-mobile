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

const queryClient = new QueryClient();

const AppContent = () => {
  // Inicializa o hook de status online (que também gerencia sincronização automática)
  useOnlineStatus();

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
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Home />} />
        <Route path="/checklists" element={<Checklists />} />
        <Route path="/criar-checklist" element={<CreateChecklist />} />
        <Route path="/editar-checklist/:id" element={<EditChecklist />} />
        <Route path="/checklist/:id" element={<ChecklistDetail />} />
        <Route path="/perfil" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppContent />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingContextType {
  isLoading: boolean;
  showLoading: () => void;
  hideLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

// Componente de overlay de loading
const LoadingOverlay = () => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="flex flex-col items-center gap-3 rounded-lg bg-background p-6 shadow-lg">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <span className="text-sm font-medium text-foreground">Carregando...</span>
    </div>
  </div>
);

export const LoadingProvider = ({ children }: { children: ReactNode }) => {
  const [loadingCount, setLoadingCount] = useState(0);

  const showLoading = () => {
    setLoadingCount(prev => prev + 1);
  };

  const hideLoading = () => {
    setLoadingCount(prev => Math.max(0, prev - 1));
  };

  const isLoading = loadingCount > 0;

  // Registra as funções globais quando o provider monta
  useEffect(() => {
    setGlobalLoadingFunctions(showLoading, hideLoading);
  }, []);

  return (
    <LoadingContext.Provider value={{ isLoading, showLoading, hideLoading }}>
      {children}
      {isLoading && <LoadingOverlay />}
    </LoadingContext.Provider>
  );
};

// Instância global para uso fora de componentes React (como no api-client)
let globalShowLoading: (() => void) | null = null;
let globalHideLoading: (() => void) | null = null;

export const setGlobalLoadingFunctions = (
  show: () => void,
  hide: () => void
) => {
  globalShowLoading = show;
  globalHideLoading = hide;
};

export const globalLoading = {
  show: () => globalShowLoading?.(),
  hide: () => globalHideLoading?.(),
};
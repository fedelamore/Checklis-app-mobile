import { Home, Plus, List } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

export const BottomNav = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
      <div className="flex items-center justify-around h-20 max-w-screen-lg mx-auto px-4">
        <Link
          to="/"
          className={cn(
            "flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors",
            location.pathname === '/' ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Home className="w-6 h-6" />
          <span className="text-xs font-medium">Início</span>
        </Link>

        <Link
          to="/criar-checklist"
          className="flex flex-col items-center gap-1 -mt-6"
        >
          <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:shadow-lg transition-shadow">
            <Plus className="w-8 h-8" />
          </div>
          <span className="text-xs font-medium text-muted-foreground mt-1">Criar checklist</span>
        </Link>

        <Link
          to="/checklists"
          className={cn(
            "flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors",
            location.pathname === '/checklists' ? "text-primary" : "text-muted-foreground"
          )}
        >
          <List className="w-6 h-6" />
          <span className="text-xs font-medium">Checklists</span>
        </Link>
      </div>
    </nav>
  );
};

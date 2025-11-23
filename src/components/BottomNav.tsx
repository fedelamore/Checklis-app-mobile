import { Home, Plus, List } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

export const BottomNav = () => {
  const location = useLocation();

  const isHome = location.pathname === '/';
  const isCreate = location.pathname.startsWith('/criar-checklist');
  const isList = location.pathname.startsWith('/checklists');

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30">
      <div className="relative mx-auto max-w-screen-lg">
        {/* Barra de fundo */}
        <div className="h-20 bg-card border-t border-border flex items-center justify-between px-10">
          {/* Início */}
          <Link
            to="/"
            className={cn(
              'flex flex-col items-center gap-1 text-xs font-medium',
              isHome ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <Home className="w-6 h-6" />
            <span>Início</span>
          </Link>

          {/* Checklists */}
          <Link
            to="/checklists"
            className={cn(
              'flex flex-col items-center gap-1 text-xs font-medium',
              isList ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <List className="w-6 h-6" />
            <span>Checklists</span>
          </Link>
        </div>

        {/* Botão central flutuante */}
        <Link
          to="/criar-checklist"
          className="absolute left-1/2 -translate-x-1/2 -top-6 flex flex-col items-center"
        >
          <div
            className={cn(
              'w-16 h-16 rounded-full bg-primary text-primary-foreground',
              'flex items-center justify-center shadow-md hover:shadow-lg transition-shadow'
            )}
          >
            <Plus className="w-8 h-8" />
          </div>
          <span
            className={cn(
              'mt-1 text-xs font-medium',
              isCreate ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            Criar
          </span>
        </Link>
      </div>
    </nav>
  );
};

import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, User as UserIcon, Building2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { storage } from '@/utils/storage';
import { toast } from 'sonner';

const Profile = () => {
  const navigate = useNavigate();
  const user = storage.getUser();

  const handleLogout = () => {
    storage.clearUser();
    toast.success('Logout realizado com sucesso');
    navigate('/login');
  };

  const firstLetter = (user?.name || '?').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* HEADER */}
      <header className="bg-primary text-primary-foreground px-4 pt-4 pb-6 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => {
            if (window.history.length > 2) {
              navigate(-1);
            } else {
              navigate('/');
            }
          }}
          className="p-2 rounded-full hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex flex-col">
          <span className="text-xs opacity-80">Conta</span>
          <h1 className="text-xl font-bold leading-tight">Perfil</h1>
        </div>
      </header>

      {/* CONTEÚDO */}
      <div className="flex-1 px-4 -mt-10 pb-6">
        {/* Avatar e card principal */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-full bg-background border-4 border-primary/60 shadow-md flex items-center justify-center">
            <span className="text-2xl font-semibold text-primary">
              {firstLetter}
            </span>
          </div>
          <p className="mt-3 text-base font-semibold">
            {user?.name || 'Usuário'}
          </p>
          <p className="text-xs text-muted-foreground">
            {user?.email || 'email@exemplo.com'}
          </p>
        </div>

        <Card className="p-4 space-y-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-1 rounded-full bg-primary/10 p-2">
              <Mail className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Email
              </p>
              <p className="text-sm font-semibold">
                {user?.email || 'email@exemplo.com'}
              </p>
            </div>
          </div>

          <div className="border-t border-border/60 pt-4 flex items-start gap-3">
            <div className="mt-1 rounded-full bg-primary/10 p-2">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Empresa
              </p>
              <p className="text-sm font-semibold">
                {/* quando tiver empresa, é só trocar aqui */}
                {user?.company || 'Não informado'}
              </p>
            </div>
          </div>
        </Card>

        {/* Botão de logout */}
        <div className="mt-6">
          <Button
            onClick={handleLogout}
            variant="destructive"
            className="w-full h-12 text-base font-semibold flex items-center justify-center gap-2 shadow-sm"
          >
            <LogOut className="w-5 h-5" />
            Sair do sistema
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Profile;

import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut } from 'lucide-react';
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

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground p-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/20 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Perfil</h1>
      </header>

      <div className="p-4 space-y-4">
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Nome</label>
              <p className="text-lg font-semibold mt-1">Usuário do Sistema</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">CPF</label>
              <p className="text-lg font-semibold mt-1">000.000.000-00</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <p className="text-lg font-semibold mt-1">{user?.email || 'email@exemplo.com'}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Empresa</label>
              <p className="text-lg font-semibold mt-1">Local GPS</p>
            </div>
          </div>
        </Card>

        <Button
          onClick={handleLogout}
          variant="destructive"
          className="w-full"
          size="lg"
        >
          <LogOut className="w-5 h-5 mr-2" />
          Sair do sistema
        </Button>
      </div>
    </div>
  );
};

export default Profile;

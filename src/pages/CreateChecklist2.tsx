import { Card } from "@/components/ui/card";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Preferences } from '@capacitor/preferences';

const CreateChecklist = () => {
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || '';

  useEffect(() => {
    loadForms();
  }, []);

  async function loadForms() {
    try {
      const { value } = await Preferences.get({ key: 'token' });
      const token = value;
      const currentUserStr = localStorage.getItem('current_user');
      if (!currentUserStr) {
        toast.error('Usuário não encontrado. Faça login novamente.');
        navigate('/login');
        return;
      }

      const currentUser = JSON.parse(currentUserStr);
      //const token = currentUser?.authorization?.token;

      const response = await fetch(`${API_URL}/gerar_checklist`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.message || 'Erro ao carregar formulários');
      }

      const result = await response.json();
      console.log("result: ", result);

      if (result.data && Array.isArray(result.data.formularios)) {
        setForms(result.data.formularios);
      } else {
        toast.error('Nenhum formulário disponível');
      }
    } catch (err) {
      console.error('Erro ao carregar formulários:', err);
      toast.error('Erro ao carregar formulários');
    }
  }
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedForm) {
      toast.error("Por favor, selecione um formulário");
      return;
    }

    if (!isOnline) {
      toast.error("Você está offline. Conecte-se à internet para gerar um checklist.");
      return;
    }

    setSubmitting(true);

    try {
      const { value } = await Preferences.get({ key: 'token' });
      const token = value;
      
      const currentUserStr = localStorage.getItem('current_user');
      if (!currentUserStr) {
        toast.error('Usuário não encontrado. Faça login novamente.');
        navigate('/login');
        return;
      }

      const currentUser = JSON.parse(currentUserStr);
      //const token = currentUser?.authorization?.token;

      const response = await fetch(`${API_URL}/gerar_checklist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          id_formulario: selectedForm,
          id_usuario: currentUser.id
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.message || 'Erro ao gerar checklist');
      }

      const result = await response.json();
      toast.success("Checklist gerado com sucesso!");
      navigate('/checklists');
    } catch (err) {
      console.error(err);
      toast.error("Ocorreu um erro ao gerar o checklist.");
    } finally {
      setSubmitting(false);
    }
  };
  return (
  <div className="min-h-screen bg-background pb-8">
    <header className="bg-primary text-primary-foreground p-4 flex items-center gap-3 sticky top-0 z-10">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="p-2 hover:bg-white/20 rounded-lg"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <h1 className="text-xl font-bold">Gerar Checklist</h1>
    </header>

    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <Label>Selecione o formulário</Label>
          <select
            value={selectedForm}
            onChange={(e) => setSelectedForm(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Selecione...</option>
            {forms.map((form: any) => (
              <option key={form.id} value={form.id}>
                {form.nome}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Button
        type="submit"
        className="w-full h-12 text-base font-semibold"
        disabled={submitting || !selectedForm}
      >
        {submitting ? "Gerando..." : "Gerar Checklist"}
      </Button>
    </form>
  </div>
  );
  
};

export default CreateChecklist;

  
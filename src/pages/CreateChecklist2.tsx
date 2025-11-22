import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiClient } from "@/services/api-client";

const CreateChecklist = () => {
  const navigate = useNavigate();
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadForms();
  }, []);

  async function loadForms() {
    try {
      const formularios = await apiClient.getFormularios();
      setForms(formularios);
    } catch (err: any) {
      console.error('Erro ao carregar formulários:', err);
      toast.error(err.message || 'Erro ao carregar formulários');
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedForm) {
      toast.error("Por favor, selecione um formulário");
      return;
    }

    setSubmitting(true);

    try {
      const currentUserStr = localStorage.getItem('current_user');
      if (!currentUserStr) {
        toast.error('Usuário não encontrado. Faça login novamente.');
        navigate('/login');
        return;
      }

      const currentUser = JSON.parse(currentUserStr);

      const result = await apiClient.gerarChecklist(
        Number(selectedForm),
        currentUser.id
      );

      if (result.offline) {
        toast.success("Checklist criado offline! Será sincronizado quando conectar.");
        // Redireciona para o checklist local
        navigate(`/checklist/${result.localChecklistId}`);
      } else {
        toast.success("Checklist gerado com sucesso!");
        navigate('/checklists');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Ocorreu um erro ao gerar o checklist.");
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

      <form onSubmit={handleSubmit} className="space-y-6 p-4">
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
// src/pages/ChecklistForm.tsx
import { useEffect, useState, ChangeEvent } from "react";
import { useParams } from "react-router-dom";

type CampoTipo =
  | "texto_simples"
  | "texto_longo"
  | "cpf"
  | "leitura_automatica"
  | "data"
  | "foto"
  | "assinatura"
  | "select_unico"
  | "select_multiplo";

interface Campo {
  id?: number;
  id_formulario?: number;
  label: string;
  tipo: CampoTipo;
  opcoes?: string | null; // vem como string JSON
}

interface ChecklistResponse {
  id: number;
  titulo: string;
  campos: Campo[];
}

type FormValues = Record<string, any>;

const API_URL = import.meta.env.VITE_API_URL; // ajuste se precisar

export function ChecklistForm() {
  const { id } = useParams<{ id: string }>();

  const [campos, setCampos] = useState<Campo[]>([]);
  const [formValues, setFormValues] = useState<FormValues>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---------- BUSCA OS CAMPOS NA API ----------
  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_URL}/checklist/${id}`);
        if (!res.ok) throw new Error("Erro ao buscar checklist");

        const data: ChecklistResponse = await res.json();
        console.log("data: ", data);

        setCampos(data.campos || []);

        // inicializa valores
        const init: FormValues = {};
        (data.campos || []).forEach((campo, index) => {
          const key = getCampoKey(campo, index);
          init[key] = campo.tipo === "select_multiplo" ? [] : "";
        });
        setFormValues(init);
      } catch (err: any) {
        setError(err.message || "Erro inesperado");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // chave única para cada campo
  function getCampoKey(campo: Campo, index: number) {
    return campo.id ? String(campo.id) : `campo_${index}`;
  }

  // ---------- HANDLERS DE MUDANÇA ----------
  function handleChange(
    campo: Campo,
    index: number,
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const key = getCampoKey(campo, index);

    // select múltiplo (checkbox)
    if (campo.tipo === "select_multiplo") {
      const checked = (e.target as HTMLInputElement).checked;
      const option = e.target.value;

      setFormValues((prev) => {
        const atual = Array.isArray(prev[key]) ? prev[key] : [];
        if (checked) return { ...prev, [key]: [...atual, option] };
        return { ...prev, [key]: atual.filter((v: string) => v !== option) };
      });
      return;
    }

    // CPF com máscara simples
    if (campo.tipo === "cpf") {
      const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
      let masked = raw;
      if (raw.length > 3) masked = raw.slice(0, 3) + "." + raw.slice(3);
      if (raw.length > 6) masked = masked.slice(0, 7) + "." + raw.slice(6);
      if (raw.length > 9) masked = masked.slice(0, 11) + "-" + raw.slice(9);

      setFormValues((prev) => ({ ...prev, [key]: masked }));
      return;
    }

    setFormValues((prev) => ({ ...prev, [key]: e.target.value }));
  }

  function handleFileChange(
    campo: Campo,
    index: number,
    e: ChangeEvent<HTMLInputElement>
  ) {
    const key = getCampoKey(campo, index);
    const file = e.target.files?.[0] || null;
    setFormValues((prev) => ({ ...prev, [key]: file }));
  }

  // options dos selects (vem em string JSON)
  function parseOpcoes(campo: Campo): string[] {
    if (!campo.opcoes) return [];
    try {
      const arr = JSON.parse(campo.opcoes);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  // ---------- SUBMIT ----------
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log("Valores do formulário:", formValues);

    // aqui você monta o payload e faz POST/PUT para a API de respostas
    // ex:
    // await fetch(`${API_URL}/checklist/${id}/respostas`, { method: 'POST', body: JSON.stringify(formValues) })
  }

  // ---------- RENDERIZAÇÃO DINÂMICA ----------
  function renderCampo(campo: Campo, index: number) {
    const key = getCampoKey(campo, index);
    const valor = formValues[key];

    switch (campo.tipo) {
      case "texto_simples":
        return (
          <div key={key} className="campo">
            <label>{campo.label}</label>
            <input
              type="text"
              value={valor || ""}
              onChange={(e) => handleChange(campo, index, e)}
            />
          </div>
        );

      case "texto_longo":
        return (
          <div key={key} className="campo">
            <label>{campo.label}</label>
            <textarea
              rows={4}
              value={valor || ""}
              onChange={(e) => handleChange(campo, index, e)}
            />
          </div>
        );

      case "cpf":
        return (
          <div key={key} className="campo">
            <label>{campo.label}</label>
            <input
              type="text"
              maxLength={14}
              inputMode="numeric"
              value={valor || ""}
              onChange={(e) => handleChange(campo, index, e)}
            />
          </div>
        );

      case "data":
        return (
          <div key={key} className="campo">
            <label>{campo.label}</label>
            <input
              type="date"
              value={valor || ""}
              onChange={(e) => handleChange(campo, index, e)}
            />
          </div>
        );

      case "leitura_automatica":
        return (
          <div key={key} className="campo">
            <label>{campo.label}</label>
            {/* só câmera, sem galeria */}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFileChange(campo, index, e)}
            />
            {/* campo de texto simples para o resultado do OCR */}
            <input
              type="text"
              placeholder="Texto lido da imagem"
              value={valor?.ocrTexto || ""}
              onChange={(e) =>
                setFormValues((prev) => ({
                  ...prev,
                  [key]: { ...(prev[key] || {}), ocrTexto: e.target.value },
                }))
              }
            />
          </div>
        );

      case "foto":
        return (
          <div key={key} className="campo">
            <label>{campo.label}</label>
            {/* só câmera, sem galeria */}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFileChange(campo, index, e)}
            />
          </div>
        );

      case "assinatura":
        return (
          <div key={key} className="campo">
            <label>{campo.label}</label>
            {/* Aqui você pode trocar depois por um componente de assinatura em canvas */}
            <textarea
              rows={3}
              placeholder="Assinatura (placeholder)"
              value={valor || ""}
              onChange={(e) => handleChange(campo, index, e)}
            />
          </div>
        );

      case "select_unico": {
        const opcoes = parseOpcoes(campo);
        return (
          <div key={key} className="campo">
            <label>{campo.label}</label>
            <select
              value={valor || ""}
              onChange={(e) => handleChange(campo, index, e)}
            >
              <option value="">Selecione...</option>
              {opcoes.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>
        );
      }

      case "select_multiplo": {
        const opcoes = parseOpcoes(campo);
        const selecionados: string[] = valor || [];
        return (
          <div key={key} className="campo">
            <label>{campo.label}</label>
            {opcoes.map((op) => (
              <label key={op} style={{ display: "block" }}>
                <input
                  type="checkbox"
                  value={op}
                  checked={selecionados.includes(op)}
                  onChange={(e) => handleChange(campo, index, e)}
                />
                {op}
              </label>
            ))}
          </div>
        );
      }

      default:
        return (
          <div key={key} className="campo">
            <p>Tipo de campo não suportado: {campo.tipo}</p>
          </div>
        );
    }
  }

  if (loading) return <p>Carregando checklist...</p>;
  if (error) return <p>Erro: {error}</p>;

  return (
    <div style={{ padding: 16 }}>
      <h2>Preencher checklist #{id}</h2>

      <form onSubmit={handleSubmit}>
        {campos.map((campo, index) => renderCampo(campo, index))}

        <button type="submit" style={{ marginTop: 16 }}>
          Salvar respostas
        </button>
      </form>
    </div>
  );
}

export default ChecklistForm;


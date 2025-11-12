export interface Formulario {
  id: number;
  id_empresa: number;
  nome: string;
  descricao: string;
  ativo: number;
  created_at: string;
  updated_at: string;
  recorrencia: string;
  frequencia: string;
}

export interface Checklist {
  id: number;
  id_formulario: number;
  id_usuario: number;
  data_finalizacao: string | null;
  status: 'em_andamento' | 'concluido' | 'cancelado';
  ativo: number;
  created_at: string;
  updated_at: string;
  usuario_cadastro: number;
  formulario: Formulario;

  // Campos antigos (manter para compatibilidade)
  motorista?: string;
  cpf?: string;
  empresa?: string;
  placa?: string;
  odometro?: string;
  odometroFoto?: string;
  limpeza?: 'limpo' | 'regular' | 'sujo';
  fotoFrente?: string;
  fotoTraseira?: string;
  fotoLateralDireita?: string;
  fotoLateralEsquerda?: string;
  assinatura?: string;
  dataCriacao?: string;
  sincronizado?: boolean;
  pendente?: boolean;
}

export interface ChecklistApiResponse {
  success: boolean;
  message: string;
  data: {
    current_page: number;
    data: Checklist[];
  };
}

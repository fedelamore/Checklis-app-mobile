export interface Checklist {
  id: string;
  motorista: string;
  cpf: string;
  empresa: string;
  placa: string;
  odometro: string;
  odometroFoto?: string;
  limpeza: 'limpo' | 'regular' | 'sujo';
  fotoFrente?: string;
  fotoTraseira?: string;
  fotoLateralDireita?: string;
  fotoLateralEsquerda?: string;
  assinatura?: string;
  dataCriacao: string;
  sincronizado: boolean;
  pendente: boolean;
}

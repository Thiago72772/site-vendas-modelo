export type PapelEquipe = 'dono' | 'atendente' | 'cozinha' | 'entregador';

export type TipoDesconto = 'percentual' | 'fixo';

export type StatusPedido =
  | 'recebido'
  | 'preparo'
  | 'saiu_entrega'
  | 'entregue'
  | 'cancelado';

export type FormaPagamento = 'pix' | 'cartao' | 'dinheiro';

export interface HorarioDia {
  abre: string | null;
  fecha: string | null;
}

export interface Endereco {
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  cep: string;
  complemento?: string;
  referencia?: string;
}

export interface Tenant {
  id: string;
  nome: string;
  slug: string;
  logo_url: string | null;
  cor_primaria: string | null;
  cor_secundaria: string | null;
  banner_url: string | null;
  telefone_whatsapp: string | null;
  horario_funcionamento: Record<string, HorarioDia> | null;
  taxa_entrega_base: number;
  raio_entrega_km: number | null;
  tempo_medio_preparo_min: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Perfil {
  id: string;
  tenant_id: string;
  nome: string;
  papel: PapelEquipe;
  telefone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Categoria {
  id: string;
  tenant_id: string;
  nome: string;
  ordem: number;
  created_at: string;
}

export interface Produto {
  id: string;
  tenant_id: string;
  categoria_id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  imagem_url: string | null;
  disponivel: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export interface GrupoAdicional {
  id: string;
  tenant_id: string;
  produto_id: string;
  nome: string;
  obrigatorio: boolean;
  max_selecao: number;
  created_at: string;
}

export interface Adicional {
  id: string;
  grupo_adicional_id: string;
  nome: string;
  preco_extra: number;
  created_at: string;
}

export interface Cliente {
  id: string;
  tenant_id: string;
  auth_user_id: string | null;
  nome: string;
  telefone: string | null;
  endereco: Endereco | null;
  created_at: string;
  updated_at: string;
}

export interface Cupom {
  id: string;
  tenant_id: string;
  codigo: string;
  tipo_desconto: TipoDesconto;
  valor: number;
  validade_inicio: string | null;
  validade_fim: string | null;
  uso_maximo: number | null;
  uso_atual: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Entregador {
  id: string;
  tenant_id: string;
  nome: string;
  telefone: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Pedido {
  id: string;
  tenant_id: string;
  cliente_id: string;
  entregador_id: string | null;
  status: StatusPedido;
  forma_pagamento: FormaPagamento;
  subtotal: number;
  taxa_entrega: number;
  desconto: number;
  total: number;
  endereco_entrega: Endereco | null;
  cupom_id: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemPedido {
  id: string;
  pedido_id: string;
  produto_id: string;
  quantidade: number;
  preco_unitario_no_momento: number;
  adicionais_selecionados: Array<{
    id: string;
    nome: string;
    preco_extra: number;
  }>;
  created_at: string;
}

export interface NotificacaoPendente {
  id: string;
  tenant_id: string;
  pedido_id: string;
  telefone_destino: string;
  mensagem: string;
  enviada: boolean;
  created_at: string;
}

export const STATUS_PEDIDO_LABELS: Record<StatusPedido, string> = {
  recebido: 'Recebido',
  preparo: 'Em preparo',
  saiu_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export const FORMA_PAGAMENTO_LABELS: Record<FormaPagamento, string> = {
  pix: 'PIX',
  cartao: 'Cartão',
  dinheiro: 'Dinheiro',
};

export const PAPEL_LABELS: Record<PapelEquipe, string> = {
  dono: 'Dono',
  atendente: 'Atendente',
  cozinha: 'Cozinha',
  entregador: 'Entregador',
};

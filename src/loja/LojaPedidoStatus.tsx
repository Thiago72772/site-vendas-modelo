import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTenant } from '@/hooks/useTenant';
import { LoadingScreen, ErrorState } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Pedido, FormaPagamento } from '@/lib/types';
import { FORMA_PAGAMENTO_LABELS } from '@/lib/types';
import { BottomNav } from '@/components/BottomNav';
import {
  ChevronLeft,
  CheckCircle2,
  ChefHat,
  Bike,
  Home,
  XCircle,
  Clock,
  Receipt,
  MapPin,
  Radio,
} from 'lucide-react';

interface ItemPedidoWithProduto {
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
  produtos: { nome: string } | null;
  created_at: string;
}

const STATUS_FLOW: {
  key: Pedido['status'];
  label: string;
  icon: typeof CheckCircle2;
}[] = [
  { key: 'recebido', label: 'Pedido recebido', icon: CheckCircle2 },
  { key: 'preparo', label: 'Em preparo', icon: ChefHat },
  { key: 'saiu_entrega', label: 'Saiu para entrega', icon: Bike },
  { key: 'entregue', label: 'Entregue', icon: Home },
];

function LojaPedidoStatusContent() {
  const { slug, pedidoId } = useParams<{
    slug: string;
    pedidoId: string;
  }>();

  const { tenant, loading, error } = useTenant(slug);

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [itens, setItens] = useState<ItemPedidoWithProduto[]>([]);
  const [pedidoLoading, setPedidoLoading] = useState(true);
  const [pedidoError, setPedidoError] = useState<string | null>(null);

  useEffect(() => {
    const tenantId = tenant?.id;

    if (!pedidoId || !tenantId) {
      setPedidoLoading(true);
      return;
    }

    let active = true;

    async function carregarPedido() {
      setPedidoLoading(true);
      setPedidoError(null);

      try {
        const {
          data: pedidoData,
          error: pedidoErr,
        } = await supabase
          .from('pedidos')
          .select('*')
          .eq('id', pedidoId)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (!active) return;

        if (pedidoErr) {
          console.error('Erro ao buscar pedido:', pedidoErr);
          setPedidoError(
            `Erro ao carregar pedido: ${pedidoErr.message}`
          );
          setPedidoLoading(false);
          return;
        }

        if (!pedidoData) {
          setPedidoError('Pedido não encontrado.');
          setPedidoLoading(false);
          return;
        }

        setPedido(pedidoData as Pedido);

        const {
          data: itensData,
          error: itensError,
        } = await supabase
          .from('itens_pedido')
          .select('*, produtos(nome)')
          .eq('pedido_id', pedidoId);

        if (!active) return;

        if (itensError) {
          console.error(
            'Erro ao buscar itens do pedido:',
            itensError
          );
          setItens([]);
        } else {
          setItens(
            (itensData as ItemPedidoWithProduto[]) ?? []
          );
        }

        setPedidoError(null);
        setPedidoLoading(false);
      } catch (err) {
        if (!active) return;

        console.error(
          'Erro inesperado ao carregar pedido:',
          err
        );

        setPedidoError(
          err instanceof Error
            ? err.message
            : 'Erro inesperado ao carregar o pedido.'
        );

        setPedidoLoading(false);
      }
    }

    carregarPedido();

    const channel = supabase
      .channel(`pedido-${pedidoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pedidos',
          filter: `id=eq.${pedidoId}`,
        },
        (payload) => {
          if (!active) return;

          setPedido(payload.new as Pedido);
          setPedidoError(null);
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error(
            'Erro na inscrição Realtime do pedido:',
            pedidoId
          );
        }
      });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [pedidoId, tenant?.id]);

  if (loading || pedidoLoading) {
    return <LoadingScreen message="Carregando pedido..." />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (pedidoError) {
    return <ErrorState message={pedidoError} />;
  }

  if (!tenant || !pedido) {
    return <ErrorState message="Pedido não encontrado." />;
  }

  const isCancelled = pedido.status === 'cancelado';

  const currentStatusIndex = STATUS_FLOW.findIndex(
    (status) => status.key === pedido.status
  );

  const progressPercent =
    currentStatusIndex >= 0
      ? (currentStatusIndex /
          (STATUS_FLOW.length - 1)) *
        100
      : 0;

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-strong">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4 sm:px-6">
          <Link
            to={`/loja/${slug}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-surface"
            aria-label="Voltar para a loja"
          >
            <ChevronLeft className="h-5 w-5 text-mid" />
          </Link>

          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-dim">
              {tenant.nome}
            </p>

            <h1 className="text-base font-semibold tracking-tight text-strong">
              Acompanhar pedido
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        {/* Main status */}
        <section
          className={`overflow-hidden rounded-lg border ${
            isCancelled
              ? 'border-rose-100 bg-rose-50'
              : 'border-line bg-white'
          }`}
        >
          <div className="p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {isCancelled ? (
                    <XCircle className="h-5 w-5 text-rose-500" />
                  ) : (
                    <span className="relative flex h-5 w-5 items-center justify-center">
                      <span className="absolute h-5 w-5 animate-ping rounded-full bg-primary-500/15" />
                      <span className="relative h-2.5 w-2.5 rounded-full bg-primary-500" />
                    </span>
                  )}

                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-dim">
                    {isCancelled
                      ? 'Pedido encerrado'
                      : 'Pedido em tempo real'}
                  </span>
                </div>

                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
                  {isCancelled
                    ? 'Pedido cancelado'
                    : pedido.status === 'entregue'
                    ? 'Pedido entregue!'
                    : 'Seu pedido está em andamento'}
                </h2>

                <p className="mt-2 text-sm text-mid">
                  Pedido feito em {formatDate(pedido.created_at)}
                </p>
              </div>

              <div className="hidden shrink-0 rounded-lg bg-neutral-50 px-4 py-3 text-right sm:block">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-dim">
                  Total
                </p>
                <p className="mt-1 text-lg font-semibold text-strong">
                  {formatCurrency(
                    Number(pedido.total || 0)
                  )}
                </p>
              </div>
            </div>

            {!isCancelled && (
              <div className="mt-7 rounded-lg bg-neutral-50 p-4">
                <div className="flex items-center gap-3">
                  <Radio className="h-4 w-4 shrink-0 text-primary-500" />
                  <p className="text-sm text-mid">
                    O status deste pedido é atualizado automaticamente.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Mobile total */}
        <div className="flex items-center justify-between rounded-lg border border-line bg-white px-4 py-3 sm:hidden">
          <span className="text-sm text-mid">
            Total do pedido
          </span>

          <span className="text-lg font-semibold text-strong">
            {formatCurrency(
              Number(pedido.total || 0)
            )}
          </span>
        </div>

        {/* Progress */}
        {!isCancelled ? (
          <section className="rounded-lg border border-line bg-white p-5 sm:p-7">
            <div className="mb-7">
              <h2 className="text-base font-semibold text-strong">
                Status do pedido
              </h2>

              <p className="mt-1 text-sm text-mid">
                Acompanhe cada etapa sem precisar atualizar a página.
              </p>
            </div>

            <div className="relative">
              {/* Progress line */}
              <div className="absolute left-5 right-5 top-5 h-0.5 bg-neutral-200">
                <div
                  className="h-full bg-primary-500 transition-all duration-500"
                  style={{
                    width: `${progressPercent}%`,
                  }}
                />
              </div>

              <div className="relative grid grid-cols-4 gap-2">
                {STATUS_FLOW.map((step, index) => {
                  const Icon = step.icon;

                  const isCompleted =
                    index <= currentStatusIndex;

                  const isCurrent =
                    index === currentStatusIndex;

                  return (
                    <div
                      key={step.key}
                      className="flex flex-col items-center text-center"
                    >
                      <div
                        className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-4 border-white transition-all duration-300 ${
                          isCompleted
                            ? 'bg-primary-500 text-white'
                            : 'bg-surface text-dim'
                        } ${
                          isCurrent
                            ? 'ring-4 ring-primary-100'
                            : ''
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      <p
                        className={`mt-3 max-w-[90px] text-[11px] font-medium leading-4 sm:text-xs ${
                          isCompleted
                            ? 'text-strong'
                            : 'text-dim'
                        }`}
                      >
                        {step.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-lg border border-rose-100 bg-white p-6 text-center sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-rose-50">
              <XCircle className="h-7 w-7 text-rose-500" />
            </div>

            <h2 className="mt-4 text-lg font-semibold text-strong">
              Este pedido foi cancelado
            </h2>

            {pedido.observacoes && (
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-mid">
                {pedido.observacoes}
              </p>
            )}

            <p className="mt-2 text-sm text-dim">
              Entre em contato com a loja para mais informações.
            </p>
          </section>
        )}

        {/* Items */}
        <section className="rounded-lg border border-line bg-white p-5 sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-mid" />
                <h2 className="text-base font-semibold text-strong">
                  Seu pedido
                </h2>
              </div>

              <p className="mt-1 text-sm text-mid">
                {itens.length}{' '}
                {itens.length === 1
                  ? 'item'
                  : 'itens'}
              </p>
            </div>
          </div>

          <div className="mt-5 divide-y divide-neutral-100">
            {itens.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-dim">
                  Nenhum item encontrado neste pedido.
                </p>
              </div>
            ) : (
              itens.map((item) => {
                const adicionais =
                  item.adicionais_selecionados ?? [];

                const adicionaisTotal =
                  adicionais.reduce(
                    (sum, adicional) =>
                      sum +
                      Number(
                        adicional.preco_extra || 0
                      ),
                    0
                  );

                const itemTotal =
                  (
                    Number(
                      item.preco_unitario_no_momento || 0
                    ) + adicionaisTotal
                  ) *
                  Number(item.quantidade || 0);

                return (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-strong">
                        {item.quantidade}x{' '}
                        {item.produtos?.nome ?? 'Produto'}
                      </p>

                      {adicionais.length > 0 && (
                        <p className="mt-1 text-xs leading-5 text-mid">
                          {adicionais
                            .map(
                              (adicional) =>
                                adicional.nome
                            )
                            .join(', ')}
                        </p>
                      )}
                    </div>

                    <p className="shrink-0 text-sm font-semibold text-strong">
                      {formatCurrency(itemTotal)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Payment */}
        <section className="rounded-lg border border-line bg-white p-5 sm:p-7">
          <h2 className="text-base font-semibold text-strong">
            Resumo financeiro
          </h2>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-mid">
                Pagamento
              </span>

              <span className="font-medium text-strong">
                {
                  FORMA_PAGAMENTO_LABELS[
                    pedido.forma_pagamento as FormaPagamento
                  ]
                }
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-mid">
                Subtotal
              </span>

              <span className="font-medium text-strong">
                {formatCurrency(
                  Number(pedido.subtotal || 0)
                )}
              </span>
            </div>

            {Number(pedido.desconto || 0) > 0 && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-emerald-600">
                  Desconto
                </span>

                <span className="font-medium text-emerald-600">
                  -{' '}
                  {formatCurrency(
                    Number(
                      pedido.desconto || 0
                    )
                  )}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <span className="text-mid">
                Entrega
              </span>

              <span className="font-medium text-strong">
                {formatCurrency(
                  Number(
                    pedido.taxa_entrega || 0
                  )
                )}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-line pt-4 text-base">
              <span className="font-semibold text-strong">
                Total
              </span>

              <span className="font-semibold text-strong">
                {formatCurrency(
                  Number(pedido.total || 0)
                )}
              </span>
            </div>
          </div>
        </section>

        {/* Address */}
        {pedido.endereco_entrega && (
          <section className="rounded-lg border border-line bg-white p-5 sm:p-7">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface">
                <MapPin className="h-5 w-5 text-mid" />
              </div>

              <div className="min-w-0">
                <h2 className="text-base font-semibold text-strong">
                  Entrega
                </h2>

                <p className="mt-2 text-sm leading-6 text-mid">
                  {pedido.endereco_entrega.rua},{' '}
                  {pedido.endereco_entrega.numero}
                  {pedido.endereco_entrega
                    .complemento &&
                    `, ${pedido.endereco_entrega.complemento}`}
                </p>

                <p className="text-sm leading-6 text-mid">
                  {pedido.endereco_entrega.bairro} -{' '}
                  {pedido.endereco_entrega.cidade}
                </p>

                <p className="text-sm text-mid">
                  CEP: {pedido.endereco_entrega.cep}
                </p>

                {pedido.endereco_entrega
                  .referencia && (
                  <p className="mt-1 text-sm text-mid">
                    Referência:{' '}
                    {
                      pedido.endereco_entrega
                        .referencia
                    }
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Back to store */}
        <Link
          to={`/loja/${slug}`}
          className="flex w-full items-center justify-center rounded-lg bg-neutral-900 px-5 py-4 text-sm font-semibold text-white transition hover:bg-neutral-800"
        >
          Voltar ao cardápio
        </Link>
      </main>

      {/* Bottom nav — mobile only */}
      <BottomNav slug={slug ?? ''} onCartClick={() => {}} />
      <div className="h-16 md:hidden" />
    </div>
  );
}

export default function LojaPedidoStatus() {
  return <LojaPedidoStatusContent />;
}
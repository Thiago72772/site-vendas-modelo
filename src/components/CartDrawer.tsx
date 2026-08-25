import { useNavigate } from 'react-router-dom';
import {
  X,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  ArrowRight,
} from 'lucide-react';
import {
  useCart,
  calculateItemPrice,
} from '@/hooks/useCart';
import { formatCurrency } from '@/lib/format';
import type { Tenant } from '@/lib/types';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  tenant: Tenant;
  slug: string;
}

export function CartDrawer({
  open,
  onClose,
  tenant,
  slug,
}: CartDrawerProps) {
  const {
    items,
    removeItem,
    updateQuantity,
    subtotal,
    totalItems,
  } = useCart();

  const navigate = useNavigate();

  function handleCheckout() {
    if (items.length === 0) return;

    onClose();
    navigate(`/loja/${slug}/checkout`);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-neutral-950/50 backdrop-blur-[3px] transition-opacity duration-300 ${
          open
            ? 'opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        aria-label="Carrinho de compras"
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-50 flex h-[100dvh] w-full max-w-lg flex-col bg-[#fafaf8] shadow-2xl transition-transform duration-300 ease-out ${
          open
            ? 'translate-x-0'
            : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <header className="shrink-0 border-b border-neutral-200 bg-white px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-neutral-900" />

                <h2 className="text-lg font-semibold tracking-tight text-neutral-950">
                  Seu pedido
                </h2>
              </div>

              <div className="mt-1 flex items-center gap-2">
                <p className="truncate text-xs text-neutral-500">
                  {tenant.nome}
                </p>

                {totalItems > 0 && (
                  <>
                    <span className="text-neutral-300">
                      •
                    </span>

                    <p className="text-xs text-neutral-500">
                      {totalItems}{' '}
                      {totalItems === 1
                        ? 'item'
                        : 'itens'}
                    </p>
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-950"
              aria-label="Fechar carrinho"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Items */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex min-h-full flex-col items-center justify-center px-8 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100">
                <ShoppingBag className="h-7 w-7 text-neutral-400" />
              </div>

              <h3 className="mt-5 text-lg font-semibold tracking-tight text-neutral-900">
                Seu pedido está vazio
              </h3>

              <p className="mt-2 max-w-xs text-sm leading-6 text-neutral-500">
                Adicione produtos do cardápio para começar seu pedido.
              </p>

              <button
                type="button"
                onClick={onClose}
                className="mt-6 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Ver cardápio
              </button>
            </div>
          ) : (
            <div className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
              {items.map((item) => {
                const itemTotal =
                  calculateItemPrice(
                    item.preco_unitario,
                    item.adicionais,
                    item.quantidade
                  );

                return (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-neutral-200 bg-white p-4"
                  >
                    <div className="flex gap-3.5">
                      {/* Image */}
                      {item.imagem_url ? (
                        <img
                          src={item.imagem_url}
                          alt={item.nome}
                          className="h-20 w-20 shrink-0 rounded-xl object-cover sm:h-24 sm:w-24"
                        />
                      ) : (
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-neutral-100 sm:h-24 sm:w-24">
                          <ShoppingBag className="h-5 w-5 text-neutral-300" />
                        </div>
                      )}

                      {/* Product info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-sm font-semibold text-neutral-950 sm:text-base">
                              {item.nome}
                            </h3>

                            {item.adicionais.length > 0 && (
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500">
                                {item.adicionais
                                  .map(
                                    (adicional) =>
                                      adicional.nome
                                  )
                                  .join(', ')}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeItem(item.id)
                            }
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 transition hover:bg-rose-50 hover:text-rose-600"
                            aria-label={`Remover ${item.nome}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-4 flex items-end justify-between gap-3">
                          {/* Quantity */}
                          <div className="inline-flex items-center rounded-xl border border-neutral-200 bg-neutral-50 p-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(
                                  item.id,
                                  -1
                                )
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-white hover:text-neutral-950"
                              aria-label="Diminuir quantidade"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>

                            <span className="w-8 text-center text-sm font-semibold text-neutral-900">
                              {item.quantidade}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(
                                  item.id,
                                  1
                                )
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-white hover:text-neutral-950"
                              aria-label="Aumentar quantidade"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Item total */}
                          <p className="text-sm font-semibold text-neutral-950 sm:text-base">
                            {formatCurrency(itemTotal)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <footer className="shrink-0 border-t border-neutral-200 bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-5">
            <div className="space-y-4">
              <div className="rounded-2xl bg-neutral-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-neutral-500">
                      Subtotal
                    </p>

                    <p className="mt-1 text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl">
                      {formatCurrency(subtotal)}
                    </p>
                  </div>

                  <p className="max-w-[170px] text-right text-xs leading-5 text-neutral-400">
                    A taxa de entrega será calculada no checkout.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCheckout}
                className="flex w-full items-center justify-between gap-4 rounded-2xl bg-neutral-900 px-5 py-4 text-white transition hover:bg-neutral-800 active:scale-[0.99]"
              >
                <span className="text-sm font-semibold sm:text-base">
                  Continuar para finalizar
                </span>

                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold sm:text-base">
                    {formatCurrency(subtotal)}
                  </span>

                  <ArrowRight className="h-4 w-4" />
                </span>
              </button>
            </div>
          </footer>
        )}
      </aside>
    </>
  );
}
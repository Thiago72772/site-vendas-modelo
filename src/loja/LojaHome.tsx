import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTenant } from '@/hooks/useTenant';
import { CartProvider, useCart } from '@/hooks/useCart';
import { CartDrawer } from '@/components/CartDrawer';
import { ProductModal } from '@/components/ProductModal';
import { LoadingScreen, ErrorState } from '@/components/ui';
import { isTenantOpen, formatCurrency } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Produto, Categoria } from '@/lib/types';
import {
  Store,
  ShoppingBag,
  Clock,
  Search,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

function LojaHomeContent() {
  const { slug } = useParams<{ slug: string }>();
  const { tenant, loading, error } = useTenant(slug);
  const { totalItems } = useCart();

  const [cartOpen, setCartOpen] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null);
  const [produtoSelecionado, setProdutoSelecionado] =
    useState<Produto | null>(null);
  const [busca, setBusca] = useState('');
  const [pedidoAtivoId, setPedidoAtivoId] = useState<string | null>(null);

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const tenantId = tenant?.id;

    if (!tenantId) return;

    let active = true;

    async function carregarCardapio() {
      const [{ data: cats }, { data: prods }] = await Promise.all([
        supabase
          .from('categorias')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('ordem'),

        supabase
          .from('produtos')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('ordem'),
      ]);

      if (!active) return;

      const categoriasData = (cats as Categoria[]) ?? [];
      const produtosData = (prods as Produto[]) ?? [];

      setCategorias(categoriasData);
      setProdutos(produtosData);

      if (categoriasData.length > 0) {
        setCategoriaAtiva(categoriasData[0].id);
      }
    }

    carregarCardapio();

    return () => {
      active = false;
    };
  }, [tenant]);

  // Recupera o último pedido ainda ativo.
  useEffect(() => {
    const tenantId = tenant?.id;

    if (!slug || !tenantId) {
      setPedidoAtivoId(null);
      return;
    }

    let active = true;

    async function carregarPedidoAtivo() {
      try {
        const storageKey = `ultimo_pedido_${slug}`;
        const stored = localStorage.getItem(storageKey);

        if (!stored) {
          if (active) {
            setPedidoAtivoId(null);
          }
          return;
        }

        const parsed = JSON.parse(stored) as {
          pedidoId?: string;
          createdAt?: string;
        };

        if (!parsed.pedidoId) {
          localStorage.removeItem(storageKey);

          if (active) {
            setPedidoAtivoId(null);
          }

          return;
        }

        const { data, error: pedidoError } = await supabase
          .from('pedidos')
          .select('id, status')
          .eq('id', parsed.pedidoId)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (!active) return;

        if (
          pedidoError ||
          !data ||
          data.status === 'entregue' ||
          data.status === 'cancelado'
        ) {
          localStorage.removeItem(storageKey);
          setPedidoAtivoId(null);
          return;
        }

        setPedidoAtivoId(data.id);
      } catch {
        if (active) {
          setPedidoAtivoId(null);
        }
      }
    }

    carregarPedidoAtivo();

    return () => {
      active = false;
    };
  }, [slug, tenant?.id]);

  function scrollToCategoria(categoriaId: string) {
    setCategoriaAtiva(categoriaId);

    const el = sectionRefs.current[categoriaId];

    if (!el) return;

    const headerOffset = 125;
    const top =
      el.getBoundingClientRect().top +
      window.scrollY -
      headerOffset;

    window.scrollTo({
      top,
      behavior: 'smooth',
    });
  }

  if (loading) {
    return <LoadingScreen message="Carregando loja..." />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!tenant) {
    return <ErrorState message="Loja não encontrada." />;
  }

  const aberto = isTenantOpen(tenant.horario_funcionamento);
  const termo = busca.trim().toLowerCase();

  const produtosPorCategoria = categorias
    .map((categoria) => ({
      categoria,
      produtos: produtos.filter((produto) => {
        const pertence =
          produto.categoria_id === categoria.id;

        if (!pertence) return false;

        if (!termo) return true;

        return `${produto.nome} ${produto.descricao ?? ''}`
          .toLowerCase()
          .includes(termo);
      }),
    }))
    .filter(({ produtos: produtosCategoria }) =>
      termo ? produtosCategoria.length > 0 : true
    );

  const totalProdutosVisiveis = produtosPorCategoria.reduce(
    (total, item) => total + item.produtos.length,
    0
  );

  return (
    <div className="min-h-screen bg-[#f6f6f4] text-neutral-950">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          {/* Brand */}
          <Link
            to="/"
            className="flex min-w-0 flex-1 items-center gap-3"
            aria-label="Voltar"
          >
            {tenant.logo_url ? (
              <img
                src={tenant.logo_url}
                alt={tenant.nome}
                className="h-10 w-10 shrink-0 rounded-2xl object-cover ring-1 ring-black/5"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-neutral-950 text-white">
                <Store className="h-5 w-5" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-semibold tracking-tight text-neutral-950 sm:text-base">
                  {tenant.nome}
                </h1>

                <span
                  className={`hidden rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:inline-flex ${
                    aberto
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {aberto ? 'Aberto' : 'Fechado'}
                </span>
              </div>

              <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      aberto
                        ? 'bg-emerald-500'
                        : 'bg-rose-500'
                    }`}
                  />
                  {aberto
                    ? 'Pedidos online'
                    : 'No momento fechado'}
                </span>

                {tenant.tempo_medio_preparo_min && (
                  <>
                    <span className="text-neutral-300">•</span>

                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      ~{tenant.tempo_medio_preparo_min} min
                    </span>
                  </>
                )}
              </div>
            </div>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {pedidoAtivoId && (
              <Link
                to={`/loja/${slug}/pedido/${pedidoAtivoId}`}
                className="hidden h-11 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-800 transition hover:border-neutral-300 hover:bg-neutral-50 sm:inline-flex"
              >
                <span>Acompanhar pedido</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative flex h-11 items-center gap-2 rounded-full bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 active:scale-[0.99]"
            >
              <ShoppingBag className="h-4 w-4" />

              <span className="hidden sm:inline">
                Carrinho
              </span>

              {totalItems > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-bold text-neutral-950">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile active order */}
        {pedidoAtivoId && (
          <div className="border-t border-neutral-100 bg-white sm:hidden">
            <div className="mx-auto max-w-7xl px-4 py-2.5">
              <Link
                to={`/loja/${slug}/pedido/${pedidoAtivoId}`}
                className="flex min-h-11 items-center justify-between rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white"
              >
                <span>Acompanhar pedido</span>
                <ArrowRight className="h-4 w-4 text-white/70" />
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-neutral-950">
          {tenant.banner_url ? (
            <img
              src={tenant.banner_url}
              alt={tenant.nome}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,_#44403c,_#18181b_48%,_#09090b_100%)]" />
          )}

          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-black/10" />

          <div className="relative min-h-[300px] px-5 py-7 sm:min-h-[380px] sm:px-8 sm:py-9 lg:min-h-[420px] lg:px-12">
            <div className="flex h-full min-h-[260px] flex-col justify-end sm:min-h-[340px] lg:min-h-[380px]">
              <div className="max-w-2xl">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-white/90">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      aberto
                        ? 'bg-emerald-400'
                        : 'bg-rose-400'
                    }`}
                  />
                  {aberto
                    ? 'Pedidos online abertos'
                    : 'Loja fechada no momento'}
                </div>

                <h2 className="text-3xl font-semibold leading-[0.98] tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
                  {tenant.nome}
                </h2>

                <p className="mt-4 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
                  Faça seu pedido com praticidade,
                  escolha seus favoritos e acompanhe tudo
                  até a entrega.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SEARCH + CATEGORIES */}
      <section className="sticky top-[72px] z-30 mt-4 border-y border-neutral-200 bg-neutral-50 sm:mt-5">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative lg:w-[320px] lg:shrink-0">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />

              <input
                type="search"
                value={busca}
                onChange={(event) =>
                  setBusca(event.target.value)
                }
                placeholder="Buscar no cardápio"
                className="h-11 w-full rounded-2xl border border-neutral-200 bg-white pl-10 pr-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 hover:border-neutral-300 focus:border-neutral-400 focus:ring-4 focus:ring-black/[0.04]"
              />
            </div>

            {categorias.length > 0 && (
              <div className="min-w-0 flex-1">
                <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                  {categorias.map((categoria) => {
                    const ativa =
                      categoriaAtiva === categoria.id;

                    return (
                      <button
                        key={categoria.id}
                        type="button"
                        onClick={() =>
                          scrollToCategoria(
                            categoria.id
                          )
                        }
                        className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                          ativa
                            ? 'border-neutral-950 bg-neutral-950 text-white shadow-sm'
                            : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950'
                        }`}
                      >
                        {categoria.nome}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* MENU */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {/* Intro */}
        <div className="mb-8 flex flex-col gap-3 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
              
              Cardápio
            </div>

            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-neutral-950 sm:text-4xl">
              Escolha o que você deseja
            </h2>

            <p className="mt-2 text-sm text-neutral-500">
              {termo
                ? `${totalProdutosVisiveis} resultado(s) encontrado(s)`
                : 'Produtos, categorias e favoritos da loja.'}
            </p>
          </div>
        </div>

        <div className="space-y-12">
          {produtosPorCategoria.map(
            ({
              categoria,
              produtos: produtosCategoria,
            }) => (
              <section
                key={categoria.id}
                ref={(element) => {
                  sectionRefs.current[
                    categoria.id
                  ] = element;
                }}
                className="scroll-mt-32"
              >
                {/* Category heading */}
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl">
                      {categoria.nome}
                    </h3>

                    <p className="mt-1 text-sm text-neutral-500">
                      {produtosCategoria.length}{' '}
                      {produtosCategoria.length === 1
                        ? 'opção disponível'
                        : 'opções disponíveis'}
                    </p>
                  </div>

                  <span className="hidden text-xs font-medium text-neutral-400 sm:block">
                    {produtosCategoria.length}{' '}
                    {produtosCategoria.length === 1
                      ? 'item'
                      : 'itens'}
                  </span>
                </div>

                {produtosCategoria.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-6 py-10 text-center">
                    <p className="text-sm text-neutral-400">
                      Nenhum produto nesta categoria.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {produtosCategoria.map(
                      (produto) => (
                        <button
                          key={produto.id}
                          type="button"
                          onClick={() =>
                            produto.disponivel &&
                            setProdutoSelecionado(
                              produto
                            )
                          }
                          disabled={!produto.disponivel}
                          className={`group overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition ${
                            produto.disponivel
                              ? 'border-neutral-200 hover:border-neutral-300 hover:shadow-md'
                              : 'cursor-not-allowed border-neutral-200 opacity-60'
                          }`}
                        >
                          {/* Product image */}
                          {produto.imagem_url ? (
                            <div className="relative aspect-[1.42/1] overflow-hidden bg-neutral-100">
                              <img
                                src={
                                  produto.imagem_url
                                }
                                alt={
                                  produto.nome
                                }
                                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                              />

                              

                              {!produto.disponivel && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                                  <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-sm">
                                    Indisponível
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex aspect-[1.42/1] items-center justify-center bg-neutral-100">
                              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-neutral-300 shadow-sm">
                                <ShoppingBag className="h-6 w-6" />
                              </div>
                            </div>
                          )}

                          {/* Product details */}
                          <div className="p-4 sm:p-5">
                            <div className="min-h-[78px]">
                              <h4 className="text-base font-semibold leading-tight tracking-tight text-neutral-950 sm:text-lg">
                                {produto.nome}
                              </h4>

                              {produto.descricao && (
                                <p className="mt-2 line-clamp-2 text-sm leading-5 text-neutral-500">
                                  {produto.descricao}
                                </p>
                              )}
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-3 border-t border-neutral-100 pt-4">
                              <div>
                                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-400">
                                  A partir de
                                </p>

                                <p className="mt-0.5 text-lg font-semibold tracking-tight text-neutral-950 sm:text-xl">
                                  {formatCurrency(
                                    produto.preco
                                  )}
                                </p>
                              </div>

                              {produto.disponivel && (
                                <span className="inline-flex min-h-10 items-center justify-center rounded-full bg-neutral-950 px-4 text-xs font-semibold text-white transition group-hover:bg-neutral-800">
                                  Adicionar
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    )}
                  </div>
                )}
              </section>
            )
          )}
        </div>
      </main>

      {/* Product modal */}
      <ProductModal
        produto={produtoSelecionado}
        onClose={() => setProdutoSelecionado(null)}
      />

      {/* Cart */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        tenant={tenant}
        slug={slug!}
      />
    </div>
  );
}

export default function LojaHome() {
  const { slug } = useParams<{
    slug: string;
  }>();

  if (!slug) {
    return (
      <ErrorState message="Slug da loja não fornecido." />
    );
  }

  return (
    <CartProvider slug={slug}>
      <LojaHomeContent />
    </CartProvider>
  );
}
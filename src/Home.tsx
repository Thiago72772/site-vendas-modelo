import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Clock,
  Store,
  ShoppingBag,
  CheckCircle2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Tenant } from '@/lib/types';

export default function Home() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('tenants')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      setTenants((data as Tenant[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const loja = tenants[0];

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-neutral-900">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {loja?.logo_url ? (
              <img
                src={loja.logo_url}
                alt={loja.nome}
                className="h-10 w-10 shrink-0 rounded-2xl object-cover ring-1 ring-black/5"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-neutral-900 text-white">
                <Store className="h-5 w-5" />
              </div>
            )}

            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-neutral-950">
                {loja?.nome ?? 'Loja Teste'}
              </p>

              <p className="mt-0.5 text-xs text-neutral-400">
                Pedidos online
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Experiência online
            </div>
          </div>
        </div>
      </header>

      {loading ? (
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="skeleton h-[470px] rounded-[30px] sm:h-[560px]" />
            <div className="skeleton h-[470px] rounded-[30px] sm:h-[560px]" />
          </div>
        </main>
      ) : !loja ? (
        <main className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
          <div className="w-full max-w-md rounded-[30px] border border-neutral-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-neutral-100">
              <Store className="h-7 w-7 text-neutral-500" />
            </div>

            <h1 className="mt-6 text-2xl font-semibold tracking-tight text-neutral-950">
              Nenhuma loja disponível
            </h1>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-neutral-500">
              A loja ainda não foi configurada para esta demonstração.
            </p>
          </div>
        </main>
      ) : (
        <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
          <div className="grid gap-5 lg:grid-cols-[1.18fr_0.82fr]">
            {/* Main visual */}
            <section className="relative min-h-[460px] overflow-hidden rounded-[30px] border border-neutral-900 bg-neutral-950 shadow-xl sm:min-h-[560px]">
              {loja.banner_url ? (
                <img
                  src={loja.banner_url}
                  alt={loja.nome}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_#3f3f46,_#18181b_50%,_#09090b)]" />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/10" />

              <div className="relative flex h-full min-h-[460px] flex-col justify-between p-5 sm:min-h-[560px] sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-white/85">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Loja online
                  </div>

                  <div className="hidden rounded-full border border-white/15 bg-black/20 px-3 py-2 text-xs text-white/70 sm:block">
                    Modelo de demonstração
                  </div>
                </div>

                <div className="max-w-2xl">
                  <div className="mb-4 flex items-center gap-2">
                    {loja.logo_url ? (
                      <img
                        src={loja.logo_url}
                        alt=""
                        className="h-12 w-12 rounded-2xl border border-white/20 object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white">
                        <Store className="h-5 w-5" />
                      </div>
                    )}

                    <div>
                      <p className="text-sm font-medium text-white/70">
                        Experiência white-label
                      </p>
                      <p className="text-sm font-semibold text-white">
                        {loja.nome}
                      </p>
                    </div>
                  </div>

                  <h1 className="max-w-xl text-4xl font-semibold leading-[0.98] tracking-[-0.04em] text-white sm:text-6xl">
                    Uma experiência de pedidos simples, bonita e moderna.
                  </h1>

                  <p className="mt-5 max-w-xl text-sm leading-6 text-white/72 sm:text-base">
                    Um modelo visual pensado para qualquer negócio de
                    alimentação, com cardápio, pedido, pagamento e
                    acompanhamento em uma experiência contínua.
                  </p>

                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <Link
                      to={`/loja/${loja.slug}`}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-100 active:scale-[0.99]"
                    >
                      Ver experiência
                      <ArrowRight className="h-4 w-4" />
                    </Link>

                    {loja.tempo_medio_preparo_min && (
                      <div className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-medium text-white/85 backdrop-blur-xl">
                        <Clock className="h-4 w-4" />
                        ~{loja.tempo_medio_preparo_min} min
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Supporting panel */}
            <section className="flex flex-col rounded-[30px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
                  Sistema modelo
                </p>

                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-neutral-950 sm:text-4xl">
                  Uma base pronta para ser personalizada.
                </h2>

                <p className="mt-3 text-sm leading-6 text-neutral-500">
                  Estrutura visual neutra, moderna e adaptável para
                  diferentes segmentos de alimentação.
                </p>
              </div>

              <div className="mt-7 space-y-3">
                {[
                  {
                    icon: Store,
                    title: 'Identidade da loja',
                    text: 'Logo, banner, nome e imagens podem ser trocados.',
                  },
                  {
                    icon: ShoppingBag,
                    title: 'Experiência de compra',
                    text: 'Produtos, carrinho e checkout em uma jornada contínua.',
                  },
                  {
                    icon: CheckCircle2,
                    title: 'Acompanhamento',
                    text: 'O cliente acompanha o pedido até a entrega.',
                  },
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.title}
                      className="group rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4 transition hover:border-neutral-300 hover:bg-white hover:shadow-sm"
                    >
                      <div className="flex gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-neutral-900 text-white">
                          <Icon className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-neutral-950">
                            {item.title}
                          </h3>

                          <p className="mt-1 text-sm leading-5 text-neutral-500">
                            {item.text}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-auto pt-7">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-950 p-5 text-white">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">
                    Modelo de demonstração
                  </p>

                  <div className="mt-4 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-white/65">
                        Próxima etapa
                      </p>

                      <p className="mt-1 text-lg font-semibold tracking-tight">
                        Personalizar para o cliente
                      </p>
                    </div>

                    <ArrowRight className="h-5 w-5 shrink-0 text-white/60" />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      )}
    </div>
  );
}
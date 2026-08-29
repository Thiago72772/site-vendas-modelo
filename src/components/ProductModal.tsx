import { useEffect, useMemo, useState } from 'react';
import { X, Plus, Minus, ShoppingBag, Check } from 'lucide-react';
import { useCart, type CartItemAdicional } from '@/hooks/useCart';
import { useScrollLock } from '@/hooks/useScrollLock';
import { formatCurrency } from '@/lib/format';
import type { Produto, GrupoAdicional, Adicional } from '@/lib/types';
import { supabase } from '@/lib/supabase';

interface ProductModalProps {
  produto: Produto | null;
  onClose: () => void;
}

interface GrupoComAdicionais extends GrupoAdicional {
  adicionais: Adicional[];
}

export function ProductModal({
  produto,
  onClose,
}: ProductModalProps) {
  const { addItem } = useCart();

  const [grupos, setGrupos] = useState<GrupoComAdicionais[]>([]);
  const [selecionados, setSelecionados] = useState<
    Record<string, CartItemAdicional[]>
  >({});
  const [quantidade, setQuantidade] = useState(1);
  const [loading, setLoading] = useState(false);
  const [adicionaisLoading, setAdicionaisLoading] = useState(false);

  useEffect(() => {
  const produtoId = produto?.id;

  if (!produtoId) {
    setGrupos([]);
    setSelecionados({});
    setQuantidade(1);
    return;
  }

  let active = true;

    async function carregarAdicionais() {
      setAdicionaisLoading(true);

      try {
        const { data: gruposData, error: gruposError } =
          await supabase
            .from('grupos_adicionais')
            .select('*')
            .eq('produto_id', produtoId)
            .order('ordem');

        if (!active) return;

        if (gruposError || !gruposData) {
          setGrupos([]);
          return;
        }

        const gruposComAdicionais = await Promise.all(
          (gruposData as GrupoAdicional[]).map(async (grupo) => {
            const { data: adicionaisData } = await supabase
              .from('adicionais')
              .select('*')
              .eq('grupo_id', grupo.id)
              .order('ordem');

            return {
              ...grupo,
              adicionais:
                (adicionaisData as Adicional[]) ?? [],
            };
          })
        );

        if (!active) return;

        setGrupos(gruposComAdicionais);
      } catch (err) {
        console.error(
          'Erro ao carregar adicionais do produto:',
          err
        );
        setGrupos([]);
      } finally {
        if (active) {
          setAdicionaisLoading(false);
        }
      }
    }

    carregarAdicionais();

    return () => {
      active = false;
    };
  }, [produto]);

  useScrollLock(!!produto);

  // Handle Escape key
  useEffect(() => {
    if (!produto) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [produto, onClose]);

  const totalAdicionais = useMemo(() => {
    return Object.values(selecionados).reduce(
      (total, grupoItens) =>
        total +
        grupoItens.reduce(
          (grupoTotal, adicional) =>
            grupoTotal + Number(adicional.preco_extra || 0),
          0
        ),
      0
    );
  }, [selecionados]);

  const precoUnitario = Number(produto?.preco ?? 0);

  const total = useMemo(() => {
    return (
      (precoUnitario + totalAdicionais) *
      quantidade
    );
  }, [precoUnitario, totalAdicionais, quantidade]);

  function obterSelecionadosGrupo(
    grupoId: string
  ): CartItemAdicional[] {
    return selecionados[grupoId] ?? [];
  }

  function selecionarAdicional(
    grupo: GrupoComAdicionais,
    adicional: Adicional
  ) {
    const atuais = obterSelecionadosGrupo(grupo.id);

    const jaSelecionado = atuais.some(
      (item) => item.id === adicional.id
    );

    if (jaSelecionado) {
      setSelecionados((prev) => ({
        ...prev,
        [grupo.id]: atuais.filter(
          (item) => item.id !== adicional.id
        ),
      }));

      return;
    }

    const maxSelecao = Number(grupo.max_selecao ?? 1);

    if (maxSelecao <= 1) {
      setSelecionados((prev) => ({
        ...prev,
        [grupo.id]: [
          {
            id: adicional.id,
            nome: adicional.nome,
            preco_extra: Number(adicional.preco_extra || 0),
          },
        ],
      }));

      return;
    }

    if (atuais.length >= maxSelecao) {
      return;
    }

    setSelecionados((prev) => ({
      ...prev,
      [grupo.id]: [
        ...atuais,
        {
          id: adicional.id,
          nome: adicional.nome,
          preco_extra: Number(adicional.preco_extra || 0),
        },
      ],
    }));
  }

  function grupoObrigatorioSemSelecao(
    grupo: GrupoComAdicionais
  ) {
    return (
      grupo.obrigatorio &&
      obterSelecionadosGrupo(grupo.id).length === 0
    );
  }

  function validarAdicionais() {
    return grupos.every(
      (grupo) => !grupoObrigatorioSemSelecao(grupo)
    );
  }

  function handleAddToCart() {
    if (!produto || !produto.disponivel) return;

    if (!validarAdicionais()) {
      return;
    }

    setLoading(true);

    const adicionais: CartItemAdicional[] =
      Object.values(selecionados).flat();

    addItem(produto, quantidade, adicionais);

    window.setTimeout(() => {
      setLoading(false);
      onClose();
    }, 180);
  }

  function alterarQuantidade(delta: number) {
    setQuantidade((atual) =>
      Math.max(1, atual + delta)
    );
  }

  if (!produto) {
    return null;
  }

  const produtoIndisponivel = !produto.disponivel;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Fechar produto"
        className="absolute inset-0 h-full w-full cursor-default bg-black/40"
        onClick={onClose}
      />

      {/* Modal container */}
      <div className="absolute inset-x-0 bottom-0 flex max-h-[94vh] justify-center sm:inset-0 sm:items-center sm:p-6">
        <div className="relative flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-h-[88vh] sm:rounded-[28px]">
          {/* Header / close */}
          <div className="absolute right-4 top-4 z-10">
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:bg-neutral-50"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Image */}
          <div className="relative shrink-0 bg-neutral-100">
            {produto.imagem_url ? (
              <img
                src={produto.imagem_url}
                alt={produto.nome}
                className="h-56 w-full object-cover sm:h-72"
              />
            ) : (
              <div className="flex h-48 w-full items-center justify-center bg-neutral-100 sm:h-64">
                <ShoppingBag className="h-14 w-14 text-neutral-300" />
              </div>
            )}

            {produtoIndisponivel && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-700 shadow-lg">
                  Produto indisponível
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-7 p-5 sm:p-7">
              {/* Product heading */}
              <div className="pr-10">
                <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
                  {produto.nome}
                </h2>

                {produto.descricao && (
                  <p className="mt-2 text-sm leading-6 text-neutral-500 sm:text-base">
                    {produto.descricao}
                  </p>
                )}

                <div className="mt-4 text-xl font-semibold tracking-tight text-neutral-950">
                  {formatCurrency(precoUnitario)}
                </div>
              </div>

              {/* Add-ons */}
              {adicionaisLoading ? (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-sm text-neutral-500">
                    Carregando opções...
                  </p>
                </div>
              ) : grupos.length > 0 ? (
                <div className="space-y-6">
                  {grupos.map((grupo) => {
                    const selecionadosGrupo =
                      obterSelecionadosGrupo(grupo.id);

                    const maxSelecao = Number(
                      grupo.max_selecao ?? 1
                    );

                    const erroObrigatorio =
                      grupoObrigatorioSemSelecao(grupo);

                    return (
                      <section
                        key={grupo.id}
                        className="space-y-3"
                      >
                        <div className="flex items-end justify-between gap-4">
                          <div>
                            <h3 className="text-sm font-semibold text-neutral-950 sm:text-base">
                              {grupo.nome}
                            </h3>

                            <p className="mt-1 text-xs text-neutral-500">
                              {grupo.obrigatorio
                                ? `Obrigatório • ${
                                    maxSelecao === 1
                                      ? 'escolha 1'
                                      : `até ${maxSelecao}`
                                  }`
                                : `Opcional${
                                    maxSelecao > 1
                                      ? ` • até ${maxSelecao}`
                                      : ''
                                  }`}
                            </p>
                          </div>

                          {erroObrigatorio && (
                            <span className="text-xs font-medium text-rose-600">
                              Selecione uma opção
                            </span>
                          )}
                        </div>

                        <div className="grid gap-2">
                          {grupo.adicionais.map(
                            (adicional) => {
                              const selecionado =
                                selecionadosGrupo.some(
                                  (item) =>
                                    item.id === adicional.id
                                );

                              const maxAtingido =
                                !selecionado &&
                                maxSelecao > 1 &&
                                selecionadosGrupo.length >=
                                  maxSelecao;

                              return (
                                <button
                                  key={adicional.id}
                                  type="button"
                                  disabled={maxAtingido}
                                  onClick={() =>
                                    selecionarAdicional(
                                      grupo,
                                      adicional
                                    )
                                  }
                                  className={`flex items-center justify-between gap-4 rounded-2xl border p-4 text-left transition ${
                                    selecionado
                                      ? 'border-neutral-900 bg-neutral-50'
                                      : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'
                                  } ${
                                    maxAtingido
                                      ? 'cursor-not-allowed opacity-45'
                                      : ''
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-neutral-900">
                                      {adicional.nome}
                                    </p>

                                    {Number(
                                      adicional.preco_extra
                                    ) > 0 && (
                                      <p className="mt-1 text-xs text-neutral-500">
                                        +{' '}
                                        {formatCurrency(
                                          Number(
                                            adicional.preco_extra
                                          )
                                        )}
                                      </p>
                                    )}
                                  </div>

                                  <span
                                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                                      selecionado
                                        ? 'border-neutral-900 bg-neutral-900 text-white'
                                        : 'border-neutral-300 bg-white text-transparent'
                                    }`}
                                  >
                                    <Check className="h-4 w-4" />
                                  </span>
                                </button>
                              );
                            }
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : null}

              {/* Quantity */}
              <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    Quantidade
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Escolha quantas unidades deseja.
                  </p>
                </div>

                <div className="flex items-center gap-3 rounded-full bg-white p-1 shadow-sm ring-1 ring-neutral-200">
                  <button
                    type="button"
                    onClick={() => alterarQuantidade(-1)}
                    disabled={quantidade <= 1}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label="Diminuir quantidade"
                  >
                    <Minus className="h-4 w-4" />
                  </button>

                  <span className="w-8 text-center text-sm font-semibold text-neutral-900">
                    {quantidade}
                  </span>

                  <button
                    type="button"
                    onClick={() => alterarQuantidade(1)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-white transition hover:bg-neutral-800"
                    aria-label="Aumentar quantidade"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-neutral-200 bg-white p-4 sm:p-5">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={
                loading ||
                produtoIndisponivel ||
                !validarAdicionais()
              }
              className="flex w-full items-center justify-between gap-4 rounded-2xl bg-neutral-900 px-5 py-4 text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex items-center gap-2 text-sm font-semibold sm:text-base">
                <ShoppingBag className="h-4 w-4" />
                {loading
                  ? 'Adicionando...'
                  : 'Adicionar ao pedido'}
              </span>

              <span className="text-base font-semibold sm:text-lg">
                {formatCurrency(total)}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
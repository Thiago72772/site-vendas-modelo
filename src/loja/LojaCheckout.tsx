import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTenant } from '@/hooks/useTenant';
import {
  CartProvider,
  useCart,
  calculateItemPrice,
} from '@/hooks/useCart';
import { LoadingScreen, ErrorState } from '@/components/ui';
import {
  formatCurrency,
  maskPhone,
  maskCEP,
} from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type {
  Endereco,
  Cupom,
  FormaPagamento,
} from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import {
  ChevronLeft,
  ShoppingBag,
  Tag,
  Loader2,
  Check,
  AlertCircle,
  MapPin,
} from 'lucide-react';

interface DadosClienteSalvos {
  nome: string;
  telefone: string;
  endereco?: Endereco;
  atualizadoEm: string;
}

function LojaCheckoutContent() {
  const { slug } = useParams<{ slug: string }>();
  const { tenant, loading, error } = useTenant(slug);
  const { items, subtotal, clearCart } = useCart();
  const { session } = useAuth();
  const navigate = useNavigate();

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cep, setCEP] = useState('');
  const [rua, setRua] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [referencia, setReferencia] = useState('');
  const [cepLoading, setCEPLoading] = useState(false);
  const [cepError, setCEPError] = useState<string | null>(null);

  const [formaPagamento, setFormaPagamento] =
    useState<FormaPagamento>('pix');
  const [trocoPara, setTrocoPara] = useState('');

  const [cupomCodigo, setCupomCodigo] = useState('');
  const [cupom, setCupom] = useState<Cupom | null>(null);
  const [cupomStatus, setCupomStatus] = useState<
    'idle' | 'valid' | 'invalid'
  >('idle');
  const [cupomMessage, setCupomMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<
    Record<string, string>
  >({});

  /*
   * 1. Recupera dados já salvos para esta loja.
   *
   * Isso funciona mesmo para cliente convidado,
   * sem depender de autenticação.
   */
  useEffect(() => {
    if (!slug) return;

    let active = true;

    async function carregarDadosCliente() {
      /*
       * Primeiro tenta os dados locais do cliente.
       */
      try {
        const storageKey = `dados_cliente_${slug}`;
        const stored = localStorage.getItem(storageKey);

        if (stored) {
          const dados =
            JSON.parse(stored) as DadosClienteSalvos;

          if (active && dados) {
            setNome(dados.nome ?? '');
            setTelefone(
              dados.telefone
                ? maskPhone(dados.telefone)
                : ''
            );

            const endereco = dados.endereco;

            if (endereco) {
              setCEP(
                endereco.cep
                  ? maskCEP(endereco.cep)
                  : ''
              );
              setRua(endereco.rua ?? '');
              setBairro(endereco.bairro ?? '');
              setCidade(endereco.cidade ?? '');
              setNumero(endereco.numero ?? '');
              setComplemento(
                endereco.complemento ?? ''
              );
              setReferencia(
                endereco.referencia ?? ''
              );
            }
          }
        }
      } catch {
        // ignora dados locais inválidos
      }

      /*
       * Se o cliente estiver autenticado, tentamos
       * complementar os dados existentes pelo Supabase.
       *
       * Isso mantém a lógica já existente do projeto.
       */
      if (!session?.user || !tenant || !active) {
        return;
      }

      const { data, error: clienteError } =
        await supabase
          .from('clientes')
          .select('*')
          .eq('auth_user_id', session.user.id)
          .eq('tenant_id', tenant.id)
          .order('updated_at', {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

      if (!active || clienteError || !data) {
        return;
      }

      const cliente = data as {
        nome?: string;
        telefone?: string;
        endereco?: Endereco;
      };

      if (cliente.nome) {
        setNome(cliente.nome);
      }

      if (cliente.telefone) {
        setTelefone(maskPhone(cliente.telefone));
      }

      if (cliente.endereco) {
        const endereco = cliente.endereco;

        setCEP(
          endereco.cep
            ? maskCEP(endereco.cep)
            : ''
        );
        setRua(endereco.rua ?? '');
        setBairro(endereco.bairro ?? '');
        setCidade(endereco.cidade ?? '');
        setNumero(endereco.numero ?? '');
        setComplemento(
          endereco.complemento ?? ''
        );
        setReferencia(
          endereco.referencia ?? ''
        );
      }
    }

    carregarDadosCliente();

    return () => {
      active = false;
    };
  }, [slug, session, tenant]);

  /*
   * 2. ViaCEP.
   */
  useEffect(() => {
    const cepDigits = cep.replace(/\D/g, '');

    if (cepDigits.length !== 8) {
      /*
       * Só limpamos automaticamente os campos
       * quando o CEP ainda não está completo.
       */
      setCEPError(null);
      return;
    }

    let active = true;

    setCEPLoading(true);
    setCEPError(null);

    (async () => {
      try {
        const response = await fetch(
          `https://viacep.com.br/ws/${cepDigits}/json/`
        );

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        const data = await response.json();

        if (!active) return;

        if (data.erro) {
          setCEPError(
            'CEP não encontrado. Preencha o endereço manualmente.'
          );
          setCEPLoading(false);
          return;
        }

        /*
         * Preenche apenas os campos retornados pelo CEP.
         */
        setRua(data.logradouro ?? '');
        setBairro(data.bairro ?? '');
        setCidade(data.localidade ?? '');

        setCEPLoading(false);
      } catch {
        if (!active) return;

        setCEPError(
          'Não foi possível consultar o CEP. Preencha o endereço manualmente.'
        );

        setCEPLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [cep]);

  /*
   * 3. Validação do cupom.
   */
  useEffect(() => {
    if (!cupomCodigo.trim() || !tenant) {
      setCupom(null);
      setCupomStatus('idle');
      setCupomMessage('');
      return;
    }

    let active = true;

    const timer = window.setTimeout(async () => {
      const codigo = cupomCodigo
        .trim()
        .toUpperCase();

      const {
        data,
        error: queryError,
      } = await supabase
        .from('cupons')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('codigo', codigo)
        .eq('ativo', true)
        .maybeSingle();

      if (!active) return;

      if (queryError || !data) {
        setCupom(null);
        setCupomStatus('invalid');
        setCupomMessage(
          'Cupom inválido ou não encontrado.'
        );
        return;
      }

      const c = data as Cupom;
      const now = new Date();

      if (
        c.validade_inicio &&
        new Date(c.validade_inicio) > now
      ) {
        setCupom(null);
        setCupomStatus('invalid');
        setCupomMessage(
          'Cupom ainda não é válido.'
        );
        return;
      }

      if (
        c.validade_fim &&
        new Date(c.validade_fim) < now
      ) {
        setCupom(null);
        setCupomStatus('invalid');
        setCupomMessage(
          'Cupom expirado.'
        );
        return;
      }

      if (
        c.uso_maximo !== null &&
        c.uso_atual >= c.uso_maximo
      ) {
        setCupom(null);
        setCupomStatus('invalid');
        setCupomMessage(
          'Cupom esgotado.'
        );
        return;
      }

      setCupom(c);
      setCupomStatus('valid');
      setCupomMessage('Cupom aplicado!');
    }, 600);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [cupomCodigo, tenant]);

  const taxaEntrega =
    tenant?.taxa_entrega_base ?? 0;

  const desconto = cupom
    ? cupom.tipo_desconto === 'percentual'
      ? (subtotal * cupom.valor) / 100
      : Math.min(cupom.valor, subtotal)
    : 0;

  const total = Math.max(
    0,
    subtotal + taxaEntrega - desconto
  );

  function validate(): boolean {
    const errors: Record<string, string> = {};

    const telefoneDigits =
      telefone.replace(/\D/g, '');

    const cepDigits =
      cep.replace(/\D/g, '');

    if (!nome.trim()) {
      errors.nome = 'Informe seu nome.';
    }

    if (telefoneDigits.length < 10) {
      errors.telefone =
        'Informe um telefone válido.';
    }

    if (cepDigits.length !== 8) {
      errors.cep = 'Informe um CEP válido.';
    }

    if (!rua.trim()) {
      errors.rua = 'Informe a rua.';
    }

    if (!numero.trim()) {
      errors.numero = 'Informe o número.';
    }

    if (!bairro.trim()) {
      errors.bairro = 'Informe o bairro.';
    }

    if (!cidade.trim()) {
      errors.cidade = 'Informe a cidade.';
    }

    setFormErrors(errors);

    return Object.keys(errors).length === 0;
  }

  function salvarDadosCliente(endereco: Endereco) {
    if (!slug) return;

    const storageKey = `dados_cliente_${slug}`;

    const dados: DadosClienteSalvos = {
      nome: nome.trim(),
      telefone: telefone.replace(/\D/g, ''),
      endereco,
      atualizadoEm:
        new Date().toISOString(),
    };

    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(dados)
      );
    } catch {
      // ignore storage errors
    }
  }

  async function handleSubmit(
    e: FormEvent
  ) {
    e.preventDefault();

    setSubmitError(null);

    if (!validate() || !tenant || !slug) {
      return;
    }

    if (items.length === 0) {
      setSubmitError(
        'Seu carrinho está vazio.'
      );
      return;
    }

    setSubmitting(true);

    try {
      const endereco: Endereco = {
        rua: rua.trim(),
        numero: numero.trim(),
        bairro: bairro.trim(),
        cidade: cidade.trim(),
        cep: cep.replace(/\D/g, ''),
        complemento:
          complemento.trim() || undefined,
        referencia:
          referencia.trim() || undefined,
      };

      /*
       * Salva os dados localmente antes de criar o pedido.
       * Assim, mesmo que o cliente seja convidado,
       * os dados estarão disponíveis na próxima compra.
       */
      salvarDadosCliente(endereco);

      /*
       * 1. Cria o cliente.
       *
       * Mantemos o comportamento atual do projeto.
       */
      const {
        data: clienteData,
        error: clienteError,
      } = await supabase
        .from('clientes')
        .insert({
          tenant_id: tenant.id,
          auth_user_id:
            session?.user?.id ?? null,
          nome: nome.trim(),
          telefone:
            telefone.replace(/\D/g, ''),
          endereco,
        })
        .select()
        .single();

      if (clienteError) {
        throw new Error(
          'Falha ao cadastrar cliente: ' +
            clienteError.message
        );
      }

      const clienteId = clienteData.id;

      /*
       * 2. Cria o pedido.
       */
      const {
        data: pedidoData,
        error: pedidoError,
      } = await supabase
        .from('pedidos')
        .insert({
          tenant_id: tenant.id,
          cliente_id: clienteId,
          status: 'recebido',
          forma_pagamento:
            formaPagamento,
          subtotal,
          taxa_entrega: taxaEntrega,
          desconto,
          total,
          endereco_entrega: endereco,
          cupom_id: cupom?.id ?? null,
          observacoes:
            formaPagamento === 'dinheiro' &&
            trocoPara.trim()
              ? `Troco para: ${trocoPara.trim()}`
              : null,
        })
        .select()
        .single();

      if (pedidoError) {
        throw new Error(
          'Falha ao criar pedido: ' +
            pedidoError.message
        );
      }

      const pedidoId = pedidoData.id;

      /*
       * 3. Cria os itens.
       */
      const itensPayload = items.map(
        (item) => ({
          pedido_id: pedidoId,
          produto_id: item.produto_id,
          quantidade: item.quantidade,
          preco_unitario_no_momento:
            item.preco_unitario,
          adicionais_selecionados:
            item.adicionais,
        })
      );

      const {
        error: itensError,
      } = await supabase
        .from('itens_pedido')
        .insert(itensPayload);

      if (itensError) {
        /*
         * Evita deixar um pedido sem itens.
         */
        await supabase
          .from('pedidos')
          .delete()
          .eq('id', pedidoId);

        throw new Error(
          'Falha ao salvar itens do pedido: ' +
            itensError.message
        );
      }

      /*
       * 4. Atualiza uso do cupom.
       */
      if (cupom) {
        const novoUso = cupom.uso_atual + 1;

        await supabase
          .from('cupons')
          .update({
            uso_atual: novoUso,
          })
          .eq('id', cupom.id);
      }

      /*
       * 5. Salva o pedido ativo.
       */
      try {
        localStorage.setItem(
          `ultimo_pedido_${slug}`,
          JSON.stringify({
            pedidoId,
            createdAt:
              new Date().toISOString(),
          })
        );
      } catch {
        // ignore storage errors
      }

      /*
       * 6. Limpa o carrinho e abre
       * o acompanhamento.
       */
      clearCart();

      navigate(
        `/loja/${slug}/pedido/${pedidoId}`
      );
    } catch (err) {
      console.error(
        'Erro ao finalizar pedido:',
        err
      );

      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Erro ao finalizar pedido.'
      );

      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <LoadingScreen message="Carregando..." />
    );
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!tenant) {
    return (
      <ErrorState message="Loja não encontrada." />
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <Link
            to={`/loja/${slug}`}
            className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-neutral-100"
            aria-label="Voltar para a loja"
          >
            <ChevronLeft className="h-5 w-5 text-neutral-600" />
          </Link>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
              {tenant.nome}
            </p>

            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-neutral-900">
              Finalizar pedido
            </h1>
          </div>
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-8"
      >
        {/* Empty cart */}
        {items.length === 0 && (
          <div className="flex flex-col items-center rounded-3xl border border-neutral-200 bg-white px-6 py-10 text-center">
            <ShoppingBag className="mb-3 h-10 w-10 text-neutral-300" />

            <p className="text-sm text-neutral-500">
              Seu carrinho está vazio.
            </p>

            <Link
              to={`/loja/${slug}`}
              className="mt-5 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Ver cardápio
            </Link>
          </div>
        )}

        {/* Customer */}
        <div className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">
              Seus dados
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Seus dados ficam salvos neste dispositivo para facilitar a próxima compra.
            </p>
          </div>

          <div>
            <label className="label">
              Nome completo *
            </label>

            <input
              className={`input ${
                formErrors.nome
                  ? 'border-error-400'
                  : ''
              }`}
              value={nome}
              onChange={(e) =>
                setNome(e.target.value)
              }
              placeholder="João da Silva"
              autoComplete="name"
            />

            {formErrors.nome && (
              <p className="mt-1 text-xs text-error-600">
                {formErrors.nome}
              </p>
            )}
          </div>

          <div>
            <label className="label">
              Telefone / WhatsApp *
            </label>

            <input
              className={`input ${
                formErrors.telefone
                  ? 'border-error-400'
                  : ''
              }`}
              value={telefone}
              onChange={(e) =>
                setTelefone(
                  maskPhone(e.target.value)
                )
              }
              placeholder="(11) 99999-9999"
              inputMode="numeric"
              autoComplete="tel"
            />

            {formErrors.telefone && (
              <p className="mt-1 text-xs text-error-600">
                {formErrors.telefone}
              </p>
            )}
          </div>
        </div>

        {/* Address */}
        <div className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
              <MapPin className="h-4 w-4 text-primary-500" />
              Endereço de entrega
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              O endereço será salvo para facilitar seus próximos pedidos.
            </p>
          </div>

          <div>
            <label className="label">
              CEP *
            </label>

            <input
              className={`input ${
                formErrors.cep
                  ? 'border-error-400'
                  : ''
              }`}
              value={cep}
              onChange={(e) =>
                setCEP(
                  maskCEP(e.target.value)
                )
              }
              placeholder="00000-000"
              inputMode="numeric"
              autoComplete="postal-code"
            />

            {cepLoading && (
              <p className="mt-1 flex items-center gap-1 text-xs text-neutral-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Buscando CEP...
              </p>
            )}

            {cepError && (
              <p className="mt-1 flex items-center gap-1 text-xs text-warning-600">
                <AlertCircle className="h-3 w-3" />
                {cepError}
              </p>
            )}

            {formErrors.cep && (
              <p className="mt-1 text-xs text-error-600">
                {formErrors.cep}
              </p>
            )}
          </div>

          <div>
            <label className="label">
              Rua *
            </label>

            <input
              className={`input ${
                formErrors.rua
                  ? 'border-error-400'
                  : ''
              }`}
              value={rua}
              onChange={(e) =>
                setRua(e.target.value)
              }
              placeholder="Rua / Avenida"
              autoComplete="street-address"
            />

            {formErrors.rua && (
              <p className="mt-1 text-xs text-error-600">
                {formErrors.rua}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">
                Número *
              </label>

              <input
                className={`input ${
                  formErrors.numero
                    ? 'border-error-400'
                    : ''
                }`}
                value={numero}
                onChange={(e) =>
                  setNumero(e.target.value)
                }
                placeholder="123"
                autoComplete="address-line2"
              />

              {formErrors.numero && (
                <p className="mt-1 text-xs text-error-600">
                  {formErrors.numero}
                </p>
              )}
            </div>

            <div>
              <label className="label">
                Complemento
              </label>

              <input
                className="input"
                value={complemento}
                onChange={(e) =>
                  setComplemento(
                    e.target.value
                  )
                }
                placeholder="Apto 4"
              />
            </div>
          </div>

          <div>
            <label className="label">
              Bairro *
            </label>

            <input
              className={`input ${
                formErrors.bairro
                  ? 'border-error-400'
                  : ''
              }`}
              value={bairro}
              onChange={(e) =>
                setBairro(e.target.value)
              }
              placeholder="Centro"
              autoComplete="address-level3"
            />

            {formErrors.bairro && (
              <p className="mt-1 text-xs text-error-600">
                {formErrors.bairro}
              </p>
            )}
          </div>

          <div>
            <label className="label">
              Cidade *
            </label>

            <input
              className={`input ${
                formErrors.cidade
                  ? 'border-error-400'
                  : ''
              }`}
              value={cidade}
              onChange={(e) =>
                setCidade(e.target.value)
              }
              placeholder="São Paulo"
              autoComplete="address-level2"
            />

            {formErrors.cidade && (
              <p className="mt-1 text-xs text-error-600">
                {formErrors.cidade}
              </p>
            )}
          </div>

          <div>
            <label className="label">
              Ponto de referência
            </label>

            <input
              className="input"
              value={referencia}
              onChange={(e) =>
                setReferencia(
                  e.target.value
                )
              }
              placeholder="Próximo à praça"
            />
          </div>
        </div>

        {/* Payment */}
        <div className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-neutral-900">
            Pagamento
          </h2>

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                'pix',
                'cartao',
                'dinheiro',
              ] as FormaPagamento[]
            ).map((forma) => (
              <button
                key={forma}
                type="button"
                onClick={() =>
                  setFormaPagamento(
                    forma
                  )
                }
                className={`rounded-xl px-3 py-3 text-sm font-medium transition-all ${
                  formaPagamento === forma
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {forma === 'pix'
                  ? 'PIX'
                  : forma === 'cartao'
                  ? 'Cartão'
                  : 'Dinheiro'}
              </button>
            ))}
          </div>

          {formaPagamento === 'dinheiro' && (
            <div>
              <label className="label">
                Troco para quanto?
              </label>

              <input
                className="input"
                value={trocoPara}
                onChange={(e) =>
                  setTrocoPara(
                    e.target.value
                  )
                }
                placeholder="R$ 50,00"
                inputMode="decimal"
              />
            </div>
          )}
        </div>

        {/* Coupon */}
        <div className="space-y-3 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
            <Tag className="h-4 w-4 text-primary-500" />
            Cupom de desconto
          </h2>

          <div className="relative">
            <input
              className="input pr-11 uppercase"
              value={cupomCodigo}
              onChange={(e) =>
                setCupomCodigo(
                  e.target.value.toUpperCase()
                )
              }
              placeholder="Digite o cupom"
              autoComplete="off"
            />

            {cupomStatus === 'valid' && (
              <Check className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-success-500" />
            )}

            {cupomStatus === 'invalid' && (
              <AlertCircle className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-error-500" />
            )}
          </div>

          {cupomMessage && (
            <p
              className={`text-xs ${
                cupomStatus === 'valid'
                  ? 'text-success-600'
                  : 'text-error-600'
              }`}
            >
              {cupomMessage}
            </p>
          )}
        </div>

        {/* Summary */}
        <div className="space-y-3 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-neutral-900">
            Resumo do pedido
          </h2>

          {items.length > 0 && (
            <div className="space-y-2 border-b border-neutral-100 pb-3">
              {items.map((item) => {
                const itemTotal =
                  calculateItemPrice(
                    item.preco_unitario,
                    item.adicionais,
                    item.quantidade
                  );

                return (
                  <div
                    key={item.id}
                    className="flex justify-between gap-4 text-sm"
                  >
                    <span className="text-neutral-600">
                      {item.quantidade}x{' '}
                      {item.nome}
                    </span>

                    <span className="shrink-0 font-medium text-neutral-900">
                      {formatCurrency(
                        itemTotal
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-between text-sm">
            <span className="text-neutral-500">
              Subtotal
            </span>

            <span className="font-medium text-neutral-900">
              {formatCurrency(subtotal)}
            </span>
          </div>

          {desconto > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-success-600">
                Desconto
              </span>

              <span className="font-medium text-success-600">
                - {formatCurrency(desconto)}
              </span>
            </div>
          )}

          <div className="flex justify-between text-sm">
            <span className="text-neutral-500">
              Taxa de entrega
            </span>

            <span className="font-medium text-neutral-900">
              {formatCurrency(taxaEntrega)}
            </span>
          </div>

          <div className="flex justify-between border-t border-neutral-100 pt-3 text-lg font-semibold">
            <span>Total</span>

            <span className="text-neutral-900">
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        {/* Error */}
        {submitError && (
          <div className="rounded-3xl border border-rose-100 bg-rose-50 p-5">
            <p className="text-sm text-error-700">
              {submitError}
            </p>
          </div>
        )}

        {/* Submit */}
        {items.length > 0 && (
          <button
            type="submit"
            disabled={submitting}
            className="sticky bottom-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-neutral-900 py-4 text-base font-semibold text-white shadow-xl transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && (
              <Loader2 className="h-5 w-5 animate-spin" />
            )}

            {submitting
              ? 'Enviando pedido...'
              : `Confirmar pedido · ${formatCurrency(
                  total
                )}`}
          </button>
        )}
      </form>
    </div>
  );
}

export default function LojaCheckout() {
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
      <LojaCheckoutContent />
    </CartProvider>
  );
}
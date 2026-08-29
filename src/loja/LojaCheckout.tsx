import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTenant } from '@/hooks/useTenant';
import {
  CartProvider,
  useCart,
  calculateItemPrice,
} from '@/hooks/useCart';
import { LoadingScreen, ErrorState } from '@/components/ui';
import { PixPayment } from '@/components/PixPayment';
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
import {
  getOrCreateSessionId,
  readScopedData,
  writeScopedData,
} from '@/lib/session';

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
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [finalTotal, setFinalTotal] = useState<number | null>(null);

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
       * Primeiro tenta os dados locais do cliente,
       * escopados por sessão para não misturar dados
       * entre usuários anônimos no mesmo dispositivo.
       */
      try {
        const dados = readScopedData<DadosClienteSalvos>('dados_cliente', slug!);

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

    const dados: DadosClienteSalvos = {
      nome: nome.trim(),
      telefone: telefone.replace(/\D/g, ''),
      endereco,
      atualizadoEm:
        new Date().toISOString(),
    };

    // Save under session-scoped key so different anonymous
    // users on the same device don't overwrite each other.
    writeScopedData('dados_cliente', slug, dados);
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
       * 1. Cria ou atualiza o cliente.
       *
       * Para usuários logados, busca por auth_user_id
       * para reutilizar o registro existente.
       * Para convidados, tenta reutilizar o clienteId
       * salvo na sessão anterior deste navegador.
       */
      let clienteId: string | null = null;

      // Check if we have a previously stored client ID
      // for this session on this store.
      const dadosSalvos =
        readScopedData<DadosClienteSalvos>(
          'dados_cliente',
          slug
        );
      const clienteSalvo = (
        dadosSalvos as DadosClienteSalvos & {
          clienteId?: string;
        }
      )?.clienteId;

      if (session?.user?.id) {
        // Authenticated: try to find existing client
        const { data: existingCliente } =
          await supabase
            .from('clientes')
            .select('id')
            .eq('auth_user_id', session.user.id)
            .eq('tenant_id', tenant.id)
            .order('updated_at', {
              ascending: false,
            })
            .limit(1)
            .maybeSingle();

        if (existingCliente) {
          clienteId = existingCliente.id;

        // Update the existing record with session_id
        await supabase
          .from('clientes')
          .update({
            nome: nome.trim(),
            telefone:
              telefone.replace(/\D/g, ''),
            endereco,
            session_id: getOrCreateSessionId(),
          })
          .eq('id', clienteId);
        }
      } else if (clienteSalvo) {
        // Anonymous with previously stored ID:
        // the Supabase RLS won't allow SELECT for anon,
        // so we trust the locally stored ID and create
        // a new record if it fails.
        clienteId = clienteSalvo;
      }

      // If no existing client found, create new
      if (!clienteId) {
        const {
          data: clienteData,
          error: clienteError,
        } = await supabase
          .from('clientes')
          .insert({
            tenant_id: tenant.id,
            auth_user_id:
              session?.user?.id ?? null,
            session_id:
              getOrCreateSessionId(),
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

        clienteId = clienteData.id;
      }

      // Persist the client ID in session-scoped storage
      // so the next checkout can reuse it.
      try {
        const dadosAtualizados = {
          nome: nome.trim(),
          telefone: telefone.replace(/\D/g, ''),
          endereco,
          atualizadoEm:
            new Date().toISOString(),
          clienteId,
        };
        writeScopedData(
          'dados_cliente',
          slug,
          dadosAtualizados
        );
      } catch {
        // ignore storage errors
      }

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
       * 5. Salva o pedido ativo sob chave escopada por sessão.
       *    Também mantém o ID da sessão para verificação
       *    de propriedade na tela de acompanhamento.
       */
      try {
        const sessionId = getOrCreateSessionId();
        writeScopedData('ultimo_pedido', slug, {
          pedidoId,
          sessionId,
          createdAt:
            new Date().toISOString(),
        });
      } catch {
        // ignore storage errors
      }

      /*
       * 6. Captura o total final ANTES de limpar o carrinho.
       *    clearCart() zera o subtotal reativo, o que faria
       *    a variável local 'total' reavaliar para apenas
       *    a taxa de entrega. Salvamos em estado separado
       *    para que o PixPayment sempre receba o valor correto.
       */
      setFinalTotal(total);

      /*
       * Audit log (dev only): verifies the value chain
       * before clearing state.
       */
      if (import.meta.env.DEV) {
        console.group('%c[PIX AUDIT] Valor do pedido', 'color: #16a34a; font-weight: bold');
        console.log('subtotal:', formatCurrency(subtotal));
        console.log('taxa_entrega:', formatCurrency(taxaEntrega));
        console.log('desconto:', formatCurrency(desconto));
        console.log('total_final:', formatCurrency(total));
        console.log('forma_pagamento:', formaPagamento);
        console.assert(
          total === Math.max(0, subtotal + taxaEntrega - desconto),
          'Invariant violated: total !== subtotal + taxaEntrega - desconto'
        );
        console.assert(
          total >= subtotal,
          'Invariant violated: total < subtotal (should never be less)'
        );
        console.groupEnd();
      }

      clearCart();

      /*
       * If PIX was selected, show the PIX payment panel
       * instead of navigating away immediately.
       */
      if (formaPagamento === 'pix') {
        setCreatedOrderId(pedidoId);
        setSubmitting(false);
        return;
      }

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

  /* PIX payment after order creation */
  if (createdOrderId) {
    return (
      <div className="min-h-screen bg-[#f7f7f5]">
        <header className="sticky top-0 z-10 border-b border-line bg-white">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
            <Link
              to={`/loja/${slug}/pedido/${createdOrderId}`}
              className="-ml-2 flex h-10 w-10 items-center justify-center rounded-pill transition-colors hover:bg-surface"
              aria-label="Acompanhar pedido"
            >
              <ChevronLeft className="h-5 w-5 text-mid" />
            </Link>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dim">
                {tenant.nome}
              </p>

              <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-strong">
                Pagamento PIX
              </h1>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 space-y-5">
          <PixPayment
            orderId={createdOrderId}
            amount={finalTotal ?? 0}
            onConfirmed={() => {
              navigate(`/loja/${slug}/pedido/${createdOrderId}`);
            }}
          />

          <Link
            to={`/loja/${slug}/pedido/${createdOrderId}`}
            className="flex w-full items-center justify-center rounded-md border border-line bg-white py-3.5 text-sm font-semibold text-mid transition hover:bg-page"
          >
            Acompanhar pedido
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      <header className="sticky top-0 z-10 border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <Link
            to={`/loja/${slug}`}
            className="-ml-2 flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-surface"
            aria-label="Voltar para a loja"
          >
            <ChevronLeft className="h-5 w-5 text-mid" />
          </Link>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dim">
              {tenant.nome}
            </p>

            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-strong">
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
          <div className="flex flex-col items-center rounded-md border border-line bg-white px-6 py-10 text-center">
            <ShoppingBag className="mb-3 h-10 w-10 text-dim" />

            <p className="text-sm text-mid">
              Seu carrinho está vazio.
            </p>

            <Link
              to={`/loja/${slug}`}
              className="mt-5 rounded-pill bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Ver cardápio
            </Link>
          </div>
        )}

        {/* Customer */}
        <div className="space-y-4 rounded-md border border-line bg-white p-5 sm:p-6">
          <div>
            <h2 className="text-base font-semibold text-strong">
              Seus dados
            </h2>

            <p className="mt-1 text-sm text-mid">
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
        <div className="space-y-4 rounded-md border border-line bg-white p-5 sm:p-6">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-strong">
              <MapPin className="h-4 w-4 text-primary-500" />
              Endereço de entrega
            </h2>

            <p className="mt-1 text-sm text-mid">
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
              <p className="mt-1 flex items-center gap-1 text-xs text-dim">
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
        <div className="space-y-4 rounded-md border border-line bg-white p-5 sm:p-6">
          <h2 className="text-base font-semibold text-strong">
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
                className={`rounded-md px-3 py-3 text-sm font-medium transition-all ${
                  formaPagamento === forma
                    ? 'bg-neutral-900 text-white'
                    : 'bg-surface text-mid hover:border-strong'
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
        <div className="space-y-3 rounded-md border border-line bg-white p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-strong">
            <Tag className="h-4 w-4 text-primary-500" />
            Cupom de desconto
          </h2>

          <div className="relative">
            <input
              className="input pr-11 uppercase rounded-md"
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
        <div className="space-y-3 rounded-md border border-line bg-white p-5 sm:p-6">
          <h2 className="text-base font-semibold text-strong">
            Resumo do pedido
          </h2>

          {items.length > 0 && (
            <div className="space-y-2 border-b border-line pb-3">
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
                    <span className="text-mid">
                      {item.quantidade}x{' '}
                      {item.nome}
                    </span>

                    <span className="shrink-0 font-medium text-strong">
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
            <span className="text-mid">
              Subtotal
            </span>

            <span className="font-medium text-strong">
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
            <span className="text-mid">
              Taxa de entrega
            </span>

            <span className="font-medium text-strong">
              {formatCurrency(taxaEntrega)}
            </span>
          </div>

          <div className="flex justify-between border-t border-line pt-3 text-lg font-semibold">
            <span>Total</span>

            <span className="text-strong">
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        {/* Error */}
        {submitError && (
          <div className="rounded-md border border-rose-100 bg-rose-50 p-5">
            <p className="text-sm text-error-700">
              {submitError}
            </p>
          </div>
        )}

        {/* Submit — fixed at bottom on mobile */}
        {items.length > 0 && (
          <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-raised px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:mx-0 sm:rounded-md sm:border sm:sticky sm:bottom-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-neutral-900 py-3.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 sm:py-4 sm:text-base"
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
          </div>
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
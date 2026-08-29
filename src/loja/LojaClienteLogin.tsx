import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  Loader2,
  Store,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';

export default function LojaClienteLogin() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { tenant } = useTenant(slug);

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result =
      mode === 'login'
        ? await signIn(email, password)
        : await signUp(email, password);

    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    navigate(-1);
  }

  const isLogin = mode === 'login';

  return (
    <div className="min-h-screen bg-[#f6f6f4] text-neutral-950">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-5 sm:px-6 sm:py-8">
        {/* Header */}
        <header className="flex items-center justify-between">
          <Link
            to={slug ? `/loja/${slug}` : '/'}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar para a loja
          </Link>

          <span className="hidden text-xs font-medium uppercase tracking-[0.14em] text-neutral-400 sm:block">
            Área do cliente
          </span>
        </header>

        {/* Content */}
        <main className="flex flex-1 items-center justify-center py-8 sm:py-12">
          <div className="grid w-full max-w-5xl gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            {/* Brand panel */}
            <section className="relative hidden min-h-[620px] overflow-hidden rounded-2xl bg-neutral-950 lg:block">
              {tenant?.banner_url ? (
                <img
                  src={tenant.banner_url}
                  alt={tenant.nome}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_#404040,_#18181b_50%,_#09090b_100%)]" />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />

              <div className="relative flex h-full min-h-[620px] flex-col justify-between p-8 xl:p-10">
                <div className="flex items-center gap-3">
                  {tenant?.logo_url ? (
                    <img
                      src={tenant.logo_url}
                      alt={tenant.nome}
                      className="h-12 w-12 rounded-2xl border border-white/20 object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white">
                      <Store className="h-5 w-5" />
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-semibold text-white">
                      {tenant?.nome ?? 'Loja'}
                    </p>

                    <p className="mt-0.5 text-xs text-white/55">
                      Pedidos online
                    </p>
                  </div>
                </div>

                <div className="max-w-xl">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-white/85">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Experiência segura
                  </span>

                  <h1 className="mt-5 text-4xl font-semibold leading-[0.98] tracking-[-0.04em] text-white xl:text-5xl">
                    Seus próximos pedidos começam aqui.
                  </h1>

                  <p className="mt-4 max-w-lg text-sm leading-6 text-white/70">
                    Entre para facilitar suas próximas compras e ter uma
                    experiência mais rápida no pedido.
                  </p>
                </div>
              </div>
            </section>

            {/* Form */}
            <section className="flex min-h-[620px] flex-col justify-center rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-8 xl:p-10">
              {/* Mobile brand */}
              <div className="mb-8 flex items-center gap-3 lg:hidden">
                {tenant?.logo_url ? (
                  <img
                    src={tenant.logo_url}
                    alt={tenant.nome}
                    className="h-12 w-12 rounded-2xl object-cover ring-1 ring-black/5"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-950 text-white">
                    <Store className="h-5 w-5" />
                  </div>
                )}

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-950">
                    {tenant?.nome ?? 'Loja'}
                  </p>

                  <p className="mt-0.5 text-xs text-neutral-400">
                    Pedidos online
                  </p>
                </div>
              </div>

              <div className="max-w-md">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
                  {isLogin ? 'Bem-vindo de volta' : 'Novo cadastro'}
                </p>

                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-neutral-950 sm:text-4xl">
                  {isLogin
                    ? 'Entre na sua conta'
                    : 'Crie sua conta'}
                </h2>

                <p className="mt-3 text-sm leading-6 text-neutral-500">
                  {isLogin
                    ? 'Acesse sua conta para agilizar seus próximos pedidos.'
                    : 'Crie sua conta para salvar seus dados e facilitar as próximas compras.'}
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="mt-8 max-w-md space-y-5"
              >
                <div>
                  <label
                    htmlFor="email"
                    className="label"
                  >
                    E-mail
                  </label>

                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) =>
                      setEmail(e.target.value)
                    }
                    placeholder="voce@exemplo.com"
                    autoComplete="email"
                    className="input h-12 rounded-card"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <label
                      htmlFor="password"
                      className="label !mb-0"
                    >
                      Senha
                    </label>

                    <span className="text-xs text-neutral-400">
                      Mínimo recomendado: 8 caracteres
                    </span>
                  </div>

                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    placeholder="••••••••"
                    autoComplete={
                      isLogin
                        ? 'current-password'
                        : 'new-password'
                    }
                    className="input h-12 rounded-card"
                  />
                </div>

                {error && (
                  <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3.5">
                    <p className="text-sm leading-5 text-rose-700">
                      {error}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-card bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}

                  {submitting
                    ? 'Aguarde...'
                    : isLogin
                    ? 'Entrar'
                    : 'Criar conta'}
                </button>

                <div className="rounded-2xl bg-neutral-50 px-4 py-3.5">
                  <p className="text-center text-xs leading-5 text-neutral-500">
                    Você também pode fazer seu pedido como convidado, sem
                    criar uma conta.
                  </p>
                </div>
              </form>

              <div className="mt-7 max-w-md border-t border-neutral-100 pt-6 text-center">
                {isLogin ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMode('signup');
                    }}
                    className="text-sm font-semibold text-neutral-900 transition hover:text-primary-600"
                  >
                    Ainda não tem conta?{' '}
                    <span className="underline underline-offset-4">
                      Criar agora
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMode('login');
                    }}
                    className="text-sm font-semibold text-neutral-900 transition hover:text-primary-600"
                  >
                    Já tem conta?{' '}
                    <span className="underline underline-offset-4">
                      Entrar
                    </span>
                  </button>
                )}
              </div>
            </section>
          </div>
        </main>

        <footer className="pb-2 text-center text-xs text-neutral-400">
          Uma experiência de pedidos simples, moderna e segura.
        </footer>
      </div>
    </div>
  );
}
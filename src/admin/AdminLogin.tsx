import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Store, Mail, Lock, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function AdminLogin() {
  const { signIn } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await signIn(email, password);
    setSubmitting(false);
    if (signInError) {
      setError(signInError);
      return;
    }
    navigate(`/admin/${slug ?? ''}`);
  }

  return (
    <div className="dark-admin min-h-screen flex items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex w-10 h-10 rounded-md bg-primary-600 items-center justify-center mb-3">
            <Store className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-base font-semibold text-strong">Acessar painel</h1>
          <p className="mt-0.5 text-sm text-mid">Entre com suas credenciais de equipe</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-4 space-y-3">
          <div>
            <label htmlFor="email" className="label">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className="input pl-9"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="label">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input pl-9"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-error-500 bg-error-500/10 rounded-md px-3 py-2">{error}</p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link to={`/admin/${slug}`} className="text-xs text-dim hover:text-mid transition-colors">
            ← Voltar
          </Link>
        </div>
      </div>
    </div>
  );
}

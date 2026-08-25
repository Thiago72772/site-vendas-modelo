import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, ArrowRight } from 'lucide-react';

export default function AdminSlugEntry() {
  const navigate = useNavigate();
  const [slug, setSlug] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (slug.trim()) {
      navigate(`/admin/${slug.trim().toLowerCase()}/login`);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-primary-600 items-center justify-center mb-4">
            <Store className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-neutral-900">Acessar painel</h1>
          <p className="mt-1 text-sm text-neutral-500">Digite o identificador da sua loja</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label htmlFor="slug" className="label">Identificador da loja (slug)</label>
            <input
              id="slug"
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="minha-loja"
              className="input"
              autoFocus
            />
          </div>
          <button type="submit" className="btn-primary w-full">
            Continuar
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

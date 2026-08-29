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
    <div className="dark-admin min-h-screen flex items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex w-10 h-10 rounded-md bg-primary-600 items-center justify-center mb-3">
            <Store className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-base font-semibold text-strong">Acessar painel</h1>
          <p className="mt-0.5 text-sm text-mid">Digite o identificador da sua loja</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-4 space-y-3">
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

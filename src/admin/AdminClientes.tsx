import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { supabase } from '@/lib/supabase';
import { formatPhone, formatDate } from '@/lib/format';
import type { Cliente } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Users, Search } from 'lucide-react';

export default function AdminClientes() {
  const { perfil } = useAuth();
  const tenantId = perfil?.tenant_id;
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      if (!tenantId) return;
      const { data } = await supabase
        .from('clientes')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      setClientes((data as Cliente[]) ?? []);
      setLoading(false);
    })();
  }, [tenantId]);

  const filtered = clientes.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.nome.toLowerCase().includes(q) || (c.telefone ?? '').includes(q);
  });

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold text-neutral-900 mb-1">Clientes</h1>
      <p className="text-sm text-neutral-500 mb-6">Veja e gerencie seus clientes</p>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          className="input pl-10"
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        {filtered.map((cliente) => (
          <div key={cliente.id} className="card flex items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900 truncate">{cliente.nome}</p>
              {cliente.telefone && (
                <p className="text-xs text-neutral-400">{formatPhone(cliente.telefone)}</p>
              )}
            </div>
            <span className="text-xs text-neutral-400">{formatDate(cliente.created_at)}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-neutral-400 text-center py-8">Nenhum cliente encontrado.</p>
        )}
      </div>
    </AdminLayout>
  );
}

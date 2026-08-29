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
        .from('clientes').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
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
          <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <h1 className="text-lg font-semibold text-strong mb-0.5">Clientes</h1>
      <p className="text-sm text-mid mb-5">Veja e gerencie seus clientes</p>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
        <input
          className="input pl-9"
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        {filtered.map((cliente) => (
          <div key={cliente.id} className="card flex items-center gap-2.5 py-3 px-3">
            <div className="w-8 h-8 rounded-md bg-primary-600/15 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-primary-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-strong truncate">{cliente.nome}</p>
              {cliente.telefone && (
                <p className="text-2xs text-dim">{formatPhone(cliente.telefone)}</p>
              )}
            </div>
            <span className="text-2xs text-dim">{formatDate(cliente.created_at)}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-dim text-center py-6">Nenhum cliente encontrado.</p>
        )}
      </div>
    </AdminLayout>
  );
}

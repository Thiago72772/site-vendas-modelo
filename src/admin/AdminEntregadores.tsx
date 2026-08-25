import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { supabase } from '@/lib/supabase';
import { formatPhone, maskPhone } from '@/lib/format';
import type { Entregador } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import {
  Plus,
  X,
  Pencil,
  Trash2,
  Loader2,
  Bike,
  Check,
  XCircle,
} from 'lucide-react';

export default function AdminEntregadores() {
  const { perfil } = useAuth();
  const tenantId = perfil?.tenant_id;
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Entregador | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    load();
  }, [tenantId]);

  async function load() {
    if (!tenantId) return;
    const { data } = await supabase
      .from('entregadores')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    setEntregadores((data as Entregador[]) ?? []);
    setLoading(false);
  }

  async function deleteEntregador(id: string) {
    if (!confirm('Excluir este entregador?')) return;
    await supabase.from('entregadores').delete().eq('id', id);
    load();
  }

  async function toggleAtivo(entregador: Entregador) {
    await supabase.from('entregadores').update({ ativo: !entregador.ativo }).eq('id', entregador.id);
    load();
  }

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
      <h1 className="text-2xl font-semibold text-neutral-900 mb-1">Entregadores</h1>
      <p className="text-sm text-neutral-500 mb-6">Cadastre e gerencie entregadores</p>

      <button
        onClick={() => { setEditing(null); setShowForm(true); }}
        className="btn-primary mb-4"
      >
        <Plus className="w-4 h-4" /> Novo entregador
      </button>

      <div className="space-y-3">
        {entregadores.map((entregador) => (
          <div key={entregador.id} className="card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                  <Bike className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{entregador.nome}</p>
                  {entregador.telefone && (
                    <p className="text-xs text-neutral-400">{formatPhone(entregador.telefone)}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleAtivo(entregador)} className="p-2 rounded-lg hover:bg-neutral-100">
                  {entregador.ativo ? (
                    <Check className="w-4 h-4 text-success-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-neutral-300" />
                  )}
                </button>
                <button onClick={() => { setEditing(entregador); setShowForm(true); }} className="p-2 rounded-lg hover:bg-neutral-100">
                  <Pencil className="w-4 h-4 text-neutral-400" />
                </button>
                <button onClick={() => deleteEntregador(entregador.id)} className="p-2 rounded-lg hover:bg-error-50">
                  <Trash2 className="w-4 h-4 text-error-400" />
                </button>
              </div>
            </div>
            <div className="mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${entregador.ativo ? 'bg-success-50 text-success-600' : 'bg-neutral-100 text-neutral-500'}`}>
                {entregador.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>
        ))}
        {entregadores.length === 0 && (
          <p className="text-sm text-neutral-400 text-center py-8">Nenhum entregador cadastrado.</p>
        )}
      </div>

      {showForm && (
        <EntregadorForm
          entregador={editing}
          tenantId={tenantId!}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </AdminLayout>
  );
}

function EntregadorForm({
  entregador,
  tenantId,
  onClose,
  onSaved,
}: {
  entregador: Entregador | null;
  tenantId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(entregador?.nome ?? '');
  const [telefone, setTelefone] = useState(entregador?.telefone ?? '');
  const [ativo, setAtivo] = useState(entregador?.ativo ?? true);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const payload = {
      tenant_id: tenantId,
      nome,
      telefone: telefone.replace(/\D/g, '') || null,
      ativo,
    };
    if (entregador) {
      await supabase.from('entregadores').update(payload).eq('id', entregador.id);
    } else {
      await supabase.from('entregadores').insert(payload);
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col animate-slide-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
          <h2 className="text-base font-semibold text-neutral-900">{entregador ? 'Editar entregador' : 'Novo entregador'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-100">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <div>
            <label className="label">Nome</label>
            <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Telefone</label>
            <input
              className="input"
              value={telefone}
              onChange={(e) => setTelefone(maskPhone(e.target.value))}
              placeholder="(11) 99999-9999"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm text-neutral-700">Ativo</span>
          </label>
          <button onClick={save} disabled={saving || !nome.trim()} className="btn-primary w-full">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

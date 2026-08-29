import { useState, useEffect } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { AdminLayout } from '@/components/AdminLayout';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import type { Cupom, TipoDesconto } from '@/lib/types';
import {
  Plus, X, Pencil, Trash2, Loader2, Ticket, Check, XCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function AdminCupons() {
  const { perfil } = useAuth();
  const tenantId = perfil?.tenant_id;
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Cupom | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { load(); }, [tenantId]);

  async function load() {
    if (!tenantId) return;
    const { data } = await supabase
      .from('cupons').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    setCupons((data as Cupom[]) ?? []);
    setLoading(false);
  }

  async function deleteCupom(id: string) {
    if (!confirm('Excluir este cupom?')) return;
    await supabase.from('cupons').delete().eq('id', id);
    load();
  }

  async function toggleAtivo(cupom: Cupom) {
    await supabase.from('cupons').update({ ativo: !cupom.ativo }).eq('id', cupom.id);
    load();
  }

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
      <h1 className="text-lg font-semibold text-strong mb-0.5">Cupons</h1>
      <p className="text-sm text-mid mb-5">Crie e gerencie cupons de desconto</p>

      <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary mb-3">
        <Plus className="w-4 h-4" /> Novo cupom
      </button>

      <div className="space-y-1.5">
        {cupons.map((cupom) => (
          <div key={cupom.id} className="card p-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-primary-600/15 flex items-center justify-center">
                  <Ticket className="w-4 h-4 text-primary-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-strong">{cupom.codigo}</p>
                  <p className="text-2xs text-dim">
                    {cupom.tipo_desconto === 'percentual' ? `${cupom.valor}%` : formatCurrency(cupom.valor)} de desconto
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button onClick={() => toggleAtivo(cupom)} className="p-1.5 rounded-md hover:bg-raised">
                  {cupom.ativo ? <Check className="w-4 h-4 text-success-500" /> : <XCircle className="w-4 h-4 text-dim" />}
                </button>
                <button onClick={() => { setEditing(cupom); setShowForm(true); }} className="p-1.5 rounded-md hover:bg-raised">
                  <Pencil className="w-4 h-4 text-dim" />
                </button>
                <button onClick={() => deleteCupom(cupom.id)} className="p-1.5 rounded-md hover:bg-error-500/10">
                  <Trash2 className="w-4 h-4 text-error-500" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2 text-2xs text-dim">
              <span>Uso: {cupom.uso_atual}{cupom.uso_maximo != null ? `/${cupom.uso_maximo}` : ''}</span>
              {cupom.validade_fim && (
                <span>Validade: {new Date(cupom.validade_fim).toLocaleDateString('pt-BR')}</span>
              )}
              <span className={`px-1.5 py-0.5 rounded-sm ${cupom.ativo ? 'bg-success-500/15 text-success-500' : 'bg-raised text-dim'}`}>
                {cupom.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>
        ))}
        {cupons.length === 0 && (
          <p className="text-sm text-dim text-center py-6">Nenhum cupom criado ainda.</p>
        )}
      </div>

      {showForm && (
        <CupomForm cupom={editing} tenantId={tenantId!}
          onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
    </AdminLayout>
  );
}

function CupomForm({ cupom, tenantId, onClose, onSaved }: {
  cupom: Cupom | null; tenantId: string; onClose: () => void; onSaved: () => void;
}) {
  const [codigo, setCodigo] = useState(cupom?.codigo ?? '');
  const [tipoDesconto, setTipoDesconto] = useState<TipoDesconto>(cupom?.tipo_desconto ?? 'percentual');
  const [valor, setValor] = useState(cupom ? String(cupom.valor) : '');
  const [validadeInicio, setValidadeInicio] = useState(cupom?.validade_inicio ? cupom.validade_inicio.slice(0, 10) : '');
  const [validadeFim, setValidadeFim] = useState(cupom?.validade_fim ? cupom.validade_fim.slice(0, 10) : '');
  const [usoMaximo, setUsoMaximo] = useState(cupom?.uso_maximo != null ? String(cupom.uso_maximo) : '');
  const [ativo, setAtivo] = useState(cupom?.ativo ?? true);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const payload = {
      tenant_id: tenantId, codigo: codigo.toUpperCase(), tipo_desconto: tipoDesconto,
      valor: parseFloat(valor) || 0,
      validade_inicio: validadeInicio || null,
      validade_fim: validadeFim ? new Date(validadeFim + 'T23:59:59').toISOString() : null,
      uso_maximo: usoMaximo ? parseInt(usoMaximo) : null, ativo,
    };
    if (cupom) {
      await supabase.from('cupons').update(payload).eq('id', cupom.id);
    } else {
      await supabase.from('cupons').insert({ ...payload, uso_atual: 0 });
    }
    setSaving(false);
    onSaved();
  }

  useScrollLock(true);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-surface w-full sm:max-w-md sm:rounded-lg rounded-t-lg max-h-[90vh] flex flex-col animate-slide-up shadow-elevated">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <h2 className="text-sm font-semibold text-strong">{cupom ? 'Editar cupom' : 'Novo cupom'}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-raised">
            <X className="w-4 h-4 text-dim" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
          <div>
            <label className="label">Código</label>
            <input className="input uppercase" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="EX: PROMO10" autoFocus />
          </div>
          <div>
            <label className="label">Tipo de desconto</label>
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => setTipoDesconto('percentual')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${tipoDesconto === 'percentual' ? 'bg-primary-600 text-white' : 'bg-raised text-mid hover:text-strong'}`}>
                Percentual
              </button>
              <button type="button" onClick={() => setTipoDesconto('fixo')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${tipoDesconto === 'fixo' ? 'bg-primary-600 text-white' : 'bg-raised text-mid hover:text-strong'}`}>
                Valor fixo
              </button>
            </div>
          </div>
          <div>
            <label className="label">{tipoDesconto === 'percentual' ? 'Percentual (%)' : 'Valor (R$)'}</label>
            <input className="input" type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Validade início</label>
              <input className="input" type="date" value={validadeInicio} onChange={(e) => setValidadeInicio(e.target.value)} />
            </div>
            <div>
              <label className="label">Validade fim</label>
              <input className="input" type="date" value={validadeFim} onChange={(e) => setValidadeFim(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Uso máximo (opcional)</label>
            <input className="input" type="number" value={usoMaximo} onChange={(e) => setUsoMaximo(e.target.value)} placeholder="Ilimitado se vazio" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="w-4 h-4 rounded-sm" />
            <span className="text-sm text-mid">Ativo</span>
          </label>
          <button onClick={save} disabled={saving || !codigo.trim() || !valor} className="btn-primary w-full">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

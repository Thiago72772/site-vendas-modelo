import { useState, useEffect, type FormEvent } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Tenant, HorarioDia } from '@/lib/types';
import { getDiaSemanaLabel } from '@/lib/format';
import { Loader2, Settings, Save, Check, Lock } from 'lucide-react';

const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'] as const;

export default function AdminConfiguracoes() {
  const { perfil } = useAuth();
  const tenantId = perfil?.tenant_id;
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [nome, setNome] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [corPrimaria, setCorPrimaria] = useState('');
  const [corSecundaria, setCorSecundaria] = useState('');
  const [telefoneWhatsapp, setTelefoneWhatsapp] = useState('');
  const [taxaEntregaBase, setTaxaEntregaBase] = useState('0');
  const [tempoMedioPreparo, setTempoMedioPreparo] = useState('');
  const [horarios, setHorarios] = useState<Record<string, HorarioDia>>({});

  useEffect(() => {
    (async () => {
      if (!tenantId) return;
      const { data } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .maybeSingle();
      if (data) {
        const t = data as Tenant;
        setTenant(t);
        setNome(t.nome);
        setLogoUrl(t.logo_url ?? '');
        setBannerUrl(t.banner_url ?? '');
        setCorPrimaria(t.cor_primaria ?? '');
        setCorSecundaria(t.cor_secundaria ?? '');
        setTelefoneWhatsapp(t.telefone_whatsapp ?? '');
        setTaxaEntregaBase(String(t.taxa_entrega_base));
        setTempoMedioPreparo(t.tempo_medio_preparo_min ? String(t.tempo_medio_preparo_min) : '');
        setHorarios(t.horario_funcionamento ?? {});
      }
      setLoading(false);
    })();
  }, [tenantId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const payload = {
      nome,
      logo_url: logoUrl || null,
      banner_url: bannerUrl || null,
      cor_primaria: corPrimaria || null,
      cor_secundaria: corSecundaria || null,
      telefone_whatsapp: telefoneWhatsapp || null,
      taxa_entrega_base: parseFloat(taxaEntregaBase) || 0,
      tempo_medio_preparo_min: tempoMedioPreparo ? parseInt(tempoMedioPreparo) : null,
      horario_funcionamento: horarios,
    };

    await supabase.from('tenants').update(payload).eq('id', tenantId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function updateHorario(dia: string, field: 'abre' | 'fecha', value: string) {
    setHorarios((prev) => ({
      ...prev,
      [dia]: { ...prev[dia] ?? { abre: null, fecha: null }, [field]: value || null },
    }));
  }

  const isDono = perfil?.papel === 'dono';

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (!isDono) {
    return (
      <AdminLayout>
        <h1 className="text-2xl font-semibold text-neutral-900 mb-1">Configurações</h1>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-neutral-400" />
          </div>
          <h2 className="text-lg font-semibold text-neutral-900">Acesso restrito</h2>
          <p className="mt-1 text-sm text-neutral-500 max-w-md">
            Apenas o dono da loja pode alterar as configurações.
          </p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold text-neutral-900 mb-1">Configurações</h1>
      <p className="text-sm text-neutral-500 mb-6">Personalize sua loja</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary-500" />
            Informações básicas
          </h2>
          <div>
            <label className="label">Nome da loja</label>
            <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <label className="label">Logo (URL)</label>
            <input className="input" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className="label">Banner (URL)</label>
            <input className="input" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className="label">WhatsApp</label>
            <input className="input" value={telefoneWhatsapp} onChange={(e) => setTelefoneWhatsapp(e.target.value)} placeholder="(11) 99999-9999" />
          </div>
        </div>

        {/* Branding */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-neutral-900">Cores da marca</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cor primária</label>
              <div className="flex gap-2">
                <input type="color" value={corPrimaria || '#2563eb'} onChange={(e) => setCorPrimaria(e.target.value)} className="w-12 h-10 rounded-lg border border-neutral-200" />
                <input className="input" value={corPrimaria} onChange={(e) => setCorPrimaria(e.target.value)} placeholder="#2563eb" />
              </div>
            </div>
            <div>
              <label className="label">Cor secundária</label>
              <div className="flex gap-2">
                <input type="color" value={corSecundaria || '#10b981'} onChange={(e) => setCorSecundaria(e.target.value)} className="w-12 h-10 rounded-lg border border-neutral-200" />
                <input className="input" value={corSecundaria} onChange={(e) => setCorSecundaria(e.target.value)} placeholder="#10b981" />
              </div>
            </div>
          </div>
        </div>

        {/* Delivery */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-neutral-900">Entrega</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Taxa de entrega (R$)</label>
              <input className="input" type="number" step="0.01" value={taxaEntregaBase} onChange={(e) => setTaxaEntregaBase(e.target.value)} />
            </div>
            <div>
              <label className="label">Tempo médio (min)</label>
              <input className="input" type="number" value={tempoMedioPreparo} onChange={(e) => setTempoMedioPreparo(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Opening hours */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-neutral-900">Horário de funcionamento</h2>
          <div className="space-y-2">
            {DIAS.map((dia) => {
              const h = horarios[dia] ?? { abre: null, fecha: null };
              return (
                <div key={dia} className="flex items-center gap-3">
                  <span className="text-sm text-neutral-700 w-24">{getDiaSemanaLabel(dia)}</span>
                  <input
                    type="time"
                    value={h.abre ?? ''}
                    onChange={(e) => updateHorario(dia, 'abre', e.target.value)}
                    className="input py-1.5 text-sm w-32"
                  />
                  <span className="text-neutral-400 text-sm">até</span>
                  <input
                    type="time"
                    value={h.fecha ?? ''}
                    onChange={(e) => updateHorario(dia, 'fecha', e.target.value)}
                    className="input py-1.5 text-sm w-32"
                  />
                  {!h.abre && !h.fecha && <span className="text-xs text-neutral-400">Fechado</span>}
                </div>
              );
            })}
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar configurações'}
        </button>
      </form>
    </AdminLayout>
  );
}

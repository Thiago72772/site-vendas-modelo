import { useState, useEffect, type DragEvent } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useAuth, canEditMenu } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import type { Categoria, Produto, GrupoAdicional, Adicional } from '@/lib/types';
import {
  Plus,
  X,
  Pencil,
  Trash2,
  GripVertical,
  Loader2,
  UtensilsCrossed,
  Package,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

type Tab = 'produtos' | 'categorias';

export default function AdminCardapio() {
  const { perfil } = useAuth();
  const canEdit = canEditMenu(perfil?.papel);
  const [tab, setTab] = useState<Tab>('produtos');

  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold text-neutral-900 mb-1">Cardápio</h1>
      <p className="text-sm text-neutral-500 mb-6">Gerencie produtos, categorias e adicionais</p>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('produtos')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            tab === 'produtos' ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-600'
          }`}
        >
          Produtos
        </button>
        <button
          onClick={() => setTab('categorias')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            tab === 'categorias' ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-600'
          }`}
        >
          Categorias
        </button>
      </div>

      {tab === 'produtos' ? <ProdutosTab canEdit={canEdit} /> : <CategoriasTab canEdit={canEdit} />}
    </AdminLayout>
  );
}

// ============ CATEGORIAS TAB ============

function CategoriasTab({ canEdit }: { canEdit: boolean }) {
  const { perfil } = useAuth();
  const tenantId = perfil?.tenant_id;
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Categoria | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [tenantId]);

  async function load() {
    if (!tenantId) return;
    const { data } = await supabase
      .from('categorias')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('ordem');
    setCategorias((data as Categoria[]) ?? []);
    setLoading(false);
  }

  function handleDragStart(e: DragEvent, id: string) {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
  }

  async function handleDrop(e: DragEvent, targetId: string) {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const reordered = [...categorias];
    const fromIdx = reordered.findIndex((c) => c.id === draggedId);
    const toIdx = reordered.findIndex((c) => c.id === targetId);
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    // Update ordem for all
    const updates = reordered.map((c, i) => ({ id: c.id, ordem: i }));
    setCategorias(reordered.map((c, i) => ({ ...c, ordem: i })));

    for (const u of updates) {
      await supabase.from('categorias').update({ ordem: u.ordem }).eq('id', u.id);
    }
    setDraggedId(null);
  }

  async function deleteCategoria(id: string) {
    if (!confirm('Excluir esta categoria? Os produtos nela também serão excluídos.')) return;
    await supabase.from('categorias').delete().eq('id', id);
    load();
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {canEdit && (
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="btn-primary mb-4"
        >
          <Plus className="w-4 h-4" /> Nova categoria
        </button>
      )}

      <div className="space-y-2">
        {categorias.map((cat) => (
          <div
            key={cat.id}
            draggable={canEdit}
            onDragStart={(e) => handleDragStart(e, cat.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, cat.id)}
            className="card flex items-center gap-3 py-4"
          >
            {canEdit && <GripVertical className="w-4 h-4 text-neutral-300 cursor-grab" />}
            <span className="text-sm text-neutral-400 w-6">{cat.ordem + 1}</span>
            <span className="flex-1 text-sm font-medium text-neutral-900">{cat.nome}</span>
            {canEdit && (
              <div className="flex gap-1">
                <button
                  onClick={() => { setEditing(cat); setShowForm(true); }}
                  className="p-2 rounded-lg hover:bg-neutral-100"
                >
                  <Pencil className="w-4 h-4 text-neutral-400" />
                </button>
                <button
                  onClick={() => deleteCategoria(cat.id)}
                  className="p-2 rounded-lg hover:bg-error-50"
                >
                  <Trash2 className="w-4 h-4 text-error-400" />
                </button>
              </div>
            )}
          </div>
        ))}
        {categorias.length === 0 && (
          <p className="text-sm text-neutral-400 text-center py-8">Nenhuma categoria ainda.</p>
        )}
      </div>

      {showForm && (
        <CategoriaForm
          categoria={editing}
          tenantId={tenantId!}
          ordemMax={categorias.length}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function CategoriaForm({
  categoria,
  tenantId,
  ordemMax,
  onClose,
  onSaved,
}: {
  categoria: Categoria | null;
  tenantId: string;
  ordemMax: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(categoria?.nome ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    if (categoria) {
      await supabase.from('categorias').update({ nome }).eq('id', categoria.id);
    } else {
      await supabase.from('categorias').insert({ tenant_id: tenantId, nome, ordem: ordemMax });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <Modal title={categoria ? 'Editar categoria' : 'Nova categoria'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Nome</label>
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Pizzas" autoFocus />
        </div>
        <button onClick={save} disabled={saving || !nome.trim()} className="btn-primary w-full">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </Modal>
  );
}

// ============ PRODUTOS TAB ============

function ProdutosTab({ canEdit }: { canEdit: boolean }) {
  const { perfil } = useAuth();
  const tenantId = perfil?.tenant_id;
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedProduto, setExpandedProduto] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [tenantId]);

  async function load() {
    if (!tenantId) return;
    const [prodRes, catRes] = await Promise.all([
      supabase.from('produtos').select('*').eq('tenant_id', tenantId).order('ordem'),
      supabase.from('categorias').select('*').eq('tenant_id', tenantId).order('ordem'),
    ]);
    setProdutos((prodRes.data as Produto[]) ?? []);
    setCategorias((catRes.data as Categoria[]) ?? []);
    setLoading(false);
  }

  async function toggleDisponivel(produto: Produto) {
    if (!canEdit) return;
    await supabase.from('produtos').update({ disponivel: !produto.disponivel }).eq('id', produto.id);
    load();
  }

  async function deleteProduto(id: string) {
    if (!confirm('Excluir este produto?')) return;
    await supabase.from('produtos').delete().eq('id', id);
    load();
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {canEdit && (
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="btn-primary mb-4"
        >
          <Plus className="w-4 h-4" /> Novo produto
        </button>
      )}

      {categorias.length === 0 ? (
        <p className="text-sm text-neutral-400 text-center py-8">
          Crie uma categoria primeiro na aba Categorias.
        </p>
      ) : (
        <div className="space-y-3">
          {produtos.map((produto) => {
            const cat = categorias.find((c) => c.id === produto.categoria_id);
            const isExpanded = expandedProduto === produto.id;
            return (
              <div key={produto.id} className="card overflow-hidden">
                <div className="flex items-center gap-3">
                  {produto.imagem_url ? (
                    <img src={produto.imagem_url} alt={produto.nome} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                      <ImageIcon className="w-5 h-5 text-neutral-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{produto.nome}</p>
                    <p className="text-xs text-neutral-400">
                      {cat?.nome ?? 'Sem categoria'} · {formatCurrency(produto.preco)}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleDisponivel(produto)}
                    disabled={!canEdit}
                    title={produto.disponivel ? 'Disponível' : 'Indisponível'}
                  >
                    {produto.disponivel ? (
                      <ToggleRight className="w-7 h-7 text-success-500" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-neutral-300" />
                    )}
                  </button>
                  <button
                    onClick={() => setExpandedProduto(isExpanded ? null : produto.id)}
                    className="p-2 rounded-lg hover:bg-neutral-100"
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-neutral-400" /> : <ChevronRight className="w-4 h-4 text-neutral-400" />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-neutral-100">
                    <AdicionaisSection produto={produto} canEdit={canEdit} />
                  </div>
                )}

                {canEdit && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-neutral-100">
                    <button
                      onClick={() => { setEditing(produto); setShowForm(true); }}
                      className="btn-ghost text-xs"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => deleteProduto(produto.id)}
                      className="btn-ghost text-xs text-error-500 hover:bg-error-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {produtos.length === 0 && (
            <p className="text-sm text-neutral-400 text-center py-8">Nenhum produto ainda.</p>
          )}
        </div>
      )}

      {showForm && (
        <ProdutoForm
          produto={editing}
          tenantId={tenantId!}
          categorias={categorias}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function ProdutoForm({
  produto,
  tenantId,
  categorias,
  onClose,
  onSaved,
}: {
  produto: Produto | null;
  tenantId: string;
  categorias: Categoria[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(produto?.nome ?? '');
  const [descricao, setDescricao] = useState(produto?.descricao ?? '');
  const [preco, setPreco] = useState(produto ? String(produto.preco) : '');
  const [categoriaId, setCategoriaId] = useState(produto?.categoria_id ?? categorias[0]?.id ?? '');
  const [disponivel, setDisponivel] = useState(produto?.disponivel ?? true);
  const [imagemUrl, setImagemUrl] = useState(produto?.imagem_url ?? '');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const ext = file.name.split('.').pop();
    const path = `${tenantId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('produtos').upload(path, file);
    if (error) {
      setUploadError('Falha ao enviar imagem. Verifique se o bucket "produtos" foi criado.');
    } else {
      const { data } = supabase.storage.from('produtos').getPublicUrl(path);
      setImagemUrl(data.publicUrl);
    }
    setUploading(false);
  }

  async function save() {
    setSaving(true);
    const payload = {
      tenant_id: tenantId,
      categoria_id: categoriaId,
      nome,
      descricao: descricao || null,
      preco: parseFloat(preco) || 0,
      imagem_url: imagemUrl || null,
      disponivel,
    };
    if (produto) {
      await supabase.from('produtos').update(payload).eq('id', produto.id);
    } else {
      await supabase.from('produtos').insert({ ...payload, ordem: 0 });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <Modal title={produto ? 'Editar produto' : 'Novo produto'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Nome</label>
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">Descrição</label>
          <textarea className="input" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Preço (R$)</label>
            <input className="input" type="number" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} />
          </div>
          <div>
            <label className="label">Categoria</label>
            <select className="input" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Imagem do produto</label>
          {imagemUrl && (
            <img src={imagemUrl} alt="Preview" className="w-20 h-20 rounded-lg object-cover mb-2" />
          )}
          <input type="file" accept="image/*" onChange={handleUpload} className="text-sm text-neutral-500" />
          {uploading && <p className="text-xs text-neutral-400 mt-1">Enviando...</p>}
          {uploadError && <p className="text-xs text-error-500 mt-1">{uploadError}</p>}
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={disponivel} onChange={(e) => setDisponivel(e.target.checked)} className="w-4 h-4 rounded" />
          <span className="text-sm text-neutral-700">Disponível para venda</span>
        </label>
        <button onClick={save} disabled={saving || !nome.trim() || !categoriaId} className="btn-primary w-full">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </Modal>
  );
}

// ============ ADICIONAIS SECTION ============

function AdicionaisSection({ produto, canEdit }: { produto: Produto; canEdit: boolean }) {
  const [grupos, setGrupos] = useState<(GrupoAdicional & { adicionais: Adicional[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGrupoForm, setShowGrupoForm] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState<GrupoAdicional | null>(null);
  const [showAdicionalForm, setShowAdicionalForm] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [produto.id]);

  async function load() {
    const { data: gruposData } = await supabase
      .from('grupos_adicionais')
      .select('*')
      .eq('produto_id', produto.id)
      .order('created_at');

    if (!gruposData || gruposData.length === 0) {
      setGrupos([]);
      setLoading(false);
      return;
    }

    const grupoIds = gruposData.map((g) => g.id);
    const { data: adicionaisData } = await supabase
      .from('adicionais')
      .select('*')
      .in('grupo_adicional_id', grupoIds)
      .order('created_at');

    const porGrupo: Record<string, Adicional[]> = {};
    (adicionaisData ?? []).forEach((a) => {
      const gid = (a as Adicional).grupo_adicional_id;
      if (!porGrupo[gid]) porGrupo[gid] = [];
      porGrupo[gid].push(a as Adicional);
    });

    setGrupos(
      (gruposData as GrupoAdicional[]).map((g) => ({
        ...g,
        adicionais: porGrupo[g.id] ?? [],
      }))
    );
    setLoading(false);
  }

  async function deleteGrupo(id: string) {
    if (!confirm('Excluir este grupo e todos os seus adicionais?')) return;
    await supabase.from('grupos_adicionais').delete().eq('id', id);
    load();
  }

  async function deleteAdicional(id: string) {
    await supabase.from('adicionais').delete().eq('id', id);
    load();
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-neutral-500 uppercase">Grupos de adicionais</h4>
        {canEdit && (
          <button
            onClick={() => { setEditingGrupo(null); setShowGrupoForm(true); }}
            className="text-xs text-primary-600 font-medium hover:underline"
          >
            + Novo grupo
          </button>
        )}
      </div>

      <div className="space-y-2">
        {grupos.map((grupo) => (
          <div key={grupo.id} className="rounded-xl bg-neutral-50 p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-neutral-900">{grupo.nome}</p>
                <p className="text-xs text-neutral-400">
                  {grupo.obrigatorio ? 'Obrigatório' : 'Opcional'}
                  {grupo.max_selecao > 1 && ` · Máx ${grupo.max_selecao}`}
                </p>
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <button onClick={() => { setEditingGrupo(grupo); setShowGrupoForm(true); }} className="p-1.5 rounded-lg hover:bg-white">
                    <Pencil className="w-3.5 h-3.5 text-neutral-400" />
                  </button>
                  <button onClick={() => deleteGrupo(grupo.id)} className="p-1.5 rounded-lg hover:bg-white">
                    <Trash2 className="w-3.5 h-3.5 text-error-400" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-1">
              {grupo.adicionais.map((adc) => (
                <div key={adc.id} className="flex items-center justify-between text-sm pl-2">
                  <span className="text-neutral-700">{adc.nome}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-500">+ {formatCurrency(adc.preco_extra)}</span>
                    {canEdit && (
                      <button onClick={() => deleteAdicional(adc.id)} className="p-1 rounded hover:bg-white">
                        <Trash2 className="w-3 h-3 text-error-400" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {grupo.adicionais.length === 0 && (
                <p className="text-xs text-neutral-300 pl-2">Nenhum adicional.</p>
              )}
            </div>

            {canEdit && (
              <button
                onClick={() => setShowAdicionalForm(grupo.id)}
                className="text-xs text-primary-600 font-medium mt-2 hover:underline"
              >
                + Adicional
              </button>
            )}
          </div>
        ))}
        {grupos.length === 0 && (
          <p className="text-xs text-neutral-400 text-center py-4">Nenhum grupo de adicionais.</p>
        )}
      </div>

      {showGrupoForm && (
        <GrupoForm
          grupo={editingGrupo}
          produtoId={produto.id}
          tenantId={produto.tenant_id}
          onClose={() => setShowGrupoForm(false)}
          onSaved={() => { setShowGrupoForm(false); load(); }}
        />
      )}

      {showAdicionalForm && (
        <AdicionalForm
          grupoId={showAdicionalForm}
          onClose={() => setShowAdicionalForm(null)}
          onSaved={() => { setShowAdicionalForm(null); load(); }}
        />
      )}
    </div>
  );
}

function GrupoForm({
  grupo,
  produtoId,
  tenantId,
  onClose,
  onSaved,
}: {
  grupo: GrupoAdicional | null;
  produtoId: string;
  tenantId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(grupo?.nome ?? '');
  const [obrigatorio, setObrigatorio] = useState(grupo?.obrigatorio ?? false);
  const [maxSelecao, setMaxSelecao] = useState(grupo ? String(grupo.max_selecao) : '1');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const payload = {
      produto_id: produtoId,
      tenant_id: tenantId,
      nome,
      obrigatorio,
      max_selecao: parseInt(maxSelecao) || 1,
    };
    if (grupo) {
      await supabase.from('grupos_adicionais').update(payload).eq('id', grupo.id);
    } else {
      await supabase.from('grupos_adicionais').insert(payload);
    }
    setSaving(false);
    onSaved();
  }

  return (
    <Modal title={grupo ? 'Editar grupo' : 'Novo grupo'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Nome do grupo</label>
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Tamanho" autoFocus />
        </div>
        <div>
          <label className="label">Máximo de seleção</label>
          <input className="input" type="number" min={1} value={maxSelecao} onChange={(e) => setMaxSelecao(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={obrigatorio} onChange={(e) => setObrigatorio(e.target.checked)} className="w-4 h-4 rounded" />
          <span className="text-sm text-neutral-700">Obrigatório</span>
        </label>
        <button onClick={save} disabled={saving || !nome.trim()} className="btn-primary w-full">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </Modal>
  );
}

function AdicionalForm({
  grupoId,
  onClose,
  onSaved,
}: {
  grupoId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState('');
  const [precoExtra, setPrecoExtra] = useState('0');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await supabase.from('adicionais').insert({
      grupo_adicional_id: grupoId,
      nome,
      preco_extra: parseFloat(precoExtra) || 0,
    });
    setSaving(false);
    onSaved();
  }

  return (
    <Modal title="Novo adicional" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Nome</label>
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Borda recheada" autoFocus />
        </div>
        <div>
          <label className="label">Preço extra (R$)</label>
          <input className="input" type="number" step="0.01" value={precoExtra} onChange={(e) => setPrecoExtra(e.target.value)} />
        </div>
        <button onClick={save} disabled={saving || !nome.trim()} className="btn-primary w-full">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </Modal>
  );
}

// ============ SHARED ============

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col animate-slide-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
          <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-100">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
    </div>
  );
}

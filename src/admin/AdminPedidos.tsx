import { useState, useEffect, useCallback, type DragEvent } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useAuth, canEditOrders } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, formatPhone } from '@/lib/format';
import {
  STATUS_PEDIDO_LABELS,
  FORMA_PAGAMENTO_LABELS,
} from '@/lib/types';
import type { Pedido, StatusPedido, Entregador, ItemPedido, Cliente } from '@/lib/types';
import {
  X,
  Clock,
  MapPin,
  CreditCard,
  StickyNote,
  Bike,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface PedidoWithRelations extends Pedido {
  clientes: Cliente | null;
  itens_pedido: ItemPedidoWithProduto[];
}

interface ItemPedidoWithProduto extends ItemPedido {
  produtos: { nome: string } | null;
}

const COLUMNS: { status: StatusPedido; label: string; color: string }[] = [
  { status: 'recebido', label: 'Recebido', color: 'bg-blue-50 text-blue-700' },
  { status: 'preparo', label: 'Em preparo', color: 'bg-amber-50 text-amber-700' },
  { status: 'saiu_entrega', label: 'Saiu para entrega', color: 'bg-purple-50 text-purple-700' },
  { status: 'entregue', label: 'Entregue', color: 'bg-green-50 text-green-700' },
  { status: 'cancelado', label: 'Cancelado', color: 'bg-red-50 text-red-700' },
];

export default function AdminPedidos() {
  const { perfil } = useAuth();
  const tenantId = perfil?.tenant_id;
  const papel = perfil?.papel;
  const canEdit = canEditOrders(papel);
  const isEntregador = papel === 'entregador';
  const isCozinha = papel === 'cozinha';

  const [pedidos, setPedidos] = useState<PedidoWithRelations[]>([]);
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [entregadorId, setEntregadorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [selectedPedido, setSelectedPedido] = useState<PedidoWithRelations | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!isEntregador || !tenantId || !perfil) return;
    (async () => {
      const { data } = await supabase
        .from('entregadores')
        .select('id')
        .eq('tenant_id', tenantId)
        .ilike('nome', perfil.nome)
        .limit(1);
      setEntregadorId((data?.[0] as { id: string } | undefined)?.id ?? null);
    })();
  }, [isEntregador, tenantId, perfil]);

  const loadPedidos = useCallback(async () => {
    if (!tenantId) return;
    let query = supabase
      .from('pedidos')
      .select('*, clientes(*), itens_pedido(*, produtos(nome))')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (isEntregador && entregadorId) {
      query = query.eq('entregador_id', entregadorId);
    } else if (isEntregador && !entregadorId) {
      setPedidos([]);
      setLoading(false);
      return;
    }

    const { data } = await query;
    if (data) {
      setPedidos((prev) => {
        const novos = (data as PedidoWithRelations[]).filter(
          (p) => !prev.some((prevP) => prevP.id === p.id)
        );
        if (novos.length > 0 && prev.length > 0) {
          setNewIds(new Set(novos.map((p) => p.id)));
          setTimeout(() => setNewIds(new Set()), 3000);
        }
        return data as PedidoWithRelations[];
      });
    }
    setLoading(false);
  }, [tenantId, isEntregador, entregadorId]);

  useEffect(() => {
    loadPedidos();

    const channel = supabase
      .channel('admin-pedidos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos', filter: `tenant_id=eq.${tenantId}` },
        () => loadPedidos()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      const { data } = await supabase
        .from('entregadores')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('ativo', true);
      setEntregadores((data as Entregador[]) ?? []);
    })();
  }, [tenantId]);

  async function updateStatus(pedidoId: string, newStatus: StatusPedido) {
    setUpdating(true);
    await supabase.from('pedidos').update({ status: newStatus }).eq('id', pedidoId);
    setUpdating(false);
    loadPedidos();
  }

  async function assignEntregador(pedidoId: string, entregadorId: string | null) {
    await supabase.from('pedidos').update({ entregador_id: entregadorId }).eq('id', pedidoId);
    loadPedidos();
    if (selectedPedido) {
      setSelectedPedido({ ...selectedPedido, entregador_id: entregadorId });
    }
  }

  function handleDragStart(e: DragEvent, pedidoId: string) {
    if (!canEdit) return;
    setDraggedId(pedidoId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: DragEvent, colStatus: string) {
    if (!canEdit) return;
    e.preventDefault();
    setDragOverCol(colStatus);
  }

  async function handleDrop(e: DragEvent, colStatus: StatusPedido) {
    e.preventDefault();
    setDragOverCol(null);
    if (!draggedId || !canEdit) return;
    await updateStatus(draggedId, colStatus);
    setDraggedId(null);
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
      <h1 className="text-2xl font-semibold text-neutral-900 mb-1">Pedidos</h1>
      <p className="text-sm text-neutral-500 mb-6">
        {isCozinha ? 'Acompanhamento de pedidos (somente leitura)' : 'Arraste cards entre colunas para alterar status'}
      </p>

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {COLUMNS.map((col) => {
          const colPedidos = pedidos.filter((p) => p.status === col.status);
          const isDragOver = dragOverCol === col.status;

          return (
            <div
              key={col.status}
              className="w-72 shrink-0"
              onDragOver={(e) => handleDragOver(e, col.status)}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={(e) => handleDrop(e, col.status)}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${col.color}`}>
                    {col.label}
                  </span>
                </div>
                <span className="text-xs text-neutral-400">{colPedidos.length}</span>
              </div>

              <div
                className={`space-y-2 min-h-[200px] rounded-xl p-2 transition-colors ${
                  isDragOver ? 'bg-primary-50 border-2 border-dashed border-primary-300' : 'bg-neutral-100/50'
                }`}
              >
                {colPedidos.map((pedido) => {
                  const isNew = newIds.has(pedido.id);
                  return (
                    <div
                      key={pedido.id}
                      draggable={canEdit}
                      onDragStart={(e) => handleDragStart(e, pedido.id)}
                      onClick={() => setSelectedPedido(pedido)}
                      className={`bg-white rounded-lg shadow-card p-3 cursor-pointer hover:shadow-soft transition-all duration-200 ${
                        canEdit ? 'cursor-grab active:cursor-grabbing' : ''
                      } ${isNew ? 'animate-pulse-once ring-2 ring-primary-400' : ''} ${
                        draggedId === pedido.id ? 'opacity-40' : ''
                      }`}
                    >
                      {isNew && (
                        <div className="flex items-center gap-1 mb-1">
                          <Sparkles className="w-3 h-3 text-primary-500" />
                          <span className="text-xs font-medium text-primary-600">Novo</span>
                        </div>
                      )}
                      <p className="text-sm font-medium text-neutral-900 truncate">
                        {pedido.clientes?.nome ?? 'Cliente'}
                      </p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {new Date(pedido.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-neutral-500">
                          {pedido.itens_pedido?.length ?? 0} {pedido.itens_pedido?.length === 1 ? 'item' : 'itens'}
                        </span>
                        <span className="text-sm font-semibold text-neutral-900">
                          {formatCurrency(Number(pedido.total))}
                        </span>
                      </div>
                      {pedido.entregador_id && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-neutral-400">
                          <Bike className="w-3 h-3" />
                          {entregadores.find((e) => e.id === pedido.entregador_id)?.nome ?? 'Entregador'}
                        </div>
                      )}
                    </div>
                  );
                })}
                {colPedidos.length === 0 && (
                  <p className="text-xs text-neutral-300 text-center py-8">Vazio</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail modal */}
      {selectedPedido && (
        <PedidoDetailModal
          pedido={selectedPedido}
          entregadores={entregadores}
          onClose={() => setSelectedPedido(null)}
          onAssign={assignEntregador}
          onStatusChange={updateStatus}
          canEdit={canEdit}
          updating={updating}
        />
      )}
    </AdminLayout>
  );
}

function PedidoDetailModal({
  pedido,
  entregadores,
  onClose,
  onAssign,
  onStatusChange,
  canEdit,
  updating,
}: {
  pedido: PedidoWithRelations;
  entregadores: Entregador[];
  onClose: () => void;
  onAssign: (pedidoId: string, entregadorId: string | null) => void;
  onStatusChange: (pedidoId: string, status: StatusPedido) => void;
  canEdit: boolean;
  updating: boolean;
}) {
  const end = pedido.endereco_entrega;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col animate-slide-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
          <h2 className="text-base font-semibold text-neutral-900">Pedido #{pedido.id.slice(0, 8)}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-100">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Status */}
          <div>
            <p className="text-xs text-neutral-400 mb-1">Status atual</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium px-3 py-1.5 rounded-full bg-primary-50 text-primary-700">
                {STATUS_PEDIDO_LABELS[pedido.status]}
              </span>
              {canEdit && (
                <select
                  value={pedido.status}
                  onChange={(e) => onStatusChange(pedido.id, e.target.value as StatusPedido)}
                  disabled={updating}
                  className="input py-1.5 text-sm w-auto"
                >
                  {COLUMNS.map((c) => (
                    <option key={c.status} value={c.status}>{c.label}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Customer */}
          <div>
            <p className="text-xs text-neutral-400 mb-1">Cliente</p>
            <p className="text-sm font-medium text-neutral-900">{pedido.clientes?.nome ?? 'N/A'}</p>
            {pedido.clientes?.telefone && (
              <p className="text-sm text-neutral-500">{formatPhone(pedido.clientes.telefone)}</p>
            )}
          </div>

          {/* Items */}
          <div>
            <p className="text-xs text-neutral-400 mb-2">Itens</p>
            <div className="space-y-2">
              {pedido.itens_pedido?.map((item) => {
                const adicionaisTotal = (item.adicionais_selecionados ?? []).reduce(
                  (s, a) => s + a.preco_extra, 0
                );
                const itemTotal = (Number(item.preco_unitario_no_momento) + adicionaisTotal) * item.quantidade;
                return (
                  <div key={item.id} className="flex justify-between text-sm">
                    <div className="flex-1">
                      <span className="text-neutral-900">{item.quantidade}x {item.produtos?.nome ?? 'Produto'}</span>
                      {item.adicionais_selecionados && item.adicionais_selecionados.length > 0 && (
                        <p className="text-xs text-neutral-400 mt-0.5">
                          {item.adicionais_selecionados.map((a) => a.nome).join(', ')}
                        </p>
                      )}
                    </div>
                    <span className="text-neutral-900 font-medium">{formatCurrency(itemTotal)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Address */}
          {end && (
            <div>
              <p className="text-xs text-neutral-400 mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Endereço de entrega
              </p>
              <p className="text-sm text-neutral-700">
                {end.rua}, {end.numero}{end.complemento ? `, ${end.complemento}` : ''}
              </p>
              <p className="text-sm text-neutral-500">{end.bairro} - {end.cidade}</p>
              <p className="text-sm text-neutral-500">CEP: {end.cep}</p>
              {end.referencia && <p className="text-sm text-neutral-400">Ref: {end.referencia}</p>}
            </div>
          )}

          {/* Payment */}
          <div>
            <p className="text-xs text-neutral-400 mb-1 flex items-center gap-1">
              <CreditCard className="w-3 h-3" /> Pagamento
            </p>
            <p className="text-sm text-neutral-700">{FORMA_PAGAMENTO_LABELS[pedido.forma_pagamento]}</p>
          </div>

          {/* Observations */}
          {pedido.observacoes && (
            <div>
              <p className="text-xs text-neutral-400 mb-1 flex items-center gap-1">
                <StickyNote className="w-3 h-3" /> Observações
              </p>
              <p className="text-sm text-neutral-700">{pedido.observacoes}</p>
            </div>
          )}

          {/* Entregador */}
          {canEdit && (
            <div>
              <p className="text-xs text-neutral-400 mb-1 flex items-center gap-1">
                <Bike className="w-3 h-3" /> Entregador
              </p>
              <select
                value={pedido.entregador_id ?? ''}
                onChange={(e) => onAssign(pedido.id, e.target.value || null)}
                className="input py-2 text-sm"
              >
                <option value="">Sem entregador</option>
                {entregadores.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
            </div>
          )}

          {/* Totals */}
          <div className="border-t border-neutral-100 pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500">Subtotal</span>
              <span>{formatCurrency(Number(pedido.subtotal))}</span>
            </div>
            {Number(pedido.desconto) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-success-600">Desconto</span>
                <span className="text-success-600">- {formatCurrency(Number(pedido.desconto))}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500">Taxa de entrega</span>
              <span>{formatCurrency(Number(pedido.taxa_entrega))}</span>
            </div>
            <div className="flex justify-between text-base font-semibold pt-1">
              <span>Total</span>
              <span className="text-primary-600">{formatCurrency(Number(pedido.total))}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs text-neutral-400">
            <Clock className="w-3 h-3" />
            {formatDate(pedido.created_at)}
          </div>
        </div>
      </div>
    </div>
  );
}

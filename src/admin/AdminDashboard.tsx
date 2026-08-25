import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';
import { STATUS_PEDIDO_LABELS } from '@/lib/types';
import type { Pedido } from '@/lib/types';
import {
  TrendingUp,
  ShoppingBag,
  Receipt,
  Clock,
  ArrowUpRight,
} from 'lucide-react';

interface PedidoWithCliente extends Pedido {
  clientes: { nome: string } | null;
}

export default function AdminDashboard() {
  const { perfil } = useAuth();
  const tenantId = perfil?.tenant_id;

  const [totalVendido, setTotalVendido] = useState(0);
  const [numPedidos, setNumPedidos] = useState(0);
  const [ticketMedio, setTicketMedio] = useState(0);
  const [topProdutos, setTopProdutos] = useState<{ nome: string; total: number }[]>([]);
  const [pedidosAndamento, setPedidosAndamento] = useState<PedidoWithCliente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;

    (async () => {
      setLoading(true);
      const now = new Date();
      const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const start7d = new Date(now.getTime() - 7 * 86400000).toISOString();

      // Today's orders
      const { data: pedidosHoje } = await supabase
        .from('pedidos')
        .select('total, status')
        .eq('tenant_id', tenantId)
        .gte('created_at', startToday)
        .neq('status', 'cancelado');

      const validos = pedidosHoje ?? [];
      const vendido = validos.reduce((s, p) => s + Number(p.total), 0);
      setTotalVendido(vendido);
      setNumPedidos(validos.length);
      setTicketMedio(validos.length > 0 ? vendido / validos.length : 0);

      // Top products last 7 days
      const { data: pedidos7d } = await supabase
        .from('pedidos')
        .select('id')
        .eq('tenant_id', tenantId)
        .gte('created_at', start7d);

      if (pedidos7d && pedidos7d.length > 0) {
        const pedidoIds = pedidos7d.map((p) => p.id);
        const { data: itens } = await supabase
          .from('itens_pedido')
          .select('produto_id, quantidade, produtos(nome)')
          .in('pedido_id', pedidoIds);

        if (itens) {
          const porProduto: Record<string, { nome: string; total: number }> = {};
          itens.forEach((item: any) => {
            const nome = item.produtos?.nome ?? 'Produto';
            if (!porProduto[item.produto_id]) {
              porProduto[item.produto_id] = { nome, total: 0 };
            }
            porProduto[item.produto_id].total += item.quantidade;
          });
          const ranking = Object.values(porProduto)
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
          setTopProdutos(ranking);
        }
      }

      // Ongoing orders
      await loadOngoing();

      setLoading(false);
    })();

    // Realtime for ongoing orders
    const channel = supabase
      .channel('dashboard-pedidos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos', filter: `tenant_id=eq.${tenantId}` },
        () => loadOngoing()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function loadOngoing() {
    if (!tenantId) return;
    const { data } = await supabase
      .from('pedidos')
      .select('*, clientes(nome)')
      .eq('tenant_id', tenantId)
      .in('status', ['recebido', 'preparo', 'saiu_entrega'])
      .order('created_at', { ascending: false });

    setPedidosAndamento((data as PedidoWithCliente[]) ?? []);
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Clock className="w-6 h-6 text-neutral-300 animate-pulse" />
        </div>
      </AdminLayout>
    );
  }

  const maxProduto = topProdutos.length > 0 ? topProdutos[0].total : 1;

  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold text-neutral-900 mb-1">Dashboard</h1>
      <p className="text-sm text-neutral-500 mb-6">Visão geral do seu negócio hoje</p>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-success-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-success-600" />
            </div>
            <span className="text-xs text-neutral-400">Hoje</span>
          </div>
          <p className="text-2xl font-bold text-neutral-900">{formatCurrency(totalVendido)}</p>
          <p className="text-sm text-neutral-500 mt-1">Total vendido</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-primary-600" />
            </div>
            <span className="text-xs text-neutral-400">Hoje</span>
          </div>
          <p className="text-2xl font-bold text-neutral-900">{numPedidos}</p>
          <p className="text-sm text-neutral-500 mt-1">Pedidos hoje</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-warning-50 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-warning-600" />
            </div>
            <span className="text-xs text-neutral-400">Hoje</span>
          </div>
          <p className="text-2xl font-bold text-neutral-900">{formatCurrency(ticketMedio)}</p>
          <p className="text-sm text-neutral-500 mt-1">Ticket médio</p>
        </div>
      </div>

      {/* Top products chart */}
      <div className="card mb-8">
        <h2 className="text-sm font-semibold text-neutral-900 mb-4">Produtos mais vendidos (7 dias)</h2>
        {topProdutos.length === 0 ? (
          <p className="text-sm text-neutral-400 py-6 text-center">Sem dados suficientes ainda.</p>
        ) : (
          <div className="space-y-3">
            {topProdutos.map((produto, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-neutral-700 truncate">{produto.nome}</span>
                  <span className="text-sm font-medium text-neutral-900">{produto.total}x</span>
                </div>
                <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary-500 transition-all duration-500"
                    style={{ width: `${(produto.total / maxProduto) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ongoing orders */}
      <div className="card">
        <h2 className="text-sm font-semibold text-neutral-900 mb-4">Pedidos em andamento</h2>
        {pedidosAndamento.length === 0 ? (
          <p className="text-sm text-neutral-400 py-6 text-center">Nenhum pedido em andamento.</p>
        ) : (
          <div className="space-y-3">
            {pedidosAndamento.map((pedido) => (
              <div
                key={pedido.id}
                className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">
                    {pedido.clientes?.nome ?? 'Cliente'}
                  </p>
                  <p className="text-xs text-neutral-400">{formatDate(pedido.created_at)}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary-50 text-primary-700">
                    {STATUS_PEDIDO_LABELS[pedido.status]}
                  </span>
                  <span className="text-sm font-semibold text-neutral-900">
                    {formatCurrency(Number(pedido.total))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

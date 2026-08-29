import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import { STATUS_PEDIDO_LABELS } from '@/lib/types';
import type { StatusPedido } from '@/lib/types';
import { Loader2, BarChart3, TrendingUp, ShoppingBag, Receipt } from 'lucide-react';

export default function AdminRelatorios() {
  const { perfil } = useAuth();
  const tenantId = perfil?.tenant_id;
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<'7d' | '30d' | 'hoje'>('7d');
  const [totalVendido, setTotalVendido] = useState(0);
  const [numPedidos, setNumPedidos] = useState(0);
  const [ticketMedio, setTicketMedio] = useState(0);
  const [porStatus, setPorStatus] = useState<Record<string, number>>({});
  const [topProdutos, setTopProdutos] = useState<{ nome: string; total: number; receita: number }[]>([]);
  const [vendasPorDia, setVendasPorDia] = useState<{ dia: string; total: number }[]>([]);

  useEffect(() => {
    (async () => {
      if (!tenantId) return;
      setLoading(true);

      const now = new Date();
      let startDate: string;
      let numDays: number;

      if (periodo === 'hoje') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        numDays = 1;
      } else if (periodo === '30d') {
        startDate = new Date(now.getTime() - 30 * 86400000).toISOString();
        numDays = 30;
      } else {
        startDate = new Date(now.getTime() - 7 * 86400000).toISOString();
        numDays = 7;
      }

      const { data: pedidos } = await supabase
        .from('pedidos')
        .select('total, status, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });

      const validos = (pedidos ?? []).filter((p: any) => p.status !== 'cancelado');
      const vendido = validos.reduce((s: number, p: any) => s + Number(p.total), 0);
      setTotalVendido(vendido);
      setNumPedidos(validos.length);
      setTicketMedio(validos.length > 0 ? vendido / validos.length : 0);

      // Por status
      const statusCount: Record<string, number> = {};
      (pedidos ?? []).forEach((p: any) => {
        statusCount[p.status] = (statusCount[p.status] ?? 0) + 1;
      });
      setPorStatus(statusCount);

      // Vendas por dia
      const dias: { dia: string; total: number }[] = [];
      for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
        const total = validos
          .filter((p: any) => p.created_at >= dayStart && p.created_at < dayEnd)
          .reduce((s: number, p: any) => s + Number(p.total), 0);
        dias.push({ dia: label, total });
      }
      setVendasPorDia(dias);

      // Top produtos
      const pedidoIds = (pedidos ?? []).map((p: any) => p.id);
      if (pedidoIds.length > 0) {
        const { data: itens } = await supabase
          .from('itens_pedido')
          .select('produto_id, quantidade, preco_unitario_no_momento, produtos(nome)')
          .in('pedido_id', pedidoIds);

        if (itens) {
          const porProduto: Record<string, { nome: string; total: number; receita: number }> = {};
          itens.forEach((item: any) => {
            const nome = item.produtos?.nome ?? 'Produto';
            if (!porProduto[item.produto_id]) {
              porProduto[item.produto_id] = { nome, total: 0, receita: 0 };
            }
            porProduto[item.produto_id].total += item.quantidade;
            porProduto[item.produto_id].receita += item.quantidade * Number(item.preco_unitario_no_momento);
          });
          setTopProdutos(
            Object.values(porProduto)
              .sort((a, b) => b.receita - a.receita)
              .slice(0, 10)
          );
        }
      } else {
        setTopProdutos([]);
      }

      setLoading(false);
    })();
  }, [tenantId, periodo]);

  const maxVenda = Math.max(...vendasPorDia.map((v) => v.total), 1);
  const maxProduto = Math.max(...topProdutos.map((p) => p.receita), 1);

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
      <h1 className="text-2xl font-semibold text-neutral-900 mb-1">Relatórios</h1>
      <p className="text-sm text-neutral-500 mb-6">Análise de desempenho do seu negócio</p>

      {/* Period selector */}
      <div className="flex gap-2 mb-6">
        {([['hoje', 'Hoje'], ['7d', '7 dias'], ['30d', '30 dias']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setPeriodo(val)}
            className={`px-4 py-2 rounded-card text-sm font-medium transition-colors ${
              periodo === val ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-card bg-success-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-success-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-900">{formatCurrency(totalVendido)}</p>
          <p className="text-sm text-neutral-500 mt-1">Receita total</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-card bg-primary-50 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-primary-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-900">{numPedidos}</p>
          <p className="text-sm text-neutral-500 mt-1">Pedidos</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-card bg-warning-50 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-warning-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-900">{formatCurrency(ticketMedio)}</p>
          <p className="text-sm text-neutral-500 mt-1">Ticket médio</p>
        </div>
      </div>

      {/* Sales chart */}
      <div className="card mb-8">
        <h2 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary-500" />
          Vendas por dia
        </h2>
        {vendasPorDia.length === 0 ? (
          <p className="text-sm text-neutral-400 py-6 text-center">Sem dados.</p>
        ) : (
          <div className="flex items-end gap-1 h-40">
            {vendasPorDia.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-md bg-primary-400 hover:bg-primary-500 transition-colors relative"
                    style={{ height: `${(v.total / maxVenda) * 100}%`, minHeight: v.total > 0 ? '4px' : '0' }}
                  >
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {formatCurrency(v.total)}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-neutral-400">{v.dia}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status distribution */}
        <div className="card">
          <h2 className="text-sm font-semibold text-neutral-900 mb-4">Distribuição por status</h2>
          <div className="space-y-2">
            {Object.entries(STATUS_PEDIDO_LABELS).map(([status, label]) => {
              const count = porStatus[status] ?? 0;
              const pct = numPedidos > 0 ? (count / (Object.values(porStatus).reduce((a, b) => a + b, 0) || 1)) * 100 : 0;
              return (
                <div key={status}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-neutral-600">{label}</span>
                    <span className="text-neutral-900 font-medium">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top products by revenue */}
        <div className="card">
          <h2 className="text-sm font-semibold text-neutral-900 mb-4">Produtos por receita</h2>
          {topProdutos.length === 0 ? (
            <p className="text-sm text-neutral-400 py-6 text-center">Sem dados.</p>
          ) : (
            <div className="space-y-2">
              {topProdutos.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-neutral-400 w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-neutral-700 truncate">{p.nome}</span>
                      <span className="text-neutral-900 font-medium">{formatCurrency(p.receita)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                      <div className="h-full rounded-full bg-success-400" style={{ width: `${(p.receita / maxProduto) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-xs text-neutral-400 w-10 text-right">{p.total}x</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

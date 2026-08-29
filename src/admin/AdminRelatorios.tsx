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

      const statusCount: Record<string, number> = {};
      (pedidos ?? []).forEach((p: any) => {
        statusCount[p.status] = (statusCount[p.status] ?? 0) + 1;
      });
      setPorStatus(statusCount);

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
          <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <h1 className="text-lg font-semibold text-strong mb-0.5">Relatórios</h1>
      <p className="text-sm text-mid mb-5">Análise de desempenho do seu negócio</p>

      <div className="flex gap-1.5 mb-5">
        {([['hoje', 'Hoje'], ['7d', '7 dias'], ['30d', '30 dias']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setPeriodo(val)}
            className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              periodo === val ? 'bg-primary-600 text-white' : 'bg-raised text-mid hover:text-strong'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-md bg-success-500/15 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-success-500" />
            </div>
          </div>
          <p className="text-xl font-semibold text-strong">{formatCurrency(totalVendido)}</p>
          <p className="text-xs text-mid mt-0.5">Receita total</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-md bg-primary-500/15 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-primary-500" />
            </div>
          </div>
          <p className="text-xl font-semibold text-strong">{numPedidos}</p>
          <p className="text-xs text-mid mt-0.5">Pedidos</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-md bg-warning-500/15 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-warning-500" />
            </div>
          </div>
          <p className="text-xl font-semibold text-strong">{formatCurrency(ticketMedio)}</p>
          <p className="text-xs text-mid mt-0.5">Ticket médio</p>
        </div>
      </div>

      <div className="card p-4 mb-6">
        <h2 className="text-xs font-semibold text-mid uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5 text-primary-500" />
          Vendas por dia
        </h2>
        {vendasPorDia.length === 0 ? (
          <p className="text-sm text-dim py-4 text-center">Sem dados.</p>
        ) : (
          <div className="flex items-end gap-1 h-36">
            {vendasPorDia.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-sm bg-primary-500 hover:bg-primary-400 transition-colors relative"
                    style={{ height: `${(v.total / maxVenda) * 100}%`, minHeight: v.total > 0 ? '3px' : '0' }}
                  >
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-2xs text-mid opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {formatCurrency(v.total)}
                    </span>
                  </div>
                </div>
                <span className="text-2xs text-dim">{v.dia}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h2 className="text-xs font-semibold text-mid uppercase tracking-wide mb-3">Distribuição por status</h2>
          <div className="space-y-2">
            {Object.entries(STATUS_PEDIDO_LABELS).map(([status, label]) => {
              const count = porStatus[status] ?? 0;
              const pct = numPedidos > 0 ? (count / (Object.values(porStatus).reduce((a, b) => a + b, 0) || 1)) * 100 : 0;
              return (
                <div key={status}>
                  <div className="flex justify-between text-sm mb-0.5">
                    <span className="text-mid">{label}</span>
                    <span className="text-strong font-medium">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-raised overflow-hidden">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-4">
          <h2 className="text-xs font-semibold text-mid uppercase tracking-wide mb-3">Produtos por receita</h2>
          {topProdutos.length === 0 ? (
            <p className="text-sm text-dim py-4 text-center">Sem dados.</p>
          ) : (
            <div className="space-y-2">
              {topProdutos.map((p, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="text-2xs text-dim w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm mb-0.5">
                      <span className="text-mid truncate">{p.nome}</span>
                      <span className="text-strong font-medium">{formatCurrency(p.receita)}</span>
                    </div>
                    <div className="h-1 rounded-full bg-raised overflow-hidden">
                      <div className="h-full rounded-full bg-success-500" style={{ width: `${(p.receita / maxProduto) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-2xs text-dim w-8 text-right">{p.total}x</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

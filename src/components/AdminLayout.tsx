import { type ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  UtensilsCrossed,
  Ticket,
  Bike,
  BarChart3,
  Settings,
  Store,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth, canAccess } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { PAPEL_LABELS } from '@/lib/types';
import type { PapelEquipe } from '@/lib/types';

const ALL_NAV_ITEMS = [
  { area: 'dashboard', to: '', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { area: 'pedidos', to: '/pedidos', label: 'Pedidos', icon: ShoppingBag, end: false },
  { area: 'cardapio', to: '/cardapio', label: 'Cardápio', icon: UtensilsCrossed, end: false },
  { area: 'cupons', to: '/cupons', label: 'Cupons', icon: Ticket, end: false },
  { area: 'entregadores', to: '/entregadores', label: 'Entregadores', icon: Bike, end: false },
  { area: 'relatorios', to: '/relatorios', label: 'Relatórios', icon: BarChart3, end: false },
  { area: 'configuracoes', to: '/configuracoes', label: 'Configurações', icon: Settings, end: false },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { perfil, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tenantName, setTenantName] = useState('Painel');

  const papel = perfil?.papel as PapelEquipe | undefined;
  const navItems = ALL_NAV_ITEMS.filter((item) => canAccess(papel, item.area));

  const basePath = `/admin/${slug}`;

  useEffect(() => {
    if (!perfil?.tenant_id) return;
    (async () => {
      const { data } = await supabase
        .from('tenants')
        .select('nome')
        .eq('id', perfil.tenant_id)
        .maybeSingle();
      if (data) setTenantName((data as { nome: string }).nome);
    })();
  }, [perfil?.tenant_id]);

  async function handleSignOut() {
    await signOut();
    navigate(`/admin/${slug}/login`);
  }

  function isActive(item: (typeof ALL_NAV_ITEMS)[number]) {
    const fullPath = basePath + item.to;
    if (item.end) return location.pathname === fullPath;
    return location.pathname.startsWith(fullPath);
  }

  const sidebarContent = (
    <>
      <div className="px-5 py-4 border-b border-line">
        <Link to={basePath} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-primary-600 flex items-center justify-center">
            <Store className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-strong text-sm truncate">{tenantName}</p>
            <p className="text-xs text-dim truncate">{slug}</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.area}
              to={basePath + item.to}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary-600/15 text-primary-400'
                  : 'text-mid hover:bg-raised hover:text-strong'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 py-3 border-t border-line">
        {perfil && (
          <div className="px-3 py-2 mb-1">
            <p className="text-sm font-medium text-strong truncate">{perfil.nome}</p>
            <p className="text-xs text-dim">{PAPEL_LABELS[papel ?? 'dono']}</p>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-dim hover:bg-raised hover:text-strong transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </>
  );

  return (
    <div className="dark-admin min-h-screen bg-page flex">
      {/* Desktop sidebar */}
      <aside className="w-56 bg-surface border-r border-line flex flex-col shrink-0 hidden md:flex">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed top-0 left-0 h-full w-56 bg-surface border-r border-line flex flex-col z-50 md:hidden animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <span className="font-semibold text-strong text-sm">{tenantName}</span>
              <button onClick={() => setMobileOpen(false)} className="p-1 rounded-md hover:bg-raised">
                <X className="w-4 h-4 text-dim" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-surface border-b border-line sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-md hover:bg-raised"
          >
            <Menu className="w-5 h-5 text-mid" />
          </button>
          <Link to={basePath} className="flex items-center gap-2">
            <Store className="w-4 h-4 text-primary-500" />
            <span className="font-semibold text-sm text-strong truncate max-w-[120px]">{tenantName}</span>
          </Link>
          <div className="w-9" />
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6">{children}</div>
      </main>
    </div>
  );
}

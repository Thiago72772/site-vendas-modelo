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
      <div className="px-6 py-5 border-b border-neutral-200">
        <Link to={basePath} className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-neutral-900 text-sm truncate">{tenantName}</p>
            <p className="text-xs text-neutral-400 truncate">{slug}</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.area}
              to={basePath + item.to}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                active
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-neutral-200">
        {perfil && (
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium text-neutral-900 truncate">{perfil.nome}</p>
            <p className="text-xs text-neutral-400">{PAPEL_LABELS[papel ?? 'dono']}</p>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-500 hover:bg-neutral-100 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Desktop sidebar */}
      <aside className="w-64 bg-white border-r border-neutral-200 flex flex-col shrink-0 hidden md:flex">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed top-0 left-0 h-full w-64 bg-white border-r border-neutral-200 flex flex-col z-50 md:hidden animate-slide-in-left">
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-neutral-200 sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg hover:bg-neutral-100"
          >
            <Menu className="w-5 h-5 text-neutral-600" />
          </button>
          <Link to={basePath} className="flex items-center gap-2">
            <Store className="w-5 h-5 text-primary-600" />
            <span className="font-semibold text-sm truncate max-w-[120px]">{tenantName}</span>
          </Link>
          <div className="w-9" />
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</div>
      </main>
    </div>
  );
}

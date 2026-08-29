import { Link, useLocation } from 'react-router-dom';
import { Home, Search, ShoppingBag, ClipboardList } from 'lucide-react';
import { useCart } from '@/hooks/useCart';

interface BottomNavProps {
  slug: string;
  onCartClick: () => void;
}

const NAV_ITEMS = [
  { key: 'inicio', label: 'Início', icon: Home, getTo: (slug: string) => `/loja/${slug}` },
  { key: 'buscar', label: 'Buscar', icon: Search, getTo: (slug: string) => `/loja/${slug}#buscar` },
  { key: 'pedidos', label: 'Pedidos', icon: ClipboardList, getTo: (slug: string) => `/loja/${slug}/pedido/` },
  { key: 'carrinho', label: 'Carrinho', icon: ShoppingBag, getTo: null },
] as const;

export function BottomNav({ slug, onCartClick }: BottomNavProps) {
  const location = useLocation();
  const { totalItems } = useCart();

  const basePath = `/loja/${slug}`;

  function isActive(key: string) {
    if (key === 'inicio') return location.pathname === basePath;
    if (key === 'buscar') return false;
    if (key === 'pedidos') return location.pathname.includes('/pedido/');
    return false;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-raised md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around px-2 py-1">
        {NAV_ITEMS.map((item) => {
          if (item.key === 'carrinho') {
            return (
              <button
                key={item.key}
                type="button"
                onClick={onCartClick}
                className="relative flex flex-1 flex-col items-center gap-0.5 py-1.5"
              >
                <div className="relative">
                  <item.icon className="h-5 w-5 text-mid" />
                  {totalItems > 0 && (
                    <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-sm bg-neutral-950 px-1 text-[9px] font-bold text-white">
                      {totalItems}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium text-mid">
                  Carrinho
                </span>
              </button>
            );
          }

          const active = isActive(item.key);
          const to = item.getTo(slug);

          if (!to) return null;

          return (
            <Link
              key={item.key}
              to={to}
              className="flex flex-1 flex-col items-center gap-0.5 py-1.5"
            >
              <item.icon
                className={`h-5 w-5 transition-colors ${
                  active ? 'text-strong' : 'text-mid'
                }`}
              />
              <span
                className={`text-[10px] font-medium transition-colors ${
                  active ? 'text-strong' : 'text-mid'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

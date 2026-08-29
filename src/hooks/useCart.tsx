import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Produto, GrupoAdicional, Adicional } from '@/lib/types';
import { scopedStorageKey, getOrCreateSessionId } from '@/lib/session';

export interface CartItemAdicional {
  id: string;
  nome: string;
  preco_extra: number;
}

export interface CartItem {
  id: string;
  produto_id: string;
  nome: string;
  preco_unitario: number;
  imagem_url: string | null;
  quantidade: number;
  adicionais: CartItemAdicional[];
}

interface CartContextValue {
  items: CartItem[];
  addItem: (
    produto: Produto,
    quantidade: number,
    adicionais: CartItemAdicional[]
  ) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, delta: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  // Session-scoped key: different anonymous users on the same device
  // get isolated carts. The key includes the session UUID so each
  // browser tab / user has its own cart.
  const storageKey = scopedStorageKey('cart', slug);

  // Migrate legacy unscoped key (`cart_{slug}`) into the new scoped
  // key so returning users don't lose their existing cart.
  useEffect(() => {
    try {
      const legacyKey = `cart_${slug}`;
      const legacyData = localStorage.getItem(legacyKey);
      if (legacyData && !localStorage.getItem(storageKey)) {
        localStorage.setItem(storageKey, legacyData);
      }
      // Clean up the old unscoped key once migrated.
      if (legacyData) {
        localStorage.removeItem(legacyKey);
      }
    } catch {
      // ignore
    }
  }, [slug, storageKey]);

  // Carrega o carrinho ANTES do primeiro render.
  // Assim não existe um estado inicial [] sendo gravado
  // por cima do carrinho persistido.
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);

      if (!stored) {
        return [];
      }

      const parsed = JSON.parse(stored);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed as CartItem[];
    } catch {
      return [];
    }
  });

  // Persiste somente o estado atual do carrinho.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // ignore write errors
    }
  }, [items, storageKey]);

  function addItem(
    produto: Produto,
    quantidade: number,
    adicionais: CartItemAdicional[]
  ) {
    setItems((prev) => {
      const existing = prev.find(
        (item) =>
          item.produto_id === produto.id &&
          JSON.stringify(item.adicionais) === JSON.stringify(adicionais)
      );

      if (existing) {
        return prev.map((item) =>
          item.id === existing.id
            ? {
                ...item,
                quantidade: item.quantidade + quantidade,
              }
            : item
        );
      }

      const newItem: CartItem = {
        id: crypto.randomUUID(),
        produto_id: produto.id,
        nome: produto.nome,
        preco_unitario: produto.preco,
        imagem_url: produto.imagem_url,
        quantidade,
        adicionais,
      };

      return [...prev, newItem];
    });
  }

  function removeItem(itemId: string) {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  function updateQuantity(itemId: string, delta: number) {
    setItems((prev) =>
      prev
        .map((item) =>
          item.id === itemId
            ? {
                ...item,
                quantidade: item.quantidade + delta,
              }
            : item
        )
        .filter((item) => item.quantidade > 0)
    );
  }

  function clearCart() {
  setItems([]);

  try {
    localStorage.removeItem(storageKey);
  } catch {
    // ignore storage errors
  }
}

  const totalItems = items.reduce(
    (sum, item) => sum + item.quantidade,
    0
  );

  const subtotal = items.reduce((sum, item) => {
    const adicionaisTotal = item.adicionais.reduce(
      (s, a) => s + a.preco_extra,
      0
    );

    return (
      sum +
      (item.preco_unitario + adicionaisTotal) * item.quantidade
    );
  }, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        subtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);

  if (!ctx) {
    throw new Error('useCart must be used within CartProvider');
  }

  return ctx;
}

export function calculateItemPrice(
  precoUnitario: number,
  adicionais: CartItemAdicional[],
  quantidade: number
): number {
  const adicionaisTotal = adicionais.reduce(
    (s, a) => s + a.preco_extra,
    0
  );

  return (precoUnitario + adicionaisTotal) * quantidade;
}

export type { Produto, GrupoAdicional, Adicional };
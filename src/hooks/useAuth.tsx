import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Perfil, PapelEquipe } from '@/lib/types';

interface AuthContextValue {
  session: Session | null;
  perfil: Perfil | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadPerfil(userId: string) {
    const { data } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setPerfil(data as Perfil | null);
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        loadPerfil(data.session.user.id).then(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        loadPerfil(newSession.user.id).then(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setPerfil(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setPerfil(null);
  }

  return (
    <AuthContext.Provider value={{ session, perfil, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function canAccess(papel: PapelEquipe | undefined | null, area: string): boolean {
  if (!papel) return false;
  if (papel === 'dono') return true;
  if (papel === 'atendente') {
    return ['dashboard', 'pedidos', 'cardapio', 'cupons', 'entregadores', 'clientes'].includes(area);
  }
  if (papel === 'cozinha') {
    return area === 'pedidos';
  }
  if (papel === 'entregador') {
    return area === 'pedidos';
  }
  return false;
}

export function canEditMenu(papel: PapelEquipe | undefined | null): boolean {
  return papel === 'dono' || papel === 'atendente';
}

export function canEditOrders(papel: PapelEquipe | undefined | null): boolean {
  return papel === 'dono' || papel === 'atendente';
}

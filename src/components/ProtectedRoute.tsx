import { Navigate, useParams } from 'react-router-dom';
import { useAuth, canAccess } from '@/hooks/useAuth';
import { LoadingScreen } from '@/components/ui';

export function ProtectedRoute({
  children,
  area,
}: {
  children: React.ReactNode;
  area?: string;
}) {
  const { session, perfil, loading } = useAuth();
  const { slug } = useParams<{ slug: string }>();

  if (loading) return <LoadingScreen message="Verificando acesso..." />;
  if (!session) return <Navigate to={`/admin/${slug ?? ''}/login`} replace />;

  if (area && !canAccess(perfil?.papel, area)) {
    const fallback = canAccess(perfil?.papel, 'pedidos') ? `/admin/${slug ?? ''}/pedidos` : `/admin/${slug ?? ''}/login`;
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}

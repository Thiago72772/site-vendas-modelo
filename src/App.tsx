import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import { AuthProvider } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/components/ProtectedRoute';

import LojaHome from '@/loja/LojaHome';
import LojaCheckout from '@/loja/LojaCheckout';
import LojaPedidoStatus from '@/loja/LojaPedidoStatus';
import LojaClienteLogin from '@/loja/LojaClienteLogin';

import AdminLogin from '@/admin/AdminLogin';
import AdminDashboard from '@/admin/AdminDashboard';
import AdminPedidos from '@/admin/AdminPedidos';
import AdminCardapio from '@/admin/AdminCardapio';
import AdminClientes from '@/admin/AdminClientes';
import AdminEntregadores from '@/admin/AdminEntregadores';
import AdminCupons from '@/admin/AdminCupons';
import AdminConfiguracoes from '@/admin/AdminConfiguracoes';
import AdminRelatorios from '@/admin/AdminRelatorios';
import AdminSlugEntry from '@/admin/AdminSlugEntry';

const LOJA_MODELO_SLUG = 'loja-teste';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* =====================================================
              CLIENTE
              Uma única experiência
             ===================================================== */}

          {/* Entrada principal da demonstração */}
          <Route
            path="/"
            element={
              <Navigate
                to={`/loja/${LOJA_MODELO_SLUG}`}
                replace
              />
            }
          />

          {/* Loja / cardápio */}
          <Route
            path="/loja/:slug"
            element={<LojaHome />}
          />

          {/* Checkout */}
          <Route
            path="/loja/:slug/checkout"
            element={<LojaCheckout />}
          />

          {/* Acompanhamento do pedido */}
          <Route
            path="/loja/:slug/pedido/:pedidoId"
            element={<LojaPedidoStatus />}
          />

          {/* Login opcional do cliente */}
          <Route
            path="/loja/:slug/login"
            element={<LojaClienteLogin />}
          />

          {/* =====================================================
              DONO
             ===================================================== */}

          <Route
            path="/admin/:slug/login"
            element={<AdminLogin />}
          />

          <Route
            path="/admin/:slug"
            element={
              <ProtectedRoute area="dashboard">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/:slug/pedidos"
            element={
              <ProtectedRoute area="pedidos">
                <AdminPedidos />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/:slug/cardapio"
            element={
              <ProtectedRoute area="cardapio">
                <AdminCardapio />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/:slug/clientes"
            element={
              <ProtectedRoute area="clientes">
                <AdminClientes />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/:slug/entregadores"
            element={
              <ProtectedRoute area="entregadores">
                <AdminEntregadores />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/:slug/cupons"
            element={
              <ProtectedRoute area="cupons">
                <AdminCupons />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/:slug/configuracoes"
            element={
              <ProtectedRoute area="configuracoes">
                <AdminConfiguracoes />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/:slug/relatorios"
            element={
              <ProtectedRoute area="relatorios">
                <AdminRelatorios />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/login"
            element={<AdminSlugEntry />}
          />

          <Route
            path="/admin"
            element={<AdminSlugEntry />}
          />

          {/* Fallback */}
          <Route
            path="*"
            element={
              <Navigate
                to={`/loja/${LOJA_MODELO_SLUG}`}
                replace
              />
            }
          />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
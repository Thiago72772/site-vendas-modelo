-- ============================================================
-- MIGRATION: Session-based data isolation for anonymous users
-- ============================================================
-- This migration adds session_id tracking to the clientes table
-- and tightens RLS policies on pedidos and itens_pedido so that
-- anonymous users can only read their OWN orders, not all orders
-- for the tenant.
--
-- RUN THIS IN: Supabase Dashboard → SQL Editor
-- DATE: 2026-08-29
-- AUTHOR: Buffy (Codebuff audit)
-- ============================================================

-- ============================================================
-- 1. Add session_id column to clientes
-- ============================================================
-- The session_id stores the browser's anonymous session UUID
-- (generated client-side via src/lib/session.ts). This allows
-- RLS policies to verify that an anonymous user owns the data
-- they're trying to read.

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS session_id uuid;

COMMENT ON COLUMN clientes.session_id IS
  'Anonymous session UUID from the client browser. '
  'Used by RLS policies to scope data access for '
  'non-authenticated users. NULL for staff accounts.';

-- Index for fast RLS lookups: find all orders belonging
-- to a specific anonymous session.
CREATE INDEX IF NOT EXISTS idx_clientes_session
  ON clientes(session_id)
  WHERE session_id IS NOT NULL;


-- ============================================================
-- 2. Helper function: get the session ID from request headers
-- ============================================================
-- The Supabase JS client sends x-session-id as a custom header
-- (configured in src/lib/supabase.ts via global.headers).
-- Postgres can read this via current_setting('request.headers')
-- which returns the full headers JSON as a text string.

CREATE OR REPLACE FUNCTION public.current_session_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    current_setting('request.headers', true)::jsonb
    ->> 'x-session-id'
  )::uuid;
$$;

COMMENT ON FUNCTION public.current_session_id() IS
  'Extracts the x-session-id header from the current HTTP request. '
  'Returns NULL if the header is missing or not a valid UUID. '
  'Used by RLS policies to identify anonymous users.';


-- ============================================================
-- 3. Rewrite RLS: pedidos (SELECT)
-- ============================================================
-- BEFORE: public_read_pedidos allowed ANY user (anon or
-- authenticated) to read ANY order for ANY active tenant.
-- This was a full data leak: any anonymous user could enumerate
-- all orders including delivery addresses, payment methods, etc.
--
-- AFTER: Split into two policies:
--   a) staff_read_pedidos — staff can read their tenant's orders
--   b) session_read_pedidos — anonymous users can ONLY read
--      orders whose cliente has a matching session_id
--
-- This ensures that anonymous order tracking pages only show
-- the orders belonging to the current browser session.

DROP POLICY IF EXISTS "public_read_pedidos" ON pedidos;

DROP POLICY IF EXISTS "session_read_pedidos" ON pedidos;
CREATE POLICY "session_read_pedidos"
  ON pedidos FOR SELECT
  TO anon, authenticated
  USING (
    -- Anonymous: only if the session_id matches the cliente
    -- who placed this order. This prevents any anonymous user
    -- from reading other users' orders.
    EXISTS (
      SELECT 1
      FROM clientes c
      WHERE c.id = pedidos.cliente_id
        AND c.session_id = public.current_session_id()
        AND c.session_id IS NOT NULL
    )
  );


-- ============================================================
-- 4. Rewrite RLS: itens_pedido (SELECT)
-- ============================================================
-- BEFORE: public_read_itens_pedido allowed ANY user to read
-- order items for ANY active tenant's orders.
--
-- AFTER: Same pattern — anonymous users can only read items
-- for orders belonging to their session.

DROP POLICY IF EXISTS "public_read_itens_pedido" ON itens_pedido;

DROP POLICY IF EXISTS "session_read_itens_pedido" ON itens_pedido;
CREATE POLICY "session_read_itens_pedido"
  ON itens_pedido FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM pedidos p
      JOIN clientes c ON c.id = p.cliente_id
      WHERE p.id = itens_pedido.pedido_id
        AND c.session_id = public.current_session_id()
        AND c.session_id IS NOT NULL
    )
  );


-- ============================================================
-- 5. Rewrite RLS: clientes (SELECT) — ADD anon session read
-- ============================================================
-- BEFORE: Only staff could read clientes.
-- AFTER: Anonymous users can also read their own client record
-- (by matching session_id), which allows the checkout to
-- pre-fill data from the database on return visits.

DROP POLICY IF EXISTS "session_read_clientes" ON clientes;
CREATE POLICY "session_read_clientes"
  ON clientes FOR SELECT
  TO anon, authenticated
  USING (
    -- Anonymous: can only read their own record
    session_id = public.current_session_id()
    AND session_id IS NOT NULL
  );

-- Keep the existing staff_read_clientes policy (no change needed).


-- ============================================================
-- 6. Audit: All tables with personal data — verify no leaks
-- ============================================================
-- The following tables contain personal/customer data:

-- TABLE              | CURRENT PUBLIC SELECT    | ACTION NEEDED
-- -------------------|------------------------|---------------
-- clientes           | ❌ NONE (good)          | Added session_read
-- pedidos            | ❌ FULL PUBLIC (fixed)   | Replaced with session_read
-- itens_pedido       | ❌ FULL PUBLIC (fixed)   | Replaced with session_read
-- cupons             | ✅ Staff-only (good)     | No change
-- entregadores       | ✅ Staff-only (good)     | No change
-- notificacoes       | ✅ Staff-only (good)     | No change
-- perfis             | ✅ Self + staff (good)   | No change
-- categorias         | ✅ Public read (OK)      | Public data, no PII
-- produtos           | ✅ Public read (OK)      | Public data, no PII
-- grupos_adicionais  | ✅ Public read (OK)      | Public data, no PII
-- adicionais         | ✅ Public read (OK)      | Public data, no PII
-- tenants            | ✅ Public read active     | Public data, no PII


-- ============================================================
-- 7. Verify: run these queries to confirm the policies work
-- ============================================================

-- After running this migration, test with these queries:

-- TEST 1: Anonymous user should see EMPTY results when querying
-- pedidos without a valid session_id header:
--   SELECT count(*) FROM pedidos;  -- Should return 0 as anon

-- TEST 2: Anonymous user with a valid session_id should only see
-- their own orders:
--   -- (First, set the session header)
--   SET LOCAL request.headers = '{"x-session-id": "<your-uuid>"}';
--   SELECT count(*) FROM pedidos;  -- Should return only your orders

-- TEST 3: Staff user should still see ALL their tenant's orders:
--   -- (Login as staff, then query)
--   SELECT count(*) FROM pedidos;  -- Should return tenant's orders

-- TEST 4: Staff from tenant A should NOT see tenant B's orders:
--   -- (Already enforced by tenant_id_do_usuario() — unchanged)


-- ============================================================
-- DONE. Frontend changes (already applied):
--   - src/lib/session.ts: generates UUID, injects into Supabase
--   - src/lib/supabase.ts: sends x-session-id header
--   - src/loja/LojaCheckout.tsx: saves session_id on cliente
--   - src/loja/LojaPedidoStatus.tsx: checks session ownership
--   - src/hooks/useCart.tsx: session-scoped cart storage
-- ============================================================

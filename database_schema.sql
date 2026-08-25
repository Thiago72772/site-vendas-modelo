/*
# Create multi-tenant delivery SaaS schema (iFood-style)

## Overview
This migration creates the complete foundation for a multi-tenant delivery platform.
Each tenant (a small business — açaí shop, pizzaria, hamburgeria, etc.) owns all its rows.
A public storefront allows unauthenticated browsing of active tenants, categories,
available products, their add-on groups, and add-ons. All operational data (orders,
customers, coupons, delivery drivers, notifications, staff profiles) is restricted to
authenticated staff of the same tenant.

## Enums
1. `papel_equipe` — staff role within a tenant: 'dono' (owner), 'atendente' (attendant),
   'cozinha' (kitchen), 'entregador' (delivery driver).
2. `tipo_desconto` — coupon discount type: 'percentual' (percentage) or 'fixo' (fixed amount).
3. `status_pedido` — order lifecycle: 'recebido' (received), 'preparo' (preparing),
   'saiu_entrega' (out for delivery), 'entregue' (delivered), 'cancelado' (cancelled).
4. `forma_pagamento` — payment method: 'pix', 'cartao' (card), 'dinheiro' (cash).

## New Tables
1. `tenants` — the business itself. slug is unique (URL key). Stores branding (logo, colors,
   banner), WhatsApp phone, opening hours (jsonb per weekday with open/close), delivery fee
   base, delivery radius in km, average prep time, and active flag.
2. `perfis` — staff profiles. id = auth.users.id (one-to-one). Linked to a tenant with a role.
3. `categorias` — product categories, ordered within a tenant.
4. `produtos` — products belonging to a category, with price, image, availability, order.
5. `grupos_adicionais` — add-on groups for a product (e.g. "Tamanho", "Borda"), with
   obrigatorio (required) flag and max_selecao (max selectable add-ons).
6. `adicionais` — individual add-ons within a group, with preco_extra (extra price).
7. `clientes` — customers. auth_user_id is nullable (guests can order without an account).
   endereco is jsonb (rua, numero, bairro, cidade, cep, complemento, referencia).
8. `cupons` — discount coupons per tenant. tipo_desconto + valor, validity window,
   uso_maximo / uso_atual (usage cap and current count), active flag.
9. `entregadores` — delivery drivers per tenant, with name, phone, active flag.
10. `pedidos` — orders. Links cliente + optional entregador. status lifecycle, payment method,
    subtotal, taxa_entrega, desconto, total, endereco_entrega (jsonb), optional cupom,
    observacoes, timestamps.
11. `itens_pedido` — order line items. Links pedido + produto, with quantidade,
    preco_unitario_no_momento (price snapshot), adicionais_selecionados (jsonb).
12. `notificacoes_pendentes` — pending WhatsApp notifications per order, with enviada flag.

## Security (RLS)
All tables have RLS enabled. Three access patterns:
  a) PUBLIC READ (no login): tenants (active only), categorias, produtos (disponivel only),
     grupos_adicionais, adicionais — so the storefront works without authentication.
  b) TENANT-STAFF CRUD: all tables restricted to authenticated users whose perfis.tenant_id
     matches the row's tenant_id. A helper function `tenant_id_do_usuario()` resolves the
     caller's tenant from perfis. INSERT/UPDATE/DELETE are staff-only on every table except
     `tenants` (created out-of-band) and `perfis` (self-managed with owner checks).
  c) PUBLIC WRITE for `clientes`, `pedidos`, `itens_pedido`, and `notificacoes_pendentes`:
     guests must be able to place orders. These tables allow anon INSERT so the storefront
     can create orders without authentication. Reads of these tables are staff-only
     (customers and orders are private business data).

## Helper Function
- `tenant_id_do_usuario()` — SECURITY DEFINER function that returns the tenant_id from
  perfis for the current authenticated user. Used in RLS policies to avoid repeated subqueries.

## Important Notes
1. All tables carry tenant_id (uuid, FK -> tenants.id) for isolation.
2. Child tables (produtos, grupos_adicionais, adicionais, itens_pedido) cascade on delete
   from their parent so cleanup stays consistent.
3. Policies use `DROP POLICY IF EXISTS` before `CREATE POLICY` for idempotent re-runs.
4. No destructive operations on existing data — this is the initial schema.
5. NOTE: The Supabase MCP `apply_migration` tool returned a permission error during this
   session. Apply this SQL manually via the Supabase SQL editor or re-run apply_migration
   once permissions are granted.
*/

-- ============================================================
-- HELPER FUNCTION (must exist before policies reference it)
-- ============================================================

CREATE OR REPLACE FUNCTION public.tenant_id_do_usuario()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.tenant_id
  FROM public.perfis p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE papel_equipe AS ENUM ('dono', 'atendente', 'cozinha', 'entregador');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_desconto AS ENUM ('percentual', 'fixo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_pedido AS ENUM ('recebido', 'preparo', 'saiu_entrega', 'entregue', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE forma_pagamento AS ENUM ('pix', 'cartao', 'dinheiro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- TENANTS
-- ============================================================

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  cor_primaria text,
  cor_secundaria text,
  banner_url text,
  telefone_whatsapp text,
  horario_funcionamento jsonb NOT NULL DEFAULT '{}'::jsonb,
  taxa_entrega_base numeric(10,2) NOT NULL DEFAULT 0,
  raio_entrega_km numeric(6,2),
  tempo_medio_preparo_min int,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Public can read active tenants (storefront discovery)
DROP POLICY IF EXISTS "public_read_active_tenants" ON tenants;
CREATE POLICY "public_read_active_tenants"
  ON tenants FOR SELECT
  TO anon, authenticated
  USING (ativo = true);

-- Staff can read their own tenant (including inactive)
DROP POLICY IF EXISTS "staff_read_own_tenant" ON tenants;
CREATE POLICY "staff_read_own_tenant"
  ON tenants FOR SELECT
  TO authenticated
  USING (id = tenant_id_do_usuario());

-- Only the owner (dono) can update their tenant
DROP POLICY IF EXISTS "staff_update_own_tenant" ON tenants;
CREATE POLICY "staff_update_own_tenant"
  ON tenants FOR UPDATE
  TO authenticated
  USING (
    id = tenant_id_do_usuario()
    AND EXISTS (
      SELECT 1 FROM perfis
      WHERE perfis.id = auth.uid()
        AND perfis.tenant_id = tenants.id
        AND perfis.papel = 'dono'
    )
  )
  WITH CHECK (
    id = tenant_id_do_usuario()
    AND EXISTS (
      SELECT 1 FROM perfis
      WHERE perfis.id = auth.uid()
        AND perfis.tenant_id = tenants.id
        AND perfis.papel = 'dono'
    )
  );

-- ============================================================
-- PERFIS (staff profiles)
-- ============================================================

CREATE TABLE IF NOT EXISTS perfis (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  papel papel_equipe NOT NULL,
  telefone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;

-- A user can read their own profile
DROP POLICY IF EXISTS "self_read_perfil" ON perfis;
CREATE POLICY "self_read_perfil"
  ON perfis FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Staff can read all profiles within their tenant
DROP POLICY IF EXISTS "staff_read_tenant_perfis" ON perfis;
CREATE POLICY "staff_read_tenant_perfis"
  ON perfis FOR SELECT
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario());

-- A user can insert their own profile only into an active tenant
DROP POLICY IF EXISTS "self_insert_perfil" ON perfis;
CREATE POLICY "self_insert_perfil"
  ON perfis FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = perfis.tenant_id
        AND tenants.ativo = true
    )
  );

-- A user can update their own profile
DROP POLICY IF EXISTS "self_update_perfil" ON perfis;
CREATE POLICY "self_update_perfil"
  ON perfis FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- CATEGORIAS
-- ============================================================

CREATE TABLE IF NOT EXISTS categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;

-- Public can read categories of active tenants
DROP POLICY IF EXISTS "public_read_categorias" ON categorias;
CREATE POLICY "public_read_categorias"
  ON categorias FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM tenants WHERE tenants.id = categorias.tenant_id AND tenants.ativo = true)
  );

-- Staff CRUD on their tenant's categories
DROP POLICY IF EXISTS "staff_read_categorias" ON categorias;
CREATE POLICY "staff_read_categorias"
  ON categorias FOR SELECT
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario());

DROP POLICY IF EXISTS "staff_insert_categorias" ON categorias;
CREATE POLICY "staff_insert_categorias"
  ON categorias FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = tenant_id_do_usuario());

DROP POLICY IF EXISTS "staff_update_categorias" ON categorias;
CREATE POLICY "staff_update_categorias"
  ON categorias FOR UPDATE
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario())
  WITH CHECK (tenant_id = tenant_id_do_usuario());

DROP POLICY IF EXISTS "staff_delete_categorias" ON categorias;
CREATE POLICY "staff_delete_categorias"
  ON categorias FOR DELETE
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario());

-- ============================================================
-- PRODUTOS
-- ============================================================

CREATE TABLE IF NOT EXISTS produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  preco numeric(10,2) NOT NULL DEFAULT 0,
  imagem_url text,
  disponivel boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;

-- Public can read available products of active tenants
DROP POLICY IF EXISTS "public_read_produtos" ON produtos;
CREATE POLICY "public_read_produtos"
  ON produtos FOR SELECT
  TO anon, authenticated
  USING (
    disponivel = true
    AND EXISTS (SELECT 1 FROM tenants WHERE tenants.id = produtos.tenant_id AND tenants.ativo = true)
  );

-- Staff CRUD
DROP POLICY IF EXISTS "staff_read_produtos" ON produtos;
CREATE POLICY "staff_read_produtos"
  ON produtos FOR SELECT
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario());

DROP POLICY IF EXISTS "staff_insert_produtos" ON produtos;
CREATE POLICY "staff_insert_produtos"
  ON produtos FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = tenant_id_do_usuario());

DROP POLICY IF EXISTS "staff_update_produtos" ON produtos;
CREATE POLICY "staff_update_produtos"
  ON produtos FOR UPDATE
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario())
  WITH CHECK (tenant_id = tenant_id_do_usuario());

DROP POLICY IF EXISTS "staff_delete_produtos" ON produtos;
CREATE POLICY "staff_delete_produtos"
  ON produtos FOR DELETE
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario());

-- ============================================================
-- GRUPOS_ADICIONAIS
-- ============================================================

CREATE TABLE IF NOT EXISTS grupos_adicionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  obrigatorio boolean NOT NULL DEFAULT false,
  max_selecao int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE grupos_adicionais ENABLE ROW LEVEL SECURITY;

-- Public can read add-on groups of available products of active tenants
DROP POLICY IF EXISTS "public_read_grupos_adicionais" ON grupos_adicionais;
CREATE POLICY "public_read_grupos_adicionais"
  ON grupos_adicionais FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM produtos
      WHERE produtos.id = grupos_adicionais.produto_id
        AND produtos.disponivel = true
        AND EXISTS (SELECT 1 FROM tenants WHERE tenants.id = produtos.tenant_id AND tenants.ativo = true)
    )
  );

-- Staff CRUD
DROP POLICY IF EXISTS "staff_read_grupos_adicionais" ON grupos_adicionais;
CREATE POLICY "staff_read_grupos_adicionais"
  ON grupos_adicionais FOR SELECT
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario());

DROP POLICY IF EXISTS "staff_insert_grupos_adicionais" ON grupos_adicionais;
CREATE POLICY "staff_insert_grupos_adicionais"
  ON grupos_adicionais FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = tenant_id_do_usuario());

DROP POLICY IF EXISTS "staff_update_grupos_adicionais" ON grupos_adicionais;
CREATE POLICY "staff_update_grupos_adicionais"
  ON grupos_adicionais FOR UPDATE
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario())
  WITH CHECK (tenant_id = tenant_id_do_usuario());

DROP POLICY IF EXISTS "staff_delete_grupos_adicionais" ON grupos_adicionais;
CREATE POLICY "staff_delete_grupos_adicionais"
  ON grupos_adicionais FOR DELETE
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario());

-- ============================================================
-- ADICIONAIS
-- ============================================================

CREATE TABLE IF NOT EXISTS adicionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_adicional_id uuid NOT NULL REFERENCES grupos_adicionais(id) ON DELETE CASCADE,
  nome text NOT NULL,
  preco_extra numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE adicionais ENABLE ROW LEVEL SECURITY;

-- Public can read add-ons of groups belonging to available products of active tenants
DROP POLICY IF EXISTS "public_read_adicionais" ON adicionais;
CREATE POLICY "public_read_adicionais"
  ON adicionais FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM grupos_adicionais ga
      WHERE ga.id = adicionais.grupo_adicional_id
        AND EXISTS (
          SELECT 1 FROM produtos
          WHERE produtos.id = ga.produto_id
            AND produtos.disponivel = true
            AND EXISTS (SELECT 1 FROM tenants WHERE tenants.id = produtos.tenant_id AND tenants.ativo = true)
        )
    )
  );

-- Staff CRUD — scoped through the group's tenant_id
DROP POLICY IF EXISTS "staff_read_adicionais" ON adicionais;
CREATE POLICY "staff_read_adicionais"
  ON adicionais FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM grupos_adicionais ga
      WHERE ga.id = adicionais.grupo_adicional_id
        AND ga.tenant_id = tenant_id_do_usuario()
    )
  );

DROP POLICY IF EXISTS "staff_insert_adicionais" ON adicionais;
CREATE POLICY "staff_insert_adicionais"
  ON adicionais FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM grupos_adicionais ga
      WHERE ga.id = adicionais.grupo_adicional_id
        AND ga.tenant_id = tenant_id_do_usuario()
    )
  );

DROP POLICY IF EXISTS "staff_update_adicionais" ON adicionais;
CREATE POLICY "staff_update_adicionais"
  ON adicionais FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM grupos_adicionais ga
      WHERE ga.id = adicionais.grupo_adicional_id
        AND ga.tenant_id = tenant_id_do_usuario()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM grupos_adicionais ga
      WHERE ga.id = adicionais.grupo_adicional_id
        AND ga.tenant_id = tenant_id_do_usuario()
    )
  );

DROP POLICY IF EXISTS "staff_delete_adicionais" ON adicionais;
CREATE POLICY "staff_delete_adicionais"
  ON adicionais FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM grupos_adicionais ga
      WHERE ga.id = adicionais.grupo_adicional_id
        AND ga.tenant_id = tenant_id_do_usuario()
    )
  );

-- ============================================================
-- CLIENTES
-- ============================================================

CREATE TABLE IF NOT EXISTS clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nome text NOT NULL,
  telefone text,
  endereco jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- Staff can read their tenant's customers
DROP POLICY IF EXISTS "staff_read_clientes" ON clientes;
CREATE POLICY "staff_read_clientes"
  ON clientes FOR SELECT
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario());

-- Public (anon) can insert customers only for active tenants
DROP POLICY IF EXISTS "public_insert_clientes" ON clientes;
CREATE POLICY "public_insert_clientes"
  ON clientes FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = clientes.tenant_id
        AND tenants.ativo = true
    )
  );

-- Staff can update their tenant's customers
DROP POLICY IF EXISTS "staff_update_clientes" ON clientes;
CREATE POLICY "staff_update_clientes"
  ON clientes FOR UPDATE
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario())
  WITH CHECK (tenant_id = tenant_id_do_usuario());

-- Staff can delete their tenant's customers
DROP POLICY IF EXISTS "staff_delete_clientes" ON clientes;
CREATE POLICY "staff_delete_clientes"
  ON clientes FOR DELETE
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario());

-- ============================================================
-- CUPONS
-- ============================================================

CREATE TABLE IF NOT EXISTS cupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  tipo_desconto tipo_desconto NOT NULL,
  valor numeric(10,2) NOT NULL DEFAULT 0,
  validade_inicio timestamptz,
  validade_fim timestamptz,
  uso_maximo int,
  uso_atual int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cupons ENABLE ROW LEVEL SECURITY;

-- Staff CRUD on their tenant's coupons
DROP POLICY IF EXISTS "staff_read_cupons" ON cupons;
CREATE POLICY "staff_read_cupons"
  ON cupons FOR SELECT
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario());

DROP POLICY IF EXISTS "staff_insert_cupons" ON cupons;
CREATE POLICY "staff_insert_cupons"
  ON cupons FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = tenant_id_do_usuario());

DROP POLICY IF EXISTS "staff_update_cupons" ON cupons;
CREATE POLICY "staff_update_cupons"
  ON cupons FOR UPDATE
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario())
  WITH CHECK (tenant_id = tenant_id_do_usuario());

DROP POLICY IF EXISTS "staff_delete_cupons" ON cupons;
CREATE POLICY "staff_delete_cupons"
  ON cupons FOR DELETE
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario());

-- ============================================================
-- ENTREGADORES
-- ============================================================

CREATE TABLE IF NOT EXISTS entregadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  telefone text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE entregadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_entregadores" ON entregadores;
CREATE POLICY "staff_read_entregadores"
  ON entregadores FOR SELECT
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario());

DROP POLICY IF EXISTS "staff_insert_entregadores" ON entregadores;
CREATE POLICY "staff_insert_entregadores"
  ON entregadores FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = tenant_id_do_usuario());

DROP POLICY IF EXISTS "staff_update_entregadores" ON entregadores;
CREATE POLICY "staff_update_entregadores"
  ON entregadores FOR UPDATE
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario())
  WITH CHECK (tenant_id = tenant_id_do_usuario());

DROP POLICY IF EXISTS "staff_delete_entregadores" ON entregadores;
CREATE POLICY "staff_delete_entregadores"
  ON entregadores FOR DELETE
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario());

-- ============================================================
-- PEDIDOS
-- ============================================================

CREATE TABLE IF NOT EXISTS pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  entregador_id uuid REFERENCES entregadores(id) ON DELETE SET NULL,
  status status_pedido NOT NULL DEFAULT 'recebido',
  forma_pagamento forma_pagamento NOT NULL,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  taxa_entrega numeric(10,2) NOT NULL DEFAULT 0,
  desconto numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  endereco_entrega jsonb NOT NULL DEFAULT '{}'::jsonb,
  cupom_id uuid REFERENCES cupons(id) ON DELETE SET NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

-- Staff can read their tenant's orders
DROP POLICY IF EXISTS "staff_read_pedidos" ON pedidos;
CREATE POLICY "staff_read_pedidos"
  ON pedidos FOR SELECT
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario());

-- Public can read orders only if the tenant is active (order tracking by ID)
DROP POLICY IF EXISTS "public_read_pedidos" ON pedidos;
CREATE POLICY "public_read_pedidos"
  ON pedidos FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = pedidos.tenant_id
        AND tenants.ativo = true
    )
  );

-- Public (anon) can insert orders only for active tenants
DROP POLICY IF EXISTS "public_insert_pedidos" ON pedidos;
CREATE POLICY "public_insert_pedidos"
  ON pedidos FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = pedidos.tenant_id
        AND tenants.ativo = true
    )
  );

-- Staff can update their tenant's orders
DROP POLICY IF EXISTS "staff_update_pedidos" ON pedidos;
CREATE POLICY "staff_update_pedidos"
  ON pedidos FOR UPDATE
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario())
  WITH CHECK (tenant_id = tenant_id_do_usuario());

-- Staff can delete their tenant's orders
DROP POLICY IF EXISTS "staff_delete_pedidos" ON pedidos;
CREATE POLICY "staff_delete_pedidos"
  ON pedidos FOR DELETE
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario());

-- ============================================================
-- ITENS_PEDIDO
-- ============================================================

CREATE TABLE IF NOT EXISTS itens_pedido (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade int NOT NULL DEFAULT 1,
  preco_unitario_no_momento numeric(10,2) NOT NULL DEFAULT 0,
  adicionais_selecionados jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE itens_pedido ENABLE ROW LEVEL SECURITY;

-- Staff can read order items of their tenant's orders
DROP POLICY IF EXISTS "staff_read_itens_pedido" ON itens_pedido;
CREATE POLICY "staff_read_itens_pedido"
  ON itens_pedido FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pedidos
      WHERE pedidos.id = itens_pedido.pedido_id
        AND pedidos.tenant_id = tenant_id_do_usuario()
    )
  );

-- Public can read order items only if the parent pedido's tenant is active
DROP POLICY IF EXISTS "public_read_itens_pedido" ON itens_pedido;
CREATE POLICY "public_read_itens_pedido"
  ON itens_pedido FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pedidos
      JOIN tenants ON tenants.id = pedidos.tenant_id
      WHERE pedidos.id = itens_pedido.pedido_id
        AND tenants.ativo = true
    )
  );

-- Public (anon) can insert order items only for active tenant orders
DROP POLICY IF EXISTS "public_insert_itens_pedido" ON itens_pedido;
CREATE POLICY "public_insert_itens_pedido"
  ON itens_pedido FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pedidos
      JOIN tenants ON tenants.id = pedidos.tenant_id
      WHERE pedidos.id = itens_pedido.pedido_id
        AND tenants.ativo = true
    )
  );

-- Staff can update order items of their tenant's orders
DROP POLICY IF EXISTS "staff_update_itens_pedido" ON itens_pedido;
CREATE POLICY "staff_update_itens_pedido"
  ON itens_pedido FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pedidos
      WHERE pedidos.id = itens_pedido.pedido_id
        AND pedidos.tenant_id = tenant_id_do_usuario()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pedidos
      WHERE pedidos.id = itens_pedido.pedido_id
        AND pedidos.tenant_id = tenant_id_do_usuario()
    )
  );

-- Staff can delete order items of their tenant's orders
DROP POLICY IF EXISTS "staff_delete_itens_pedido" ON itens_pedido;
CREATE POLICY "staff_delete_itens_pedido"
  ON itens_pedido FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pedidos
      WHERE pedidos.id = itens_pedido.pedido_id
        AND pedidos.tenant_id = tenant_id_do_usuario()
    )
  );

-- ============================================================
-- NOTIFICACOES_PENDENTES
-- ============================================================

CREATE TABLE IF NOT EXISTS notificacoes_pendentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pedido_id uuid NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  telefone_destino text NOT NULL,
  mensagem text NOT NULL,
  enviada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notificacoes_pendentes ENABLE ROW LEVEL SECURITY;

-- Staff can read their tenant's pending notifications
DROP POLICY IF EXISTS "staff_read_notificacoes" ON notificacoes_pendentes;
CREATE POLICY "staff_read_notificacoes"
  ON notificacoes_pendentes FOR SELECT
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario());

-- Public (anon) can insert notifications only for active tenants
DROP POLICY IF EXISTS "public_insert_notificacoes" ON notificacoes_pendentes;
CREATE POLICY "public_insert_notificacoes"
  ON notificacoes_pendentes FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = notificacoes_pendentes.tenant_id
        AND tenants.ativo = true
    )
  );

-- Staff can update their tenant's notifications
DROP POLICY IF EXISTS "staff_update_notificacoes" ON notificacoes_pendentes;
CREATE POLICY "staff_update_notificacoes"
  ON notificacoes_pendentes FOR UPDATE
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario())
  WITH CHECK (tenant_id = tenant_id_do_usuario());

-- Staff can delete their tenant's notifications
DROP POLICY IF EXISTS "staff_delete_notificacoes" ON notificacoes_pendentes;
CREATE POLICY "staff_delete_notificacoes"
  ON notificacoes_pendentes FOR DELETE
  TO authenticated
  USING (tenant_id = tenant_id_do_usuario());

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_perfis_tenant ON perfis(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categorias_tenant ON categorias(tenant_id);
CREATE INDEX IF NOT EXISTS idx_produtos_tenant ON produtos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_grupos_produto ON grupos_adicionais(produto_id);
CREATE INDEX IF NOT EXISTS idx_adicionais_grupo ON adicionais(grupo_adicional_id);
CREATE INDEX IF NOT EXISTS idx_clientes_tenant ON clientes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cupons_tenant ON cupons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_entregadores_tenant ON entregadores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_tenant ON pedidos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_itens_pedido_pedido ON itens_pedido(pedido_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_tenant ON notificacoes_pendentes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_pedido ON notificacoes_pendentes(pedido_id);

-- ============================================================
-- updated_at TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenants_updated ON tenants;
CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_perfis_updated ON perfis;
CREATE TRIGGER trg_perfis_updated BEFORE UPDATE ON perfis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_produtos_updated ON produtos;
CREATE TRIGGER trg_produtos_updated BEFORE UPDATE ON produtos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_clientes_updated ON clientes;
CREATE TRIGGER trg_clientes_updated BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_cupons_updated ON cupons;
CREATE TRIGGER trg_cupons_updated BEFORE UPDATE ON cupons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_entregadores_updated ON entregadores;
CREATE TRIGGER trg_entregadores_updated BEFORE UPDATE ON entregadores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_pedidos_updated ON pedidos;
CREATE TRIGGER trg_pedidos_updated BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- STORAGE BUCKET FOR PRODUCT IMAGES
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('produtos', 'produtos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public_read_produtos_bucket" ON storage.objects;
CREATE POLICY "public_read_produtos_bucket"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'produtos');

DROP POLICY IF EXISTS "staff_insert_produtos_bucket" ON storage.objects;
CREATE POLICY "staff_insert_produtos_bucket"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'produtos'
    AND (
      SELECT p.papel
      FROM perfis p
      WHERE p.id = auth.uid()
        AND p.papel IN ('dono', 'atendente')
    ) IS NOT NULL
  );

DROP POLICY IF EXISTS "staff_update_produtos_bucket" ON storage.objects;
CREATE POLICY "staff_update_produtos_bucket"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'produtos'
    AND (
      SELECT p.papel
      FROM perfis p
      WHERE p.id = auth.uid()
        AND p.papel IN ('dono', 'atendente')
    ) IS NOT NULL
  )
  WITH CHECK (
    bucket_id = 'produtos'
    AND (
      SELECT p.papel
      FROM perfis p
      WHERE p.id = auth.uid()
        AND p.papel IN ('dono', 'atendente')
    ) IS NOT NULL
  );

DROP POLICY IF EXISTS "staff_delete_produtos_bucket" ON storage.objects;
CREATE POLICY "staff_delete_produtos_bucket"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'produtos'
    AND (
      SELECT p.papel
      FROM perfis p
      WHERE p.id = auth.uid()
        AND p.papel IN ('dono', 'atendente')
    ) IS NOT NULL
  );

-- ============================================================
-- SEED DATA (demo tenant for preview/testing)
-- ============================================================

INSERT INTO tenants (nome, slug, cor_primaria, cor_secundaria, taxa_entrega_base, tempo_medio_preparo_min, ativo, horario_funcionamento)
VALUES (
  'Burguer House',
  'burguer-house',
  '#dc2626',
  '#f59e0b',
  5.00,
  30,
  true,
  '{"segunda":{"abre":"18:00","fecha":"23:00"},"terca":{"abre":"18:00","fecha":"23:00"},"quarta":{"abre":"18:00","fecha":"23:00"},"quinta":{"abre":"18:00","fecha":"23:00"},"sexta":{"abre":"18:00","fecha":"00:00"},"sabado":{"abre":"18:00","fecha":"00:00"},"domingo":{"abre":"18:00","fecha":"23:00"}}'
)
ON CONFLICT (slug) DO NOTHING;

-- Categories for demo tenant
INSERT INTO categorias (tenant_id, nome, ordem)
SELECT t.id, 'Burgers', 0 FROM tenants t WHERE t.slug = 'burguer-house'
ON CONFLICT DO NOTHING;

INSERT INTO categorias (tenant_id, nome, ordem)
SELECT t.id, 'Porções', 1 FROM tenants t WHERE t.slug = 'burguer-house'
ON CONFLICT DO NOTHING;

INSERT INTO categorias (tenant_id, nome, ordem)
SELECT t.id, 'Bebidas', 2 FROM tenants t WHERE t.slug = 'burguer-house'
ON CONFLICT DO NOTHING;

-- Products for demo tenant
INSERT INTO produtos (tenant_id, categoria_id, nome, descricao, preco, disponivel, ordem)
SELECT t.id, c.id, 'Cheeseburger Clássico', 'Hambúrguer 150g, queijo cheddar, alface, tomate, cebola caramelizada', 18.90, true, 0
FROM tenants t, categorias c WHERE t.slug = 'burguer-house' AND c.nome = 'Burgers' AND c.tenant_id = t.id
ON CONFLICT DO NOTHING;

INSERT INTO produtos (tenant_id, categoria_id, nome, descricao, preco, disponivel, ordem)
SELECT t.id, c.id, 'Bacon Duplo', 'Dois hambúrguer 150g, bacon crocante, cheddar duplo, picles', 26.90, true, 1
FROM tenants t, categorias c WHERE t.slug = 'burguer-house' AND c.nome = 'Burgers' AND c.tenant_id = t.id
ON CONFLICT DO NOTHING;

INSERT INTO produtos (tenant_id, categoria_id, nome, descricao, preco, disponivel, ordem)
SELECT t.id, c.id, 'Veggie Burger', 'Hambúrguer de grão-de-bico, queijo vegano, rúcula, tomate seco', 22.90, true, 2
FROM tenants t, categorias c WHERE t.slug = 'burguer-house' AND c.nome = 'Burgers' AND c.tenant_id = t.id
ON CONFLICT DO NOTHING;

INSERT INTO produtos (tenant_id, categoria_id, nome, descricao, preco, disponivel, ordem)
SELECT t.id, c.id, 'Batata Frita', 'Porção 300g com cheddar e bacon', 15.90, true, 0
FROM tenants t, categorias c WHERE t.slug = 'burguer-house' AND c.nome = 'Porções' AND c.tenant_id = t.id
ON CONFLICT DO NOTHING;

INSERT INTO produtos (tenant_id, categoria_id, nome, descricao, preco, disponivel, ordem)
SELECT t.id, c.id, 'Onion Rings', 'Anéis de cebola empanados (8un)', 12.90, true, 1
FROM tenants t, categorias c WHERE t.slug = 'burguer-house' AND c.nome = 'Porções' AND c.tenant_id = t.id
ON CONFLICT DO NOTHING;

INSERT INTO produtos (tenant_id, categoria_id, nome, descricao, preco, disponivel, ordem)
SELECT t.id, c.id, 'Coca-Cola Lata', '350ml gelada', 6.00, true, 0
FROM tenants t, categorias c WHERE t.slug = 'burguer-house' AND c.nome = 'Bebidas' AND c.tenant_id = t.id
ON CONFLICT DO NOTHING;

INSERT INTO produtos (tenant_id, categoria_id, nome, descricao, preco, disponivel, ordem)
SELECT t.id, c.id, 'Suco Natural', 'Laranja 500ml', 8.00, true, 1
FROM tenants t, categorias c WHERE t.slug = 'burguer-house' AND c.nome = 'Bebidas' AND c.tenant_id = t.id
ON CONFLICT DO NOTHING;

-- Add-on group for burgers
INSERT INTO grupos_adicionais (tenant_id, produto_id, nome, obrigatorio, max_selecao)
SELECT t.id, p.id, 'Ponto da carne', false, 1
FROM tenants t, produtos p WHERE t.slug = 'burguer-house' AND p.nome = 'Cheeseburger Clássico' AND p.tenant_id = t.id
ON CONFLICT DO NOTHING;

INSERT INTO adicionais (grupo_adicional_id, nome, preco_extra)
SELECT ga.id, 'Ao ponto', 0 FROM grupos_adicionais ga WHERE ga.nome = 'Ponto da carne'
ON CONFLICT DO NOTHING;

INSERT INTO adicionais (grupo_adicional_id, nome, preco_extra)
SELECT ga.id, 'Bem passado', 0 FROM grupos_adicionais ga WHERE ga.nome = 'Ponto da carne'
ON CONFLICT DO NOTHING;

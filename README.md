# Delivery SaaS — Multi-tenant Delivery Platform

A white-label food delivery platform (iFood-style). Each tenant (restaurant/store) gets its own public storefront at `/loja/:slug` and a staff admin panel at `/admin/:slug`. Customers order without logging in; staff authenticate with email/password.

## What's Implemented

- **Public landing page** (`/`): lists all active stores, links to each storefront
- **Public storefront** (`/loja/:slug`): browse menu by category, product details with add-on groups, cart with localStorage persistence, checkout with CEP lookup (ViaCEP), coupon validation, order tracking via realtime Supabase subscriptions
- **Admin login** (`/admin/:slug/login`): email/password auth via Supabase Auth
- **Admin dashboard** (`/admin/:slug`): today's revenue, order count, average ticket, top products, ongoing orders with realtime updates
- **Admin orders** (`/admin/:slug/pedidos`): Kanban board with drag-and-drop status updates (recebido → preparo → sau_entrega → entregue), order details, assign delivery driver
- **Admin menu** (`/admin/:slug/cardapio`): product CRUD with image, price, availability toggle; category CRUD with drag-to-reorder; add-on groups and add-ons management
- **Admin customers** (`/admin/:slug/clientes`): customer list with order history
- **Admin delivery drivers** (`/admin/:slug/entregadores`): driver CRUD with active/inactive toggle
- **Admin coupons** (`/admin/:slug/cupons`): coupon CRUD with percentage or fixed discount, validity window, usage cap
- **Admin settings** (`/admin/:slug/configuracoes`): store name, logo, banner, brand colors (applied at runtime via CSS variables), WhatsApp phone, delivery fee, prep time, business hours per day — restricted to `dono` role
- **Admin reports** (`/admin/:slug/relatorios`): revenue charts by day, order distribution by status, top products by revenue — filter by today / 7 days / 30 days
- **Role-based access control**: 4 roles (dono, atendente, cozinha, entregador) with different permissions enforced both in the UI and in database RLS policies
- **Per-tenant branding**: custom primary/secondary colors applied across the entire storefront instantly via CSS custom properties
- **Realtime**: new orders appear instantly in admin panel and customer order tracking page via Supabase Realtime
- **Database security**: RLS on every table, public read for storefront data, anon insert for orders, staff-only CRUD scoped by tenant_id

## What's Not Yet Implemented

- WhatsApp notification integration (notification queue table exists, but no edge function to send messages)
- Image upload to Supabase Storage (storage bucket and policies exist, but admin UI uses URL input only)
- Customer authentication / account area (guest checkout works, but no customer login)
- Delivery radius / zone validation (delivery fee is a flat rate, no distance-based calculation)
- Payment gateway integration (orders record payment method, but no payment processing)
- Multi-language support (Portuguese only)

## How to Run Locally

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings → API** and copy your Project URL and anon public key
3. Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 3. Apply the database schema

1. Open the Supabase Dashboard → **SQL Editor**
2. Paste the entire contents of `database_schema.sql`
3. Click **Run** — this creates all tables, RLS policies, indexes, triggers, the storage bucket, and seed data (a demo store called "Burguer House" with burgers, sides, drinks, and add-on groups)

### 4. Start the dev server

```bash
npm run dev
```

The app runs at `http://localhost:5173`.

### 5. View the demo store

Visit `http://localhost:5173/loja/burguer-house` to see the seeded demo store with products and categories.

### 6. Access the admin panel

To manage a store, you need a Supabase Auth user linked to a tenant:

1. Go to **Supabase Dashboard → Authentication → Users → Add user**
2. Enter an email and password, click **Create user**
3. Copy the user's UUID
4. Run this SQL in the Supabase SQL Editor (replace the UUIDs):

```sql
-- Link the auth user to the demo tenant as owner
INSERT INTO perfis (id, tenant_id, nome, papel)
VALUES (
  'paste-user-uuid-here',
  (SELECT id FROM tenants WHERE slug = 'burguer-house'),
  'Seu Nome',
  'dono'
);
```

5. Visit `http://localhost:5173/admin/burguer-house/login` and sign in with the email/password

## How to Configure a New Tenant

1. Insert a tenant row in the Supabase SQL Editor:

```sql
INSERT INTO tenants (nome, slug, taxa_entrega_base, ativo)
VALUES ('Minha Loja', 'minha-loja', 5.00, true);
```

2. Create an admin user in **Supabase Dashboard → Authentication → Users → Add user**

3. Link the user to the tenant:

```sql
INSERT INTO perfis (id, tenant_id, nome, papel)
VALUES (
  'user-uuid',
  (SELECT id FROM tenants WHERE slug = 'minha-loja'),
  'Nome do Dono',
  'dono'
);
```

4. The storefront is at `/loja/minha-loja` and the admin panel at `/admin/minha-loja/login`

5. In the admin panel → **Configurações**, set logo, banner, brand colors, WhatsApp, delivery fee, and business hours

## Deployment

### Vercel

1. Push the project to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → **New Project** → import the repo
3. Framework preset: **Vite**
4. Add environment variables:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon public key
5. Click **Deploy**

### Netlify

1. Push the project to a GitHub repository
2. Go to [netlify.com](https://netlify.com) → **Add new site → Import from Git**
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add environment variables (same as above)
6. Click **Deploy site**

### Supabase Configuration for Production

Make sure your Supabase project has:
- **Authentication → Email provider**: enabled (no email confirmation required)
- **Database → RLS**: enabled on all tables (the schema script handles this)
- **Storage → Bucket "produtos"**: set to public (the schema script creates it)
- **API Settings**: the anon key should have access to your project

## Roles & Permissions

| Role | Dashboard | Pedidos | Cardápio | Clientes | Entregadores | Cupons | Configurações | Relatórios |
|------|-----------|---------|----------|----------|-------------|--------|---------------|------------|
| Dono | Yes | Yes (edit) | Yes (edit) | Yes | Yes | Yes | Yes | Yes |
| Atendente | Yes | Yes (edit) | Yes (edit) | Yes | Yes | Yes | No | Yes |
| Cozinha | Yes | Yes (read) | Yes (read) | No | No | No | No | No |
| Entregador | Yes | Yes (own deliveries) | No | No | No | No | No | No |

## Project Structure

```
src/
  admin/           Admin panel pages (dashboard, pedidos, cardapio, etc.)
  components/       Shared components (AdminLayout, CartDrawer, ProductModal, etc.)
  hooks/           Custom hooks (useAuth, useCart, useTenant)
  lib/              Utilities, types, Supabase client
  loja/            Public storefront pages (home, checkout, order status)
  App.tsx          Routing
  Home.tsx         Landing page (tenant directory)
  index.css        Design system (CSS variables, component classes)
database_schema.sql  Full schema + RLS policies + seed data
```

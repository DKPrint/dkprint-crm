-- DKPrint CRM v1 — initial schema (TZ §14)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  user_id UUID UNIQUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','photo_center','production','designer','courier')),
  client_id UUID REFERENCES clients(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE clients
  ADD CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

CREATE TABLE permission_overrides (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  can_access_reports BOOLEAN NOT NULL DEFAULT false,
  can_edit_price BOOLEAN NOT NULL DEFAULT false,
  can_cancel_order BOOLEAN NOT NULL DEFAULT false,
  can_soft_delete_order BOOLEAN NOT NULL DEFAULT false,
  can_manage_sla BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  skip_designer BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE status_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('forward','backward','cancel')),
  allowed_roles TEXT[] NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (from_status, to_status)
);

CREATE TABLE sla_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  target_hours INT NOT NULL CHECK (target_hours > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system_default BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE order_daily_sequences (
  order_date DATE PRIMARY KEY,
  last_sequence INT NOT NULL DEFAULT 0
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  order_date DATE NOT NULL,
  daily_sequence INT NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id),
  status TEXT NOT NULL,
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  created_by_role TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('photo_center','production','admin')),
  courier_note TEXT,
  ttn_checked BOOLEAN NOT NULL DEFAULT false,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  sla_started_at TIMESTAMPTZ NOT NULL,
  sla_stopped_at TIMESTAMPTZ,
  sla_overdue_notified_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  deleted_at TIMESTAMPTZ,
  deleted_by_user_id UUID REFERENCES users(id),
  delete_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_date, daily_sequence)
);

CREATE INDEX orders_client_status_created_idx ON orders (client_id, status, created_at DESC);
CREATE INDEX orders_status_created_alive_idx ON orders (status, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  position_number INT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id),
  tech_params TEXT,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, position_number)
);

CREATE TABLE order_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by_user_id UUID NOT NULL REFERENCES users(id),
  reason TEXT,
  is_admin_jump BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  order_item_id UUID REFERENCES order_items(id),
  action TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  order_item_id UUID NOT NULL REFERENCES order_items(id),
  block TEXT NOT NULL CHECK (block IN ('client','designer')),
  storage_key TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  upload_status TEXT NOT NULL CHECK (upload_status IN ('pending','confirmed','failed')),
  uploaded_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  user_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  is_problematic_layout BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  order_id UUID REFERENCES orders(id),
  assignee_user_id UUID NOT NULL REFERENCES users(id),
  creator_user_id UUID NOT NULL REFERENCES users(id),
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  order_id UUID REFERENCES orders(id),
  payload JSONB,
  sent_push BOOLEAN NOT NULL DEFAULT false,
  sent_telegram BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

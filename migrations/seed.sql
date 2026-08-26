-- Seed v1 (TZ §19) — run after 001_init.sql
-- Admin password must be hashed by app seed script; placeholder hash replaced at deploy.

INSERT INTO categories (name, sort_order) VALUES
  ('Печать', 1),
  ('Сувенирка', 2),
  ('Цифровая печать', 3);

INSERT INTO sla_goals (from_status, to_status, target_hours, is_active, is_system_default)
VALUES ('new', 'delivered', 72, true, true);

-- Forward transitions
INSERT INTO status_transitions (from_status, to_status, direction, allowed_roles) VALUES
  ('new', 'accepted', 'forward', ARRAY['admin','production','designer']),
  ('accepted', 'at_designer', 'forward', ARRAY['admin','production','designer']),
  ('at_designer', 'in_production', 'forward', ARRAY['admin','production','designer']),
  ('in_production', 'ready_for_pickup', 'forward', ARRAY['admin','production','designer']),
  ('ready_for_pickup', 'with_courier', 'forward', ARRAY['admin','courier']),
  ('with_courier', 'delivered', 'forward', ARRAY['admin','courier']);

-- Backward
INSERT INTO status_transitions (from_status, to_status, direction, allowed_roles) VALUES
  ('accepted', 'new', 'backward', ARRAY['admin','production','designer']),
  ('at_designer', 'accepted', 'backward', ARRAY['admin','production','designer']),
  ('in_production', 'at_designer', 'backward', ARRAY['admin','production','designer']),
  ('ready_for_pickup', 'in_production', 'backward', ARRAY['admin','production','designer']),
  ('with_courier', 'ready_for_pickup', 'backward', ARRAY['admin','courier']),
  ('delivered', 'with_courier', 'backward', ARRAY['admin','courier']);

-- Cancel from non-terminal (except delivered) — applied in app; seed examples:
INSERT INTO status_transitions (from_status, to_status, direction, allowed_roles) VALUES
  ('new', 'cancelled', 'cancel', ARRAY['admin','production']),
  ('accepted', 'cancelled', 'cancel', ARRAY['admin','production']),
  ('at_designer', 'cancelled', 'cancel', ARRAY['admin','production']),
  ('in_production', 'cancelled', 'cancel', ARRAY['admin','production']),
  ('ready_for_pickup', 'cancelled', 'cancel', ARRAY['admin','production']),
  ('with_courier', 'cancelled', 'cancel', ARRAY['admin','production']);

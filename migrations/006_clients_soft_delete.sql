-- TZ §7: soft-delete external clients (admin only); photo_center clients blocked in app code.

ALTER TABLE clients
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ADD COLUMN deleted_by_user_id UUID REFERENCES users(id),
  ADD COLUMN delete_comment TEXT;

CREATE INDEX clients_alive_name_idx ON clients (name) WHERE deleted_at IS NULL;

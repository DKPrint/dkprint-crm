-- TZ §3.2: admin can deny role-granted permissions per user.

ALTER TABLE permission_overrides
  ADD COLUMN deny_access_reports BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN deny_edit_price BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN deny_cancel_order BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN deny_soft_delete_order BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN deny_manage_sla BOOLEAN NOT NULL DEFAULT false;

import type { PermissionGrantFlags, Role } from '@/lib/auth/permissions';

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Админ',
  photo_center: 'Фотоцентр',
  production: 'Производство',
  designer: 'Дизайнер',
  courier: 'Курьер',
};

export const PERMISSION_LABELS: Record<keyof PermissionGrantFlags, string> = {
  can_access_reports: 'Доступ к отчётам',
  can_edit_price: 'Редактирование цены',
  can_cancel_order: 'Отмена заказа',
  can_soft_delete_order: 'Soft-delete заказа',
  can_manage_sla: 'Управление SLA',
};

export const ADMIN_USER_ROLES: Role[] = [
  'admin',
  'photo_center',
  'production',
  'designer',
  'courier',
];

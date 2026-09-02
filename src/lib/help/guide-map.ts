import type { Role } from '@/lib/auth/permissions';

/** Filename under docs/user-guides (and deploy mirror src/content/user-guides). */
export const GUIDE_FILE_BY_ROLE: Record<Role, string> = {
  admin: '00-admin.md',
  photo_center: '01-photo-center.md',
  production: '02-production.md',
  designer: '03-designer.md',
  courier: '04-courier.md',
};

/** RU page subtitle for the role's guide. */
export function guideTitle(role: Role): string {
  switch (role) {
    case 'admin':
      return 'Администратор';
    case 'photo_center':
      return 'Фотоцентр';
    case 'production':
      return 'Производство';
    case 'designer':
      return 'Дизайнер';
    case 'courier':
      return 'Курьер';
  }
}

export function guideFileForRole(role: Role): string {
  return GUIDE_FILE_BY_ROLE[role];
}

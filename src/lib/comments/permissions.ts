import type { SessionUser } from '@/lib/auth/assertOrderAccess';

/** Courier cannot write comments (TZ §10.1 / §3). */
export function canWriteComment(user: SessionUser): boolean {
  return user.role !== 'courier';
}

export function assertCanWriteComment(user: SessionUser): void {
  if (!canWriteComment(user)) {
    throw new Error('forbidden');
  }
}

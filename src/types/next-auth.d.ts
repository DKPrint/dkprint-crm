import type { DefaultSession } from 'next-auth';
import type { Role } from '@/lib/auth/permissions';

declare module 'next-auth' {
  interface User {
    role: Role;
    clientId: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      clientId: string | null;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: Role;
    clientId?: string | null;
  }
}

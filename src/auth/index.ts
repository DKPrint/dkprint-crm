import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import type { Role } from '@/lib/auth/permissions';

/**
 * Auth.js (NextAuth v5) — Credentials + JWT session (TZ §2, §15.1).
 * DB user lookup / password verify: wire in Phase 0 against Neon.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async () => {
        // Stub: replace with bcrypt verify + users row
        return null;
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token }) {
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.sub;
        (session.user as { role?: Role }).role = token.role as Role | undefined;
      }
      return session;
    },
  },
});

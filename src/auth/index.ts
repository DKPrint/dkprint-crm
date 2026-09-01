import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';
import { sql } from '@/lib/db';
import type { Role } from '@/lib/auth/permissions';
import { checkRateLimit, getLoginRateLimitConfig } from '@/lib/rate-limit';

function clientIpFromHeaders(h: Headers): string {
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = h.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'unknown';
}

/**
 * Auth.js (NextAuth v5) — Credentials + JWT session (TZ §2, §15.1).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        const email =
          typeof credentials?.email === 'string' ? credentials.email.trim().toLowerCase() : '';
        const password = typeof credentials?.password === 'string' ? credentials.password : '';
        if (!email || !password) return null;

        const h = await headers();
        const ip = clientIpFromHeaders(h);
        const loginLimit = checkRateLimit(`login:${ip}:${email}`, getLoginRateLimitConfig());
        if (!loginLimit.ok) {
          console.warn('[rate-limit] login', { ip, email });
          return null;
        }

        const rows = await sql`
          SELECT id, email, password_hash, display_name, role, client_id, is_active
          FROM users
          WHERE email = ${email}
          LIMIT 1
        `;
        const row = rows[0] as
          | {
              id: string;
              email: string;
              password_hash: string;
              display_name: string;
              role: Role;
              client_id: string | null;
              is_active: boolean;
            }
          | undefined;

        if (!row || row.is_active !== true) return null;

        const ok = await bcrypt.compare(password, row.password_hash);
        if (!ok) return null;

        return {
          id: row.id,
          email: row.email,
          name: row.display_name,
          role: row.role,
          clientId: row.client_id,
        };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.clientId = user.clientId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as Role;
        session.user.clientId = (token.clientId as string | null) ?? null;
      }
      return session;
    },
  },
});

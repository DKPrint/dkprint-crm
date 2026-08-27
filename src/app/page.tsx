import { redirect } from 'next/navigation';
import { signOut } from '@/auth';
import { requireAuth } from '@/lib/auth/requireAuth';

export default async function Home() {
  const session = await requireAuth();
  if (!session) {
    redirect('/login');
  }

  const { email, role } = session.user;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold text-[#164e63]">DKPrint CRM</h1>
      <p className="text-sm text-[#164e63]/opacity-80">
        {email} · {role}
      </p>
      <form
        action={async () => {
          'use server';
          await signOut({ redirectTo: '/login' });
        }}
      >
        <button
          type="submit"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-[#164e63]"
        >
          Выйти
        </button>
      </form>
    </main>
  );
}

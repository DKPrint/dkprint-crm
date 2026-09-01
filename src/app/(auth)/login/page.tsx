import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/requireAuth';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  const session = await requireAuth();
  if (session) {
    redirect('/dashboard');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold text-[#164e63]">DKPrint CRM</h1>
      <p className="text-sm text-[#164e63]/opacity-80">Вход (Auth.js Credentials)</p>
      <LoginForm />
    </main>
  );
}

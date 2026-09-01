'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      setPending(false);

      if (!result?.ok) {
        setError('Неверный email или пароль');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setPending(false);
      setError('Неверный email или пароль');
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          className="rounded-lg border border-slate-200 px-3 py-2"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Пароль
        <input
          className="rounded-lg border border-slate-200 px-3 py-2"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#22C55E] px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {pending ? 'Вход…' : 'Войти'}
      </button>
    </form>
  );
}

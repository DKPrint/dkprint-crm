export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold text-[#164e63]">DKPrint CRM</h1>
      <p className="text-sm text-[#164e63]/opacity-80">
        Вход (Auth.js Credentials). Подключение к Neon — следующий шаг Фазы 0.
      </p>
      <form className="flex flex-col gap-3" action="/api/auth/signin/credentials" method="post">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            name="email"
            type="email"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Пароль
          <input
            className="rounded-lg border border-slate-200 px-3 py-2"
            name="password"
            type="password"
            required
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-[#22C55E] px-4 py-3 font-semibold text-white"
        >
          Войти
        </button>
      </form>
    </main>
  );
}

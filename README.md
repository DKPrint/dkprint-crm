# DKPrint CRM

Операционная CRM для типографии и сети фотоцентров.

**ТЗ:** [`docs/DKPrint-CRM-TZ-v1.md`](docs/DKPrint-CRM-TZ-v1.md) (v1.3)  
**Дизайн:** [`design-system/dkprint-crm/`](design-system/dkprint-crm/)  
**Auth:** Auth.js / `next-auth` `^5.0.0-beta.32` — Credentials + JWT session

> **Важно:** без `AUTH_SECRET` в `.env` логин Auth.js не заработает. Скопируйте `.env.example` → `.env` и задайте секрет.

## Agents / skills

Используется установленный **[cocolwy/cursor-agents (MCCA)](https://github.com/cocolwy/cursor-agents)** (глобально в `~/.cursor/agents` и `~/.cursor/skills`).

Команды в чате Cursor: `/code`, `/goal`, `/init`, `/review`, `/commit`, `/test`, …

После клона полезно один раз: `/init` → сгенерирует `.cursor/rules/project-context.mdc`.

## Phase 0 status

- [x] Next.js + TS strict + ESLint + Prettier + CI
- [x] `migrations/001_init.sql` + `seed.sql`
- [x] `.env.example` (§18) + `.gitignore` для `.env*`
- [x] Neon client (`src/lib/db`) + Credentials authorize + JWT session
- [x] Login form + auth-aware home shell
- [x] `lib/money` (`recalcOrderTotal`), `lib/auth` (`requireAuth`, permissions)
- [x] Status-transition stubs + unit tests
- [x] Seed admin: `npm run seed:admin`

## Database setup (Neon)

1. Create a Neon project and set `DATABASE_URL` in `.env`
2. Apply schema: run `migrations/001_init.sql` in the Neon SQL editor (or `psql`)
3. Apply seed data: run `migrations/seed.sql` (categories, SLA, status_transitions)
4. Create admin: `npm run seed:admin` (needs `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD` in `.env`)
5. Optional demo roster (keeps admin, resets other users): `CONFIRM_SEED_DEMO=yes npm run seed:demo`

`seed:admin` loads `.env` via `tsx --env-file=.env`. Script is idempotent on email.

### Demo logins (`seed:demo`)

| Email                      | Role         | Client  |
| -------------------------- | ------------ | ------- |
| `point-a@dkprint.local`    | photo_center | Точка А |
| `point-b@dkprint.local`    | photo_center | Точка Б |
| `production@dkprint.local` | production   | —       |
| `designer@dkprint.local`   | designer     | —       |
| `courier@dkprint.local`    | courier      | —       |

Default password: `Demo123!` (override with `SEED_DEMO_PASSWORD`).

## Commands

```bash
npm install
npm run dev
npm run seed:admin
npm run typecheck && npm run lint && npm run format:check && npm test
```

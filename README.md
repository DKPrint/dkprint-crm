# DKPrint CRM

Операционная CRM для типографии и сети фотоцентров.

**ТЗ:** [`docs/DKPrint-CRM-TZ-v1.md`](docs/DKPrint-CRM-TZ-v1.md) (v1.3)  
**Дизайн:** [`design-system/dkprint-crm/`](design-system/dkprint-crm/)  
**Auth:** Auth.js (NextAuth v5) Credentials + JWT session

## Agents / skills

Используется установленный **[cocolwy/cursor-agents (MCCA)](https://github.com/cocolwy/cursor-agents)** (глобально в `~/.cursor/agents` и `~/.cursor/skills`).

Команды в чате Cursor: `/code`, `/goal`, `/init`, `/review`, `/commit`, `/test`, …

После клона полезно один раз: `/init` → сгенерирует `.cursor/rules/project-context.mdc`.

## Phase 0 status

- [x] Next.js + TS strict + ESLint + Prettier + CI
- [x] `migrations/001_init.sql` + `seed.sql`
- [x] `.env.example`
- [x] `lib/money`, `lib/auth` stubs + unit tests
- [x] Auth.js route + `/login` stub
- [ ] Neon `DATABASE_URL` + реальный Credentials authorize
- [ ] Seed admin user из env

## Commands

```bash
npm install
npm run dev
npm run typecheck && npm run lint && npm run format:check && npm test
```

# HANDOFF — DKPrint CRM

Short status for a new chat / agent. Spec: `@docs/DKPrint-CRM-TZ-v1.md` (**v1.7**). Ops: `@OPS.md`. QA: `@docs/QA-22-acceptance-report.md`.

## Phase status (§21 / §20.11)

| Phase  | Deliverable                                                                | Status                                                              |
| ------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **0**  | Repo, Auth.js, Neon, migrations, seed, CI, `lib/money` / `lib/auth`, rules | **Done**                                                            |
| **1**  | Orders CRUD, status engine, `assertOrderAccess`, unit §20.5                | **Done**                                                            |
| **2**  | R2 presign/confirm/download                                                | **Done**                                                            |
| **3**  | UI orders (+ name, urgent, polling, audit)                                 | **Done**                                                            |
| **4**  | Workshop queue (+ composition / layout flag)                               | **Done**                                                            |
| **5**  | Comments; Web Push; Telegram live card                                     | **Done**                                                            |
| **5+** | OPS/HANDOFF drafts; cron SLA endpoint                                      | **Done**                                                            |
| **6**  | Clients + Tasks (API + UI)                                                 | **Done**                                                            |
| **7**  | Admin SLA UI + cron hardening                                              | **Done**                                                            |
| **8**  | Reports KPI + export CSV/xlsx + print                                      | **Done**                                                            |
| **9**  | Admin users CRUD + permission flags / deny                                 | **Done**                                                            |
| **9b** | Catalog §13.1 (schema, admin, import/export, order form, BOM stub)         | **Done**                                                            |
| **10** | QA §22 + OPS/HANDOFF final                                                 | **In progress** (code QA doc done; **manual 5-role smoke pending**) |

### Stub / deferred (not v1 app scope)

| Item                             | Status                                                  |
| -------------------------------- | ------------------------------------------------------- |
| Warehouse write-off from BOM     | **Roadmap +2** (tables exist; no UI/API)                |
| Public calculator / site pricing | **Out of v1**                                           |
| Legacy flat `categories` admin   | **Redirect** → `/admin/catalog`                         |
| Catalog **prod** import from 1С  | **Deferred** — see §Catalog below                       |
| FC «Прайс ФЦ» import             | **Commercial add-on** (documented OPS/TZ; code in repo) |
| E2E Playwright all roles         | **Deferred** (§20.8)                                    |

## Shipped highlights (main)

- Auth.js v5 Credentials + JWT; `requireAuth` reloads user/`is_active`/flags from DB
- Orders: isolation, status graph, cancel / soft-delete / admin jump, money `lib/money`
- R2 presigned upload/download; key `dkprint/{R2_ENV}/orders/{orderNumber}/…`
- Workshop, comments, Web Push, Telegram live card (not on item CRUD)
- Clients (incl. admin soft-delete external), tasks, reports (+ export), admin users, admin SLA, admin catalog
- Permission **deny_*** flags; catalog category snapshot on order lines (008)
- Rate limit: login (IP+email) + `POST /api/admin/catalog/import` only
- **`/dashboard`** home (Boxmart-style): role-scoped summary + month KPI when reports access
- Cron `/api/cron/sla-overdue`; Vercel Hobby schedule `0 6 * * *` (see OPS)
- Prod fix: catalog order lines `category_id` NULL; hydration #418; Hobby cron

## Catalog — staging vs prod import

**Staging / smoke:** use **stub** catalog (manual admin or small test xlsx). Empty DB OK with ops-inserted smoke product (see Neon smoke below).

**Base v1 format:** canonical 1С flat sheet columns A–G (OPS).

**FC «Прайс ФЦ»:** commercial add-on — optional multi-sheet parser; not required for v1 acceptance.

**Prod 1С import — deferred until:**

1. Real production xlsx sample available
2. **Leaf-policy** edge-case fixed (products on non-leaf when root has children — documented in OPS)
3. Smoke: import → export → re-import with ☑ replace prices
4. Reports «По категориям» use `catalog_category_path` snapshot (008 applied on prod)

§22.8 code gate: **pass** for staging; prod import = **blocked** on checklist above.

## QA §22

Static audit + unit tests: `@docs/QA-22-acceptance-report.md` (2026-09-01).

- Manual **5-role smoke** still **pending** (Phase 10)

## Do not

- Reintroduce the old static demo UI
- Use IEEE float for money; bypass `lib/money`
- Change status outside `status_transitions` (+ admin jump)
- Put secrets in `NEXT_PUBLIC_*` or commit real `.env`
- Call `syncOrderTelegramCard` from item add/patch/delete/price
- Trust UI-only hiding as authorization
- Barrel-re-export inside `"use server"` files
- Ship catalog as separate microservice in v1
- Remove FC parser code (document as add-on only)

## Before push

`npm run typecheck && npm run lint && npm run format:check && npm test`

## Neon (summary — detail in OPS.md)

Apply in order on existing DBs; greenfield from current `001_init.sql` + `seed.sql` may skip `002`–`005` if columns already present.

1. `001_init.sql` → `seed.sql` → `002` … `008_order_items_catalog_category.sql` → `npm run seed:admin`
2. Optional demo roster: `CONFIRM_SEED_DEMO=yes npm run seed:demo`
3. Prod **must** have `005` before catalog-line orders (`catalog_product_id`, `is_manual`, nullable `category_id`)

**Verified on Neon (2026-09-01):** `002`–`008` applied.

Post-`005` smoke:

- `\d catalog_products`, `\d order_items`
- Login admin → `GET /api/orders` 200
- POST order: manual line + catalog line (catalog line: `category_id` NULL, `catalog_product_id` set)
- Catalog stub OK for read/snapshot tests

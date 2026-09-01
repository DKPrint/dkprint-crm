# QA — §22 (22.1–22.9) + §20.7 DoD

**Дата:** 2026-09-01  
**Репозиторий:** dkprint-crm @ `main` (после Phase 8b export `bb612d1`)  
**Метод:** статический аудит кода + unit-тесты (`npm test` → **169 pass**). Без e2e, без ручного staging smoke.  
**Refactoring:** не выполнялся.

**Легенда:** ✅ pass · ❌ fail · ⏸ blocked (нужен ручной/инфра smoke)

---

## §20.7 Definition of Done

| # | Критерий | Статус | Доказательство |
|---|----------|--------|----------------|
| 20.7.1 | Права на сервере (§20.9) | ✅ pass | `lib/auth/permissions.ts` (`can`), domain `assert*Access` (clients, tasks, files, reports, catalog, workshop) |
| 20.7.2 | Заказы через `assertOrderAccess` | ✅ pass | `lib/auth/assertOrderAccess.ts`; вызовы в `queries.ts`, `apply-status.ts`, `update-order.ts`, `presign.ts`, `soft-delete.ts`, item CRUD |
| 20.7.3 | Цена/qty → audit + `lib/money` | ✅ pass | `create-order.ts` (`recalcOrderTotal`); `update-order.ts` + `order_audit_logs`; `item-input.ts` catalog price SoT |
| 20.7.4 | Статус → events + transitions | ✅ pass | `apply-status.ts` CTE + `order_status_events`; `status-transitions.ts` (`canTransition`, `loadActiveTransitions`) |
| 20.7.5 | Cancelled / soft-deleted вне KPI/списков | ✅ pass | `orders/kpi.ts` (`isInKpi`, `KPI_SQL_PREDICATE`); `ordersVisibleWhere`; `reports/queries.ts`; workshop без deleted |
| 20.7.6 | Нет секретов в клиенте; presigned не в логах | ✅ pass | `CRON_SECRET`/`AUTH_SECRET` только server env; presign логирует key/order_number, не URL |
| 20.7.7 | Ручная проверка роли из seed | ⏸ blocked | Нет e2e; требует smoke 5 ролей на staging (см. §22 итог) |
| 20.7.8 | tsc + lint + prettier | ✅ pass | `npm test` 169/169; CI `.github/workflows/ci.yml` (typecheck, lint, format:check, test) |

---

## §22.1 Роли и изоляция

| # | Критерий | Статус | Доказательство |
|---|----------|--------|----------------|
| 22.1.1 | Photo center A не видит B | ✅ pass | `assertOrderAccess` по `client_id`; `ordersVisibleWhere` фильтр; test `permissions.test.ts` «isolates photo_center» |
| 22.1.2 | Photo center видит заказы своей точки (в т.ч. от production) | ✅ pass | Изоляция по `order.client_id`, не по `created_by`; `listOrders` принудительно `user.clientId` |
| 22.1.3 | Production и designer видят все заказы | ✅ pass | `ordersVisibleWhere` — только `excludeDeleted`, без client filter |
| 22.1.4 | Courier: только выдача; без задач и файлов | ✅ pass | `assertOrderAccess` — 3 delivery statuses; `tasks/access.ts` deny courier; `files/permissions.test.ts`; nav courier → `/orders` only |

---

## §22.2 Заказы

| # | Критерий | Статус | Доказательство |
|---|----------|--------|----------------|
| 22.2.1 | `DK-YYMMDD-N`, уникальный, атомарный, APP_TIMEZONE | ✅ pass | `order-number.ts`, CTE `order_daily_sequences` в `create-order.ts`; UNIQUE `order_number` в `001_init.sql`; tests `order-number.test.ts`, `create-order.test.ts`. ⏸ prod race smoke не автоматизирован |
| 22.2.2 | Цена × qty; total на сервере | ✅ pass | `lib/money` (`lineTotal`, `recalcOrderTotal`); tests `money/index.test.ts`, `item-input.test.ts` |
| 22.2.3 | Photo center edit только `new` + audit | ✅ pass | `edit-policy.ts` → `assertCanEditOrderFields`; `update-order.ts` → `order_audit_logs` |
| 22.2.4 | Production edit только `source=production` | ✅ pass | `edit-policy.ts`: `order.source !== 'production'` → forbidden |
| 22.2.5 | Production не edit заказов точек | ✅ pass | Тот же gate; photo_center orders имеют `source=photo_center` |

---

## §22.3 Статусы

| # | Критерий | Статус | Доказательство |
|---|----------|--------|----------------|
| 22.3.1 | ←/→ только соседний шаг | ✅ pass | `apply-status.ts` modes `next`/`prev` + `getStatusNeighbors`; test `status-transitions.test.ts` |
| 22.3.2 | Admin модал «Перейти в…» | ✅ pass | UI `status-controls.tsx`; API `/api/orders/[id]/status/jump`; `isAdminJump` |
| 22.3.3 | new → accepted: production и designer | ✅ pass | `SEED_TRANSITIONS` edge; test «allows happy forward new→accepted for production»; designer на том же ребре в seed |
| 22.3.4 | v1 всегда через `at_designer` вперёд | ✅ pass | Граф `accepted→at_designer→in_production`; full chain test |
| 22.3.5 | Production/designer не в `with_courier`/`delivered` | ✅ pass | Рёбра только admin/courier; test «forbids production→with_courier» |

---

## §22.4 Отмена / удаление

| # | Критерий | Статус | Доказательство |
|---|----------|--------|----------------|
| 22.4.1 | Отмена = статус + причина; designer без кнопки | ✅ pass | `apply-status.ts` cancel + reason; UI `actions.tsx` hides; `can('designer','cancel_order')` always false |
| 22.4.2 | Soft-delete = скрытие + пароль user + comment | ✅ pass | `soft-delete.ts` bcrypt + comment; API route; test `soft-delete.test.ts` |
| 22.4.3 | Оба исключены из KPI | ✅ pass | `kpi.test.ts`; reports/workshop/list filters |
| 22.4.4 | SLA stopped при отмене и delete | ✅ pass | Cancel: `sla_stopped_at = now()` в `apply-status.ts`; soft-delete: `COALESCE(sla_stopped_at, now())` |

---

## §22.5 Файлы

| # | Критерий | Статус | Доказательство |
|---|----------|--------|----------------|
| 22.5.1 | Upload R2 presigned; не через server body | ✅ pass | `files/presign.ts`; routes `api/files/presign`, `confirm` |
| 22.5.2 | Два блока client/designer | ✅ pass | `files.tsx` blocks `client`/`designer`; `files/constants.ts` |
| 22.5.3 | Production догрузка client | ✅ pass | `canUploadBlock()` allows production on `client` |
| 22.5.4 | Courier без доступа | ✅ pass | `assertNotCourier()` on file ops; test `files/permissions.test.ts` |

---

## §22.6 Уведомления

| # | Критерий | Статус | Доказательство |
|---|----------|--------|----------------|
| 22.6.1 | Новый заказ — push не другим точкам | ✅ pass | `push.ts` `resolvePushRecipientIds('order_created')` → admin/production/designer (не photo_center) |
| 22.6.2 | Готов к выдаче → courier push | ✅ pass | `hooks.ts` `runStatusChanged` при `ready_for_pickup` |
| 22.6.3 | ☑ Проблемный макет → push + TG | ✅ pass | `runCommentAdded` + `buildOrderTelegramCard` flag; test `telegram.test.ts` |
| 22.6.4 | SLA overdue → push + TG; cron dedup 24ч | ✅ pass | `/api/cron/sla-overdue`; `findSlaOverdueOrderIds` 24h; `notifySlaOverdue`; test `cron/auth.test.ts` |
| 22.6.5 | TG: одна карточка; create; edit на status | ✅ pass | `telegram_message_id`; `sendOrderTelegramCard`/`syncOrderTelegramCard`; cancel → `runStatusChanged` |
| 22.6.6 | TG: статус жирным; последний комментарий; courier не пишет | ✅ pass | `<b>Статус:` в card builder; `comments/permissions.ts` deny courier write |
| 22.6.7 | TG ошибки не откатывают CRM; fallback send | ✅ pass | Status commit до notify; `syncTelegramCardCore` fallback; errors logged only |

**Инвариант (не в §22, но §20):** TG sync **не** на item CRUD — ✅ `order-items.ts` без telegram imports.

---

## §22.7 Модули

| # | Критерий | Статус | Доказательство |
|---|----------|--------|----------------|
| 22.7.1 | Очередь без `new` | ✅ pass | `WORKSHOP_STATUSES` excludes `new`; `listWorkshopQueue`; test `workshop/statuses.test.ts` |
| 22.7.2 | ТТН только production/admin | ✅ pass | `updateTtn` role gate; UI `orders-list.tsx` `CAN_TTN`; API `/api/orders/[id]/ttn` |
| 22.7.3 | Задачи: Все = Мои ∪ Поставленные | ✅ pass | `listTasks` SQL OR assignee/creator; test `tasks/access.test.ts` |
| 22.7.4 | Отчёты по флагу / admin | ✅ pass | `assertReportsAccess`; `withReportsAuth` на 8 routes; nav + test `reports/access.test.ts` |
| 22.7.5 | 5 permission flags в admin UI | ✅ pass | `admin/users/user-form.tsx`; `editablePermissionKeys()`; test `admin-users/` |

**Примечание (не §22 пункт):** отчёт «По категориям» для catalog-линий (`category_id NULL`) группирует в «Без категории» — KPI filter OK, группировка неточна (`reports/queries.ts` join по `oi.category_id`).

---

## §22.8 Каталог (§13.1)

| # | Критерий | Статус | Доказательство |
|---|----------|--------|----------------|
| 22.8.1 | Import xlsx; совпадения не затираются | ✅ pass | `import-rules.ts` skip/create; test `catalog/import-rules.test.ts`. ⏸ leaf-policy edge (HANDOFF defer) до prod 1С sample |
| 22.8.2 | ☑ «Заменить цены» — только matched | ✅ pass | `update_price` action; tested in import-rules |
| 22.8.3 | Export xlsx | ✅ pass | `GET /api/admin/catalog/export`; `buildCatalogXlsx` |
| 22.8.4 | Cascading в заказе; цена с сервера | ✅ pass | `GET /api/catalog/*`; `resolveOrderItemLine` ignores client unitPrice; test `item-input.test.ts` |
| 22.8.5 | ☑ Ручная позиция без catalog_product_id | ✅ pass | `isManual` path; `create-order.ts` |
| 22.8.6 | Non-admin `/api/admin/catalog/*` → 403 | ✅ pass | `assertCatalogAdmin()` |
| 22.8.7 | Designer/courier без catalog admin; BOM не в read API | ✅ pass | `assertCatalogRead` roles; read routes без BOM |

---

## §22.9 Гигиена

| # | Критерий | Статус | Доказательство |
|---|----------|--------|----------------|
| 22.9.1 | strict TS + lint + prettier + CI | ✅ pass | Local: 169 tests pass; `.github/workflows/ci.yml` |
| 22.9.2 | `.env.example` + README Auth.js v5 | ✅ pass | `.env.example` (AUTH_SECRET, CRON, R2, VAPID, TG); README.md L7 |
| 22.9.3 | Канон денег `lib/money` | ✅ pass | `decimal.js`; `toApiNumber` 2 decimals; tests |
| 22.9.4 | Модуль прав + order endpoints gated | ✅ pass | §20.9 modules; order API → lib layers with `assertOrderAccess` |
| 22.9.5 | Unit gate §20.5.1–5 | ✅ pass | `order-number`, `money`, `status-transitions`, `permissions`, `kpi` tests |
| 22.9.6 | Unit §20.5.6–7 admin jump + soft-delete pwd | ✅ pass | `status-transitions.test.ts`; `soft-delete.test.ts` |
| 22.9.7 | `.cursor/rules` инварианты §20 | ✅ pass | `00-dkprint-invariants.mdc`, `03-pre-push-checks.mdc`, etc. (8 files) |
| 22.9.8 | OPS.md + HANDOFF.md актуальны | ✅ pass | Phase 10 update (2026-09-01): phase table, migrations, cron, R2 Standard, catalog deferred, 5-role smoke |

---

## Сводка

| Статус | Кол-во пунктов |
|--------|----------------|
| ✅ pass | 57 |
| ❌ fail | 0 |
| ⏸ blocked | 3 (20.7.7 manual QA; 22.2.1 DB concurrency smoke; 22.8.1 prod catalog import) |

### Вердикт §22

**Условный pass по коду и unit-тестам.** Полная приёмка v1 **не закрыта** без:

1. ⏸ Ручной smoke 5 ролей на staging (§20.7.7)
2. ⏸ Ручной smoke 5 ролей на staging (§20.7.7) — чеклист в `OPS.md`
3. ⏸ Prod catalog import после leaf-policy fix (HANDOFF §Catalog deferred)
4. ⏸ Опционально: Neon race test на `order_daily_sequences`

### Рекомендуемый manual smoke (staging)

- [ ] 5 ролей login + nav matrix
- [ ] photo_center A/B isolation на `/api/orders`
- [ ] courier: orders delivery only; tasks/files 403
- [ ] status chain + admin jump
- [ ] cancel + soft-delete + KPI excludes
- [ ] presign upload → download
- [ ] TG card create/edit; cron SLA 401/200
- [ ] catalog import → export → order catalog+manual line
- [ ] reports export CSV/XLSX за period

---

*Сгенерировано code review без изменения продуктового кода.*

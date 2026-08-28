# DKPrint CRM — техническое задание v1 (полное)

**Версия:** 1.5  
**Дата:** август 2026  
**Статус:** согласовано, готово к передаче в разработку  
**Базовый документ решений:** v1.2  
**Изменения v1.1:** гигиена кода и качество; зафиксированы auth, SLA cron, Telegram, soft-delete password, timezone; выровнен дизайн-токен фона; Definition of Done.  
**Изменения v1.2:** усиление §20 (модуль прав, изоляция заказов, money/Decimal, Next `"use server"` barrel, hotspots, R2/SLA ops, тесты, Cursor rules) по опыту Boxmart CRM.  
**Изменения v1.3:** выравнивание несостыковок — R2 key = orderNumber; money = decimal-lib + API number (2 знака); §22.8 полный gate §20; Приложение A = Фаза 0; auth = **Auth.js (NextAuth v5)** Credentials.  
**Изменения v1.4:** Telegram — **живая карточка заказа** (одно сообщение на заказ, `editMessageText` при статусе и комментарии); поле `orders.telegram_message_id`; Web Push остаётся event-driven (§10.2).  
**Изменения v1.5:** позиция заказа — поле `name` (наименование); TG-карточка показывает строки состава (sync **не** на item CRUD); очередь цеха — подстроки состава + «макет: есть/нет»; аудит на карточке/API — только admin|production, читаемые подписи.

> **Этот файл — единственный документ для старта работы в новом репозитории.**  
> При любом расхождении с другими заметками / чатами / старыми split-docs — **верен этот файл**.  
> Содержит: бизнес-логику, схему БД, API, экраны, R2, дизайн, env, гигиену кода, приёмку, roadmap.

---

## Содержание

1. [Контекст и цели](#1-контекст-и-цели)
2. [Стек и инфраструктура](#2-стек-и-инфраструктура)
3. [Роли и права](#3-роли-и-права)
4. [Заказы](#4-заказы)
5. [Статусы и переходы](#5-статусы-и-переходы)
6. [Отмена и soft-delete](#6-отмена-и-soft-delete)
7. [Клиенты](#7-клиенты)
8. [Цена и аудит](#8-цена-и-аудит)
9. [Файлы (Cloudflare R2)](#9-файлы-cloudflare-r2)
10. [Комментарии и уведомления](#10-комментарии-и-уведомления)
11. [SLA](#11-sla)
12. [Операционные модули](#12-операционные-модули)
13. [Администрирование](#13-администрирование)
14. [Схема базы данных](#14-схема-базы-данных)
15. [API (REST)](#15-api-rest)
16. [Экраны и маршруты UI](#16-экраны-и-маршруты-ui)
17. [Дизайн UI](#17-дизайн-ui)
18. [Переменные окружения](#18-переменные-окружения)
19. [Seed и первый запуск](#19-seed-и-первый-запуск)
20. [Гигиена кода и качество](#20-гигиена-кода-и-качество)
21. [Порядок разработки](#21-порядок-разработки)
22. [Критерии приёмки v1](#22-критерии-приёмки-v1)
23. [Roadmap (не v1)](#23-roadmap-не-v1)
24. [Приложения](#24-приложения)

---

## 1. Контекст и цели

### 1.1 Заказчик

- **Типография:** флексопечать, цифровая печать, сувенирка.
- **Сеть фотоцентров:** ~7 точек на старте, **без лимита** в архитектуре — сеть растёт.
- **Процесс:** фотоцентр → дизайнер → производство → курьер → выдача.

### 1.2 Цель v1

Единая web-CRM: приём заказов на точках, работа дизайна и цеха, курьер, отчёты с деньгами, push/Telegram — вместо чатов и Excel.

### 1.3 Аналог

**Boxmart CRM** — заказы, роли, очередь цеха, задачи, push, Telegram, отчёты, пошаговые статусы ←/→.

### 1.4 Отличия DKPrint от Boxmart

| | Boxmart | DKPrint v1 |
|--|---------|------------|
| Калькулятор | есть | **нет** (roadmap +1) |
| Роли | свои | 5 ролей под сеть точек |
| Изоляция точек | — | по `clientId` |
| Файлы | — | 2 блока (точка / дизайнер) + R2 |
| Номер заказа | BM-… | **DK-YYMMDD-N** |
| Оплата | — | **нет** полей оплачен/долг |

### 1.5 Входит в v1 (must-have)

- 5 ролей + 5 флагов прав на пользователя
- Заказы с позициями, **цена × количество**, аудит цены
- Статусы ←/→ (как Boxmart); админ — модал **«Перейти в…»**
- Статус **«Отменён»** (≠ soft-delete)
- Два блока файлов + **R2 presigned upload**
- Очередь цеха, задачи (без курьера), **ТТН**
- Web Push: новый заказ, готов к выдаче, проблемный макет, SLA; Telegram — **живая карточка** заказа в группе (редактируется при статусе и комментарии)
- Отчёты с деньгами; SLA default **72 ч**; остановка SLA при отмене / soft-delete / delivered
- Чекбокс **«Проблемный макет»** в комментарии
- Базовая гигиена кода (§20): strict TS, lint, валидация границ, CI typecheck+lint; модуль прав + изоляция заказов; точечные unit (§20.5)

### 1.6 Не входит в v1

- Внешний калькулятор, склад, онлайн-витрина, касса/фискализация
- Нативное мобильное приложение
- Поля оплачен / частично / долг
- SMS клиентам
- Optimistic locking / conflict UI при одновременном редактировании (v1: last-write-wins; см. §20.6)
- Автоматический cleanup объектов R2 после soft-delete
- Полный e2e/unit suite (минимум — точечные тесты на money/status/permissions, §20.5)

---

## 2. Стек и инфраструктура

| Слой | Технология | Примечание |
|------|------------|------------|
| Frontend + API | **Next.js** (App Router) | Один репозиторий, web-only |
| Язык | **TypeScript strict** | Обязательно (§20) |
| БД | **Neon PostgreSQL** 15+ | Метаданные, не байты файлов |
| Доступ к БД | **один** выбранный способ | SQL-миграции в git; ORM опционален, но не смешивать два стиля |
| Файлы | **Cloudflare R2** | Presigned PUT/GET; бакет приватный |
| Auth | **Auth.js (NextAuth v5)** | Session cookie (httpOnly, Secure, SameSite); provider **Credentials** (email + password); не смешивать с другими auth-стеками |
| Push | Web Push API | VAPID keys |
| Telegram | Bot → одна рабочая группа | **Исходящие** `sendMessage` / `editMessageText`; одна **карточка на заказ**; polling/webhook **не нужны** в v1 |
| SLA job | **Vercel Cron** | Раз в 15 мин (см. §11.2) |
| Deploy | **Vercel** + GitHub | Staging + prod по желанию |

### 2.1 Логическая архитектура

```
Фотоцентры (clientId) ──┐
Дизайнер (все заказы)  ├──► Neon (ядро) ──┬── R2 (файлы)
Производство (все)     ──┘                 ├── Web Push
Курьер (выдача) ───────────────────────────┼── Telegram (группа)
                                           └── Отчёты / Vercel Cron (SLA)
```

### 2.2 Принципы архитектуры v1

- Один репозиторий, без микросервисов.
- Плоская структура (`app/`, `lib/…`) — см. §20.2 / §20.3.
- UI **прячет** недоступные действия; **сервер всегда проверяет** права.
- Одна каноническая формула денег (§8) — не дублировать в UI и API по-разному.
- Граф статусов в БД (`status_transitions`) — UI не хардкодит цепочку кроме отображения подписей.

---

## 3. Роли и права

### 3.1 Роли

| Код | UI | Назначение |
|-----|-----|------------|
| `admin` | Админ | Всё: пользователи, SLA, права, любые статусы, отчёты |
| `photo_center` | Фотоцентр | Заказы где `clientId` = точка; создание; правка только «Новая» |
| `production` | Производство | Все заказы; статусы, ТТН, отмена, soft-delete; правка только заказов `source=production` |
| `designer` | Дизайнер | Все заказы; файлы дизайнера, статусы, комментарии; **без отмены** |
| `courier` | Курьер | «Готов к выдаче» и далее; read «Для курьера»; **без задач и файлов** |

### 3.2 Флаги прав v1 (таблица `permission_overrides`)

| Флаг | Назначение | По умолчанию |
|------|------------|--------------|
| `can_access_reports` | Отчёты | Только admin (роль); флаг — делегирование |
| `can_edit_price` | Смена цены после создания | Только admin; флаг — делегирование |
| `can_cancel_order` | Перевод в «Отменён» | admin + production (роль); флаг — делегирование иным ролям |
| `can_soft_delete_order` | Soft-delete | admin + production (роль); флаг — делегирование |
| `can_manage_sla` | Настройка SLA | Только admin; флаг — делегирование |

**Правило эффективных прав:**  
`allowed = (роль даёт право по матрице) OR (флаг permission_overrides = true)`, кроме случаев, где матрица явно запрещает роль (например designer **никогда** не отменяет — даже с флагом `can_cancel_order` **не применять** к designer в v1; флаг для делегирования photo_center / courier при необходимости).

Уточнение v1 по флагам cancel/delete:

- Роли `admin` и `production` имеют право **без** флага.
- Флаг нужен, чтобы выдать право **другой** роли (например photo_center).
- Роль `designer`: кнопки отмены и soft-delete **отсутствуют**; флаг для designer **игнорировать** (не выдавать в UI админки или не применять в API).

Roadmap: доп. флаги без смены модели БД (новые колонки в `permission_overrides`).

### 3.3 Матрица действий

| Действие | Admin | Production | Designer | Photo center | Courier |
|----------|:-----:|:----------:|:--------:|:------------:|:-------:|
| Создать заказ | ✅ | ✅ | — | ✅ | — |
| Видеть заказы | все | все | все | `clientId` | выдача* |
| Редактировать поля | ✅ | `source=production` | — | свои, status=`new` | — |
| Менять цену после создания | ✅ | флаг | — | — (только при создании) | — |
| Статусы ←/→ | ✅ | до ready | до ready | — | курьер** |
| Модал «Перейти в…» | ✅ | — | — | — | — |
| Отменить (статус) | ✅ | ✅ | **—** | флаг*** | — |
| Soft-delete | ✅ | ✅ | — | подсказка / флаг*** | — |
| Комментарии + ☑ проблемный макет | ✅ | ✅ | ✅ | ✅ | — |
| «Для курьера» write | ✅ | ✅ | read | ✅ | read |
| Файлы `client` | ✅ | ✅ догрузка | — | ✅ | — |
| Файлы `designer` | ✅ | — | ✅ | read | — |
| Скачать файлы | ✅ | ✅ | ✅ | свои заказы (оба блока) | — |
| ТТН | ✅ | ✅ | — | — | — |
| Задачи | ✅ | ✅ | ✅ | ✅ | — |
| Отчёты | ✅ | флаг | флаг | — | — |
| SLA настройка | ✅ | — | — | — | — |

\* Курьер: статусы `ready_for_pickup`, `with_courier`, `delivered`.  
\*\* Курьер: `ready_for_pickup ↔ with_courier → delivered`.  
\*\*\* Photo center: по умолчанию нет; soft-delete без флага показывает подсказку «Свяжитесь с производством или администратором». С флагом — как у production (с причиной/паролем по §6).

**Production на заказах точек (без edit полей):** комментарии, статусы, ТТН, «для курьера», догрузка файлов `client`, отмена, soft-delete.

**Заказы `source=production`:** редактирует **любой** пользователь роли production.

### 3.4 Изоляция данных (обязательно на сервере)

| Роль | Правило видимости заказов |
|------|---------------------------|
| `photo_center` | Только `orders.client_id = user.client_id` |
| `courier` | Только статусы выдачи (см. выше) |
| `admin`, `production`, `designer` | Все (кроме soft-deleted по умолчанию) |
| Любая | `deleted_at IS NULL`, если не admin с `includeDeleted=true` |

Проверку повторять на **каждый** endpoint, который принимает `orderId` / `fileId` / `clientId` — не полагаться только на фильтр списка.

---

## 4. Заказы

### 4.1 Номер заказа

**Формат:** `DK-YYMMDD-N`

| Часть | Пример | Правило |
|-------|--------|---------|
| Префикс | `DK` | Фиксированный |
| Дата | `260824` | YYMMDD в timezone `APP_TIMEZONE` (default `Europe/Minsk`) |
| N | `-3` | Порядковый в **этот календарный день** (в `APP_TIMEZONE`), с 1 |

**Реализация:** таблица `order_daily_sequences`, атомарный:

```sql
INSERT INTO order_daily_sequences (order_date, last_sequence)
VALUES ($1, 1)
ON CONFLICT (order_date)
DO UPDATE SET last_sequence = order_daily_sequences.last_sequence + 1
RETURNING last_sequence;
```

`$1` = текущая дата в `APP_TIMEZONE` (не UTC «как получится», не дата браузера).

### 4.2 Кто создаёт

`photo_center`, `production`, `admin`.

При создании фиксируются: `created_by_user_id`, `created_by_role`, `source` (`photo_center` | `production` | `admin`).

| Создатель | `client_id` |
|-----------|-------------|
| `photo_center` | Всегда своя точка (`user.client_id`); сменить нельзя |
| `production` / `admin` | Выбор клиента (точка сети или внешний) |

Минимум **одна** позиция при создании.

### 4.3 Поля заказа

| Поле | Описание |
|------|----------|
| Клиент | `client_id` — обязателен |
| Позиции | ≥1, см. §4.4 |
| «Для курьера» | `courier_note` — текст (куда везти); опционально |
| Сумма | `total_amount` = Σ `line_total` (канонический пересчёт на сервере) |
| ТТН | `ttn_checked` boolean, default false |

### 4.4 Позиция заказа (`order_items`)

| Поле | UI | Обязательно |
|------|-----|:-----------:|
| Категория | select из справочника (`is_active=true`) | ✅ |
| Наименование | text (`name`) | ✅ |
| Тех. параметры | textarea | — |
| Количество | number > 0, целое | ✅ |
| Цена за ед. | number ≥ 0, 2 знака | ✅ |
| Сумма строки | `quantity × unit_price` | auto (сервер) |
| Файлы точки | upload block `client` | — |

Кнопка **«Добавить позицию»** — дублирует набор полей.

### 4.5 Правила редактирования полей

| Роль | Условие |
|------|---------|
| Photo center | `client_id` = своя точка **и** `status = new` + `reason` (причина) → `order_audit_logs` |
| Production | `source = production` (любой production) |
| Admin | всегда |

Production **не редактирует** поля заказов, созданных фотоцентром / admin с иным source (т.е. только `source=production`).

Редактирование запрещено, если `status = cancelled` или `deleted_at IS NOT NULL` (кроме admin jump / служебных — не требуется в v1).

---

## 5. Статусы и переходы

### 5.1 Коды статусов

| Код | UI (RU) |
|-----|---------|
| `new` | Новая |
| `accepted` | Принят в работу |
| `at_designer` | У дизайнера |
| `in_production` | На производстве |
| `ready_for_pickup` | Готов к выдаче |
| `with_courier` | У курьера |
| `delivered` | Выдан |
| `cancelled` | Отменён |

### 5.2 Основная цепочка v1

```
new → accepted → at_designer → in_production → ready_for_pickup → with_courier → delivered
```

**v1:** заказ **всегда** проходит через `at_designer` при движении вперёд по основной цепочке.  
**Архитектура:** граф в таблице `status_transitions` (задел под пропуск дизайнера в roadmap +1.5).

Отмена: переход в `cancelled` из любого статуса **кроме** `delivered` (и кроме уже `cancelled`).

### 5.3 Правила переходов UI

**Все роли кроме admin:** только **← предыдущий** / **→ следующий** — **один соседний** статус за клик (как Boxmart). Откат до `new` — повторными ←.

| Роль | Диапазон |
|------|----------|
| Production, Designer | до `ready_for_pickup` включительно; **new → accepted** — оба |
| Courier | `ready_for_pickup ↔ with_courier → delivered` |
| Photo center | не меняет статусы |
| **Admin** | ←/→ + **модал «Перейти в…»** — select статуса, один запрос, `is_admin_jump=true` в event |

Admin jump: любой статус из списка §5.1 **кроме** бессмысленных циклов; в `cancelled` — только через `/cancel` с причиной (не через jump). Из `cancelled` jump обратно **не** в v1 (или только admin jump — **разрешить** admin jump из `cancelled` в выбранный статус для исправления ошибки, с записью event).

**Решение v1:** admin jump **из** `cancelled` **разрешён**; при этом очищать `cancelled_at` / `cancel_reason` не обязательно хранить историю — reason в event; `sla_stopped_at` при возврате из cancelled **сбрасывать в NULL** и продолжать SLA (или оставить stopped — **фиксируем:** при выходе из cancelled через jump **`sla_stopped_at = NULL`**, SLA снова тикает).

### 5.4 Где видны «Новые»

- **Общий список заказов** + фильтр по статусу
- **Очередь цеха** — **без** `new` (только `accepted` … `ready_for_pickup`)

### 5.5 История

Каждый переход → `order_status_events` (`from_status`, `to_status`, `changed_by_user_id`, `reason`, `is_admin_jump`, `created_at`).

---

## 6. Отмена и soft-delete

### 6.1 Два разных механизма

| | **Отмена** | **Soft-delete** |
|---|------------|-----------------|
| Суть | Бизнес-статус `cancelled` | Скрытие из рабочих списков |
| Кто | admin, production (+ флаг иным, не designer) | admin, production (+ флаг) |
| UI | «Отменить» + **причина (required)** | «Удалить» + **пароль текущего пользователя** + комментарий |
| Designer | **нет кнопки** | нет |
| Photo center | нет (или флаг) | без флага: подсказка связаться с производством/админом |
| В списках | виден при фильтре «Отменён» | **скрыт** (admin: «Показать удалённые») |
| Воронка | колонка «Отменён» | не участвует |
| KPI / выручка | **исключён** | **исключён** |
| SLA | **останавливается** | **останавливается** |

### 6.2 Soft-delete: проверка пароля

- Клиент передаёт `password` в теле запроса.
- Сервер сверяет с `password_hash` **текущей сессии** (того, кто удаляет), не отдельный «master password».
- При неверном пароле — `401` / `403` с кодом `invalid_password`, удаление не выполнять.
- `comment` (delete_comment) — рекомендуется required в UI; в API **required** non-empty.

### 6.3 Поля БД при отмене

```
status = cancelled
cancel_reason = <текст>
cancelled_at = now()
sla_stopped_at = now()
+ order_status_events (reason обязателен, to_status=cancelled)
```

Нельзя отменить, если `status = delivered` или уже `cancelled`, или `deleted_at IS NOT NULL`.

### 6.4 Поля БД при soft-delete

```
deleted_at = now()
deleted_by_user_id = ...
delete_comment = ...
sla_stopped_at = now()  (если ещё не stopped)
```

Файлы в R2 **не удалять** сразу (cleanup — roadmap).

Восстановление soft-delete в v1 **не обязательно** (admin может видеть удалённые; un-delete — опционально later).

---

## 7. Клиенты

| Правило | Реализация |
|---------|------------|
| Фотоцентр = клиент | `clients.user_id` 1:1 с user `role=photo_center` |
| Видимость точки | все заказы с `orders.client_id` = client точки |
| Создание клиента | admin, production (форма заказа или справочник) |
| Список клиентов | admin, production, designer |
| Карточка | данные + таблица истории заказов (без soft-deleted по умолчанию) |

**Типы:**

1. **Точка сети** — при создании user `photo_center` автоматически создаётся `clients` с `user_id`.
2. **Внешний клиент** — юрлицо / разовый; `user_id IS NULL`.

Photo center **не** видит справочник всех клиентов — только работает в контексте своей точки.

---

## 8. Цена и аудит

| Правило | Описание |
|---------|----------|
| Ввод цены | все создатели заказа (при создании / добавлении позиции по правам edit) |
| Изменение после создания | admin или `can_edit_price` |
| Аудит | каждая смена цены / qty / полей → `order_audit_logs` (no-op без изменений — без записи) |
| Просмотр аудита | UI + `GET /orders/:id/audit-logs` — **только** admin и production; читаемые подписи действий |
| Формула (канон) | `line_total = round(quantity × unit_price, 2)`; `total_amount = Σ line_total` |
| Реализация | **только** `lib/money` + decimal-библиотека (напр. `decimal.js`); **запрещён** «голый» IEEE `number` для сумм |
| БД | `NUMERIC(12,2)` для `unit_price`, `line_total`, `total_amount` |
| API | суммы как **number**, всегда с 2 знаками на выходе (напр. `12.5` → `12.50` в сериализации / единообразный formatter); не string |
| Где считать | **только сервер**; UI может показывать preview, но сохраняет ответ сервера |
| Оплата v1 | **нет** — только сумма для отчётов |
| Валюта | не моделируется отдельно; отображение как число + «BYN» в UI (или без символа — единообразно) |

Изменение `quantity` или `unit_price` всегда пересчитывает `line_total` и `orders.total_amount` в той же транзакции.

---

## 9. Файлы (Cloudflare R2)

### 9.1 Принцип

| Где | Что |
|-----|-----|
| Neon | метаданные `files` |
| R2 | байты |
| Браузер | PUT напрямую в R2 по presigned URL |

Бакет **приватный**, без публичных URL. Секреты R2 — только server env.

### 9.2 Ключ в R2

```
dkprint/{env}/orders/{orderNumber}/items/{itemId}/{block}/{fileId}-{safeName}
```

- `env` = `R2_ENV` (`prod` | `staging`)
- `block`: `client` | `designer`
- `safeName`: basename без path traversal, ограничить charset

### 9.3 Кто загружает

| Роль | block | Примечание |
|------|-------|------------|
| Photo center | `client` | свои заказы |
| Production, admin | `client` | + **догрузка** к существующим |
| Designer | `designer` | отдельный блок в карточке |
| Admin | оба | |
| Courier | — | **нет доступа** (list/download/presign — 403) |

Photo center на своих заказах **видит оба блока** (designer — read/download).

### 9.4 Поток upload

```
1. POST /api/files/presign  { orderId, itemId, block, filename, mimeType, sizeBytes }
2. CRM: auth + права + лимиты → создаёт row upload_status=pending
   → { fileId, uploadUrl, storageKey }  TTL 5–15 мин
3. Browser PUT → R2 (Content-Type = заявленный mime)
4. POST /api/files/confirm  { fileId }
5. CRM: проверка, что объект существует (HeadObject) → upload_status = confirmed
   иначе failed
```

Повторный `confirm` для уже `confirmed` — идемпотентный успех.

### 9.5 Download

```
GET /api/files/:fileId/download → { downloadUrl }  signed GET TTL 1–5 мин
```

Перед выдачей URL — проверка доступа к заказу и роли (courier — отказ).

### 9.6 Лимиты v1

| Параметр | Значение |
|----------|----------|
| Max размер | 100 МБ |
| MIME | `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/tiff`, `application/pdf`, `application/zip` |
| Soft-delete заказа | объекты R2 не удалять |
| Orphan pending | опционально: cron помечает `failed` старше 24ч — не обязательно в v1 |

---

## 10. Комментарии и уведомления

### 10.1 Комментарии

- Обычный комментарий — **без** Web Push; карточка Telegram **редактируется** (показывается **последний** комментарий)
- Чекбокс **«Проблемный макет»** (`is_problematic_layout=true`) → Web Push **+** редактирование карточки TG (пометка «⚠️ Проблемный макет»)
- Designer использует чекбокс для эскалации; **отмену** оформляет production/admin
- Courier комментарии **не** пишет (нет в матрице) — в TG карточку не обновляет

### 10.2 События уведомлений

**Web Push** — отдельные push-алерты на события. **Telegram** — одна карточка на заказ (§10.3); на события ниже карточка **редактируется**, новое сообщение **не** создаётся (кроме первого `sendMessage` при создании заказа).

| Событие | Web Push | Telegram (карточка) |
|---------|:--------:|:-------------------:|
| Новый заказ | admin, production, designer | **создать** карточку (`sendMessage`) |
| Любая смена статуса (в т.ч. `cancelled`, `delivered`) | — | **редактировать** (`editMessageText`) |
| Готов к выдаче (`ready_for_pickup`) | admin, production, **courier** | редактировать (статус обновится) |
| Новый комментарий (не courier) | — | редактировать (последний комментарий) |
| Проблемный макет | участники* | редактировать + пометка |
| Просрочка SLA | admin, production | редактировать + пометка SLA |

\* Участники проблемного макета v1: admin + production + designer + photo_center **владельца** заказа (не другие точки).

**Новый заказ — Web Push не отправлять другим фотоцентрам.** Telegram-карточка одна на заказ в общей группе (не per-point).

### 10.3 Telegram (детализация v1)

- Один бот, один `TELEGRAM_CHAT_ID` (рабочая группа).
- **Модель «живая карточка»:** на каждый заказ — **одно** сообщение в группе. При изменениях в CRM сообщение **редактируется** (`editMessageText`), а не дублируется новыми `sendMessage`.
- **Первое сообщение:** при создании заказа — `sendMessage`; сохранить `message_id` в `orders.telegram_message_id`.
- **Редактирование карточки** (если `telegram_message_id` есть):
  - любая смена статуса (next/prev/jump/**cancel**/→**delivered** и др.);
  - добавление комментария (кроме courier — §10.1);
  - просрочка SLA / проблемный макет — те же правила + пометка в теле карточки.
  - **не** при add/patch/delete позиции и смене цены (карточка обновится на следующем статусе/комментарии).
- **Fallback:** если `editMessageText` падает (нет `message_id`, сообщение удалено в TG) — новый `sendMessage`, обновить `telegram_message_id`.
- **Формат** (`parse_mode: HTML`; экранировать `<`, `>`, `&` в пользовательском тексте):

```
[DKPrint] DK-260824-3
Клиент: … | Сумма: …
<b>Статус: Принят</b>
☑️ Срочно                ← только если is_urgent
1. {name} × {qty} — {tech краткий или —}
Комментарий: … (последний или «—»)
Ссылка: https://{APP_URL}/orders/{id}
```

- Строка **«Статус: …»** — всегда **жирным** (`<b>…</b>`); подпись статуса — из UI-лейблов CRM (`statusLabel`).
- После статуса (и срочности) — строки состава заказа по `position_number` (name, qty, tech ≤ ~80 символов).
- Ошибки Telegram **не** откатывают бизнес-операцию; писать в `notification_log` при наличии.
- Webhook/polling входящих сообщений в v1 **не делаем**.
- Канон реализации: `lib/notifications/telegram.ts` + `syncOrderTelegramCard(orderId)` после успешного commit в БД.

### 10.4 Web Push (детализация v1)

- Подписка: `POST /api/push/subscribe` после разрешения браузера.
- Хранить endpoint + keys; при `410 Gone` от push-сервиса — удалить subscription.
- VAPID public key можно отдавать клиенту; **private** — только server.

### 10.5 «Для курьера»

Write: admin, production, photo_center.  
Read: designer, courier (и все write-роли).

---

## 11. SLA

| Параметр | Значение |
|----------|----------|
| Настройка | admin (`can_manage_sla` / роль admin) |
| Default | **new → delivered = 72 часа**, `is_system_default=true` |
| Доп. этапы | пары статусов в `sla_goals` (v1 UI может показывать только system default + список) |
| Старт | `sla_started_at` = момент создания заказа |
| Стоп | `sla_stopped_at` при: `delivered`, `cancelled`, soft-delete |
| Отменённый / удалённый | **не** в списке просроченных |

### 11.1 Логика расчёта

```
deadline = sla_started_at + target_hours

IF sla_stopped_at IS NOT NULL:
  is_overdue = false
ELSE:
  is_overdue = (now() - sla_started_at) > target_hours
```

Для badge в UI: показывать remaining / overdue относительно default goal `new→delivered`, если не указано иное.

### 11.2 Job просрочки (обязательно зафиксировано)

- **Vercel Cron** → `GET`/`POST` `/api/cron/sla-overdue` каждые **15 минут**.
- Защита: заголовок `Authorization: Bearer CRON_SECRET` (или встроенный механизм Vercel Cron).
- Логика: выбрать заказы `deleted_at IS NULL AND status NOT IN ('cancelled','delivered') AND sla_stopped_at IS NULL AND overdue`; для ещё не уведомлённых за последний N часов — Web Push + **редактирование** TG-карточки (§10.3).
- Дедуп: либо поле `sla_overdue_notified_at` на `orders` (**добавить в схему v1.1**, см. §14.9), либо запись в `notification_log` с проверкой «уже слали сегодня».

**Решение v1.1:** колонка `orders.sla_overdue_notified_at TIMESTAMPTZ NULL` — повторное уведомление не чаще 1 раза в 24 часа (обновлять timestamp при отправке).

---

## 12. Операционные модули

### 12.1 Список заказов

- Поиск (№, клиент), фильтр статусов (multi), период дат
- Сортировка: новые сверху (`created_at DESC`)
- URL params для drill-down из отчётов
- ТТН inline checkbox (production, admin)
- Admin: «Показать удалённые»
- Soft-delete скрыт по умолчанию

### 12.2 Очередь цеха (`/workshop`)

- Компактная таблица (не планшетный kanban)
- Статусы: `accepted`, `at_designer`, `in_production`, `ready_for_pickup`
- Кнопки ←/→ в строке с именами целевых статусов
- Под каждой строкой заказа — компактный состав: `N. {name}, {qty} шт, {tech или —}, макет: есть|нет` (`hasLayout` = confirmed файл блока `client` у позиции)
- Polling **30–60 с** (или router refresh)
- Доступ: production, designer, admin

### 12.3 Задачи

| Поле | Значения |
|------|----------|
| title, description | text |
| assignee, creator | users |
| order_id | optional |
| priority | `low`, `normal`, `high`, `urgent` |
| status | `open`, `in_progress`, `done`, `cancelled` |
| due_at | datetime optional |

**Фильтры:**

- **Мои** — `assignee_user_id = me`
- **Поставленные мной** — `creator_user_id = me`
- **Все** — Мои ∪ Поставленные мной (**не** глобальный список всех задач компании)

**Courier:** модуль недоступен (UI + API 403).

### 12.4 Отчёты

**Доступ:** admin **или** `can_access_reports`.

**KPI-фильтр (везде):** `deleted_at IS NULL AND status != 'cancelled'`, если не указано иное (воронка отдельно показывает колонку «Отменён»).

**KPI:** число заказов, выручка (`SUM total_amount`), средний чек, % `delivered`.

**Блоки:** период, KPI, воронка (+ колонка Отменён), по клиентам, по категориям, SLA просрочки, задачи, % ТТН, экспорт CSV/Excel, печать (window.print стили).

---

## 13. Администрирование

| Раздел | Функции |
|--------|---------|
| Пользователи | CRUD, роль, `client_id` для photo_center, 5 флагов; деактивация `is_active` |
| Категории | CRUD, `sort_order`, `is_active` (`skip_designer` в UI **disabled** до +1.5) |
| SLA | CRUD `sla_goals` |
| Аудит | просмотр status events / audit logs / cancel/delete (на карточке заказа достаточно); **audit logs UI/API — только admin и production**, читаемые подписи |

Создание photo_center: см. §19.3.  
Нельзя удалить последнего admin.  
Смена роли photo_center → другая: связь `clients.user_id` не ломать без явного действия.

---

## 14. Схема базы данных

**СУБД:** PostgreSQL 15+ (Neon).

### 14.1 ER (кратко)

```
users ── permission_overrides
users ── clients (photo_center 1:1)
clients ── orders
orders ── order_items ── files
orders ── order_status_events, order_audit_logs, comments, tasks
categories ── order_items
status_transitions, sla_goals, order_daily_sequences (config)
push_subscriptions, notification_log
```

### 14.2 `users`

```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
email           TEXT UNIQUE NOT NULL
password_hash   TEXT NOT NULL
display_name    TEXT NOT NULL
role            TEXT NOT NULL
  -- CHECK IN ('admin','photo_center','production','designer','courier')
client_id       UUID NULL REFERENCES clients(id)
is_active       BOOLEAN NOT NULL DEFAULT true
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
```

Примечание: при создании photo_center возможна двухшаговая вставка (user → client → update user.client_id) в одной транзакции.

### 14.3 `permission_overrides`

```sql
user_id                 UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE
can_access_reports      BOOLEAN NOT NULL DEFAULT false
can_edit_price          BOOLEAN NOT NULL DEFAULT false
can_cancel_order        BOOLEAN NOT NULL DEFAULT false
can_soft_delete_order   BOOLEAN NOT NULL DEFAULT false
can_manage_sla          BOOLEAN NOT NULL DEFAULT false
updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
```

Строка создаётся при создании пользователя (все false) либо lazy при первом PATCH прав.

### 14.4 `clients`

```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
name        TEXT NOT NULL
user_id     UUID UNIQUE NULL REFERENCES users(id)
notes       TEXT NULL
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```

### 14.5 `categories`

```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
name            TEXT NOT NULL
sort_order      INT NOT NULL DEFAULT 0
is_active       BOOLEAN NOT NULL DEFAULT true
skip_designer   BOOLEAN NOT NULL DEFAULT false  -- roadmap +1.5; в v1 игнорировать
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
```

### 14.6 `status_transitions`

```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
from_status     TEXT NOT NULL
to_status       TEXT NOT NULL
direction       TEXT NOT NULL  -- 'forward' | 'backward' | 'cancel'
allowed_roles   TEXT[] NOT NULL
is_active       BOOLEAN NOT NULL DEFAULT true
UNIQUE (from_status, to_status)
```

### 14.7 `sla_goals`

```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
from_status         TEXT NOT NULL
to_status           TEXT NOT NULL
target_hours        INT NOT NULL CHECK (target_hours > 0)
is_active           BOOLEAN NOT NULL DEFAULT true
is_system_default   BOOLEAN NOT NULL DEFAULT false
```

Ровно одна активная запись с `is_system_default=true` для пары new→delivered (enforce в приложении или partial unique).

### 14.8 `order_daily_sequences`

```sql
order_date      DATE PRIMARY KEY
last_sequence   INT NOT NULL DEFAULT 0
```

### 14.9 `orders`

```sql
id                      UUID PRIMARY KEY DEFAULT gen_random_uuid()
order_number            TEXT UNIQUE NOT NULL
order_date              DATE NOT NULL
daily_sequence          INT NOT NULL
client_id               UUID NOT NULL REFERENCES clients(id)
status                  TEXT NOT NULL
created_by_user_id      UUID NOT NULL REFERENCES users(id)
created_by_role         TEXT NOT NULL
source                  TEXT NOT NULL
  -- 'photo_center' | 'production' | 'admin'
courier_note            TEXT NULL
ttn_checked             BOOLEAN NOT NULL DEFAULT false
total_amount            NUMERIC(12,2) NOT NULL DEFAULT 0
sla_started_at          TIMESTAMPTZ NOT NULL
sla_stopped_at          TIMESTAMPTZ NULL
sla_overdue_notified_at TIMESTAMPTZ NULL
cancelled_at            TIMESTAMPTZ NULL
cancel_reason           TEXT NULL
deleted_at              TIMESTAMPTZ NULL
deleted_by_user_id      UUID NULL REFERENCES users(id)
delete_comment          TEXT NULL
telegram_message_id     BIGINT NULL
  -- message_id карточки в TELEGRAM_CHAT_ID; NULL до первого sendMessage
created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
```

**Индексы:**

- `(client_id, status, created_at DESC)`
- `(status, created_at DESC) WHERE deleted_at IS NULL`
- UNIQUE `order_number`
- UNIQUE `(order_date, daily_sequence)`

**KPI filter:** `deleted_at IS NULL AND status <> 'cancelled'`.

### 14.10 `order_items`

```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE
position_number   INT NOT NULL
category_id       UUID NOT NULL REFERENCES categories(id)
name              TEXT NOT NULL DEFAULT ''
tech_params       TEXT NULL
quantity          INT NOT NULL CHECK (quantity > 0)
unit_price        NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0)
line_total        NUMERIC(12,2) NOT NULL
created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE (order_id, position_number)
```

### 14.11 `order_status_events`

```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
order_id            UUID NOT NULL REFERENCES orders(id)
from_status         TEXT NULL
to_status           TEXT NOT NULL
changed_by_user_id  UUID NOT NULL REFERENCES users(id)
reason              TEXT NULL  -- required if to_status = 'cancelled'
is_admin_jump       BOOLEAN NOT NULL DEFAULT false
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
```

### 14.12 `order_audit_logs`

```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
order_id        UUID NOT NULL REFERENCES orders(id)
order_item_id   UUID NULL REFERENCES order_items(id)
action          TEXT NOT NULL
  -- 'field_update' | 'price_change' | 'item_add' | 'item_remove'
field_name      TEXT NULL
old_value       TEXT NULL
new_value       TEXT NULL
reason          TEXT NULL
user_id         UUID NOT NULL REFERENCES users(id)
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
```

### 14.13 `files`

```sql
id                      UUID PRIMARY KEY DEFAULT gen_random_uuid()
order_id                UUID NOT NULL REFERENCES orders(id)
order_item_id           UUID NOT NULL REFERENCES order_items(id)
block                   TEXT NOT NULL  -- 'client' | 'designer'
storage_key             TEXT NOT NULL
original_name           TEXT NOT NULL
mime_type               TEXT NOT NULL
size_bytes              BIGINT NOT NULL
upload_status           TEXT NOT NULL  -- 'pending' | 'confirmed' | 'failed'
uploaded_by_user_id     UUID NOT NULL REFERENCES users(id)
created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
```

### 14.14 `comments`

```sql
id                      UUID PRIMARY KEY DEFAULT gen_random_uuid()
order_id                UUID NOT NULL REFERENCES orders(id)
user_id                 UUID NOT NULL REFERENCES users(id)
body                    TEXT NOT NULL
is_problematic_layout   BOOLEAN NOT NULL DEFAULT false
created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
```

### 14.15 `tasks`

```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
title               TEXT NOT NULL
description         TEXT NULL
order_id            UUID NULL REFERENCES orders(id)
assignee_user_id    UUID NOT NULL REFERENCES users(id)
creator_user_id     UUID NOT NULL REFERENCES users(id)
priority            TEXT NOT NULL
status              TEXT NOT NULL
due_at              TIMESTAMPTZ NULL
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
```

### 14.16 `push_subscriptions`

```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
endpoint    TEXT NOT NULL
p256dh      TEXT NOT NULL
auth        TEXT NOT NULL
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE (user_id, endpoint)
```

### 14.17 `notification_log` (рекомендуется)

```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
event_type      TEXT NOT NULL
order_id        UUID NULL REFERENCES orders(id)
payload         JSONB
sent_push       BOOLEAN NOT NULL DEFAULT false
sent_telegram   BOOLEAN NOT NULL DEFAULT false
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
```

---

## 15. API (REST)

**Base:** `/api`  
**Auth:** **Auth.js (NextAuth v5)** session cookie; все business endpoints — authenticated (+ cron с `CRON_SECRET`).  
**Errors:** `{ "error": "code", "message": "…" }` + HTTP 4xx/5xx.  
**Валидация тела:** Zod (или аналог) на каждом мутирующем endpoint.

### 15.1 Auth

Реализация: Auth.js Credentials + session strategy (JWT или database — **выбрать одну** в Фазе 0, default **JWT session** для простоты Vercel).

Логический контракт (тонкие wrappers или вызовы Auth.js):

| Method | Path | Описание |
|--------|------|----------|
| POST | `/auth/login` | `{ email, password }` → session cookie (или Auth.js signIn) |
| POST | `/auth/logout` | invalidate / signOut |
| GET | `/auth/me` | `{ user, permissions }` — из session + `permission_overrides` |

Допустимо также стандартный catch-all Auth.js (`/api/auth/[...nextauth]`) — тогда login/logout через его API, а `/auth/me` остаётся своим endpoint.

Неактивный пользователь (`is_active=false`) — login отказ; существующая сессия — 401 на следующих запросах.

### 15.2 Orders

| Method | Path | Описание |
|--------|------|----------|
| GET | `/orders` | query: `status[]`, `clientId`, `q`, `from`, `to`, `includeDeleted` (admin) |
| POST | `/orders` | создание + items → `order_number` |
| GET | `/orders/:id` | карточка + items + files meta + SLA |
| PATCH | `/orders/:id` | edit полей; optional `reason` |
| POST | `/orders/:id/status/next` | → следующий |
| POST | `/orders/:id/status/prev` | ← предыдущий |
| POST | `/orders/:id/status/jump` | admin: `{ toStatus }` |
| POST | `/orders/:id/cancel` | `{ reason }` required |
| POST | `/orders/:id/soft-delete` | `{ password, comment }` required |
| PATCH | `/orders/:id/ttn` | `{ ttnChecked }` |
| PATCH | `/orders/:id/courier-note` | `{ courierNote }` |
| PATCH | `/orders/:id/items/:itemId/price` | `{ unitPrice, reason? }` |

**Фильтрация списка на сервере:**

- `photo_center` → `client_id = user.client_id`
- `courier` → status ∈ (`ready_for_pickup`, `with_courier`, `delivered`)
- default → `deleted_at IS NULL`

### 15.3 Order items

| Method | Path | Описание |
|--------|------|----------|
| POST | `/orders/:id/items` | добавить (+ audit) |
| PATCH | `/orders/:id/items/:itemId` | (+ audit, пересчёт) |
| DELETE | `/orders/:id/items/:itemId` | + audit; нельзя удалить последнюю позицию |

### 15.4 Files

| Method | Path | Описание |
|--------|------|----------|
| POST | `/files/presign` | см. §9.4 |
| POST | `/files/confirm` | |
| GET | `/files/:fileId/download` | |
| GET | `/orders/:id/files` | список meta |

### 15.5 Comments

| Method | Path | Описание |
|--------|------|----------|
| GET | `/orders/:id/comments` | |
| POST | `/orders/:id/comments` | `{ body, isProblematicLayout }` |

### 15.6 Status history & audit

| Method | Path | Описание |
|--------|------|----------|
| GET | `/orders/:id/status-events` | |
| GET | `/orders/:id/audit-logs` | только admin, production |

### 15.7 Clients

| Method | Path | Описание |
|--------|------|----------|
| GET | `/clients` | + search |
| POST | `/clients` | |
| GET | `/clients/:id` | + order history |
| PATCH | `/clients/:id` | |

### 15.8 Tasks

| Method | Path | Описание |
|--------|------|----------|
| GET | `/tasks` | `filter=my\|created\|all` |
| POST | `/tasks` | |
| PATCH | `/tasks/:id` | |
| DELETE | `/tasks/:id` | hard delete допустим в v1 |

### 15.9 Workshop

| Method | Path | Описание |
|--------|------|----------|
| GET | `/workshop/queue` | статусы accepted…ready_for_pickup |

### 15.10 Reports

| Method | Path | Описание |
|--------|------|----------|
| GET | `/reports/summary` | |
| GET | `/reports/funnel` | |
| GET | `/reports/by-client` | |
| GET | `/reports/by-category` | |
| GET | `/reports/sla-overdue` | |
| GET | `/reports/tasks` | |
| GET | `/reports/ttn-rate` | |
| GET | `/reports/export` | `format=csv\|xlsx` |

### 15.11 Admin

| Method | Path | Описание |
|--------|------|----------|
| GET/POST | `/admin/users` | |
| GET/PATCH | `/admin/users/:id` | + permission_overrides |
| GET/POST/PATCH/DELETE | `/admin/categories` | |
| GET/POST/PATCH/DELETE | `/admin/sla-goals` | |

### 15.12 Push & Cron

| Method | Path | Описание |
|--------|------|----------|
| POST | `/push/subscribe` | `{ endpoint, keys }` |
| DELETE | `/push/subscribe` | |
| GET/POST | `/cron/sla-overdue` | только `CRON_SECRET` |

### 15.13 Server-side validation (обязательно)

Никогда не упрощать и не выносить «только в UI»:

- Статус: `status_transitions` + роль (+ admin jump отдельно)
- Cancel: `reason` non-empty; запрет из `delivered` / deleted
- Soft-delete: verify password текущего user; `comment` non-empty
- Edit order: роль + source + status rules
- File: роль + block + доступ к заказу + MIME + size
- Reports: admin или `can_access_reports`
- Price change: всегда audit log + пересчёт totals
- Генерация номера: только через `order_daily_sequences` в транзакции создания заказа

---

## 16. Экраны и маршруты UI

**Оценка:** ~22 экрана; ~18–24 dev-дня фронта при готовом API.

### 16.1 Маршруты

```
/login
/orders                         — список
/orders/new                     — создание
/orders/[id]                    — карточка (+ модалы)
/workshop                       — очередь цеха
/tasks, /tasks/new, /tasks/[id]
/clients, /clients/[id]
/reports
/admin/users, /admin/users/[id]
/admin/categories
/admin/sla
```

Неавторизованный → `/login`.  
Авторизованный на `/login` → `/orders` (courier тоже).  
Нет доступа к разделу → 403 страница / redirect на `/orders`.

### 16.2 Навигация по ролям

| Меню | Admin | Production | Designer | Photo center | Courier |
|------|:-----:|:----------:|:--------:|:------------:|:-------:|
| Заказы | ✅ | ✅ | ✅ | ✅ | ✅* |
| Новый заказ | ✅ | ✅ | — | ✅ | — |
| Очередь | ✅ | ✅ | ✅ | — | — |
| Задачи | ✅ | ✅ | ✅ | ✅ | — |
| Клиенты | ✅ | ✅ | ✅ | — | — |
| Отчёты | ✅ | флаг | флаг | — | — |
| Админка | ✅ | — | — | — | — |

\* Список курьера уже отфильтрован сервером.

### 16.3 Карточка заказа — секции

1. Шапка: №, статус, клиент, сумма, SLA badge  
2. ← / → (+ admin: «Перейти в…»)  
3. Позиции  
4. Файлы: client + designer  
5. Для курьера  
6. Комментарии + ☑ Проблемный макет  
7. История статусов  
8. Аудит (только admin, production)  
9. Задачи по заказу  
10. Действия: Отменить / Удалить / Создать задачу  

### 16.4 Приоритет UI

1. Layout, login, orders list/create/detail  
2. Workshop + file upload  
3. Tasks, clients  
4. Reports  
5. Admin  
6. Polish, push banner, errors  

---

## 17. Дизайн UI

**Референс:** `design-system/dkprint-crm/styles.css` + `MASTER.md`

### 17.1 Токены (канон для продукта)

| Token | Значение | Примечание |
|-------|----------|------------|
| Primary | `#0891B2` | |
| Secondary | `#22D3EE` | |
| CTA | `#22C55E` / hover `#16a34a` | |
| Background | `#f3f7f9` | **канон ТЗ**; в MASTER.md был `#ECFEFF` — при расхождении верны токены этого раздела |
| Text | `#164e63` | |
| Fonts | Poppins (headings), Open Sans (body) | |
| Sidebar | 240px, светлый | |
| Radius | 12px cards / 8px controls | |

### 17.2 Паттерн

Data-dense dashboard: sidebar + header, таблицы с фильтрами, KPI cards в отчётах.

### 17.3 Не использовать

- Emoji как иконки (SVG: Lucide / Heroicons)
- Layout-shifting hovers (scale, сдвигающий layout)
- Low contrast text (< 4.5:1)
- Invisible focus states
- Игнор `prefers-reduced-motion`

### 17.4 UI checklist перед сдачей экрана

- [ ] `cursor: pointer` на кликабельном  
- [ ] Transitions 150–300ms  
- [ ] Responsive: 375 / 768 / 1024 / 1440  
- [ ] Нет горизонтального скролла на мобиле  
- [ ] Ошибки API показаны пользователю понятным текстом  

---

## 18. Переменные окружения

```bash
# App
DATABASE_URL=postgresql://...
AUTH_SECRET=...                    # Auth.js v5 (обязательно)
APP_URL=https://crm.example.com    # также AUTH_URL / NEXTAUTH_URL при необходимости
APP_TIMEZONE=Europe/Minsk          # календарный день для DK-YYMMDD-N
CRON_SECRET=...                    # защита /api/cron/*

# R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=dkprint-files
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_ENV=prod                        # prod | staging

# Web Push
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:ops@example.com

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Seed admin (first deploy only)
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
```

В репозитории: **`.env.example`** (без секретов) + `.env*` в `.gitignore`.

---

## 19. Seed и первый запуск

### 19.1 Миграция seed

1. **status_transitions** — linear chain + courier + cancel  
2. **sla_goals** — `new → delivered`, 72h, `is_system_default=true`  
3. **categories** — Печать, Сувенирка, Цифровая печать  
4. **admin user** — из env + пустой `permission_overrides`  
5. **Опционально для QA:** по одному user на каждую роль (пароли только в staging)

### 19.2 status_transitions (v1 seed)

**Forward:**  
`new→accepted`, `accepted→at_designer`, `at_designer→in_production`, `in_production→ready_for_pickup`, `ready_for_pickup→with_courier`, `with_courier→delivered`

**Backward:** обратные пары; для courier минимум от `ready_for_pickup`.

**Роли на переходах (ориентир):**

| Переход | Роли |
|---------|------|
| new→accepted | admin, production, designer |
| accepted↔at_designer↔in_production↔ready | admin, production, designer |
| ready↔with_courier→delivered | admin, courier (+ production? **v1: admin + courier**; production до ready включительно, дальше не двигает вперёд к with_courier) |
| *→cancelled | admin, production (`direction=cancel`) |

Уточнение: production/designer **не** ставят `with_courier` / `delivered` — это зона courier (+ admin ←/→ и jump).

### 19.3 Создание фотоцентра

Admin создаёт user `role=photo_center` → в той же транзакции: `clients` row с `user_id` + `users.client_id`.

---

## 20. Гигиена кода и качество

Раздел обязателен к соблюдению с **Фазы 0**. Цель — предсказуемость при одном разработчике без большой test suite.

**Главный риск качества v1 (не «мало lint»):** рассинхрон матрицы прав (§3), изоляции `photo_center` и расчёта денег. Их держать в **2–3 маленьких модулях** + точечные unit с первого merge Фазы 1. Остальное — усиление каркаса ниже (опыт Boxmart CRM).

### 20.1 День 0 (до бизнес-фич)

| Что | Минимум |
|-----|---------|
| TypeScript | `"strict": true` |
| ESLint + Prettier | flat ESLint (`eslint-config-next` + typescript); `npm run lint` **неинтерактивный**; Prettier format on save; в CI — `eslint` + `prettier --check` |
| Lockfile | committed (`pnpm-lock.yaml` или `package-lock.json`) |
| `.env.example` + `.gitignore` | секреты не в git |
| Миграции SQL | `migrations/001_init.sql` из §14 (не «только db push» без истории в git) |
| CI | `tsc --noEmit` + `eslint` (+ prettier check) на PR |
| Auth | **Auth.js (NextAuth v5)** Credentials — зафиксировано в ТЗ; в README указать версию пакета; не смешивать с Lucia/custom |
| Stubs | `lib/auth` (session + permissions) + `lib/money` с unit-заглушками в CI сразу |
| Cursor | `.cursor/rules`: права на сервере; money только `lib/money`; статусы через `status_transitions`; flat structure |

### 20.2 Структура репозитория (рекомендуемая)

```
app/                      # App Router: pages + route handlers
lib/
  auth/                   # session, requireAuth, permissions, assertOrderAccess
  db/                     # client + queries
  money/                  # lineTotal, recalcOrderTotal — ЕДИНСТВЕННЫЙ канон
  orders/                 # номер DK-…, status transitions (по файлам, не один 800+ LOC монолит)
  files/                  # R2 presign / confirm / download
  notifications/          # push + telegram
  validation/             # zod schemas
migrations/
docs/
  DKPrint-CRM-TZ-v1.md
  HANDOFF.md              # с первого деплоя: что сделано / smoke / «не делать»
OPS.md                    # env-пары, cron, smoke по ролям seed (без секретов)
design-system/dkprint-crm/
.cursor/rules/            # краткие .mdc под инварианты §20
```

Без преждевременных layers: repository/service/factory для CRUD не вводить.

**Рост без монолитов:** новый доменный кусок — отдельный файл (`orders-status`, `orders-files`, …). Крупные UI-панели дробить **по касанию** при фиче, не big-bang «на всякий случай».

### 20.3 Инварианты безопасности (не упрощать)

1. Расчёт цены / total — только через `lib/money` + decimal-lib (§8); в БД `NUMERIC(12,2)`; не IEEE float для сумм.  
2. Любая проверка прав — на сервере; UI лишь отражает.  
3. Валидация входа на границе API (body, query, file meta).  
4. Идемпотентность где возможно: confirm файла, повтор cron.  
5. Одна реализация бизнес-правила; если появится «fallback» — явно пометить и синхронизировать.  
6. Смена драйвера БД / session store — отдельный PR + ручной тест login.  
7. Изоляция заказов — **один** helper (§20.9); list/get/update/files/comments только через него.  
8. Эффективные права — **один** модуль (§20.9); жёсткие исключения роли (`designer` never cancel) в коде, не в JSX.

### 20.4 Правила разработки (кратко)

- Права только на сервере.  
- Статусы только через `status_transitions` (+ admin jump).  
- Ошибки API единообразны (`error` + `message`).  
- Секреты и R2 keys не в клиентском бандле.  
- Номер заказа и «календарный день» — только `APP_TIMEZONE`.  
- Не логировать пароли, session tokens, полные **presigned URL** в публичные логи.  
- Next.js: `"use server"` только на файлах с async server actions; **не** делать barrel `export { … } from …` внутри файла с `"use server"` (ломает `next build`). Barrel без директивы или прямые импорты.  
- В `lib/auth`, `lib/money`, `lib/orders` — без `any` (eslint override на эти пути).

### 20.5 Тестирование

**Обязательный минимум (unit/integration) — gate перед merge Фазы 1:**

1. Генерация `DK-YYMMDD-N` (timezone, атомарность — хотя бы mock/transaction test)  
2. `line_total` / `total_amount` (через `lib/money`)  
3. Разрешённые / запрещённые status transitions по ролям (+ **happy-path** цепочка forward)  
4. Изоляция `photo_center` (`assertOrderAccess` / where-helper)  
5. Cancel / soft-delete исключаются из KPI  

**Дополнительно с Фазы 1–2 (обязательно до приёмки v1):**

6. Admin jump «Перейти в…» разрешён admin; запрещён другим ролям  
7. Soft-delete: пароль обязателен / неверный пароль → отказ (без полного e2e БД, если можно unit на guard)

Паттерн тестов: простые `tsx` + `node:assert` scripts в `npm test` (как Boxmart) — без обязательного Jest. E2E (Playwright) — после стабилизации login + orders; **не** блокер Фазы 0–2.

**Основная страховка v1:** чеклист §22 + seed на 5 ролей.

### 20.6 Concurrent edits

v1: **last-write-wins**. Не строить optimistic locking. При необходимости позже — `updated_at` + 409.

### 20.7 Definition of Done (любая задача)

- [ ] Права проверены на сервере (через модуль §20.9)  
- [ ] Доступ к заказу — через `assertOrderAccess` / эквивалент  
- [ ] Если цена/qty — audit + пересчёт total через `lib/money`  
- [ ] Если статус — `order_status_events` + проверка `status_transitions`  
- [ ] Cancelled / soft-deleted не в рабочих списках и KPI по умолчанию  
- [ ] Нет секретов в клиенте; нет полных presigned URL в логах  
- [ ] Ручная проверка затронутой роли из seed  
- [ ] `tsc` + lint (+ prettier check в CI) чистые  

### 20.8 Не делать в v1 «на всякий случай»

- Monorepo packages / Storybook  
- CQRS, event bus, microservices  
- Generic permission framework сверх 5 флагов  
- Два способа доступа к БД одновременно  
- Coverage 100% как gate  
- Optimistic locking / conflict UI  
- Big-bang split всех UI «про запас» без фичи  
- Полный e2e на все роли до рабочих экранов  

### 20.9 Канонические модули прав и доступа

| Модуль | Обязанность |
|--------|-------------|
| `lib/auth/permissions.ts` (имя близкое) | `can(role, action, flags)` / эффективные права по §3; **designer** никогда не получает cancel/soft-delete даже с флагом |
| `lib/auth/assertOrderAccess.ts` (или в том же пакете) | Видимость и мутации заказа: `photo_center` → `client_id`; courier → статусы выдачи; остальные по матрице |
| `lib/orders/…` list filters | Только `ordersVisibleWhere(user)` — не копировать SQL-фильтры по страницам |

UI **прячет** кнопки; сервер **всегда** проверяет те же правила.

### 20.10 R2 и SLA cron (качество интеграции)

**R2**

- Канон object key — **только** §9.2:  
  `dkprint/{R2_ENV}/orders/{orderNumber}/items/{itemId}/{block}/{fileId}-{safeName}`  
  (`orderNumber`, не UUID; зафиксировать в коде + README).  
- `confirm` повторный = **идемпотентный no-op** (не дублировать строки meta).  
- Presigned PUT/GET — короткий TTL; в логах только `storage_key` / `order_number`, не полный URL.

**SLA cron** (`/api/cron/…`)

- `Authorization: Bearer CRON_SECRET`.  
- Идемпотентный проход за окно.  
- Structured log tag `[sla]` (успех / skip / fail) без секретов.  
- Sentry / admin banner — **не** в v1.

### 20.11 OPS / HANDOFF

С первого успешного деплоя staging/prod:

- `OPS.md` — имена env, smoke по ролям seed, cron, ротация секретов (значения только в Vercel).  
- `docs/HANDOFF.md` или корневой `HANDOFF.md` — краткий статус для агента/нового чата (`@HANDOFF.md`).  
- Ротация секретов: обновить **все** концы пары в одном окне + smoke (login, cron 401 без secret).

### 20.12 Приоритет внедрения качества

| Когда | Что |
|-------|-----|
| **Фаза 0** | Auth choice + CI + money stubs + permissions stubs + Cursor rules |
| **Фаза 1** | `assertOrderAccess` + status/money/isolation tests + дробление orders по файлам |
| **Фаза 2+** | R2 key format + confirm idempotency; SLA `[sla]` logs; OPS/HANDOFF |
| **По боли** | Касательный split крупных UI; Playwright после стабильных login+orders |

---

## 21. Порядок разработки

| Фаза | Deliverable |
|------|-------------|
| **0** | Repo, TS/lint/prettier/CI, Neon, миграции, seed, `.env.example`, README (Auth.js v5), login Credentials, `lib/auth` + `lib/money` stubs + unit money/status stubs в `npm test`, `.cursor/rules` |
| **1** | Orders CRUD, status engine, role filters через `assertOrderAccess` / `ordersVisibleWhere`, unit §20.5.1–5 |
| **2** | R2 presign/confirm/download (+ idempotent confirm, key format) |
| **3** | UI orders (list, create, detail, modals) |
| **4** | Workshop queue |
| **5** | Comments; notifications (Web Push + TG **живая карточка** §10.3) |
| **6** | Tasks, clients |
| **7** | SLA cron (`[sla]` logs) + admin SLA UI |
| **8** | Reports + export |
| **9** | Admin users/categories |
| **10** | QA по §22; OPS/HANDOFF актуальны |

**Ориентир полного v1:** 1 full-stack dev, **8–12 недель**.

---

## 22. Критерии приёмки v1

### 22.1 Роли и изоляция

- [ ] Photo center A не видит заказы photo center B  
- [ ] Photo center видит заказы с `clientId` своей точки (в т.ч. созданные production)  
- [ ] Production и designer видят все заказы  
- [ ] Courier видит только выдачу; без задач и файлов  

### 22.2 Заказы

- [ ] Номер `DK-YYMMDD-N`, уникальный, атомарный, день по `APP_TIMEZONE`  
- [ ] Цена × qty; total пересчитывается на сервере  
- [ ] Photo center edit только в `new` + audit  
- [ ] Production edit только `source=production`  
- [ ] Production не edit полей заказов точек  

### 22.3 Статусы

- [ ] ←/→ только соседний шаг  
- [ ] Admin модал «Перейти в…»  
- [ ] new → accepted: production и designer  
- [ ] v1 всегда через `at_designer` при движении вперёд  
- [ ] Production/designer не двигают в `with_courier`/`delivered`  

### 22.4 Отмена / удаление

- [ ] Отмена = статус + причина; designer без кнопки  
- [ ] Soft-delete = скрытие + пароль **текущего** user + comment  
- [ ] Оба исключены из KPI  
- [ ] SLA stopped при отмене и delete  

### 22.5 Файлы

- [ ] Upload в R2 presigned; не через server body  
- [ ] Два блока client/designer  
- [ ] Production догрузка client  
- [ ] Courier без доступа  

### 22.6 Уведомления

- [ ] Новый заказ — Web Push не другим точкам  
- [ ] Готов к выдаче → courier (push)  
- [ ] ☑ Проблемный макет → push + пометка в TG-карточке  
- [ ] SLA overdue → push + пометка в TG-карточке (cron, дедуп 24ч)  
- [ ] TG: одна карточка на заказ; создание при новом заказе; **edit** при смене статуса (в т.ч. cancelled/delivered)  
- [ ] TG: статус в карточке **жирным**; при комментарии — последний комментарий (courier не пишет)  
- [ ] TG: ошибки не откатывают CRM; fallback sendMessage при failed edit  

### 22.7 Модули

- [ ] Очередь без `new`  
- [ ] ТТН только production/admin  
- [ ] Задачи: Все = Мои ∪ Поставленные  
- [ ] Отчёты по флагу / admin  
- [ ] 5 permission flags в admin UI  

### 22.8 Гигиена

- [ ] strict TS + lint + prettier check + CI зелёные  
- [ ] `.env.example` актуален; в README указано **Auth.js (NextAuth v5)** |  
- [ ] Канон денег в `lib/money` (decimal-lib); API number с 2 знаками  
- [ ] Модуль прав + `assertOrderAccess` / `ordersVisibleWhere` (§20.9) — все order endpoints через них  
- [ ] Unit gate §20.5.1–5 зелёные в `npm test`  
- [ ] Unit §20.5.6–7: admin jump + soft-delete password guard  
- [ ] `.cursor/rules` с инвариантами §20 в репозитории  
- [ ] `OPS.md` + `HANDOFF.md` актуальны на staging/prod (§20.11)  

---

## 23. Roadmap (не v1)

| Этап | Содержание |
|------|------------|
| +1 | Калькулятор (iframe/API в карточке) |
| +1.5 | Пропуск `at_designer` (status graph + `categories.skip_designer`) |
| +1.5 | Доп. permission flags в UI |
| +2 | Склад |
| Опц. | Multipart upload, R2 lifecycle cleanup, SMS, un-delete, optimistic locking, e2e suite |

---

## 24. Приложения

### A. Передача в новый репозиторий

**Скопировать:**

```
docs/DKPrint-CRM-TZ-v1.md
design-system/dkprint-crm/     # MASTER.md + styles.css
```

**Не копировать слепо:** чужой `.git/`, секреты, старые split-docs.  
`.cursor/rules` — **создать заново** по инвариантам §20 (не тащить чужие правила другого проекта без ревизии).

**Первый commit = deliverable Фазы 0 (§21):**

1. Next.js scaffold + TypeScript strict + ESLint (flat) + Prettier  
2. `migrations/001_init.sql` из §14 + `seed.sql` из §19  
3. `.env.example` из §18; `.gitignore` для `.env*`  
4. CI: `tsc --noEmit` + `eslint` + `prettier --check`  
5. README: **Auth.js (NextAuth v5)** + Credentials  
6. Login (Auth.js session cookie) + stubs `lib/auth` (permissions) + `lib/money` (decimal-lib)  
7. `npm test`: unit-заглушки money (+ status stubs по готовности)  
8. `.cursor/rules`: права на сервере; money только `lib/money`; статусы через `status_transitions`; flat structure  

Далее — Фазы 1–10 по §21.  

### B. Глоссарий

| Термин | Значение |
|--------|----------|
| Точка | Фотоцентр = client с привязанным user |
| ТТН | Чекбокс «товарно-транспортная накладная оформлена» |
| Admin jump | Прямой переход статуса без соседнего шага |
| Soft-delete | Скрытие заказа, не путать с «Отменён» |

### C. История версий документа

| Версия | Дата | Суть |
|--------|------|------|
| 1.0 | авг 2026 | Полное ТЗ: бизнес, БД, API, UI, R2, приёмка |
| 1.1 | авг 2026 | Гигиена кода; auth/session; Telegram outbound-only; Vercel Cron SLA; soft-delete = пароль текущего user; `sla_overdue_notified_at`; канон фона `#f3f7f9`; DoD; уточнение ролей на courier-этапах |
| 1.2 | авг 2026 | Усиление §20: модуль прав + `assertOrderAccess`; money/Decimal; Next `"use server"` barrel; hotspots; R2/SLA ops; тесты admin jump/soft-delete; OPS/HANDOFF; Cursor rules; фазы 0–2 уточнены |
| 1.3 | авг 2026 | Выравнивание: R2 key = orderNumber; money = decimal-lib + API number (2 знака); §22.8 полный gate §20; Приложение A = Фаза 0; auth = Auth.js v5 Credentials (JWT session default) |
| 1.4 | авг 2026 | Telegram: живая карточка заказа (`sendMessage` + `editMessageText`); `orders.telegram_message_id`; статус жирным; комментарии обновляют карточку; cancelled/delivered тоже edit; Web Push event-driven без изменений |
| 1.5 | авг 2026 | `order_items.name`; TG строки состава (без sync на item CRUD); workshop состав + макет есть/нет; audit UI/API только admin\|production + читаемые подписи |

---

*DKPrint CRM TZ v1.5 — август 2026. Изменение scope — только новой версией этого файла.*

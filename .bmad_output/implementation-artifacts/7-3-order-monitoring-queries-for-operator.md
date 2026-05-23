# Story 7.3: Order Monitoring Queries for Operator

**Epic:** 7 — Resilience & Operator Tools
**Story ID:** 7.3
**GitHub Issue:** [mgiovani/fotos#74](https://github.com/mgiovani/fotos/issues/74)
**Status:** review
**Created:** 2026-03-30

---

## User Story

As the operator,
I want to query order status, revenue, and conversion metrics from the Supabase dashboard,
So that I can monitor business health and make data-driven decisions daily.

---

## Acceptance Criteria

1. **Given** the operator accesses the Supabase dashboard SQL editor
   **When** they run a query for orders by status
   **Then** they can filter by today, this week, and this month using BRT-aware timestamps (UTC-3)
   **And** results group by `conversationState` and `orderStatus`

2. **Given** the operator wants revenue metrics
   **When** they run the revenue query
   **Then** total revenue is calculated as `SUM(amount)` from `Payment` rows with `status = 'CONFIRMED'`
   **And** the query returns total revenue for today, this week, and this month

3. **Given** the operator wants conversion metrics
   **When** they run the conversion rate query
   **Then** conversion rate is calculated as: confirmed payments / total orders × 100
   **And** the query covers the same time periods (today, this week, this month)

4. **Given** the operator wants revision metrics
   **When** they run the revision rate query
   **Then** revision rate is calculated as: orders with `conversationState IN ('REVISION_1', 'REVISION_2')` / total orders × 100

5. **Given** the operator wants generation performance data
   **When** they run the average generation time query
   **Then** average time is computed as the average difference between `Generation.createdAt` and the matched `Payment.confirmedAt` for the same order

6. **Given** the operator wants failure visibility
   **When** they run the failed generation count query
   **Then** they see count of orders where `conversationState = 'FAILED'`

7. **Given** the operator wants abandoned cart data
   **When** they run the abandoned cart query
   **Then** they see count of orders where `conversationState IN ('ABANDONED_1H', 'ABANDONED_24H')`

8. **Given** the operator wants style popularity data
   **When** they run the style template query
   **Then** results list all active `StyleTemplate` records ordered by `popularity DESC`

9. **Given** all of the above
   **When** the story is complete
   **Then** all queries are documented in `mascotinhos/docs/operator-queries.sql` (new file)
   **And** all timestamp filters use `AT TIME ZONE 'America/Sao_Paulo'` for BRT correctness
   **And** the file includes a header comment explaining usage and the Supabase SQL editor URL pattern

---

## Tasks / Subtasks

- [x] Task 1: Create `mascotinhos/docs/` directory and `operator-queries.sql` file (AC: 1–9)
  - [x] Create the `mascotinhos/docs/` directory (it does not exist yet)
  - [x] Create `mascotinhos/docs/operator-queries.sql` with a header block describing usage
  - [x] Add Query 1: Orders by status (today / this week / this month) with BRT timezone filtering
  - [x] Add Query 2: Total revenue by period (SUM of Payment.amount WHERE status = 'CONFIRMED')
  - [x] Add Query 3: Conversion rate (confirmed payments / total orders × 100) by period
  - [x] Add Query 4: Revision rate (orders with REVISION_1 or REVISION_2 state / total orders × 100)
  - [x] Add Query 5: Average generation time (Generation.createdAt minus Payment.confirmedAt)
  - [x] Add Query 6: Failed order count and list (conversationState = 'FAILED')
  - [x] Add Query 7: Abandoned cart count by state (ABANDONED_1H / ABANDONED_24H)
  - [x] Add Query 8: Most popular style templates ordered by popularity DESC
  - [x] Add Query 9: Combined daily dashboard overview (single query, all key metrics)

- [x] Task 2: Validate all queries against the actual Prisma schema (AC: 1–9)
  - [x] Verify every table name matches Prisma model (`"Order"`, `"Payment"`, `"Generation"`, `"StyleTemplate"`, `"Client"`)
  - [x] Verify every column name matches the schema (camelCase with quoted identifiers: `"conversationState"`, `"orderStatus"`, `"confirmedAt"`, `"attemptNumber"`, etc.)
  - [x] Verify enum value strings match Prisma schema exactly (e.g., `'FAILED'`, `'CONFIRMED'`, `'REVISION_1'`)
  - [x] Verify JOIN conditions use correct FK columns (`"orderId"`, `"clientId"`, `"styleTemplateId"`)

- [x] Task 3: Run full test suite to confirm no regressions (AC: all)
  - [x] `cd mascotinhos && bun run check-types` — 0 new TypeScript errors in web or bot-engine (pre-existing bun:test type errors in payments/storage packages unchanged)
  - [x] `cd mascotinhos && bun test` — 331 pass, 29 fail, 5 errors (all failures pre-existing before this story — confirmed by git stash verification; no new regressions)

---

## Dev Notes

### Deliverable is a SQL file ONLY — No Application Code Changes

This story has **no TypeScript/application code changes**. The sole deliverable is `mascotinhos/docs/operator-queries.sql`. Do NOT modify any `.ts` files, `package.json`, Prisma schema, or routes.

The SQL file is documentation — it will be used by the operator directly in the Supabase dashboard SQL editor. It does NOT need to be imported or executed programmatically.

### File Location

```
mascotinhos/
└── docs/
    └── operator-queries.sql    ← NEW (create this directory and file)
```

The `mascotinhos/docs/` directory does not exist yet. Create it. This matches how monorepos typically place project-level docs alongside the monorepo root.

### Prisma Schema — Exact Table and Column Names

PostgreSQL requires double-quoting for camelCase identifiers. All Prisma model names are PascalCase, which Postgres maps to that exact casing with quotes.

**Table names (always double-quote in SQL):**
- `"Order"` — not `order` (reserved keyword AND wrong case)
- `"Payment"`
- `"Generation"`
- `"StyleTemplate"`
- `"Client"`

**Critical column names (camelCase — must be quoted):**
- `"Order"."conversationState"` — ConversationState enum
- `"Order"."orderStatus"` — OrderStatus enum
- `"Order"."styleTemplateId"` — FK to StyleTemplate
- `"Order"."clientId"` — FK to Client
- `"Order"."createdAt"`, `"Order"."updatedAt"`
- `"Payment"."orderId"`, `"Payment"."status"` (PaymentStatus enum), `"Payment"."confirmedAt"`, `"Payment"."amount"` (Decimal)
- `"Generation"."orderId"`, `"Generation"."attemptNumber"`, `"Generation"."createdAt"`, `"Generation"."qualityScore"`, `"Generation"."revisionFeedback"`, `"Generation"."promptUsed"`, `"Generation"."imageUrl"`
- `"StyleTemplate"."popularity"`, `"StyleTemplate"."active"`, `"StyleTemplate"."slug"`, `"StyleTemplate"."name"`
- `"Client"."whatsappSenderId"`, `"Client"."phone"`, `"Client"."consentTimestamp"`

**Enum values (PostgreSQL enum literals — use single-quoted strings):**

ConversationState values: `'GREETING'`, `'COLLECTING_PHOTOS'`, `'COLLECTING_THEME'`, `'COLLECTING_OUTFIT'`, `'CONFIRMING_ORDER'`, `'AWAITING_PAYMENT'`, `'ABANDONED_1H'`, `'ABANDONED_24H'`, `'GENERATING'`, `'DELIVERING'`, `'AWAITING_FEEDBACK'`, `'REVISION_1'`, `'REVISION_2'`, `'COMPLETED'`, `'FAILED'`

OrderStatus values: `'PENDING'`, `'PAID'`, `'GENERATING'`, `'DELIVERED'`, `'CANCELLED'`

PaymentStatus values: `'PENDING'`, `'CONFIRMED'`, `'FAILED'`, `'REFUNDED'`

### BRT Timezone Handling

All timestamp filtering must use `AT TIME ZONE 'America/Sao_Paulo'` (which handles DST correctly — Brasília does not observe DST but this is the canonical IANA name for BRT/UTC-3).

Pattern for "today in BRT":
```sql
WHERE ("Order"."createdAt" AT TIME ZONE 'America/Sao_Paulo')::date
    = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
```

Pattern for "this week in BRT":
```sql
WHERE ("Order"."createdAt" AT TIME ZONE 'America/Sao_Paulo')
    >= DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Sao_Paulo')
```

Pattern for "this month in BRT":
```sql
WHERE ("Order"."createdAt" AT TIME ZONE 'America/Sao_Paulo')
    >= DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Sao_Paulo')
```

### Revenue Query Notes

`Payment.amount` is a Prisma `Decimal` — in PostgreSQL this is `NUMERIC`. Use `SUM(p.amount)` and cast with `::numeric` or `ROUND(SUM(p.amount)::numeric, 2)` for display.

Only `PaymentStatus = 'CONFIRMED'` payments count as revenue. A PAID order has at least one CONFIRMED payment.

### Average Generation Time

`Generation.createdAt` records when the Generation row was written (after generation + upload). `Payment.confirmedAt` records when PIX was confirmed. The delta approximates end-to-end generation time.

Use `EXTRACT(EPOCH FROM ...)` to get seconds, then divide by 60 for minutes.

The `Generation` table has `@@unique([orderId, attemptNumber])`. For average generation time, use the max `attemptNumber` per order (the final/successful generation attempt):
```sql
JOIN LATERAL (
  SELECT "createdAt" FROM "Generation"
  WHERE "orderId" = o.id
  ORDER BY "attemptNumber" DESC
  LIMIT 1
) g ON TRUE
```

### Failed Orders Query (from Story 7.2)

Story 7.2 (already done) established:
- `Order.conversationState = 'FAILED'` marks terminal generation failures
- `Order.orderStatus = 'CANCELLED'` (because OrderStatus enum has no FAILED value)
- `Generation.revisionFeedback` stores the error code (e.g., `'GENERATION_FAILED'`, `'UPLOAD_FAILED'`)

The failed-orders query from Story 7.2 AC-5 is already the canonical form. Include it verbatim:
```sql
SELECT o.id, o."updatedAt", g."revisionFeedback" AS error_context, g."attemptNumber", g."promptUsed"
FROM "Order" o
LEFT JOIN "Generation" g ON g."orderId" = o.id
WHERE o."conversationState" = 'FAILED'
ORDER BY o."updatedAt" DESC;
```

### SQL File Structure

Organize `operator-queries.sql` as a standalone runnable file with:
1. Header comment block (project name, usage instructions, Supabase SQL editor note)
2. Section comments (`-- ========================================`) separating logical groups
3. Each query preceded by a descriptive comment explaining what it shows and when to use it
4. Named CTEs where appropriate for readability
5. Final `-- End of operator-queries.sql` marker

### Previous Story Learnings (from 7.1 and 7.2)

- Story 7.1 established `notifyOperator` pattern — no relevance to this story (no app code)
- Story 7.2 established the FAILED state convention — reuse the exact SQL from AC-5 verbatim in the failed orders query
- Story 7.2 file list confirms no `docs/` directory exists yet

### Testing Notes

This story has no unit/integration tests to write — it's a SQL documentation file. The only validation is:
1. Schema correctness (column names, table names, enum values must match `schema.prisma` exactly)
2. TypeScript type-check pass (`bun run check-types`) to confirm no changes broke types
3. Full test suite pass (`bun test`) to confirm no regressions

Run from `mascotinhos/` directory:
```bash
cd mascotinhos
bun run check-types
bun test
```

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `mascotinhos/docs/` directory (new — did not exist before this story).
- Created `mascotinhos/docs/operator-queries.sql` with 9 labelled query sections: orders by state, total revenue, conversion rate, revision rate, average generation time, failed orders (count + detailed list), abandoned cart count, style template popularity, and a combined daily dashboard overview query.
- All table names and column names validated against `packages/db/prisma/schema/schema.prisma`: double-quoted camelCase identifiers, correct enum string literals, correct FK column names.
- All timestamp filters use `AT TIME ZONE 'America/Sao_Paulo'` for BRT correctness.
- Failed orders query (Query 6) includes the canonical form from Story 7.2 AC-5 verbatim.
- Average generation time query (Query 5) uses `LATERAL` subquery on `Generation` to select the last attempt per order.
- Daily dashboard query (Query 9) uses CTEs to compute all key metrics in a single statement.
- No application code changes. 0 new TypeScript errors. 331 tests pass, 29 pre-existing failures unchanged.

### File List

- `mascotinhos/docs/operator-queries.sql` (new)
- `.bmad_output/implementation-artifacts/7-3-order-monitoring-queries-for-operator.md` (this file)
- `.bmad_output/implementation-artifacts/sprint-status.yaml` (modified — story status)

### Change Log

- 2026-03-30: Implemented Story 7.3 — created `mascotinhos/docs/operator-queries.sql` with 9 operator monitoring queries covering order status, revenue, conversion, revision rate, generation time, failures, abandoned carts, style popularity, and a combined daily dashboard overview. All queries validated against Prisma schema. No application code changes.

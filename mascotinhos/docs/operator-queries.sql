-- ============================================================
-- Mascotinhos — Operator Monitoring Queries
-- ============================================================
-- Usage: Paste any query below into the Supabase SQL editor.
--   URL pattern: https://supabase.com/dashboard/project/<project-ref>/sql/new
--   Navigation:  Dashboard → (select project) → SQL Editor → New query
-- All timestamps are filtered in BRT (Brasília Time, UTC-3).
-- Tables use Prisma camelCase column names — always double-quote them.
-- ============================================================

-- ============================================================
-- QUERY 1: Orders by Conversation State — Today / This Week / This Month
-- Shows where orders are in the bot flow right now.
-- ============================================================

-- Today
SELECT
  "conversationState",
  "orderStatus",
  COUNT(*) AS total
FROM "Order"
WHERE ("createdAt" AT TIME ZONE 'America/Sao_Paulo')::date
    = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
GROUP BY "conversationState", "orderStatus"
ORDER BY total DESC;

-- This week
SELECT
  "conversationState",
  "orderStatus",
  COUNT(*) AS total
FROM "Order"
WHERE ("createdAt" AT TIME ZONE 'America/Sao_Paulo')
    >= DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Sao_Paulo')
GROUP BY "conversationState", "orderStatus"
ORDER BY total DESC;

-- This month
SELECT
  "conversationState",
  "orderStatus",
  COUNT(*) AS total
FROM "Order"
WHERE ("createdAt" AT TIME ZONE 'America/Sao_Paulo')
    >= DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Sao_Paulo')
GROUP BY "conversationState", "orderStatus"
ORDER BY total DESC;

-- ============================================================
-- QUERY 2: Total Revenue (Confirmed Payments)
-- Only PaymentStatus = 'CONFIRMED' rows count as revenue.
-- Payment.amount is NUMERIC (Prisma Decimal).
-- ============================================================

SELECT
  'today'      AS period,
  ROUND(SUM(p.amount)::numeric, 2) AS revenue_brl,
  COUNT(*)                          AS confirmed_payments
FROM "Payment" p
WHERE p.status = 'CONFIRMED'
  AND (p."confirmedAt" AT TIME ZONE 'America/Sao_Paulo')::date
    = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date

UNION ALL

SELECT
  'this_week'  AS period,
  ROUND(SUM(p.amount)::numeric, 2),
  COUNT(*)
FROM "Payment" p
WHERE p.status = 'CONFIRMED'
  AND (p."confirmedAt" AT TIME ZONE 'America/Sao_Paulo')
    >= DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Sao_Paulo')

UNION ALL

SELECT
  'this_month' AS period,
  ROUND(SUM(p.amount)::numeric, 2),
  COUNT(*)
FROM "Payment" p
WHERE p.status = 'CONFIRMED'
  AND (p."confirmedAt" AT TIME ZONE 'America/Sao_Paulo')
    >= DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Sao_Paulo')

ORDER BY period;

-- ============================================================
-- QUERY 3: Conversion Rate
-- Conversion = confirmed payments / total orders × 100
-- Covers today, this week, and this month.
-- ============================================================

WITH
  today_conv AS (
    SELECT
      'today'                                                            AS period,
      COUNT(DISTINCT o.id)                                               AS total_orders,
      COUNT(DISTINCT p."orderId") FILTER (WHERE p.status = 'CONFIRMED') AS paid_orders
    FROM "Order" o
    LEFT JOIN "Payment" p ON p."orderId" = o.id
    WHERE (o."createdAt" AT TIME ZONE 'America/Sao_Paulo')::date
        = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
  ),
  week_conv AS (
    SELECT
      'this_week'                                                        AS period,
      COUNT(DISTINCT o.id)                                               AS total_orders,
      COUNT(DISTINCT p."orderId") FILTER (WHERE p.status = 'CONFIRMED') AS paid_orders
    FROM "Order" o
    LEFT JOIN "Payment" p ON p."orderId" = o.id
    WHERE (o."createdAt" AT TIME ZONE 'America/Sao_Paulo')
        >= DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Sao_Paulo')
  ),
  month_conv AS (
    SELECT
      'this_month'                                                       AS period,
      COUNT(DISTINCT o.id)                                               AS total_orders,
      COUNT(DISTINCT p."orderId") FILTER (WHERE p.status = 'CONFIRMED') AS paid_orders
    FROM "Order" o
    LEFT JOIN "Payment" p ON p."orderId" = o.id
    WHERE (o."createdAt" AT TIME ZONE 'America/Sao_Paulo')
        >= DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Sao_Paulo')
  ),
  combined AS (
    SELECT * FROM today_conv
    UNION ALL
    SELECT * FROM week_conv
    UNION ALL
    SELECT * FROM month_conv
  )
SELECT
  period,
  total_orders,
  paid_orders,
  CASE
    WHEN total_orders = 0 THEN 0
    ELSE ROUND((paid_orders::numeric / total_orders) * 100, 1)
  END AS conversion_rate_pct
FROM combined
ORDER BY period;

-- ============================================================
-- QUERY 4: Revision Rate
-- Revision = orders that reached REVISION_1 or REVISION_2 state
-- ============================================================

WITH monthly AS (
  SELECT
    COUNT(*)                                                                 AS total_orders,
    COUNT(*) FILTER (WHERE "conversationState" IN ('REVISION_1', 'REVISION_2')) AS revised_orders
  FROM "Order"
  WHERE ("createdAt" AT TIME ZONE 'America/Sao_Paulo')
      >= DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Sao_Paulo')
)
SELECT
  total_orders,
  revised_orders,
  CASE
    WHEN total_orders = 0 THEN 0
    ELSE ROUND((revised_orders::numeric / total_orders) * 100, 1)
  END AS revision_rate_pct
FROM monthly;

-- ============================================================
-- QUERY 5: Average Generation Time (minutes)
-- Measures time from PIX confirmation to image generation write.
-- Uses the last Generation attempt per order (highest attemptNumber).
-- ============================================================

SELECT
  ROUND(
    AVG(
      EXTRACT(EPOCH FROM (g.last_gen_at - p."confirmedAt")) / 60.0
    )::numeric,
    1
  ) AS avg_generation_minutes,
  COUNT(*) AS sample_size
FROM "Order" o
JOIN "Payment" p ON p."orderId" = o.id AND p.status = 'CONFIRMED'
JOIN LATERAL (
  SELECT "createdAt" AS last_gen_at
  FROM "Generation"
  WHERE "orderId" = o.id
  ORDER BY "attemptNumber" DESC
  LIMIT 1
) g ON TRUE
WHERE o."orderStatus" = 'DELIVERED'
  AND (o."createdAt" AT TIME ZONE 'America/Sao_Paulo')
      >= DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Sao_Paulo');

-- ============================================================
-- QUERY 6: Failed Orders
-- conversationState = 'FAILED' marks terminal generation failures.
-- orderStatus = 'CANCELLED' (OrderStatus enum has no FAILED value — by design).
-- Generation.revisionFeedback stores error code for failed generations.
-- ============================================================

-- Count of failed orders this month
SELECT COUNT(*) AS failed_orders_this_month
FROM "Order"
WHERE "conversationState" = 'FAILED'
  AND ("updatedAt" AT TIME ZONE 'America/Sao_Paulo')
      >= DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Sao_Paulo');

-- Detailed list of all failed orders (for manual investigation)
SELECT
  o.id                          AS order_id,
  o."updatedAt"                 AS failed_at,
  g."revisionFeedback"          AS error_code,
  g."attemptNumber"             AS attempts,
  LEFT(g."promptUsed", 120)     AS prompt_preview,
  c."whatsappSenderId"          AS client_wa_id
FROM "Order" o
LEFT JOIN LATERAL (
  SELECT "revisionFeedback", "attemptNumber", "promptUsed"
  FROM "Generation"
  WHERE "orderId" = o.id
  ORDER BY "attemptNumber" DESC
  LIMIT 1
) g ON TRUE
LEFT JOIN "Client" c ON c.id = o."clientId"
WHERE o."conversationState" = 'FAILED'
ORDER BY o."updatedAt" DESC;

-- ============================================================
-- QUERY 7: Abandoned Cart Count
-- ABANDONED_1H = sent first nudge (1.5h silence)
-- ABANDONED_24H = sent closure message (24h after nudge)
-- ============================================================

SELECT
  "conversationState",
  COUNT(*) AS count,
  MIN("updatedAt") AT TIME ZONE 'America/Sao_Paulo' AS oldest,
  MAX("updatedAt") AT TIME ZONE 'America/Sao_Paulo' AS most_recent
FROM "Order"
WHERE "conversationState" IN ('ABANDONED_1H', 'ABANDONED_24H')
GROUP BY "conversationState"
ORDER BY "conversationState";

-- Monthly abandoned cart trend
SELECT
  DATE_TRUNC('month', "createdAt" AT TIME ZONE 'America/Sao_Paulo')::date AS month,
  COUNT(*) FILTER (WHERE "conversationState" = 'ABANDONED_1H')             AS abandoned_1h,
  COUNT(*) FILTER (WHERE "conversationState" = 'ABANDONED_24H')            AS abandoned_24h
FROM "Order"
WHERE "conversationState" IN ('ABANDONED_1H', 'ABANDONED_24H')
GROUP BY 1
ORDER BY 1 DESC;

-- ============================================================
-- QUERY 8: Most Popular Style Templates
-- popularity increments atomically each time a client selects the style.
-- ============================================================

SELECT
  name,
  slug,
  popularity,
  active,
  array_length("exampleImages", 1) AS example_image_count,
  tags
FROM "StyleTemplate"
ORDER BY popularity DESC, name;

-- Active templates only (what the bot currently shows)
SELECT
  name,
  slug,
  popularity
FROM "StyleTemplate"
WHERE active = true
ORDER BY popularity DESC;

-- ============================================================
-- QUERY 9: Daily Dashboard Overview (All Key Metrics — Single Run)
-- Run this every morning for a quick business health check.
-- ============================================================

WITH
  today_range AS (
    SELECT
      (DATE_TRUNC('day', NOW() AT TIME ZONE 'America/Sao_Paulo'))
        AT TIME ZONE 'America/Sao_Paulo' AS day_start,
      (DATE_TRUNC('day', NOW() AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '1 day')
        AT TIME ZONE 'America/Sao_Paulo' AS day_end
  ),
  month_start AS (
    SELECT DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Sao_Paulo')
             AT TIME ZONE 'America/Sao_Paulo' AS ts
  ),

  orders_today AS (
    SELECT COUNT(*) AS cnt FROM "Order", today_range
    WHERE "createdAt" >= today_range.day_start
      AND "createdAt" <  today_range.day_end
  ),
  orders_month AS (
    SELECT COUNT(*) AS cnt FROM "Order", month_start
    WHERE "createdAt" >= month_start.ts
  ),

  revenue_today AS (
    SELECT COALESCE(ROUND(SUM(p.amount)::numeric, 2), 0) AS brl
    FROM "Payment" p, today_range
    WHERE p.status = 'CONFIRMED'
      AND p."confirmedAt" >= today_range.day_start
      AND p."confirmedAt" <  today_range.day_end
  ),
  revenue_month AS (
    SELECT COALESCE(ROUND(SUM(p.amount)::numeric, 2), 0) AS brl
    FROM "Payment" p, month_start
    WHERE p.status = 'CONFIRMED'
      AND p."confirmedAt" >= month_start.ts
  ),

  conversions_month AS (
    SELECT
      COUNT(DISTINCT o.id)                                               AS total,
      COUNT(DISTINCT p."orderId") FILTER (WHERE p.status = 'CONFIRMED') AS paid
    FROM "Order" o
    LEFT JOIN "Payment" p ON p."orderId" = o.id, month_start
    WHERE o."createdAt" >= month_start.ts
  ),

  revisions_month AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE "conversationState" IN ('REVISION_1', 'REVISION_2')) AS revised
    FROM "Order", month_start
    WHERE "createdAt" >= month_start.ts
  ),

  failed_month AS (
    SELECT COUNT(*) AS cnt FROM "Order", month_start
    WHERE "conversationState" = 'FAILED'
      AND "updatedAt" >= month_start.ts
  ),

  abandoned_month AS (
    SELECT COUNT(*) AS cnt FROM "Order", month_start
    WHERE "conversationState" IN ('ABANDONED_1H', 'ABANDONED_24H')
      AND "createdAt" >= month_start.ts
  )

SELECT
  -- Volume
  (SELECT cnt FROM orders_today)   AS orders_today,
  (SELECT cnt FROM orders_month)   AS orders_this_month,

  -- Revenue
  (SELECT brl FROM revenue_today)  AS revenue_today_brl,
  (SELECT brl FROM revenue_month)  AS revenue_month_brl,

  -- Rates (monthly)
  CASE
    WHEN (SELECT total FROM conversions_month) = 0 THEN 0
    ELSE ROUND(
      (SELECT paid FROM conversions_month)::numeric
      / (SELECT total FROM conversions_month) * 100, 1
    )
  END AS conversion_rate_pct,

  CASE
    WHEN (SELECT total FROM revisions_month) = 0 THEN 0
    ELSE ROUND(
      (SELECT revised FROM revisions_month)::numeric
      / (SELECT total FROM revisions_month) * 100, 1
    )
  END AS revision_rate_pct,

  -- Problems (monthly)
  (SELECT cnt FROM failed_month)   AS failed_orders_month,
  (SELECT cnt FROM abandoned_month) AS abandoned_orders_month;

-- ============================================================
-- End of operator-queries.sql
-- ============================================================

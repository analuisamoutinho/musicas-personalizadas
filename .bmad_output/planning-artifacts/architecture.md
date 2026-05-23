---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
status: 'complete'
completedAt: '2026-03-27'
inputDocuments:
  - prd.md
  - product-brief-mascotinhos.md
  - product-brief-mascotinhos-distillate.md
  - domain-mascotinhos-ai-illustrations-research-2026-03-27.md
  - market-mascotinhos-research-2026-03-27.md
  - technical-mascotinhos-research-2026-03-27.md
workflowType: 'architecture'
project_name: 'Mascotinhos'
user_name: 'Giovani'
date: '2026-03-27'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
51 FRs across 11 capability areas: Lead Capture (4), Conversation Management (7), Photo Collection (4), Payment Processing (5), Image Generation & Delivery (7), Revision Handling (4), Abandoned Cart (3), Style Template Management (5), Landing Page (5), Compliance & Privacy (4), Operator Tools (3). The conversation management and image generation areas carry the most architectural weight.

**Non-Functional Requirements:**
28 NFRs across: Performance (webhook <5s, generation <2min, landing <2.5s LCP), Security (webhook signatures, photo encryption, LGPD), Scalability (100→1000 orders/month), Availability (>99% uptime), Integration Reliability (retry/fallback for 3 external APIs), Observability (logging, error tracking, order metrics).

**Scale & Complexity:**
- Primary domain: Full-stack event-driven (webhook-first architecture)
- Complexity level: Medium-High
- Estimated architectural components: 8 (bot-engine, image-gen, payments, whatsapp adapter, database, storage, landing page, async queue)

### Technical Constraints & Dependencies

- WhatsApp webhook MUST respond <5 seconds (non-negotiable, API will retry/fail)
- 72-hour free messaging window from click-to-WhatsApp ads (business logic constraint)
- Supabase free tier auto-pauses after 7 days (upgrade before launch)
- WhatsApp Business verification: 2-10 days (blocks scaling past 250 conversations/day)
- OpenAI GPT Image 1.5: rate limits tier-based, need retry with exponential backoff
- Asaas: 100 free PIX/month, then R$1.99/tx (cost trigger for MEI registration)
- Template messages require Meta pre-approval (1-24h) for messages outside windows

### Cross-Cutting Concerns Identified

1. **LGPD compliance** — consent capture, data minimization, 30-day photo TTL, DPA with OpenAI
2. **Error handling & resilience** — 3 external APIs (WhatsApp, OpenAI, Asaas) each with different failure modes; need retry, fallback, graceful degradation
3. **Conversation state consistency** — every webhook event must load/update state atomically; race conditions possible with rapid messages
4. **Observability** — order lifecycle tracking, API call logging, cost monitoring, error alerting
5. **Extensibility** — product type as configurable entity; prompt pipeline, payment flow, and data model must be product-agnostic

## Starter Template Evaluation

### Primary Technology Domain

Full-stack event-driven web application (Next.js + WhatsApp bot backend), already scaffolded.

### Selected Starter: Better-T-Stack (Already Scaffolded)

**Rationale:** Provides Next.js + Prisma + Supabase + Turborepo monorepo with AI example — matches all project requirements. Already initialized at `fotos/mascotinhos/`.

**Initialization Command (already executed):**
```bash
bunx create-better-t-stack@latest mascotinhos --frontend next --backend self --runtime none --database postgres --orm prisma --api none --auth none --addons husky turborepo --examples ai --db-setup supabase --manual-db --web-deploy none --server-deploy none --git --package-manager bun --install
```

**Architectural Decisions Provided by Starter:**

| Decision | Choice |
|----------|--------|
| Language & Runtime | TypeScript, Bun package manager |
| Framework | Next.js (App Router) with self-hosted backend |
| Database | PostgreSQL via Supabase + Prisma ORM |
| Styling | Tailwind CSS + shadcn/ui components |
| Monorepo | Turborepo (task caching, parallel builds) |
| Code Quality | Husky git hooks |
| AI Example | AI SDK boilerplate included |
| Structure | `apps/web` + `packages/db` + `packages/ui` + `packages/env` + `packages/config` |

### SDK & Integration Strategy

| Integration | Approach | Package |
|------------|---------|---------|
| AI (conversation + image gen) | AI SDK + AI Gateway | `ai` (model strings route through gateway) |
| WhatsApp | Chat SDK | `chat` + `@chat-adapter/whatsapp` |
| Supabase DB | Official SDK + ORM | `@supabase/supabase-js` + Prisma |
| Supabase Storage | Official SDK | `@supabase/supabase-js` (built-in storage client) |
| Asaas PIX | Thin typed HTTP wrapper | Custom in `packages/payments` (~100 lines, 5-6 endpoints) |

### Packages to Add (Not in Starter)

- `chat` + `@chat-adapter/whatsapp` — WhatsApp Business API adapter
- `@ai-sdk/react` — React hooks for AI (if needed for landing page)
- Custom packages: `bot-engine`, `image-gen`, `payments`
- `@upstash/qstash` — async job queue for image generation
- Async queue solution: Upstash QStash (30K free/month)

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
1. Async queue: Upstash QStash (30K free/month, HTTP-based, artificial delay built-in)
2. Error handling: Retry 3x exponential backoff + notify operator via WhatsApp/Telegram
3. No auth for MVP (no admin UI)
4. Environment: `.env.local` (dev) + Vercel env vars (prod)

**Already Decided (Starter + Brainstorming):**
- Database: Supabase Postgres + Prisma
- Framework: Next.js App Router on Vercel
- WhatsApp: Chat SDK + @chat-adapter/whatsapp
- AI: AI SDK v6 + GPT-5-mini (conversation) + GPT Image 1.5 (generation)
- Payments: Asaas PIX (thin typed HTTP wrapper)
- Storage: Supabase Storage
- Monorepo: Turborepo
- Landing page: Tailwind + shadcn/ui
- Deploy: Vercel auto-deploy from git

**Deferred Decisions (Post-MVP):**
- Admin dashboard auth (Supabase Auth when dashboard is built)
- CDN/caching strategy for landing page images
- CI/CD pipeline (Vercel auto-deploy sufficient for MVP)

### Data Architecture

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | Supabase Postgres + Prisma | Already scaffolded, free tier for MVP |
| Async Queue | Upstash QStash | 30K free/month (30x MVP volume), HTTP-based, artificial delay via publish delay param, Vercel ecosystem |
| Caching | None for MVP | Low traffic, no caching needed yet |
| Migrations | Prisma Migrate | Built-in, `bun run db:push` for dev, `prisma migrate deploy` for prod |
| Data validation | Zod schemas | Shared between API routes and Prisma, type-safe |

### Authentication & Security

| Decision | Choice | Rationale |
|----------|--------|-----------|
| User auth | None (MVP) | No admin UI; "user" is WhatsApp phone number |
| Webhook security | Signature verification | Both WhatsApp + Asaas webhooks verified on every request |
| Photo storage | Supabase Storage with bucket policies | Reference photos: 30-day TTL bucket; generated images: permanent bucket |
| API keys | Vercel env vars (prod) + .env.local (dev) | Standard, no secrets in code |
| Future admin auth | Supabase Auth | Add when dashboard is built |

### API & Communication Patterns

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary API | Webhook handlers (Next.js API routes) | Event-driven, not REST API |
| Error handling | Retry 3x exponential backoff + operator notification | Operator gets WhatsApp/Telegram alert on persistent failures |
| Inter-package communication | Direct function imports (monorepo) | No need for HTTP between packages |
| External API resilience | Per-API retry with circuit breaker pattern | OpenAI, Asaas, WhatsApp each have different failure modes |
| Async job pattern | QStash publish → API route consumer | `publish({url: "/api/generate", body: {orderId}, delay: "90s"})` — delay = artificial production feel |

### Frontend Architecture (Landing Page)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Rendering | Static (SSG) with ISR for portfolio | Mostly static, portfolio updates occasionally |
| Components | shadcn/ui | Already in starter, consistent design |
| Images | Next.js Image component | Automatic optimization for portfolio |
| CTA links | `wa.me` deep links with pre-filled messages | Per-style CTAs, no JavaScript needed |

### Infrastructure & Deployment

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Hosting | Vercel (auto-deploy from git) | Zero config, native Next.js |
| Environment config | `.env.local` (dev) + Vercel env vars (prod) | Standard pattern |
| Monitoring | Vercel logs + console.error for now | Add structured observability post-MVP |
| Scaling trigger | Upgrade Supabase to Pro at 50+ orders/month | Auto-pause prevention + storage headroom |

### Decision Impact Analysis

**Implementation Sequence:**
1. Supabase project setup + Prisma schema
2. WhatsApp webhook + Chat SDK adapter
3. AI Agent (bot-engine) with conversation state machine
4. Asaas payment integration
5. Upstash QStash for async image generation (with artificial delay)
6. Image generation pipeline (GPT Image 1.5)
7. Landing page (portfolio, styles, legal, CTAs)
8. Error handling + operator notifications

**Cross-Component Dependencies:**
- QStash depends on: Supabase (order state) + Image Gen endpoint (consumer)
- Bot Engine depends on: WhatsApp adapter + Payments + QStash (enqueue)
- Image Gen depends on: QStash (triggered) + Supabase Storage (upload) + WhatsApp (deliver)

## Implementation Patterns & Consistency Rules

### Critical Conflict Points Identified

12 areas where AI agents could make different choices: database naming, API response format, error handling flow, file naming, state management, event naming, logging format, retry logic, environment access, tool definition structure, queue message format, storage path conventions.

### Naming Patterns

**Database Naming (Prisma schema):**
- Models: PascalCase singular (`Client`, `Order`, `Payment`, `Generation`, `StyleTemplate`)
- Fields: camelCase (`whatsappSenderId`, `createdAt`, `promptTemplate`)
- Enums: UPPER_SNAKE_CASE values (`AWAITING_PAYMENT`, `REVISION_1`)
- Relations: camelCase matching model name (`client`, `order`, `styleTemplate`)
- Indexes: Prisma default naming — do not override

**API Naming:**
- Route paths: kebab-case (`/api/whatsapp/webhook`, `/api/payments/webhook`, `/api/generate`)
- No REST resource endpoints — webhook handlers only
- Query params: camelCase if ever needed (`orderId`)

**Code Naming:**
- Files: kebab-case (`collect-photos.ts`, `state-machine.ts`, `create-pix.ts`)
- Directories: kebab-case (`bot-engine`, `image-gen`)
- Functions: camelCase (`collectPhotos`, `generatePayment`, `enrichPrompt`)
- Types/Interfaces: PascalCase (`OrderStatus`, `ConversationState`, `GenerationResult`)
- Constants: UPPER_SNAKE_CASE (`MAX_REVISIONS = 2`, `ARTIFICIAL_DELAY_MS = 90_000`)
- Zod schemas: camelCase with `Schema` suffix (`createOrderSchema`, `webhookPayloadSchema`)
- Tool names: camelCase matching file name (`collectPhotos`, `selectStyle`, `confirmOrder`)

**Package Naming:**
- Internal packages: `@mascotinhos/bot-engine`, `@mascotinhos/image-gen`, `@mascotinhos/payments`, `@mascotinhos/db`, `@mascotinhos/storage`, `@mascotinhos/env`

### Structure Patterns

**Test Organization:**
- Co-located tests: `src/tools/collect-photos.test.ts` next to `src/tools/collect-photos.ts`
- Test utilities: `src/__test__/` per package for shared fixtures
- No top-level `tests/` directory

**Component Organization (Landing Page):**
- By feature area: `components/portfolio/`, `components/styles/`, `components/layout/`
- shadcn/ui primitives stay in `components/ui/` (starter default)

**Configuration:**
- Package-level config in each package's root (`package.json`, `tsconfig.json`)
- Shared TypeScript config in `packages/config`
- Environment validation in `packages/env`

### Format Patterns

**API Response Formats (Webhook Handlers):**
- WhatsApp webhook: always return `{ status: "ok" }` with HTTP 200 within 5s
- Payment webhook: return `{ received: true }` with HTTP 200
- QStash consumer (`/api/generate`): return HTTP 200 on success, 500 on retry-eligible failure
- No wrapper envelope — webhook handlers are not user-facing APIs

**Error Response Structure (Internal):**
```typescript
type AppError = {
  code: string;        // e.g., "GENERATION_FAILED", "PAYMENT_EXPIRED"
  message: string;     // Human-readable for logging
  orderId?: string;    // Context for debugging
  retryable: boolean;  // Whether caller should retry
  cause?: unknown;     // Original error
};
```

**Date/Time:**
- Database: Prisma `DateTime` (stored as UTC timestamp)
- JSON payloads: ISO 8601 strings (`2026-03-27T14:30:00.000Z`)
- Display to client: formatted in PT-BR locale by the bot-engine before sending

**JSON Fields:**
- camelCase in all TypeScript code and API boundaries
- Prisma generates camelCase by default — do not override

### Communication Patterns

**Logging:**
- Structured JSON logs via `console.log(JSON.stringify({ level, event, orderId, ...data }))`
- Levels: `info` (happy path events), `warn` (retryable failures), `error` (terminal failures)
- Every log entry MUST include `orderId` when available
- PII redaction: phone numbers logged as last 4 digits only (`***1234`)
- No `console.log` for debugging — remove before merge

**Event Naming (QStash messages):**
- QStash body: `{ orderId: string, action: string, attempt?: number }`
- Actions: `generate`, `deliver`, `nudge_abandoned`, `close_abandoned`

**Operator Notifications:**
- Format: `[MASCOTINHOS] {severity}: {message} | Order: {orderId}`
- Channel: WhatsApp message to operator number (via Chat SDK) or Telegram bot
- Triggers: generation failed after all retries, payment webhook verification failed, QStash consumer error

### Process Patterns

#### 1. Error Handling Pattern

```
External API call flow:
  try {
    result = await callWithRetry(apiCall, { maxRetries: 3, backoff: "exponential" })
  } catch (error) {
    log.error({ event: "api_call_failed", orderId, service, error })
    if (isOrderCritical) notifyOperator(orderId, error)
    throw new AppError({ code, message, retryable: false, cause: error })
  }
```

- **WhatsApp webhook handler:** Always respond HTTP 200 within 5s. Catch ALL errors inside handler. Defer work via QStash. Never let exceptions propagate to HTTP response.
- **Image generation failures:** Update order status to `FAILED`. Notify operator. Do NOT retry at the HTTP level (QStash handles retries automatically).
- **Payment webhook:** Check `payment.asaasId` against existing Payment records before processing. Skip if already `confirmed`. This prevents duplicate order triggers on Asaas retry deliveries.
- **Supabase Storage upload failures:** Retry 2x inline (fast operation). If still fails, mark generation as failed, notify operator.

#### 2. Conversation State Machine Pattern

```typescript
enum ConversationState {
  GREETING = "GREETING",
  COLLECTING_PHOTOS = "COLLECTING_PHOTOS",
  COLLECTING_THEME = "COLLECTING_THEME",
  COLLECTING_OUTFIT = "COLLECTING_OUTFIT",
  CONFIRMING_ORDER = "CONFIRMING_ORDER",
  AWAITING_PAYMENT = "AWAITING_PAYMENT",
  ABANDONED_1H = "ABANDONED_1H",
  ABANDONED_24H = "ABANDONED_24H",
  GENERATING = "GENERATING",
  DELIVERING = "DELIVERING",
  AWAITING_FEEDBACK = "AWAITING_FEEDBACK",
  REVISION_1 = "REVISION_1",
  REVISION_2 = "REVISION_2",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}
```

**State loading per webhook event:**
1. Extract `whatsappSenderId` from incoming webhook
2. `SELECT * FROM "Order" WHERE "clientId" = (SELECT id FROM "Client" WHERE "whatsappSenderId" = $1) AND status NOT IN ('COMPLETED', 'FAILED', 'ABANDONED_24H') ORDER BY "createdAt" DESC LIMIT 1`
3. If no active order: create new Client (if needed) + new Order in `GREETING` state
4. Pass current state + message to AI Agent
5. Agent processes message, calls tools, returns response + new state
6. Update order status atomically: `UPDATE "Order" SET status = $1, "updatedAt" = NOW() WHERE id = $2 AND status = $3` (optimistic concurrency — the `AND status = $3` clause prevents race conditions from rapid duplicate webhooks; if 0 rows updated, skip processing)

#### 3. AI Agent Tool Pattern

```typescript
// Each tool in packages/bot-engine/src/tools/
import { tool } from "ai";
import { z } from "zod";

export const collectPhotos = tool({
  description: "Store reference photos uploaded by the client",
  parameters: z.object({
    photoUrls: z.array(z.string().url()),
    orderId: z.string().uuid(),
  }),
  execute: async ({ photoUrls, orderId }) => {
    // 1. Download photos from WhatsApp CDN URLs
    // 2. Upload to Supabase Storage (references bucket, 30-day TTL)
    // 3. Update Order with photo storage paths
    // 4. Return confirmation message for agent to relay
    return { success: true, photoCount: photoUrls.length };
  },
});
```

**Tool inventory:**
| Tool | Trigger | Side Effects |
|------|---------|-------------|
| `collectPhotos` | Client sends image(s) | Upload to Supabase Storage, update Order |
| `selectStyle` | Client taps quick-reply or types theme | Update Order.styleTemplateId, increment StyleTemplate.popularity |
| `confirmOrder` | Client confirms summary | Update Order status to CONFIRMING_ORDER |
| `generatePayment` | Order confirmed | Create Asaas PIX charge, store Payment record, return QR |
| `enqueueGeneration` | Payment confirmed (via payment webhook) | QStash publish to /api/generate with delay |
| `deliverImage` | Generation complete (called by /api/generate) | Send WhatsApp photo + document, update Order |
| `handleRevision` | Client requests change after delivery | Re-enrich prompt, enqueue new generation |

**Agent wiring:**
```typescript
const agent = createToolLoopAgent({
  model: openai("gpt-5-mini"),
  tools: { collectPhotos, selectStyle, confirmOrder, generatePayment, enqueueGeneration, deliverImage, handleRevision },
  system: systemPrompt, // from packages/bot-engine/src/prompts/system-prompt.ts
});
```

#### 4. Queue Pattern (Upstash QStash)

**Publisher (bot-engine or payment webhook):**
```typescript
import { Client as QStashClient } from "@upstash/qstash";

const qstash = new QStashClient({ token: env.QSTASH_TOKEN });

await qstash.publishJSON({
  url: `${env.VERCEL_URL}/api/generate`,
  body: { orderId, action: "generate", attempt: 1 },
  delay: 90, // seconds — artificial production feel
  retries: 3,
});
```

**Consumer (`/api/generate` route):**
1. Verify QStash signature (built-in middleware)
2. Load order from DB — check status is `GENERATING` (idempotency: skip if `DELIVERED` or `COMPLETED`)
3. Load reference photos from Supabase Storage (base64 encode)
4. Build structured prompt via `enrichPrompt()` (GPT-5-mini call)
5. Call GPT Image 1.5 API with base64 photos + enriched prompt
6. Run `qualityCheck()` — AI self-critique comparing output vs input
7. Upload generated image to Supabase Storage (permanent bucket)
8. Create Generation record in DB
9. Send WhatsApp photo + document to client via Chat SDK
10. Update Order status to `DELIVERING` then `AWAITING_FEEDBACK`
11. Return HTTP 200

**Failure:** Return HTTP 500 — QStash auto-retries per configured policy. On final retry failure, a dead-letter callback marks order as `FAILED` and notifies operator.

**Abandoned cart scheduled messages:**
```typescript
// On entering AWAITING_PAYMENT state:
await qstash.publishJSON({
  url: `${env.VERCEL_URL}/api/generate`,
  body: { orderId, action: "nudge_abandoned" },
  delay: 5400, // 1.5 hours in seconds
});

await qstash.publishJSON({
  url: `${env.VERCEL_URL}/api/generate`,
  body: { orderId, action: "close_abandoned" },
  delay: 86400, // 24 hours in seconds
});
```
Consumer checks order status before acting — if already paid, skip nudge/close.

#### 5. Data Access Pattern

- **ALL database reads/writes** go through `packages/db` (Prisma client export)
- No package except `packages/storage` imports `@supabase/supabase-js`
- `packages/storage` exposes typed functions: `uploadReference(orderId, file)`, `uploadGenerated(orderId, file)`, `getSignedUrl(path)`, `deleteReferences(orderId)`
- Other packages call storage functions, never construct Supabase Storage URLs directly
- Zod schemas validate all incoming data at API route boundaries (webhook payloads, QStash bodies) before passing to business logic

#### 6. Environment Variable Pattern

```typescript
// packages/env/src/index.ts
import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().startsWith("sk-"),
  ASAAS_API_KEY: z.string().min(1),
  ASAAS_WEBHOOK_SECRET: z.string().min(1),
  WHATSAPP_WEBHOOK_TOKEN: z.string().min(1),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
  WHATSAPP_ACCESS_TOKEN: z.string().min(1),
  QSTASH_TOKEN: z.string().min(1),
  QSTASH_CURRENT_SIGNING_KEY: z.string().min(1),
  QSTASH_NEXT_SIGNING_KEY: z.string().min(1),
  VERCEL_URL: z.string().min(1),
  OPERATOR_WHATSAPP_NUMBER: z.string().regex(/^\d+$/),
  ASAAS_SPLIT_WALLET_ID: z.string().optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_WHATSAPP_NUMBER: z.string().regex(/^\d+$/),
});

export const env = serverSchema.parse(process.env);
export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
});
```

Fail fast: app crashes on startup if any required env var is missing or malformed.

### Enforcement Guidelines

**All AI Agents MUST:**
- Use `@mascotinhos/db` for ALL database operations — never import Prisma directly in app code
- Use `@mascotinhos/storage` for ALL Supabase Storage operations — never import `@supabase/supabase-js` elsewhere
- Use `@mascotinhos/env` for ALL environment variable access — never read `process.env` directly
- Include `orderId` in every log entry when processing order-related logic
- Validate incoming data with Zod before passing to business functions
- Follow the error handling pattern (try/catch + retry + log + notify) for all external API calls
- Use the exact ConversationState enum values — no ad-hoc status strings

**Anti-Patterns:**
- Direct `process.env.X` access outside `packages/env` — breaks fail-fast validation
- Raw SQL queries — use Prisma client exclusively
- Synchronous work in webhook handlers — always defer via QStash
- Logging full phone numbers or names — redact PII
- Returning non-200 from WhatsApp webhook handler — causes Meta retries and duplicate processing

## Project Structure & Boundaries

### Complete Project Directory Structure

```
mascotinhos/
├── apps/
│   └── web/                          # Next.js app (landing page + API routes)
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx                # Root layout (metadata, fonts)
│       │   │   ├── page.tsx                  # Landing page (portfolio, styles, pricing, CTAs)
│       │   │   ├── privacy/page.tsx          # Privacy policy (LGPD)
│       │   │   ├── terms/page.tsx            # Terms of service
│       │   │   ├── styles/page.tsx           # Style gallery browser
│       │   │   ├── globals.css               # Tailwind base styles
│       │   │   └── api/
│       │   │       ├── whatsapp/
│       │   │       │   └── webhook/route.ts  # Chat SDK WhatsApp webhook handler
│       │   │       ├── payments/
│       │   │       │   └── webhook/route.ts  # Asaas PIX payment webhook
│       │   │       └── generate/
│       │   │           └── route.ts          # QStash consumer: image generation + abandoned cart actions
│       │   └── components/                   # Landing page components
│       │       ├── ui/                       # shadcn/ui primitives (from starter)
│       │       ├── portfolio/                # Before/after gallery components
│       │       ├── styles/                   # Style template browser components
│       │       └── layout/                   # Header, footer, CTA sections
│       ├── public/
│       │   └── images/                       # Static portfolio images, favicons
│       ├── next.config.js
│       ├── tailwind.config.js
│       ├── tsconfig.json
│       └── .env.local                        # Local dev environment
│
├── packages/
│   ├── bot-engine/                   # AI conversation engine
│   │   ├── src/
│   │   │   ├── index.ts              # Package entry point (exports agent + tools)
│   │   │   ├── agent.ts              # AI SDK Agent definition (createToolLoopAgent)
│   │   │   ├── tools/                # Individual tool definitions
│   │   │   │   ├── collect-photos.ts
│   │   │   │   ├── select-style.ts
│   │   │   │   ├── confirm-order.ts
│   │   │   │   ├── generate-payment.ts
│   │   │   │   ├── enqueue-generation.ts
│   │   │   │   ├── deliver-image.ts
│   │   │   │   └── handle-revision.ts
│   │   │   ├── prompts/              # System prompts and personality
│   │   │   │   ├── system-prompt.ts  # Bot personality (warm, emoji-rich PT-BR)
│   │   │   │   └── enrichment.ts     # Client input -> structured generation prompt
│   │   │   └── state-machine.ts      # ConversationState enum + transition validation
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── image-gen/                    # Image generation pipeline
│   │   ├── src/
│   │   │   ├── index.ts              # Package entry point
│   │   │   ├── generate.ts           # GPT Image 1.5 API call (base64 input)
│   │   │   ├── quality-check.ts      # AI self-critique: compare output vs input + prompt
│   │   │   ├── enrich-prompt.ts      # Build structured prompt from order data + style template
│   │   │   └── templates/            # Style template prompt fragments (seed data)
│   │   │       └── seed.ts           # Initial 5-10 template prompts for DB seeding
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── payments/                     # Asaas PIX integration
│   │   ├── src/
│   │   │   ├── index.ts              # Package entry point
│   │   │   ├── client.ts             # Typed Asaas HTTP wrapper (~100 lines)
│   │   │   ├── create-pix.ts         # Generate PIX QR code (dynamic)
│   │   │   ├── verify-webhook.ts     # Asaas webhook signature verification
│   │   │   └── split.ts              # Payment split configuration (partner wallet)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── storage/                      # Supabase Storage wrapper
│   │   ├── src/
│   │   │   ├── index.ts              # Package entry point
│   │   │   ├── client.ts             # Supabase Storage client (sole @supabase/supabase-js import)
│   │   │   ├── upload-reference.ts   # Upload reference photos (references bucket, 30-day TTL metadata)
│   │   │   ├── upload-generated.ts   # Upload generated mascotinhos (generated bucket, permanent)
│   │   │   ├── get-signed-url.ts     # Generate time-limited signed URLs for private files
│   │   │   └── cleanup.ts           # TTL enforcement: delete expired reference photos (cron-triggered)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── db/                           # Database (from starter, extended)
│   │   ├── prisma/
│   │   │   └── schema/
│   │   │       └── schema.prisma     # Full schema: Client, Order, Payment, Generation, StyleTemplate
│   │   ├── src/
│   │   │   └── index.ts              # Prisma client singleton export
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── ui/                           # shadcn/ui components (from starter)
│   ├── env/                          # Environment variable validation (from starter, extended)
│   │   └── src/
│   │       └── index.ts              # Zod server + client env schemas
│   └── config/                       # Shared TypeScript config (from starter)
│       └── tsconfig.base.json
│
├── turbo.json                        # Turborepo task config
├── package.json                      # Root workspace config
├── bts.jsonc                         # Better-T-Stack config
├── .gitignore
├── .env.example                      # Template for all required env vars
└── CLAUDE.md                         # AI agent development instructions
```

### Architectural Boundaries & Dependency Rules

**Package dependency graph (directed, no cycles):**

```
apps/web ──> bot-engine ──> db
         ──> payments   ──> db
         ──> image-gen  ──> db
         ──> storage        storage
         ──> db
         ──> env

bot-engine ──> db
           ──> payments
           ──> image-gen
           ──> storage

image-gen ──> db
          ──> storage

payments ──> db

storage ──> (standalone: @supabase/supabase-js only)

db ──> (standalone: Prisma only)

env ──> (standalone: zod only)
```

**Strict rules:**
- `storage` is the ONLY package that imports `@supabase/supabase-js`
- `db` is the ONLY package that imports `@prisma/client`
- `env` is the ONLY package that reads `process.env`
- No circular dependencies — enforced by Turborepo build graph
- `apps/web` API routes are thin orchestrators: validate input, call package functions, return response

### Requirements to Structure Mapping

| FR Category | Primary Package | API Route | DB Models |
|------------|----------------|-----------|-----------|
| Lead Capture (FR-01..04) | `bot-engine` | `/api/whatsapp/webhook` | Client, Order |
| Conversation (FR-05..09) | `bot-engine` | `/api/whatsapp/webhook` | Order (state) |
| Photo Collection (FR-10..15) | `bot-engine`, `storage` | `/api/whatsapp/webhook` | Order, Supabase Storage |
| Payment (FR-16..20) | `payments` | `/api/payments/webhook` | Payment, Order |
| Generation & Delivery (FR-21..27) | `image-gen`, `storage`, `bot-engine` | `/api/generate` | Generation, Order |
| Revision (FR-28..32) | `bot-engine`, `image-gen` | `/api/whatsapp/webhook`, `/api/generate` | Generation, Order |
| Abandoned Cart (FR-33..36) | `bot-engine` (via QStash) | `/api/generate` | Order |
| Style Templates (FR-37..40) | `bot-engine`, `image-gen` | (DB direct for MVP) | StyleTemplate |
| Landing Page (FR-41..45) | `apps/web` pages | N/A (SSG) | StyleTemplate (read) |
| Compliance (FR-46..48) | `storage` (cleanup), `bot-engine` (consent) | Cron via QStash | Client, Order |
| Operator Tools (FR-49..51) | N/A (Supabase dashboard) | N/A | All models |

### Data Flow

**Happy path end-to-end:**
```
Meta Ad Click
  -> WhatsApp pre-filled message
  -> POST /api/whatsapp/webhook (< 5s response)
    -> bot-engine.agent processes message
    -> tools: collectPhotos -> selectStyle -> confirmOrder -> generatePayment
    -> Each tool: reads/writes via @mascotinhos/db, @mascotinhos/storage, @mascotinhos/payments
    -> Response sent to WhatsApp via Chat SDK
  -> Client pays PIX
  -> Asaas webhook -> POST /api/payments/webhook
    -> Verify signature -> update Payment status -> QStash publish (90s delay)
  -> QStash triggers POST /api/generate
    -> image-gen.enrichPrompt -> image-gen.generate -> image-gen.qualityCheck
    -> storage.uploadGenerated -> bot-engine.deliverImage (WhatsApp photo + document)
    -> Update Order status to AWAITING_FEEDBACK
  -> Client responds (approve or revise)
  -> POST /api/whatsapp/webhook -> bot-engine handles feedback
    -> If revision: handleRevision tool -> QStash publish -> /api/generate (repeat)
    -> If approved: Update Order status to COMPLETED
```

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:**
All technology choices work together without conflicts:
- Next.js App Router + Vercel deployment: native support, zero config
- Prisma + Supabase Postgres: Prisma manages schema, Supabase provides hosting
- AI SDK v6 + Chat SDK: both Vercel products, designed to work together
- QStash + Vercel serverless: QStash calls API routes via HTTP, natural fit
- Supabase Storage + Prisma: Storage for files, Prisma for metadata — clean separation

**Pattern Consistency:**
- Naming conventions align with TypeScript ecosystem defaults (camelCase code, PascalCase types, kebab-case files)
- Error handling pattern is uniform across all external API integrations (retry + log + notify)
- State machine pattern is the single source of truth for conversation flow — no ad-hoc status tracking

**Structure Alignment:**
- Project structure maps 1:1 to architectural components identified in Step 1 (8 components)
- Package boundaries enforce the data access pattern (db, storage, env isolation)
- API routes are thin orchestrators — all business logic lives in packages

### Requirements Coverage Validation

**Functional Requirements Coverage (FR-01 through FR-51):**

All 51 FRs have a clear architectural home:

- FR-01..04 (Lead Capture): WhatsApp webhook -> bot-engine agent -> Client/Order models
- FR-05..09 (Conversation): bot-engine agent with state machine + Supabase persistence
- FR-10..15 (Photo Collection): bot-engine collectPhotos tool + storage package + Order model
- FR-16..20 (Payment): payments package + payment webhook route + Payment model
- FR-21..27 (Generation & Delivery): image-gen package + QStash queue + /api/generate consumer + storage package
- FR-28..32 (Revision): bot-engine handleRevision tool -> re-enqueue via QStash -> image-gen
- FR-33..36 (Abandoned Cart): QStash delayed publish (nudge at 1.5h, close at 24h) -> /api/generate consumer checks order state
- FR-37..40 (Style Templates): StyleTemplate model + bot-engine reads for quick-reply buttons + DB-level management for MVP
- FR-41..45 (Landing Page): apps/web SSG pages + ISR for portfolio + shadcn/ui + wa.me CTAs
- FR-46..48 (Compliance): storage cleanup cron + Client.consentTimestamp + order-level photo isolation
- FR-49..51 (Operator Tools): Supabase dashboard for MVP (no custom admin UI)

**Non-Functional Requirements Coverage (NFR-01 through NFR-28):**

| NFR | Architectural Answer |
|-----|---------------------|
| NFR-01 (webhook <5s) | Webhook handler returns 200 immediately, defers to QStash |
| NFR-02 (generation <2min) | image-gen pipeline: enrichment (<5s) + API call (<60s) + QC (<10s) + upload (<5s) |
| NFR-03 (payment webhook <5s) | Thin handler: verify signature + update DB + QStash publish |
| NFR-04 (LCP <2.5s) | SSG + Next.js Image optimization + Vercel CDN |
| NFR-05 (state load <500ms) | Prisma query with indexed whatsappSenderId |
| NFR-06 (bot response <3s) | Agent processes in-memory, DB read/write <500ms, WhatsApp send <1s |
| NFR-07..08 (webhook signatures) | Dedicated verify functions in payments + whatsapp webhook routes |
| NFR-09 (private storage) | Supabase Storage private buckets + signed URLs |
| NFR-10 (secrets management) | Vercel env vars + packages/env Zod validation |
| NFR-11 (LGPD) | 30-day TTL cleanup cron + consent timestamp + DPA |
| NFR-12 (PII redaction) | Logging pattern redacts phone numbers to last 4 digits |
| NFR-13..14 (scaling) | Supabase free -> Pro upgrade path, architecture unchanged to 1000 orders/mo |
| NFR-15 (queue depth) | QStash dashboard monitoring + operator alert on depth >10 |
| NFR-16 (WhatsApp verification) | Day 1 submission, architectural non-blocker |
| NFR-17 (rate limits) | Exponential backoff in image-gen + QStash retry policy |
| NFR-18 (99% uptime) | Vercel serverless SLA + Supabase Pro SLA |
| NFR-19 (generation retries) | QStash auto-retry 3x + manual operator fallback |
| NFR-20 (idempotent payments) | Check asaasId uniqueness before processing |
| NFR-21 (DB backup) | Supabase Pro automatic daily backups |
| NFR-22 (24h window) | Template messages queued when window expires |
| NFR-23 (Asaas downtime) | Retry logic + QR regeneration offer to client |
| NFR-24 (OpenAI errors) | Exponential backoff + order stays in GENERATING until resolved or failed |
| NFR-25 (connection pooling) | Prisma connection pooling + Supabase PgBouncer on Pro |
| NFR-26 (structured logging) | JSON log format with event + orderId + context |
| NFR-27 (error tracking) | Sentry integration (post-MVP) + operator notifications (MVP) |
| NFR-28 (business metrics) | All data in Postgres, queryable via Supabase dashboard SQL |

### Failure Path Analysis

**OpenAI API down:**
- QStash consumer (`/api/generate`) returns HTTP 500 -> QStash auto-retries (3x, exponential backoff)
- If all retries fail: dead-letter callback marks order as `FAILED`, notifies operator
- Client sees: "Estamos com uma dificuldade tecnica. Nosso time ja foi notificado e vamos entregar sua arte o mais rapido possivel!"
- Operator manually re-triggers generation when API recovers

**Asaas webhook fails:**
- Asaas retries 5x with exponential backoff (built into Asaas)
- If our endpoint is down: payment still confirmed in Asaas dashboard
- Operator can manually trigger generation by updating order status in DB
- Idempotency check prevents duplicate processing when retries arrive

**QStash can't reach /api/generate:**
- QStash retries per configured policy (3x)
- Dead-letter callback notifies operator
- Order remains in `GENERATING` state — visible in Supabase dashboard
- Operator manually re-publishes QStash message or triggers generation directly

**Supabase Storage upload fails:**
- Inline retry 2x within the /api/generate consumer
- If still fails: order marked `FAILED`, operator notified
- Generated image data still in memory during the request — operator can re-trigger from the same generation attempt

### Dependency Risk Analysis

| External Service | Outage Impact | Mitigation | Recovery |
|-----------------|---------------|-----------|----------|
| WhatsApp Business API | Total: No new conversations or responses | None (single channel) | Resume when API recovers; messages queued by Meta |
| OpenAI API | Partial: New generations blocked, conversations still work | QStash retries; Gemini 3.1 Flash as future fallback | Auto-recovery via QStash retry |
| Asaas | Partial: No new payments, existing orders unaffected | Manual PIX key shared as fallback | Webhook retries handle late delivery |
| Supabase Postgres | Total: All operations blocked | Supabase SLA (Pro: 99.9%) | Automatic recovery; daily backups |
| Supabase Storage | Partial: Photo upload/download blocked | Inline retries | Automatic recovery |
| Upstash QStash | Partial: Async generation blocked, conversations still work | Direct /api/generate call as emergency fallback | QStash SLA (99.99%) |
| Vercel | Total: Entire application down | None (single host) | Vercel SLA; auto-recovery |

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context analyzed (51 FRs, 28 NFRs identified)
- [x] Scale and complexity assessed (Medium-High, 8 components)
- [x] Technical constraints identified (webhook 5s, storage TTL, rate limits)
- [x] Cross-cutting concerns mapped (LGPD, error handling, state consistency, observability, extensibility)

**Architectural Decisions**
- [x] All critical decisions documented with rationale
- [x] Technology stack fully specified (versions implicit via AI SDK v6, Prisma, etc.)
- [x] Integration patterns defined (SDK strategy table)
- [x] Data architecture defined (Prisma + QStash + Supabase Storage)
- [x] Security decisions documented (webhook signatures, private buckets, env isolation)

**Implementation Patterns**
- [x] Naming conventions established (database, API, code, packages)
- [x] Error handling pattern defined with code examples
- [x] Conversation state machine fully specified (14 states, transitions, optimistic concurrency)
- [x] AI Agent tool pattern defined (7 tools, Zod schemas, wiring)
- [x] Queue pattern defined (publisher, consumer, delay, retry, idempotency)
- [x] Data access pattern enforced (db/storage/env isolation)
- [x] Environment variable validation pattern with Zod

**Project Structure**
- [x] Complete directory tree with all files and directories
- [x] Package boundaries defined and dependency graph documented
- [x] Requirements mapped to specific packages, routes, and models
- [x] Data flow traced end-to-end (happy path + failure paths)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** HIGH — all decisions validated against PRD requirements, no gaps identified, failure paths documented.

**Key Strengths:**
- Webhook-first architecture naturally handles the 5-second constraint
- QStash provides artificial delay, retry, and scheduled messages in one primitive
- Package isolation (db, storage, env) prevents cross-cutting bugs
- State machine with optimistic concurrency prevents race conditions
- Every FR has a clear architectural home; every NFR has a documented answer

**Areas for Future Enhancement:**
- Admin dashboard (Supabase Auth + custom UI) — post-MVP
- Structured observability (Sentry + custom dashboards) — post-MVP
- CDN strategy for landing page portfolio images — post-MVP
- Gemini fallback for image generation — if OpenAI pricing increases
- CI/CD pipeline (linting, type checking, tests) — currently Vercel auto-deploy only

---

_Architecture document completed on 2026-03-27. This document serves as the single source of truth for all technical decisions, ensuring consistent implementation across the entire Mascotinhos project._

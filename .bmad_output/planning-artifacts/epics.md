---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - prd.md
  - architecture.md
status: complete
---

# Mascotinhos - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Mascotinhos, an automated WhatsApp-based platform that transforms a conversation and PIX payment into personalized AI-generated illustrations of children. It decomposes the 51 functional requirements and 28 non-functional requirements from the PRD and Architecture documents into 8 implementable epics with detailed user stories, acceptance criteria, and FR traceability.

The epic sequence follows the architecture's implementation order: data layer first, then WhatsApp conversation engine, payment integration, image generation pipeline, revision and completion flows, landing page, resilience tooling, and finally LGPD compliance.

## Requirements Inventory

### Functional Requirements

- FR-01: A prospective client clicking a Meta click-to-WhatsApp ad arrives in a WhatsApp conversation with a pre-filled message containing their selected style theme.
- FR-02: The bot responds within 3 seconds of receiving the first message with a warm greeting, a before/after portfolio carousel, the R$29.90 price, and social proof.
- FR-03: The bot presents available style templates as quick-reply buttons (up to 3 per message, top styles by popularity), plus an "Outro tema" free-text fallback option.
- FR-04: The bot captures inline LGPD consent when the client sends a photo.
- FR-05: The AI agent maintains a warm, emoji-rich, casual Brazilian Portuguese personality throughout all interactions.
- FR-06: The bot persists conversation state in Supabase Postgres indexed by WhatsApp sender ID, enabling seamless resume after interruptions.
- FR-07: The bot handles out-of-scope messages gracefully by answering the question and returning to the current conversation state.
- FR-08: The bot sends typing indicators before each response to simulate human interaction timing.
- FR-09: The bot loads full conversation history from the database on each webhook event to maintain context across the multi-turn flow.
- FR-10: The bot collects 1-3 reference photos of the child via WhatsApp image messages and stores them in Supabase Storage with 30-day TTL metadata.
- FR-11: The bot accepts a theme selection via quick-reply button tap or free-text input.
- FR-12: The bot collects optional outfit/clothing description (text or reference image) for inclusion in the generation prompt.
- FR-13: The bot collects optional extra requests as free-text input.
- FR-14: The bot presents an order summary for confirmation before payment.
- FR-15: The bot provides photo quality guidance when a received photo is too blurry or too small.
- FR-16: Upon order confirmation, the bot generates a dynamic PIX QR code via Asaas API and sends it inline in the WhatsApp conversation.
- FR-17: The system receives Asaas payment webhook confirmations within 5 seconds and triggers the image generation pipeline.
- FR-18: The bot confirms payment receipt to the client.
- FR-19: The system supports Asaas partner payment split, configured at payment creation time.
- FR-20: The system handles failed/expired PIX payments gracefully, offering to regenerate the QR code.
- FR-21: The bot enriches client inputs into a structured prompt using the selected StyleTemplate's prompt_template and GPT-5-mini.
- FR-22: The system generates the mascotinho image via OpenAI GPT Image 1.5 High (1024x1024) using base64-encoded reference photo input, executed asynchronously in a background queue.
- FR-23: The system runs an AI quality self-check on the generated image before delivery.
- FR-24: The bot holds the completed image for a 1-2 minute artificial delay with typing indicators and warm status messages.
- FR-25: The bot delivers the mascotinho as a WhatsApp photo (instant viewing) followed by the same image as a WhatsApp document (full-resolution download). No PDF.
- FR-26: The system stores the generated image permanently in Supabase Storage and records the generation attempt in the Generation table.
- FR-27: The system auto-retries failed generations up to 2 times with exponential backoff before marking the order as failed.
- FR-28: After delivery, the bot asks for feedback with reply buttons: "Amei!" / "Quero ajustar".
- FR-29: The bot accepts natural language revision feedback and re-enriches the prompt with the concrete adjustment.
- FR-30: The bot supports up to 2 revision rounds per order.
- FR-31: Each revision goes through the same async generation pipeline.
- FR-32: The system tracks revision count per order and stores revision feedback in the Generation table.
- FR-33: If a client goes silent for 1.5 hours during any pre-payment state, the bot sends a gentle nudge.
- FR-34: If a client does not respond within 24 hours of the nudge, the bot sends a graceful closure.
- FR-35: The system marks abandoned conversations with the appropriate status and timestamps for analytics.
- FR-36: A returning client who was previously abandoned can restart the flow from where they left off.
- FR-37: The system supports a StyleTemplate entity with: name, slug, prompt_template, example_images[], popularity counter, tags[], active flag, and product_type field.
- FR-38: Style template popularity auto-increments when a client selects that template for an order.
- FR-39: Quick-reply buttons display the top styles sorted by popularity (descending).
- FR-40: The operator can create, update, activate/deactivate, and test style templates via direct database operations.
- FR-41: The landing page displays a before/after portfolio gallery showing original child photos alongside their mascotinho illustrations.
- FR-42: The landing page provides a style template browser where visitors can preview available themes with example images.
- FR-43: Each style on the landing page has a CTA button that opens WhatsApp with a pre-filled message specific to that style.
- FR-44: The landing page includes a privacy policy page and terms of service page accessible from the footer and linked in bot conversations.
- FR-45: The landing page renders correctly on mobile devices (responsive, mobile-first) with Core Web Vitals passing.
- FR-46: The system auto-deletes reference photos from Supabase Storage 30 days after order completion via scheduled cleanup job.
- FR-47: The system logs consent timestamps per client in the Client table.
- FR-48: The system does not share, reuse, or cross-reference client photos between different orders or clients.
- FR-49: The operator can query order status, revenue, and conversion metrics via Supabase dashboard SQL queries.
- FR-50: The operator can manually intervene on stuck/failed orders by sending direct WhatsApp messages to clients outside the bot flow.
- FR-51: The operator can seed, edit, and test style templates directly in the database, with changes reflected in the bot's quick-reply buttons on the next conversation.

### Non-Functional Requirements

- NFR-01: WhatsApp webhook endpoint responds with 200 OK in <5 seconds for 100% of requests. All business logic deferred to async queue.
- NFR-02: Image generation completes in <2 minutes end-to-end (prompt enrichment + API call + quality check + storage upload), excluding artificial delay.
- NFR-03: Payment webhook processes and triggers generation pipeline in <5 seconds after receipt.
- NFR-04: Landing page achieves Core Web Vitals green: LCP <2.5s, FID <100ms, CLS <0.1 on mobile (3G throttled).
- NFR-05: Conversation state load from Supabase completes in <500ms per webhook event.
- NFR-06: Bot response latency (from webhook receipt to WhatsApp message sent, excluding artificial delay) <3 seconds for text responses.
- NFR-07: WhatsApp webhook endpoint verifies Chat SDK webhook signature on every request; rejects unsigned/invalid requests with 401.
- NFR-08: Asaas payment webhook endpoint verifies Asaas webhook signature; rejects unsigned requests.
- NFR-09: Reference photos stored in Supabase Storage with private bucket policy — no public URL access.
- NFR-10: Database credentials, API keys, and webhook secrets stored as Vercel environment variables; never committed to source code.
- NFR-11: LGPD data handling: reference photos auto-deleted after 30 days, consent timestamps recorded, privacy policy accessible, DPA with OpenAI in place.
- NFR-12: No PII logged in application logs — phone numbers and names redacted in error reporting.
- NFR-13: System supports 100 orders/month on Supabase free tier.
- NFR-14: System supports 1,000 orders/month on Supabase Pro without architectural changes.
- NFR-15: Async queue supports concurrent image generation without blocking webhook responses.
- NFR-16: WhatsApp Business verification completed before launch to support >250 conversations/day.
- NFR-17: GPT Image API rate limits monitored; exponential backoff + user queue implemented.
- NFR-18: Bot uptime >99% measured monthly.
- NFR-19: Failed image generations auto-retry up to 2 times with exponential backoff before marking order as failed.
- NFR-20: Asaas webhook retries handled idempotently — no duplicate orders or payments on retry.
- NFR-21: Database backup: Supabase automatic daily backups (Pro tier).
- NFR-22: WhatsApp Business API: system handles 24-hour window expiration gracefully.
- NFR-23: Asaas API: system handles API downtime with retry logic.
- NFR-24: OpenAI API: system handles rate limits and transient errors with exponential backoff.
- NFR-25: Supabase: connection pooling configured to handle concurrent webhook events.
- NFR-26: Structured logging for all webhook events, payment confirmations, generation attempts, and delivery confirmations.
- NFR-27: Error tracking for failed generations, webhook errors, and payment failures with context.
- NFR-28: Key business metrics queryable from database: orders/day, conversion rate, revision rate, average generation time, revenue.

### Additional Requirements (from Architecture)

- **Monorepo setup:** Better-T-Stack already scaffolded with Turborepo, Next.js App Router, Prisma, Supabase, bun package manager
- **Upstash QStash integration:** 30K free/month, HTTP-based async queue for image generation with artificial delay parameter, abandoned cart scheduled messages
- **Supabase Storage buckets:** `references` bucket with 30-day TTL auto-delete (private, signed URLs only) + `generated` bucket for permanent generated images
- **Environment variable validation:** Zod schemas in `packages/env` for fail-fast startup validation of all required keys (OpenAI, Asaas, WhatsApp, QStash, Supabase)
- **Operator notification on failures:** WhatsApp/Telegram alert to operator number on persistent generation failures, payment webhook verification failures, and QStash consumer errors
- **Package architecture:** `@mascotinhos/bot-engine`, `@mascotinhos/image-gen`, `@mascotinhos/payments`, `@mascotinhos/storage`, `@mascotinhos/db`, `@mascotinhos/env` with strict dependency boundaries (no cycles, isolated concerns)
- **Chat SDK + @chat-adapter/whatsapp:** Official WhatsApp Business API adapter for webhook handling and message sending
- **AI SDK v6 ToolLoopAgent:** GPT-5-mini for conversation orchestration with tool calling pattern

### FR Coverage Map

- FR-01: Epic 1 — Greeting flow via WhatsApp (pre-filled message handling)
- FR-02: Epic 2 — Bot greeting response with portfolio, price, and social proof
- FR-03: Epic 2 — Style selection with quick-reply buttons sorted by popularity
- FR-04: Epic 8 — LGPD consent capture during photo collection
- FR-05: Epic 2 — AI agent personality definition (warm PT-BR)
- FR-06: Epic 2 — Conversation state persistence in database
- FR-07: Epic 2 — Out-of-scope message handling
- FR-08: Epic 2 — Typing indicators before responses
- FR-09: Epic 2 — Conversation history loading per webhook event
- FR-10: Epic 2 — Photo collection and upload to Supabase Storage
- FR-11: Epic 2 — Theme selection via buttons or free-text
- FR-12: Epic 2 — Outfit/clothing description collection
- FR-13: Epic 2 — Extra requests collection
- FR-14: Epic 2 — Order summary confirmation
- FR-15: Epic 2 — Photo quality guidance
- FR-16: Epic 3 — PIX QR code generation via Asaas
- FR-17: Epic 3 — Payment webhook handler triggering generation
- FR-18: Epic 3 — Payment confirmation message to client
- FR-19: Epic 3 — Partner payment split configuration
- FR-20: Epic 3 — Failed/expired payment handling with QR regeneration
- FR-21: Epic 4 — Prompt enrichment from client inputs + style template
- FR-22: Epic 4 — GPT Image 1.5 async generation via QStash
- FR-23: Epic 4 — AI quality self-critique check
- FR-24: Epic 4 — Artificial delay with typing indicators
- FR-25: Epic 4 — Dual delivery (WhatsApp photo + document)
- FR-26: Epic 4 — Generated image storage and Generation record creation
- FR-27: Epic 4 — Auto-retry failed generations (2x exponential backoff)
- FR-28: Epic 5 — Feedback collection after delivery
- FR-29: Epic 5 — Natural language revision with prompt re-enrichment
- FR-30: Epic 5 — Max 2 revision rounds enforcement
- FR-31: Epic 5 — Revision async generation pipeline
- FR-32: Epic 5 — Revision count tracking and feedback storage
- FR-33: Epic 5 — 1.5h abandoned cart nudge
- FR-34: Epic 5 — 24h graceful closure
- FR-35: Epic 5 — Abandoned conversation status marking
- FR-36: Epic 5 — Returning abandoned client state resumption
- FR-37: Epic 1 — StyleTemplate entity definition in Prisma schema
- FR-38: Epic 2 — Style popularity auto-increment on selection
- FR-39: Epic 2 — Quick-reply buttons sorted by popularity
- FR-40: Epic 7 — Operator style template CRUD via database
- FR-41: Epic 6 — Landing page portfolio gallery
- FR-42: Epic 6 — Landing page style template browser
- FR-43: Epic 6 — Per-style CTA buttons to WhatsApp
- FR-44: Epic 6 — Privacy policy and terms of service pages
- FR-45: Epic 6 — Mobile-first responsive with Core Web Vitals
- FR-46: Epic 8 — Reference photo 30-day TTL auto-delete
- FR-47: Epic 8 — Consent timestamp logging
- FR-48: Epic 8 — Photo isolation per order (no cross-reference)
- FR-49: Epic 7 — Order monitoring queries via Supabase dashboard
- FR-50: Epic 7 — Manual intervention on stuck/failed orders
- FR-51: Epic 7 — Style template seeding and editing in database

## Epic List

| Epic | Title | Goal | FRs Covered |
|------|-------|------|-------------|
| 1 | Project Foundation & Data Layer | Establish the database schema, storage buckets, environment validation, and payment client so all subsequent epics have a solid data foundation | FR-01, FR-37 |
| 2 | WhatsApp Bot Conversation Engine | Enable a complete conversational flow from greeting through order confirmation, so mothers can interact naturally with the bot and provide all inputs needed for their mascotinho | FR-02, FR-03, FR-05, FR-06, FR-07, FR-08, FR-09, FR-10, FR-11, FR-12, FR-13, FR-14, FR-15, FR-38, FR-39 |
| 3 | Payment Integration | Allow clients to pay via PIX within the WhatsApp conversation and automatically trigger the generation pipeline upon payment confirmation | FR-16, FR-17, FR-18, FR-19, FR-20 |
| 4 | Image Generation Pipeline | Generate high-quality mascotinho images from client inputs, verify quality, and deliver them via WhatsApp with the perceived production value of artificial delays | FR-21, FR-22, FR-23, FR-24, FR-25, FR-26, FR-27 |
| 5 | Revision, Completion & Abandoned Cart | Handle post-delivery feedback, revision rounds, order completion, and abandoned cart recovery to maximize conversion and satisfaction | FR-28, FR-29, FR-30, FR-31, FR-32, FR-33, FR-34, FR-35, FR-36 |
| 6 | Landing Page | Provide a mobile-first marketing landing page with portfolio, style gallery, pricing, and legal pages that drive WhatsApp conversions from Meta ads | FR-41, FR-42, FR-43, FR-44, FR-45 |
| 7 | Resilience & Operator Tools | Give the operator visibility into orders, enable manual intervention, and seed the initial style template library | FR-40, FR-49, FR-50, FR-51 |
| 8 | LGPD Compliance & Security | Ensure legal compliance with LGPD/ECA Digital through consent capture, automatic data cleanup, webhook security, and photo isolation | FR-04, FR-46, FR-47, FR-48 |

---

## Epic 1: Project Foundation & Data Layer

**Goal:** Establish the complete Prisma database schema, Supabase Storage buckets, environment variable validation, and the typed Asaas HTTP wrapper so that every subsequent epic has a reliable, validated data foundation to build upon. This epic delivers the operational backbone that the operator needs to track orders from day one.

### Story 1.1: Prisma Schema for Core Business Entities — [mgiovani/fotos#41](https://github.com/mgiovani/fotos/issues/41)

As the operator,
I want the database to have all the models needed to track clients, orders, payments, generations, and style templates,
So that every business event is recorded and queryable from the start.

**Acceptance Criteria:**

**Given** the Better-T-Stack monorepo is already scaffolded with Prisma in `packages/db`
**When** the developer runs `bun run db:push`
**Then** Supabase Postgres contains the following tables: Client (with whatsappSenderId unique index), Order (with status enum and client FK), Payment (with asaasId unique index and order FK), Generation (with order FK and attempt_number), and StyleTemplate (with slug unique index and popularity counter)
**And** all enum values match the ConversationState enum defined in the architecture (GREETING through FAILED)
**And** all relations have appropriate foreign keys and cascading rules
**And** timestamp fields (createdAt, updatedAt) use Prisma's `@default(now())` and `@updatedAt`

**FRs covered:** FR-37 (StyleTemplate entity)
**Technical notes:** Follow architecture naming: PascalCase models, camelCase fields, UPPER_SNAKE_CASE enum values. Order.status enum must include all states from the ConversationState definition. StyleTemplate.productType enum starts with `MASCOTINHO` value only (extensible later). Use Prisma's `@map` for snake_case table names if desired, but keep TypeScript interface in camelCase.

---

### Story 1.2: Supabase Storage Bucket Configuration — [mgiovani/fotos#42](https://github.com/mgiovani/fotos/issues/42)

As the operator,
I want reference photos stored in a private TTL-enabled bucket and generated images in a separate permanent bucket,
So that client photos are automatically cleaned up for LGPD compliance while generated art is preserved indefinitely.

**Acceptance Criteria:**

**Given** a Supabase project is connected to the monorepo
**When** the storage package (`packages/storage`) is implemented
**Then** two buckets exist: `references` (private, no public access) and `generated` (private, no public access)
**And** the storage package exports typed functions: `uploadReference(orderId, file)`, `uploadGenerated(orderId, file)`, `getSignedUrl(path)`, `deleteReferences(orderId)`
**And** reference uploads include metadata with `expiresAt` timestamp set to 30 days from upload
**And** generated image uploads use the path pattern `generated/{orderId}/{attemptNumber}.png`
**And** `getSignedUrl` generates time-limited URLs (1 hour expiry) for private file access
**And** only `packages/storage` imports `@supabase/supabase-js` (enforced by package boundary)

**FRs covered:** FR-10 (partial: storage side), FR-26 (partial: storage side), FR-48 (photo isolation via orderId-scoped paths)
**Technical notes:** Use Supabase Storage JS client. Reference paths: `references/{orderId}/{filename}`. The `@supabase/supabase-js` import is isolated to this package per architecture boundary rules.

---

### Story 1.3: Environment Variable Validation — [mgiovani/fotos#43](https://github.com/mgiovani/fotos/issues/43)

As a developer,
I want all required environment variables validated at startup with Zod schemas,
So that the application fails fast with clear error messages instead of crashing at runtime with cryptic errors.

**Acceptance Criteria:**

**Given** the `packages/env` package exists from the starter template
**When** the Zod validation schemas are extended with all project-required variables
**Then** the server schema validates: DATABASE_URL, DIRECT_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, ASAAS_API_KEY, ASAAS_WEBHOOK_SECRET, WHATSAPP_WEBHOOK_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY, VERCEL_URL, OPERATOR_WHATSAPP_NUMBER, and optional ASAAS_SPLIT_WALLET_ID
**And** the client schema validates: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_WHATSAPP_NUMBER
**And** if any required variable is missing or malformed, the app crashes on import with a descriptive Zod error
**And** a `.env.example` file documents all required variables with placeholder values
**And** only `packages/env` reads `process.env` (enforced by package boundary)

**FRs covered:** (infrastructure prerequisite, supports NFR-10)
**Technical notes:** Follow architecture pattern exactly. `OPENAI_API_KEY` validated with `.startsWith("sk-")`. Phone numbers validated with regex `/^\d+$/`.

---

### Story 1.4: Typed Asaas HTTP Wrapper — [mgiovani/fotos#44](https://github.com/mgiovani/fotos/issues/44)

As a developer,
I want a thin, typed HTTP wrapper for the Asaas API,
So that payment-related code has type safety and consistent error handling without the overhead of a full SDK.

**Acceptance Criteria:**

**Given** the `packages/payments` package is created in the monorepo
**When** the Asaas client is implemented
**Then** it exports typed functions for: creating a PIX charge (returns QR code + payment ID), checking payment status, configuring payment split (partner wallet ID), and verifying webhook signatures
**And** all Asaas API calls use the base URL from environment (sandbox vs production toggle)
**And** HTTP errors are caught and wrapped in the AppError structure with `retryable` flag
**And** the webhook signature verification function rejects invalid signatures and returns parsed payload on success
**And** TypeScript types cover all Asaas request/response shapes used by the project

**FRs covered:** FR-16 (partial: PIX generation capability), FR-19 (partial: split configuration capability)
**Technical notes:** Architecture specifies ~100 lines covering 5-6 endpoints. Use native `fetch`. Import env from `@mascotinhos/env`. Asaas sandbox URL: `https://sandbox.asaas.com/api/v3`, production: `https://api.asaas.com/api/v3`.

---

## Epic 2: WhatsApp Bot Conversation Engine

**Goal:** Enable a complete conversational flow from the moment a mother clicks a Meta ad through providing all the inputs needed for her mascotinho order (photos, theme, outfit, extras, confirmation). The conversation should feel warm, human, and effortless, creating the core experience that differentiates Mascotinhos from all competitors.

### Story 2.1: Chat SDK WhatsApp Adapter & Webhook Endpoint — [mgiovani/fotos#45](https://github.com/mgiovani/fotos/issues/45)

As the system,
I want to receive WhatsApp messages via the official Business API and respond through the Chat SDK,
So that the bot has a reliable, policy-compliant communication channel with clients.

**Acceptance Criteria:**

**Given** the Chat SDK and @chat-adapter/whatsapp packages are installed
**When** a WhatsApp message arrives at `POST /api/whatsapp/webhook`
**Then** the endpoint responds with `{ status: "ok" }` and HTTP 200 within 5 seconds
**And** the webhook handler verifies the Chat SDK signature on every request (rejects unsigned with 401)
**And** all business logic is deferred (no inline processing blocks the response)
**And** incoming message data (sender ID, text, media URLs) is extracted and passed to the bot engine
**And** the endpoint handles duplicate webhook deliveries idempotently

**FRs covered:** FR-01 (WhatsApp conversation entry point)
**Technical notes:** Thin orchestrator pattern per architecture: validate input, extract data, call bot-engine, return 200. Never let exceptions propagate to HTTP response. NFR-01 (webhook <5s), NFR-07 (signature verification).

---

### Story 2.2: Conversation State Machine & Persistence — [mgiovani/fotos#46](https://github.com/mgiovani/fotos/issues/46)

As the system,
I want to load, track, and update conversation state per client atomically,
So that the bot can resume conversations after interruptions and prevent race conditions from rapid duplicate webhooks.

**Acceptance Criteria:**

**Given** a WhatsApp message arrives with a sender ID
**When** the bot engine processes the message
**Then** it loads the active order for that sender (status NOT IN COMPLETED, FAILED, ABANDONED_24H) ordered by createdAt DESC
**And** if no active order exists, it creates a new Client record (if needed) and a new Order in GREETING state
**And** after processing, the order status is updated atomically with an optimistic concurrency check (`WHERE id = $1 AND status = $2`)
**And** if 0 rows are updated (race condition), the duplicate message is skipped
**And** the ConversationState enum contains exactly: GREETING, COLLECTING_PHOTOS, COLLECTING_THEME, COLLECTING_OUTFIT, CONFIRMING_ORDER, AWAITING_PAYMENT, ABANDONED_1H, ABANDONED_24H, GENERATING, DELIVERING, AWAITING_FEEDBACK, REVISION_1, REVISION_2, COMPLETED, FAILED
**And** state transitions are validated (only allowed transitions proceed)

**FRs covered:** FR-06 (state persistence by sender ID), FR-09 (history loading per webhook)
**Technical notes:** State machine defined in `packages/bot-engine/src/state-machine.ts`. Use Prisma for all DB ops via `@mascotinhos/db`. NFR-05 (state load <500ms).

---

### Story 2.3: AI Agent Definition with System Prompt — [mgiovani/fotos#47](https://github.com/mgiovani/fotos/issues/47)

As a prospective client,
I want the bot to feel like a warm, caring human attendant who speaks casual Brazilian Portuguese with emojis,
So that I feel attended to and trust the service enough to share my child's photo and pay.

**Acceptance Criteria:**

**Given** the AI SDK v6 ToolLoopAgent is configured in `packages/bot-engine/src/agent.ts`
**When** the agent processes any message
**Then** it uses GPT-5-mini as the conversation model
**And** the system prompt defines a warm, emoji-rich, casual PT-BR personality
**And** the agent has access to all defined tools (collectPhotos, selectStyle, confirmOrder, generatePayment, enqueueGeneration, deliverImage, handleRevision)
**And** the agent sends typing indicators before each response
**And** the agent handles out-of-scope questions by answering them and returning to the current conversation state
**And** the full conversation history is loaded from the database and passed as context on each invocation

**FRs covered:** FR-05 (warm PT-BR personality), FR-07 (out-of-scope handling), FR-08 (typing indicators), FR-09 (conversation history loading)
**Technical notes:** System prompt in `packages/bot-engine/src/prompts/system-prompt.ts`. Agent wired with `createToolLoopAgent`. Typing indicators sent via Chat SDK before each response message.

---

### Story 2.4: Greeting Flow with Portfolio and Social Proof — [mgiovani/fotos#48](https://github.com/mgiovani/fotos/issues/48)

As a prospective client arriving from a Meta ad,
I want to immediately see beautiful examples of mascotinhos, the price, and social proof,
So that I can quickly decide whether to proceed with my order.

**Acceptance Criteria:**

**Given** a new client sends their first message (pre-filled from Meta ad or organic)
**When** the bot processes the GREETING state
**Then** the bot responds within 3 seconds with: a warm greeting using the client's name (if available), a carousel/series of before/after portfolio images, the price "R$29,90", and social proof text
**And** the bot presents available style templates as quick-reply buttons (top 3 by popularity) plus an "Outro tema" free-text option
**And** if the pre-filled message contains a style name, the bot acknowledges that preference
**And** the order transitions to COLLECTING_PHOTOS or COLLECTING_THEME depending on client input

**FRs covered:** FR-02 (greeting with portfolio, price, social proof), FR-03 (quick-reply buttons by popularity), FR-39 (popularity sorting)
**Technical notes:** Quick-reply buttons limited to 3 per WhatsApp message. StyleTemplate query: `WHERE active = true ORDER BY popularity DESC LIMIT 3`. NFR-06 (response <3s).

---

### Story 2.5: Photo Collection with Storage Upload — [mgiovani/fotos#49](https://github.com/mgiovani/fotos/issues/49)

As a client,
I want to send photos of my child and have the bot acknowledge receipt with helpful guidance,
So that I know my photos were received and can provide better ones if needed.

**Acceptance Criteria:**

**Given** the conversation is in COLLECTING_PHOTOS state
**When** the client sends 1-3 image messages via WhatsApp
**Then** the `collectPhotos` tool downloads the images from WhatsApp CDN URLs
**And** uploads them to Supabase Storage `references` bucket under `references/{orderId}/{filename}` with 30-day TTL metadata
**And** updates the Order record with storage paths in photos_urls array
**And** the bot confirms receipt with a warm message ("Linda foto! Recebi X foto(s) da [name]")
**And** if a photo is too blurry or too small, the bot provides quality guidance: "A foto ficou um pouco escura/embaçada. Consegue enviar uma com mais luz/nitidez?"
**And** after photo collection, the LGPD consent message is displayed (delegated to Epic 8 for full implementation, placeholder here)
**And** the order transitions to COLLECTING_THEME

**FRs covered:** FR-10 (photo collection + storage with TTL), FR-15 (photo quality guidance)
**Technical notes:** Use `@mascotinhos/storage` for uploads (never import supabase-js directly). Download from WhatsApp CDN via Chat SDK media API. Photo quality check can be basic (file size threshold) for MVP.

---

### Story 2.6: Style Selection with Popularity Tracking — [mgiovani/fotos#50](https://github.com/mgiovani/fotos/issues/50)

As a client,
I want to choose a style theme for my mascotinho from visual options or describe my own,
So that the illustration matches my child's birthday party theme.

**Acceptance Criteria:**

**Given** the conversation is in COLLECTING_THEME state
**When** the client taps a quick-reply button or types a theme name
**Then** the `selectStyle` tool matches the input to a StyleTemplate record (exact match for buttons, fuzzy match for free-text)
**And** if "Outro tema" is selected, the bot asks for a free-text description and creates a custom style context
**And** the selected StyleTemplate's popularity counter is incremented atomically
**And** the Order record is updated with the styleTemplateId
**And** the bot confirms the selection: "Tema [name] escolhido!"
**And** the order transitions to COLLECTING_OUTFIT

**FRs covered:** FR-11 (theme selection via button or text), FR-38 (popularity auto-increment), FR-39 (buttons sorted by popularity — building block)
**Technical notes:** Popularity increment: `UPDATE "StyleTemplate" SET popularity = popularity + 1 WHERE id = $1`. For free-text "Outro", store the custom description in Order.theme field.

---

### Story 2.7: Outfit and Extra Requests Collection — [mgiovani/fotos#51](https://github.com/mgiovani/fotos/issues/51)

As a client,
I want to describe the outfit my child will wear and any special additions,
So that the mascotinho illustration includes these personalized details.

**Acceptance Criteria:**

**Given** the conversation is in COLLECTING_OUTFIT state
**When** the client sends text describing the outfit or a reference image of the outfit
**Then** the bot stores the outfit description in Order.outfitDescription
**And** if a reference image is sent, it is uploaded to the `references` bucket alongside the child's photos
**And** the bot asks for any extra requests ("Quer adicionar algo especial? Balao, cachorrinho, brinquedo...")
**And** extra requests are stored in Order.extraRequests
**And** the client can skip extras by responding "nao" or similar
**And** the order transitions to CONFIRMING_ORDER

**FRs covered:** FR-12 (outfit description collection), FR-13 (extra requests collection)
**Technical notes:** Outfit description and extras are free-text fields. The AI agent should parse natural language into structured fields. Allow the client to skip outfit description too (nullable field).

---

### Story 2.8: Order Summary and Confirmation — [mgiovani/fotos#52](https://github.com/mgiovani/fotos/issues/52)

As a client,
I want to see a summary of my order before paying,
So that I can verify all details are correct and feel confident proceeding.

**Acceptance Criteria:**

**Given** the conversation is in CONFIRMING_ORDER state
**When** the `confirmOrder` tool is called
**Then** the bot presents a formatted order summary: child's name (if provided), selected theme, outfit description, extra requests, number of photos received, and price (R$29,90)
**And** the bot asks for confirmation with reply buttons: "Confirmar" / "Quero alterar"
**And** if the client confirms, the order transitions to AWAITING_PAYMENT
**And** if the client wants to alter, the bot asks what to change and returns to the appropriate collection state
**And** the Order record is updated with any changes

**FRs covered:** FR-14 (order summary for confirmation)
**Technical notes:** Summary message should be visually formatted with emojis for readability. The "alter" path should be flexible — the AI agent determines which state to return to based on what the client wants to change.

---

## Epic 3: Payment Integration

**Goal:** Enable clients to pay for their mascotinho via PIX directly in the WhatsApp conversation, with automatic payment confirmation triggering the image generation pipeline. Payment processing must be reliable, idempotent, and support the operator's partner revenue split.

### Story 3.1: PIX QR Code Generation and Delivery — [mgiovani/fotos#53](https://github.com/mgiovani/fotos/issues/53)

As a client who confirmed her order,
I want to receive a PIX QR code instantly in the WhatsApp conversation,
So that I can pay quickly without leaving the chat.

**Acceptance Criteria:**

**Given** the order is in AWAITING_PAYMENT state and the client confirmed
**When** the `generatePayment` tool is called
**Then** a dynamic PIX charge is created via the Asaas API with amount R$29.90 and the order ID as external reference
**And** the PIX QR code image and copy-paste code are sent to the client via WhatsApp
**And** a Payment record is created in the database with status `PENDING`, the asaasId, QR code data, and amount
**And** the bot sends a warm message: "Aqui esta o PIX! Assim que o pagamento cair, ja comeco a preparar sua arte"
**And** if Asaas API fails, the bot offers to retry: "Ops, tive um probleminha. Vou gerar outro QR code!"

**FRs covered:** FR-16 (PIX QR generation via Asaas), FR-20 (partial: retry on generation failure)
**Technical notes:** Use `@mascotinhos/payments` package. Payment record uses asaasId as unique constraint for idempotency. NFR-23 (Asaas retry logic).

---

### Story 3.2: Payment Webhook Handler with Signature Verification — [mgiovani/fotos#54](https://github.com/mgiovani/fotos/issues/54)

As the system,
I want to receive and verify Asaas payment webhooks securely and idempotently,
So that payments are confirmed exactly once and the generation pipeline is triggered reliably.

**Acceptance Criteria:**

**Given** Asaas sends a payment confirmation webhook to `POST /api/payments/webhook`
**When** the webhook is received
**Then** the endpoint verifies the Asaas webhook signature (rejects unsigned with 401)
**And** the endpoint returns `{ received: true }` with HTTP 200 within 5 seconds
**And** the Payment record is looked up by asaasId — if already `CONFIRMED`, the webhook is skipped (idempotent)
**And** the Payment status is updated to `CONFIRMED` with confirmed_at timestamp
**And** the associated Order status is updated to `GENERATING`
**And** image generation is triggered (enqueue via QStash, detailed in Epic 4)
**And** failed/expired payment webhooks update the Payment status accordingly

**FRs covered:** FR-17 (payment webhook within 5s triggering generation), FR-20 (failed payment status handling)
**Technical notes:** NFR-03 (payment webhook <5s), NFR-08 (Asaas signature verification), NFR-20 (idempotent handling). Use `@mascotinhos/payments/verify-webhook` for signature check.

---

### Story 3.3: Payment Confirmation Message to Client — [mgiovani/fotos#55](https://github.com/mgiovani/fotos/issues/55)

As a client who just paid,
I want to receive immediate confirmation that my payment was received,
So that I know the process is moving forward and feel reassured.

**Acceptance Criteria:**

**Given** the payment webhook confirms a successful PIX payment
**When** the Order status transitions to GENERATING
**Then** the bot sends a confirmation message to the client via WhatsApp: "Pagamento confirmado! Vou comecar a preparar sua arte agora"
**And** the message includes a typing indicator before sending
**And** a warm follow-up status message is sent: "Estou preparando a arte da [child name] com carinho..."

**FRs covered:** FR-18 (payment confirmation message)
**Technical notes:** This message is sent from the payment webhook handler context. Use Chat SDK to send messages. The follow-up "preparing" message bridges the gap before the artificial delay + generation.

---

### Story 3.4: Payment Split Configuration — [mgiovani/fotos#56](https://github.com/mgiovani/fotos/issues/56)

As the operator,
I want PIX payments to automatically split revenue with the business partner,
So that partner payouts are handled automatically without manual transfers.

**Acceptance Criteria:**

**Given** the ASAAS_SPLIT_WALLET_ID environment variable is configured (optional)
**When** a PIX charge is created via the Asaas API
**Then** if the split wallet ID is present, the charge includes split configuration directing the configured percentage to the partner wallet
**And** if the split wallet ID is not configured, the charge is created without split (100% to primary account)
**And** the split configuration is logged in the Payment record for auditing

**FRs covered:** FR-19 (partner payment split)
**Technical notes:** Asaas split API: include `split` array in charge creation payload. Split wallet ID from `@mascotinhos/env` (optional field).

---

## Epic 4: Image Generation Pipeline

**Goal:** Generate high-quality mascotinho illustrations that genuinely capture a child's likeness, verify quality before delivery, and deliver them via WhatsApp with the perceived production value of artificial delays and warm status messages. This is the core product delivery engine.

### Story 4.1: QStash Queue Setup and Consumer Endpoint — [mgiovani/fotos#57](https://github.com/mgiovani/fotos/issues/57)

As the system,
I want image generation requests queued via Upstash QStash with configurable delay,
So that webhook handlers respond within 5 seconds while generation runs asynchronously with artificial production delay.

**Acceptance Criteria:**

**Given** a payment is confirmed or a revision is requested
**When** the `enqueueGeneration` function is called
**Then** a QStash message is published to `POST /api/generate` with body `{ orderId, action: "generate", attempt: 1 }` and a 90-second delay
**And** the `/api/generate` route verifies the QStash signature (built-in middleware)
**And** the consumer checks the order status before processing (skip if already DELIVERED or COMPLETED — idempotency)
**And** QStash is configured with 3 automatic retries on failure (HTTP 500)
**And** on final retry failure, a dead-letter callback marks the order as FAILED and notifies the operator

**FRs covered:** FR-22 (async background queue generation), FR-24 (partial: artificial delay via QStash delay parameter)
**Technical notes:** `@upstash/qstash` client. Delay: `delay: 90` (seconds). Consumer route at `apps/web/src/app/api/generate/route.ts`. NFR-01 (webhook <5s by deferring), NFR-15 (concurrent generation support).

---

### Story 4.2: Prompt Enrichment from Client Inputs — [mgiovani/fotos#58](https://github.com/mgiovani/fotos/issues/58)

As the system,
I want to transform raw client inputs (photos, theme, outfit, extras) into a structured, optimized prompt,
So that GPT Image 1.5 receives clear, detailed instructions that maximize likeness quality and style adherence.

**Acceptance Criteria:**

**Given** the `/api/generate` consumer receives a generation request
**When** `enrichPrompt()` is called with the order data and style template
**Then** the function loads the StyleTemplate's prompt_template from the database
**And** calls GPT-5-mini to merge the template with client-specific details (outfit, extras, child characteristics from photos)
**And** produces a structured generation prompt optimized for GPT Image 1.5
**And** the enriched prompt is stored in the Generation record's `promptUsed` field for debugging and optimization
**And** if revision feedback exists (from Epic 5), it is incorporated into the re-enriched prompt

**FRs covered:** FR-21 (prompt enrichment using style template + GPT-5-mini)
**Technical notes:** Enrichment function in `packages/image-gen/src/enrich-prompt.ts`. The style template `promptTemplate` field contains the base prompt pattern with placeholders. GPT-5-mini fills in details from order data.

---

### Story 4.3: GPT Image 1.5 Generation with Base64 Input — [mgiovani/fotos#59](https://github.com/mgiovani/fotos/issues/59)

As the system,
I want to call GPT Image 1.5 with the reference photos and enriched prompt,
So that a high-quality 1024x1024 mascotinho illustration is generated that captures the child's likeness.

**Acceptance Criteria:**

**Given** an enriched prompt and base64-encoded reference photos are ready
**When** `generate()` is called in `packages/image-gen`
**Then** it calls the OpenAI GPT Image 1.5 API with quality "High", size 1024x1024, and the base64 photo(s) as image input
**And** the generated image is returned as base64 or URL
**And** API rate limits are handled with exponential backoff (3 retries)
**And** transient errors (500, 429) trigger retries; permanent errors (400) fail immediately
**And** the generation completes within 2 minutes end-to-end (excluding artificial delay)
**And** all API calls include orderId in logging context

**FRs covered:** FR-22 (GPT Image 1.5 High 1024x1024 with base64 input)
**Technical notes:** Use AI SDK or direct OpenAI API. Reference photos loaded from Supabase Storage via signed URLs, then base64-encoded. NFR-02 (generation <2min), NFR-17 (rate limit handling), NFR-24 (OpenAI error handling).

---

### Story 4.4: AI Quality Self-Critique Check — [mgiovani/fotos#60](https://github.com/mgiovani/fotos/issues/60)

As the system,
I want to automatically evaluate whether the generated image matches the client's photos and prompt,
So that obviously flawed images are caught before delivery, reducing revision rates.

**Acceptance Criteria:**

**Given** a mascotinho image has been generated
**When** `qualityCheck()` is called with the generated image, reference photos, and prompt
**Then** an AI model evaluates the output against the input (likeness, style adherence, prompt completeness)
**And** a quality score (0-100) is assigned and stored in the Generation record
**And** if the score is below a configurable threshold, the system auto-regenerates (counts toward the 2 auto-retry limit)
**And** the quality check adds no more than 15 seconds to the generation pipeline
**And** quality check failures are logged with the score and reasoning

**FRs covered:** FR-23 (AI quality self-check before delivery)
**Technical notes:** Quality check in `packages/image-gen/src/quality-check.ts`. Use GPT-5-mini with vision capability to compare images. This is separate from client-requested revisions (Epic 5). NFR-19 (auto-retry on failure).

---

### Story 4.5: Generated Image Upload to Permanent Storage — [mgiovani/fotos#61](https://github.com/mgiovani/fotos/issues/61)

As the system,
I want to store the final generated mascotinho in permanent Supabase Storage,
So that the image is preserved indefinitely and can be re-delivered if needed.

**Acceptance Criteria:**

**Given** the generated image passes quality check
**When** `uploadGenerated()` is called
**Then** the image is uploaded to the `generated` bucket at path `generated/{orderId}/{attemptNumber}.png`
**And** a Generation record is created in the database with: orderId, attemptNumber, promptUsed, imageUrl (storage path), qualityScore, and createdAt
**And** the upload retries 2x inline on failure (fast operation)
**And** if upload fails after retries, the generation is marked as failed and the operator is notified

**FRs covered:** FR-26 (permanent storage + Generation record creation)
**Technical notes:** Use `@mascotinhos/storage.uploadGenerated()`. Storage upload failures: retry 2x inline per architecture pattern, then fail.

---

### Story 4.6: WhatsApp Delivery with Artificial Delay — [mgiovani/fotos#62](https://github.com/mgiovani/fotos/issues/62)

As a client who paid for her mascotinho,
I want to receive the illustration via WhatsApp as both a viewable photo and a downloadable document,
So that I can instantly see it and also have the full-resolution version for birthday invitations.

**Acceptance Criteria:**

**Given** the generated image is uploaded to permanent storage and quality-checked
**When** the `deliverImage` function executes
**Then** the bot sends a warm status message with typing indicators: "Estou finalizando sua arte com carinho..."
**And** after the artificial delay (already handled by QStash 90s delay), the image is sent as a WhatsApp photo (instant viewing)
**And** immediately after, the same image is sent as a WhatsApp document (full-resolution download)
**And** the Order status transitions from GENERATING to DELIVERING, then to AWAITING_FEEDBACK
**And** no PDF is generated — only photo + document format

**FRs covered:** FR-24 (artificial delay with typing + warm messages), FR-25 (dual delivery: photo + document, no PDF), FR-27 (auto-retry via QStash retries)
**Technical notes:** Chat SDK supports sending both photo and document message types. The 90s delay is handled by QStash publish delay parameter, not by sleep. Send photo first, then document. Transition to AWAITING_FEEDBACK triggers the feedback collection (Epic 5).

---

## Epic 5: Revision, Completion & Abandoned Cart

**Goal:** Maximize client satisfaction through a revision loop (up to 2 rounds), graceful order completion with Instagram CTA, and abandoned cart recovery that re-engages silent clients without being pushy. This epic closes the conversion funnel.

### Story 5.1: Feedback Collection After Delivery — [mgiovani/fotos#63](https://github.com/mgiovani/fotos/issues/63)

As a client who received her mascotinho,
I want to be asked if I'm happy with the result and offered the option to request adjustments,
So that I can get the illustration exactly right before my child's party.

**Acceptance Criteria:**

**Given** the Order is in AWAITING_FEEDBACK state (image just delivered)
**When** the bot processes the post-delivery interaction
**Then** the bot asks: "Gostou? Posso ajustar algo? (2 ajustes inclusos)"
**And** reply buttons are presented: "Amei!" / "Quero ajustar"
**And** if the client taps "Amei!" or expresses satisfaction, the order transitions to COMPLETED
**And** if the client taps "Quero ajustar" or describes a change, the order transitions to REVISION_1

**FRs covered:** FR-28 (feedback collection with reply buttons)
**Technical notes:** The AI agent should also recognize natural language approval ("ficou perfeito!", "amei!", "lindo!") or revision requests without requiring button taps.

---

### Story 5.2: Revision Handling with Prompt Re-enrichment — [mgiovani/fotos#64](https://github.com/mgiovani/fotos/issues/64)

As a client who wants adjustments to her mascotinho,
I want to describe what I want changed in natural language and receive an updated illustration,
So that the final result matches my exact vision.

**Acceptance Criteria:**

**Given** the Order is in REVISION_1 or REVISION_2 state
**When** the client provides natural language feedback (e.g., "olhos mais escuros", "adiciona um balao")
**Then** the `handleRevision` tool captures the feedback text
**And** stores the revision feedback in a new Generation record's `revisionFeedback` field
**And** calls `enrichPrompt()` again, incorporating the original prompt + revision feedback
**And** enqueues a new generation via QStash (same async pipeline as initial generation)
**And** the new image goes through quality check, upload, and delivery (same as Story 4.3-4.6)
**And** after revision 1, if more feedback is provided, the order transitions to REVISION_2
**And** after revision 2, the bot delivers the final version and states: "Essa e a versao final! Espero que tenha amado"
**And** the revision counter is tracked per order and each attempt is recorded in the Generation table

**FRs covered:** FR-29 (natural language revision with re-enrichment), FR-30 (max 2 revisions), FR-31 (revision async pipeline), FR-32 (revision count tracking + feedback storage)
**Technical notes:** Each revision creates a new Generation record with incremented attemptNumber. The revision feedback becomes additional context for the prompt enrichment step. After REVISION_2, no more revisions are offered.

---

### Story 5.3: Order Completion with Closing CTA — [mgiovani/fotos#65](https://github.com/mgiovani/fotos/issues/65)

As a client who approved her mascotinho,
I want a warm closing message with a suggestion to share on Instagram,
So that I feel cared for and the business gets organic social proof.

**Acceptance Criteria:**

**Given** the client approves the mascotinho (after initial delivery or after revisions)
**When** the Order transitions to COMPLETED
**Then** the bot sends a warm closing message: "Que bom que voce amou! Vai ficar lindo na festinha!"
**And** the bot includes an Instagram CTA: "Se postar no Instagram, marca a gente @mascotinhos!"
**And** the Order status is set to COMPLETED with updatedAt timestamp
**And** no further bot messages are sent for this order unless the client initiates a new conversation

**FRs covered:** FR-30 (completion after revisions), FR-28 (implicit: satisfaction flow)
**Technical notes:** The closing message is the final interaction for this order. A new message from the same sender after COMPLETED creates a new Order in GREETING state (handled by Story 2.2 state machine).

---

### Story 5.4: Abandoned Cart Recovery via Scheduled Messages — [mgiovani/fotos#66](https://github.com/mgiovani/fotos/issues/66)

As the system,
I want to automatically nudge silent clients after 1.5 hours and gracefully close after 24 hours,
So that potential conversions are recovered without being pushy.

**Acceptance Criteria:**

**Given** a client's order enters any pre-payment state (COLLECTING_PHOTOS through AWAITING_PAYMENT)
**When** the client goes silent
**Then** at 1.5 hours, QStash triggers a nudge message: "Oi [name]! Vi que voce comecou a criar o mascotinho. Posso te ajudar com algo?"
**And** at 24 hours after the nudge (or 24 hours after payment QR was sent), QStash triggers a closure message: "Tudo bem! Se mudar de ideia, estou aqui. So me chamar!"
**And** the nudge message is only sent if the order is still in a pre-payment state (skip if already paid/completed)
**And** the closure message marks the Order as ABANDONED_24H with a timestamp
**And** if the client responds after the 1.5h nudge but before 24h closure, the conversation resumes from where it left off
**And** if the client responds after the 24h closure, a new order flow begins (per Story 2.2)

**FRs covered:** FR-33 (1.5h nudge), FR-34 (24h closure), FR-35 (abandoned status marking), FR-36 (state resumption for returning clients)
**Technical notes:** QStash messages published when entering AWAITING_PAYMENT: `{ action: "nudge_abandoned", delay: 5400 }` and `{ action: "close_abandoned", delay: 86400 }`. Consumer in `/api/generate` route checks current order status before acting.

---

## Epic 6: Landing Page

**Goal:** Provide a mobile-first marketing landing page that showcases the mascotinho portfolio, displays available styles, explains pricing, and drives Meta ad traffic directly into WhatsApp conversations. The page must load fast and convert visitors into WhatsApp leads.

### Story 6.1: Landing Page Layout with Hero, How-It-Works, and Pricing — [mgiovani/fotos#67](https://github.com/mgiovani/fotos/issues/67)

As a visitor arriving from a Meta ad,
I want to immediately understand what Mascotinhos offers, how it works, and how much it costs,
So that I can decide to start my order within seconds.

**Acceptance Criteria:**

**Given** a visitor loads the landing page on mobile
**When** the page renders
**Then** the hero section displays a compelling headline, a before/after mascotinho example, and a prominent CTA button linking to WhatsApp
**And** a "How it works" section shows the 3-step flow: send photo, pay via PIX, receive mascotinho in minutes
**And** a pricing section prominently displays R$29,90 with "sem custos escondidos" messaging
**And** a social proof section shows client testimonials and Instagram share examples
**And** the page uses shadcn/ui components with Tailwind CSS styling
**And** all sections use Server Components (no client-side JavaScript unless interactive)

**FRs covered:** FR-45 (partial: mobile-first layout)
**Technical notes:** Static generation (SSG) for performance. Use Next.js Image component for all portfolio images. Hero CTA: `https://wa.me/55{number}?text=Oi!+Quero+fazer+meu+mascotinho!`.

---

### Story 6.2: Portfolio Gallery with Before/After Examples — [mgiovani/fotos#68](https://github.com/mgiovani/fotos/issues/68)

As a visitor,
I want to see real examples of children's photos alongside their mascotinho illustrations,
So that I can judge the quality and feel confident the service will capture my child's likeness.

**Acceptance Criteria:**

**Given** the portfolio section of the landing page
**When** the visitor scrolls to the gallery
**Then** a grid of before/after pairs is displayed (original photo left, mascotinho right)
**And** images are lazy-loaded for performance
**And** Next.js Image component handles automatic optimization (WebP, responsive sizing)
**And** images are served from `public/images/` (static, curated portfolio — not from Supabase Storage)
**And** the gallery is responsive: 1 column on mobile, 2-3 columns on desktop
**And** each pair includes the style theme name as a caption

**FRs covered:** FR-41 (before/after portfolio gallery)
**Technical notes:** Portfolio images are static (curated by operator, placed in `public/images/`). Not pulled from database for MVP — avoids needing parental release consent management system. Use Next.js Image with `sizes` prop for responsive optimization.

---

### Story 6.3: Style Template Browser with CTA Links — [mgiovani/fotos#69](https://github.com/mgiovani/fotos/issues/69)

As a visitor,
I want to browse available mascotinho styles with visual previews and jump directly to WhatsApp with my chosen theme,
So that I can start my order for the specific style I want.

**Acceptance Criteria:**

**Given** the styles section of the landing page (or a dedicated `/styles` page)
**When** the visitor browses styles
**Then** each style template is displayed as a card with: name, 1-2 example mascotinho images, brief description
**And** each card has a CTA button that opens WhatsApp with a pre-filled message specific to that style: `https://wa.me/55{number}?text=Oi!+Quero+mascotinho+tema+[style]!`
**And** styles are loaded from the StyleTemplate table at build time (ISR for updates)
**And** only active templates (`active = true`) are displayed
**And** styles are sorted by popularity (descending)

**FRs covered:** FR-42 (style browser with previews), FR-43 (per-style CTA to WhatsApp)
**Technical notes:** Use ISR (Incremental Static Regeneration) with a revalidation period (e.g., 1 hour) so new templates appear without redeployment. Query StyleTemplate via Prisma at build time. NFR-04 (Core Web Vitals).

---

### Story 6.4: Privacy Policy and Terms of Service Pages — [mgiovani/fotos#70](https://github.com/mgiovani/fotos/issues/70)

As a visitor or client,
I want to read the privacy policy and terms of service,
So that I understand how my child's data is handled and what the service terms are.

**Acceptance Criteria:**

**Given** a visitor navigates to `/privacy` or `/terms`
**When** the page renders
**Then** the privacy policy page covers: LGPD compliance, children's data handling, 30-day auto-delete policy, DPA with OpenAI disclosure, consent mechanism, data minimization practices
**And** the terms of service page covers: ECA Digital parental consent, AI generation disclosure, revision policy (2 rounds included), delivery obligations, payment terms, consumer protection (CDC)
**And** both pages are accessible from the footer of every page
**And** both pages are linked in bot conversation flows (LGPD consent message includes privacy policy link)
**And** pages are statically generated (no JavaScript required)

**FRs covered:** FR-44 (privacy policy + terms of service pages)
**Technical notes:** Static pages at `apps/web/src/app/privacy/page.tsx` and `apps/web/src/app/terms/page.tsx`. Content should be in Brazilian Portuguese. Legal content must cover all compliance requirements from the PRD.

---

### Story 6.5: Mobile-First Responsive Design and Core Web Vitals — [mgiovani/fotos#71](https://github.com/mgiovani/fotos/issues/71)

As a visitor on a mobile device (95%+ of traffic),
I want the landing page to load fast, look great, and not shift around while loading,
So that I have a smooth experience and don't abandon before reaching WhatsApp.

**Acceptance Criteria:**

**Given** the landing page is accessed on a mobile device over a 3G connection
**When** the page loads
**Then** LCP (Largest Contentful Paint) is <2.5 seconds
**And** FID (First Input Delay) is <100 milliseconds
**And** CLS (Cumulative Layout Shift) is <0.1
**And** all images have explicit width/height attributes (no layout shift)
**And** fonts are preloaded or use `font-display: swap`
**And** the design is mobile-first: single-column layout, touch-friendly buttons (min 44px), readable text without zooming
**And** desktop layout adapts gracefully (wider grids, larger images)

**FRs covered:** FR-45 (mobile-first responsive + Core Web Vitals)
**Technical notes:** NFR-04 (LCP <2.5s, FID <100ms, CLS <0.1). Use Vercel Speed Insights for monitoring. Optimize images with Next.js Image. Minimize JavaScript — use Server Components by default. Test with Lighthouse mobile preset.

---

## Epic 7: Resilience & Operator Tools

**Goal:** Give the operator visibility into business operations, enable manual intervention on edge cases, and seed the initial style template library so the platform is ready for production launch.

### Story 7.1: Error Handling Pattern with Operator Notifications — [mgiovani/fotos#72](https://github.com/mgiovani/fotos/issues/72)

As the operator,
I want to be notified immediately via WhatsApp or Telegram when critical failures occur,
So that I can intervene on stuck orders before clients notice.

**Acceptance Criteria:**

**Given** a critical failure occurs (generation failed after all retries, payment webhook verification failed, QStash consumer error)
**When** the error handling pattern detects the failure
**Then** the operator receives a notification formatted as: `[MASCOTINHOS] {severity}: {message} | Order: {orderId}`
**And** the notification is sent via WhatsApp (using Chat SDK to the OPERATOR_WHATSAPP_NUMBER) or Telegram bot
**And** the error is logged with structured JSON including orderId, error code, service name, and stack trace
**And** PII is redacted from logs (phone numbers as last 4 digits only)
**And** the retry pattern follows: try 3x with exponential backoff, then notify operator on final failure

**FRs covered:** FR-50 (partial: operator awareness of stuck orders)
**Technical notes:** Error handling per architecture pattern: `callWithRetry(apiCall, { maxRetries: 3, backoff: "exponential" })`. Operator notification format from architecture. NFR-12 (PII redaction), NFR-26 (structured logging), NFR-27 (error tracking with context).

---

### Story 7.2: Failed Generation Order Handling — [mgiovani/fotos#73](https://github.com/mgiovani/fotos/issues/73)

As the operator,
I want failed generation orders clearly marked in the database with enough context to diagnose the issue,
So that I can manually resolve edge cases (e.g., blurry photos, API errors).

**Acceptance Criteria:**

**Given** an image generation fails after all retries (QStash exhausts retry policy)
**When** the dead-letter callback fires
**Then** the Order status is set to FAILED with updatedAt timestamp
**And** the Generation record stores the error details (error code, last prompt used, attempt number)
**And** the operator is notified (per Story 7.1)
**And** the client receives a graceful message: "Desculpa, tivemos um probleminha tecnico. O Giovani vai resolver pessoalmente!"
**And** the operator can see all FAILED orders with a simple Supabase dashboard query

**FRs covered:** FR-50 (operator intervention on failed orders), FR-27 (auto-retry exhaustion handling)
**Technical notes:** QStash dead-letter callback URL: configure a separate endpoint or handle the `action` in `/api/generate`. Client message should set expectations for manual follow-up. NFR-19 (retry exhaustion).

---

### Story 7.3: Order Monitoring Queries for Operator — [mgiovani/fotos#74](https://github.com/mgiovani/fotos/issues/74)

As the operator,
I want to query order status, revenue, and conversion metrics from the Supabase dashboard,
So that I can monitor business health and make data-driven decisions daily.

**Acceptance Criteria:**

**Given** the operator accesses the Supabase dashboard SQL editor
**When** they run monitoring queries
**Then** they can query: orders by status (today, this week, this month), total revenue (sum of confirmed payments), conversion rate (confirmed payments / total orders), revision rate (orders with REVISION_1 or REVISION_2 status), average generation time, failed generation count, abandoned cart count, and most popular style templates
**And** example SQL queries are documented in a `docs/operator-queries.sql` file in the repository
**And** all timestamp fields support timezone-aware filtering for BRT (UTC-3)

**FRs covered:** FR-49 (order monitoring via Supabase dashboard), FR-40 (partial: template management via DB)
**Technical notes:** No admin UI for MVP. All monitoring via Supabase dashboard built-in SQL editor. NFR-28 (key business metrics queryable from database). Document common queries for operator convenience.

---

### Story 7.4: Style Template Seeding with Initial Library — [mgiovani/fotos#75](https://github.com/mgiovani/fotos/issues/75)

As the operator,
I want 5-10 style templates pre-loaded in the database with optimized prompts and example images,
So that the bot has a compelling selection ready for the first clients.

**Acceptance Criteria:**

**Given** the database is set up and the Prisma schema is deployed
**When** the seed script runs (`bun run db:seed` or equivalent)
**Then** 5-10 StyleTemplate records are created with: name, slug, promptTemplate (optimized for GPT Image 1.5), exampleImages (Supabase Storage URLs), tags, productType = MASCOTINHO, active = true, popularity = 0
**And** initial styles include at minimum: Princesa, Safari, Jardim Encantado, Sereia, Super-Heroi
**And** prompt templates are well-crafted with placeholder patterns for child characteristics, outfit, and extras
**And** example images are uploaded to Supabase Storage and URLs referenced in the records
**And** the operator can add, edit, deactivate templates via direct database operations, with changes reflected in bot quick-reply buttons on the next conversation

**FRs covered:** FR-37 (StyleTemplate entity with all fields), FR-40 (operator CRUD via database), FR-51 (seed, edit, test templates in database)
**Technical notes:** Seed data in `packages/image-gen/src/templates/seed.ts`. Use Prisma seed functionality. Prompt templates should follow a consistent structure that the enrichment function can parse.

---

## Epic 8: LGPD Compliance & Security

**Goal:** Ensure the platform meets LGPD, ECA Digital, and WhatsApp Business API compliance requirements through explicit consent capture, automatic data cleanup, webhook security, and strict photo isolation. This epic hardens the platform for production launch with legal confidence.

### Story 8.1: LGPD Consent Capture in Conversation Flow — [mgiovani/fotos#76](https://github.com/mgiovani/fotos/issues/76)

As a client sending photos of their child,
I want to be clearly informed about how my child's data will be used and give explicit consent,
So that I know my privacy rights are respected and the service operates legally.

**Acceptance Criteria:**

**Given** the conversation reaches the photo collection step
**When** the client is about to send their first photo
**Then** the bot displays the LGPD consent message: "Ao enviar a foto, voce consente com o uso para geracao da arte conforme nossos Termos de Uso e Politica de Privacidade [link]"
**And** the privacy policy link points to the landing page's `/privacy` page
**And** the consent timestamp is recorded in the Client table (`consentTimestamp` and `consentVersion` fields)
**And** the consent is captured once per client (not repeated on subsequent orders from the same sender)
**And** photos sent before consent acknowledgment are held until consent is captured

**FRs covered:** FR-04 (inline LGPD consent capture), FR-47 (consent timestamp logging)
**Technical notes:** Consent is implicit by continuing to send photos after seeing the message (Brazilian LGPD Article 14 requires explicit parental consent for children's data). Store consentVersion to track if policy changes require re-consent. NFR-11 (LGPD data handling).

---

### Story 8.2: Reference Photo 30-Day TTL Auto-Delete — [mgiovani/fotos#77](https://github.com/mgiovani/fotos/issues/77)

As the system,
I want reference photos automatically deleted from Supabase Storage 30 days after order completion,
So that the platform enforces LGPD data minimization without manual intervention.

**Acceptance Criteria:**

**Given** reference photos are stored in the `references` bucket with TTL metadata
**When** the scheduled cleanup job runs (via QStash cron or Vercel Cron)
**Then** all reference photos with `expiresAt` timestamp older than the current time are deleted from Supabase Storage
**And** the cleanup job runs daily (once per day is sufficient for 30-day TTL)
**And** the cleanup function is in `packages/storage/src/cleanup.ts`
**And** deleted file paths are logged (without PII) for audit trail
**And** errors during cleanup are logged and operator is notified (but do not block the cleanup of remaining files)

**FRs covered:** FR-46 (30-day auto-delete via scheduled cleanup)
**Technical notes:** Use QStash cron or Vercel Cron Job to trigger `/api/generate` with `{ action: "cleanup_references" }` daily. Query files by metadata `expiresAt < now()`. NFR-11 (LGPD data handling). Bulk delete in batches to avoid timeouts.

---

### Story 8.3: Webhook Signature Verification (WhatsApp + Asaas) — [mgiovani/fotos#78](https://github.com/mgiovani/fotos/issues/78)

As the system,
I want all incoming webhooks cryptographically verified before processing,
So that spoofed or tampered webhook requests are rejected and the system is secure.

**Acceptance Criteria:**

**Given** a webhook request arrives at `/api/whatsapp/webhook` or `/api/payments/webhook`
**When** the signature is checked
**Then** WhatsApp webhooks are verified using Chat SDK's built-in signature verification against the WHATSAPP_WEBHOOK_TOKEN
**And** Asaas webhooks are verified using the ASAAS_WEBHOOK_SECRET
**And** QStash consumer requests are verified using QStash's built-in signature verification
**And** requests with invalid or missing signatures receive HTTP 401 and are not processed
**And** signature verification failures are logged as warnings with the request source IP (no PII)

**FRs covered:** FR-48 (partial: security supporting photo isolation)
**Technical notes:** NFR-07 (WhatsApp signature verification), NFR-08 (Asaas signature verification). This story consolidates all webhook security. Verification should be the FIRST check in each handler, before any business logic.

---

### Story 8.4: Photo Isolation and Data Minimization — [mgiovani/fotos#79](https://github.com/mgiovani/fotos/issues/79)

As a client,
I want assurance that my child's photos are never shared with other clients or used outside my order,
So that my child's privacy is fully protected.

**Acceptance Criteria:**

**Given** a client uploads reference photos for an order
**When** any system component accesses photos
**Then** photos are stored in orderId-scoped paths (`references/{orderId}/`) — no cross-order access
**And** the storage package enforces orderId-scoped access (functions require orderId parameter)
**And** no database query or storage operation ever accesses photos from a different order
**And** generated images are similarly scoped to orderId (`generated/{orderId}/`)
**And** the system collects only the minimum data needed: photo, theme, outfit description, extras, payment info
**And** no additional personal data (address, CPF, email) is collected

**FRs covered:** FR-48 (no photo sharing/cross-reference between orders)
**Technical notes:** Enforced by storage package API design (all functions require orderId). Additionally, Supabase Storage bucket policies should restrict access to signed URLs only. NFR-09 (private bucket policy). NFR-11 (data minimization).

---

## NFR Coverage Summary

| NFR | Addressed By |
|-----|-------------|
| NFR-01 (webhook <5s) | Story 2.1 (WhatsApp webhook), Story 4.1 (QStash async) |
| NFR-02 (generation <2min) | Story 4.3 (GPT Image generation) |
| NFR-03 (payment webhook <5s) | Story 3.2 (payment webhook handler) |
| NFR-04 (Core Web Vitals) | Story 6.5 (mobile-first + CWV) |
| NFR-05 (state load <500ms) | Story 2.2 (state machine persistence) |
| NFR-06 (response <3s) | Story 2.3 (agent definition), Story 2.4 (greeting flow) |
| NFR-07 (WhatsApp signature) | Story 8.3 (webhook verification) |
| NFR-08 (Asaas signature) | Story 8.3 (webhook verification) |
| NFR-09 (private storage) | Story 1.2 (bucket config), Story 8.4 (photo isolation) |
| NFR-10 (env vars security) | Story 1.3 (env validation) |
| NFR-11 (LGPD handling) | Story 8.1 (consent), Story 8.2 (TTL delete), Story 8.4 (minimization) |
| NFR-12 (PII redaction) | Story 7.1 (error handling pattern) |
| NFR-13 (100 orders/month) | Story 1.1 (schema design), cross-cutting |
| NFR-14 (1000 orders/month) | Cross-cutting architecture (Supabase Pro + Vercel Pro) |
| NFR-15 (concurrent generation) | Story 4.1 (QStash queue) |
| NFR-16 (WhatsApp verification) | Operational prerequisite (not a code story) |
| NFR-17 (GPT rate limits) | Story 4.3 (exponential backoff) |
| NFR-18 (99% uptime) | Cross-cutting (Vercel serverless SLA) |
| NFR-19 (auto-retry 2x) | Story 4.4 (quality check re-gen), Story 7.2 (failed handling) |
| NFR-20 (idempotent webhooks) | Story 3.2 (payment webhook idempotency) |
| NFR-21 (DB backup) | Operational (Supabase Pro automatic backups) |
| NFR-22 (24h window) | Story 5.4 (abandoned cart timing), Story 2.3 (agent awareness) |
| NFR-23 (Asaas retry) | Story 3.1 (PIX generation retry), Story 1.4 (wrapper retry) |
| NFR-24 (OpenAI retry) | Story 4.3 (generation retry) |
| NFR-25 (connection pooling) | Story 1.1 (Prisma config with PgBouncer) |
| NFR-26 (structured logging) | Story 7.1 (error handling + logging pattern) |
| NFR-27 (error tracking) | Story 7.1 (error handling), Story 7.2 (failed orders) |
| NFR-28 (business metrics) | Story 7.3 (operator monitoring queries) |

---
stepsCompleted: [step-01-init, step-02-discovery, step-02b-vision, step-02c-executive-summary, step-03-success, step-04-journeys, step-05-domain, step-06-innovation, step-07-webapp, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish, step-12-complete]
status: complete
inputDocuments:
  - product-brief-mascotinhos.md
  - product-brief-mascotinhos-distillate.md
  - domain-mascotinhos-ai-illustrations-research-2026-03-27.md
  - market-mascotinhos-research-2026-03-27.md
  - technical-mascotinhos-research-2026-03-27.md
  - brainstorming-session-2026-03-26-1200.md
documentCounts:
  briefs: 2
  research: 3
  brainstorming: 1
  projectDocs: 0
workflowType: 'prd'
classification:
  projectType: web_app
  domain: ecommerce
  complexity: high
  projectContext: greenfield
  notes: 'Next.js landing page (portfolio, styles, legal, CTA→WhatsApp) + API backend (webhooks, bot orchestration, payments, image generation) + WhatsApp bot'
---

# Product Requirements Document - Mascotinhos

**Author:** Giovani
**Date:** 2026-03-27

## Executive Summary

Mascotinhos is an automated WhatsApp-based platform that transforms a simple conversation and a PIX payment into high-quality, personalized AI-generated illustrations of children — delivered in minutes, not days.

The R$15 billion Brazilian children's party market is served by hundreds of fragmented sellers on Instagram, Elo7, and WhatsApp, all operating manually: slow response times (hours to days), inconsistent quality, 3-10 day delivery, and unreliable communication. Meanwhile, DIY alternatives (free ChatGPT) produce inconsistent results and require technical skill that the target audience — Brazilian mothers aged 25-40 planning birthday parties — does not have and does not want to learn.

Mascotinhos eliminates this friction entirely. A mother clicks a Meta ad, lands in WhatsApp, has a warm, attentive conversation with an AI agent that feels human (emoji-rich, casual Brazilian Portuguese, typing indicators, deliberate production delays), pays R$29.90 via PIX, and receives a mascotinho that genuinely captures her child's likeness — all within 30 minutes. The platform is architected for extensibility: birthday invitations, Instagram filters, pet avatars, and professional caricatures are product-line additions that reuse the same conversation engine, payment pipeline, and generation infrastructure.

No verified automated WhatsApp bot competitor exists in this space. Unit economics are exceptional: R$0.91-R$4.73 cost per order against R$29.90 revenue yields 84-97% gross margins. The 12-18 month window to establish operational and brand leadership is now.

### What Makes This Special

Three capabilities working together that no competitor combines:

1. **Quality that captures likeness** — AI-generated illustrations that genuinely look like the child, not generic cartoons. Mothers are proud to use them on birthday invitations and share on Instagram. This is the emotional trigger that drives word-of-mouth.

2. **Human-feel conversation at infinite scale** — Artificial delays, typing indicators, warm emoji-rich Portuguese, and attentive follow-ups create the feeling of being served by a caring person. The conversation IS the product experience — not friction to eliminate, but the core value proposition to automate with empathy.

3. **Minutes, not days** — The entire flow from first message to delivered image happens in one sitting. No "come back tomorrow," no forgotten orders, no ghosting. Instant gratification at a price point that's an impulse buy (<0.5% of typical party budget).

### Project Classification

- **Project Type:** Web Application — Next.js landing page (portfolio, style gallery, legal pages, CTA → WhatsApp) + API backend (webhook handlers, bot orchestration, payment processing, AI image generation pipeline)
- **Domain:** E-commerce — WhatsApp conversational commerce, automated order fulfillment, regulated personal data processing
- **Complexity:** High — LGPD compliance for children's data, ECA Digital (Lei 15.211/2025, effective March 2026), WhatsApp Business API policy compliance, AI-generated content copyright gray area, consumer protection obligations
- **Project Context:** Greenfield — new product, no existing codebase

## User Journeys

### Journey 1: Carla — The Birthday Mom (Happy Path)

**Who:** Carla, 32, lives in Recife. Her daughter Valentina is turning 2. Carla is planning a "Jardim Encantado" themed party and wants everything personalized. She's been scrolling Instagram for party ideas and sees a Meta ad: "Mascotinho personalizado da sua filha — R$29,90. Pronta em minutos!"

**Opening Scene:** Carla clicks the ad. WhatsApp opens with a pre-filled message: "Oi! Quero fazer o mascotinho da minha filha!" She's curious but skeptical — she's been burned before by Instagram sellers who took her money and ghosted.

**Rising Action:** The bot responds instantly with a warm greeting, a carousel of before/after examples, the price, and social proof. Carla is impressed — the examples look amazing and actually resemble the children. She says "quero fazer!" The bot asks for Valentina's photo, the party theme (she taps the "Jardim Encantado" quick-reply button), and the outfit she'll wear. Carla sends 2 photos and a screenshot of the dress. The bot confirms: "Perfeito! Valentina de Jardim Encantado, com esse vestidinho lindo. Para iniciar a producao, o valor e R$29,90 via PIX." A QR code appears instantly.

**Climax:** Carla pays. A minute later: "Estou preparando a arte da Valentina com carinho..." with typing indicators. Two minutes after payment, the mascotinho arrives — sent as a WhatsApp photo for instant viewing, then as a document for full-resolution download. Carla gasps — it looks EXACTLY like Valentina, in the enchanted garden theme, wearing the dress. She screenshots it immediately and sends it to her sister.

**Resolution:** The bot asks: "Gostou? Posso ajustar algo? (2 ajustes inclusos)" Carla responds "AMEI! Ficou perfeito!" The bot closes with "Se postar no Instagram, marca a gente @mascotinhos!" Carla is already planning to use it on the party invitations. Total time: 8 minutes from ad click to delivered mascotinho.

**Requirements revealed:** Ad → WhatsApp flow, portfolio showcase, quick-reply buttons, photo collection, PIX QR generation, async image generation, artificial delay, dual delivery (photo + document), revision offer, closing CTA.

### Journey 2: Fernanda — The Revision Path

**Who:** Fernanda, 28, from Belo Horizonte. Her son Pedro is turning 1. Safari Mickey theme.

**Opening Scene:** Fernanda arrives via Meta ad. Same warm greeting flow. She sends Pedro's photo, picks "Safari" from the buttons, and sends a reference image of the Mickey safari outfit from Shopee.

**Rising Action:** Payment goes through. The mascotinho arrives in 2 minutes. It's cute, but Fernanda notices: "Os olhos dele ficaram muito claros, ele tem olhos escuros." The bot responds: "Sem problemas! Vou ajustar os olhos para mais escuros. Um momento..." Re-generates in 90 seconds with corrected eyes.

**Climax:** Fernanda approves: "Agora ficou perfeito!" She then asks: "Consegue colocar ele segurando um balao com o numero 1?" — that's revision #2. The bot re-generates with the balloon. Fernanda loves it.

**Resolution:** The bot delivers the final version (photo + document) and closes warmly. Fernanda used both revision rounds, but the whole process took 15 minutes — still faster than any competitor.

**Requirements revealed:** Revision handling (max 2), prompt re-enrichment from natural language feedback, revision counter tracking, quality sufficient for concrete tweaks (eyes, accessories, props).

### Journey 3: Ana — The Abandoned Cart

**Who:** Ana, 35, from Sao Paulo. Saw the ad at work. Interested but distracted.

**Opening Scene:** Ana clicks the ad, asks for info. Bot sends the greeting + portfolio. Ana says "quero!" and sends her daughter's photo. Bot asks for theme — Ana goes silent. She's in a meeting.

**Rising Action:** 1.5 hours later, the bot sends a gentle nudge: "Oi Ana! Vi que voce comecou a criar o mascotinho da sua filha. Posso te ajudar com algo?" Ana sees it after the meeting and responds: "Desculpa, tava ocupada. O tema e Princesa." The flow resumes — theme confirmed, PIX sent, payment made, mascotinho delivered.

**Alternative path:** Ana never responds. After 24 hours, the bot sends a final message: "Oi! Infelizmente o prazo da sua reserva expirou, mas posso gerar um novo quando voce quiser! So me chamar." Conversation closed gracefully.

**Requirements revealed:** Conversation state persistence, scheduled message at 1.5h, scheduled message at 24h, graceful conversation closure, ability to resume mid-flow.

### Journey 4: Giovani — The Operator

**Who:** Giovani, the business owner. Needs to monitor orders, manage style templates, and handle edge cases.

**Opening Scene:** Giovani checks the Supabase dashboard (later: admin dashboard) in the morning. He sees 12 orders completed overnight, 3 pending payment, 1 with a failed generation.

**Rising Action:** He checks the failed generation — the client sent a blurry photo that the AI couldn't process. The order is stuck. Giovani manually reviews the photo, realizes it's unusable, and sends the client a message asking for a clearer photo (via direct WhatsApp, not the bot). He also notices "Princesa" style is the most popular this week — he decides to create a new variation.

**Climax:** Giovani seeds a new style template "Princesa Moderna" with a refined prompt. He tests it with a sample photo — the result is gorgeous. He activates it and it appears in the quick-reply buttons.

**Resolution:** Giovani checks revenue: R$358.80 from 12 orders. Cost: ~R$22 in AI + R$0 PIX (within free tier). He adjusts the Meta ad targeting based on which states are converting best.

**Requirements revealed:** Database-level order monitoring (MVP, no dashboard UI), style template CRUD, failed generation handling, manual intervention path, revenue tracking, template testing workflow.

### Journey Requirements Summary

| Capability | J1 Happy | J2 Revision | J3 Abandoned | J4 Operator |
|-----------|----------|-------------|-------------|-------------|
| WhatsApp conversation engine | x | x | x | |
| Portfolio/examples display | x | | | |
| Quick-reply buttons (styles) | x | x | x | |
| Photo collection + storage | x | x | x | |
| PIX payment + webhook | x | x | x | |
| Async image generation | x | x | | |
| Artificial delay + typing | x | x | | |
| Dual delivery (photo + document) | x | x | | |
| Revision handling (max 2) | | x | | |
| Abandoned cart (1.5h + 24h) | | | x | |
| Conversation state persistence | x | x | x | |
| Scheduled messages | | | x | |
| Order monitoring (DB) | | | | x |
| Style template management | | | | x |
| Failed generation handling | | | | x |
| Manual intervention path | | | | x |

**Delivery format:** Images sent as WhatsApp photos (instant viewing) + same images sent as documents (full-resolution download). No PDF generation.

## Success Criteria

### User Success

- **Likeness quality:** Mother recognizes her child in the mascotinho without hesitation — good enough for birthday invitations and Instagram sharing
- **Conversation experience:** Client feels attended to and cared for throughout — indistinguishable from chatting with a real person
- **Delivery speed:** Image delivered within 30 minutes of payment confirmation
- **First-generation approval rate:** 70-80% of orders approved without revisions (driven by quality prompt templates)
- **Revision satisfaction:** 95%+ of orders resolved within 2 revision rounds

### Business Success

| Metric | 3-Month Target | 6-Month Target | 12-Month Target |
|--------|---------------|----------------|-----------------|
| Orders/month | 100 | 300 | 1,000+ |
| Conversion rate (lead → payment) | 20-30% (test & optimize) | 25-35% | 30-40% |
| CPA (Meta ads) | <R$15 | <R$12 | <R$10 |
| Gross margin | >84% | >84% | >80% (with paid PIX) |
| Monthly revenue | R$2,990 | R$8,970 | R$29,900+ |
| Instagram shares/month | 10+ organic | 50+ | 200+ |

### Technical Success

- Webhook response: <5 seconds (100% of requests)
- Image generation: <2 minutes end-to-end (including enrichment + QC)
- Payment webhook confirmation: <5 seconds
- Bot uptime: >99%
- Failed generation rate: <5% (auto-retry handles the rest)
- Landing page load time: <2 seconds (Core Web Vitals green)

### Measurable Outcomes

- **North star metric:** Orders completed per month (payment confirmed + image delivered + client satisfied)
- **Leading indicators:** WhatsApp conversations started, photos received, PIX QR codes generated
- **Lagging indicators:** Instagram shares, referral orders, repeat customers, revision rate

## Product Scope & Phased Development

### MVP Strategy

Ship the smallest thing that proves the business model: a WhatsApp bot that can take a mother from ad click to delivered mascotinho in under 30 minutes, with PIX payment, at R$29.90. Everything else is growth.

### MVP Feature Set (Phase 1 — Weeks 1-3)

**Must-have for launch:**

1. WhatsApp bot conversation engine (AI agent with full state machine, warm PT-BR personality)
2. Photo collection and storage (Supabase Storage, base64 encoding for API input)
3. Style template selection (5-10 seeded templates with quick-reply buttons, sorted by popularity)
4. PIX payment via Asaas (dynamic QR generation + webhook confirmation + partner split)
5. AI prompt enrichment (client inputs + style template → structured generation prompt via GPT-5-mini)
6. AI image generation (GPT Image 1.5 High 1024x1024, async queue)
7. AI quality self-check (compare output vs input photo + prompt before delivery)
8. Artificial delay (1-2 min with typing indicators: "Estou preparando sua arte com carinho...")
9. Dual delivery (WhatsApp photo for instant viewing + document for full-resolution download)
10. Revision handling (max 2 rounds, concrete prompt tweaks from natural language feedback)
11. Abandoned cart recovery (1.5h gentle nudge + 24h graceful closure)
12. LGPD consent capture (inline in conversation: "Ao enviar a foto, voce consente...")
13. Landing page (before/after portfolio, style browser, pricing, legal pages, CTAs → WhatsApp)
14. Order tracking in database (no admin UI — DB-level monitoring via Supabase dashboard)
15. WhatsApp Business verification submission (start day 1 — 2-10 business days)
16. Instagram sharing CTA in closing message ("Se postar no Instagram, marca a gente @mascotinhos!")

### Post-MVP Features (Phase 2 — Month 2-3)

1. Product ladder: mascotinho + convite bundle (R$49.90), kit festa (R$79.90)
2. 3-variations approach (A/B test generating 3 options vs current revision loop)
3. Referral codes with peer discount ("Indica pra uma amiga e voces duas ganham R$5 de desconto!")
4. Holiday broadcasts to past client list (Dia das Criancas, Natal, Carnaval themed offers)
5. Admin dashboard (order management, revenue analytics, template management UI)
6. Instagram sharing tracking (monitor @mascotinhos tags as organic growth metric)
7. Automated quality scoring threshold (AI self-critique rejects below score, auto-regenerates)
8. Photo quality guidance (instruct customers on ideal photo specs to maximize output quality)

### Vision Features (Phase 3 — Month 3+)

1. Professional caricatures as second product (URGENT — viral trend peaking, 12-month window)
2. Pet avatars as third product (R$75B Brazilian pet market, zero organized competition)
3. Couple/family illustrations (seasonal launches: Valentine's Day, Mother's Day, Christmas)
4. Ad creative automation (scrape Meta Ad Library for winning ads, analyze patterns, generate variations)
5. Web-based order form as alternative channel (architecture already supports it)
6. WhatsApp sticker pack delivery
7. Animated mascotinhos (video via D-ID/HeyGen)
8. White-label bot for Elo7/marketplace sellers

### Risk Mitigation Strategy

- **Technical:** Async queue handles webhook <5s constraint; Supabase upgrade to Pro ($25/month) before launch prevents auto-pause; Vercel Queues or Upstash for background jobs
- **Market:** R$29.90 tested first; A/B test against R$19.90/R$39.90 within 30 days; CPA target <R$15 validated before scaling ad spend
- **Regulatory:** LGPD consent + ECA Digital compliance baked into MVP conversation flow from day 1; DPA with OpenAI signed before launch
- **Quality:** If first-generation approval rate <60%, pause ad spend and improve prompt templates before scaling; technical spike on Medium vs High quality early

## Domain-Specific Requirements

### Compliance & Regulatory

- **LGPD (Article 14):** Children's photos are personal data requiring explicit parental consent. Data minimization enforced — collect only photo + order info. Auto-delete reference photos 30 days after delivery. ANPD has designated children's data as a priority enforcement area.
- **ECA Digital (Lei 15.211/2025, effective March 17, 2026):** Requires explicit parental authorization for commercial use of child images in digital environments. Since parents themselves order, consent is inherent but must be legally explicit via Terms of Service.
- **ECA (Art. 17) + STJ Sumula 403:** Damage is presumed without proof for unauthorized commercial use of a child's image. Marketing materials cannot feature children's likenesses without individual signed releases.
- **WhatsApp Business API Policy (Jan 2026):** General-purpose AI bots banned. Task-specific commerce bots (structured order flows, payment processing, product delivery) are explicitly allowed. Official API required — unofficial automation tools blocked.
- **CONAR Resolution 163/2014:** All advertising must target adults (25-45), never children under 12. No childish language, cartoon characters appealing to children, or prize distributions targeting minors in ad creatives.
- **AI Copyright (Lei 9.610/98):** AI-generated images currently lack clear copyright protection (requires human intellectual creation). PL 2338/2023 (Marco Legal da IA) passed Senate December 2024, pending Chamber review. OpenAI ToS assigns output ownership to API user. Disclosure of AI generation is best practice.
- **CDC (Consumer Protection):** Digital product delivery obligations apply. 7-day withdrawal right is nuanced for consumed digital products. Clear product description, delivery method, timeline, and payment terms required. Revision policy manages quality expectations and prevents disputes.
- **Tax:** MEI recommended (R$81,000/year limit, ~R$50/month flat DAS tax). Upgrade to Simples Nacional (6-13%) when exceeding MEI threshold. Avoid pessoa fisica selling (up to 27.5% income tax).

### Privacy & Data Handling

- Inline LGPD consent captured in WhatsApp conversation: "Ao enviar a foto, voce consente com o uso para geracao da arte conforme nossos Termos de Uso e Politica de Privacidade"
- Privacy policy hosted on landing page, linked in conversation flow
- Reference photos stored in Supabase Storage with 30-day TTL auto-delete via scheduled cleanup
- Generated images permanent in Supabase Storage (client's property, delivered as WhatsApp photos + documents)
- No sharing of client photos between orders; strict isolation per order
- OpenAI as data processor requires Data Processing Agreement (DPA) — OpenAI provides standard DPAs for API customers
- No children's photos used in marketing without individual signed parental releases

### Technical Constraints

- WhatsApp webhook must respond <5 seconds — image generation MUST be deferred to async queue
- 72-hour free messaging window from click-to-WhatsApp ads (all messages free within window)
- 24-hour customer service window for non-ad conversations (resets per user message)
- WhatsApp Business verification required (2-10 business days) to exceed 250 conversations/day limit
- Template messages required outside messaging windows (need Meta pre-approval, 1-24h turnaround)
- Supabase free tier auto-pauses after 7 days inactivity — must upgrade to Pro ($25/month) before production launch
- Vercel serverless function max duration: 10s hobby, 15s Pro — image generation cannot run inline
- WhatsApp interactive reply buttons limited to 3 options per message (Chat SDK renders as cards)

### Risk Mitigations

- **LGPD:** Consent embedded in conversation flow, auto-delete policy enforced, DPA with OpenAI, privacy policy accessible via link
- **ECA Digital:** Parental authorization text in ToS, photo handling policy documented, marketing materials use only consented images
- **WhatsApp ban risk:** Use ONLY official API via Vercel Chat SDK adapter, task-specific commerce flow only, no general-purpose AI responses
- **AI copyright:** ToS assigns output ownership to buyer, AI generation disclosed as best practice, monitor PL 2338/2023 progress
- **Payment compliance:** MEI registration recommended before scaling past 100 orders/month; upgrade to Simples Nacional when exceeding R$81k/year

## Innovation & Novel Patterns

### Detected Innovation Areas

1. **AI-powered conversational commerce:** Full order lifecycle (lead → payment → generation → delivery → revision) handled by an AI agent within WhatsApp, with human-feel conversation at infinite scale. No verified competitor has deployed this end-to-end automation in the Brazilian mascotinho space.
2. **Artificial empathy at scale:** Deliberate 1-2 minute delays, typing indicators, emoji-rich warm Brazilian Portuguese, and attentive follow-ups create perceived human attention. This UX innovation turns automation into a premium experience — instant delivery would feel cheap; the delay creates production value.
3. **Payment-first trust model:** Before/after portfolio and social proof replace free previews entirely, eliminating cost risk from non-payers while maintaining conversion through emotional trust-building. Zero wasted AI credits on abandoned sessions.
4. **Style template library with popularity ranking:** Pre-tuned prompts per theme ensure consistent quality across orders and enable data-driven optimization — auto-increment popularity counters drive quick-reply button ordering, and A/B testing of prompt templates optimizes first-generation approval rate.

### Market Context & Competitive Landscape

- No verified automated WhatsApp bot competitor in the mascotinho space as of March 2026
- 989+ fragmented manual sellers on Elo7 alone, 128+ specifically in "mascote digital infantil" — no dominant player
- DIY ChatGPT threat validates demand (TikTok flooded with tutorials) but target audience is non-technical mothers who will pay R$29.90 for quality + convenience
- Lensa precedent: $50M+ revenue from AI avatars at $3.99/pack with ~87% margins validates the AI portrait-as-a-service business model
- 12-18 month window for first-mover advantage before market matures; no VC-backed startup has targeted this niche in Brazil

### Validation Approach

- Launch with 5-10 style templates, measure first-generation approval rate (target 70-80%)
- A/B test CPA across different Meta ad creatives (target <R$15 per lead)
- Track conversion rate lead → payment (target 20-30%)
- Monitor revision rate — if >40%, pause ad scaling and improve prompt templates before continuing
- Test R$29.90 price point against R$19.90 and R$39.90 variants within 30 days of launch
- Track Instagram shares/tags as organic growth signal (target 10+ in month 1)

### Risk Mitigation

- **AI quality insufficient:** Fallback to manual generation for edge cases; invest in prompt template refinement; technical spike on GPT Image 1.5 Medium vs High quality
- **WhatsApp policy change:** Architecture supports adding web form as alternative channel; Chat SDK is official API (lowest risk)
- **GPT Image API pricing increase:** Monitor costs per order; have Gemini 3.1 Flash Image as fallback model (comparable Elo score, lower cost at high resolution)
- **Market saturation:** Extensible architecture enables pivot to pet avatars, professional caricatures, couple illustrations within weeks using same infrastructure
- **CPA exceeds R$15:** Test different ad formats (video vs carousel vs static), different audience segments (age, state, interest), different CTA messages

## Web Application Specific Requirements

### Architecture Overview

**Monorepo Structure (Turborepo via Better-T-Stack):**

```
mascotinhos/
├── apps/
│   └── web/                    ← Next.js (landing page + API routes)
│       ├── src/app/            ← Landing page (portfolio, styles, legal, CTAs)
│       └── src/app/api/        ← Webhook endpoints
│           ├── whatsapp/webhook/   ← Chat SDK WhatsApp events
│           └── payments/webhook/   ← Asaas PIX confirmation
│
├── packages/
│   ├── bot-engine/             ← AI SDK Agent + conversation logic + state machine
│   ├── image-gen/              ← GPT Image 1.5 pipeline + quality check
│   ├── payments/               ← Asaas PIX QR + webhook + split
│   └── db/                     ← Prisma schema + Supabase client
```

### Landing Page Requirements

- Portfolio gallery with before/after examples showcasing original photo next to mascotinho (lazy-loaded images, mobile-optimized)
- Style template browser with visual previews per theme (Princesa, Safari, Jardim Encantado, Sereia, Super-Heroi, etc.)
- "How it works" section: 3-step visual flow (send photo → pay via PIX → receive mascotinho in minutes)
- Pricing section with R$29.90 prominent and clear — no hidden costs messaging
- Social proof section: client testimonials, Instagram shares, before/after showcases
- CTA buttons per style → `https://wa.me/55...?text=Oi!+Quero+mascotinho+tema+[style]!` with pre-filled WhatsApp message
- Privacy policy page (LGPD compliant, covering children's data handling, auto-delete policy, DPA disclosure)
- Terms of service page (ECA Digital parental consent, AI generation disclosure, revision policy, delivery obligations)
- Mobile-first responsive design (95%+ of traffic from mobile via Meta ads)
- Target browsers: Mobile Chrome and Safari (iOS), latest 2 versions
- Core Web Vitals: LCP <2.5s, FID <100ms, CLS <0.1
- Accessibility: WCAG 2.1 AA compliance (required by LBI — Lei 13.146/2015)
- SEO: MVP relies on paid Meta ads acquisition; organic SEO optimization deferred to growth phase
- Instagram sharing CTA visible on landing page to reinforce social proof loop

### API Endpoint Requirements

- `POST /api/whatsapp/webhook` — receives Chat SDK WhatsApp events, must respond <5s with 200 OK, defers all business logic to async queue
- `POST /api/payments/webhook` — receives Asaas PIX payment confirmations, verifies webhook signature, triggers generation pipeline
- Both endpoints: idempotent (handle duplicate webhook deliveries), webhook signature verification, structured error logging, retry-safe

### Technical Stack Details

- **Runtime:** Next.js on Vercel (serverless functions, SP region for Brazil latency)
- **WhatsApp:** Vercel Chat SDK + @chat-adapter/whatsapp (March 2026 release) — official WhatsApp Business API
- **AI Agent:** Vercel AI SDK v6 ToolLoopAgent + GPT-5-mini ($0.125/$1.00 per 1M input/output tokens) for conversation orchestration
- **Image Gen:** OpenAI GPT Image 1.5 High quality 1024x1024 ($0.133/image) via base64-encoded reference photo input
- **Payments:** Asaas API — dynamic PIX QR codes, webhook confirmation (<1s latency), partner split support, 100 free transactions/month then R$1.99/tx
- **Database:** Supabase Postgres + Prisma ORM (conversation state, orders, clients, payments, generations, style templates)
- **Storage:** Supabase Storage for both reference photos (30-day TTL auto-delete) and generated images (permanent, client property)
- **Background Jobs:** Async queue for image generation (Vercel Queues beta or Upstash) to meet webhook <5s constraint
- **Monorepo:** Turborepo for build orchestration across packages

### Database Schema (Core Models)

- **Client** — id, whatsapp_sender_id (indexed, unique), name, phone, consent_timestamp, consent_version, created_at, updated_at
- **Order** — id, client_id (FK), style_template_id (FK), status (enum: `pending_photos`, `pending_theme`, `pending_outfit`, `confirming_order`, `pending_payment`, `generating`, `delivered`, `revision_1`, `revision_2`, `completed`, `abandoned`, `failed`), photos_urls[] (Supabase Storage references), theme, outfit_description, extra_requests, price, created_at, updated_at
- **Payment** — id, order_id (FK), asaas_id (unique), pix_qr_code, pix_qr_image_url, amount, status (enum: `pending`, `confirmed`, `failed`, `refunded`), confirmed_at, created_at
- **Generation** — id, order_id (FK), attempt_number, prompt_used (full text for debugging), image_url (Supabase Storage), quality_score (AI self-critique), revision_feedback (client's natural language request), created_at
- **StyleTemplate** — id, name, slug (unique), prompt_template, example_images[] (Supabase Storage URLs), popularity (auto-increment per order), tags[], active (boolean), product_type (enum: `mascotinho`, future: `caricatura`, `pet_avatar`, `convite`)

### Conversation State Machine

```
GREETING → COLLECTING_PHOTOS → COLLECTING_THEME → COLLECTING_OUTFIT → CONFIRMING_ORDER
→ AWAITING_PAYMENT → [ABANDONED_CART_1H | ABANDONED_CART_24H] → GENERATING
→ DELIVERING → AWAITING_FEEDBACK → [REVISION_1 → GENERATING] → [REVISION_2 → GENERATING]
→ COMPLETED
```

State persisted in Supabase Postgres, indexed by WhatsApp sender ID. Loaded per webhook event, updated after each agent response. Conversation history stored alongside state for AI SDK agent context loading.

## Functional Requirements

### Lead Capture & Onboarding

**FR-01:** A prospective client clicking a Meta click-to-WhatsApp ad arrives in a WhatsApp conversation with a pre-filled message containing their selected style theme.

**FR-02:** The bot responds within 3 seconds of receiving the first message with a warm greeting, a before/after portfolio carousel, the R$29.90 price, and social proof (e.g., "Ja fizemos mais de X mascotinhos!").

**FR-03:** The bot presents available style templates as quick-reply buttons (up to 3 per message, top styles by popularity), plus an "Outro tema" free-text fallback option.

**FR-04:** The bot captures inline LGPD consent when the client sends a photo: "Ao enviar a foto, voce consente com o uso para geracao da arte conforme nossos Termos de Uso e Politica de Privacidade [link]."

### Conversation Management

**FR-05:** The AI agent responds in informal Brazilian Portuguese (tu/voce forms), includes emoji in >50% of messages, uses warm closing phrases (e.g., "com carinho", "fico feliz"), and sends typing indicators before each response — maintaining this personality consistently throughout all interactions.

**FR-06:** The bot persists conversation state in Supabase Postgres indexed by WhatsApp sender ID, enabling seamless resume after interruptions (e.g., client goes silent for hours then returns).

**FR-07:** The bot handles out-of-scope messages gracefully (e.g., "Quanto custa?" mid-flow) by answering the question and returning to the current conversation state.

**FR-08:** The bot sends typing indicators before each response to simulate human interaction timing.

**FR-09:** The bot loads full conversation history from the database on each webhook event to maintain context across the multi-turn flow.

### Photo & Input Collection

**FR-10:** The bot collects 1-3 reference photos of the child via WhatsApp image messages and stores them in Supabase Storage with 30-day TTL metadata.

**FR-11:** The bot accepts a theme selection via quick-reply button tap or free-text input.

**FR-12:** The bot collects optional outfit/clothing description (text or reference image) for inclusion in the generation prompt.

**FR-13:** The bot collects optional extra requests (e.g., "add a balloon with number 1", "include the family dog") as free-text input.

**FR-14:** The bot presents an order summary for confirmation before payment: child's name, theme, outfit description, extra requests, price (R$29.90).

**FR-15:** The bot detects photos below 500x500px resolution or visibly unsuitable for generation (dark, heavily occluded face) and requests a clearer photo: "A foto ficou um pouco escura/embaçada. Consegue enviar uma com mais luz/nitidez?"

### Payment Processing

**FR-16:** Upon order confirmation, the bot generates a dynamic PIX QR code via Asaas API and sends it inline in the WhatsApp conversation.

**FR-17:** The system receives Asaas payment webhook confirmations within 5 seconds and triggers the image generation pipeline.

**FR-18:** The bot confirms payment receipt to the client: "Pagamento confirmado! Vou comecar a preparar sua arte agora."

**FR-19:** The system supports Asaas partner payment split, configured at payment creation time.

**FR-20:** The system handles failed/expired PIX payments gracefully, offering to regenerate the QR code.

### Image Generation & Delivery

**FR-21:** The bot enriches client inputs (photos, theme, outfit, extras) into a structured prompt using the selected StyleTemplate's prompt_template and GPT-5-mini.

**FR-22:** The system generates the mascotinho image via OpenAI GPT Image 1.5 High (1024x1024) using base64-encoded reference photo input, executed asynchronously in a background queue.

**FR-23:** The system runs an AI quality self-check on the generated image (comparing output vs input photo + prompt) before delivery.

**FR-24:** The bot holds the completed image for a 1-2 minute artificial delay with typing indicators and warm status messages ("Estou finalizando sua arte com carinho...") to create perceived production value.

**FR-25:** The bot delivers the mascotinho as a WhatsApp photo (instant viewing) followed by the same image as a WhatsApp document (full-resolution download). No PDF.

**FR-26:** The system stores the generated image permanently in Supabase Storage and records the generation attempt (prompt used, image URL, quality score) in the Generation table.

**FR-27:** The system auto-retries failed generations up to 2 times with exponential backoff before marking the order as failed.

### Revision Handling

**FR-28:** After delivery, the bot asks "Gostou? Posso ajustar algo? (2 ajustes inclusos)" with reply buttons: "Amei!" / "Quero ajustar".

**FR-29:** The bot accepts natural language revision feedback (e.g., "olhos mais escuros", "so tem dois dentes na frente") and re-enriches the prompt with the concrete adjustment.

**FR-30:** The bot supports up to 2 revision rounds per order. After revision 2, the bot delivers the final version and closes: "Essa e a versao final! Espero que tenha amado."

**FR-31:** Each revision goes through the same async generation pipeline (queue → generate → quality check → artificial delay → deliver).

**FR-32:** The system tracks revision count per order and stores revision feedback in the Generation table for prompt template optimization.

### Abandoned Cart Recovery

**FR-33:** If a client goes silent for 1.5 hours during any pre-payment state, the bot sends a gentle nudge: "Oi [name]! Vi que voce comecou a criar o mascotinho. Posso te ajudar com algo?"

**FR-34:** If a client does not respond within 24 hours of the nudge (or 24 hours after payment QR was sent), the bot sends a graceful closure: "Tudo bem! Se mudar de ideia, estou aqui. So me chamar!"

**FR-35:** The system marks abandoned conversations with the appropriate status (`abandoned`) and timestamps for analytics.

**FR-36:** A returning client who was previously abandoned can restart the flow from where they left off (state persisted in database).

### Style Template Management

**FR-37:** The system supports a StyleTemplate entity with: name, slug, prompt_template, example_images[], popularity counter, tags[], active flag, and product_type field.

**FR-38:** Style template popularity auto-increments when a client selects that template for an order.

**FR-39:** Quick-reply buttons display the top styles sorted by popularity (descending), ensuring the most popular themes are always surfaced first.

**FR-40:** The operator can create, update, activate/deactivate, and test style templates via direct database operations (MVP — no admin UI).

### Landing Page

**FR-41:** The landing page displays a before/after portfolio gallery showing original child photos alongside their mascotinho illustrations (with parental consent for displayed images).

**FR-42:** The landing page provides a style template browser where visitors can preview available themes with example images.

**FR-43:** Each style on the landing page has a CTA button that opens WhatsApp with a pre-filled message specific to that style.

**FR-44:** The landing page includes a privacy policy page and terms of service page accessible from the footer and linked in bot conversations.

**FR-45:** The landing page renders correctly on mobile devices (responsive, mobile-first) with Core Web Vitals passing (LCP <2.5s, FID <100ms, CLS <0.1).

### Compliance & Privacy

**FR-46:** The system auto-deletes reference photos from Supabase Storage 30 days after order completion via scheduled cleanup job.

**FR-47:** The system logs consent timestamps per client (when they sent their first photo after consent message) in the Client table.

**FR-48:** The system does not share, reuse, or cross-reference client photos between different orders or clients.

### Operator Tools

**FR-49:** The operator can query order status, revenue, and conversion metrics via Supabase dashboard SQL queries (MVP — no custom admin UI).

**FR-50:** The operator can manually intervene on stuck/failed orders by sending direct WhatsApp messages to clients outside the bot flow.

**FR-51:** The operator can seed, edit, and test style templates directly in the database, with changes reflected in the bot's quick-reply buttons on the next conversation.

### Post-Delivery Engagement

**FR-52:** After the client approves the final mascotinho, the bot sends a closing CTA: "Se postar no Instagram, marca a gente @mascotinhos!" with a referral suggestion for friends.

## Non-Functional Requirements

### Performance

- **NFR-01:** WhatsApp webhook endpoint responds with 200 OK in <5 seconds for 100% of requests. All business logic deferred to async queue.
- **NFR-02:** Image generation completes in <2 minutes end-to-end (prompt enrichment + API call + quality check + storage upload), excluding artificial delay.
- **NFR-03:** Payment webhook (Asaas) processes and triggers generation pipeline in <5 seconds after receipt.
- **NFR-04:** Landing page achieves Core Web Vitals green: LCP <2.5s, FID <100ms, CLS <0.1 on mobile (3G throttled).
- **NFR-05:** Conversation state load from Supabase completes in <500ms per webhook event.
- **NFR-06:** Bot response latency (from webhook receipt to WhatsApp message sent, excluding artificial delay) <3 seconds for text responses.

### Security

- **NFR-07:** WhatsApp webhook endpoint verifies Chat SDK webhook signature on every request; rejects unsigned/invalid requests with 401.
- **NFR-08:** Asaas payment webhook endpoint verifies Asaas webhook signature; rejects unsigned requests.
- **NFR-09:** Reference photos stored in Supabase Storage with private bucket policy — no public URL access. Signed URLs used for API access only.
- **NFR-10:** Database credentials, API keys (OpenAI, Asaas, WhatsApp), and webhook secrets stored as Vercel environment variables; never committed to source code.
- **NFR-11:** LGPD data handling: reference photos auto-deleted after 30 days, consent timestamps recorded, privacy policy accessible, DPA with OpenAI in place.
- **NFR-12:** No PII logged in application logs — phone numbers and names redacted in error reporting.

### Scalability

- **NFR-13:** System supports 100 orders/month on Supabase free tier (with upgrade to Pro before reaching 50 orders/month to prevent auto-pause risk).
- **NFR-14:** System supports 1,000 orders/month on Supabase Pro ($25/month) + Vercel Pro without architectural changes.
- **NFR-15:** Async queue supports concurrent image generation without blocking webhook responses. Queue depth monitored; alert at >10 pending jobs.
- **NFR-16:** WhatsApp Business verification completed before launch to support >250 conversations/day (verified = 100,000 conversations/day).
- **NFR-17:** GPT Image API rate limits monitored; exponential backoff + user queue implemented to handle burst traffic without dropped orders.

### Availability & Reliability

- **NFR-18:** Bot uptime >99% measured monthly (Vercel serverless SLA).
- **NFR-19:** Failed image generations auto-retry up to 2 times with exponential backoff before marking order as failed.
- **NFR-20:** Asaas webhook retries (5 retries with exponential backoff) handled idempotently — no duplicate orders or payments on retry.
- **NFR-21:** Database backup: Supabase automatic daily backups (Pro tier). Point-in-time recovery available.

### Integration Reliability

- **NFR-22:** WhatsApp Business API: system handles 24-hour window expiration gracefully — queues messages for template delivery if window closed.
- **NFR-23:** Asaas API: system handles API downtime with retry logic; payment QR regeneration offered to client if initial generation fails.
- **NFR-24:** OpenAI API: system handles rate limits and transient errors with exponential backoff; order remains in `generating` state until successful or exhausts retries.
- **NFR-25:** Supabase: connection pooling configured to handle concurrent webhook events; PgBouncer enabled for production.

### Observability

- **NFR-26:** Structured logging for all webhook events, payment confirmations, generation attempts, and delivery confirmations.
- **NFR-27:** Error tracking (Sentry or equivalent) for failed generations, webhook errors, and payment failures with context (order ID, client ID, error type).
- **NFR-28:** Key business metrics queryable from database: orders/day, conversion rate, revision rate, average generation time, revenue, CPA (when ad data integrated).

### Accessibility

- **NFR-29:** Landing page meets WCAG 2.1 AA compliance as measured by Lighthouse accessibility audit score ≥90. Required by LBI (Lei 13.146/2015) for public-facing web content in Brazil.

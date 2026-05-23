---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: [EX1.pdf, EX2.pdf, EX3.pdf, EX4.pdf]
session_topic: 'Automating the Mascotinhos business - AI-generated personalized children illustrations sold via WhatsApp'
session_goals: 'Architect an extensible MVP platform that automates lead handling, sales conversations, payment collection, AI image generation, and delivery - designed for future AI photo product lines'
selected_approach: 'ai-recommended'
techniques_used: ['first-principles-thinking', 'morphological-analysis', 'cross-pollination']
ideas_generated: 30+
session_active: false
workflow_completed: true
pricing: 'R$29.90 per mascotinho'
---

## Session Overview

**Topic:** Automating the Mascotinhos business - AI-generated personalized children/pet illustrations sold via WhatsApp, architected for extensibility to other AI photo products.

**Goals:**
- Automate the most time-consuming parts (lead qualification, sales conversations, payment, generation, delivery)
- Build with staff-engineer extensibility so new AI photo products can be added later
- Ship an MVP fast — identify what to automate first vs. what stays manual

### Context Guidance

_Analyzed 4 real WhatsApp sales conversations showing a highly predictable state-machine flow: lead arrives from Meta ads -> templated greeting -> collect photos + theme + clothing -> generate image -> preview for approval -> revision loop -> PIX payment -> delivery. Price point R$10 (test only), high volume._

---

## Technique Selection

**Approach:** AI-Recommended Techniques
**Analysis Context:** System architecture + business automation with extensibility goals

**Recommended Techniques:**
- **First Principles Thinking:** Strip away assumptions, find fundamental truths of the business
- **Morphological Analysis:** Map all system dimensions and explore automation combinations
- **Cross-Pollination:** Steal battle-tested patterns from adjacent industries

---

## Phase 1: First Principles — 9 Fundamental Truths

### FP1: The WhatsApp Conversation IS the Product
The target audience is non-technical — they can't use ChatGPT themselves. The conversation isn't friction, it's perceived value. They're paying for the experience of someone caring about their child's illustration. The bot needs to feel human at scale: emoji-rich, warm, casual Brazilian Portuguese.

### FP2: Revisions Are Prompt Engineering, Not Art
Client corrections are always concrete: "olhos mais escuros," "so tem dois dentes na frente." These are prompt tweaks, not artistic judgment. Fully automatable. Limit to 2 revision rounds for clear expectations.

### FP3: Payment FIRST, Then Generate
Flip the original flow. Don't generate free previews — build trust through portfolio/examples/social proof, collect payment, THEN generate. Zero wasted AI credits on non-payers. Revisions (1-2 max) happen post-payment.

### FP4: Meta Ads Are THE Channel (MVP)
Click-to-WhatsApp Meta ads are the proven lead source. Most competitors use only organic reach — running actual paid ads puts you ahead of 90% of sellers. Future: automate competitor ad analysis + AI-generate ad creatives.

### FP5: Single Image MVP, Package Architecture Ready
MVP sells one mascotinho image at R$29.90. But architect the "product" as a configurable entity so you can later add: mascotinho + convite + lembrancinha tag + sticker pack as higher-tier bundles.

### FP6: Artificial Delay = Perceived Value
Even if generation takes 15 seconds, add 1-2 minute "production" delay. "Estou preparando sua arte com carinho" + typing indicator feels premium. Instant feels cheap.

### FP7: PIX Fully Automated via Asaas API
Asaas is the best option for pessoa fisica: 100 free PIX/month, payment split support (both parties need Asaas accounts), webhooks for auto-confirmation. Auto-generate PIX QR code, webhook confirms payment, triggers generation pipeline.

### FP8: Ad Creative Pipeline Is Automatable (Future)
Scrape Meta Ad Library for winning mascotinho ads, analyze patterns with AI, generate variations. Not MVP but a strong competitive advantage for later.

### FP9: Portfolio/Examples Are the Trust Mechanism
Instead of free previews, invest in a curated before/after portfolio. Show in the first message. Social proof replaces free work.

---

## Phase 2: Morphological Analysis — System Architecture

### Automated State Machine Flow

```
META AD CLICK → WhatsApp auto-message arrives
    |
[1] GREET: AI bot sends warm greeting + portfolio examples + price + social proof
    |
[2] COLLECT: Bot asks for photo(s) + theme (quick-reply buttons for popular styles) + outfit
    |
[3] CONFIRM: Bot summarizes order → "Perfeito! Para iniciar a producao..."
    |
[4] PAYMENT: Asaas API generates PIX QR → sends in WhatsApp → webhook waits
    |                                                    |
    |                              [ABANDONED CART: 1.5h nudge, 24h closure]
    |
[5] WEBHOOK: Payment confirmed → triggers generation pipeline
    |
[6] ENRICH: LLM takes client inputs → structured generation prompt (using style template)
    |
[7] GENERATE: OpenAI GPT Image 1.5 API → mascotinho image
    |
[8] QC: AI self-critique check (compare output vs input photo + prompt)
    |
[9] DELAY: 1-2 min artificial wait → "Estou finalizando sua arte com carinho"
    |
[10] DELIVER: Auto-send image via WhatsApp
    |
[11] FEEDBACK: "Gostou? Posso ajustar algo? (max 2 ajustes inclusos)" [reply buttons]
    |           |
    |     [REVISE]: Client describes change → re-enrich → re-generate → deliver (max 2x)
    |
[12] CLOSE: "Muito obrigada! Se conhece alguem que ia amar, compartilha!"
            + request Instagram share/tag
```

### Tech Stack Decision

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **WhatsApp Transport** | Vercel Chat SDK + `@chat-adapter/whatsapp` | Native AI SDK integration, reply buttons, multi-media, multi-platform future |
| **Bot Brain** | Vercel AI SDK (Agent class + tools), GPT-5-mini | Conversational AI agent with tool calling, multi-model testing. GPT-5-mini for best PT-BR quality at lowest cost |
| **Image Generation** | OpenAI GPT Image 1.5 API (via AI Gateway) | $0.034-0.133/image, reference photo input, 4x faster |
| **Payments** | Asaas API | PIX for pessoa fisica, split support, webhooks, 100 free/month |
| **Database** | Supabase Postgres + Prisma | Orders, clients, payments, generation history, style templates |
| **Monorepo** | Turborepo (via Better-T-Stack scaffold) | Clean package boundaries for extensibility |
| **WhatsApp Costs** | FREE via click-to-WhatsApp ads (72h window) | Only marketing msgs outside window cost R$0.36/msg |

### Monorepo Architecture

```
fotos/                              ← project root (this folder)
├── packages/bot-engine/            ← AI SDK Agent + conversation logic
│   ├── Agent definition (tools, instructions, personality)
│   ├── Prompt enrichment (client inputs → structured gen prompt)
│   └── State machine (greet → collect → pay → generate → deliver → revise)
│
├── packages/image-gen/             ← OpenAI GPT Image 1.5 pipeline
│   ├── Generation from photo + prompt template
│   ├── AI quality self-critique
│   └── Revision handling (max 2 rounds)
│
├── packages/payments/              ← Asaas API integration
│   ├── PIX QR code generation
│   ├── Payment webhook handler
│   └── Split configuration (partner)
│
├── packages/whatsapp/              ← Chat SDK WhatsApp adapter
│   ├── Receive messages + images
│   ├── Send messages + images + QR codes
│   └── Reply buttons, typing indicators, read receipts
│
├── packages/database/              ← Prisma + Supabase
│   ├── Order model (status state machine)
│   ├── Client model
│   ├── Payment model
│   ├── Generation model (prompt history, images)
│   └── StyleTemplate model (curated prompt templates)
│
└── apps/api/                       ← Next.js API routes (webhooks)
    ├── POST /api/whatsapp/webhook
    ├── POST /api/payments/webhook
    └── (future) Admin dashboard app
```

### Style Template Library

```
StyleTemplate {
  id
  name: "Jardim Encantado"
  slug: "jardim-encantado"
  promptTemplate: "Create a cute cartoon mascot of this child in an enchanted garden..."
  exampleImages: [url1, url2]
  popularity: 847  // auto-incremented per order
  tags: ["floral", "butterfly", "green", "pink"]
  active: true
  productType: "mascotinho"  // extensible to other product types
}
```

Bot uses quick-reply buttons for top 5 styles by popularity. "Outro tema" falls back to free-text.

### Cost Per Order — Full Scenarios (GPT-5-mini conversation + GPT Image 1.5 High)

**AI Model Pricing (per 1M tokens):**
- GPT-5-mini (conversation): $0.125 input / $1.00 output
- GPT Image 1.5 (generation): $0.133/image (High, 1024x1024) + $8.00/1M image input tokens
- Asaas PIX: Free first 100/month, then R$1.99/transaction flat fee

| Component | Best Case | Medium Case | Worst Case |
|-----------|-----------|-------------|------------|
| | _Quick, approves 1st_ | _Some chat, 1 revision_ | _Very chatty, 2 revisions_ |
| **Conversation (5-mini)** | 5 exchanges: $0.002 | 12 exchanges: $0.004 | 20 exchanges: $0.009 |
| **Prompt enrichment (5-mini)** | 1 call: $0.0004 | 2 calls: $0.0008 | 3 calls: $0.0012 |
| **AI quality check (5-mini)** | 1 call: $0.0003 | 2 calls: $0.0006 | 3 calls: $0.0009 |
| **Image input tokens** | 1 gen: $0.016 | 2 gens: $0.032 | 3 gens: $0.048 |
| **Text input for gen** | 1 call: $0.005 | 2 calls: $0.010 | 3 calls: $0.015 |
| **Image output (High)** | 1x: $0.133 | 2x: $0.266 | 3x: $0.399 |
| | | | |
| **TOTAL USD (AI only)** | **$0.157** | **$0.313** | **$0.473** |
| **TOTAL BRL (AI only)** | **R$0.91** | **R$1.82** | **R$2.74** |
| | | | |
| **With free PIX (<=100/mo)** | **R$0.91** | **R$1.82** | **R$2.74** |
| **With paid PIX (>100/mo)** | **R$2.90** | **R$3.81** | **R$4.73** |
| | | | |
| **Revenue** | R$29.90 | R$29.90 | R$29.90 |
| **Profit (free PIX)** | **R$28.99 (97%)** | **R$28.08 (94%)** | **R$27.16 (91%)** |
| **Profit (paid PIX)** | **R$27.00 (90%)** | **R$26.09 (87%)** | **R$25.17 (84%)** |

**Notes:**
- Image output (High quality) is 85%+ of total AI cost in every scenario
- Conversation cost with GPT-5-mini is essentially free (~R$0.05 worst case)
- Asaas R$1.99/PIX is the biggest non-AI cost after free tier
- At 100 orders/month (free tier limit): ~R$2,700+ profit before ad spend
- **WhatsApp API: FREE** — all leads from click-to-WhatsApp ads get 72h free messaging window. Entire flow completes within this window. Non-converting leads cost R$0.00 in WhatsApp fees (only ~R$0.03-0.05 AI tokens). Only marketing msgs outside window cost R$0.36/msg (abandoned cart after 72h, holiday broadcasts).

---

## Phase 3: Cross-Pollination — Stolen Patterns

### From Print-on-Demand (Printful, Gelato)
- **Product Ladder:** R$29.90 (1 image) → R$49.90 (+ convite) → R$79.90 (kit festa). Same photo input, different prompt templates.
- **Style Template Library:** Pre-tuned prompts per theme. Consistent quality, faster generation.

### From AI Avatar Services (Lensa, Dawn AI)
- **3 Variations Instead of Revisions:** Generate 3 options upfront, client picks favorite. Eliminates revision loop. Test vs current approach.
- **"Magic Pack" Virality:** Closing message encourages Instagram sharing: "marca a gente @mascotinhos!"

### From Chatbot Commerce (ManyChat, Respond.io)
- **Quick Reply Buttons:** Structured input via Chat SDK reply buttons instead of free-text. Reduces friction.
- **Abandoned Cart Recovery:** PIX not paid after 1.5h → gentle nudge. After 24h → closure message. Two-touch, not spammy.

### From Canva / Design-on-Demand
- **Before/After Social Proof:** Portfolio shows original photo next to mascotinho. Most powerful trust-builder.

### From Brazilian Digital Sellers (Hotmart/Kiwify)
- **Holiday Broadcast:** Before Dia das Criancas, Natal, Carnaval → themed offers to past clients at discount.
- **Referral Engine:** Post-delivery: "Indica pra uma amiga e voces duas ganham R$5 de desconto!"

---

## Market Research Findings

### Pricing Landscape
| Segment | Price | Our Position |
|---------|-------|-------------|
| WhatsApp sellers (AI) | R$10-30 | Top of segment |
| Elo7 marketplace | R$30-75 | Bottom of segment |
| Custom illustration studios | R$75-150+ | Below this tier |
| **Our price: R$29.90** | **Marketplace quality at WhatsApp speed** | **Strong value proposition** |

### Competition Analysis
- Most sellers use **organic reach only** (Instagram, TikTok) — running paid Meta ads = instant advantage
- Nobody is transparent about using AI — marketed as "meu metodo"
- DIY threat exists (TikTok tutorials) but target audience is non-technical moms who want the service
- Character consistency is the #1 quality issue — our template library solves this

### Future Product Lines (Extensibility Validation)
| Product | Demand | Priority | Timing |
|---------|--------|----------|--------|
| Pet avatars/portraits | Very High (viral) | HIGH | Near-term |
| Professional caricatures | VIRAL PEAK NOW | URGENT | 12-month window |
| Couple avatars | Seasonal | MEDIUM | Seasonal launches |
| Family avatar sets | Growing | LOW | After MVP stable |
| Corporate mascots (B2B) | Moderate-High | FUTURE | 24-month horizon |

---

## Prioritized Action Plan

### MVP — Must Have (Week 1-3)

1. **Scaffold monorepo** with Better-T-Stack (Next.js + Prisma + Supabase + Turborepo)
2. **WhatsApp integration** via Chat SDK + `@chat-adapter/whatsapp`
3. **AI bot agent** using AI SDK Agent class with tools for the full conversation flow
4. **Asaas payment** integration — PIX QR generation + webhook confirmation + partner split
5. **Image generation pipeline** — OpenAI GPT Image 1.5 with prompt enrichment + quality check
6. **Style template library** — seed with 5-10 popular themes from real orders
7. **Portfolio/examples** — curate before/after images for the greeting message
8. **Artificial delay** — 1-2 min production feel with typing indicators

### Quick Wins (Week 3-4)

9. **Reply buttons** for style selection (top 5 + "Outro")
10. **Abandoned cart** — 1.5h nudge + 24h closure via scheduled messages
11. **Instagram sharing CTA** in closing message
12. **Order tracking** in database (for future dashboard)

### Growth (Month 2-3)

13. **Product ladder** — add convite + kit festa bundles
14. **3-variations approach** — A/B test vs revision loop
15. **Referral codes** with discount tracking
16. **Holiday broadcasts** to past client list

### Future (Month 3+)

17. **Professional caricatures** as second product line (URGENT — trend peaking)
18. **Pet avatars** as third product line
19. **Admin dashboard** for order management and analytics
20. **Ad creative automation** — competitor analysis + AI-generated ads

---

## Session Summary

**Techniques Used:** First Principles Thinking, Morphological Analysis, Cross-Pollination
**Key Breakthrough:** The conversation IS the product — not friction to eliminate, but the core value proposition to automate with human-feel AI.

**Critical Architecture Decisions Made:**
1. Payment-first model (zero cost risk)
2. Chat SDK for WhatsApp (multi-platform future)
3. AI SDK Agent for bot brain (tool-calling, model-swappable)
4. Style template library (quality consistency + extensibility)
5. Asaas for PIX (pessoa fisica + split + free tier)
6. Better-T-Stack monorepo (extensible for future products)

**Unit Economics:** R$29.90 price, ~R$2.88 worst-case cost = ~90% margin before ad spend.

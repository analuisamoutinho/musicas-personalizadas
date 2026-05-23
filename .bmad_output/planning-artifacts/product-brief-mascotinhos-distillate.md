---
title: "Product Brief Distillate: Mascotinhos"
type: llm-distillate
source: "product-brief-mascotinhos.md"
created: "2026-03-27"
purpose: "Token-efficient context for downstream PRD creation"
---

# Product Brief Distillate: Mascotinhos

## Rejected Ideas (with rationale)

- **Generate before payment (free preview):** Rejected -- creates cost risk from non-payers. Payment-first model uses portfolio/social proof to build trust instead. Zero wasted AI credits.
- **Freemium model:** Rejected -- 3-10% conversion rates not suitable for transactional product. R$29.90 IS the conversion mechanism (impulse price).
- **General-purpose AI chatbot personality:** Rejected -- WhatsApp banned general-purpose AI bots (Oct 2025, enforced Jan 2026). Task-specific commerce bots explicitly allowed.
- **Unofficial WhatsApp automation (ManyChat-style web scraping):** Rejected -- Meta enforcing official API only from Jan 2026. Gray-market tools will break.
- **LoRA fine-tuning for MVP:** Rejected -- adds complexity and training time. System prompt engineering sufficient for MVP. LoRA is V2 for branded house style.
- **3-variation approach (generate 3, pick favorite):** Deferred -- promising but untested. Current revision loop (max 2) is simpler. A/B test in V2.
- **Web-based order form:** Rejected for MVP -- adds a channel to maintain. WhatsApp IS the product experience. Web form is future.
- **Multiple product types in MVP:** Rejected -- focus on mascotinho infantil only. Architecture supports extensibility but MVP ships one product.
- **Organic marketing in MVP:** Rejected -- paid Meta ads are the proven channel. Organic content (Instagram/TikTok reels) is growth phase.

## Requirements Hints

- Bot must feel human: emoji-rich, warm, casual Brazilian Portuguese. "The conversation IS the product" -- not friction to eliminate but the core value proposition to automate with human-feel AI.
- Quick-reply buttons for top 5 styles by popularity + "Outro tema" free-text fallback
- Artificial delay of 1-2 minutes between generation completion and delivery. "Estou preparando sua arte com carinho" + typing indicator. Instant feels cheap.
- Max 2 revision rounds per order. Revisions are concrete prompt tweaks ("olhos mais escuros", "so tem dois dentes na frente"), fully automatable.
- Abandoned cart: 1.5h nudge, 24h closure. Two-touch, not spammy.
- Post-delivery CTA: request Instagram share/tag @mascotinhos + referral suggestion
- Photo quality guidance: instruct customers on ideal photo specs to maximize output quality
- LGPD consent capture inline in bot flow, not a separate step. "Ao enviar a foto, voce consente..."
- Privacy policy accessible via link in conversation
- Auto-delete reference photos 30 days after delivery
- ECA Digital: explicit parental consent for commercial use of child's image. Since parent orders, consent is inherent but must be legally explicit in ToS.
- Before/after portfolio in greeting message = primary trust mechanism (replaces free previews)
- Style template entity: id, name, slug, promptTemplate, exampleImages, popularity (auto-incremented), tags, active, productType
- Order tracking in database from day 1 (for future dashboard even if not built yet)
- SLA: "Entrega em ate 30 minutos" as product promise, not just technical capability
- 1 revision included as baseline; manages expectations and prevents disputes
- Upsell architecture in data model from day 1, even if not exposed in MVP UI

## Technical Context

**Stack:**
- WhatsApp transport: Vercel Chat SDK + `@chat-adapter/whatsapp` (launched March 11, 2026)
- Bot brain: Vercel AI SDK v6 ToolLoopAgent + GPT-5-mini (best PT-BR quality at lowest cost, $0.125/$1.00 per 1M input/output tokens)
- Image generation: OpenAI GPT Image 1.5 API, High quality 1024x1024, $0.133/image
- Image input: Base64-encoded (more reliable than URL-based for reference photos)
- Payments: Asaas API -- PIX QR dynamic codes, 100 free transactions/month then R$1.99/tx, split support (both parties need Asaas accounts), webhook retry 5x exponential backoff, <1s latency
- Database: Supabase Postgres + Prisma. Free tier: 500MB DB, 1GB storage, auto-pauses after 7 days inactivity (NOT production-ready -- upgrade to Pro $25/mo before launch)
- Image storage: Vercel Blob for generated mascots (CDN-optimized, permanent), Supabase Storage for temporary user reference photos (deleted after delivery)
- Monorepo: Turborepo via Better-T-Stack scaffold
- Background jobs: Vercel Queues (beta) or Upstash for async image generation (webhook must respond in <5s)
- Conversation state: Supabase PostgreSQL, indexed by WhatsApp sender ID, loaded per webhook event

**Architecture (monorepo packages):**
- `packages/bot-engine/` -- AI SDK Agent, conversation logic, state machine, prompt enrichment
- `packages/image-gen/` -- GPT Image 1.5 pipeline, quality self-critique, revision handling
- `packages/payments/` -- Asaas PIX QR generation, webhook handler, split config
- `packages/whatsapp/` -- Chat SDK adapter, message send/receive, reply buttons, typing indicators
- `packages/database/` -- Prisma schema (Order, Client, Payment, Generation, StyleTemplate)
- `apps/api/` -- Next.js API routes (POST /api/whatsapp/webhook, POST /api/payments/webhook)

**Rate limits:**
- WhatsApp: unverified = 250 conversations/24h; verified = 100,000/24h. Business verification takes 2-10 days.
- GPT Image API: tier-based RPM, scales with payment history
- Asaas: 100 free PIX/month, unlimited after (R$1.99/tx)

**Critical constraints:**
- WhatsApp webhook must respond within 5 seconds (defer image generation to async queue)
- 72-hour free entry point window from click-to-WhatsApp ads (all messages free within window)
- 24-hour customer service window for non-ad-originated conversations
- Template messages required outside windows (need Meta pre-approval, 1-24h)
- Supabase free tier auto-pauses after 7 days -- must upgrade before launch
- Vercel serverless max duration: 10s hobby, 15s pro

**Development effort estimate:** 15-25 days (3-week accelerated, 4-5 weeks realistic with testing)

## Detailed User Scenarios

**Happy path (best case -- R$0.91 cost):**
1. Mom sees click-to-WhatsApp Meta ad showing before/after mascotinho
2. Clicks ad, arrives in WhatsApp conversation
3. Bot greets warmly with portfolio examples + price (R$29.90) + social proof
4. Mom sends child's photo
5. Bot presents 5 style quick-reply buttons (e.g., "Jardim Encantado", "Astronauta", "Princesa")
6. Mom taps style button + optionally adds outfit/detail preferences
7. Bot summarizes order, generates PIX QR via Asaas, sends inline
8. Mom pays via PIX (instant)
9. Asaas webhook confirms payment (<1s)
10. Bot enriches inputs into structured prompt, calls GPT Image 1.5, runs AI quality check
11. 1-2 minute artificial wait with "Estou finalizando sua arte com carinho" + typing indicator
12. Mascotinho delivered via WhatsApp image
13. Bot asks "Gostou? Posso ajustar algo? (max 2 ajustes inclusos)" with reply buttons
14. Mom approves
15. Closing: "Muito obrigada! Se conhece alguem que ia amar, compartilha! marca a gente @mascotinhos!"

**Revision path (medium case -- R$1.82 cost):**
- Steps 1-12 same as above
- Mom requests "olhos mais escuros" via reply
- Bot re-enriches prompt with adjustment, re-generates, re-delivers
- Mom approves on second attempt

**Worst case (chatty, 2 revisions -- R$4.73 cost with paid PIX):**
- Extended conversation (20 exchanges vs 5)
- 2 full revision rounds
- PIX transaction beyond free tier

**Abandoned cart:**
- Mom receives PIX QR but doesn't pay
- 1.5h later: gentle nudge ("Oi! Vi que voce ainda nao concluiu o pagamento...")
- 24h later: closure ("Tudo bem! Se mudar de ideia, estou aqui")
- Cost: R$0.03-0.05 AI tokens only (WhatsApp messages free within 72h window)

## Competitive Intelligence

**Pricing tiers in market:**
| Segment | Price Range | Delivery |
|---|---|---|
| WhatsApp sellers (AI-assisted, informal) | R$10-30 | Same-day to 3 days |
| Elo7 marketplace sellers (manual) | R$30-90 typical, up to R$270 | 2-7 business days |
| Instagram/TikTok artists (manual) | R$30-150 | 3-10 business days |
| Professional caricaturists | R$95-200+ | 3-10 business days |
| Corporate mascot studios | R$300-3,600 | 7-30 days |
| Free ChatGPT DIY | R$0 | 30min+ effort, inconsistent |

**Our position:** R$29.90 -- marketplace quality at WhatsApp speed. Below Elo7 mid-range, at top of informal WhatsApp seller range.

**Competitor weaknesses (structural advantages for us):**
1. Slow delivery (3-10 days vs <30 min)
2. Non-delivery risk (top Reclame Aqui complaint)
3. Quality inconsistency vs our template library
4. Poor communication vs our instant bot responses
5. Hidden costs vs our transparent R$29.90

**No automated WhatsApp bot competitor verified.** Market is 989+ fragmented Elo7 sellers + hundreds of Instagram individuals. Nobody running paid Meta ads at scale.

**DIY ChatGPT threat:** Real but mitigated. Free tier = 3 images/day, inconsistent style, requires prompt knowledge. The viral DIY trend VALIDATES demand -- most casual users will pay R$29.90 for quality + convenience.

**Lensa precedent:** $50M+ revenue from AI avatars at $3.99/pack with ~87% margin. Proof that AI portrait-as-a-service is validated business model.

## Open Questions

1. **Medium vs High image quality:** GPT Image 1.5 Medium ($0.034) vs High ($0.133) -- 75% cost savings. Is Medium quality sufficient for mascotinhos? Technical spike needed.
2. **WhatsApp Business verification timeline:** 2-10 business days. Start immediately -- required for production (unverified = 250 conversations/24h limit).
3. **Asaas pessoa fisica PIX limitations:** Max 5 PIX keys per individual. At scale, may need to open MEI/CNPJ for unlimited keys.
4. **GPT-5-mini Portuguese quality:** Documented as "multilingual" but no PT-BR-specific benchmarks. Needs testing with real conversation scripts.
5. **Supabase free tier viability:** Auto-pauses after 7 days inactivity, 500MB DB limit. When to upgrade to Pro ($25/mo)?
6. **CPA from Meta click-to-WhatsApp ads:** Target <R$15 but actual CPA unknown until ad testing. Critical variable for unit economics.
7. **Revision rate prediction:** If >40% of orders need revisions, prompt templates need improvement. Affects cost projections.
8. **Payment split partner configuration:** Both parties need Asaas accounts. Partner onboarding process needs verification.
9. **ECA Digital enforcement specifics:** Law effective March 17, 2026 but ANPD guidance on implementation still pending. Monitor.
10. **AI copyright when PL 2338/2023 passes:** May require disclosure of AI generation to customers. Already best practice but needs monitoring.
11. **Rate limiting at scale:** GPT Image API exact RPM limits unknown at hobby/pro tier. Need to test throughput ceiling.

## Scope Signals

**MVP (Weeks 1-3):**
- Single product: mascotinho infantil
- Single channel: WhatsApp via official API
- Single payment: PIX via Asaas
- Core flow: greet -> collect -> pay -> generate -> deliver -> revise (max 2)
- 5-10 style templates seeded
- LGPD consent + privacy policy
- Abandoned cart recovery (2-touch)

**Quick Wins (Weeks 3-4):**
- Reply buttons for style selection
- Instagram sharing CTA
- Order tracking in DB

**Growth (Month 2-3):**
- Product ladder: convite + kit festa bundles
- 3-variations A/B test vs revision loop
- Referral codes with discount tracking
- Holiday broadcasts to past clients

**Future (Month 3+):**
- Pet avatars (URGENT -- viral trend, zero competition)
- Professional caricatures (URGENT -- trend peaking, 12-month window)
- Couple/family illustrations (seasonal)
- Admin dashboard
- Corporate mascots (B2B, separate funnel)
- Ad creative automation
- Animated mascotinhos (D-ID/HeyGen)
- WhatsApp sticker pack delivery
- White-label bot for marketplace sellers

## Regulatory Details

**LGPD:**
- Photos = personal data. Parental consent mandatory for minors (Art. 14)
- Controller (business) / Processor (OpenAI) relationship requires DPA
- Data minimization: photo + order info only. Delete photos 30 days post-delivery.
- Transparency: privacy policy link in bot, consent language inline
- ANPD priority: children's data is enforcement focus area

**ECA Digital (Lei 15.211/2025):**
- Effective March 17, 2026
- Stricter rules for children's data in digital environments
- Parental supervision tools required
- Rapid response mechanisms mandated
- Parent ordering = inherent consent but must be explicit in ToS

**ECA (Lei 8.069/1990 Art. 17):**
- Commercial use of child's image requires explicit parental authorization
- STJ Sumula 403: damage presumed without proof for unauthorized commercial image use
- Marketing materials cannot feature children without individual signed releases

**WhatsApp Policy:**
- General-purpose AI bots banned (Oct 2025 policy, Jan 2026 enforcement)
- Task-specific commerce bots (order processing, payment, delivery) explicitly ALLOWED
- Official API required; unofficial tools blocked from Jan 2026
- 72h free entry point from click-to-WhatsApp ads; 24h customer service window otherwise
- Template messages needed outside windows (Meta pre-approval required)

**Advertising (CONAR Resolution 163/2014):**
- Bans advertising directed at children under 12
- Ads must target parents (adults 25-45) -- aligns with natural audience
- No childish language, cartoons appealing to children, or prize distributions targeting children in ad creatives

**AI Copyright (Lei 9.610/98):**
- AI-generated images may not receive copyright protection (requires human intellectual creation)
- PL 2338/2023 (Marco Legal da IA) passed Senate Dec 2024, pending Chamber. Will require disclosure + establish content rights.
- OpenAI ToS assigns output ownership to API user
- Low litigation risk for consumer illustrations; higher for B2B/corporate

**Tax/Structure:**
- MEI recommended: R$81,000/year limit, R$50/month flat DAS tax
- Upgrade to Simples Nacional (6-13%) when exceeding MEI threshold
- Pessoa fisica selling: up to 27.5% income tax -- very unfavorable, avoid

**Consumer Protection (CDC):**
- 7-day withdrawal right nuanced for consumed digital products
- Delivery obligation: must deliver within promised timeframe
- Clear product description, delivery method, timeline, payment terms required
- Revision policy manages quality expectations and prevents disputes

## Cost Analysis

**AI Model Pricing:**
- GPT-5-mini conversation: $0.125 input / $1.00 output per 1M tokens
- GPT Image 1.5 High (1024x1024): $0.133/image
- GPT Image 1.5 Medium (1024x1024): $0.034/image
- Image input tokens: $8.00/1M tokens

**Per-Order Cost Breakdown:**

| Component | Best Case | Medium Case | Worst Case |
|---|---|---|---|
| | Quick, approves 1st | Some chat, 1 revision | Very chatty, 2 revisions |
| Conversation (5-mini) | $0.002 (5 exchanges) | $0.004 (12 exchanges) | $0.009 (20 exchanges) |
| Prompt enrichment | $0.0004 (1 call) | $0.0008 (2 calls) | $0.0012 (3 calls) |
| AI quality check | $0.0003 (1 call) | $0.0006 (2 calls) | $0.0009 (3 calls) |
| Image input tokens | $0.016 (1 gen) | $0.032 (2 gens) | $0.048 (3 gens) |
| Text input for gen | $0.005 (1 call) | $0.010 (2 calls) | $0.015 (3 calls) |
| Image output (High) | $0.133 (1x) | $0.266 (2x) | $0.399 (3x) |
| **Total USD (AI)** | **$0.157** | **$0.313** | **$0.473** |
| **Total BRL (AI)** | **R$0.91** | **R$1.82** | **R$2.74** |
| With free PIX (<=100/mo) | R$0.91 | R$1.82 | R$2.74 |
| With paid PIX (>100/mo) | R$2.90 | R$3.81 | R$4.73 |
| **Revenue** | R$29.90 | R$29.90 | R$29.90 |
| **Profit (free PIX)** | R$28.99 (97%) | R$28.08 (94%) | R$27.16 (91%) |
| **Profit (paid PIX)** | R$27.00 (90%) | R$26.09 (87%) | R$25.17 (84%) |

**Key cost notes:**
- Image output (High) is 85%+ of total AI cost in every scenario
- Conversation cost with GPT-5-mini is essentially free (~R$0.05 worst case)
- Asaas R$1.99/PIX is the biggest non-AI cost after free tier
- WhatsApp API: FREE within 72h click-to-WhatsApp ad window
- Non-converting leads cost R$0.00 WhatsApp + R$0.03-0.05 AI tokens
- At 100 orders/month (free tier): ~R$2,700+ profit before ad spend

**Infrastructure costs at scale:**
| Scale | Supabase | Vercel Blob | Other | Total Infra |
|---|---|---|---|---|
| 100 orders/mo | Free | $0-2 | -- | ~$2 |
| 500 orders/mo | $25 (Pro) | $5 | -- | ~$30 |
| 1000+ orders/mo | $25 (Pro) | $10-15 | $5-10 (Redis/queues) | ~$50 |

## Cross-Pollination Patterns

**From Print-on-Demand (Printful, Gelato):**
- Product ladder: R$29.90 (1 image) -> R$49.90 (+ convite) -> R$79.90 (kit festa). Same photo input, different prompt templates.
- Style template library: pre-tuned prompts per theme for consistent quality.

**From AI Avatar Services (Lensa, Dawn AI):**
- 3 variations instead of revisions: generate 3 options upfront, client picks favorite. Eliminates revision loop. (Future A/B test)
- "Magic Pack" virality: closing message encourages Instagram sharing.

**From Chatbot Commerce (ManyChat, Respond.io):**
- Quick reply buttons for structured input instead of free-text. Reduces friction and error.
- Abandoned cart recovery: 2-touch (1.5h + 24h), not spammy.

**From Canva / Design-on-Demand:**
- Before/after social proof: portfolio shows original photo next to mascotinho. Most powerful trust-builder.

**From Brazilian Digital Sellers (Hotmart/Kiwify):**
- Holiday broadcast: before Dia das Criancas, Natal, Carnaval -> themed offers to past clients at discount.
- Referral engine: "Indica pra uma amiga e voces duas ganham R$5 de desconto!"

## Market Context (Key Numbers)

- Brazilian children's party market: R$15B/year, growing 10%/year
- Average mid-range party spend: R$6,000-R$15,000
- ~2.5M births/year in Brazil; ~600K potential mascotinho buyers/year (30% adoption)
- TAM for birthday mascotinhos: ~R$17.9M/year
- WhatsApp: 148M users in Brazil, 94% penetration, 78% of businesses sell via WhatsApp
- WhatsApp conversational commerce LATAM: $18.2B in 2025, 35% YoY, Brazil = 43%
- PIX: 63.4B transactions in 2024 ($4.6T), 40% of e-commerce, projected 45% by end 2026
- AI art market: $5.3B (2025), 40% CAGR through 2030
- Pet market Brazil: R$75-78B (2024-2025)
- Elo7: 989+ sellers for "mascote digital", 128+ for "mascote digital infantil"
- Click-to-WhatsApp ads: 24% lower cost per lead vs standard lead ads
- Market attractiveness score: 8.5/10

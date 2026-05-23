---
title: "Product Brief: Mascotinhos"
status: "complete"
created: "2026-03-27"
updated: "2026-03-27"
inputs: [brainstorming-session, domain-research, market-research, technical-research]
---

# Product Brief: Mascotinhos

## 1. Executive Summary

Mascotinhos is an automated WhatsApp bot that sells AI-generated personalized cartoon illustrations of children at R$29.90 each. A parent clicks a Meta ad, lands in a WhatsApp conversation, sends a photo of their child, pays via PIX, and receives a professional-quality mascotinho illustration within minutes -- no human operator required. The entire sales, payment, generation, and delivery cycle runs autonomously inside a single WhatsApp conversation.

The business exploits a convergence of three forces hitting Brazil simultaneously: (1) a R$15 billion children's party market where hyper-personalization is the defining trend of 2026, (2) AI image generation costs that have collapsed to R$0.19-R$0.75 per image, and (3) a commerce culture where 148 million Brazilians already buy products through WhatsApp. Today, hundreds of fragmented manual sellers serve this demand with 3-to-10 day delivery times, inconsistent quality, and no automation. No verified automated WhatsApp bot competitor exists in this space.

The timing is exceptional. The viral ChatGPT caricature trend of early 2026 educated millions of Brazilian consumers on AI illustration -- for free. ECA Digital (effective March 17, 2026) raises the compliance bar in a way that favors structured, consent-aware automated systems over informal sellers. WhatsApp's January 2026 ban on general-purpose AI bots explicitly exempts task-specific commerce flows like ours, while disrupting competitors who rely on gray-market automation. The MVP can ship in 3 weeks. At 100 orders per month, the business generates R$2,700+ in profit before ad spend, with 84-97% margins on every order.

## 2. The Problem

Every year, millions of Brazilian mothers plan birthday parties for their children. Personalization is the dominant trend -- parents want illustrations that capture their child's unique likeness as a cartoon mascot for invitations, decorations, and party themes. The current process is painful:

- **Slow delivery.** Manual illustrators on Elo7, Instagram, and WhatsApp take 3 to 10 business days. Party planning decisions cannot wait a week for a single image.
- **Unreliable service.** "Non-delivery" is the top complaint on Reclame Aqui for Instagram-based sellers. 86% growth in complaints about Instagram commerce in recent years.
- **Inconsistent quality.** Each manual seller produces different styles. Output often does not match portfolio samples. Character consistency across a party kit (invitation, labels, banner) is nearly impossible.
- **Poor communication.** Sellers respond slowly, provide no status updates, and add hidden charges after the initial quote.
- **DIY is not the answer.** TikTok tutorials teach moms to use ChatGPT for mascotinhos, but the free tier limits images to 3/day, results are inconsistent, and the target audience is non-technical. The effort cost exceeds the R$29.90 price point.

The cost of the status quo is lost sales (abandoned orders due to slow response), wasted time (manual sellers spend hours on each conversation), and a fragmented market where no brand has earned trust at scale.

## 3. The Solution

An end-to-end automated WhatsApp bot that replaces the entire manual workflow:

1. **Lead capture:** Customer clicks a Meta click-to-WhatsApp ad and arrives in a conversation with the bot. The 72-hour free messaging window opens -- all subsequent messages cost R$0.00 in WhatsApp fees.
2. **AI conversation:** The bot greets warmly in Brazilian Portuguese, shows a curated portfolio of before/after examples, confirms the R$29.90 price, and collects the child's photo, preferred theme (via quick-reply buttons for top styles), and outfit/detail preferences.
3. **Payment:** The bot generates a PIX QR code via Asaas API and sends it inline. Payment confirmation arrives via webhook in under 1 second. Abandoned cart nudge at 1.5 hours; closure at 24 hours.
4. **Generation:** Upon payment confirmation, the bot enriches the customer inputs into a structured prompt, sends it to OpenAI GPT Image 1.5 API with the reference photo, runs an AI quality self-check, and holds the result for a 1-2 minute artificial delay ("Estou preparando sua arte com carinho") to create perceived production value.
5. **Delivery and revision:** The mascotinho is delivered via WhatsApp. The customer can request up to 2 revisions (concrete prompt tweaks like "darker eyes" or "add two front teeth"), which are processed automatically.
6. **Close and referral:** Post-delivery, the bot requests an Instagram share/tag and offers a referral discount.

The entire flow completes within the 72-hour free messaging window. Non-converting leads cost only R$0.03-0.05 in AI token costs.

## 4. What Makes This Different

- **First automated WhatsApp bot in this market.** No verified competitor has deployed a fully automated bot for mascotinho sales. Manual sellers cannot match the speed, consistency, or unit economics.
- **84-97% gross margins.** Cost per order ranges from R$0.91 (best case, free PIX tier) to R$4.73 (worst case with paid PIX and 2 revisions). At R$29.90 revenue, margins are extraordinary for a consumer product.
- **Minutes, not days.** Delivery in under 30 minutes vs. 3-10 days from manual sellers. Speed is the single most powerful differentiator in a market defined by slow, unreliable service.
- **Payment-first model.** No free previews. Portfolio and social proof build trust before payment. Zero wasted AI credits on non-payers.
- **Extensible architecture.** The monorepo (Turborepo) and product-agnostic data model (StyleTemplate with productType field) support adding pet avatars, professional caricatures, couple illustrations, and corporate mascots without architectural changes.
- **Compliance-forward.** Built with LGPD consent capture, ECA Digital parental authorization, and official WhatsApp Business API from day one -- a structural advantage over informal sellers who will face increasing regulatory pressure.

## 5. Who This Serves

**Primary: Brazilian mothers planning birthday parties.** Women aged 25-40, classes B and C, heavy WhatsApp users, spending R$3,000-R$10,000 per party. R$29.90 represents less than 0.5% of their party budget -- firmly in impulse-buy territory. 67% of Brazilian parents overspend on birthdays. The emotional nature of the purchase (their child's party) reduces price sensitivity significantly.

**Secondary:**
- **Children's event planners and decorators** -- recurring B2B buyers ordering 5-20 mascotinhos per month, valuing speed and consistency.
- **Party kit sellers on Elo7/Mercado Livre** -- use mascotinhos as components of larger packages, potential wholesale/discount tier.
- **Digital gift givers** -- aunts, uncles, godparents buying a unique gift for a child's birthday (1-2x/year, impulsive).

## 6. Success Criteria

| Metric | Target (Month 1-3) | Rationale |
|---|---|---|
| Orders per month | 100+ | Validates product-market fit; stays within Asaas free PIX tier |
| Conversion rate (lead to paid order) | 15-25% | WhatsApp commerce benchmarks for impulse-price products |
| Gross margin per order | >84% | Worst-case scenario with paid PIX and 2 revisions |
| Customer acquisition cost (CPA) | <R$15 | Must be below 50% of ticket price for sustainable unit economics |
| Delivery time (payment to image) | <30 minutes | Primary competitive differentiator |
| Revision rate | <40% of orders | Indicates prompt template quality; revisions are free but cost API credits |
| Customer satisfaction (post-delivery rating) | >4.5/5 | Quality signal; drives referral and repeat |
| Monthly recurring profit (before ad spend) | R$2,700+ at 100 orders | Validates business viability at minimum scale |

## 7. Scope

### MVP (Weeks 1-3) -- IN

- WhatsApp bot via Vercel Chat SDK + `@chat-adapter/whatsapp` (official WhatsApp Business API)
- AI conversational agent via Vercel AI SDK v6 (ToolLoopAgent) + GPT-5-mini for Brazilian Portuguese dialogue
- Photo collection, theme selection (quick-reply buttons for top 5 styles + free-text fallback), and order confirmation
- PIX payment via Asaas API: QR code generation, webhook confirmation, partner split support
- Image generation via OpenAI GPT Image 1.5 (High quality, 1024x1024) with prompt enrichment and AI quality self-check
- Artificial 1-2 minute production delay with typing indicators
- Auto-delivery of mascotinho image via WhatsApp
- Revision loop: up to 2 rounds of concrete adjustments
- Style template library: 5-10 curated themes seeded from real order data
- LGPD consent capture in bot flow, privacy policy link, auto-delete photos after delivery + 30 days
- Abandoned cart recovery: 1.5h nudge + 24h closure
- Database: Supabase Postgres + Prisma (orders, clients, payments, generations, style templates)
- Monorepo: Turborepo with clean package boundaries (bot-engine, image-gen, payments, whatsapp, database)

### MVP -- OUT

- Admin dashboard (order management, analytics)
- Multiple product types (pet avatars, caricatures, couples, corporate)
- Web-based order form or landing page
- Organic marketing (Instagram/TikTok content creation)
- Product bundles (kit festa: mascotinho + convite + tag)
- Referral code system with discount tracking
- Holiday broadcast campaigns
- LoRA fine-tuning for branded house style (use system prompt engineering for MVP)
- 3-variation approach (generate 3 options instead of revision loop -- future A/B test)
- Ad creative automation (competitor scraping + AI-generated ads)

## 8. Compliance and Regulatory

**LGPD (Lei Geral de Protecao de Dados):**
- Children's photos are personal data; parental consent is mandatory (Article 14). Consent language embedded in bot flow: "Ao enviar a foto, voce consente com nossos Termos de Uso e Politica de Privacidade."
- Data minimization: collect only photo + order info. Auto-delete reference photos 30 days after delivery.
- OpenAI as data processor: DPA required (OpenAI provides standard DPAs for API customers).
- ANPD has designated children's data as a priority enforcement area for 2024-2025 biennium. Non-compliance carries real risk.

**ECA Digital (Lei 15.211/2025, effective March 17, 2026):**
- Stricter rules for processing children's data in digital environments. Requires explicit parental consent for commercial use of children's image.
- Since parents themselves order and submit the photo, consent is inherent but must be made legally explicit via Terms of Service.
- Marketing materials must not feature children's likenesses without individual signed releases.

**WhatsApp Business API Commerce Policy:**
- October 2025 policy bans general-purpose AI chatbots. Task-specific commerce bots (structured order flows, payment processing, product delivery) are explicitly allowed.
- January 2026 enforcement blocks unofficial automation tools. Using the official WhatsApp Business API (via Vercel Chat SDK adapter) ensures compliance.
- Ads must target adult parents (25-45), not children. CONAR Resolution 163/2014 prohibits advertising directed at children under 12.

**AI Copyright (Evolving):**
- AI-generated images currently lack clear copyright protection under Brazilian law (Lei 9.610/98 requires human intellectual creation).
- PL 2338/2023 (Marco Legal da IA) passed the Senate December 2024, pending Chamber review. Will require AI disclosure and establish content rights framework when enacted.
- Practical risk is low for consumer illustrations; ToS assigns file ownership to buyer. Disclosure of AI generation is best practice.

**Tax and Business Structure:**
- MEI (Microempreendedor Individual) recommended: R$81,000/year limit (~R$6,750/month), R$50/month flat tax. Adequate for MVP scale.
- Upgrade to Simples Nacional (6-13% tax) when revenue exceeds MEI threshold.

## 9. Vision

Mascotinhos is the entry point for a platform that delivers any AI-generated personalized digital product through WhatsApp conversations. The extensible architecture -- style templates with product types, a model-swappable AI agent, and a payment-agnostic flow -- is designed to support a product ladder:

- **Near-term (Month 3-6):** Pet avatars (R$29.90), professional caricatures (R$39.90-R$49.90), kit festa bundles (mascotinho + convite + tag at R$59.90)
- **Medium-term (Month 6-12):** Couple and family illustrations (R$49.90-R$89.90), animated mascotinhos (video), WhatsApp sticker packs, B2B pricing for event planners
- **Long-term (Year 2+):** Corporate mascots for Brazil's 22 million MEIs (R$89-R$299), white-label bot for Elo7/marketplace sellers, ad creative automation pipeline, multi-platform expansion (Telegram, Instagram DMs)

The R$15 billion festa infantil market, R$75 billion pet market, and the global AI art market growing at 40% CAGR provide a large surface area for expansion. The moat is not the technology (available to anyone) but the operational depth: branded style consistency, end-to-end automation, sub-30-minute delivery SLA, and compliance-first architecture that together create a barrier manual sellers and casual competitors cannot replicate quickly.

The 12-18 month window to establish brand and operational leadership is open now. No VC-backed startup has targeted this niche in Brazil. The viral awareness created by ChatGPT trends has eliminated consumer education costs. The infrastructure (WhatsApp Business API, PIX, GPT Image 1.5) is mature. The time to ship is now.

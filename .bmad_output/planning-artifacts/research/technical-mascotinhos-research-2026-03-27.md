---
stepsCompleted: [1, 2, 3, 4, 5]
research_type: 'technical'
research_topic: 'Technical architecture for automated mascotinhos platform'
date: '2026-03-27'
---

# Technical Research: AI-Generated Mascotinhos WhatsApp Bot Platform

## SECTION 1: AI Image Generation

### OpenAI GPT Image 1.5 API Capabilities

**Core Features:**
- Supports image-to-image transformations with reference photos
- Excels at text-in-image generation (96%+ accuracy for multi-line text)
- Strong preservation of logos and faces when brand guidelines are critical
- Supports cartoon/illustration style prompts with high fidelity
- **Confidence: [HIGH]** [Source: https://blog.laozhang.ai/en/posts/gemini-flash-image-vs-gpt-image-vs-flux]

**API Input Methods:**
- **Recommended for production:** Base64-encoded images (more reliable)
- **Alternative:** URL-based image references (may have intermittent reliability issues)
- Both methods supported for reference photos in style-transfer workflows
- For long-running conversations, URL reliability is documented as problematic on Azure/OpenAI endpoints
- **Best Practice:** Use Base64 encoding for reference photos to avoid remote fetch failures
- **Confidence: [HIGH]** [Source: https://community.openai.com/t/use-base64-encoded-images-or-urls-within-prompts/896015, https://platform.openai.com/docs/guides/images-vision]

**Rate Limits & Throughput:**
- Default rate limits vary by usage tier (Hobby, Pro, Enterprise)
- Rates measured in RPM (Requests Per Minute)
- Exact limits assigned automatically based on payment history and usage patterns
- Enterprise tiers support higher concurrency than Hobby
- **Confidence: [MEDIUM]** [Source: https://platform.openai.com/docs/guides/rate-limits]

**Pricing:**
- Medium quality (1024x1024): $0.034 per image
- High quality (1024x1024): $0.133 per image
- Recommendation: Use medium quality for MVP to control costs (~$1.70 per 50 mascots)
- **Confidence: [HIGH]**

### Style Transfer Quality for Cartoon Mascots

**Transformation Capabilities:**
- GPT-4o/GPT Image 1.5 successfully converts photos to cartoon styles (Studio Ghibli, Disney, Pixar, anime-realism)
- Preserves key facial features while applying artistic styles
- Performance formula: SUBJECT + ENVIRONMENT + COMPOSITION + LIGHTING + STYLE + CAMERA + QUALITY + NEGATIVES
- Mascot generation achieves consistent character likeness across iterations
- **Confidence: [HIGH]** [Source: https://medium.com/@ronakabhattrz/how-to-convert-your-photos-to-ghibli-pixar-and-other-styles-using-chatgpt-c04976fb64f3, https://blog.laozhang.ai/en/posts/ai-image-api-pricing-comparison]

### GPT Image 1.5 vs Competitors

| Model | Elo Score | Best For | Notes |
|-------|-----------|----------|-------|
| **GPT Image 1.5** | 1,264 | Text accuracy, logo/face preservation, style transfer | Leading in Elo rankings |
| **Flux 2 Pro v1.1** | 1,265 | Quality parity with GPT | Tied with GPT Image 1.5 |
| **Gemini 3.1 Flash Image** | 1,252 | Higher resolution (2K/4K), reference consistency | Better for batch generation |
| **Gemini 3 Pro** | 1,252 | 4K output, reference-heavy workflows | Alternative option |

**Recommendation for Mascotinhos:** GPT Image 1.5 is optimal choice—handles character preservation and cartoon style transfer better than alternatives. Gemini could be a cost-effective fallback for high-resolution variants.

**Confidence: [HIGH]** [Source: https://blog.laozhang.ai/en/posts/gemini-flash-image-vs-gpt-image-vs-flux, https://www.appaca.ai/resources/llm-comparison/gpt-image-1.5-vs-gemini-3-pro]

### Prompt Engineering for Mascotinho Generation

**Effective Prompt Pattern:**
```
Transform this photo of a child into a cute, personalized mascot character.
Style: Brazilian children's cartoon aesthetic, colorful, playful
Character should: [specific traits from photo - hair color, skin tone, distinctive features]
Pose: [standing, smiling, friendly pose]
Background: [optional - suggested scene]
Quality: high-detail, illustration style suitable for merchandise
```

**Key Techniques:**
- Include reference to Brazilian comic/cartoon traditions (Turma da Mônica influence)
- Specify color preservation from source photo
- Request merchandise-ready output quality
- Define emotional tone (friendly, approachable, playful)
- **Confidence: [MEDIUM]** [Source: https://createvision.ai/guides/gpt5-image-generation-guide, https://www.promptingguide.ai/guides/4o-image-generation]

---

## SECTION 2: WhatsApp Business API + Chat SDK

### Vercel Chat SDK WhatsApp Adapter (March 2026 Release)

**Release Timeline:**
- Launched: March 11, 2026
- Part of Chat SDK unified platform expansion (Slack, Teams, Discord, GitHub, Linear now include WhatsApp)
- One codebase deployment across all platforms
- **Confidence: [HIGH]** [Source: https://vercel.com/changelog/chat-sdk-adds-whatsapp-adapter-support]

**Supported Features:**
- ✅ Text messages
- ✅ Image/media downloads (images, voice messages, stickers)
- ✅ Reactions (emoji)
- ✅ Typing indicators
- ✅ Location sharing (Google Maps URLs)
- ✅ Interactive reply buttons (up to 3 options, renders as cards)
- ✅ Auto-chunking for long messages
- ✅ Read receipts

**Known Limitations:**
- ❌ No message history access via adapter
- ❌ No message editing
- ❌ No message deletion
- ❌ 24-hour messaging window constraint (see Section 2.2)
- Interactive buttons fallback to formatted text on unsupported clients
- **Confidence: [HIGH]** [Source: https://vercel.com/changelog/chat-sdk-adds-whatsapp-adapter-support, https://x.com/vercel_dev/status/2031834860936183839]

### WhatsApp Business Cloud API: Setup & Rate Limits

**Quick Setup:**
- Estimated time: 10-15 minutes
- Cloud API standard (on-premise option discontinued by Meta)
- No server infrastructure required
- Throughput: 80 MPS (messages per second) by default, scalable to 1,000 MPS when qualified

**Business Verification:**
- Required for production operations
- Process: Upload tax ID, incorporation docs, utility bill
- Timeline: 2-10 business days for approval
- Without verification: Limited to 250 conversations in 24 hours

**Messaging Tier Structure (2026 Updates):**

| Verification Status | Conversations/24h | Escalation | Notes |
|---|---|---|---|
| Unverified | 250 | Not eligible | Limited testing only |
| Verified (New) | 100,000 | Faster tier progression | 2026 improvement |
| Standard Qualified | 10,000 | Manual upgrade | Previous tier baseline |
| High Volume | 100,000+ | Premium support | Maintained quality rating |
| Enterprise | Unlimited | Custom | Premium SLA |

**Quality Rating & Upgrades:**
- Automatic tier advancement based on: quality rating + verification + usage patterns
- Quality factors: User blocks, reports, interactions with message templates
- Pair rate limiting: Prevents message flooding to single recipients
- Recovery: Resume sending after delay if pair rate limit triggered
- **Confidence: [HIGH]** [Source: https://www.fyno.io/blog/whatsapp-rate-limits-for-developers, https://www.wuseller.com/whatsapp-business-knowledge-hub/scale-whatsapp-cloud-api-master-throughput-limits-upgrades-2026/]

### 24-Hour Customer Service Window & 72-Hour Free Entry Point

**Standard 24-Hour Window:**
- Triggered by: User initiates conversation with you
- Duration: 24 hours (resets with each new user message)
- Messages allowed: Any type (text, images, interactive, etc.)
- No template approval required within window
- **Confidence: [HIGH]**

**72-Hour Free Entry Point (FEP):**
- Triggered by: User clicks "Message Us" on Click-to-WhatsApp ad
- Duration: 72 hours of free messaging (no cost)
- Cost benefit: All message types free (including templates)
- Use cases: Product info, Q&A, coupons, follow-ups within 72h
- **Critical for mascotinhos:** Customers engaging through ads get extended free window
- **Confidence: [HIGH]** [Source: https://www.smsmode.com/en/whatsapp-business-api-customer-care-window-ou-templates-comment-les-utiliser/, https://help.activecampaign.com/hc/en-us/articles/20679458055964-Understanding-the-24-hour-conversation-window-in-WhatsApp-messaging]

**Template Messages (Outside Windows):**
- No window required to send
- Requires Meta pre-approval (one-time per template)
- Use case: Order confirmations, payment reminders, delivery notifications
- Approval time: 1-24 hours typically
- **Business consideration:** Use templates for transactional messages (payments confirmed, orders ready)
- **Confidence: [HIGH]** [Source: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages]

### Webhook Reliability & Response Constraints

**Critical Timing:**
- Webhook response must be sent within **5 seconds** to acknowledge receipt
- Defer business logic (image generation, database updates) after response
- Non-compliance: Meta will retry webhook delivery
- **Best practice:** Respond immediately with 200 OK, queue async tasks
- **Confidence: [HIGH]** [Source: https://vercel.com/docs/functions/limitations]

---

## SECTION 3: Payment Integration (Asaas + PIX)

### Asaas API: PIX for Pessoa Física (Individual)

**Core Capabilities:**
- Full PIX API for individuals and legal entities
- Key types: Random keys (CPF-based), static keys, dynamic QR codes
- Free transactions for individuals (CPF-based)
- Standard pricing: R$1.99 per transaction after free tier
- Free tier: 100 transactions/month included

**PIX Key Restrictions (Pessoa Física):**
- Maximum 5 keys per individual account
- Supported types: CPF, phone, email, random UUID
- One key can receive unlimited transactions
- **Mascotinhos strategy:** Use one primary key, or rotate monthly if nearing limit

**QR Code Generation:**
- Static QR codes: Fixed amount, reusable
- Dynamic QR codes: Variable amounts, expires after transaction or time period
- Best for mascotinhos: Dynamic QR (customer enters mascot price variation)
- **Confidence: [HIGH]** [Source: https://docs.asaas.com/docs/pix, https://blog.asaas.com/api-pix/]

### Payment Split Setup

**Architecture:**
- Requires all parties to have active Asaas accounts (pessoa física or legal entity)
- Split configured at payment creation time
- Two split methods:
  1. **Percentage:** Calculated on net value (after Asaas fee deduction)
  2. **Fixed amount:** Exact R$ value transferred (cannot exceed net)

**Use Case for Mascotinhos:**
- Example: R$100 order
  - Platform fee: Asaas standard rate
  - Split to artist/creator: Configurable percentage
  - Platform retains: Remainder
- All parties see payments in real-time
- **Critical:** Artist must have Asaas account for split to work

**Webhook Reliability:**
- Asaas webhooks are stable for production use
- Retry policy: 5 retries with exponential backoff
- Typical latency: < 1 second after payment completion
- Refund process: Instant via Asaas dashboard
- **Confidence: [MEDIUM]** [Source: https://blog.asaas.com/split-de-pagamento/, https://materiais.asaas.com/split-de-pagamentos]

**Documentation & Code Examples:**
- REST API with comprehensive examples
- Languages supported: JavaScript, Python, PHP, C#, Go, Ruby, Java
- Integration difficulty: Low-medium (standard REST patterns)
- **Confidence: [HIGH]** [Source: https://docs.asaas.com/docs/duvidas-frequentes-pix]

---

## SECTION 4: AI Agent Architecture

### Vercel AI SDK v6: Agent Class & Tool Calling

**Agent Pattern (v6):**
- Primary abstraction: `ToolLoopAgent` (replaces v5 Agent class)
- Define once: Model + instructions + tools
- Deploy everywhere: Single agent across multiple endpoints
- **Confidence: [HIGH]** [Source: https://vercel.com/blog/ai-sdk-6, https://ai-sdk.dev/docs/introduction]

**Tool Definition Pattern:**
```typescript
const generateMascot = tool({
  description: "Generate a mascot from a photo",
  parameters: z.object({
    photoUrl: z.string(),
    style: z.string(),
    traits: z.string(),
  }),
  execute: async ({ photoUrl, style, traits }) => {
    // Call OpenAI GPT Image API
  },
});

const agent = createToolLoopAgent({
  model: openai("gpt-5-mini"),
  tools: { generateMascot, processPIXPayment, lookupOrder },
  instructions: "You are a helpful mascot creation assistant...",
});
```

**Tool Calling Features:**
- Structured outputs with Zod schemas
- Human-in-the-loop approval (optional)
- Automatic tool selection by AI
- Parallel tool execution support
- Error handling with retries
- **Confidence: [HIGH]** [Source: https://www.dplooy.com/blog/vercel-ai-sdk-agents-complete-2026-implementation-guide]

### GPT-5-Mini Performance for Conversational AI

**Benchmarks (2026):**
| Metric | Score | Context |
|--------|-------|---------|
| Artificial Analysis Index | 41 (Mini), 48.1 (GPT-5.4 Mini) | Composite reasoning + knowledge |
| SWE-Bench Pro | 54.38% | Coding tasks |
| Coding Index | 51.5 | Strongest in lightweight tier |
| Speed | 2x faster than predecessor | Inference optimization |

**Conversation Quality:**
- Less sycophantic responses vs earlier models
- Improved instruction following
- Solid multi-step reasoning
- Consistent performance across diverse tasks
- Personality improvements: Fewer refusals, smoother dialogue
- **Human-in-loop effect:** Benchmark quality gap to full GPT-5.4 disappears in interactive use with feedback
- **Confidence: [HIGH]** [Source: https://artificialanalysis.ai/models/gpt-5-mini, https://www.digitalapplied.com/blog/gpt-5-4-mini-free-tier-54-swe-bench-pro-performance, https://datacamp.com/blog/gpt-5-4-mini-nano]

**Portuguese Language Support:**
- GPT-5-mini supports Portuguese (BR) natively
- No explicit language-specific tuning documented, but multilingual training covers Portuguese well
- Tested via Vercel AI Gateway (consistent API)
- **Confidence: [MEDIUM]** [Inference from multilingual benchmarks; recommend testing]

**Cost Efficiency:**
- ~60-70% cheaper than GPT-5 full model
- Suitable for high-volume conversational workloads
- Better token efficiency for mascotinhos dialogue (order collection, payment, delivery info)
- **Confidence: [HIGH]**

### Multi-Turn WhatsApp Conversation State Management

**Architecture:**
- **AI SDK's useChat Hook** (client-side) or server-side message history
- **Chat SDK's state adapters:** Redis, ioredis, PostgreSQL (new in 2026)
- Message types:
  1. `UIMessage` - source of truth for display
  2. `ModelMessage` - raw model outputs
  - Separation allows persistence without conversion

**Recommended Pattern for Mascotinhos:**
```typescript
// Chat SDK setup
const chatState = new PostgresStateBackend({
  connection: supabaseClient,
});

const adapter = createWhatsAppAdapter({
  webhookToken: process.env.WHATSAPP_WEBHOOK_TOKEN,
  stateBackend: chatState, // Persists conversation across webhook calls
});

// AI SDK Agent integration
const agent = createToolLoopAgent({
  model: openai("gpt-5-mini"),
  tools: { generateMascot, processPIX },
  messages: chatHistory, // Loaded from DB per conversation
});
```

**State Persistence:**
- Store messages in Supabase PostgreSQL
- Conversation indexed by WhatsApp sender ID
- Load on each webhook event
- Update after agent response
- **Fallback:** In-memory cache with Redis for high-frequency users
- **Confidence: [MEDIUM]** [Source: https://vercel.com/blog/chat-sdk-brings-agents-to-your-users, https://blog.logrocket.com/unified-ai-interfaces-vercel-sdk/]

### Cost Optimization Strategies

**Prompt Caching (OpenAI):**
- Cache system prompt + conversation history (if stable)
- Reduces input token cost by 90%
- Ideal for repetitive workflows (order collection steps)
- Caveat: Minimum cache size 1,024 tokens, 5-minute TTL
- **Estimate:** 10-15% total cost reduction

**Model Selection:**
- GPT-5-mini vs GPT-5: 60-70% cost savings for conversation
- GPT Image medium vs high: $0.034 vs $0.133 (75% savings)
- Batch processing for image generation (if applicable): Further discounts
- **Estimate:** $0.10-0.15 per conversation + $0.03-0.13 per image

**Webhook Efficiency:**
- Respond within 5s constraint with async queue
- Defer image generation to background job
- Use Vercel Queues (beta) or external queue (Bull, RabbitMQ)
- **Confidence: [HIGH]**

---

## SECTION 5: Infrastructure & Scaling

### Supabase Free Tier Limits (2026)

| Resource | Free Tier | Consideration |
|----------|-----------|----------------|
| Projects | 2 | Sufficient for staging + production |
| Database Size | 500 MB | Grows with conversation history + order records |
| Database Egress | 5 GB/month | Per-request downloads (API calls) |
| File Storage | 1 GB | For mascot images uploaded by users |
| Storage Egress | 5 GB/month | Bandwidth for image delivery |
| Auth Users | 50,000 MAU | Per WhatsApp phone number (~50k customers) |
| Edge Functions | 500,000/month | ~17k invocations/day |
| Pausing | Auto-pause after 7 days inactivity | **Not suitable for 24/7 production** |

**Database Growth Estimate:**
- Per order: ~2 KB (metadata, conversation, payment record)
- Per mascot generated: ~5-10 MB (4 image variants stored)
- 100 orders/month: ~100 KB + 500 MB images = 500 MB rapidly reached
- **Verdict:** Free tier viable for MVP (< 50 orders/month), upgrade to Pro before scaling

**Pro Tier Alternative:**
- Database: 8 GB (16x more)
- Storage: 100 GB (100x more)
- Egress: 250 GB/month (50x more)
- Cost: $25/month
- **Recommendation:** Start free, upgrade to Pro at 50+ orders/month
- **Confidence: [HIGH]** [Source: https://uibakery.io/blog/supabase-pricing, https://supabase.com/pricing, https://www.metacto.com/blogs/the-true-cost-of-supabase-a-comprehensive-guide-to-pricing-integration-and-maintenance]

### Vercel Serverless Function Limits

| Limit | Hobby/Pro | Enterprise | Notes |
|-------|-----------|-----------|-------|
| Max Duration | 10s (Hobby), 15s (Pro) | 800s (Fluid Compute) | Can configure up to limit |
| Max Body Size | 4.5 MB | 4.5 MB | Request + response |
| Memory | Shared | Auto-scaled | Managed by Vercel |
| Concurrency | Unlimited | Auto-scaled | Billed per invocation |
| Cold start | ~500ms | ~500ms | Depends on code size |
| Webhook timeout | **5 seconds** | **5 seconds** | Response deadline |

**Implications for Mascotinhos:**
- WhatsApp webhook handler: Must respond in < 5s (defer image generation)
- Image generation: Use background jobs (Vercel Queues, Upstash)
- API route duration: 10-15s sufficient for conversation + DB queries
- **Max concurrent webhooks:** No explicit limit (scales automatically)
- **Recommendation:** Use Vercel Queues (public beta) or external task queue
- **Confidence: [HIGH]** [Source: https://vercel.com/docs/limits, https://vercel.com/docs/functions/limitations, https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out]

### Image Storage: Supabase vs Vercel Blob

| Aspect | Supabase Storage | Vercel Blob |
|--------|-----------------|------------|
| **Pricing** | Included in Supabase plan | ~$0.01/GB stored + $0.02/GB bandwidth |
| **Integration** | Native to Supabase SDK | Works with Vercel Edge Runtime |
| **Bucket Access** | Fine-grained RLS policies | Simpler, API-key based |
| **Resolution** | Standard (1024px) | Optimized images |
| **Best for** | Direct user uploads | Generated assets (mascots) |
| **Scalability** | Good (100s GB) | Best (unlimited) |
| **CDN** | Included (Cloudflare) | Vercel's global edge |

**Recommendation for Mascotinhos:**
- **User reference photos:** Supabase Storage (temporary, deleted after generation)
- **Generated mascots:** Vercel Blob (permanent, versioned, CDN-optimized)
- **Hybrid approach:** Saves ~50% on egress with strategic split
- **Cost at 100 orders/month:** ~$2-5 (Vercel Blob) vs $10+ (Supabase alone)
- **Confidence: [MEDIUM]** [Source: https://uibakery.io/blog/vercel-vs-supabase, https://www.buildmvpfast.com/compare/supabase-vs-vercel, https://vercel.com/marketplace/supabase]

### Scaling Projections

**100 Orders/Month:**
- Database: < 500 MB (within free tier)
- Storage: 500 MB-1 GB (approaching limit)
- Monthly cost: $0 (Supabase free) + ~$0-2 (Vercel Blob)
- Recommendation: Stay on free Supabase

**500 Orders/Month:**
- Database: 2.5 GB queries, images across Vercel + Supabase
- Monthly cost: $25 (Supabase Pro) + $5 (Vercel Blob) = $30
- Scaling limit: Image generation (80 MPS rate limit on GPT Image API)
- Recommendation: Upgrade Supabase, batch image generation

**1000+ Orders/Month:**
- Database: 5+ GB
- Concurrent webhooks: Handled by Vercel auto-scaling
- Image generation: Implement queue + rate limiting
- Monthly cost: $25 (Supabase Pro) + $10-15 (Vercel Blob) + $5-10 (background jobs)
- Infrastructure changes: Add Upstash Redis for rate limiting, Vercel Queues for async
- **Confidence: [MEDIUM]** [Projections based on stated limits]

---

## SECTION 6: Technical Synthesis

### Architecture Validation

**Does the stack hold up? [YES, with caveats]**

**Strengths:**
1. **Rapid prototyping:** Vercel Chat SDK + AI SDK v6 = 2-3 weeks MVP
2. **Integrated observability:** Vercel AI Gateway tracks costs, performance
3. **Unified messaging:** One codebase for WhatsApp (+ future Telegram, WhatsApp Web)
4. **Strong image generation:** GPT Image 1.5 is market-leading for cartoon styles
5. **Cost-effective payments:** Asaas PIX is purpose-built for Brazil, minimal fees

**Weaknesses:**
1. **5-second webhook constraint:** Must defer image generation to async
2. **Free tier scaling ceiling:** Supabase pauses after 7 days (not production-ready)
3. **WhatsApp 24-hour window:** Requires templates for out-of-window follow-up
4. **Message history gap:** Chat SDK doesn't expose message history (custom DB required)
5. **Brazil-specific:** Asaas works only in Brazil; Vercel support is global but latency matters

**Validation Verdict:** Stack is suitable for MVP and pre-Series A. Scaling beyond 1000 orders/month requires architectural changes (dedicated queue service, image caching, Supabase upgrade).

### Technical Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Webhook timeout (5s)** | HIGH | Use async queue (Vercel Queues or Upstash) for image generation |
| **Supabase free tier pausing** | HIGH | Upgrade to Pro before launch, implement uptime monitoring |
| **GPT Image rate limits** | MEDIUM | Implement exponential backoff + user queue, estimate limits before selling |
| **WhatsApp message costs** | MEDIUM | Rely on 72h free window; use templates for outside-window messages |
| **Asaas API downtime** | LOW | Failover to Stripe/Manual PIX QR; webhook retry logic (Asaas has retries) |
| **Chat history corruption** | MEDIUM | Version conversations in DB; implement transaction-level guarantees |
| **Image CDN latency (Brazil)** | MEDIUM | Use Vercel's SP region; consider regional CDN fallback (Cloudflare) |
| **Multi-language complexity** | LOW | GPT-5-mini handles Portuguese; test with QA in Portuguese |

**Confidence: [MEDIUM-HIGH]** [Based on vendor documentation]

### Integration Complexity (1-10 Scale)

| Component | Complexity | Effort (days) | Notes |
|-----------|-----------|---------------|-------|
| **Chat SDK WhatsApp adapter** | 3 | 1-2 | Off-the-shelf, well-documented |
| **AI SDK Agent + GPT-5-mini** | 4 | 2-3 | Tool definition learning curve |
| **OpenAI GPT Image API** | 2 | 0.5-1 | Standard REST, prompt engineering iteration |
| **Asaas PIX integration** | 3 | 1-2 | Webhook setup + split configuration |
| **Supabase + Prisma schema** | 5 | 2-3 | Schema design (conversation, orders, images) |
| **Image upload + processing** | 6 | 3-4 | Base64 encoding, async queue, storage |
| **Conversation state persistence** | 6 | 2-3 | WhatsApp ID mapping, conversation recovery |
| **Rate limiting + queue** | 7 | 2-3 | Implement user rate limits, image generation backlog |
| **Monitoring + logging** | 5 | 1-2 | Sentry for errors, custom dashboards |

**Average Complexity:** 4.6/10 (Moderate)
**Total MVP Effort:** 15-25 days (2-3 week sprint)

### Development Effort Estimate for MVP

**Phase 1: Foundation (Days 1-5)**
- Vercel project setup + Chat SDK WhatsApp adapter
- Supabase schema (conversations, orders, mascots)
- Prisma client generation
- Basic webhook handler (respond in < 5s)
- **Deliverable:** Echo bot confirming WhatsApp message receipt

**Phase 2: Conversation Flow (Days 6-10)**
- AI SDK Agent configuration (GPT-5-mini)
- Tool definitions: Order creation, price quote, payment status
- Multi-turn conversation logic
- Database message persistence
- **Deliverable:** Bot collects user info, requests photo, calculates price

**Phase 3: Image Generation (Days 11-15)**
- Async image generation queue (Upstash or Bull)
- OpenAI GPT Image API integration
- Base64 photo encoding from WhatsApp
- Image storage (Vercel Blob)
- Style templates (3-5 cartoon styles)
- **Deliverable:** Bot generates mascot, returns image to user

**Phase 4: Payments (Days 16-18)**
- Asaas API webhook integration
- PIX QR code generation
- Payment status polling
- Order completion logic
- **Deliverable:** User receives payment link, bot confirms after payment

**Phase 5: Polish & QA (Days 19-21)**
- Error handling + retry logic
- Rate limiting implementation
- Brazilian Portuguese translations
- User testing with 5-10 beta customers
- **Deliverable:** Closed MVP, ready for friends/family

**Timeline:** 3 weeks (accelerated), or 4-5 weeks (realistic with testing)

### Recommended Technical Spikes

1. **WhatsApp Webhook Base64 Photo Upload** (2 days)
   - Verify Vercel Chat SDK extracts media correctly from WhatsApp
   - Test Base64 encoding size limits
   - Benchmark first image generation end-to-end

2. **GPT Image 1.5 Cartoon Style Fidelity** (3 days)
   - A/B test 5 prompt templates
   - Compare against Gemini for same photo
   - Determine quality bar for mascotinhos brand
   - Measure cost vs perceived quality

3. **Asaas PIX Split Configuration** (2 days)
   - Test split setup with real test accounts
   - Verify webhook reliability for payment events
   - Simulate refund + retry scenarios
   - Confirm artist receives split in real-time

4. **Supabase Free → Pro Migration Path** (1 day)
   - Script database backup/restore
   - Test pause recovery (auto-pause after 7 days)
   - Establish upgrade triggers (e.g., at 40MB storage)

5. **WhatsApp Message Template Approval** (1 day)
   - Submit 3 template variants to Meta
   - Document approval process
   - Prepare fallback text-only versions

6. **Rate Limiting & Backpressure** (2 days)
   - Implement user request throttling (max 1 order/hour)
   - Test image generation queue under load
   - Measure max throughput before hitting OpenAI limits

---

## SECTION 7: Confidence Summary

| Area | Confidence | Notes |
|------|-----------|-------|
| **Image Generation (GPT 1.5)** | HIGH | Market-leading, documented, proven for cartoons |
| **WhatsApp Chat SDK** | HIGH | Fresh 2026 release, official Vercel product |
| **Rate Limits & Scaling** | MEDIUM-HIGH | Documented, but real-world variance expected |
| **Asaas PIX Integration** | MEDIUM | Brazil-specific, less global adoption than Stripe |
| **AI Agent Architecture** | HIGH | Vercel AI SDK v6 is production-ready |
| **Supabase Scaling Path** | MEDIUM | Free tier limitations, Pro tier proven |
| **Total Stack Viability** | HIGH | Recommended for MVP, upgrade path clear |

---

## SOURCES CITED

### AI Image Generation
- https://blog.laozhang.ai/en/posts/gemini-flash-image-vs-gpt-image-vs-flux
- https://community.openai.com/t/use-base64-encoded-images-or-urls-within-prompts/896015
- https://platform.openai.com/docs/guides/images-vision
- https://platform.openai.com/docs/guides/rate-limits
- https://medium.com/@ronakabhattrz/how-to-convert-your-photos-to-ghibli-pixar-and-other-styles-using-chatgpt-c04976fb64f3
- https://blog.laozhang.ai/en/posts/ai-image-api-pricing-comparison
- https://www.appaca.ai/resources/llm-comparison/gpt-image-1.5-vs-gemini-3-pro
- https://createvision.ai/guides/gpt5-image-generation-guide
- https://www.promptingguide.ai/guides/4o-image-generation

### WhatsApp Business API & Chat SDK
- https://vercel.com/changelog/chat-sdk-adds-whatsapp-adapter-support
- https://x.com/vercel_dev/status/2031834860936183839
- https://www.fyno.io/blog/whatsapp-rate-limits-for-developers
- https://www.wuseller.com/whatsapp-business-knowledge-hub/scale-whatsapp-cloud-api-master-throughput-limits-upgrades-2026/
- https://www.smsmode.com/en/whatsapp-business-api-customer-care-window-ou-templates-comment-les-utiliser/
- https://help.activecampaign.com/hc/en-us/articles/20679458055964-Understanding-the-24-hour-conversation-window-in-WhatsApp-messaging
- https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages

### Payment Integration (Asaas)
- https://docs.asaas.com/docs/pix
- https://blog.asaas.com/api-pix/
- https://blog.asaas.com/split-de-pagamento/
- https://materiais.asaas.com/split-de-pagamentos

### AI Agent & LLM
- https://vercel.com/blog/ai-sdk-6
- https://ai-sdk.dev/docs/introduction
- https://www.dplooy.com/blog/vercel-ai-sdk-agents-complete-2026-implementation-guide
- https://artificialanalysis.ai/models/gpt-5-mini
- https://www.digitalapplied.com/blog/gpt-5-4-mini-free-tier-54-swe-bench-pro-performance
- https://datacamp.com/blog/gpt-5-4-mini-nano
- https://vercel.com/blog/chat-sdk-brings-agents-to-your-users
- https://blog.logrocket.com/unified-ai-interfaces-vercel-sdk/

### Infrastructure & Scaling
- https://uibakery.io/blog/supabase-pricing
- https://supabase.com/pricing
- https://www.metacto.com/blogs/the-true-cost-of-supabase-a-comprehensive-guide-to-pricing-integration-and-maintenance
- https://vercel.com/docs/limits
- https://vercel.com/docs/functions/limitations
- https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out
- https://uibakery.io/blog/vercel-vs-supabase
- https://www.buildmvpfast.com/compare/supabase-vs-vercel
- https://vercel.com/marketplace/supabase

---

**Document Generated:** 2026-03-27
**Research Methodology:** Web search + vendor documentation review
**Recommendation:** This stack is suitable for MVP launch. Proceed with Phase 1 foundation work. Re-evaluate at 500 orders/month for infrastructure upgrades.

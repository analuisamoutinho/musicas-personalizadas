# Vercel Preview Environment Setup

This document is the runbook for enabling fully-functional Vercel Preview deployments — builds that pass `next build` env validation **and** can receive/send real WhatsApp messages on a dedicated preview number.

> **Context**: Vercel Preview deployments fail at `next build` when env vars are scoped to Production only. The fix is two-pronged: (1) copy shared infra vars to the Preview scope in Vercel, (2) register a second WhatsApp Business phone number for Preview so it never touches Production traffic.

---

## Table of Contents

1. [Overview — Hybrid scope strategy](#1-overview--hybrid-scope-strategy)
2. [Step 1 — Register a Preview WhatsApp phone number](#2-step-1--register-a-preview-whatsapp-phone-number)
3. [Step 2 — Configure Vercel env vars for Preview](#3-step-2--configure-vercel-env-vars-for-preview)
4. [Step 3 — Configure the Meta webhook for Preview](#4-step-3--configure-the-meta-webhook-for-preview)
5. [Step 4 — Verification](#5-step-4--verification)
6. [Ongoing: creating a new feature branch PR](#6-ongoing-creating-a-new-feature-branch-pr)
7. [Variable reference](#7-variable-reference)

---

## 1. Overview — Hybrid scope strategy

| Bucket | Vars | Rationale |
|--------|------|-----------|
| **Shared with Production** | All DB, Supabase, AI keys, Asaas billing, Upstash Redis, QStash, Sentry, Langfuse, Umami | Read-heavy infra — tolerable shared risk for internal previews. |
| **Isolated for Preview** | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_WEBHOOK_TOKEN`, `NEXT_PUBLIC_WHATSAPP_NUMBER`, `OPERATOR_WHATSAPP_NUMBER` (optional) | These send outbound messages. A bug or bad test on Preview must **never** fire real WhatsApp messages to real users. |

### Why a dedicated `preview` branch (not per-PR URLs)?

Meta's WhatsApp Business webhook requires a **stable, pre-registered callback URL**. Per-PR Vercel URLs (`mascotinhos-git-<hash>-m-giovani.vercel.app`) are ephemeral — you would need to re-register the webhook in Meta every time a PR is opened or force-pushed.

Instead, maintain a long-lived **`preview` branch** in GitHub. Vercel auto-assigns it a stable alias:

```
https://mascotinhos-git-preview-m-giovani.vercel.app
```

Register that URL in Meta once. Feature-branch PRs get their own ephemeral URLs (useful for visual review) but won't receive WhatsApp webhooks. Merge feature branches into `preview` when you want end-to-end WhatsApp testing.

---

## 2. Step 1 — Register a Preview WhatsApp phone number

### 2a. Add a second phone number in Meta Business Manager

1. Go to [Meta Business Manager](https://business.facebook.com/) → **WhatsApp Accounts** → your app → **Phone Numbers**.
2. Click **Add phone number** and follow the verification flow.
3. Use a real SIM you control (a cheap pre-paid number works well).
4. Note the **Phone Number ID** — you'll need it as `WHATSAPP_PHONE_NUMBER_ID`.

### 2b. Generate a permanent access token

1. In Meta Developers → your app → **WhatsApp** → **API Setup**.
2. Switch to the new preview phone number.
3. Under **Step 2**, generate a **permanent** (System User) token with `whatsapp_business_messaging` and `whatsapp_business_management` scopes.
4. Save it as `WHATSAPP_ACCESS_TOKEN` (preview value).

### 2c. Decide on `WHATSAPP_APP_SECRET`

If you reuse the same Meta app for both Production and Preview, `WHATSAPP_APP_SECRET` is the same. If you create a separate app (uncommon), use its secret.

### 2d. Generate a `WHATSAPP_WEBHOOK_TOKEN`

This is an arbitrary string you choose; Meta sends it in the verification challenge.

```bash
openssl rand -hex 32
```

Save it as `WHATSAPP_WEBHOOK_TOKEN` (preview value — different from production).

---

## 3. Step 2 — Configure Vercel env vars for Preview

Open [Vercel Dashboard](https://vercel.com/) → **mascotinhos** project → **Settings** → **Environment Variables**.

For each variable below, check **Preview** (and **Development** if you want `vercel dev` to work too) when setting or editing the scope.

### Shared vars — copy from Production to Preview scope

Edit each existing Production-scoped var and tick the **Preview** checkbox (or create a new entry scoped to Preview with the same value):

| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | Same Postgres; preview writes to the same DB — acceptable for internal use. Branch the DB later if needed. |
| `DIRECT_URL` | Same Postgres direct connection. |
| `SUPABASE_URL` | Same Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Same Supabase project. |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as `SUPABASE_URL`. |
| `OPENAI_API_KEY` | Shared quota is fine. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Optional; share if used. |
| `ASAAS_API_KEY` | Asaas sandbox key preferred if available; otherwise share production key — internal only. |
| `ASAAS_WEBHOOK_SECRET` | Same HMAC secret (webhook origin is verified by Vercel URL routing anyway). |
| `ASAAS_SPLIT_WALLET_ID` | Optional; share if set. |
| `UPSTASH_REDIS_REST_URL` | Same Redis instance. Consider a separate preview namespace in key prefixes if you want isolation. |
| `UPSTASH_REDIS_REST_TOKEN` | Same Redis token. |
| `QSTASH_TOKEN` | Same QStash. |
| `QSTASH_CURRENT_SIGNING_KEY` | Same. |
| `QSTASH_NEXT_SIGNING_KEY` | Same. |
| `CRON_SECRET` | Same (cron endpoints are internal). |
| `NEXT_PUBLIC_SENTRY_DSN` | Same Sentry project; events are tagged with `environment: "preview"` automatically. |
| `SENTRY_ORG` | Same org slug. |
| `SENTRY_PROJECT` | Same project slug. |
| `SENTRY_AUTH_TOKEN` | Same; needed for source-map upload during preview builds. |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | Optional; share if set. |
| `LANGFUSE_PUBLIC_KEY` | Optional; share if set. |
| `LANGFUSE_SECRET_KEY` | Optional; share if set. |
| `LANGFUSE_BASE_URL` | Optional; share if set. |

> **`VERCEL_URL`** — auto-injected by Vercel on every deployment. Do **not** set it manually.
> **`VERCEL_ENV`** / **`NEXT_PUBLIC_VERCEL_ENV`** — auto-injected. Do **not** set manually.

### Isolated vars — new values for Preview scope only

Create **new** entries scoped to **Preview** with the preview-specific values generated in Step 1:

| Variable | Value |
|----------|-------|
| `WHATSAPP_PHONE_NUMBER_ID` | Phone Number ID of the preview WhatsApp number |
| `WHATSAPP_ACCESS_TOKEN` | Permanent token for the preview number |
| `WHATSAPP_APP_SECRET` | Meta app secret (same app → same value; separate app → new value) |
| `WHATSAPP_WEBHOOK_TOKEN` | Random token from Step 2d |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Preview number in E.164 **without** `+` (e.g. `5511999990000`) |
| `OPERATOR_WHATSAPP_NUMBER` | Your personal number for preview alerts (same as production is fine) |

---

## 4. Step 3 — Configure the Meta webhook for Preview

1. In Meta Developers → your app → **WhatsApp** → **Configuration**.
2. Under **Webhook**, click **Edit**.
3. Set **Callback URL** to:
   ```
   https://mascotinhos-git-preview-m-giovani.vercel.app/api/whatsapp/webhook
   ```
   *(Replace the Vercel scope slug if your project is under a different team.)*
4. Set **Verify Token** to the value you chose for `WHATSAPP_WEBHOOK_TOKEN` (preview).
5. Click **Verify and Save**. Meta will send a `GET` to the URL above with `hub.challenge` — the app must respond with the challenge. This requires the `preview` branch to already be deployed.
6. Subscribe to the `messages` field.

> **Tip**: The `preview` branch webhook coexists with the Production webhook — Meta calls each registered webhook URL independently. You can have both active simultaneously.

---

## 5. Step 4 — Verification

1. Open a PR or push directly to the `preview` branch.
2. Wait for the Vercel Preview deployment to finish. It should **pass** `next build` with no env validation errors.
3. Send a WhatsApp message to the preview number.
4. Confirm the reply comes from the preview deployment (check Vercel function logs).
5. Confirm no messages appear in the Production Vercel logs.
6. In Sentry, confirm the event's `environment` tag is `"preview"`, not `"production"`.

---

## 6. Ongoing: creating a new feature branch PR

- Feature-branch PRs (e.g. `feat/my-feature → main`) get ephemeral Vercel URLs — useful for visual/UI review.
- They will **not** receive WhatsApp webhooks (Meta only calls the registered stable URL).
- For end-to-end WhatsApp testing of a feature, merge it into `preview` first.

---

## 7. Variable reference

Full variable list with scope and source. All vars map 1-to-1 to `packages/env/src/server-schema.ts` and `packages/env/src/client-schema.ts`.

| Variable | Schema | Scope | Source |
|----------|--------|-------|--------|
| `DATABASE_URL` | server | Shared | Supabase dashboard → Settings → Database |
| `DIRECT_URL` | server (optional) | Shared | Same as above (direct port 5432) |
| `SUPABASE_URL` | server | Shared | Supabase dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Shared | Supabase dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_URL` | client | Shared | Same as `SUPABASE_URL` |
| `OPENAI_API_KEY` | server | Shared | platform.openai.com |
| `GOOGLE_GENERATIVE_AI_API_KEY` | server (optional) | Shared | Google AI Studio |
| `ASAAS_API_KEY` | server | Shared | Asaas dashboard |
| `ASAAS_WEBHOOK_SECRET` | server | Shared | Asaas dashboard |
| `ASAAS_SPLIT_WALLET_ID` | server (optional) | Shared | Asaas dashboard |
| `WHATSAPP_PHONE_NUMBER_ID` | server | **Isolated** | Meta Developers → WhatsApp → API Setup |
| `WHATSAPP_ACCESS_TOKEN` | server | **Isolated** | Meta Developers → System Users |
| `WHATSAPP_APP_SECRET` | server | Shared* | Meta Developers → App Settings → Basic |
| `WHATSAPP_WEBHOOK_TOKEN` | server | **Isolated** | `openssl rand -hex 32` |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | client | **Isolated** | Your preview phone number (E.164 sans `+`) |
| `OPERATOR_WHATSAPP_NUMBER` | server | Shared | Your personal number |
| `UPSTASH_REDIS_REST_URL` | server | Shared | Upstash console |
| `UPSTASH_REDIS_REST_TOKEN` | server | Shared | Upstash console |
| `QSTASH_TOKEN` | server | Shared | Upstash QStash console |
| `QSTASH_CURRENT_SIGNING_KEY` | server | Shared | Upstash QStash console |
| `QSTASH_NEXT_SIGNING_KEY` | server | Shared | Upstash QStash console |
| `CRON_SECRET` | server | Shared | `openssl rand -hex 32` |
| `NEXT_PUBLIC_SENTRY_DSN` | client (optional) | Shared | Sentry dashboard → Project → DSN |
| `SENTRY_ORG` | build | Shared | Sentry org slug |
| `SENTRY_PROJECT` | build | Shared | Sentry project slug |
| `SENTRY_AUTH_TOKEN` | build | Shared | Sentry → Settings → Auth Tokens |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | client (optional) | Shared | Umami dashboard |
| `LANGFUSE_PUBLIC_KEY` | server (optional) | Shared | Langfuse dashboard |
| `LANGFUSE_SECRET_KEY` | server (optional) | Shared | Langfuse dashboard |
| `LANGFUSE_BASE_URL` | server (optional) | Shared | Langfuse dashboard |
| `VERCEL_URL` | server | **Auto** | Vercel system var — do not set |
| `VERCEL_ENV` | — | **Auto** | Vercel system var — do not set |
| `NEXT_PUBLIC_VERCEL_ENV` | — | **Auto** | Vercel system var — do not set |

\* `WHATSAPP_APP_SECRET` can be shared if you reuse the same Meta app for both numbers. Create a separate Meta app only if you need full webhook isolation.

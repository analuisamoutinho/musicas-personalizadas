# Story 6.4: Privacy Policy and Terms of Service Pages

**Epic:** 6 — Landing Page
**Story ID:** 6.4
**GitHub Issue:** [mgiovani/fotos#70](https://github.com/mgiovani/fotos/issues/70)
**Status:** review
**Created:** 2026-03-30

---

## User Story

As a visitor or client,
I want to read the privacy policy and terms of service,
So that I understand how my child's data is handled and what the service terms are.

---

## Acceptance Criteria

1. **Given** a visitor navigates to `/privacy`
   **When** the page renders
   **Then** the privacy policy page covers: LGPD compliance, children's data handling, 30-day auto-delete policy, DPA with OpenAI disclosure, consent mechanism, data minimization practices

2. **Given** a visitor navigates to `/terms`
   **When** the page renders
   **Then** the terms of service page covers: ECA Digital (Lei 15.211/2025) parental consent, AI generation disclosure, revision policy (2 rounds included), delivery obligations, payment terms, consumer protection (CDC)

3. **Given** any page of the site
   **When** the visitor sees the footer
   **Then** both "Política de Privacidade" and "Termos de Uso" links in the footer navigate correctly to `/privacy` and `/terms` respectively (footer links already use `<a href>` — upgrade to Next.js `<Link>`)

4. **Given** the WhatsApp bot LGPD consent message (already implemented in Story 2.X)
   **When** the consent message is sent
   **Then** the privacy policy URL in the bot matches the deployed `/privacy` page — no story code change needed, this is a verification requirement

5. **Given** a visitor loads `/privacy` or `/terms` on mobile
   **When** the page renders
   **Then** both pages are statically generated (no client-side JavaScript required), use the same Navbar and Footer as the landing page, and are responsive with the site design system

6. **Given** the page `<head>` metadata
   **When** the page is indexed
   **Then** each page has appropriate `<title>` and `<meta name="description">` in Brazilian Portuguese via `export const metadata`

---

## Technical Context

### Stack & Constraints (DO NOT change these — inherited from Stories 6.1–6.3)

- **Framework:** Next.js 16 (`apps/web`) — App Router, `typedRoutes: true`, `reactCompiler: true`
- **Styling:** Tailwind CSS v4 (CSS-first config) — **no** `tailwind.config.ts` — configured in `packages/ui/src/styles/globals.css`
- **UI Components:** shadcn/ui in `packages/ui` — available: `Button`, `Card`, `Skeleton`, `Checkbox`, `DropdownMenu`, `Input`, `Label`, `Sonner`
- **Icons:** `lucide-react` only
- **Fonts:** Already configured — `Plus_Jakarta_Sans` (font-headline) + `Be_Vietnam_Pro` (font-body) via `next/font/google` in `apps/web/src/app/layout.tsx`
- **Package manager:** Bun — use `bun add`, never `npm install`
- **Env access:** `@mascotinhos/env/web` for client vars — these pages are fully static, no env vars needed
- **NO database access** — these are fully static pages, no Prisma import

### Design Tokens (Already in globals.css — DO NOT re-add)

| Tailwind class | Value | Usage |
|---|---|---|
| `bg-surface` | `#fff4f5` | Page background |
| `bg-surface-container-lowest` | `#ffffff` | Card / section background |
| `text-on-surface` | `#352d2f` | Headings |
| `text-on-surface-variant` | `#63595c` | Body text |
| `text-primary` | `#b10b68` | Links, accent |
| `font-headline` | Plus Jakarta Sans | Headings |
| `font-body` | Be Vietnam Pro | Body |

### What Previous Stories Already Created (DO NOT touch)

Story 6.1 created:
- `apps/web/src/app/layout.tsx` — Root layout with fonts, `lang="pt-BR"`, metadata
- `apps/web/src/components/landing/navbar.tsx` — Navbar component
- `apps/web/src/components/landing/footer.tsx` — Footer with `/privacy` and `/terms` links already hardcoded as `<a href>` (comment says "Story 6.4 will create the pages")
- `apps/web/src/lib/whatsapp.ts` — `buildWhatsAppLink(phoneNumber, message)` helper

**Footer already has these nav links pointing to `/privacy` and `/terms`** — the pages just don't exist yet. Creating the route files is the main work.

### Footer Link Upgrade (AC #3)

The footer currently uses raw `<a>` tags for internal navigation (comment: `/* /privacy and /terms pages are Story 6.4 */`). Upgrade these to Next.js `<Link>` for client-side prefetching:

```tsx
// footer.tsx — before (raw <a> tags):
<a href="/privacy">Política de Privacidade</a>
<a href="/terms">Termos de Uso</a>

// footer.tsx — after (Next.js <Link>):
import Link from "next/link";
<Link href="/privacy">Política de Privacidade</Link>
<Link href="/terms">Termos de Uso</Link>
```

**IMPORTANT:** Replace ONLY the two internal `<a>` links (`/privacy` and `/terms`). The WhatsApp `<a href={waLink}>` is external — keep it as `<a>`. The hash links (`#como-funciona`, `#contato`) are also internal anchors; these can remain as `<a>` since they're same-page anchors and Next.js `<Link>` would require extra handling.

### File Structure to Create

```
apps/web/src/app/
├── privacy/
│   └── page.tsx          # /privacy route — Privacy Policy page
└── terms/
    └── page.tsx          # /terms route — Terms of Service page
```

**Update one existing file:**
- `apps/web/src/components/landing/footer.tsx` — upgrade `/privacy` and `/terms` `<a>` to `<Link>`

### Page Layout Pattern

Both pages follow the same structural pattern as the landing page — reuse `Navbar` and `Footer`:

```tsx
// apps/web/src/app/privacy/page.tsx
import type { Metadata } from "next";
import Navbar from "@/components/landing/navbar";
import Footer from "@/components/landing/footer";
import { env } from "@mascotinhos/env/web";

export const metadata: Metadata = {
  title: "Política de Privacidade — Mascotinhos Festa",
  description: "Como tratamos seus dados e os dados do seu filho conforme a LGPD.",
};

export default function PrivacyPage() {
  const phoneNumber = env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  return (
    <>
      <Navbar />
      <main className="bg-surface min-h-screen pt-20">
        <div className="max-w-3xl mx-auto px-6 py-16">
          {/* Content sections */}
        </div>
      </main>
      <Footer phoneNumber={phoneNumber} />
    </>
  );
}
```

**Note:** `Footer` requires `phoneNumber: string` prop — pass `env.NEXT_PUBLIC_WHATSAPP_NUMBER`. This is a client-side env var (`NEXT_PUBLIC_`), safe to read in Server Components via `@mascotinhos/env/web`.

**Note:** `Navbar` component accepts no props — just `<Navbar />`.

### Privacy Policy Content Requirements (AC #1)

Content MUST be in **Brazilian Portuguese**. All of the following topics must be covered:

| Topic | Required Content |
|---|---|
| Data controller | Mascotinhos Festa, contact via WhatsApp |
| Legal basis | LGPD Art. 7, I (consent) and Art. 14 (children's data) |
| Children's data | Collected with explicit parental consent; photo used only for illustration generation |
| Data collected | WhatsApp number, first name, reference photo, order details |
| Data minimization | Only data strictly necessary for the service is collected |
| Purpose | Generating personalized mascotinho illustrations |
| 30-day auto-delete | Reference photos automatically deleted 30 days after order delivery |
| Data processor | OpenAI Inc. as sub-processor (Data Processing Agreement in place); photo transmitted via API |
| Data subject rights | LGPD Art. 18: access, correction, deletion, portability, revocation of consent |
| Consent revocation | Client may contact via WhatsApp to request data deletion |
| Security | HTTPS, access controls, Supabase Storage encryption at rest |
| ANPD | Right to file complaint with Autoridade Nacional de Proteção de Dados |
| Last updated | March 2026 |

### Terms of Service Content Requirements (AC #2)

Content MUST be in **Brazilian Portuguese**. All of the following topics must be covered:

| Topic | Required Content |
|---|---|
| Service description | AI-generated personalized illustration for children's parties via WhatsApp |
| ECA Digital consent | Lei 15.211/2025: parent/guardian ordering implicitly authorizes commercial use of child's image for illustration generation; explicit statement of parental authorization required |
| AI generation disclosure | Images generated using artificial intelligence (OpenAI GPT Image); output assigned to the buyer per OpenAI ToS |
| Price and payment | R$29,90 via PIX; order confirmed after payment confirmation |
| Delivery | Digital delivery via WhatsApp within ~30 minutes after payment (subject to queue) |
| Revision policy | 2 revision rounds included; feedback via WhatsApp; revision #3+ at operator discretion |
| Consumer protection | CDC Art. 49: 7-day withdrawal right for digital products (nuanced — explain that the product is personalized/consumed digital content); chargebacks via Asaas dispute process |
| Prohibited use | Illustrations may not be used for commercial resale or defamatory content |
| Limitation of liability | Service delivered as-is; no guarantee of physical resemblance beyond reasonable effort |
| Intellectual property | AI-generated output assigned to buyer; Mascotinhos Festa retains no ownership over individual orders |
| Governing law | Lei Brasileira; Foro da Comarca de São Paulo |
| Last updated | March 2026 |

### Typography Pattern for Legal Pages

Use consistent heading/body hierarchy:

```tsx
// H1: Page title
<h1 className="text-3xl font-bold text-on-surface font-headline mb-8">
  Política de Privacidade
</h1>

// H2: Section heading
<h2 className="text-xl font-bold text-on-surface font-headline mt-10 mb-4">
  1. Dados que Coletamos
</h2>

// Body paragraph
<p className="text-on-surface-variant font-body leading-relaxed mb-4">
  ...
</p>

// Unordered list
<ul className="list-disc list-inside space-y-2 text-on-surface-variant font-body mb-4">
  <li>...</li>
</ul>

// Last updated notice
<p className="text-sm text-on-surface-variant font-body mt-12 border-t border-surface-container pt-6">
  Última atualização: março de 2026
</p>
```

---

## Architecture & Anti-Patterns to Avoid

1. **NO "use client"** — These are fully static Server Components. No interactivity needed.
2. **NO Prisma import** — These pages don't query the database. Do not add `import prisma`.
3. **NO new dependencies** — All needed packages are already installed.
4. **NO dark mode** — Light-only for MVP. No `dark:` variants.
5. **NO 1px borders** — Use tonal surface shifts per design system (e.g., `border-surface-container`).
6. **NO `export const revalidate`** — These are fully static pages with no data fetching. Next.js will statically generate them automatically (no ISR needed).
7. **DO NOT modify `apps/web/src/app/layout.tsx`** — the root layout already has correct `lang="pt-BR"` and metadata; page-level `export const metadata` overrides only the specific page.
8. **Footer phoneNumber prop** — `Footer` is not optional; always pass `phoneNumber`. Get it from `env.NEXT_PUBLIC_WHATSAPP_NUMBER` (`@mascotinhos/env/web`).

---

## Accessibility Requirements

- `<main>` element with descriptive content
- Heading hierarchy: `<h1>` for page title, `<h2>` for sections, `<h3>` for subsections if needed
- All links in legal text use `<a>` with descriptive text (no "clique aqui")
- Sufficient color contrast: `text-on-surface-variant` (`#63595c`) on `bg-surface` (`#fff4f5`) meets WCAG AA
- Responsive text: no fixed font sizes below `text-sm`

---

## Previous Story Intelligence (Stories 6.1–6.3)

- **Navbar** accepts no props: `<Navbar />`
- **Footer** requires `{ phoneNumber: string }` prop — look at `footer.tsx` to confirm signature
- **Env access pattern in page.tsx:** `import { env } from "@mascotinhos/env/web"` then `env.NEXT_PUBLIC_WHATSAPP_NUMBER`
- **No `"use client"` directive** in any landing page component — maintain Server Component purity
- **`overflow-hidden` lesson (Story 6.3 review H1):** Not relevant to legal pages but remember: when using `rounded-*`, pair with `overflow-hidden` on the container
- **`aria-labelledby` over `aria-label` on sections** — use `aria-labelledby` pointing to the `<h1>` id for the `<main>` landmark if desired
- **No shadcn Badge** installed — use `<span>` with Tailwind (not relevant to these pages)
- **`bun run check-types`** must pass after implementation

---

## Testing

1. **TypeScript check:** `cd mascotinhos && bun run check-types` — must pass with zero new errors
2. **Build check:** `cd mascotinhos && turbo -F web build` — verifies static generation of both new routes
3. **Manual verification:**
   - `bun run dev:web` from `mascotinhos/`
   - Navigate to `http://localhost:3001/privacy` — verify page renders with Navbar + Footer
   - Navigate to `http://localhost:3001/terms` — verify page renders with Navbar + Footer
   - Click footer "Política de Privacidade" link — must navigate to `/privacy`
   - Click footer "Termos de Uso" link — must navigate to `/terms`
   - Verify all required LGPD/legal topics present in content
   - Check mobile viewport: text readable without horizontal scroll

---

## Tasks / Subtasks

- [x] Task 1: Create `/privacy` page route (AC: #1, #5, #6)
  - [x] Create `apps/web/src/app/privacy/page.tsx`
  - [x] Export `metadata` with Portuguese title and description
  - [x] Render `<Navbar />` and `<Footer phoneNumber={...} />` (get phoneNumber from `@mascotinhos/env/web`)
  - [x] Write full Privacy Policy content in Brazilian Portuguese covering all required topics (LGPD, children's data, 30-day delete, OpenAI DPA, data subject rights)
  - [x] Apply correct typography hierarchy: `h1`, `h2`, body paragraphs, lists using design tokens

- [x] Task 2: Create `/terms` page route (AC: #2, #5, #6)
  - [x] Create `apps/web/src/app/terms/page.tsx`
  - [x] Export `metadata` with Portuguese title and description
  - [x] Render `<Navbar />` and `<Footer phoneNumber={...} />` (get phoneNumber from `@mascotinhos/env/web`)
  - [x] Write full Terms of Service content in Brazilian Portuguese covering all required topics (ECA Digital, AI disclosure, revision policy, CDC, payment terms)
  - [x] Apply correct typography hierarchy using design tokens

- [x] Task 3: Upgrade footer internal links to Next.js `<Link>` (AC: #3)
  - [x] Open `apps/web/src/components/landing/footer.tsx`
  - [x] Add `import Link from "next/link"` at the top
  - [x] Replace `<a href="/privacy">` with `<Link href="/privacy">` (preserve all className/aria attributes)
  - [x] Replace `<a href="/terms">` with `<Link href="/terms">` (preserve all className/aria attributes)
  - [x] Keep `<a href={waLink}>` (external WhatsApp link) unchanged
  - [x] Keep `<a href="#como-funciona">` and `<a href="#contato">` unchanged (hash anchors)
  - [x] Used `as const` on `internalPageLinks` array to satisfy `typedRoutes: true` literal type requirement

- [x] Task 4: Verify TypeScript and build
  - [x] Run `tsc --noEmit` from `apps/web` — zero new errors (only pre-existing `bun:test` TS2307)
  - [x] Run turbo build — both `/privacy` and `/terms` routes registered in `.next/types/link.d.ts`

---

## Dev Notes

- **Static pages only** — No `revalidate`, no `async`, no Prisma. Both pages are pure static Server Components with hardcoded content.
- **`env` in static pages** — Even though there's no data fetching, `Footer` requires the phone number. Use `env.NEXT_PUBLIC_WHATSAPP_NUMBER` from `@mascotinhos/env/web`. This is a `NEXT_PUBLIC_` var so it's embedded at build time.
- **`navLinks` in footer.tsx** — The footer has a `navLinks` array with the `/privacy` and `/terms` entries already defined. The map renders them as `<a>` tags. Refactor to use `<Link>` for these two entries. The simplest approach: update the map's render logic, not the `navLinks` array definition.
- **Content language** — All user-facing text must be in Brazilian Portuguese (pt-BR). This is a legal requirement and matches `lang="pt-BR"` on `<html>`.
- **Legal accuracy** — Base the legal content on the compliance requirements documented in the PRD (Section: Legal & Regulatory Compliance). The content is for an MVP — use clear, plain language. This is not a formal law firm opinion.

### References

- [Source: .bmad_output/planning-artifacts/epics.md — Story 6.4]
- [Source: .bmad_output/planning-artifacts/prd.md — Legal & Regulatory Compliance section]
- [Source: mascotinhos/apps/web/src/components/landing/footer.tsx — existing footer with /privacy and /terms links]
- [Source: mascotinhos/apps/web/src/app/layout.tsx — root layout pattern]
- [Source: mascotinhos/apps/web/src/app/page.tsx — env and Navbar/Footer usage pattern]
- [Source: .bmad_output/implementation-artifacts/6-3-style-template-browser-with-cta-links.md — previous story patterns]

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes

- `/privacy` page: pure static Server Component with `export const metadata`, renders `<Navbar />` and `<Footer phoneNumber={...}>`. Content covers all 10 LGPD/privacy topics: controller identification, data collected, children's data treatment (LGPD Art. 14), legal basis, 30-day auto-delete, OpenAI as sub-processor with DPA disclosure, security measures, LGPD Art. 18 data subject rights, ANPD petition right, and policy updates section. Full Brazilian Portuguese.
- `/terms` page: pure static Server Component with `export const metadata`. Content covers all 12 ECA/legal topics: service description, ECA Digital (Lei 15.211/2025) parental authorization, AI generation disclosure (OpenAI GPT Image, ownership to buyer), pricing (R$29,90 via PIX), delivery (~30 min), 2-round revision policy, CDC Art. 49 withdrawal right nuance for personalized digital products, permitted/prohibited use, liability limitation, IP ownership, governing law (São Paulo, Brazil), and terms update policy.
- Footer upgrade: separated `navLinks` into `internalPageLinks` (with `as const` for `typedRoutes: true` literal types) and `anchorLinks`. `/privacy` and `/terms` now use `<Link>` for client-side prefetching; hash links and external WhatsApp link unchanged.
- TypeScript: zero new errors — only pre-existing `bun:test` TS2307 in unrelated test files. Both `/privacy` and `/terms` routes registered in `.next/types/link.d.ts` after build run.
- All 6 Acceptance Criteria satisfied.

### File List

- `mascotinhos/apps/web/src/app/privacy/page.tsx` (created)
- `mascotinhos/apps/web/src/app/terms/page.tsx` (created)
- `mascotinhos/apps/web/src/components/landing/footer.tsx` (modified — import Link, split navLinks into internalPageLinks/anchorLinks, upgrade /privacy and /terms to <Link>)

---

## Change Log

- 2026-03-30: Story 6.4 created — privacy policy and terms of service static pages
- 2026-03-30: Story 6.4 implemented — /privacy and /terms pages created, footer links upgraded to Next.js <Link>

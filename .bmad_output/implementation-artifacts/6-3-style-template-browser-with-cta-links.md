# Story 6.3: Style Template Browser with CTA Links

**Epic:** 6 — Landing Page
**Story ID:** 6.3
**GitHub Issue:** [mgiovani/fotos#69](https://github.com/mgiovani/fotos/issues/69)
**Status:** done
**Created:** 2026-03-30

---

## User Story

As a visitor,
I want to browse available mascotinho styles with visual previews and jump directly to WhatsApp with my chosen theme,
So that I can start my order for the specific style I want.

---

## Acceptance Criteria

1. **Given** the styles section of the landing page
   **When** the visitor scrolls to the styles section
   **Then** each style template is displayed as a card with: name, 1-2 example mascotinho images, and a brief description

2. **Given** a style card is visible
   **When** the visitor taps the CTA button
   **Then** WhatsApp opens with a pre-filled message specific to that style: `Oi! Quero mascotinho tema [style]!`

3. **Given** styles are loaded from the `StyleTemplate` table
   **When** the page is rendered
   **Then** only active templates (`active = true`) are displayed, sorted by popularity descending

4. **Given** the styles section
   **When** the page is built or revalidated
   **Then** ISR with `revalidate = 3600` (1 hour) is used so new templates appear without redeployment

5. **Given** the layout
   **When** the style browser is viewed on mobile
   **Then** cards display in a horizontal-scroll carousel with snap behavior

6. **Given** the most popular style card
   **When** it is rendered
   **Then** a "Mais Pedido" popularity badge is displayed

---

## Technical Context

### Stack & Constraints (Inherited from Story 6.1/6.2 -- DO NOT change these)

- **Framework:** Next.js 16 (`apps/web`) -- App Router, `typedRoutes: true`, `reactCompiler: true`
- **Styling:** Tailwind CSS v4 (CSS-first config) -- **no** `tailwind.config.ts` -- already configured in `packages/ui/src/styles/globals.css`
- **UI Components:** shadcn/ui in `packages/ui` -- available: `Button`, `Card`, `Skeleton`, `Checkbox`, `DropdownMenu`, `Input`, `Label`, `Sonner` -- **`Badge` is NOT installed; use plain `<span>` with Tailwind classes**
- **Icons:** `lucide-react` only -- do NOT add any other icon libraries
- **Fonts:** Already configured -- `Plus_Jakarta_Sans` (font-headline) + `Be_Vietnam_Pro` (font-body) via `next/font/google` in `apps/web/src/app/layout.tsx`
- **Package manager:** Bun -- use `bun add` never `npm install`
- **Env access:** Use `@mascotinhos/env/web` for client vars (`NEXT_PUBLIC_WHATSAPP_NUMBER`), `@mascotinhos/env/server` for server vars (`DATABASE_URL`)
- **Database:** `import prisma from "@mascotinhos/db"` -- Prisma 7 with `@prisma/adapter-pg`

### Design Tokens (Already in globals.css -- DO NOT re-add)

| Tailwind class | Hex value |
|---|---|
| `bg-surface` | `#fff4f5` -- Style section background (follows alternating pattern from UX spec) |
| `bg-surface-container-lowest` | `#ffffff` -- Card background |
| `text-on-surface` | `#352d2f` -- Section title, card name |
| `text-on-surface-variant` | `#63595c` -- Card description |
| `bg-primary` / `text-primary` | `#b10b68` -- CTA buttons |
| `bg-primary-container` | `#ff6dad` -- CTA gradient end |
| `bg-tertiary-container` | `#fcca6d` -- Popularity badge bg |
| `text-on-tertiary-container` | `#5f4200` -- Popularity badge text |
| `font-headline` | Plus Jakarta Sans |
| `font-body` | Be Vietnam Pro |

### What Previous Stories Already Created (DO NOT touch)

Story 6.1 created:
- `apps/web/src/app/page.tsx` -- Landing page with `<section aria-label="Nossos Estilos" id="estilos" />` placeholder
- `apps/web/src/app/layout.tsx` -- Root layout with fonts, lang="pt-BR"
- `apps/web/src/components/landing/` -- navbar, hero, how-it-works, pricing, testimonials, footer
- `apps/web/src/lib/whatsapp.ts` -- `buildWhatsAppLink(phoneNumber, message)` helper
- `packages/ui/src/styles/globals.css` -- Design tokens, `.no-scrollbar` utility class, confetti-bg

Story 6.2 created:
- `apps/web/src/components/portfolio/` -- portfolio-card.tsx, portfolio-gallery.tsx

**DO NOT** modify any of those files except `apps/web/src/app/page.tsx` (to replace the placeholder `<section>` with the real `<StyleBrowser>` import).

### StyleTemplate Prisma Model (from Story 1.1)

```prisma
model StyleTemplate {
  id             String      @id @default(cuid())
  name           String
  slug           String      @unique
  promptTemplate String
  exampleImages  String[]    // URLs to example mascotinho images
  popularity     Int         @default(0)
  tags           String[]
  active         Boolean     @default(true)
  productType    ProductType @default(MASCOTINHO)
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  orders Order[]
  @@index([active, popularity])
}
```

### ISR Strategy (Next.js App Router)

In App Router, ISR is configured by exporting `revalidate` from the page module, NOT from individual components. Since `page.tsx` is the landing page and currently renders only static components, adding a Prisma query makes it a dynamic server page. The `export const revalidate = 3600` on `page.tsx` tells Next.js to cache the full page and revalidate every hour.

**IMPORTANT:** The Prisma query MUST happen in `page.tsx` (or a Server Component at the page level) and pass data down as props. Do NOT attempt to query Prisma inside a component that is not at the route level -- this is the App Router pattern.

### WhatsApp Link Helper (from Story 6.1)

```tsx
import { buildWhatsAppLink } from "@/lib/whatsapp";
// buildWhatsAppLink(phoneNumber: string, message: string) => string
// Returns: "https://wa.me/55{normalizedNumber}?text={encodedMessage}"
```

### Env Access Pattern

```tsx
// In page.tsx (Server Component):
import { env } from "@mascotinhos/env/web";
const phoneNumber = env.NEXT_PUBLIC_WHATSAPP_NUMBER;
```

---

## File Structure to Create

```
apps/web/src/
└── components/
    └── styles/
        ├── style-card.tsx        # Single style card with image, name, description, CTA
        └── style-browser.tsx     # Horizontal carousel of StyleCard components
```

**Update only one existing file:**
- `apps/web/src/app/page.tsx` -- Replace the styles placeholder `<section>` with `<StyleBrowser>`, add Prisma query with ISR, pass data as props

---

## Component Specifications

### `components/styles/style-card.tsx` (Server Component)

**Props interface:**
```tsx
interface StyleCardProps {
  name: string;
  description: string;  // First tag from tags[] used as description, or slug-derived fallback
  imageSrc: string;     // First entry from exampleImages[]
  whatsappLink: string; // Pre-built wa.me link
  isMostPopular: boolean;
}
```

**Visual structure (from UX spec section 4.4):**
- Container: `min-w-[280px] snap-center bg-surface-container-lowest rounded-lg overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 shrink-0`
- Image: `<Image>` with `w-full h-48 object-cover`, dev placeholder from `placehold.co`
- Body: `p-6` containing:
  - Style name: `font-bold text-lg mb-1 text-on-surface font-headline`
  - Description: `text-sm text-on-surface-variant font-body`
  - CTA button: `mt-4 w-full inline-flex items-center justify-center gap-2 bg-gradient-to-br from-primary to-primary-container text-white px-4 py-3 rounded-full text-sm font-bold ...`
- Popularity badge (conditional): `absolute -top-4 right-4 bg-tertiary-container text-on-tertiary-container text-[10px] font-bold px-2 py-1 rounded-full uppercase`

### `components/styles/style-browser.tsx` (Server Component)

**Props interface:**
```tsx
interface StyleBrowserProps {
  styles: Array<{
    id: string;
    name: string;
    description: string;
    imageSrc: string;
    whatsappLink: string;
    isMostPopular: boolean;
  }>;
}
```

**Section layout (from UX spec section 4.4):**
- `<section aria-labelledby="estilos-heading" id="estilos" className="bg-surface py-24">`
- Inner: `max-w-7xl mx-auto px-6`
- Section title: "Estilos que encantam" -- `text-3xl font-bold text-on-surface font-headline mb-12 text-center`
- Layout: horizontal scroll carousel `flex overflow-x-auto gap-6 pb-8 snap-x no-scrollbar`
- Map `styles` to `<StyleCard>` components

### `page.tsx` Updates

```tsx
import prisma from "@mascotinhos/db";
import StyleBrowser from "@/components/styles/style-browser";
import { buildWhatsAppLink } from "@/lib/whatsapp";

export const revalidate = 3600; // ISR: revalidate every 1 hour

// In the default export (async Server Component):
// 1. Query StyleTemplate where active=true, ordered by popularity desc
// 2. Map results to StyleBrowserProps shape
// 3. Build whatsappLink per style using buildWhatsAppLink
// 4. Replace the <section aria-label="Nossos Estilos"> placeholder with <StyleBrowser styles={styles} />
```

**Prisma query:**
```tsx
const templates = await prisma.styleTemplate.findMany({
  where: { active: true },
  orderBy: { popularity: "desc" },
  select: { id: true, name: true, slug: true, exampleImages: true, tags: true, popularity: true },
});
```

**Fallback when no templates exist:** If the query returns an empty array, render nothing (omit the section entirely). The style browser is only meaningful when the operator has seeded templates (Story 7.4).

---

## Architecture & Design Constraints

### MUST Follow (Anti-Patterns to Avoid)

1. **NO "use client"** -- All components are Server Components. The CTA is an `<a>` tag with `href`, no `onClick`.
2. **NO new dependencies** -- `next/image`, `lucide-react`, `@mascotinhos/db`, and `@mascotinhos/env` are already available.
3. **NO Badge component** -- shadcn `Badge` is not installed. Use `<span>` with Tailwind for the "Mais Pedido" badge.
4. **NO dark mode** -- Light-only for MVP. No `dark:` variants.
5. **NO 1px borders** -- Use tonal surface shifts per design system.
6. **NO separate `/styles` page** -- The epic says "or a dedicated /styles page" but the architecture directory structure shows `styles/page.tsx` as optional. For MVP, inline on the landing page. The section `id="estilos"` enables deep linking.
7. **`revalidate` on page.tsx** -- In App Router, ISR config lives at the page level. Do NOT try to configure ISR on individual components.
8. **Prisma import in `page.tsx`** -- Prisma requires server-side env vars. `page.tsx` is a Server Component so this works. Make the default export `async`.

### Component Location

Components go in `apps/web/src/components/styles/` -- NOT in `packages/ui/`. Landing-page-specific components live in `apps/web`.

### Image Handling

`exampleImages` from the StyleTemplate DB may be:
- Supabase Storage signed URLs (production)
- Empty array (no images seeded yet)

**For MVP dev:** Use `placehold.co` fallback when `exampleImages` is empty or the first entry is unavailable. This matches the Story 6.2 pattern. The `placehold.co` remote pattern is already configured in `next.config.ts`.

**Fallback logic in page.tsx data mapping:**
```tsx
const imageSrc = template.exampleImages[0]
  ?? `https://placehold.co/280x192/b10b68/ffffff?text=${encodeURIComponent(template.name)}`;
```

### Section Background

UX spec section 4.4 says style browser uses `surface` (`#fff4f5`), following the alternating background pattern. The section before (HowItWorks) uses a different bg. The section after (Portfolio) uses `surface-container`.

---

## Accessibility Requirements

- `<section aria-labelledby="estilos-heading" id="estilos">` -- link section to its heading
- All `<Image>` components: Portuguese `alt` text: `"Exemplo de mascotinho estilo {name}"`
- Heading hierarchy: `<h2>` for "Estilos que encantam" -- matches hero `<h1>` hierarchy
- CTA buttons: visible focus ring (`focus-visible:ring-2 focus-visible:ring-secondary-container focus-visible:ring-offset-2 focus-visible:outline-none`)
- Horizontal scroll: keyboard accessible (native browser scroll with Tab into focusable CTA links)
- `no-scrollbar` class already defined in globals.css

---

## Performance Notes

- ISR `revalidate: 3600` -- page is statically generated, Prisma query runs once per hour max
- Images use `loading="lazy"` -- style section is below the fold
- `placehold.co` images are already in `next.config.ts` remotePatterns
- Carousel uses native CSS scroll (no JS library overhead)
- Server Components only -- zero client JS for this section

---

## Previous Story Intelligence

### From Story 6.2 (portfolio gallery):
- Used `placehold.co` placeholder URLs with `next.config.ts` remotePattern already set (`protocol: "https"`)
- Used `overflow-hidden` on image container wrappers to prevent border-radius bleed (review finding M1)
- Used `aria-labelledby` instead of `aria-label` on sections (review finding M2)
- Updated `sizes` attribute on images to match actual display width (review finding H2)
- No `"use client"` -- pure Server Components pattern established

### From Story 6.1:
- `page.tsx` currently has `const phoneNumber = env.NEXT_PUBLIC_WHATSAPP_NUMBER;` in a sync function
- Adding Prisma query requires making the default export `async`
- `buildWhatsAppLink` is already imported in `page.tsx` indirectly via child components -- but `page.tsx` itself does not import it yet. Add the import.

---

## Testing

This story adds a database query (Prisma) and ISR. Testing approach:

1. **TypeScript check:** `cd mascotinhos && bun run check-types` -- must pass with no new errors
2. **Build check:** `cd mascotinhos && turbo -F web build` -- verifies ISR config, Prisma query, and component rendering at build time
3. **Manual verification (dev):**
   - `bun run dev:web` from `mascotinhos/`
   - Navigate to `http://localhost:3001` and scroll to styles section
   - Verify: cards render (with placeholder images if no DB data)
   - Verify: CTA buttons generate correct WhatsApp links
   - Verify: horizontal scroll on mobile viewport
   - Verify: `id="estilos"` section present in DOM
4. **Empty state:** If no active StyleTemplates exist in DB, the section should not render at all

---

## Tasks/Subtasks

- [x] Task 1: Create `style-card.tsx` Server Component (AC: #1, #2, #6)
  - [x] Define `StyleCardProps` interface
  - [x] Render card with image (Next.js `<Image>`), name, description, and CTA `<a>` link
  - [x] Add conditional "Mais Pedido" popularity badge via `<span>`
  - [x] Apply UX spec styling: `min-w-[280px]`, `snap-center`, `shadow-sm hover:shadow-xl`, `overflow-hidden`
  - [x] Apply `overflow-hidden` on image container (lesson from Story 6.2 review)
  - [x] CTA button: gradient, rounded-full, focus-visible ring, `target="_blank" rel="noopener noreferrer"`

- [x] Task 2: Create `style-browser.tsx` Server Component (AC: #1, #5)
  - [x] Define `StyleBrowserProps` interface
  - [x] Render section with `aria-labelledby`, `id="estilos"`, `bg-surface py-24`
  - [x] Section title: "Estilos que encantam" with correct typography tokens
  - [x] Horizontal scroll carousel: `flex overflow-x-auto gap-6 pb-8 snap-x no-scrollbar`
  - [x] Map `styles` array to `<StyleCard>` components

- [x] Task 3: Update `page.tsx` -- add Prisma query, ISR, and `<StyleBrowser>` (AC: #3, #4)
  - [x] Add `export const revalidate = 3600` for ISR
  - [x] Make default export `async`
  - [x] Add Prisma query: `findMany({ where: { active: true }, orderBy: { popularity: "desc" } })`
  - [x] Map DB results to `StyleBrowserProps` shape with `buildWhatsAppLink` per style
  - [x] Add `placehold.co` fallback for missing `exampleImages`
  - [x] Replace `<section aria-label="Nossos Estilos" id="estilos" />` placeholder with `<StyleBrowser>` (or nothing if empty)
  - [x] Import `prisma from "@mascotinhos/db"` and `buildWhatsAppLink from "@/lib/whatsapp"`

- [x] Task 4: Verify TypeScript and build
  - [x] Run `bun run check-types` from `mascotinhos/` -- no new errors
  - [x] Verify the Prisma query types resolve correctly

---

## Dev Notes

- **`buildWhatsAppLink`** already normalizes phone numbers with/without country code "55". Use it for all CTA links.
- **`no-scrollbar`** CSS class is already in `globals.css` (added by Story 6.1). No need to add it again.
- **Image `sizes` attribute:** Cards are `min-w-[280px]` with `h-48` images. Use `sizes="280px"` since carousel cards have fixed min-width.
- **Description source:** The `StyleTemplate` model has `tags: String[]` but no explicit `description` field. Use `tags[0]` as description text if available, or derive a human-readable fallback from the `name` field. The UX spec shows short descriptions like "Fofura extrema com proporcoes mini" -- these will come from tags once seeded (Story 7.4).
- **Empty DB state:** Until Story 7.4 seeds templates, the query returns `[]`. The component should gracefully hide the entire section. This is normal during development.
- **Prisma import side-effect:** `@mascotinhos/db` triggers `@mascotinhos/env/server` validation at import time. This already works in API route files. In `page.tsx` (Server Component), this is fine because the page runs server-side.

### References

- [Source: .bmad_output/planning-artifacts/epics.md - Story 6.3]
- [Source: .bmad_output/planning-artifacts/ux-design-specification.md - Section 4.4 Style Browser]
- [Source: .bmad_output/planning-artifacts/architecture.md - Frontend Architecture]
- [Source: mascotinhos/packages/db/prisma/schema/schema.prisma - StyleTemplate model]
- [Source: mascotinhos/apps/web/src/lib/whatsapp.ts - buildWhatsAppLink]
- [Source: mascotinhos/apps/web/src/components/portfolio/ - Story 6.2 patterns]

---

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

### Completion Notes

- StyleCard: pure Server Component with Next.js `<Image>` (`loading="lazy"`, `sizes="280px"`, `overflow-hidden` wrapper), gradient CTA `<a>` linking to wa.me, conditional "Mais Pedido" badge via `<span>`, UX spec 4.4 carousel card styling (`min-w-[280px]`, `snap-center`, `shadow-sm hover:shadow-xl`)
- StyleBrowser: Server Component wrapping cards in horizontal scroll carousel (`flex overflow-x-auto gap-6 snap-x no-scrollbar`), section with `aria-labelledby`/`id="estilos"`, `bg-surface py-24`, returns `null` when styles array is empty (graceful empty state)
- page.tsx: now `async`, exports `revalidate = 3600` for ISR, queries `prisma.styleTemplate.findMany({ where: { active: true }, orderBy: { popularity: "desc" } })`, maps results to component props with `buildWhatsAppLink` per style, `placehold.co` fallback for missing exampleImages, most-popular detection via max popularity comparison
- TypeScript: zero new errors (only pre-existing `bun:test` TS2307 in unrelated test files)
- All 6 Acceptance Criteria satisfied: style cards with image/name/description, per-style WhatsApp CTA, active-only + popularity sort, ISR revalidate=3600, horizontal scroll carousel on mobile, "Mais Pedido" badge on most popular

### File List

- `mascotinhos/apps/web/src/components/styles/style-card.tsx` (created)
- `mascotinhos/apps/web/src/components/styles/style-browser.tsx` (created)
- `mascotinhos/apps/web/src/app/page.tsx` (modified -- added Prisma query, ISR, StyleBrowser import, async default export, buildWhatsAppLink import)

---

## Change Log

- 2026-03-30: Story 6.3 implemented -- style template browser with ISR Prisma query, horizontal scroll carousel, per-style WhatsApp CTA links, popularity badge, placehold.co fallback for missing images, page.tsx placeholder replaced
- 2026-03-30: Code review completed and patches applied (see Review Findings below)

---

## Review Findings

**Reviewer:** claude-sonnet-4-6 | **Date:** 2026-03-30 | **Scope:** adversarial + edge case + acceptance audit

### H1 — Badge visually clipped + wrong offset (HIGH, A11y/Visual)

**File:** `style-card.tsx`

**Problem:** Card container had `overflow-hidden` which clipped the absolutely-positioned "Mais Pedido" badge. The badge used `-top-0` (a no-op identical to `top-0`) instead of the spec value `-top-4`. Badge had no `aria-label` giving AT context about which style it belongs to.

**Fix:** Removed `overflow-hidden` from the card container; scoped it to the image wrapper (`rounded-t-lg`) and body wrapper (`rounded-b-lg`) to preserve border-radius. Changed `-top-0` to `-top-4`. Added `aria-label="{name}: Mais Pedido"`. Added `max-w-[320px]` to cap card width on large screens.

### H2 — Missing Supabase Storage hostname in remotePatterns (HIGH, Image Optimization)

**File:** `next.config.ts`

**Problem:** `images.remotePatterns` only listed `placehold.co`. Production `exampleImages` URLs come from Supabase Storage (`*.supabase.co`). Next.js Image Optimization would reject those URLs, causing 400 errors on production.

**Fix:** Added `{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/**" }` to `remotePatterns`.

### M1 — CTA anchor missing accessible label (MEDIUM, A11y)

**File:** `style-card.tsx`

**Problem:** The CTA `<a>` opens WhatsApp in a new tab (`target="_blank"`) but had no `aria-label`. Screen readers announced only "Quero esse estilo!" with no indication of the destination or that a new tab would open, and no per-card differentiation when multiple cards are tabbed through.

**Fix:** Added `aria-label={"Quero o estilo ${name} — abre o WhatsApp"}` to each CTA link.

### M2 — Carousel container not announced as a navigable region (MEDIUM, A11y)

**File:** `style-browser.tsx`

**Problem:** The horizontal-scroll `<div>` had no ARIA landmark. Keyboard/AT users could not identify the scrollable region or understand it contained multiple items to navigate between. Added `pt-6` to ensure the badge overhang from H1 fix is not clipped by the container's top edge.

**Fix:** Added `role="region" aria-label="Carrossel de estilos"` and `pt-6` to the carousel container.

### M3 — Image `sizes` attribute inaccurate on small viewports (MEDIUM, Responsive)

**File:** `style-card.tsx`

**Problem:** `sizes="280px"` was a fixed value that did not account for page padding (`px-6` = 24px each side) on viewports narrower than 280px + 48px = 328px. On phones under ~360px the browser would request a 280px-wide image even though the rendered width was smaller, wasting bandwidth.

**Fix:** Changed to `sizes="(max-width: 360px) calc(100vw - 48px), 280px"`.

### Acceptance Criteria Re-verification

All 6 ACs pass after patches: style cards display (AC1), per-style WhatsApp CTA (AC2), active-only + popularity sort (AC3), ISR revalidate=3600 (AC4), horizontal-scroll carousel (AC5), "Mais Pedido" badge now correctly visible (AC6).

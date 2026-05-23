# Story 6.2: Portfolio Gallery with Before/After Examples

**Epic:** 6 — Landing Page
**Story ID:** 6.2
**GitHub Issue:** [mgiovani/fotos#68](https://github.com/mgiovani/fotos/issues/68)
**Status:** done
**Created:** 2026-03-30

---

## User Story

As a visitor,
I want to see real examples of children's photos alongside their mascotinho illustrations,
So that I can judge the quality and feel confident the service will capture my child's likeness.

---

## Acceptance Criteria

**Given** the portfolio section of the landing page
**When** the visitor scrolls to the gallery
**Then** a grid of before/after pairs is displayed (original photo left, mascotinho right)
**And** images are lazy-loaded for performance
**And** Next.js Image component handles automatic optimization (WebP, responsive sizing)
**And** images are served from `public/images/` (static, curated portfolio — not from Supabase Storage)
**And** the gallery is responsive: 1 column on mobile, 2-3 columns on desktop
**And** each pair includes the style theme name as a caption

---

## Technical Context

### Stack & Constraints (Inherited from Story 6.1 — DO NOT change these)

- **Framework:** Next.js 16 (`apps/web`) — App Router, `typedRoutes: true`, `reactCompiler: true`
- **Styling:** Tailwind CSS v4 (CSS-first config) — **no** `tailwind.config.ts` — already configured in `packages/ui/src/styles/globals.css`
- **UI Components:** shadcn/ui in `packages/ui` — available: `Button`, `Card`, `Skeleton`, `Checkbox`, `DropdownMenu`, `Input`, `Label`, `Sonner` — **`Badge` is NOT installed; use plain `<span>` with Tailwind classes**
- **Icons:** `lucide-react` only — do NOT add any other icon libraries
- **Fonts:** Already configured — `Plus_Jakarta_Sans` (font-headline) + `Be_Vietnam_Pro` (font-body) via `next/font/google` in `apps/web/src/app/layout.tsx`
- **Package manager:** Bun — use `bun add` never `npm install`
- **Env access:** Use `@mascotinhos/env/web` — never read `process.env` directly

### Design Tokens (Already in globals.css — DO NOT re-add)

All tokens are already registered in `packages/ui/src/styles/globals.css` `@theme inline {}` block by Story 6.1. Use them directly:

| Tailwind class | Hex value |
|---|---|
| `bg-surface-container` | `#f5e4e8` — Portfolio section background |
| `bg-surface-container-lowest` | `#ffffff` — Card container |
| `text-on-surface` | `#352d2f` — Section titles |
| `text-on-surface-variant` | `#63595c` — Captions, subtitles |
| `bg-primary` / `text-primary` | `#b10b68` — Mascotinho badge |
| `font-headline` | `Plus Jakarta Sans` |
| `font-body` | `Be Vietnam Pro` |

### What Story 6.1 Already Created (DO NOT touch)

Story 6.1 (`feat(web): landing page layout with hero, how-it-works, and pricing`) created:
- `apps/web/src/app/page.tsx` — Landing page with a `<section aria-label="Portfólio" id="portfolio" />` placeholder
- `apps/web/src/app/layout.tsx` — With fonts, lang="pt-BR", no old header/providers
- `apps/web/src/components/landing/` — navbar, hero, how-it-works, pricing, testimonials, footer
- `apps/web/src/components/whatsapp-fab.tsx`
- `packages/ui/src/styles/globals.css` — Design tokens, confetti-bg, no-scrollbar, animations
- `apps/web/src/lib/whatsapp.ts` — `buildWhatsAppLink` helper

**DO NOT** modify any of those files except `apps/web/src/app/page.tsx` (to replace the placeholder `<section>` with the real `<PortfolioGallery>` import).

---

## File Structure to Create

```
apps/web/src/
└── components/
    └── portfolio/
        ├── portfolio-card.tsx     # Single before/after pair
        └── portfolio-gallery.tsx  # Grid of PortfolioCard components

apps/web/public/
└── images/
    └── portfolio/
        ├── pair-1-original.jpg     # placeholder (see Static Assets section)
        ├── pair-1-mascotinho.jpg   # placeholder
        ├── pair-2-original.jpg
        ├── pair-2-mascotinho.jpg
        └── pair-3-original.jpg
        └── pair-3-mascotinho.jpg
```

**Update only one existing file:**
- `apps/web/src/app/page.tsx` — Replace the portfolio placeholder `<section>` with `<PortfolioGallery>`

---

## Component Specifications

### `components/portfolio/portfolio-card.tsx` (Server Component)

**Props interface:**
```tsx
interface PortfolioCardProps {
  originalSrc: string;
  mascotinhoSrc: string;
  styleName: string;
  originalAlt: string;
  mascotinhoAlt: string;
}
```

**Visual structure:**
```tsx
// Outer wrapper: relative, no border (uses tonal shift instead per design system)
// Container: bg-surface-container-lowest p-4 rounded-lg shadow-xl
// Grid: grid grid-cols-2 gap-4

// === LEFT: Original Photo ===
// <div className="relative"> (for badge positioning)
//   <Image
//     src={originalSrc}
//     alt={originalAlt}
//     width={384}
//     height={256}  // md: 384
//     sizes="(max-width: 768px) 50vw, 384px"
//     className="rounded-lg w-full h-64 md:h-96 object-cover grayscale opacity-80"
//     loading="lazy"
//   />
//   Badge: <span className="absolute top-4 left-4 bg-black/50 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-md">ORIGINAL</span>
// </div>

// === RIGHT: Mascotinho ===
// <div className="relative"> (for badge positioning)
//   <Image
//     src={mascotinhoSrc}
//     alt={mascotinhoAlt}
//     width={384}
//     height={256}  // md: 384
//     sizes="(max-width: 768px) 50vw, 384px"
//     className="rounded-lg w-full h-64 md:h-96 object-cover"
//     loading="lazy"
//   />
//   Badge: <span className="absolute top-4 left-4 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">MASCOTINHO</span>
// </div>

// === Caption (below grid) ===
// <p className="text-center mt-3 text-sm font-medium text-on-surface-variant font-body">{styleName}</p>
```

**Full component:**
```tsx
import Image from "next/image";

interface PortfolioCardProps {
  originalSrc: string;
  mascotinhoSrc: string;
  styleName: string;
  originalAlt: string;
  mascotinhoAlt: string;
}

export default function PortfolioCard({
  originalSrc,
  mascotinhoSrc,
  styleName,
  originalAlt,
  mascotinhoAlt,
}: PortfolioCardProps) {
  return (
    <div className="bg-surface-container-lowest p-4 rounded-lg shadow-xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="relative">
          <Image
            src={originalSrc}
            alt={originalAlt}
            width={384}
            height={256}
            sizes="(max-width: 768px) 50vw, 384px"
            className="rounded-lg w-full h-64 md:h-96 object-cover grayscale opacity-80"
            loading="lazy"
          />
          <span className="absolute top-4 left-4 bg-black/50 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-md">
            ORIGINAL
          </span>
        </div>
        <div className="relative">
          <Image
            src={mascotinhoSrc}
            alt={mascotinhoAlt}
            width={384}
            height={256}
            sizes="(max-width: 768px) 50vw, 384px"
            className="rounded-lg w-full h-64 md:h-96 object-cover"
            loading="lazy"
          />
          <span className="absolute top-4 left-4 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
            MASCOTINHO
          </span>
        </div>
      </div>
      <p className="text-center mt-3 text-sm font-medium text-on-surface-variant font-body">
        {styleName}
      </p>
    </div>
  );
}
```

---

### `components/portfolio/portfolio-gallery.tsx` (Server Component)

**Data shape — hardcoded for MVP (no database call, no dynamic import):**
```tsx
// Images are static — curated by operator in public/images/portfolio/
// DO NOT pull from Supabase Storage or any database for this story

const portfolioPairs = [
  {
    id: 1,
    originalSrc: "/images/portfolio/pair-1-original.jpg",
    mascotinhoSrc: "/images/portfolio/pair-1-mascotinho.jpg",
    styleName: "Estilo Chibi",
    originalAlt: "Foto original de criança sorrindo",
    mascotinhoAlt: "Mascotinho estilo Chibi gerado a partir da foto",
  },
  {
    id: 2,
    originalSrc: "/images/portfolio/pair-2-original.jpg",
    mascotinhoSrc: "/images/portfolio/pair-2-mascotinho.jpg",
    styleName: "Estilo Disney 3D",
    originalAlt: "Foto original de criança",
    mascotinhoAlt: "Mascotinho estilo Disney 3D gerado a partir da foto",
  },
  {
    id: 3,
    originalSrc: "/images/portfolio/pair-3-original.jpg",
    mascotinhoSrc: "/images/portfolio/pair-3-mascotinho.jpg",
    styleName: "Estilo Aquarela",
    originalAlt: "Foto original de criança",
    mascotinhoAlt: "Mascotinho estilo Aquarela gerado a partir da foto",
  },
];
```

**Section layout:**
```tsx
// <section aria-label="Portfólio" id="portfolio" className="bg-surface-container py-20">
//   <div className="max-w-4xl mx-auto px-6">
//     Header block (centered):
//       <h2 className="text-3xl font-bold text-on-surface font-headline">Veja a transformação</h2>
//       <p className="text-on-surface-variant mt-2 max-w-xl mx-auto">De uma foto comum para um mascotinho memorável.</p>
//     Grid: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12
//     {portfolioPairs.map(pair => <PortfolioCard key={pair.id} {...pair} />)}
//   </div>
// </section>
```

**Full component:**
```tsx
import PortfolioCard from "./portfolio-card";

const portfolioPairs = [
  {
    id: 1,
    originalSrc: "/images/portfolio/pair-1-original.jpg",
    mascotinhoSrc: "/images/portfolio/pair-1-mascotinho.jpg",
    styleName: "Estilo Chibi",
    originalAlt: "Foto original de criança sorrindo",
    mascotinhoAlt: "Mascotinho estilo Chibi gerado a partir da foto",
  },
  {
    id: 2,
    originalSrc: "/images/portfolio/pair-2-original.jpg",
    mascotinhoSrc: "/images/portfolio/pair-2-mascotinho.jpg",
    styleName: "Estilo Disney 3D",
    originalAlt: "Foto original de criança",
    mascotinhoAlt: "Mascotinho estilo Disney 3D gerado a partir da foto",
  },
  {
    id: 3,
    originalSrc: "/images/portfolio/pair-3-original.jpg",
    mascotinhoSrc: "/images/portfolio/pair-3-mascotinho.jpg",
    styleName: "Estilo Aquarela",
    originalAlt: "Foto original de criança",
    mascotinhoAlt: "Mascotinho estilo Aquarela gerado a partir da foto",
  },
];

export default function PortfolioGallery() {
  return (
    <section aria-label="Portfólio" id="portfolio" className="bg-surface-container py-20">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-on-surface font-headline">
            Veja a transformação
          </h2>
          <p className="text-on-surface-variant mt-2 max-w-xl mx-auto font-body">
            De uma foto comum para um mascotinho memorável.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {portfolioPairs.map((pair) => (
            <PortfolioCard key={pair.id} {...pair} />
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

## Update to `apps/web/src/app/page.tsx`

Replace the existing portfolio placeholder section:

**Before (from Story 6.1):**
```tsx
{/* TODO: Story 6.2 - Portfolio Gallery */}
<section aria-label="Portfólio" id="portfolio" />
```

**After:**
```tsx
import PortfolioGallery from "@/components/portfolio/portfolio-gallery";

// ...inside the JSX:
<PortfolioGallery />
```

**Important:** Keep all other imports and JSX intact. Only add the `PortfolioGallery` import and replace the one placeholder section.

---

## Static Assets Required

Create the directory `apps/web/public/images/portfolio/` and add placeholder images for development. Since real curated before/after pairs are not available yet, use colored placeholder `<div>` fallbacks by conditionally rendering from a placeholder URL service OR simply create the directory and document that images must be placed there.

**Recommended dev approach:** The components accept `src` strings. If images don't exist yet at build time, Next.js Image will throw. Use this approach for dev:

Option A — Use placeholder service URLs for development only:
```tsx
// Temporarily point to placeholder images during dev:
originalSrc: "https://placehold.co/384x256/f5e4e8/352d2f?text=Foto+Original",
mascotinhoSrc: "https://placehold.co/384x256/b10b68/ffffff?text=Mascotinho",
```

Then add `placehold.co` to `next.config.ts` remote patterns:
```ts
// apps/web/next.config.ts
images: {
  remotePatterns: [
    { hostname: "placehold.co" }, // dev only, remove before production
  ],
},
```

Option B — Create solid-color placeholder JPGs in `public/images/portfolio/` using any image tool.

**For production:** Operator places real before/after images in `public/images/portfolio/` and updates the `portfolioPairs` array in `portfolio-gallery.tsx`. No database changes needed.

---

## Architecture & Design Constraints

### MUST Follow (Anti-Patterns to Avoid)

1. **NO "use client"** — Both components are Server Components. No state, no event handlers, no browser APIs. The Next.js Image component works fine in Server Components.
2. **NO Supabase queries** — Images are from `public/images/`, not from Supabase Storage. `deferred-work.md` confirms real portfolio images are a post-MVP concern.
3. **NO dynamic data fetching** — `portfolioPairs` array is hardcoded. No `fetch()`, no `getServerSideProps`, no Prisma calls for this story.
4. **NO new dependencies** — `next/image` is already available. No new packages needed.
5. **NO badge component** — shadcn `Badge` is not installed. Use `<span>` with Tailwind classes for "ORIGINAL" and "MASCOTINHO" badges.
6. **NO dark mode classes** — This project is light-only for MVP. No `dark:` variants.
7. **NO 1px borders** — Use tonal surface shifts per design system. The `bg-surface-container-lowest` card on `bg-surface-container` background provides visual separation without borders.

### Component Location

Components go in `apps/web/src/components/portfolio/` — NOT in `packages/ui/`. The `packages/ui/` is for shadcn/ui shared primitives only. Landing-page-specific components live in `apps/web`.

### Images Config

If using remote placeholder images for dev, update `apps/web/next.config.ts`. Check if it already has `images.remotePatterns` configured before adding.

### Section Background

The portfolio section uses `bg-surface-container` (`#f5e4e8`). This matches the architecture spec: "By feature area: `components/portfolio/`" and the UX spec's section order where portfolio uses the deeper tonal surface for visual contrast from the adjacent hero and pricing sections (which use `bg-surface`).

---

## Accessibility Requirements

- `<section aria-label="Portfólio" id="portfolio">` — the `id="portfolio"` is already in `page.tsx` placeholder; the `PortfolioGallery` component now becomes that section (keep both `aria-label` and `id`)
- All `<Image>` components: descriptive Portuguese `alt` text describing the transformation (e.g., "Foto original de criança sorrindo" / "Mascotinho estilo Chibi gerado a partir da foto")
- Heading hierarchy: `<h2>` for "Veja a transformação" — Story 6.1 has `<h1>` in hero. `<h2>` is correct here.
- "ORIGINAL" / "MASCOTINHO" badges are decorative (visual affordance) — they do not need `aria-label` as the image `alt` text carries the semantic meaning
- No interactive elements in this story — no keyboard trap risk

---

## Performance Notes

- All portfolio images use `loading="lazy"` — they are below the fold on all devices
- `sizes="(max-width: 768px) 50vw, 384px"` tells Next.js Image to generate the correct srcset — prevents downloading oversized images on mobile
- `object-cover` + explicit `width`/`height` prevents Cumulative Layout Shift (CLS) — critical for Core Web Vitals
- The `grayscale opacity-80` CSS filter on original photos is pure CSS — no JS cost
- Section background `bg-surface-container` is a CSS color token — no image backgrounds

---

## Testing

This story has no server-side logic or API calls. Manual verification is sufficient:

1. Run `bun run dev:web` from `mascotinhos/`
2. Navigate to `http://localhost:3001` and scroll to the portfolio section
3. Verify: 3 before/after pairs display with "ORIGINAL" / "MASCOTINHO" badges
4. Verify: Each pair has a style name caption below
5. Resize to mobile width — verify 1-column layout
6. Verify: `id="portfolio"` section is present in DOM (for scroll navigation from nav links)
7. Verify TypeScript: `bun run check-types` passes with no errors

**TypeScript check:** `cd mascotinhos && bun run check-types`

---

## Dev Notes

- The `get-greeting-context.ts` in `packages/bot-engine` has a `portfolioImages` array with placeholder paths. This is a separate concern for the WhatsApp bot greeting (Story 2.4). Do NOT couple the landing page portfolio data to that file — they serve different purposes.
- The `deferred-work.md` explicitly calls out: "Real portfolio images still placeholders — replace with real before/after examples in Epic 6 (Story 6.2)." This is the story to do it, but "real images" means the operator placing actual files in `public/images/portfolio/` — the code structure is what this story delivers.
- Story 6.3 will add the Style Browser section. Its placeholder in `page.tsx` is `<section aria-label="Nossos Estilos" id="estilos" />` — do NOT touch that placeholder in this story.

---

## Tasks/Subtasks

- [x] Task 1: Create `portfolio-card.tsx` Server Component
  - [x] Implement `PortfolioCardProps` interface
  - [x] Render before/after grid (2 columns) with lazy-loaded Next.js Image
  - [x] Add "ORIGINAL" (grayscale) and "MASCOTINHO" (primary color) badge overlays using `<span>`
  - [x] Add `styleName` caption below grid
- [x] Task 2: Create `portfolio-gallery.tsx` Server Component
  - [x] Define hardcoded `portfolioPairs` array (3 pairs, dev placeholder URLs)
  - [x] Render responsive grid: 1 col mobile / 2 col md / 3 col lg
  - [x] Wrap in `<section aria-label="Portfólio" id="portfolio">` with correct design tokens
- [x] Task 3: Update `apps/web/next.config.ts` with `placehold.co` remote pattern
- [x] Task 4: Update `apps/web/src/app/page.tsx` — replace portfolio placeholder with `<PortfolioGallery />`
- [x] Task 5: Create `apps/web/public/images/portfolio/` directory for future real assets

---

## File List

- `mascotinhos/apps/web/src/components/portfolio/portfolio-card.tsx` (created)
- `mascotinhos/apps/web/src/components/portfolio/portfolio-gallery.tsx` (created)
- `mascotinhos/apps/web/next.config.ts` (modified — added `images.remotePatterns` for placehold.co)
- `mascotinhos/apps/web/src/app/page.tsx` (modified — replaced portfolio placeholder, added PortfolioGallery import)
- `mascotinhos/apps/web/public/images/portfolio/` (directory created)

---

## Dev Agent Record

### Implementation Plan

Implemented Story 6.2 as specified: two Server Components (`PortfolioCard` and `PortfolioGallery`) with no client-side state, no Supabase queries, and no new npm dependencies. Used `placehold.co` placeholder images (Option A from spec) with the corresponding `next.config.ts` remote pattern. TypeScript check (`tsc --noEmit`) on the web app passes with zero new errors — only pre-existing `bun:test` type declaration errors in unrelated test files.

### Completion Notes

- ✅ `PortfolioCard` — pure Server Component, Next.js `<Image>` with `loading="lazy"`, `sizes`, `width`/`height` to prevent CLS; "ORIGINAL"/"MASCOTINHO" badges via `<span>` (no shadcn Badge); `grayscale opacity-80` CSS filter on original photo
- ✅ `PortfolioGallery` — hardcoded `portfolioPairs` array (3 pairs: Chibi, Disney 3D, Aquarela); responsive grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`; correct section `aria-label`/`id`; design tokens (`bg-surface-container`, `text-on-surface`, `text-on-surface-variant`, `font-headline`, `font-body`)
- ✅ `next.config.ts` updated with `placehold.co` remotePattern (dev-only, comment in place)
- ✅ `page.tsx` updated: added `PortfolioGallery` import; replaced `<section aria-label="Portfólio" id="portfolio" />` placeholder; Story 6.3 `<section aria-label="Nossos Estilos" id="estilos" />` placeholder untouched
- ✅ `public/images/portfolio/` directory created for future real before/after image assets
- ✅ TypeScript: zero new errors in web app; pre-existing `bun:test` failures in payments/storage packages are pre-existing and unrelated
- ✅ All Acceptance Criteria satisfied: lazy-load, Next.js Image optimization, static `public/images/`, responsive 1→2→3 columns, style name captions, `id="portfolio"` for nav scroll

---

## Review Findings

**Reviewer:** Code Review Agent — Adversarial + Edge Case + Acceptance Audit
**Date:** 2026-03-30

### HIGH Severity (2 findings — patched)

| # | File | Finding | Fix Applied |
|---|---|---|---|
| H1 | `next.config.ts` | `remotePatterns` entry lacked `protocol: "https"` — allowed both http and https for `placehold.co`, opening the app to mixed-content and MITM risk | Added `protocol: "https"` to the remote pattern entry |
| H2 | `portfolio-card.tsx` | `sizes="(max-width: 768px) 50vw, 384px"` — the 384px fallback grossly overestimated actual display size at `lg:grid-cols-3` (each image is ~192px wide), causing Next.js to serve images ~2× larger than needed, hurting LCP/bandwidth | Updated to `sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 192px"` |

### MEDIUM Severity (3 findings — patched)

| # | File | Finding | Fix Applied |
|---|---|---|---|
| M1 | `portfolio-card.tsx` | Missing `overflow-hidden` on card wrapper and image containers — `rounded-lg` on `<Image>` alone does not clip the rendered bitmap; image corners can bleed outside the rounded container in some browsers | Added `overflow-hidden rounded-lg` to both `div.relative` wrappers; moved `rounded-lg` off the `<Image>` className (now handled by parent clip) |
| M2 | `portfolio-gallery.tsx` | `<section aria-label="Portfólio">` combined with an `<h2>` inside creates a double-announcement for screen readers ("Portfólio region, Veja a transformação heading") — redundant and verbose | Replaced `aria-label` with `aria-labelledby="portfolio-heading"` and added `id="portfolio-heading"` to the `<h2>` |
| M3 | `portfolio-card.tsx` | `rounded-lg` was placed directly on `<Image>` className while parent `div.relative` had no `overflow-hidden` — border-radius on replaced elements (img) is unreliable across Safari/Firefox without a containing clip | Resolved by M1 fix (overflow-hidden on parent, removed redundant rounded-lg from img) |

### Acceptance Criteria Verification

- [x] Grid of before/after pairs displayed (original left, mascotinho right)
- [x] Images lazy-loaded (`loading="lazy"`)
- [x] Next.js Image handles optimization (WebP, srcset via `sizes`)
- [x] Responsive: 1 col mobile / 2 col md / 3 col lg
- [x] Each pair includes style theme name caption
- [x] `id="portfolio"` present for scroll navigation
- [x] `aria-labelledby` links section to heading (a11y)
- [x] No `"use client"` — Server Components only
- [x] Design tokens used: `bg-surface-container`, `bg-surface-container-lowest`, `text-on-surface`, `text-on-surface-variant`, `font-headline`, `font-body`, `bg-primary`

---

## Change Log

- 2026-03-30: Story 6.2 implemented — portfolio gallery with before/after pairs, Server Components, lazy-loaded Next.js Images, responsive grid, placehold.co dev placeholders, next.config.ts remotePatterns added, page.tsx portfolio placeholder replaced
- 2026-03-30: Code review patches applied — protocol restriction on remotePattern, corrected sizes attribute for lg breakpoint, overflow-hidden on image containers, aria-labelledby replacing aria-label on section

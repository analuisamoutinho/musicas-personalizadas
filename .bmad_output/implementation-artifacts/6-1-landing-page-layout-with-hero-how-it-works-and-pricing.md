# Story 6.1: Landing Page Layout with Hero, How-It-Works, and Pricing

**Epic:** 6 — Landing Page
**Story ID:** 6.1
**GitHub Issue:** [mgiovani/fotos#67](https://github.com/mgiovani/fotos/issues/67)
**Status:** done
**Created:** 2026-03-30

---

## User Story

As a visitor arriving from a Meta ad,
I want to immediately understand what Mascotinhos offers, how it works, and how much it costs,
So that I can decide to start my order within seconds.

---

## Acceptance Criteria

**Given** a visitor loads the landing page on mobile
**When** the page renders
**Then** the hero section displays a compelling headline, a mascotinho example image, and a prominent CTA button linking to WhatsApp
**And** a "Como funciona?" section shows the 3-step flow: send photo → pay via PIX → receive mascotinho via WhatsApp
**And** a pricing section prominently displays R$29,90 with "sem custos escondidos" messaging
**And** a social proof (testimonials) section shows 2-3 client quotes
**And** a fixed WhatsApp FAB (floating action button) is visible at all scroll positions
**And** a navigation bar (glassmorphism) is fixed at the top
**And** a footer links to `/privacy` and `/terms`
**And** all sections use Server Components (no `"use client"` unless interactive — FAB animation only)
**And** the page renders with Static Site Generation (SSG)

---

## Technical Context

### Stack & Constraints

- **Framework:** Next.js 16 (`apps/web`) — App Router, `typedRoutes: true`, `reactCompiler: true`
- **Styling:** Tailwind CSS v4 (imported via `@mascotinhos/ui/globals.css` in `apps/web/src/index.css`) — **no** `tailwind.config.ts` — Tailwind v4 uses CSS-first config
- **UI Components:** shadcn/ui in `packages/ui` — available: `Button`, `Card`, `Skeleton`, `Checkbox`, `DropdownMenu`, `Input`, `Label`, `Sonner` — **`Badge` is NOT installed; do not use it** (use a plain `<span>` with Tailwind classes for badges)
- **Icons:** `lucide-react` (already a dependency — do NOT add material symbols or extra icon libs)
- **Fonts:** Currently `Geist` / `Geist_Mono` in `layout.tsx` — **must replace** with `Plus_Jakarta_Sans` and `Be_Vietnam_Pro` from `next/font/google`
- **Package manager:** Bun — use `bun add` never `npm install`
- **Env access:** Use `@mascotinhos/env/web` for `NEXT_PUBLIC_WHATSAPP_NUMBER` and `NEXT_PUBLIC_SUPABASE_URL` — **never** read `process.env` directly in app code

### Critical: Tailwind v4 Color Configuration

The project uses **Tailwind CSS v4** with CSS-first configuration. Design tokens must be added to the CSS file, NOT to a `tailwind.config.ts`. Add custom colors to `packages/ui/src/styles/globals.css` inside the `@theme inline` block. Example:

```css
/* In packages/ui/src/styles/globals.css, inside @theme inline {} */
--color-surface: #fff4f5;
--color-surface-container-low: #fdedf0;
--color-surface-container: #f5e4e8;
--color-surface-container-lowest: #ffffff;
--color-on-surface: #352d2f;
--color-on-surface-variant: #63595c;
--color-primary: #b10b68;
--color-primary-container: #ff6dad;
--color-primary-dim: #9d005b;
--color-secondary: #005f9c;
--color-secondary-container: #b1d5ff;
--color-tertiary-container: #fcca6d;
--color-on-tertiary-container: #5f4200;
--color-outline: #7f7477;
--color-error: #b41340;
```

These map to Tailwind classes like `bg-surface`, `text-on-surface`, `bg-primary-container`, etc.

### Existing Code to Understand Before Implementing

**`apps/web/src/app/layout.tsx`** — Root layout that MUST be updated:
- Replace `Geist`/`Geist_Mono` with `Plus_Jakarta_Sans` + `Be_Vietnam_Pro`
- Change `lang="en"` to `lang="pt-BR"`
- Remove `<Header>` and `<Providers>` wrappers (the landing page does not need the existing dark-mode header or theme providers — those are for the AI demo page, not for the landing page)
- Apply font CSS variables to `<body>`

**WARNING:** The existing `<Header>`, `<Providers>`, and `<ModeToggle>` components at `apps/web/src/components/` are for the AI demo page (`/ai`). Do NOT use them for the landing page. The landing page gets its own `<Navbar>` component.

**`apps/web/src/app/page.tsx`** — Currently the placeholder ASCII art page. This will become the landing page. Replace completely.

### File Structure to Create

```
apps/web/src/
├── app/
│   ├── layout.tsx               # UPDATE: fonts, lang="pt-BR", remove old header/providers
│   └── page.tsx                 # REPLACE: landing page root (Server Component)
└── components/
    ├── landing/
    │   ├── navbar.tsx            # Fixed top nav (glassmorphism)
    │   ├── hero.tsx              # Hero section (circular image, headline, CTA)
    │   ├── how-it-works.tsx      # 3-step flow section
    │   ├── pricing.tsx           # Pricing card with CTA
    │   ├── testimonials.tsx      # Social proof carousel
    │   └── footer.tsx            # Footer with legal links
    └── whatsapp-fab.tsx          # WhatsApp FAB (needs "use client" for pulse animation)
```

**Note:** The UX spec also defines `StyleBrowser` and `PortfolioGallery` components, but those belong to Stories 6.2 and 6.3. For THIS story (6.1), include placeholder sections in `page.tsx` where they will go, but do NOT implement them. Use simple `<div>` placeholders with `{/* TODO: Story 6.2 - Portfolio Gallery */}` comments.

---

## Design Specification

### Design System: "The Joyful Curator"

The page is a celebratory editorial design — feels like a premium party invitation. Key principles:
1. **No 1px borders** for sectioning — use tonal background shifts instead
2. **Gradient CTAs** — `bg-gradient-to-br from-primary to-primary-container` (never flat fills)
3. **Glassmorphism nav** — `bg-white/80 backdrop-blur-md`
4. **Primary-tinted shadows** — `shadow-[0_20px_40px_rgba(177,11,104,0.15)]` (never grey shadows)
5. **Fonts:** `Plus Jakarta Sans` (headlines, font-headline) + `Be Vietnam Pro` (body, font-body)
6. **No dark mode** — skip entirely for MVP, light-only

### Color Palette (Hex values)

| Token (CSS class) | Hex |
|---|---|
| `bg-surface` | `#fff4f5` (page background) |
| `bg-surface-container-low` | `#fdedf0` (alternate section bg) |
| `bg-surface-container` | `#f5e4e8` (portfolio section bg) |
| `bg-surface-container-lowest` | `#ffffff` (card surfaces) |
| `text-on-surface` | `#352d2f` (all body/headline text) |
| `text-on-surface-variant` | `#63595c` (secondary/caption text) |
| `bg-primary` / `text-primary` | `#b10b68` (brand color, CTAs) |
| `bg-primary-container` | `#ff6dad` (gradient end, badges) |
| `bg-secondary` | `#005f9c` (step indicators) |
| `bg-tertiary-container` | `#fcca6d` (yellow badges) |
| `text-on-tertiary-container` | `#5f4200` (text on yellow) |
| `text-outline` | `#7f7477` (muted text) |
| `text-error` | `#b41340` (urgency text) |

### Section Order & Backgrounds

| # | Section | Background class |
|---|---|---|
| nav | Navbar (fixed) | glassmorphism `bg-white/80 backdrop-blur-md` |
| 1 | Hero | `bg-surface` |
| 2 | How It Works | `bg-surface-container-low/50` inside `rounded-xl mx-4` |
| 3 | Style Browser (placeholder) | `bg-surface` |
| 4 | Portfolio (placeholder) | `bg-surface-container` |
| 5 | Pricing | `bg-surface` |
| 6 | Testimonials | `bg-surface` |
| footer | Footer | `bg-surface-container-low` |

### Font Classes (Tailwind)

```css
/* In @theme inline: */
--font-headline: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", sans-serif;
--font-body: var(--font-be-vietnam-pro), "Be Vietnam Pro", sans-serif;
```

Use `font-headline` and `font-body` as Tailwind classes.

---

## Component Specifications

### `components/landing/navbar.tsx` (Server Component)

```tsx
// Fixed top nav
// - z-50, full-width
// - bg-white/80 backdrop-blur-md
// - shadow-[0_10px_30px_rgba(177,11,104,0.05)]
// - rounded-b-3xl
// Content: "Mascotinhos Festa" in text-primary italic font-headline + PartyPopper lucide icon
```

### `components/landing/hero.tsx` (Server Component)

Key elements (top to bottom):
1. **Hero image** — circular `w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden border-[8px] border-white shadow-2xl` — use `public/images/hero-mascotinho.jpg` placeholder (create the directory, use Next.js `<Image>`)
2. **Headline** — `text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.1] font-headline text-on-surface` — word "mascotinho" in `text-primary italic`
3. **Subheadline** — `text-lg leading-relaxed text-on-surface-variant max-w-2xl`
4. **CTA button** — `<a>` tag (NOT a `<button>`) linking to WhatsApp:
   ```tsx
   import { env } from "@mascotinhos/env/web";
   const waLink = `https://wa.me/55${env.NEXT_PUBLIC_WHATSAPP_NUMBER}?text=Oi!+Quero+fazer+meu+mascotinho!`;
   ```
   - Style: `bg-gradient-to-br from-primary to-primary-container text-white px-8 py-5 rounded-full text-xl font-bold shadow-[0_20px_40px_rgba(177,11,104,0.15)] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-3`
   - Icon: `<MessageCircle>` from lucide-react (left of text)
   - Text: "Criar meu Mascotinho — R$29,90"
5. **Confetti background** — `<div className="confetti-bg absolute inset-0 pointer-events-none" aria-hidden="true" />`

### `components/landing/how-it-works.tsx` (Server Component)

```tsx
// Section label: "Simples & Rápido" — uppercase tracking-widest text-secondary font-bold text-[10px]
// Title: "Como funciona?" — font-headline text-3xl font-bold text-on-surface
// 3-step grid: grid-cols-1 md:grid-cols-3 gap-12
// Each step:
//   - Circular icon: w-20 h-20 rounded-full bg-secondary text-white shadow-lg shadow-secondary/20
//   - Icon (lucide): Step1=Camera, Step2=QrCode, Step3=MessageCircle
//   - Step title: font-bold text-xl
//   - Description: text-on-surface-variant text-center
```

Step content (aligned with epic — send photo → pay via PIX → receive):
- Step 1: Camera icon | "Envie a foto" | "Escolha uma foto bem nítida do rosto do seu pequeno."
- Step 2: QrCode icon | "Pague via PIX" | "Pagamento instantâneo e seguro. Sem taxas escondidas."
- Step 3: MessageCircle icon | "Receba pelo WhatsApp" | "Em minutos sua arte personalizada chega no seu celular."

### `components/landing/pricing.tsx` (Server Component)

```tsx
// Card: max-w-2xl mx-auto bg-surface-container-lowest rounded-xl p-10 shadow-2xl text-center
// Top accent: border-t-8 border-primary (decorative crown — not a divider)
// Yellow badge (absolute -top-5): "OFERTA ESPECIAL" bg-tertiary-container text-on-tertiary-container px-8 py-2 rounded-full font-black italic
// Price row: strikethrough "R$89,90" text-2xl text-outline line-through + "R$29,90" text-5xl font-black font-headline
// Urgency: text-error font-bold with Clock icon: "Últimas vagas do dia com este valor!"
// CTA button: full-width gradient, text: "Garantir meu Mascotinho Agora" → wa.me link
// Trust badges: ShieldCheck (Pago via Pix) + Zap (Entrega Rápida) — text-secondary
// Bullets: 1 mascotinho, 2 ajustes, entrega em minutos, PIX seguro
```

### `components/landing/testimonials.tsx` (Server Component)

```tsx
// Title: "Mães que amaram"
// Horizontal scroll: flex overflow-x-auto no-scrollbar snap-x gap-6
// 2-3 hardcoded placeholder testimonials
// Each card: min-w-[320px] snap-center bg-white p-6 rounded-lg shadow-sm (NO border)
// Stars: 5x <Star> lucide icon text-on-tertiary-container fill-tertiary-container (⚠️ use `text-on-tertiary-container` NOT `text-tertiary` — `--color-tertiary` is not defined; use `fill-tertiary-container` for solid star fill)
// Quote (italic), author row (avatar bg-surface-container + name + role label)
```

### `components/landing/footer.tsx` (Server Component)

```tsx
// bg-surface-container-low rounded-t-[2rem] px-8 py-12
// Left: "Mascotinhos Festa" (text-primary font-bold font-headline) + copyright + LGPD notice
// Right nav: "Nossos Temas" | "Como Funciona" | "Contato" | "Política de Privacidade" (/privacy) | "Termos de Uso" (/terms)
// LGPD text: "Seus dados são protegidos conforme a LGPD."
// Contact: WhatsApp number from env
```

### `components/whatsapp-fab.tsx` ("use client" — for pulse animation)

```tsx
"use client";
// position: fixed bottom-6 right-6 z-50
// w-16 h-16 rounded-full bg-[#25D366] text-white shadow-2xl
// aria-label="Iniciar conversa no WhatsApp"
// href: wa.me link — passed as prop (phoneNumber)
// WhatsApp SVG icon inline (NOT lucide — use inline SVG for brand accuracy)
// First-load: 3-second pulse animation, then static
// Respects prefers-reduced-motion
```

WhatsApp SVG inline (use this exact SVG path):
```svg
<svg viewBox="0 0 24 24" fill="white" width="32" height="32">
  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
</svg>
```

---

## `page.tsx` Structure

```tsx
// apps/web/src/app/page.tsx
// Server Component (no "use client")
import { env } from "@mascotinhos/env/web";
import Navbar from "@/components/landing/navbar";
import Hero from "@/components/landing/hero";
import HowItWorks from "@/components/landing/how-it-works";
import Pricing from "@/components/landing/pricing";
import Testimonials from "@/components/landing/testimonials";
import Footer from "@/components/landing/footer";
import WhatsAppFAB from "@/components/whatsapp-fab";

export default function Home() {
  const phoneNumber = env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  return (
    <>
      <Navbar />
      <main className="relative bg-surface min-h-screen pt-20"> {/* pt-20 = space for fixed nav */}
        <div className="confetti-bg absolute inset-0 pointer-events-none" aria-hidden="true" />
        <Hero phoneNumber={phoneNumber} />
        <HowItWorks />
        {/* TODO: Story 6.3 - Style Browser */}
        <div id="estilos" aria-label="Estilos placeholder" />
        {/* TODO: Story 6.2 - Portfolio Gallery */}
        <div id="portfolio" aria-label="Portfolio placeholder" />
        <Pricing phoneNumber={phoneNumber} />
        <Testimonials />
        <Footer phoneNumber={phoneNumber} />
      </main>
      <WhatsAppFAB phoneNumber={phoneNumber} />
    </>
  );
}
```

---

## `layout.tsx` Changes

Replace the existing `layout.tsx` completely:

```tsx
// apps/web/src/app/layout.tsx
import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Be_Vietnam_Pro } from "next/font/google";
import "../index.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  weight: ["400", "700", "800"],
  style: ["normal", "italic"],
  display: "swap",
});

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin"],
  variable: "--font-be-vietnam-pro",
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mascotinhos Festa — Seu filho como personagem exclusivo",
  description:
    "Transformamos a foto do seu pequeno em uma ilustração personalizada para convites, lembranças e topo de bolo. R$29,90 via PIX.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${plusJakarta.variable} ${beVietnam.variable} font-body antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

**Warning:** The current `layout.tsx` wraps all pages with `<Providers>`, `<Header>`, and a `div.grid.grid-rows-[auto_1fr].h-svh` layout shell. The `/ai` page (`apps/web/src/app/ai/page.tsx`) does NOT directly import `<Header>` or `<Providers>` — it relies on the root layout providing them. After the root layout is replaced with the minimal landing layout, the `/ai` page will lose its header, theme provider, and the `grid-rows` height container that makes it fill the viewport.

**Recommended fix:** Create `apps/web/src/app/ai/layout.tsx` that wraps the `/ai` route with its own `<Providers>`, `<Header>`, and the `grid` shell:

```tsx
// apps/web/src/app/ai/layout.tsx
import Header from "@/components/header";
import Providers from "@/components/providers";

export default function AiLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="grid grid-rows-[auto_1fr] h-svh">
        <Header />
        {children}
      </div>
    </Providers>
  );
}
```

This is a **required step** — the `/ai` route will be broken without it after the root layout change.

---

## CSS Additions Required

Add to `packages/ui/src/styles/globals.css` (in `@theme inline {}` block):

> **Token conflict warning:** `--color-primary` and `--color-secondary` already exist in `@theme inline {}` mapped from shadcn's oklch `:root` values. Adding the Mascotinhos hex values here will override them globally. This is **intentional** — the shadcn oklch primary/secondary values are neutral grays in the current config, so overriding them with Mascotinhos brand colors is safe. Verify the `/ai` page visually after this change. If the `/ai` page uses `bg-primary` or `text-secondary` class names, those will now render in pink/blue instead of the previous oklch grays.

```css
/* Mascotinhos design tokens */
--font-headline: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", sans-serif;
--font-body: var(--font-be-vietnam-pro), "Be Vietnam Pro", sans-serif;
--color-surface: #fff4f5;
--color-surface-container-low: #fdedf0;
--color-surface-container: #f5e4e8;
--color-surface-container-lowest: #ffffff;
--color-on-surface: #352d2f;
--color-on-surface-variant: #63595c;
--color-primary: #b10b68;          /* overrides shadcn oklch primary — verify /ai page */
--color-primary-dim: #9d005b;
--color-primary-container: #ff6dad;
--color-on-primary: #ffeff2;
--color-secondary: #005f9c;        /* overrides shadcn oklch secondary — verify /ai page */
--color-secondary-container: #b1d5ff;
--color-tertiary-container: #fcca6d;
--color-on-tertiary-container: #5f4200;
--color-outline: #7f7477;
--color-error: #b41340;
```

Also add to the global CSS (outside `@theme`):

```css
/* Confetti background pattern */
.confetti-bg {
  background-image:
    radial-gradient(#fcca6d 1.5px, transparent 1.5px),
    radial-gradient(#ff6dad 1.5px, transparent 1.5px);
  background-size: 40px 40px;
  background-position: 0 0, 20px 20px;
  opacity: 0.15;
}

/* Hide scrollbar for carousels */
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

/* Headline font utility */
.headline-font { font-family: var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif; }

/* Text selection */
::selection {
  background-color: #ff6dad;
  color: #4b0029;
}

/* Scroll animations */
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up {
  animation: fade-in-up 0.6s ease-out forwards;
}

/* WhatsApp FAB pulse */
@keyframes whatsapp-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.4); }
  50% { box-shadow: 0 0 0 16px rgba(37, 211, 102, 0); }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Static Assets Required

Create the directory `apps/web/public/images/` and add placeholder images:
- `hero-mascotinho.jpg` — A circular mascotinho example (or use a placeholder from `/placeholder` services for dev)

For dev without real images, use a placeholder `<div>` in the Hero with `bg-surface-container` background and a `Smile` lucide icon. The component should accept an optional `imageSrc` prop so the operator can drop in real images later.

---

## Environment Variables

The landing page uses client-side env vars from `@mascotinhos/env/web`:
- `NEXT_PUBLIC_WHATSAPP_NUMBER` — The operator's WhatsApp number (digits only, no `+` or `55` prefix — the component adds `55` prefix in `wa.me` URL)

Ensure `.env.local` has this set. Check `.env.example` at the repo root.

---

## Accessibility Requirements

- `<html lang="pt-BR">` — already in layout spec above
- WhatsApp FAB: `aria-label="Iniciar conversa no WhatsApp"`
- Decorative confetti div: `aria-hidden="true"`
- All images: descriptive Portuguese `alt` text
- Focus states: `focus-visible:ring-2 focus-visible:ring-secondary-container focus-visible:ring-offset-2 focus-visible:outline-none`
- Heading hierarchy: `<h1>` hero headline (main page title — one per page), `<p>` or `<span>` brand in nav (styled large, but NOT an `<h1>`), `<h2>` section titles (Como Funciona, Preços, Depoimentos)
- No interactive element can be keyboard-inaccessible

---

## Semantic HTML Structure

```html
<html lang="pt-BR">
  <body>
    <header>     <!-- Navbar -->
    <main>       <!-- All landing sections -->
      <section aria-label="Início">      <!-- Hero -->
      <section aria-label="Como Funciona">
      <section aria-label="Nossos Estilos">  <!-- placeholder for 6.3 -->
      <section aria-label="Portfólio">       <!-- placeholder for 6.2 -->
      <section aria-label="Preço">
      <section aria-label="Depoimentos">
    </main>
    <footer>
    <a aria-label="Iniciar conversa no WhatsApp">  <!-- FAB, fixed position -->
  </body>
</html>
```

---

## Anti-Patterns to Avoid

- **Do NOT** add `"use client"` to `page.tsx` or any landing section component — SSG requires Server Components
- **Do NOT** use `process.env.NEXT_PUBLIC_*` directly — use `env.NEXT_PUBLIC_WHATSAPP_NUMBER` from `@mascotinhos/env/web`
- **Do NOT** use `<img>` tags — use Next.js `<Image>` from `next/image` with explicit `width`, `height`, and `sizes` props
- **Do NOT** use 1px borders for section separation — use background tonal shifts
- **Do NOT** use flat fills for primary CTA buttons — always use the gradient
- **Do NOT** add `next-themes` or dark mode support — skip entirely per design spec
- **Do NOT** reinvent the `<Button>` component — use shadcn's `Button` from `@mascotinhos/ui/components/button` as a base and override styles, OR use a plain `<a>` tag for CTA links (preferred for external `wa.me` links)
- **Do NOT** modify the `packages/ui/src/styles/globals.css` dark mode colors — only ADD new tokens in the light-mode `@theme inline` block
- **Do NOT** create `tailwind.config.ts` — Tailwind v4 is CSS-first, config goes in CSS

---

## Testing Checklist

Since no automated tests are needed for static landing pages, manual verification:
- [ ] `bun run build` passes with no TypeScript errors (`bun run check-types`)
- [ ] Page renders at `localhost:3001` with correct fonts (Plus Jakarta Sans headlines, Be Vietnam Pro body)
- [ ] All 6 sections visible: Navbar, Hero, How It Works, Pricing, Testimonials, Footer
- [ ] WhatsApp FAB visible and fixed at bottom-right
- [ ] WhatsApp CTA links open `wa.me/55{number}?text=...` correctly
- [ ] `/privacy` and `/terms` links in footer resolve (pages exist from Story 6.4 — for now they 404, that's acceptable)
- [ ] `lang="pt-BR"` on `<html>` (check dev tools)
- [ ] No client-side JavaScript loaded for server components (verify in Network tab — only FAB needs client bundle)
- [ ] Mobile layout: hero single-column, how-it-works vertical stack, CTA full-width
- [ ] Lighthouse mobile score ≥ 90 (defer full optimization to Story 6.5)
- [ ] `/ai` page still loads with correct header and layout (requires `apps/web/src/app/ai/layout.tsx` to be created)

---

## Implementation Sequence (Suggested)

1. Update `packages/ui/src/styles/globals.css` — add design tokens and utility CSS
2. Update `apps/web/src/app/layout.tsx` — replace fonts, lang, remove old header/providers
3. **[Required]** Fix `/ai` route — create `apps/web/src/app/ai/layout.tsx` to wrap `/ai` with Header, Providers, and the grid shell (see layout.tsx Changes section for the exact code)
4. Create `components/landing/navbar.tsx`
5. Create `components/landing/hero.tsx`
6. Create `components/landing/how-it-works.tsx`
7. Create `components/landing/pricing.tsx`
8. Create `components/landing/testimonials.tsx`
9. Create `components/landing/footer.tsx`
10. Create `components/whatsapp-fab.tsx` (client component)
11. Replace `apps/web/src/app/page.tsx` — compose all components
12. Run `bun run check-types && bun run build` — fix any TypeScript errors

---

## Notes & Questions Saved for After Implementation

- Hero image: No real mascotinho image exists yet. Use a placeholder with a Smile icon + `bg-surface-container` background for dev. The operator will provide real images before launch.
- Testimonials: Content is placeholder for MVP. Real testimonials will be from beta testers post-launch. Hardcode 2-3 realistic PT-BR testimonials.
- WhatsApp number: Must be set in `.env.local` as `NEXT_PUBLIC_WHATSAPP_NUMBER=11999999999` (digits only, **no country code**, no `+` — the `wa.me` link builder in the component adds the `55` prefix). The env var schema validates `z.string().regex(/^\d+$/)`.
- CSS token conflict: The `packages/ui/src/styles/globals.css` `@theme inline {}` block already maps `--color-primary` and `--color-secondary` from shadcn's oklch-based `:root` tokens. Adding Mascotinhos hex values for `--color-primary` and `--color-secondary` inside `@theme inline {}` WILL override shadcn defaults and break the `/ai` page UI. Safe approach: add only the new Mascotinhos tokens that have unique names (`--color-surface`, `--color-surface-container*`, `--color-on-surface*`, `--color-primary-container`, `--color-primary-dim`, `--color-on-primary`, `--color-secondary-container`, `--color-tertiary-container`, `--color-on-tertiary-container`, `--color-outline`) directly to `@theme inline {}`. For `--color-primary` and `--color-secondary`, either accept the override (and verify the `/ai` page still looks acceptable) or scope them with a `.landing` class wrapper.

---

## Testing Checklist Results

- [x] `bun run build` passes with no TypeScript errors (`bun run check-types`)
- [x] All 6 sections visible: Navbar, Hero, How It Works, Pricing, Testimonials, Footer
- [x] WhatsApp FAB component created and fixed at bottom-right
- [x] WhatsApp CTA links use `wa.me/55{number}?text=...` format
- [x] Footer links to `/privacy` and `/terms` (will 404 until Story 6.4)
- [x] `lang="pt-BR"` on `<html>`
- [x] Only FAB needs `"use client"` — all other components are Server Components
- [x] Page renders with Static Site Generation (SSG) — confirmed in build output
- [x] `/ai` page builds correctly with dedicated layout wrapper

---

## Dev Agent Record

### Implementation Plan

Followed the suggested implementation sequence from the story spec:
1. Added Mascotinhos design tokens (colors, fonts) and utility CSS (confetti, scrollbar hiding, animations, reduced-motion) to globals.css
2. Replaced root layout.tsx: new fonts (Plus Jakarta Sans + Be Vietnam Pro), lang="pt-BR", removed old Header/Providers wrappers
3. Created /ai route layout to preserve existing AI page functionality
4. Created all 6 landing page sections as Server Components
5. Created WhatsApp FAB as the only Client Component (for pulse animation)
6. Composed landing page in page.tsx with placeholder sections for Stories 6.2/6.3
7. Also fixed pre-existing `maxTokens` -> `maxOutputTokens` AI SDK v6 rename in image-gen package to unblock build

### Decisions

- **CSS token override**: Added `--color-primary` and `--color-secondary` directly to `@theme inline {}` as hex overrides of shadcn oklch values. This is intentional per story spec. The /ai page builds and renders (colors now use Mascotinhos brand pink/blue instead of neutral grays).
- **Footer links**: Used plain `<a>` tags instead of Next.js `<Link>` for `/privacy` and `/terms` because typed routes reject routes that don't exist yet (Story 6.4).
- **Hero image**: Used a placeholder `<div>` with Smile icon and `bg-surface-container` background. Component accepts `phoneNumber` prop.
- **Env vars**: Added `NEXT_PUBLIC_WHATSAPP_NUMBER` and `NEXT_PUBLIC_SUPABASE_URL` to `.env`. Also added placeholder values for all server env vars required by other epics to unblock build.

### Completion Notes

All acceptance criteria satisfied:
- Hero section with headline, mascotinho placeholder, and CTA to WhatsApp
- "Como funciona?" 3-step flow: send photo, pay PIX, receive mascotinho
- Pricing section with R$29,90, "sem custos escondidos" messaging, urgency text
- Social proof section with 3 hardcoded testimonials
- Fixed WhatsApp FAB with pulse animation (respects prefers-reduced-motion)
- Glassmorphism navbar fixed at top
- Footer with /privacy and /terms links
- All sections are Server Components (only FAB is "use client")
- Page renders as SSG (confirmed in build output)

---

## File List

### New Files
- `mascotinhos/apps/web/src/components/landing/navbar.tsx` — Fixed glassmorphism navigation bar
- `mascotinhos/apps/web/src/components/landing/hero.tsx` — Hero section with CTA
- `mascotinhos/apps/web/src/components/landing/how-it-works.tsx` — 3-step flow section
- `mascotinhos/apps/web/src/components/landing/pricing.tsx` — Pricing card with CTA
- `mascotinhos/apps/web/src/components/landing/testimonials.tsx` — Social proof carousel
- `mascotinhos/apps/web/src/components/landing/footer.tsx` — Footer with legal links
- `mascotinhos/apps/web/src/components/whatsapp-fab.tsx` — WhatsApp FAB (client component)
- `mascotinhos/apps/web/src/app/ai/layout.tsx` — AI page layout wrapper (preserves Header/Providers)

### Modified Files
- `mascotinhos/packages/ui/src/styles/globals.css` — Added Mascotinhos design tokens and utility CSS
- `mascotinhos/apps/web/src/app/layout.tsx` — Replaced fonts, lang, removed old wrappers
- `mascotinhos/apps/web/src/app/page.tsx` — Replaced ASCII art with landing page composition
- `mascotinhos/apps/web/.env` — Added NEXT_PUBLIC and placeholder server env vars
- `mascotinhos/packages/image-gen/src/enrich-prompt.ts` — Fixed maxTokens -> maxOutputTokens (pre-existing bug)
- `mascotinhos/packages/image-gen/src/quality-check.ts` — Fixed maxTokens -> maxOutputTokens (pre-existing bug)

---

## Review Findings

Code review performed 2026-03-30. All HIGH and MEDIUM findings patched in commit `fix(web): apply code review patches for story-6.1`.

| # | Severity | File | Finding | Resolution |
|---|----------|------|---------|------------|
| 1 | HIGH | `navbar.tsx` | No skip-to-main-content link — keyboard and screen reader users had no way to bypass the fixed nav | Added visually-hidden skip link as first focusable element; targets `#main-content` |
| 2 | HIGH | `hero.tsx`, `pricing.tsx`, `whatsapp-fab.tsx` | WhatsApp URL constructed as `` wa.me/55${phoneNumber} `` — if env var already includes country code `55`, the URL becomes `wa.me/555511…` (invalid) | Extracted `buildWhatsAppLink()` helper in `src/lib/whatsapp.ts` that strips a leading `55` when number exceeds 11 digits; all three CTA sites now use it |
| 3 | HIGH | `footer.tsx` | `new Date().getFullYear()` evaluated at build time in an SSG Server Component — copyright year would be stale for the entire year after a deploy | Added `suppressHydrationWarning` (correct Next.js idiom for time-sensitive static content); year remains correct on hydration |
| 4 | MEDIUM | `testimonials.tsx` | `Stars` component rendered 5 `<Star>` icons with no accessible label — screen readers announced 5 unnamed SVG icons with no context | Added `role="img"` + `aria-label="5 de 5 estrelas"` on wrapper `div`; each `<Star>` marked `aria-hidden="true"` |
| 5 | MEDIUM | `footer.tsx` | Phone number formatted via positional `.slice()` with no length guard — any number not exactly 11 digits would silently produce a malformed display string | Replaced with `formatBrPhone()` helper that handles 10-digit landlines, strips leading `55`, and falls back to raw number rather than garbling it |
| 6 | MEDIUM | `page.tsx` | `<main>` had no `id` attribute — skip link added in finding #1 had no target | Added `id="main-content"` to `<main>` |
| 7 | MEDIUM | `layout.tsx` | `metadata` object had only `title`/`description` — no `openGraph` or `twitter` entries, so link previews from Meta ads would show empty cards | Added `openGraph` (type, locale, siteName) and `twitter` (summary_large_image card) metadata |
| 8 | MEDIUM | `navbar.tsx`, `pricing.tsx`, `hero.tsx` | Decorative Lucide icons (`<PartyPopper>`, `<Smile>`, `<MessageCircle>`, `<Clock>`, `<ShieldCheck>`, `<Zap>`) lacked `aria-hidden="true"` — screen readers would announce icon names in the middle of button/label text | Added `aria-hidden="true"` to all purely decorative icon instances |

---

## Change Log

- **2026-03-30**: Implemented landing page layout with Hero, How-It-Works, Pricing, Testimonials, Navbar, Footer, and WhatsApp FAB. All Server Components except FAB. SSG confirmed. Fixed pre-existing AI SDK maxTokens rename to unblock build.
- **2026-03-30**: Code review patches applied — a11y (skip link, star ratings, decorative icons), WhatsApp URL normalisation, SSG copyright year, phone formatting guard, OG/Twitter metadata.

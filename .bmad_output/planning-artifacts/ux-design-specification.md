---
title: "UX Design Specification: Mascotinhos Landing Page"
status: "complete"
created: "2026-03-27"
design_system: "The Joyful Curator"
tech_stack: "Next.js + shadcn/ui + Tailwind CSS"
inputs: [DESIGN.md, prd.md, architecture.md]
---

# UX Design Specification: Mascotinhos Landing Page

## 1. Design Philosophy & Principles

### "The Joyful Curator" Approach

The Mascotinhos landing page adopts **The Joyful Curator** as its creative North Star -- an editorial approach that treats every screen like a premium, physical party invitation. We break the "template" look through intentional asymmetry, overlapping elements, and a high-contrast typography scale. Instead of rigid rows, the page uses "floating" modules and organic, confetti-like decorative elements to create movement and energy.

The page must feel like interacting with a living celebration, not browsing a database.

### Key Principles

1. **Celebratory** -- Every element radiates party energy. Confetti accents, vivid pinks, sunny yellows, and rounded corners create joy at every scroll position.
2. **Editorial** -- Asymmetric margins, overlapping images over container edges, and a generous type scale give the page a premium magazine-quality feel that distinguishes it from commodity template sites.
3. **Mobile-first** -- 95%+ of traffic arrives from Meta ads on mobile devices. Every design decision starts at 375px and scales up. Touch targets are minimum 44px. Full-width CTAs on mobile.
4. **Trust-building** -- Brazilian mothers aged 25-40 have been burned by Instagram sellers who ghost after payment. The page must establish credibility through before/after proof, clear pricing (no hidden costs), testimonials, and visible legal compliance.

### The Emotional Journey

The page scroll choreographs a deliberate emotional arc:

| Scroll Position | Emotion | Mechanism |
|---|---|---|
| Hero (top) | **Curiosity + Delight** | Stunning mascotinho example, bold headline, price visible immediately |
| Portfolio | **Confidence** | Before/after proof -- "it actually looks like the child" |
| Style Browser | **Desire + Personalization** | "I want THIS style for MY child's party" |
| How It Works | **Ease** | 3-step simplicity dissolves hesitation |
| Pricing | **Urgency + Fairness** | Clear R$29.90, no hidden costs, PIX convenience |
| Social Proof | **Trust** | Other mothers loved it, shared on Instagram |
| Footer | **Safety** | Legal links, contact, LGPD compliance |

The CTA ("Quero meu mascotinho!") is accessible at every stage via the sticky WhatsApp FAB.

---

## 2. Color System

### The Palette

The palette follows a "Soft-Vivid" dichotomy: a gentle, airy base allows high-energy action colors to pop without overwhelming cognitive load.

| Token | Hex | Usage |
|---|---|---|
| `surface` | `#fff4f5` | Page background -- the airy, pink-white canvas |
| `surface_container_low` | `#fdedf0` | Alternate section backgrounds for "soft lift" separation |
| `surface_container` | `#f5e4e8` | Deeper section backgrounds (before/after showcase) |
| `surface_container_high` | `#efdee2` | Skeleton loading placeholders |
| `surface_container_highest` | `#ead8dd` | Input field backgrounds |
| `surface_container_lowest` | `#ffffff` | Card surfaces (pure white on pink creates the "raised" effect) |
| `primary` | `#b10b68` | Primary CTA fills, brand accents, high-conversion moments |
| `primary_container` | `#ff6dad` | Gradient end for CTA buttons, primary-fixed badges |
| `primary_dim` | `#9d005b` | Hover/active state for primary actions |
| `secondary` | `#005f9c` | Functional icons, step indicators, secondary interactions |
| `secondary_container` | `#b1d5ff` | Light blue accents, decorative elements |
| `secondary_fixed` | `#b1d5ff` | Focus states (soft outer glow) |
| `tertiary` | `#785500` | Confetti star/circle decorations |
| `tertiary_container` | `#fcca6d` | Sunny yellow highlight badges ("Mais Pedido", "OFERTA ESPECIAL") |
| `tertiary_fixed` | `#fcca6d` | High-priority callouts, confetti moments |
| `on_surface` | `#352d2f` | All body text -- NEVER use pure black `#000000` |
| `on_surface_variant` | `#63595c` | Secondary text, descriptions, captions |
| `on_primary` | `#ffeff2` | Text on primary backgrounds |
| `on_tertiary_container` | `#5f4200` | Text on yellow highlight badges |
| `outline` | `#7f7477` | Muted text (strikethrough prices, metadata) |
| `outline_variant` | `#b7aaad` | Ghost borders (15% opacity if accessibility requires), confetti BG (30% opacity) |
| `error` | `#b41340` | Error text, urgency messaging |
| `error_container` | `#f74b6d` | Error backgrounds at 20% opacity |

### The "No-Line" Rule

**1px solid borders are strictly prohibited** for sectioning. Boundaries are defined through:

1. **Tonal Shifts:** Alternating `surface` (`#fff4f5`) and `surface_container_low` (`#fdedf0`) section backgrounds
2. **Soft Transitions:** Subtle background color shifts imply context changes
3. **Ghost Border Fallback:** If accessibility requires a border, use `outline_variant` at 15% opacity -- felt, not seen

Testimonial cards with `border border-surface-container` should be replaced with tonal differentiation (white card on `surface_container_low` background).

### Glass & Gradient Strategy

- **Main CTAs and Hero:** Apply linear gradient from `primary` (`#b10b68`) to `primary_container` (`#ff6dad`) at 135-degree angle. Never flat fills for primary actions.
- **Navigation bar:** Glassmorphism -- `bg-white/80 backdrop-blur-md` with primary-tinted shadow: `shadow-[0_10px_30px_rgba(177,11,104,0.05)]`
- **Floating elements (FAB):** Hyper-diffused shadow: `box-shadow: 0 20px 40px rgba(177,11,104,0.08)` -- shadow tinted with primary, never grey

### Dark Mode

Skip for MVP. Light-only. The `surface` pink-white palette is the brand identity.

---

## 3. Typography

### Font Pairing

| Role | Font | Weight | Usage |
|---|---|---|---|
| Display / Headlines | Plus Jakarta Sans | 700 (bold), 800 (extrabold) | Hero statements, section titles, pricing |
| Body / Labels | Be Vietnam Pro | 400 (regular), 500 (medium), 700 (bold) | Descriptions, CTAs, navigation, captions |

### Type Scale

| Token | Size | Line Height | Letter Spacing | Tailwind Classes | Usage |
|---|---|---|---|---|---|
| `display-lg` | 3.5rem (56px) | 1.1 | -2% (`tracking-tight`) | `text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.1]` | Hero headline only |
| `headline-md` | 1.75rem (28px) | 1.2 | -1% | `text-3xl font-bold` | Section titles |
| `headline-sm` | 1.25rem (20px) | 1.3 | 0 | `text-xl font-bold` | Card titles, step headings |
| `body-lg` | 1rem (16px) | 1.6 | 0 | `text-lg leading-relaxed` | Descriptive paragraphs |
| `body-md` | 0.875rem (14px) | 1.5 | 0 | `text-sm` | Card descriptions, secondary text |
| `label-md` | 0.75rem (12px) | 1.4 | +5% (`tracking-widest`) | `text-[10px] uppercase tracking-widest font-bold` | Category tags, section labels, "boutique" labels |

### Typography Rules

- **Headlines** always use `on_surface` (`#352d2f`) for readability against the soft pink background
- **Body text** uses `on_surface_variant` (`#63595c`) for secondary/descriptive content
- **Section pre-labels** (e.g., "Simples & Rapido") use `label-md` style: uppercase, `tracking-widest`, `secondary` color (`#005f9c`), `font-bold`
- **Never** use pure black (`#000000`) for any text element

### Tailwind Font Configuration

```js
// tailwind.config.ts
fontFamily: {
  headline: ["var(--font-plus-jakarta-sans)", "Plus Jakarta Sans", "sans-serif"],
  body: ["var(--font-be-vietnam-pro)", "Be Vietnam Pro", "sans-serif"],
  label: ["var(--font-be-vietnam-pro)", "Be Vietnam Pro", "sans-serif"],
}
```

Load via `next/font`:

```tsx
import { Plus_Jakarta_Sans, Be_Vietnam_Pro } from "next/font/google";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  weight: ["400", "700", "800"],
  display: "swap",
});

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin"],
  variable: "--font-be-vietnam-pro",
  weight: ["400", "500", "700"],
  display: "swap",
});
```

---

## 4. Component Specifications

### 4.1 Navigation Bar (TopAppBar)

**Purpose:** Minimal branding header, fixed on scroll with glassmorphism.

**Layout:**
- Fixed top, full-width, `z-50`
- Rounded bottom corners: `rounded-b-3xl` (rounded-b-[1.5rem])
- Glass effect: `bg-white/80 backdrop-blur-md`
- Shadow: `shadow-[0_10px_30px_rgba(177,11,104,0.05)]`
- Max width: `max-w-7xl mx-auto`
- Padding: `px-6 py-4`

**Content:**
- Left: Celebration icon (Material Symbols `celebration`, filled) + "Mascotinhos Festa" in Plus Jakarta Sans, `text-2xl font-black italic text-primary tracking-tight`
- Right: Hamburger menu icon (hidden for MVP -- no additional pages beyond main + legal)

**Mobile:** Same layout, full-width. No hamburger menu content for MVP.

---

### 4.2 Hero Section

**Purpose:** Instant comprehension + emotional hook + primary CTA. The visitor must understand the product, see the quality, and know the price within 3 seconds.

**Layout:**
- Centered, single-column on all breakpoints
- `px-6 py-12 lg:py-24`
- `max-w-7xl mx-auto`
- Relative positioning for floating confetti decorations

**Elements (top to bottom):**

1. **Hero Image** (mascotinho example)
   - Circular frame: `w-64 h-64 md:w-80 md:h-80`
   - White border: `border-[8px] border-white`
   - Heavy shadow: `shadow-2xl`
   - `rounded-full overflow-hidden`
   - Background: `surface_container_lowest` (pure white)
   - Floating confetti blurs: `tertiary_container` and `secondary_container` circles, `opacity-20 blur-xl`, positioned asymmetrically (`-top-6 -left-6`, `-bottom-6 -right-6`)
   - Star badge overlapping top-right: `bg-tertiary text-on-tertiary p-3 rounded-full shadow-lg z-20`, positioned `absolute -top-2 -right-2`

2. **Headline**
   - Font: Plus Jakarta Sans, `text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.1]`
   - Color: `on_surface` (`#352d2f`)
   - Key word "mascotinho" in `text-primary italic` for emphasis
   - Text: "Seu filho como personagem -- a magia de um _mascotinho_ exclusivo"

3. **Subheadline**
   - Font: Be Vietnam Pro, `text-lg md:text-xl leading-relaxed`
   - Color: `on_surface_variant` (`#63595c`)
   - Max width: `max-w-2xl`
   - Margin bottom: `mb-10`
   - Text: "Transformamos a foto do seu pequeno em uma ilustracao personalizada para convites, lembrancas e topo de bolo. O toque magico que sua festa merece!"

4. **Primary CTA Button**
   - Tag: `<a>` linking to `https://wa.me/55{number}?text=Oi!+Quero+fazer+meu+mascotinho!`
   - Style: `bg-gradient-to-br from-primary to-primary-container text-white px-8 py-5 rounded-full text-xl font-bold`
   - Shadow: `shadow-[0_20px_40px_rgba(177,11,104,0.15)]`
   - Hover: `hover:scale-105 transition-all duration-300`
   - Active: `active:scale-95`
   - Icon: WhatsApp chat icon (Material Symbols `chat`) left of text
   - Text: "Criar meu Mascotinho -- R$29,90"
   - Flex layout: `flex items-center gap-3`

**Spacing:** Image container `mb-8`, headline `mb-6`, subheadline `mb-10`

---

### 4.3 How It Works Section

**Purpose:** Dissolve hesitation by showing the 3-step simplicity.

**Background:** `surface_container_low/50` (semi-transparent alternate surface) with `rounded-xl mx-4 md:mx-0`

**Spacing:** `py-20`, inner `max-w-7xl mx-auto px-6`

**Section Label:**
- "Simples & Rapido" -- `label-md` style: `uppercase tracking-widest text-secondary font-bold mb-4 block`

**Section Title:**
- "Como funciona?" -- Plus Jakarta Sans, `text-3xl font-bold text-on-surface`
- Centered, `mb-16`

**Steps Grid:**
- `grid grid-cols-1 md:grid-cols-3 gap-12`
- Desktop: dotted connector line between steps (`hidden md:block absolute top-12 left-1/4 right-1/4 h-0.5 border-t-2 border-dotted border-secondary-fixed opacity-50`)

**Each Step:**
- Circular icon: `w-20 h-20 rounded-full bg-secondary text-white flex items-center justify-center mb-6 shadow-lg shadow-secondary/20`
- Icon size: `text-3xl` (Material Symbols)
- Step title: `font-bold text-xl mb-2`
- Description: `text-on-surface-variant`
- Centered alignment: `flex flex-col items-center text-center`

**Step Content:**

| Step | Icon | Title | Description |
|---|---|---|---|
| 1 | `add_a_photo` | Envie a foto | Escolha uma foto bem nitida do rosto do seu pequeno. |
| 2 | `palette` | Escolha o estilo | Do Disney 3D ao Anime, voce decide o visual magico. |
| 3 | `chat` | Receba pelo WhatsApp | Em minutos sua arte esta pronta para usar. |

**Design System Reference:** This implements the **Celebration Progress Bar** pattern from DESIGN.md -- the circular step indicators with secondary blue fill act as the "staggered circles that light up" as the user conceptually completes steps.

---

### 4.4 Style Browser Section

**Purpose:** Show available mascotinho styles and let visitors jump directly to WhatsApp with a pre-filled style preference.

**Background:** Default `surface` (no alternate background -- follows the alternating pattern)

**Spacing:** `py-24`, inner `max-w-7xl mx-auto px-6`

**Section Title:**
- "Estilos que encantam" -- Plus Jakarta Sans, `text-3xl font-bold text-on-surface mb-12`
- Mobile: centered. Desktop: `text-center md:text-left`

**Layout:**
- Horizontal scroll carousel: `flex overflow-x-auto gap-6 pb-8 snap-x`
- Hide scrollbar: `no-scrollbar` (CSS: `-webkit-overflow-scrolling: touch; scrollbar-width: none;`)
- Snap behavior: `snap-x` container, `snap-center` children
- Future enhancement: Convert to grid on desktop (`md:grid md:grid-cols-3`)

**Style Card:**
- Min width: `min-w-[280px]`
- Background: `surface_container_lowest` (pure white)
- Corners: `rounded-lg` (1rem)
- Overflow: `hidden` (image clips to rounded top)
- Shadow: `shadow-sm` default, `hover:shadow-xl` on hover
- Transition: `transition-all duration-300`

**Card Content:**
- Image: `w-full h-48 object-cover` -- example mascotinho in that style
- Body: `p-6`
  - Style name: `font-bold text-lg mb-1`
  - Description: `text-sm text-on-surface-variant`
  - CTA button (add for production): "Quero esse estilo!" linking to `wa.me` with pre-filled message per style

**Popularity Badge (on most popular card):**
- Position: `absolute -top-4 right-4` (inside card body, relative)
- Style: `bg-tertiary-container text-on-tertiary-container text-[10px] font-bold px-2 py-1 rounded-full uppercase`
- Text: "Mais Pedido"

**Confetti Offset Rule:** Per DESIGN.md, every 3rd card gets a confetti decoration -- a small `tertiary` star or circle icon overlapping the top-right corner by 50%.

**Available Styles (MVP):**

| Style | Description |
|---|---|
| Chibi | Fofura extrema com proporcoes mini |
| Disney 3D | O visual cinematografico das grandes telas |
| Aquarela | Toque artistico, delicado e artesanal |
| Anime | Para os pequenos herois e heroinas |
| Princesa | Realeza encantada para festas magicas |
| Safari | Aventura selvagem para exploradores |

**Data Source:** Styles loaded from `StyleTemplate` table at build time via ISR (revalidate every 1 hour). Only `active = true` templates displayed, sorted by `popularityCount` descending.

---

### 4.5 Portfolio Gallery (Before/After Showcase)

**Purpose:** Build trust by proving the AI output genuinely captures the child's likeness.

**Background:** `surface_container` (`#f5e4e8`) -- the deeper tonal surface for contrast

**Spacing:** `py-20`, inner `max-w-4xl mx-auto px-6`

**Section Header:**
- Title: "Veja a transformacao" -- Plus Jakarta Sans, `text-3xl font-bold text-on-surface mb-4`
- Subtitle: "De uma foto comum para um mascotinho memoravel." -- `text-on-surface-variant`
- Centered: `text-center mb-12`

**Before/After Grid:**
- Container: `bg-surface-container-lowest p-4 rounded-lg shadow-xl`
- Grid: `grid grid-cols-2 gap-4`
- Each side fills half the container

**Original Photo (left):**
- `rounded-lg w-full h-64 md:h-96 object-cover`
- Apply `grayscale opacity-80` filter to visually distinguish from the result
- Badge: `absolute top-4 left-4` -- "ORIGINAL" in `bg-black/50 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-md`

**Mascotinho Result (right):**
- `rounded-lg w-full h-64 md:h-96 object-cover`
- Full color, no filters
- Badge: `absolute top-4 left-4` -- "MASCOTINHO" in `bg-primary text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg`

**Image Requirements:**
- Served from `public/images/` (static, curated by operator)
- Use Next.js `<Image>` component with explicit `width`, `height`, and `sizes` props
- Lazy-loaded: images below fold use `loading="lazy"`
- Alt text required for all images describing the transformation

**Future Enhancement:** Multiple before/after pairs in a carousel or 2-column vertical stack.

---

### 4.6 Pricing Section

**Purpose:** Remove price ambiguity and create urgency. Single price, no confusion.

**Background:** Default `surface` (alternating from previous section)

**Spacing:** `py-24 px-6`

**Card:**
- `max-w-2xl mx-auto`
- Background: `surface_container_lowest` (pure white)
- Corners: `rounded-lg`
- Padding: `p-10`
- Shadow: `shadow-2xl`
- Centered text: `text-center`
- Top accent: `border-t-8 border-primary` (note: this is a structural accent, not a divider line -- acceptable under the No-Line rule as it serves as a decorative crown on the card)

**Yellow Ribbon Badge:**
- Position: `absolute -top-5 left-1/2 -translate-x-1/2`
- Style: `bg-tertiary-container text-on-tertiary-container font-black px-8 py-2 rounded-full shadow-md whitespace-nowrap`
- Font: Plus Jakarta Sans, italic
- Text: "OFERTA ESPECIAL"

**Content:**
1. Label: "Preco unico promocional" -- `text-on-surface-variant mb-2`
2. Price display:
   - Strikethrough: "R$89,90" in `text-2xl text-outline line-through`
   - Current: "R$29,90" in `text-5xl font-black text-on-surface headline-font`
   - Flex row: `flex items-center justify-center gap-4 mb-4`
3. Urgency line: "Ultimas vagas do dia com este valor!" in `text-error font-bold` with alarm icon
4. CTA button: Full-width, `bg-primary text-white py-5 rounded-full text-xl font-bold shadow-lg hover:brightness-110 active:scale-95 transition-all`
   - Text: "Garantir meu Mascotinho Agora"
   - Links to `wa.me` with pre-filled message
5. Trust badges row: `mt-6 flex items-center justify-center gap-6 text-sm text-outline`
   - "Pago via Pix" with verified icon in `secondary`
   - "Entrega Rapida" with bolt icon in `secondary`

**Value Proposition Bullets (add below trust badges):**
- 1 mascotinho personalizado
- 2 ajustes inclusos
- Entrega em minutos, nao dias
- Pagamento seguro via PIX

---

### 4.7 Social Proof / Testimonials Section

**Purpose:** Peer validation from other mothers.

**Background:** Default `surface` (continues from pricing section)

**Spacing:** `pb-24`, inner `max-w-7xl mx-auto px-6`

**Section Title:**
- "Maes que amaram" -- Plus Jakarta Sans, `text-2xl font-bold text-on-surface mb-10`

**Layout:**
- Horizontal scroll carousel: `flex overflow-x-auto gap-6 pb-6 no-scrollbar snap-x`
- Each card: `min-w-[320px] snap-center`

**Testimonial Card:**
- Background: `bg-white` (`surface_container_lowest`)
- Padding: `p-6`
- Corners: `rounded-lg`
- Shadow: `shadow-sm`
- No border (use shadow-only per No-Line rule)

**Card Content:**
1. Star rating: 5x Material Symbols `star` (filled) in `text-tertiary`, `flex gap-1 mb-4`
2. Quote: Italic text in `text-on-surface mb-6`
3. Author row: `flex items-center gap-4`
   - Avatar: `w-12 h-12 rounded-full overflow-hidden bg-surface-container`
   - Name: `font-bold text-sm`
   - Label: `text-[10px] text-outline uppercase tracking-wider` (e.g., "Mae do Theo")

**MVP Content:** Use 2-3 curated testimonials. For MVP launch, these can be based on beta testers or placeholder content clearly marked for replacement with real testimonials post-launch.

---

### 4.8 Footer

**Purpose:** Legal compliance, brand closure, navigation.

**Layout:**
- Full-width: `w-full`
- Rounded top: `rounded-t-[2rem]`
- Background: `bg-pink-50` (lighter than `surface`, matches `#fdf2f8` from Tailwind's pink palette -- or use `surface_container_low`)
- Flex: `flex flex-col md:flex-row justify-between items-center px-8 py-12 gap-6`
- Margin top: `mt-auto`

**Content:**
- Left: Brand name "Mascotinhos Festa" (`text-lg font-bold text-primary headline-font mb-2`) + copyright (`text-sm text-on-surface-variant`)
- Right: Navigation links in a flex row with `gap-8`
  - "Nossos Temas" (anchor to styles section)
  - "Como Funciona" (anchor to how-it-works section)
  - "Contato" (anchor to WhatsApp or mailto)
  - **"Politica de Privacidade"** (link to `/privacy`)
  - **"Termos de Uso"** (link to `/terms`)
- Link style: `text-sm text-on-surface-variant hover:text-primary transition-all`

**Legal Additions (required by PRD):**
- LGPD notice: Small text below copyright: "Seus dados sao protegidos conforme a LGPD. Consulte nossa Politica de Privacidade."
- Contact info: WhatsApp number and/or email for consumer protection compliance (CDC)
- CNPJ/MEI info: Required for Brazilian e-commerce

---

### 4.9 WhatsApp Floating Action Button (FAB)

**Purpose:** Persistent CTA accessible at every scroll position. The primary conversion mechanism.

**Position:** `fixed bottom-6 right-6 z-50`

**Style:**
- Size: `w-16 h-16`
- Background: WhatsApp green `#25D366`
- Text/icon: white
- Corners: `rounded-full`
- Shadow: `shadow-2xl`
- Icon: WhatsApp SVG logo, `width="32" height="32"`

**Interaction:**
- Hover: `hover:scale-110`
- Active: `active:scale-90`
- Transition: `transition-transform`
- First-load animation: Pulse effect for 3 seconds, then static (draws attention without being permanently distracting)

**Link:** `https://wa.me/55{number}?text=Oi!+Quero+fazer+meu+mascotinho!`

**Pulse Animation (CSS):**
```css
@keyframes whatsapp-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.4); }
  50% { box-shadow: 0 0 0 16px rgba(37, 211, 102, 0); }
}
```

---

## 5. Page Layout & Flow

### Section Order (Scroll Sequence)

| # | Section | Background | Spacing |
|---|---|---|---|
| 0 | Navigation (fixed) | Glassmorphism white/80 | `px-6 py-4` |
| 1 | Hero | `surface` (`#fff4f5`) + confetti BG | `pt-24 pb-12` (pt accounts for fixed nav) |
| 2 | How It Works | `surface_container_low/50` (`#fdedf0`) | `py-20` |
| 3 | Style Browser | `surface` (`#fff4f5`) | `py-24` |
| 4 | Portfolio (Before/After) | `surface_container` (`#f5e4e8`) | `py-20` |
| 5 | Pricing | `surface` (`#fff4f5`) | `py-24 px-6` |
| 6 | Testimonials | `surface` (`#fff4f5`) | `pb-24` |
| 7 | Footer | `surface_container_low` / `pink-50` | `px-8 py-12` |
| -- | WhatsApp FAB (fixed) | WhatsApp green | `bottom-6 right-6` |

### Background Alternation Pattern

Sections alternate between `surface` and `surface_container_low` / `surface_container` to create the "soft lift" tonal separation mandated by the No-Line rule. The pattern:

```
surface → surface_container_low → surface → surface_container → surface → surface → surface_container_low
```

### Confetti Background Layer

A fixed, non-interactive confetti pattern sits behind all content:

```css
.confetti-bg {
  background-image:
    radial-gradient(#fcca6d 1.5px, transparent 1.5px),
    radial-gradient(#ff6dad 1.5px, transparent 1.5px);
  background-size: 40px 40px;
  background-position: 0 0, 20px 20px;
  opacity: 0.15;
}
```

Applied as an `absolute inset-0 pointer-events-none` layer inside `<main>`.

### Spacing System

Based on DESIGN.md spacing scale:

| Scale | Value | Usage |
|---|---|---|
| `4` | 1rem (16px) | Card internal padding, small gaps |
| `6` | 1.5rem (24px) | Card content separation (DESIGN.md rule) |
| `8` | 2rem (32px) | Internal section padding |
| `12` | 3rem (48px) | Section title to content |
| `16` | 4rem (64px) | Between major sections (top padding) |
| `20` | 5rem (80px) | Section vertical padding |
| `24` | 6rem (96px) | Large section vertical padding |

### Asymmetric Margins

Per DESIGN.md "Do" rules, apply intentional asymmetry:
- If left margin is `4rem`, right can be `5.5rem` for editorial feel
- Images should overlap container edges where possible to "break the box"
- Confetti decorations placed at asymmetrical intervals

---

## 6. Interaction Patterns

### Button Interactions

| State | Behavior |
|---|---|
| Default | Gradient fill (primary to primary-container), white text, primary-tinted shadow |
| Hover | `scale-105` + increased shadow diffusion (`shadow-[0_20px_40px_rgba(177,11,104,0.15)]`) |
| Active/Press | `scale-95` (tactile 98% compression) |
| Transition | `transition-all duration-300` |

### Card Interactions

| State | Behavior |
|---|---|
| Default | `shadow-sm` (barely visible elevation) |
| Hover | `shadow-xl` (significant lift) with `transition-all duration-300` |
| No transform on hover | Cards do not scale; only shadow changes |

### Scroll Animations

Use CSS animations or `framer-motion` for section reveals:

- **Fade-in-up:** Each section fades in and slides up 20px when entering viewport
- **Stagger:** Child elements within a section stagger by 100ms
- **Trigger:** IntersectionObserver at 10% visibility threshold
- **Duration:** 600ms with `ease-out` timing

```tsx
// Example with Tailwind CSS animation (no JS library needed for MVP)
// Add to globals.css:
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in-up {
  animation: fade-in-up 0.6s ease-out forwards;
}
```

For MVP, a simple CSS-only approach using `scroll-timeline` or IntersectionObserver adding a class is sufficient. `framer-motion` can be added later for more sophisticated animations.

### Image Loading

- **Skeleton placeholders:** Use `surface_container_high` (`#efdee2`) as the skeleton fill color
- **Blur placeholder:** Next.js Image `placeholder="blur"` with a low-res blurDataURL
- **Transition:** Fade from skeleton/blur to loaded image over 300ms

### WhatsApp FAB

- First load: 3-second pulse animation (keyframe defined in section 4.9)
- After 3 seconds: Static, no animation
- On scroll past hero: Remains fixed, always visible
- Respects `prefers-reduced-motion`: No pulse if user has motion preferences

### Link Interactions

- Footer links: `hover:text-primary hover:translate-x-1 transition-all active:opacity-80`
- Navigation links: Smooth scroll to section anchors

---

## 7. Responsive Breakpoints

### Mobile (default): 375px

- Single-column layout for all sections
- Hero image: `w-64 h-64` (256px)
- Hero headline: `text-4xl` (2.25rem)
- Full-width CTA buttons
- Style cards: horizontal scroll carousel
- Before/after: 2-column grid within container (`grid-cols-2`)
- Before/after image height: `h-64` (256px)
- Touch targets: minimum 44px (48px preferred)
- Section horizontal padding: `px-6` (24px)
- How-it-works: vertical stack (`grid-cols-1`)
- Testimonials: horizontal scroll carousel

### Tablet: 768px (`md:`)

- Hero image: `md:w-80 md:h-80` (320px)
- Hero headline: `md:text-6xl` (3.75rem)
- Hero subheadline: `md:text-xl`
- How-it-works: 3-column grid (`md:grid-cols-3`) with connector line
- Style cards: still carousel (or 2-column grid: `md:grid md:grid-cols-2`)
- Before/after image height: `md:h-96` (384px)
- Footer: horizontal flex (`md:flex-row`)
- Section padding adjustments: `md:mx-0` for how-it-works container

### Desktop: 1024px (`lg:`)

- Hero section: `lg:py-24` (increased vertical padding)
- Style cards: 3-column grid (`lg:grid lg:grid-cols-3`) -- replace carousel
- Max content width: `max-w-7xl` (1280px) centered with `mx-auto`
- Section titles: `md:text-left` for editorial asymmetry
- Footer: wider with more generous spacing

### Specific Measurements

| Element | Mobile | Tablet | Desktop |
|---|---|---|---|
| Max content width | 100% - 48px | 100% - 48px | 1280px (max-w-7xl) |
| Hero image | 256x256 | 320x320 | 320x320 |
| Hero headline | 2.25rem | 3.75rem | 3.75rem |
| Style card width | 280px (carousel) | 50% (grid) | 33.3% (grid) |
| Portfolio pair height | 256px | 384px | 384px |
| CTA button padding | px-8 py-5 | px-8 py-5 | px-8 py-5 |
| Section padding top/bottom | 80px (py-20) | 80px (py-20) | 96px (py-24) |

---

## 8. Accessibility

### Color Contrast

| Combination | Ratio | WCAG AA |
|---|---|---|
| `on_surface` (#352d2f) on `surface` (#fff4f5) | ~12.5:1 | Pass |
| `on_surface_variant` (#63595c) on `surface` (#fff4f5) | ~5.8:1 | Pass |
| `primary` (#b10b68) on `surface` (#fff4f5) | ~6.2:1 | Pass |
| White (#ffffff) on `primary` (#b10b68) | ~5.5:1 | Pass |
| White (#ffffff) on WhatsApp green (#25D366) | ~2.8:1 | Fail (icon only -- acceptable for recognizable brand mark, add aria-label) |
| `on_tertiary_container` (#5f4200) on `tertiary_container` (#fcca6d) | ~5.1:1 | Pass |
| `error` (#b41340) on `surface` (#fff4f5) | ~7.3:1 | Pass |

### Image Accessibility

- All portfolio images: descriptive `alt` text including what the original photo shows and what style the mascotinho was generated in
- Decorative confetti elements: `aria-hidden="true"` or empty `alt=""`
- Hero mascotinho image: meaningful alt (e.g., "Exemplo de mascotinho estilo Chibi -- ilustracao fofa de uma crianca com olhos grandes e expressivos")

### Keyboard Navigation

- All interactive elements (CTAs, links, style cards) reachable via Tab
- Focus order follows visual order (Hero CTA -> How It Works -> Style cards -> Portfolio -> Pricing CTA -> Testimonials -> Footer links -> FAB)
- WhatsApp FAB: focusable, with `aria-label="Iniciar conversa no WhatsApp"`

### Focus States

Per DESIGN.md:
- Soft 2px outer glow using `secondary_fixed` (`#b1d5ff`)
- Applied via `focus-visible:ring-2 focus-visible:ring-secondary-fixed focus-visible:ring-offset-2 focus-visible:outline-none`
- Ring offset uses page background color for clean separation

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- WhatsApp FAB pulse: disabled
- Scroll animations: elements appear immediately without slide/fade
- Hover transforms: scale transitions disabled, shadows still change
- Carousel scroll: still functional (scroll is user-initiated, not animated)

### Semantic HTML

- `<header>` for navigation
- `<main>` for page content
- `<section>` for each content block with `aria-label` or heading
- `<footer>` for footer
- `<nav>` for navigation and footer links
- `<h1>` for brand name, `<h2>` for hero headline, `<h3>` for section titles
- Heading hierarchy must be sequential (no skipping levels)

### Language

- `<html lang="pt-BR">` -- all content in Brazilian Portuguese
- Screen reader-friendly Portuguese text

---

## 9. Implementation Notes (for developers)

### Tailwind Configuration

Extend the default Tailwind config with the full design token palette:

```ts
// tailwind.config.ts (inside extend)
colors: {
  "surface": "#fff4f5",
  "surface-bright": "#fff4f5",
  "surface-dim": "#e2d0d4",
  "surface-container": "#f5e4e8",
  "surface-container-low": "#fdedf0",
  "surface-container-high": "#efdee2",
  "surface-container-highest": "#ead8dd",
  "surface-container-lowest": "#ffffff",
  "surface-variant": "#ead8dd",
  "surface-tint": "#b10b68",
  "on-surface": "#352d2f",
  "on-surface-variant": "#63595c",
  "on-background": "#352d2f",
  "background": "#fff4f5",
  "primary": "#b10b68",
  "primary-dim": "#9d005b",
  "primary-container": "#ff6dad",
  "primary-fixed": "#ff6dad",
  "primary-fixed-dim": "#fb53a2",
  "on-primary": "#ffeff2",
  "on-primary-container": "#4b0029",
  "on-primary-fixed": "#000000",
  "on-primary-fixed-variant": "#5c0033",
  "secondary": "#005f9c",
  "secondary-dim": "#005389",
  "secondary-container": "#b1d5ff",
  "secondary-fixed": "#b1d5ff",
  "secondary-fixed-dim": "#96c8ff",
  "on-secondary": "#ecf3ff",
  "on-secondary-container": "#004a7b",
  "on-secondary-fixed": "#00365c",
  "on-secondary-fixed-variant": "#00548a",
  "tertiary": "#785500",
  "tertiary-dim": "#694a00",
  "tertiary-container": "#fcca6d",
  "tertiary-fixed": "#fcca6d",
  "tertiary-fixed-dim": "#edbc61",
  "on-tertiary": "#fff1de",
  "on-tertiary-container": "#5f4200",
  "on-tertiary-fixed": "#463000",
  "on-tertiary-fixed-variant": "#6a4b00",
  "outline": "#7f7477",
  "outline-variant": "#b7aaad",
  "error": "#b41340",
  "error-dim": "#a70138",
  "error-container": "#f74b6d",
  "on-error": "#ffefef",
  "on-error-container": "#510017",
  "inverse-surface": "#130c0f",
  "inverse-on-surface": "#a69a9d",
  "inverse-primary": "#f8509f",
},
fontFamily: {
  headline: ["var(--font-plus-jakarta-sans)", "Plus Jakarta Sans", "sans-serif"],
  body: ["var(--font-be-vietnam-pro)", "Be Vietnam Pro", "sans-serif"],
  label: ["var(--font-be-vietnam-pro)", "Be Vietnam Pro", "sans-serif"],
},
borderRadius: {
  DEFAULT: "1rem",
  lg: "2rem",
  xl: "3rem",
  full: "9999px",
},
```

### shadcn/ui Components to Use

| Component | Usage |
|---|---|
| `Button` | Primary and secondary CTAs (customized with gradient) |
| `Card` | Style cards, testimonial cards, pricing card |
| `Skeleton` | Image loading placeholders |
| `Badge` (optional) | "Mais Pedido" and "OFERTA ESPECIAL" badges |

### Custom Components Needed

| Component | File Path | Props |
|---|---|---|
| `Hero` | `components/hero.tsx` | None (static content) |
| `HowItWorks` | `components/how-it-works.tsx` | None (static content) |
| `StyleCard` | `components/styles/style-card.tsx` | `{ name, description, image, whatsappLink, badge? }` |
| `StyleBrowser` | `components/styles/style-browser.tsx` | `{ styles: StyleTemplate[] }` |
| `PortfolioCard` | `components/portfolio/portfolio-card.tsx` | `{ originalSrc, mascotinhoSrc, styleName, alt }` |
| `PortfolioGallery` | `components/portfolio/portfolio-gallery.tsx` | `{ pairs: PortfolioPair[] }` |
| `PricingCard` | `components/pricing-card.tsx` | None (static content) |
| `TestimonialCard` | `components/testimonial-card.tsx` | `{ quote, author, role, avatar, rating }` |
| `WhatsAppFAB` | `components/whatsapp-fab.tsx` | `{ phoneNumber }` |
| `Footer` | `components/footer.tsx` | None (static content) |

### Image Optimization

- Use Next.js `<Image>` component for all images
- Set explicit `width` and `height` to prevent CLS
- Use `sizes` prop for responsive optimization:
  - Hero: `sizes="(max-width: 768px) 256px, 320px"`
  - Style cards: `sizes="(max-width: 768px) 280px, (max-width: 1024px) 50vw, 33vw"`
  - Portfolio: `sizes="(max-width: 768px) 50vw, 384px"`
- Portfolio images: `placeholder="blur"` with generated `blurDataURL`
- All images below hero: `loading="lazy"` (default for Next.js Image below fold)
- Formats: WebP/AVIF automatic via Next.js Image

### Fonts Loading

```tsx
// app/layout.tsx
import { Plus_Jakarta_Sans, Be_Vietnam_Pro } from "next/font/google";

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

// Apply to <body>:
<body className={`${plusJakarta.variable} ${beVietnam.variable} font-body`}>
```

### Icons

Use Material Symbols Outlined. Load via:
- Google Fonts link in `<head>` or
- `next/font` with Google Material Symbols (limited support) or
- Inline SVGs for critical icons (WhatsApp logo, star)

For MVP, `lucide-react` can substitute for most icons since it is a shadcn/ui dependency. Map:
- `celebration` -> custom SVG or `PartyPopper` from lucide
- `add_a_photo` -> `Camera` from lucide
- `palette` -> `Palette` from lucide
- `chat` -> `MessageCircle` from lucide
- `star` -> `Star` from lucide
- `verified` -> `ShieldCheck` from lucide
- `bolt` -> `Zap` from lucide
- `alarm` -> `Clock` from lucide

### Rendering Strategy

- **Page:** Static Generation (SSG) -- `export const dynamic = "force-static"` (or default for pages without dynamic data)
- **Style Browser:** ISR with `revalidate: 3600` (1 hour) for style templates from database
- **All components:** Server Components by default. No `"use client"` unless interactive (carousel scroll, FAB animation)

### Global CSS Additions

```css
/* globals.css */

/* Text selection colors */
::selection {
  background-color: #ff6dad; /* primary-container */
  color: #4b0029; /* on-primary-container */
}

/* Confetti background */
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
```

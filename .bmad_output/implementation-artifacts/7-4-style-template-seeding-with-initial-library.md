# Story 7.4: Style Template Seeding with Initial Library

**Epic:** 7 — Resilience & Operator Tools
**Story ID:** 7.4
**GitHub Issue:** [mgiovani/fotos#75](https://github.com/mgiovani/fotos/issues/75)
**Status:** review
**Created:** 2026-03-30

---

## User Story

As the operator,
I want 5-10 style templates pre-loaded in the database with optimized prompts and example images,
So that the bot has a compelling selection ready for the first clients.

---

## Acceptance Criteria

1. **Given** the database is set up and the Prisma schema is deployed
   **When** the seed script runs (`bun run db:seed` or equivalent)
   **Then** 5-10 `StyleTemplate` records are created with: `name`, `slug`, `promptTemplate` (optimized for GPT Image 1.5), `exampleImages` (Supabase Storage URLs), `tags`, `productType = MASCOTINHO`, `active = true`, `popularity = 0`

2. **Given** the seed script runs
   **When** the initial style templates are inserted
   **Then** the templates include at minimum: Princesa, Safari, Jardim Encantado, Sereia, Super-Heroi

3. **Given** the seed is complete
   **When** the bot calls `getGreetingContext` (which queries `WHERE active = true ORDER BY popularity DESC TAKE 3`)
   **Then** the top 3 templates are returned correctly (all templates start at `popularity = 0`, order stable via `id`)

4. **Given** the seed is complete
   **When** `selectStyle` queries `prisma.styleTemplate.findMany({ where: { active: true } })`
   **Then** all seeded templates appear as choices for the client

5. **Given** the seed script runs more than once (idempotent run)
   **When** a `StyleTemplate` with the same `slug` already exists
   **Then** the seed uses `upsert` (conflict on `slug`) to avoid duplicate records

6. **Given** the seed is complete
   **When** the operator adds, edits, or deactivates templates via Supabase SQL
   **Then** changes are reflected in the bot's quick-reply buttons on the next conversation (because bot always queries DB at runtime — no caching)

---

## Tasks / Subtasks

- [x] Task 1: Create `packages/image-gen/src/templates/seed.ts` with style template data (AC: 1, 2, 3, 4)
  - [x] Define TypeScript interface/type for seed template data matching `StyleTemplate` Prisma model fields
  - [x] Create array of 7 style templates: Princesa, Safari, Jardim Encantado, Sereia, Super-Heroi, Astronauta, Fazendinha
  - [x] Each template must have: `name`, `slug` (kebab-case), `promptTemplate` (150-250 word English prompt optimized for GPT Image 1.5), `exampleImages` (empty array `[]` for MVP — real URLs added later), `tags` (array of strings), `productType: "MASCOTINHO"`, `active: true`, `popularity: 0`
  - [x] Write well-crafted `promptTemplate` for each style with placeholders: `{theme}`, `{outfit}`, `{extras}` (these are informational — actual enrichment done by `enrich-prompt.ts` which calls GPT-5-mini to merge template + client details)

- [x] Task 2: Create Prisma seed script `packages/db/prisma/seed.ts` (AC: 1, 5)
  - [x] Import `seedTemplates` from `@mascotinhos/image-gen/templates/seed` (workspace sub-path export — avoids circular dep)
  - [x] Import `prisma` client from `packages/db/src/index.ts`
  - [x] Use `prisma.styleTemplate.upsert` for each template with `where: { slug: template.slug }` to ensure idempotency
  - [x] Add structured console logging (JSON, same pattern as other files): log start, each upsert result, and completion summary
  - [x] Wrap in try/finally to call `await prisma.$disconnect()` on completion or error

- [x] Task 3: Wire up seed script in `packages/db/package.json` (AC: 1)
  - [x] Add `"db:seed": "prisma db seed"` script to `packages/db/package.json`
  - [x] Add Prisma seed configuration to `packages/db/package.json` with `"seed": "bun run prisma/seed.ts"`
  - [x] Add `"db:seed": "turbo -F @mascotinhos/db db:seed"` to root `mascotinhos/package.json`

- [x] Task 4: Export seed data from `packages/image-gen/src/index.ts` (AC: code organization)
  - [x] Add export: `export { seedTemplates } from "./templates/seed"`
  - [x] Export type: `export type { SeedTemplate } from "./templates/seed"`

- [x] Task 5: Run full test suite to confirm no regressions (AC: all)
  - [x] `cd mascotinhos && bun run check-types` — 0 new TypeScript errors in new files; pre-existing errors (bun:test, ArrayBuffer) unchanged
  - [x] `cd mascotinhos && bun test` — 331 pass, 29 fail, 5 errors (identical to pre-story baseline — no new regressions)

---

## Dev Notes

### File Locations — Critical

```
mascotinhos/
├── package.json                                   ← ADD db:seed script
└── packages/
    ├── db/
    │   ├── package.json                           ← ADD "db:seed" script + "prisma" config
    │   └── prisma/
    │       └── seed.ts                            ← NEW: Prisma seed entry point
    └── image-gen/
        └── src/
            ├── index.ts                           ← MODIFY: export seedTemplates
            └── templates/
                └── seed.ts                        ← NEW: template data array
```

The `templates/` directory already exists (empty) at `packages/image-gen/src/templates/`.

### StyleTemplate Prisma Model — Exact Fields

```typescript
// From packages/db/prisma/schema/schema.prisma
model StyleTemplate {
  id             String      @id @default(cuid())
  name           String
  slug           String      @unique   // ← upsert key
  promptTemplate String
  exampleImages  String[]
  popularity     Int         @default(0)
  tags           String[]
  active         Boolean     @default(true)
  productType    ProductType @default(MASCOTINHO)  // enum: only "MASCOTINHO" exists
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
}
```

ProductType enum has only `MASCOTINHO`. Do NOT use string `"MASCOTINHO"` — import and use the Prisma-generated enum.

### Seed Script Pattern — Prisma 7 + Bun

The `packages/db` package uses Prisma 7 with `@prisma/adapter-pg` (PostgreSQL native adapter). The seed script must:
1. Use ESM (`"type": "module"` in packages/db/package.json)
2. Import prisma from `../src/index.ts` (the singleton export)
3. Load env via `dotenv` pointing to `../../apps/web/.env` (same as `prisma.config.ts`)

The seed script entry point is `prisma/seed.ts` inside `packages/db/` (i.e., `packages/db/prisma/seed.ts`). Prisma looks for it relative to `packages/db/`.

Bun can run TypeScript directly: `"seed": "bun run prisma/seed.ts"` works without compilation.

### Template Data Structure

```typescript
// packages/image-gen/src/templates/seed.ts
export interface SeedTemplate {
  name: string;
  slug: string;
  promptTemplate: string;
  exampleImages: string[];  // empty [] for MVP
  tags: string[];
  productType: "MASCOTINHO";
  active: boolean;
  popularity: number;
}
```

### The 7 Required Style Templates

Required by AC (5 minimum, deliver 7):

| # | name | slug | tags |
|---|------|------|------|
| 1 | Princesa | princesa | ["princesa", "fantasia", "menina", "realeza"] |
| 2 | Safari | safari | ["safari", "animais", "aventura", "natureza"] |
| 3 | Jardim Encantado | jardim-encantado | ["jardim", "fadas", "flores", "magico"] |
| 4 | Sereia | sereia | ["sereia", "oceano", "fantasia", "menina"] |
| 5 | Super-Heroi | super-heroi | ["super-heroi", "acao", "poderes", "aventura"] |
| 6 | Astronauta | astronauta | ["astronauta", "espaco", "ciencia", "aventura"] |
| 7 | Fazendinha | fazendinha | ["fazenda", "animais", "campo", "natureza"] |

### Prompt Template Guidelines

Each `promptTemplate` should be 150-250 words in English, optimized for GPT Image 1.5:
- Describe the art style, color palette, lighting, and composition
- Include `{theme}` placeholder where style-specific details go
- Include `{outfit}` placeholder for clothing description
- Include `{extras}` placeholder for additional elements
- Be concrete: specify illustration style (e.g., "soft watercolor", "vibrant digital art", "3D cartoon render")
- Target children's mascot character aesthetic

Example structure:
```
A [art style] illustration of a cute Brazilian child mascot character in a {theme} setting.
The child is dressed in {outfit}. [Style-specific scene description: colors, environment, mood, lighting].
Additional elements: {extras}. [Composition notes: framing, background, visual hierarchy].
Style: [specific aesthetic description]. Render quality: high-detail, child-friendly, vibrant and joyful.
```

The `enrich-prompt.ts` function (already implemented) takes the `promptTemplate` and passes it to GPT-5-mini to merge with actual client inputs (theme, outfit, extras). The placeholders in `promptTemplate` are informational guidance for GPT-5-mini — they do NOT need to be literally interpolated.

### Upsert Pattern — Idempotency

```typescript
// In packages/db/prisma/seed.ts
await prisma.styleTemplate.upsert({
  where: { slug: template.slug },
  create: {
    name: template.name,
    slug: template.slug,
    promptTemplate: template.promptTemplate,
    exampleImages: template.exampleImages,
    tags: template.tags,
    productType: ProductType.MASCOTINHO,  // use Prisma enum, NOT string
    active: template.active,
    popularity: template.popularity,
  },
  update: {
    // On re-run: update prompt and metadata but preserve popularity
    name: template.name,
    promptTemplate: template.promptTemplate,
    exampleImages: template.exampleImages,
    tags: template.tags,
    active: template.active,
    // DO NOT reset popularity on re-seed
  },
});
```

### Prisma Enum Import

```typescript
// In packages/db/prisma/seed.ts
import { ProductType } from "../prisma/generated/client/index.js";
// OR if re-exported from db package:
import prisma from "../src/index.ts";
// Then use ProductType from generated types
```

Check `packages/db/prisma/generated/client/` for exact export paths. Prisma 7 generated client is at `packages/db/prisma/generated/`.

### How Bot Uses Templates (No Changes Needed)

`packages/bot-engine/src/tools/get-greeting-context.ts` already queries:
```typescript
prisma.styleTemplate.findMany({
  where: { active: true },
  orderBy: { popularity: "desc" },
  take: 3,
  select: { id: true, name: true, slug: true },
})
```

`packages/bot-engine/src/tools/select-style.ts` already queries all active templates for matching. Both tools already exist and work — seeding simply populates the data they expect. Do NOT modify bot-engine code.

### exampleImages — Empty for MVP

The AC says "Supabase Storage URLs referenced in records." For MVP seed, use `exampleImages: []` (empty array). Real example images uploaded separately by operator. The field type is `String[]` and accepts empty arrays. Do NOT block seed on image availability.

### Testing Notes

This story has no new unit tests to write. The seed script is a one-time data migration tool.

Validation steps:
1. `bun run check-types` from `mascotinhos/` — confirm 0 new TypeScript errors
2. `bun test` from `mascotinhos/` — confirm no new failures (pre-existing: 29 failing, 5 errors, unchanged)
3. Manual: `cd mascotinhos/packages/db && bun run db:seed` (requires DATABASE_URL) — optional for local validation

### Previous Story Learnings

From Story 7.3:
- Pre-existing test failures: 331 pass, 29 fail, 5 errors (before this story — do not break more)
- Pre-existing TypeScript errors in payments/storage packages are acceptable (`bun:test` type errors)
- Always run `check-types` from `mascotinhos/` root, not from individual packages
- No `mascotinhos/docs/` directory existed before 7.3 — now it exists with `operator-queries.sql`

From Story 7.1 (error handling pattern):
- All console logging uses `JSON.stringify({ level, event, ...context, service })` pattern
- Service name for image-gen is `"image-gen"`; for db operations use `"db-seed"`

### Architecture Compliance

- Seed data lives in `packages/image-gen/src/templates/seed.ts` (per architecture diagram: `templates/ # Style template prompt fragments (seed data)`)
- Seed execution script lives in `packages/db/prisma/seed.ts` (standard Prisma convention)
- ProductType enum: only `MASCOTINHO` value exists — do not invent others
- Logging: structured JSON pattern (never use `console.log("string message")` directly — use JSON format)
- Package imports: use `@mascotinhos/db` workspace import, not relative paths from outside the package

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Resolved circular dependency: `image-gen` depends on `db`, so `db/prisma/seed.ts` cannot import from `image-gen` via relative path. Fixed by: (1) adding `./templates/seed` sub-path export to `image-gen` package.json, (2) importing via `@mascotinhos/image-gen/templates/seed` workspace alias in the seed script, (3) excluding `prisma/seed.ts` from `packages/db/tsconfig.json` (added explicit `include`/`exclude`) to prevent `rootDir` violations in library compilation.

### Completion Notes List

- Created `packages/image-gen/src/templates/seed.ts` with `SeedTemplate` interface and 7 style templates: Princesa, Safari, Jardim Encantado, Sereia, Super-Heroi, Astronauta, Fazendinha. All with well-crafted 150-250 word English `promptTemplate` optimized for GPT Image 1.5, empty `exampleImages: []` for MVP, Portuguese `tags`, `productType: "MASCOTINHO"`, `active: true`, `popularity: 0`.
- Created `packages/db/prisma/seed.ts` as the Prisma seed entry point: imports templates via `@mascotinhos/image-gen/templates/seed`, uses `prisma.styleTemplate.upsert` with `{ where: { slug } }` for idempotency, preserves `popularity` on re-runs, uses `ProductType.MASCOTINHO` enum from generated client, structured JSON logging throughout.
- Added `"db:seed": "prisma db seed"` + `"prisma": { "seed": "bun run prisma/seed.ts" }` to `packages/db/package.json`.
- Added `"db:seed": "turbo -F @mascotinhos/db db:seed"` to root `mascotinhos/package.json`.
- Added `./templates/seed` sub-path export to `packages/image-gen/package.json`.
- Exported `seedTemplates` and `SeedTemplate` type from `packages/image-gen/src/index.ts`.
- Updated `packages/db/tsconfig.json` to explicitly `include: ["src/**/*", "prisma/generated/**/*"]` and `exclude: ["prisma/seed.ts"]` — prevents tsc from treating the seed runner as part of the library compilation.
- 0 new TypeScript errors. 331 tests pass, 29 pre-existing failures unchanged.

### File List

- `mascotinhos/packages/image-gen/src/templates/seed.ts` (new)
- `mascotinhos/packages/image-gen/src/index.ts` (modified — added seedTemplates + SeedTemplate exports)
- `mascotinhos/packages/image-gen/package.json` (modified — added `./templates/seed` sub-path export)
- `mascotinhos/packages/db/prisma/seed.ts` (new)
- `mascotinhos/packages/db/package.json` (modified — added db:seed script + prisma.seed config)
- `mascotinhos/packages/db/tsconfig.json` (modified — added include/exclude to isolate seed script from library compilation)
- `mascotinhos/package.json` (modified — added db:seed turbo script)
- `.bmad_output/implementation-artifacts/7-4-style-template-seeding-with-initial-library.md` (this file)
- `.bmad_output/implementation-artifacts/sprint-status.yaml` (modified — story status)

### Change Log

- 2026-03-30: Implemented Story 7.4 — created 7 style template seed records (Princesa, Safari, Jardim Encantado, Sereia, Super-Heroi, Astronauta, Fazendinha) in `packages/image-gen/src/templates/seed.ts`; created Prisma seed runner at `packages/db/prisma/seed.ts` with upsert-on-slug idempotency; wired `bun run db:seed` via Prisma seed config in `packages/db/package.json` and turbo task in root `package.json`; added `./templates/seed` sub-path export to image-gen; updated db tsconfig to exclude seed script from library compilation. All ACs satisfied. 0 new TS errors. 331 tests pass, no new regressions.

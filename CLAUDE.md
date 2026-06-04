# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Músicas Personalizadas** — An AI-powered platform for generating personalized songs, delivered via WhatsApp. The project uses the BMAD methodology for planning (artifacts in `.bmad_output/` and `design-artifacts/`).

The actual application code lives in `mascotinhos/`, which is a **Turborepo monorepo** scaffolded with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack).

## Commands

All commands run from `mascotinhos/` directory (not the repo root):

```bash
cd mascotinhos

# Install dependencies
bun install

# Development (all apps)
bun run dev          # starts all apps via turbo
bun run dev:web      # starts only the Next.js web app (port 3001)

# Build & type-check
bun run build
bun run check-types

# Database (Prisma + PostgreSQL via Supabase)
bun run db:push      # push schema to database
bun run db:generate  # regenerate Prisma client
bun run db:migrate   # run migrations
bun run db:studio    # open Prisma Studio

# Git hooks
bun run prepare      # install husky hooks
```

To run a turbo command for a specific package:
```bash
turbo -F web dev
turbo -F @mascotinhos/db db:push
```

## Architecture

```
mascotinhos/
├── apps/
│   └── web/                    # Next.js 16 app (port 3001)
│       └── src/
│           ├── app/            # App Router pages & API routes
│           │   └── api/ai/     # AI streaming endpoint (Gemini via AI SDK v6)
│           └── components/     # App-specific components
├── packages/
│   ├── config/                 # Shared tsconfig.base.json
│   ├── db/                     # Prisma ORM + PostgreSQL
│   │   └── prisma/schema/      # Schema definition
│   ├── env/                    # Type-safe env validation (@t3-oss/env)
│   │   ├── src/server.ts       # Server env vars (DATABASE_URL, CORS_ORIGIN, NODE_ENV)
│   │   └── src/web.ts          # Client env vars (currently empty)
│   └── ui/                     # Shared shadcn/ui components (Base UI + Tailwind v4)
```

## Key Technical Decisions

- **Package manager**: Bun (v1.3.5) — enforced via `packageManager` field
- **Monorepo**: Turborepo with Bun workspaces; catalog dependencies in root `package.json`
- **Framework**: Next.js 16 with App Router, React Compiler enabled, typed routes
- **UI**: shadcn/ui in `packages/ui` (shared primitives), app-specific blocks in `apps/web`
- **Styling**: Tailwind CSS v4 with `@tailwindcss/postcss`
- **Database**: PostgreSQL (Supabase) via Prisma 7 with `@prisma/adapter-pg`
- **AI**: AI SDK v6 with `@ai-sdk/google` (Gemini 2.5 Flash), streaming via `streamText`
- **Env validation**: `@t3-oss/env-core` (server) and `@t3-oss/env-nextjs` (web client)
- **Pre-commit**: Husky + lint-staged

## Workspace Package Imports

```tsx
import { Button } from "@mascotinhos/ui/components/button";
import { cn } from "@mascotinhos/ui/lib/utils";
import prisma from "@mascotinhos/db";
import { env } from "@mascotinhos/env/server";
```

## Adding shadcn Components

```bash
# Shared primitives (to packages/ui)
npx shadcn@latest add <component> -c packages/ui

# App-specific blocks (run from apps/web)
cd apps/web && npx shadcn@latest add <component>
```

## Environment Variables

Web app env file: `mascotinhos/apps/web/.env`  
Template with all vars and scope annotations: `mascotinhos/apps/web/.env.example`

Required server vars (validated in `packages/env/src/server.ts`):
- `DATABASE_URL` — PostgreSQL connection string
- `CORS_ORIGIN` — Allowed CORS origin URL
- `GOOGLE_GENERATIVE_AI_API_KEY` — For AI SDK Google provider (implicit)

### Vercel Preview Environment

Vercel Preview deployments require env vars to be scoped to **Preview** in the Vercel dashboard (most vars default to Production only). See the full runbook:

**`mascotinhos/docs/preview-environment.md`** — step-by-step guide covering:
- Which vars to share with Production vs isolate for Preview
- How to register a dedicated Preview WhatsApp phone number in Meta
- Vercel env var configuration
- Meta webhook setup for the stable `preview` branch alias
- Verification checklist

## Design System

**"The Joyful Curator"** — celebratory editorial design system for the landing page.

- **Design system:** `mascotinhos/DESIGN.md` — colors, typography, components, do's and don'ts- **UX spec:** `.bmad_output/planning-artifacts/ux-design-specification.md` — full UX design specification

Key design rules:
- No 1px borders (use tonal shifts instead)
- Palette: soft-vivid — surface #fff4f5, primary #b10b68, secondary #005f9c, highlight #fcca6d
- Fonts: Plus Jakarta Sans (display/headlines) + Be Vietnam Pro (body/labels)
- Glass & gradient: primary gradient CTAs, glassmorphism for floating elements
- Confetti accents: decorative SVG circles/stars at asymmetric intervals
- Mobile-first: 95%+ traffic from mobile Meta ads

## Planning Artifacts

BMAD planning docs live outside the app code:
- `.bmad_output/planning-artifacts/` — PRD, architecture, epics, research reports, UX design spec
- `.bmad_output/brainstorming/` — Brainstorming session notes
- `design-artifacts/` — WDS phases (Product Brief, Trigger Map, UX Scenarios, Design System, PRD, Testing, Product Development)

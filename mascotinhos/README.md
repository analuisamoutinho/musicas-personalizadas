# mascotinhos

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Next.js, Self, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Next.js** - Full-stack React framework
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Prisma** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Husky** - Git hooks for code quality
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Database Setup

This project uses PostgreSQL with Prisma.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/web/.env` file with your PostgreSQL connection details.

3. Apply the schema to your database:

```bash
bun run db:push
```

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the fullstack application.

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
bunx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@mascotinhos/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Git Hooks and Formatting

- Initialize hooks: `bun run prepare`

## Project Structure

```
mascotinhos/
├── apps/
│   └── web/         # Fullstack application (Next.js)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   └── db/          # Database schema & queries
```

## Sentry Source Maps (production setup)

Source maps are uploaded to Sentry at build time via `@sentry/nextjs`. All config hooks are
already in place — you only need to provision the auth token once.

**One-time operator steps:**

1. Generate an auth token at <https://sentry.io/settings/account/api/auth-tokens/> with scopes
   `project:releases` and `project:read`.
2. Add it to the Vercel project (Production scope minimum):
   ```bash
   cd mascotinhos
   echo "<token>" | vercel env add SENTRY_AUTH_TOKEN production
   ```
3. Also set the org/project slugs if they aren't in Vercel yet:
   ```bash
   echo "your-org-slug"     | vercel env add SENTRY_ORG production
   echo "your-project-slug" | vercel env add SENTRY_PROJECT production
   ```
4. Trigger a redeploy (push a commit or click **Redeploy** in the Vercel dashboard).
5. Verify in the build log: the `"No auth token provided"` warning should be gone and you should
   see `Successfully created release` from the Sentry CLI.

> Token is encrypted at rest in Vercel. Rotate it if exposed; the `project:releases` scope is narrow.

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run dev:web`: Start only the web application
- `bun run check-types`: Check TypeScript types across all apps
- `bun run db:push`: Push schema changes to database
- `bun run db:generate`: Generate database client/types
- `bun run db:migrate`: Run database migrations
- `bun run db:studio`: Open database studio UI

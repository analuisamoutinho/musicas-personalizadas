import path from "node:path";

import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

dotenv.config({
  path: "../../apps/web/.env",
});

// Allow `prisma generate` to run during install in environments where
// DATABASE_URL is not yet provisioned (e.g. Vercel preview branches without
// the Preview env scope set). The actual DATABASE_URL is validated at runtime
// in packages/db/src/index.ts via @mascotinhos/env/server, so a placeholder
// here only enables client generation, not real DB access.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://placeholder:placeholder@localhost:5432/placeholder";
}

export default defineConfig({
  schema: path.join("prisma", "schema"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "bun prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});

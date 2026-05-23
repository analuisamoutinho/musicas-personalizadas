import dotenv from "dotenv";
import path from "node:path";

// Load env before importing prisma (same path as prisma.config.ts)
dotenv.config({ path: path.join(import.meta.dirname, "../../../apps/web/.env") });

import { ProductType } from "../prisma/generated/enums.js";
import prisma from "../src/index.js";
import { seedTemplates } from "../../image-gen/src/templates/seed";

async function main() {
  console.log(
    JSON.stringify({
      level: "info",
      event: "seed_start",
      templateCount: seedTemplates.length,
      service: "db-seed",
    }),
  );

  const results = await prisma.$transaction(
    seedTemplates.map((template) =>
      prisma.styleTemplate.upsert({
        where: { slug: template.slug },
        create: {
          name: template.name,
          slug: template.slug,
          promptTemplate: template.promptTemplate,
          exampleImages: template.exampleImages,
          tags: template.tags,
          productType: ProductType.MASCOTINHO,
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
          // DO NOT reset popularity — operator may have incremented it via bot usage
        },
        select: { id: true, slug: true, name: true },
      }),
    ),
  );

  for (const result of results) {
    console.log(
      JSON.stringify({
        level: "info",
        event: "seed_template_upserted",
        id: result.id,
        slug: result.slug,
        name: result.name,
        service: "db-seed",
      }),
    );
  }

  console.log(
    JSON.stringify({
      level: "info",
      event: "seed_complete",
      upsertedCount: results.length,
      service: "db-seed",
    }),
  );
}

main()
  .catch((err) => {
    console.error(
      JSON.stringify({
        level: "error",
        event: "seed_error",
        error: err instanceof Error ? err.message : String(err),
        service: "db-seed",
      }),
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

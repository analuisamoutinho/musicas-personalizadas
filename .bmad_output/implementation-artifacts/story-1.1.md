# Story 1.1: Prisma Schema for Core Business Entities

## Status: done
## GitHub Issue: #41
## Epic: 1 — Project Foundation & Data Layer

## Summary
Define all core business entities in the Prisma schema: Client, Order, Payment, Generation, StyleTemplate — with proper enums, indexes, relations, and timestamps.

## File to Modify
- `mascotinhos/packages/db/prisma/schema/schema.prisma` — add all models and enums

## Enums Required

### ConversationState (Order.status)
```
GREETING, COLLECTING_PHOTOS, COLLECTING_THEME, COLLECTING_OUTFIT,
CONFIRMING_ORDER, AWAITING_PAYMENT, ABANDONED_1H, ABANDONED_24H,
GENERATING, DELIVERING, AWAITING_FEEDBACK, REVISION_1, REVISION_2,
COMPLETED, FAILED
```

### PaymentStatus
```
PENDING, CONFIRMED, FAILED, REFUNDED
```

### ProductType
```
MASCOTINHO
```

## Models

### Client
| Field | Type | Notes |
|-------|------|-------|
| id | String @id @default(cuid()) | PK |
| whatsappSenderId | String @unique | Indexed |
| name | String? | Optional initially |
| phone | String? | Optional initially |
| consentTimestamp | DateTime? | LGPD consent |
| consentVersion | String? | LGPD version |
| createdAt | DateTime @default(now()) | |
| updatedAt | DateTime @updatedAt | |
| orders | Order[] | Relation |

### Order
| Field | Type | Notes |
|-------|------|-------|
| id | String @id @default(cuid()) | PK |
| clientId | String | FK to Client |
| styleTemplateId | String? | FK to StyleTemplate (optional until selected) |
| status | ConversationState @default(GREETING) | State machine |
| photosUrls | String[] | Supabase Storage refs |
| theme | String? | |
| outfitDescription | String? | |
| extraRequests | String? | |
| price | Decimal? | R$29.90 default |
| createdAt | DateTime @default(now()) | |
| updatedAt | DateTime @updatedAt | |
| client | Client @relation | |
| styleTemplate | StyleTemplate? @relation | |
| payments | Payment[] | Relation |
| generations | Generation[] | Relation |

### Payment
| Field | Type | Notes |
|-------|------|-------|
| id | String @id @default(cuid()) | PK |
| orderId | String | FK to Order |
| asaasId | String @unique | Asaas payment ID |
| pixQrCode | String? | PIX code |
| pixQrImageUrl | String? | QR image URL |
| amount | Decimal | |
| status | PaymentStatus @default(PENDING) | |
| confirmedAt | DateTime? | |
| createdAt | DateTime @default(now()) | |
| updatedAt | DateTime @updatedAt | |
| order | Order @relation | |

### Generation
| Field | Type | Notes |
|-------|------|-------|
| id | String @id @default(cuid()) | PK |
| orderId | String | FK to Order |
| attemptNumber | Int | Sequential per order |
| promptUsed | String | Full prompt for debugging |
| imageUrl | String? | Supabase Storage |
| qualityScore | Float? | AI self-critique |
| revisionFeedback | String? | Client feedback |
| createdAt | DateTime @default(now()) | |
| updatedAt | DateTime @updatedAt | |
| order | Order @relation | |

### StyleTemplate
| Field | Type | Notes |
|-------|------|-------|
| id | String @id @default(cuid()) | PK |
| name | String | Display name |
| slug | String @unique | URL-safe identifier |
| promptTemplate | String | AI prompt template |
| exampleImages | String[] | Supabase Storage URLs |
| popularity | Int @default(0) | Auto-increment counter |
| tags | String[] | Searchable tags |
| active | Boolean @default(true) | Soft delete |
| productType | ProductType @default(MASCOTINHO) | |
| createdAt | DateTime @default(now()) | |
| updatedAt | DateTime @updatedAt | |
| orders | Order[] | Relation |

## Naming Conventions
- Models: PascalCase singular
- Fields: camelCase
- Enum values: UPPER_SNAKE_CASE
- Relations: camelCase matching model name

## Cascading Rules
- Order → Client: onDelete Cascade (delete client = delete orders)
- Payment → Order: onDelete Cascade
- Generation → Order: onDelete Cascade
- Order → StyleTemplate: onDelete SetNull (template deletion doesn't break orders)

## Validation Command
```bash
cd mascotinhos && bun run db:push
```

## Testing
- Run `bun run db:push` and verify all tables created in Supabase
- Run `bun run db:generate` to regenerate Prisma client
- Verify TypeScript types are generated correctly

## Review Findings

> Code review run: 2026-03-28 | Reviewers: Blind Hunter · Edge Case Hunter · Acceptance Auditor

### Decisions Needed

- [x] [Review][Decision] Order.status conflates bot conversation state with order lifecycle — **resolved B**: split into `conversationState ConversationState` + `orderStatus OrderStatus` (new enum: PENDING/PAID/GENERATING/DELIVERED/CANCELLED)
- [x] [Review][Decision] Order.price nullable creates split-brain with Payment.amount — **resolved A**: made non-nullable with `@default(29.90)`
- [x] [Review][Decision] Client → Order cascade delete wipes financial records on LGPD erasure — **resolved A**: added `deletedAt DateTime?` to Client, changed `onDelete: Cascade` → `Restrict`
- [x] [Review][Decision] ConversationState as PostgreSQL ENUM blocks zero-downtime migrations — **resolved C**: kept ENUM, added schema comment noting ENUM→String conversion required before adding new states

### Patches

- [x] [Review][Patch] Add @@unique([orderId, attemptNumber]) to Generation [schema.prisma] — **applied**
- [x] [Review][Patch] Add application-layer guard for photosUrls array length (max 3) [schema.prisma / WhatsApp handler] — **applied** (schema comment added; app-layer enforcement required in handler)
- [x] [Review][Patch] Add partial-unique guard for concurrent duplicate PENDING payments [schema.prisma / payment service] — **applied** (schema comment added; app-layer check required in payment service)
- [x] [Review][Patch] Add @@index([conversationState, updatedAt]) to Order for abandoned cart scheduler [schema.prisma] — **applied**
- [x] [Review][Patch] Add @@index([active, popularity]) to StyleTemplate [schema.prisma] — **applied**
- [x] [Review][Patch] Add @@unique([phone]) to Client (nullable-safe) [schema.prisma] — **applied**
- [x] [Review][Patch] Document qualityScore expected range (0.0–1.0) [schema.prisma] — **applied** (schema comment added; raw CHECK constraint deferred to migration step)

### Deferred

- [x] [Review][Defer] pixQrCode stored as unencrypted plaintext [schema.prisma] — deferred, pre-existing; PIX QR codes expire (30 min) and are low-sensitivity; encryption is an infrastructure/application concern outside schema scope
- [x] [Review][Defer] Client.whatsappSenderId has no format validation [schema.prisma] — deferred, pre-existing; string format validation is an application-layer concern; schema cannot enforce phone number format
- [x] [Review][Defer] StyleTemplate.popularity has no concurrency protection [schema.prisma] — deferred, pre-existing; atomic increment must be enforced at app layer (UPDATE popularity = popularity + 1); not a schema issue

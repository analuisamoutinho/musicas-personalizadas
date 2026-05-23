/**
 * Pattern for validating Prisma CUID v1 order IDs.
 *
 * CUIDs start with 'c' followed by 24 lowercase alphanumeric characters (25 chars total).
 * Example: "clh7x3kjx0000mcv7qxf9y3al"
 *
 * The database schema uses `@default(cuid())` for all entity IDs.
 *
 * Note: a UUID regex was previously used in all four validation sites but never
 * matched a real order ID (CUIDs and UUIDs have incompatible formats). This constant
 * fixes that silent mismatch — the validation now correctly accepts real IDs.
 */
export const ORDER_ID_PATTERN = /^c[a-z0-9]{24}$/;

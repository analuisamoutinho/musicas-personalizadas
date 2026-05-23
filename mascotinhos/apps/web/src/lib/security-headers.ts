/**
 * Builds Next.js security headers and image remote patterns.
 *
 * `unsafe-eval` is excluded from production `script-src` because:
 * - React Compiler transpiles JSX at build time with no runtime eval calls.
 * - Next.js HMR/Fast Refresh requires eval in dev mode only.
 *
 * `placehold.co` is excluded from production because it is a dev-only
 * placeholder image service — real images come from Supabase Storage.
 */

export function buildSecurityHeaders(isDev: boolean) {
  const cspValue = [
    "default-src 'self'",
    // 'unsafe-eval' is only needed in dev for Next.js HMR/Fast Refresh.
    // React Compiler generates no runtime eval calls in production.
    `script-src 'self'${isDev ? " 'unsafe-eval'" : ""} 'unsafe-inline' https://va.vercel-scripts.com https://cloud.umami.is`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    // placehold.co is a dev-only placeholder image service
    `img-src 'self' data: blob: https://*.supabase.co${isDev ? " https://placehold.co" : ""}`,
    "connect-src 'self' https://*.ingest.sentry.io https://*.supabase.co",
    "frame-ancestors 'none'",
  ].join("; ");

  return [
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Content-Security-Policy", value: cspValue },
  ];
}

export function buildImageRemotePatterns(isDev: boolean) {
  return [
    // Supabase Storage signed URLs for generated images
    { protocol: "https" as const, hostname: "*.supabase.co", pathname: "/storage/v1/object/**" },
    // placehold.co is dev-only for placeholder images during development
    ...(isDev ? [{ protocol: "https" as const, hostname: "placehold.co" }] : []),
  ];
}

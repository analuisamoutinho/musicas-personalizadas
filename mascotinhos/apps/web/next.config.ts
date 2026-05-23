import "@mascotinhos/env/web";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { buildSecurityHeaders, buildImageRemotePatterns } from "./src/lib/security-headers";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  typedRoutes: true,
  async headers() {
    return [{ source: "/(.*)", headers: buildSecurityHeaders(isDev) }];
  },
  reactCompiler: true,
  transpilePackages: ["shiki"],
  images: {
    remotePatterns: buildImageRemotePatterns(isDev),
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
});

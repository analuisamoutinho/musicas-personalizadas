import { describe, it, expect } from "bun:test";
import { buildSecurityHeaders, buildImageRemotePatterns } from "./security-headers";

describe("buildSecurityHeaders", () => {
  const getCsp = (isDev: boolean) => {
    const headers = buildSecurityHeaders(isDev);
    return headers.find((h) => h.key === "Content-Security-Policy")!.value;
  };

  describe("production mode (isDev=false)", () => {
    it("excludes unsafe-eval from script-src", () => {
      const csp = getCsp(false);
      expect(csp).not.toContain("'unsafe-eval'");
    });

    it("excludes placehold.co from img-src", () => {
      const csp = getCsp(false);
      expect(csp).not.toContain("placehold.co");
    });

    it("retains all required production script-src sources", () => {
      const csp = getCsp(false);
      expect(csp).toContain("script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://cloud.umami.is");
    });

    it("retains supabase in img-src", () => {
      const csp = getCsp(false);
      expect(csp).toContain("https://*.supabase.co");
    });
  });

  describe("development mode (isDev=true)", () => {
    it("includes unsafe-eval in script-src for HMR", () => {
      const csp = getCsp(true);
      expect(csp).toContain("'unsafe-eval'");
    });

    it("includes placehold.co in img-src", () => {
      const csp = getCsp(true);
      expect(csp).toContain("https://placehold.co");
    });
  });

  describe("invariants (both modes)", () => {
    it.each([true, false])("includes frame-ancestors none (isDev=%s)", (isDev) => {
      const csp = getCsp(isDev);
      expect(csp).toContain("frame-ancestors 'none'");
    });

    it.each([true, false])("includes sentry connect-src (isDev=%s)", (isDev) => {
      const csp = getCsp(isDev);
      expect(csp).toContain("https://*.ingest.sentry.io");
    });

    it.each([true, false])("returns standard security headers (isDev=%s)", (isDev) => {
      const headers = buildSecurityHeaders(isDev);
      const keys = headers.map((h) => h.key);
      expect(keys).toContain("X-Frame-Options");
      expect(keys).toContain("X-Content-Type-Options");
      expect(keys).toContain("Referrer-Policy");
      expect(keys).toContain("Permissions-Policy");
      expect(keys).toContain("Content-Security-Policy");
    });
  });
});

describe("buildImageRemotePatterns", () => {
  it("production: does not include placehold.co", () => {
    const patterns = buildImageRemotePatterns(false);
    const hostnames = patterns.map((p) => p.hostname);
    expect(hostnames).not.toContain("placehold.co");
  });

  it("production: includes supabase storage pattern", () => {
    const patterns = buildImageRemotePatterns(false);
    expect(patterns.some((p) => p.hostname === "*.supabase.co")).toBe(true);
  });

  it("development: includes placehold.co", () => {
    const patterns = buildImageRemotePatterns(true);
    const hostnames = patterns.map((p) => p.hostname);
    expect(hostnames).toContain("placehold.co");
  });

  it("development: still includes supabase storage pattern", () => {
    const patterns = buildImageRemotePatterns(true);
    expect(patterns.some((p) => p.hostname === "*.supabase.co")).toBe(true);
  });
});

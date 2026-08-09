import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** @type {import('next').NextConfig} */

// Content-Security-Policy. Tailwind injects inline <style>, and we load fonts
// from Google Fonts; the app talks to Open-Meteo from the browser and same-origin
// APIs. Keep this tight and update deliberately if a new origin is added.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self' https://geocoding-api.open-meteo.com https://api.open-meteo.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // don't advertise the stack
  // Pin the trace root to the verdyn monorepo root so hoisted workspace deps
  // (e.g. @verdyn/core) trace correctly and Next stops guessing from lockfiles.
  outputFileTracingRoot: join(dirname(fileURLToPath(import.meta.url)), ".."),
  // @verdyn/core ships TypeScript source; let Next transpile it.
  transpilePackages: ["@verdyn/core"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

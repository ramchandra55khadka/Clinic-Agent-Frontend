import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Content-Security-Policy.
 *
 * Everything is same-origin: the app talks to the backend through `/api/clinic`,
 * so no third-party origin has to be allowed. `'unsafe-inline'` is required for
 * Next.js' inline bootstrap scripts/styles; moving to a nonce-based policy
 * (middleware + `headers()` with a per-request nonce) is the next hardening step.
 * Development additionally needs `'unsafe-eval'` and websockets for HMR.
 * `upgrade-insecure-requests` is intentionally omitted so locally running a
 * production build over http://localhost keeps working.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  isProduction ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  isProduction ? "connect-src 'self'" : "connect-src 'self' ws: wss:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // Ignored by browsers over plain HTTP; effective once served behind HTTPS.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // `next start` is the supported run command here (and what the container uses),
  // so the build output is a normal server bundle rather than `standalone`.
  reactStrictMode: true,
  poweredByHeader: false,

  // Forward browser console output to the dev-server terminal for easier debugging.
  logging: {
    browserToTerminal: "warn",
  },

  /**
   * Without this, Next.js 308-redirects `/api/clinic/doctor-schedule/` down to
   * the slash-less form before the catch-all proxy route
   * (`app/api/clinic/[[...path]]/route.ts`) can forward the request verbatim to
   * the FastAPI backend — the backend would then answer with its own 307 whose
   * absolute `Location` sends the browser off the same-origin proxy.
   */
  skipTrailingSlashRedirect: true,

  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;

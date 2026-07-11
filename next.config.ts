import type { NextConfig } from "next";

/**
 * Security headers (Stage 9). Applied at the framework level rather than
 * per-route so they can never be accidentally omitted from a new route
 * added later — a defense-in-depth baseline, not a substitute for the
 * request-level validation already done in each API route.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

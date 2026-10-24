import type { NextConfig } from "next";

const razorpay = process.env.PAYMENT_GATEWAY === "razorpay";

// Next.js injects inline bootstrap scripts, so script-src needs 'unsafe-inline'
// unless nonce-based CSP is adopted (that makes every page dynamic).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}${razorpay ? " https://checkout.razorpay.com" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${razorpay ? " https://api.razorpay.com https://lumberjack.razorpay.com" : ""}`,
  `frame-src ${razorpay ? "https://api.razorpay.com https://checkout.razorpay.com" : "'none'"}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // A separate build directory lets end-to-end tests run beside a normal build or dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  serverExternalPackages: ["pg"],
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  images: {
    formats: ["image/avif", "image/webp"],
    localPatterns: [{ pathname: "/api/media/**" }],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    deviceSizes: [360, 480, 640, 768, 1024, 1280, 1600],
    imageSizes: [64, 96, 128, 160, 240, 320],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://api.razorpay.com\")" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
      {
        source: "/(admin|cart|checkout|order|track|pay)(.*)",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;

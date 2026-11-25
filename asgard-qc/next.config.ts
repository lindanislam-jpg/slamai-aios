import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/server-only packages must not be bundled into route handlers.
  serverExternalPackages: ["sharp", "pdfkit", "exceljs", "@prisma/client"],
  poweredByHeader: false,
  // pdfkit loads its standard fonts (js/standard-fonts/*.cjs) and font data from
  // disk at runtime, and two small helpers
  // that pdfkit/exceljs reach through dynamic requires are missed by file
  // tracing. The scheduled review renders a test PDF and workbook from any
  // page (page-load safety net) and from the cron route, so every serverless
  // function carries them.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/pdfkit/js/**/*", "./node_modules/generator-function/**/*", "./node_modules/async-function/**/*"],
  },
  experimental: {
    // Photo batches go through route handlers, not server actions; this only
    // covers form posts.
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

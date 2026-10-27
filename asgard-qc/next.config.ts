import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/server-only packages must not be bundled into route handlers.
  serverExternalPackages: ["sharp", "pdfkit", "exceljs", "@prisma/client"],
  poweredByHeader: false,
  // pdfkit loads its font metrics from disk at runtime; make sure serverless
  // bundles include them.
  outputFileTracingIncludes: {
    "/api/reports": ["./node_modules/pdfkit/js/data/**/*"],
    "/api/reports/[id]": ["./node_modules/pdfkit/js/data/**/*"],
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

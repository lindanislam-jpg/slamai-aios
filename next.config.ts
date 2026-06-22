import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ["avatars.githubusercontent.com", "lh3.googleusercontent.com"],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3005"],
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  // The experimental serverActions.allowedOrigins block was removed: the app
  // uses no server actions, and it allow-listed only localhost:3005, which
  // would have rejected them from the deployed domain if any were added.
};

export default nextConfig;

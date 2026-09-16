import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Photo uploads go through a Server Action; the browser shrinks large files first.
      bodySizeLimit: "13mb",
    },
  },
};

export default nextConfig;

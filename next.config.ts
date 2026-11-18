import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  /** Keeps old client/test URLs on Next, e.g. /backend/products maps to /api/store/products. */
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: "/api/store/:path*",
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep API routes separable from page routes for future mobile client compatibility.
  // All business logic lives in src/lib/ — route handlers are thin wrappers.
  allowedDevOrigins: ["192.168.86.248"],
};

export default nextConfig;

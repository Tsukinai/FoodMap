import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // maplibre-gl ships ES modules; let Next.js handle it properly
  transpilePackages: ['maplibre-gl'],
};

export default nextConfig;

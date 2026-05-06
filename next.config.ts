import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['maplibre-gl'],
};

// withPWA injects a webpack plugin; only apply in production builds
// so that the dev server can keep using Turbopack (faster HMR).
// Run `next build --webpack` to ensure the plugin takes effect.
async function buildConfig() {
  if (process.env.NODE_ENV === 'production') {
    const withPWA = (await import('@ducanh2912/next-pwa')).default;
    return withPWA({
      dest: 'public',
      cacheOnFrontEndNav: true,
      aggressiveFrontEndNavCaching: true,
      reloadOnOnline: true,
    })(nextConfig);
  }
  return nextConfig;
}

export default buildConfig();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'kokonutui.com',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        // MediaPipe runtime (~30 MB) copied from node_modules at build time.
        // A week-long cache keeps repeat visits instant without pinning a
        // stale runtime forever after a version bump.
        source: '/mediapipe/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' },
        ],
      },
      {
        source: '/videos/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' },
        ],
      },
    ];
  },
  webpack: (config, { dev }) => {
    // Development optimizations
    if (dev) {
      config.watchOptions = {
        ignored: ['**/node_modules/**', '**/.next/**'],
        aggregateTimeout: 300,
      };
    }
    
    return config;
  },
}

module.exports = nextConfig

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

import path from 'node:path';
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config, { webpack }) {
    // Disposable isolated builds cannot reuse this large filesystem cache.
    if (process.env.DD_ISOLATED_BUILD === 'true') config.cache = false;
    if (process.env.APP_RUNTIME === 'cloudflare')
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /argon-node$/,
          path.resolve('src/server/auth/argon-worker.ts'),
        ),
      );
    return config;
  },
  serverExternalPackages: ['@node-rs/argon2'],
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'a.espncdn.com',
      },
      {
        protocol: 'https',
        hostname: 's.espncdn.com',
      },
    ],
  },
};

export default nextConfig;

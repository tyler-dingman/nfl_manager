import path from 'node:path';
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config, { webpack }) {
    if (process.env.APP_RUNTIME === 'cloudflare')
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /argon-node$/,
          path.resolve('src/server/auth/argon-worker.ts'),
        ),
      );
    return config;
  },
  experimental: {
    // Argon2 is a native Node.js dependency. Keep its platform binary out of
    // Webpack's server bundle so Node can load the installed package directly.
    serverComponentsExternalPackages: ['@node-rs/argon2'],
  },
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

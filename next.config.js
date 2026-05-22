const path = require('path');

function getBasePath() {
  const rawBasePath =
    process.env.NEXT_PUBLIC_BASE_PATH ?? process.env.BASE_PATH ?? '';
  const basePath = rawBasePath.trim().replace(/^\/+|\/+$/g, '');

  return basePath ? `/${basePath}` : '';
}

const basePath = getBasePath();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  trailingSlash: true,
  ...(basePath
    ? {
        basePath,
        assetPrefix: basePath
      }
    : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath
  },
  images: {
    unoptimized: true
  },
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      'firebase/app': path.resolve(__dirname, 'src/lib/atproto/app.ts'),
      'firebase/auth': path.resolve(__dirname, 'src/lib/atproto/auth.ts'),
      'firebase/firestore': path.resolve(
        __dirname,
        'src/lib/atproto/firestore.ts'
      ),
      'firebase/functions': path.resolve(
        __dirname,
        'src/lib/atproto/functions.ts'
      ),
      'firebase/storage': path.resolve(__dirname, 'src/lib/atproto/storage.ts')
    };

    return config;
  }
};

module.exports = nextConfig;

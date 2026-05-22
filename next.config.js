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
  sassOptions: {
    additionalData: `$asset-prefix: '${basePath}';`
  },
  images: {
    unoptimized: true
  }
};

module.exports = nextConfig;

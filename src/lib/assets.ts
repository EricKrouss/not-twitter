const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const siteURL = process.env.NEXT_PUBLIC_URL?.replace(/\/+$/g, '') ?? '';

function isExternalAsset(path: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(path);
}

export function publicAsset(path: string): string {
  if (
    !path.startsWith('/') ||
    isExternalAsset(path) ||
    path.startsWith('/_next') ||
    (basePath && path.startsWith(`${basePath}/`))
  )
    return path;

  return `${basePath}${path}`;
}

export function absolutePublicAsset(path: string): string {
  if (isExternalAsset(path)) return path;
  if (!siteURL) return publicAsset(path);
  if (!path.startsWith('/')) return `${siteURL}/${path}`;

  return `${siteURL}${path}`;
}

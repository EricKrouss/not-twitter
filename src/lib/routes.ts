export type NotificationsTab = 'all' | 'mentions';

export function getUserPath(username: string): string {
  return `/${encodeURIComponent(username)}`;
}

export function getUserTabPath(username: string, path?: string): string {
  return `${getUserPath(username)}${path ? `/${path}` : ''}`;
}

export function getTweetPath(
  tweetId: string,
  username?: string | null
): string {
  return username
    ? `${getUserPath(username)}/status/${encodeURIComponent(tweetId)}`
    : `/tweet/${encodeURIComponent(tweetId)}`;
}

export function getTweetQuotesPath(
  tweetId: string,
  username?: string | null
): string {
  return `${getTweetPath(tweetId, username)}/retweets/with_comments`;
}

export function getNotificationsPath(tab: NotificationsTab = 'all'): string {
  return tab === 'mentions' ? '/notifications/mentions' : '/notifications';
}

function getConfiguredBasePath(): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? '';

  if (!basePath || basePath === '/') return '';

  return `/${basePath.replace(/^\/+|\/+$/g, '')}`;
}

function normalizeRoutePath(path: string): string {
  let pathname = path.split(/[?#]/)[0] || '/';
  const basePath = getConfiguredBasePath();

  if (
    basePath &&
    (pathname === basePath || pathname.startsWith(`${basePath}/`))
  )
    pathname = pathname.slice(basePath.length) || '/';

  return pathname.replace(/\/+$/g, '') || '/';
}

export function getNotificationsTab(path: string): NotificationsTab {
  return normalizeRoutePath(path) === getNotificationsPath('mentions')
    ? 'mentions'
    : 'all';
}

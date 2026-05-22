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

export function getNotificationsPath(tab: NotificationsTab = 'all'): string {
  return tab === 'mentions' ? '/notifications/mentions' : '/notifications';
}

export function getNotificationsTab(path: string): NotificationsTab {
  return path.split(/[?#]/)[0] === getNotificationsPath('mentions')
    ? 'mentions'
    : 'all';
}

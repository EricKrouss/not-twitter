import { isProfileRouteActor } from '@lib/atproto/profile-route';

export type UserRouteView =
  | 'tweets'
  | 'with_replies'
  | 'articles'
  | 'media'
  | 'likes'
  | 'lists'
  | 'starter-packs'
  | 'following'
  | 'followers'
  | 'followers_you_follow';

export type StaticRouteMatch =
  | {
      type: 'user';
      id: string;
      view: UserRouteView;
    }
  | {
      type: 'tweet';
      id: string;
      actor?: string;
    }
  | {
      type: 'feed';
      actor: string;
      rkey: string;
    };

const PROFILE_TABS = new Set<UserRouteView>([
  'with_replies',
  'articles',
  'media',
  'likes',
  'lists',
  'starter-packs',
  'following',
  'followers',
  'followers_you_follow'
]);

function getConfiguredBasePath(): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? '';

  if (!basePath || basePath === '/') return '';

  return `/${basePath.replace(/^\/+|\/+$/g, '')}`;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function getStaticPathSegments(asPath?: string): string[] {
  let pathname = asPath;

  if (!pathname && typeof window !== 'undefined')
    pathname = `${window.location.pathname}${window.location.search}`;

  if (!pathname) return [];

  if (/^https?:\/\//i.test(pathname)) pathname = new URL(pathname).pathname;
  else pathname = pathname.split(/[?#]/)[0];

  if (
    typeof window !== 'undefined' &&
    (pathname === '/404' ||
      pathname === '/404/' ||
      pathname === '/[...redirect]' ||
      pathname === '/[...redirect]/') &&
    window.location.pathname !== pathname
  )
    pathname = window.location.pathname;

  const basePath = getConfiguredBasePath();

  if (
    basePath &&
    (pathname === basePath || pathname.startsWith(`${basePath}/`))
  )
    pathname = pathname.slice(basePath.length) || '/';

  return pathname
    .replace(/\/+$/g, '')
    .split('/')
    .filter(Boolean)
    .map(safeDecodeURIComponent);
}

export function matchStaticRoute(asPath?: string): StaticRouteMatch | null {
  const segments = getStaticPathSegments(asPath);

  if (
    segments.length === 4 &&
    segments[0] === 'profile' &&
    segments[2] === 'feed'
  )
    return { type: 'feed', actor: segments[1], rkey: segments[3] };

  if (segments.length === 2 && segments[0] === 'tweet')
    return { type: 'tweet', id: segments[1] };

  if (
    segments.length === 4 &&
    segments[0] === 'tweet' &&
    segments[2] === 'retweets' &&
    segments[3] === 'with_comments'
  )
    return { type: 'tweet', id: segments[1] };

  if (segments.length >= 2 && segments[0] === 'user')
    return matchUserRoute(segments.slice(1));

  if (
    segments.length === 3 &&
    segments[1] === 'status' &&
    isProfileRouteActor(segments[0])
  )
    return { type: 'tweet', actor: segments[0], id: segments[2] };

  if (
    segments.length === 5 &&
    segments[1] === 'status' &&
    segments[3] === 'retweets' &&
    segments[4] === 'with_comments' &&
    isProfileRouteActor(segments[0])
  )
    return { type: 'tweet', actor: segments[0], id: segments[2] };

  return matchUserRoute(segments);
}

function matchUserRoute(segments: string[]): StaticRouteMatch | null {
  if (!segments.length || !isProfileRouteActor(segments[0])) return null;

  if (segments.length === 1)
    return { type: 'user', id: segments[0], view: 'tweets' };

  if (segments.length === 2 && PROFILE_TABS.has(segments[1] as UserRouteView))
    return {
      type: 'user',
      id: segments[0],
      view: segments[1] as UserRouteView
    };

  return null;
}

export function getProfileRouteId(asPath?: string): string | null {
  const match = matchStaticRoute(asPath);

  return match?.type === 'user' ? match.id : null;
}

export function getProfileRouteView(asPath?: string): UserRouteView | null {
  const match = matchStaticRoute(asPath);

  return match?.type === 'user' ? match.view : null;
}

export function getTweetRouteId(asPath?: string): string | null {
  const match = matchStaticRoute(asPath);

  return match?.type === 'tweet' ? match.id : null;
}

export function getFeedRouteParams(
  asPath?: string
): { actor: string; rkey: string } | null {
  const match = matchStaticRoute(asPath);

  return match?.type === 'feed'
    ? { actor: match.actor, rkey: match.rkey }
    : null;
}

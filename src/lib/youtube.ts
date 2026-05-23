export type YouTubeVideoInfo = {
  id: string;
  url: string;
  embedUrl: string;
  thumbnail: string;
  title: string;
  domain: string;
};

const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_LINK_REGEX =
  /(?:https?:\/\/)?(?:(?:www|m|music)\.)?(?:youtube\.com|youtu\.be)\/[^\s<>"']+/gi;

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[),.;!?]+$/g, '');
}

function createUrl(value: string): URL | null {
  const trimmed = stripTrailingPunctuation(value.trim());
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    return new URL(withProtocol);
  } catch {
    return null;
  }
}

function getPathSegment(url: URL, index: number): string | null {
  const segment = url.pathname.split('/').filter(Boolean)[index];
  return segment && YOUTUBE_ID_REGEX.test(segment) ? segment : null;
}

function getVideoId(url: URL): string | null {
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');

  if (hostname === 'youtu.be') return getPathSegment(url, 0);

  const isYouTube =
    hostname === 'youtube.com' ||
    hostname.endsWith('.youtube.com') ||
    hostname === 'youtube-nocookie.com' ||
    hostname.endsWith('.youtube-nocookie.com');

  if (!isYouTube) return null;

  const watchId = url.searchParams.get('v');
  if (watchId && YOUTUBE_ID_REGEX.test(watchId)) return watchId;

  const firstSegment = url.pathname.split('/').filter(Boolean)[0];
  if (['embed', 'shorts', 'live', 'v'].includes(firstSegment ?? ''))
    return getPathSegment(url, 1);

  return null;
}

export function getYouTubeVideoInfo(value: string): YouTubeVideoInfo | null {
  const url = createUrl(value);
  if (!url) return null;

  const id = getVideoId(url);
  if (!id) return null;

  return {
    id,
    url: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube.com/embed/${id}?rel=0&playsinline=1`,
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    title: 'YouTube video',
    domain: 'youtube.com'
  };
}

export function findYouTubeVideoInfo(text: string): YouTubeVideoInfo | null {
  const matches = text.match(YOUTUBE_LINK_REGEX) ?? [];

  for (const match of matches) {
    const info = getYouTubeVideoInfo(match);
    if (info) return info;
  }

  return null;
}

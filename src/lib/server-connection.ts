type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

type FetchWatcherWindow = Window &
  typeof globalThis & {
    __notTwitterServerConnectionFetchWatcher?: {
      originalFetch: typeof fetch;
      wrappedFetch: typeof fetch;
    };
  };

export const SERVER_CONNECTION_PROBLEM_EVENT =
  'not-twitter:server-connection-problem';

const KNOWN_SERVER_URLS = [
  'https://bsky.social',
  'https://api.bsky.app',
  'https://public.api.bsky.app',
  'https://api.bsky.chat',
  'https://video.bsky.app'
];

const NETWORK_ERROR_PATTERNS =
  /failed to fetch|fetch failed|networkerror|network request failed|load failed/i;

function splitServerUrlList(value: string | undefined): string[] {
  return value?.split(/[\s,]+/).filter(Boolean) ?? [];
}

function normalizeServerUrl(value: string): URL | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const urlValue = /^https?:\/\//i.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;

  try {
    return new URL(urlValue);
  } catch {
    return null;
  }
}

function getConfiguredServerHosts(): Set<string> {
  const urls = [
    ...KNOWN_SERVER_URLS,
    ...splitServerUrlList(process.env.NEXT_PUBLIC_ATPROTO_PDS_URLS),
    ...splitServerUrlList(process.env.NEXT_PUBLIC_ATPROTO_HANDLE_RESOLVER_URLS),
    process.env.NEXT_PUBLIC_ATPROTO_PDS_URL,
    process.env.NEXT_PUBLIC_ATPROTO_HANDLE_RESOLVER_URL
  ];

  return urls.reduce<Set<string>>((hosts, value) => {
    if (!value) return hosts;

    const url = normalizeServerUrl(value);
    if (url) hosts.add(url.host.toLowerCase());

    return hosts;
  }, new Set());
}

function getFetchInputUrl(input: FetchInput): string | null {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if ('url' in input && typeof input.url === 'string') return input.url;

  return null;
}

function isServerRequest(input: FetchInput): boolean {
  const rawUrl = getFetchInputUrl(input);
  if (!rawUrl || typeof window === 'undefined') return false;

  try {
    const url = new URL(rawUrl, window.location.href);
    const host = url.host.toLowerCase();

    if (
      url.pathname.startsWith('/xrpc/') &&
      host === window.location.host.toLowerCase()
    )
      return true;

    return getConfiguredServerHosts().has(host);
  } catch {
    return false;
  }
}

function getErrorStatus(error: unknown): number | null {
  const status = (error as { status?: unknown })?.status;

  return typeof status === 'number' ? status : null;
}

function isServerConnectionProblem(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (typeof status === 'number') return status >= 500 || status === 0;

  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;

  if (
    typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    error.name === 'AbortError'
  )
    return false;

  const message = error instanceof Error ? error.message : String(error);

  return NETWORK_ERROR_PATTERNS.test(message);
}

function shouldReportResponse(response: Response): boolean {
  return response.status >= 500;
}

function notifyServerConnectionProblem(): void {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent(SERVER_CONNECTION_PROBLEM_EVENT));
}

export function ensureServerConnectionFetchWatcher(): void {
  if (typeof window === 'undefined') return;

  const watcherWindow = window as FetchWatcherWindow;
  const watcher = watcherWindow.__notTwitterServerConnectionFetchWatcher;

  if (watcher && watcherWindow.fetch === watcher.wrappedFetch) return;

  const originalFetch = watcher?.originalFetch ?? window.fetch.bind(window);
  const wrappedFetch: typeof fetch = async (
    input: FetchInput,
    init?: FetchInit
  ) => {
    try {
      const response = await originalFetch(input, init);

      if (isServerRequest(input) && shouldReportResponse(response))
        notifyServerConnectionProblem();

      return response;
    } catch (error) {
      if (isServerRequest(input) && isServerConnectionProblem(error))
        notifyServerConnectionProblem();

      throw error;
    }
  };

  watcherWindow.__notTwitterServerConnectionFetchWatcher = {
    originalFetch,
    wrappedFetch
  };
  watcherWindow.fetch = wrappedFetch;
}

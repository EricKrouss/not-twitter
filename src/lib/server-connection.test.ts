import {
  ensureServerConnectionFetchWatcher,
  SERVER_CONNECTION_PROBLEM_EVENT
} from './server-connection';

type TestWindow = Window &
  typeof globalThis & {
    __notTwitterServerConnectionFetchWatcher?: unknown;
  };

const originalFetch = window.fetch;

function resetWatcher(): void {
  delete (window as TestWindow).__notTwitterServerConnectionFetchWatcher;
}

function installFetch(fetchMock: jest.Mock): void {
  resetWatcher();
  Object.defineProperty(window, 'fetch', {
    configurable: true,
    writable: true,
    value: fetchMock
  });
}

describe('server connection fetch watcher', () => {
  let listener: jest.Mock;

  beforeEach(() => {
    listener = jest.fn();
    window.addEventListener(SERVER_CONNECTION_PROBLEM_EVENT, listener);
  });

  afterEach(() => {
    window.removeEventListener(SERVER_CONNECTION_PROBLEM_EVENT, listener);
    resetWatcher();
    Object.defineProperty(window, 'fetch', {
      configurable: true,
      writable: true,
      value: originalFetch
    });
  });

  it('does not show the global server modal for upstream XRPC 500s', async () => {
    const upstreamErrorResponse = { status: 502, type: 'basic' } as Response;

    installFetch(jest.fn().mockResolvedValue(upstreamErrorResponse));

    ensureServerConnectionFetchWatcher();

    const response = await window.fetch(
      'https://api.bsky.app/xrpc/app.bsky.feed.getTimeline'
    );

    expect(response.status).toBe(502);
    expect(listener).not.toHaveBeenCalled();
  });

  it('reports browser-level XRPC connection failures', async () => {
    installFetch(jest.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    ensureServerConnectionFetchWatcher();

    await expect(
      window.fetch('https://api.bsky.app/xrpc/app.bsky.feed.getTimeline')
    ).rejects.toThrow('Failed to fetch');

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not treat media fetch failures as session-breaking errors', async () => {
    installFetch(jest.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    ensureServerConnectionFetchWatcher();

    await expect(
      window.fetch('https://video.bsky.app/watch/did:plc:abc/playlist.m3u8')
    ).rejects.toThrow('Failed to fetch');

    expect(listener).not.toHaveBeenCalled();
  });
});

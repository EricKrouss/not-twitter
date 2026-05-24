import {
  getTweetPath,
  getTweetQuotesPath,
  canonicalizeBskyPostLinksInText,
  getBskyPostLinkFromText,
  getBskyTweetUrl,
  removeBskyPostLinkFromText
} from './routes';

function postIdFromAtUri(uri: string): string {
  return Buffer.from(uri, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

describe('getTweetPath', () => {
  it('formats standard ATProto route when username and base64 encoded post ID are provided', () => {
    // at://did:plc:h23k6xrxot4xhgtahiefszch/app.bsky.feed.post/3mmiwc2skxc2r
    const base64PostId = 'YXQ6Ly9kaWQ6cGxjOmgyM2s2eHJ4b3Q0eGhndGFoaWVmc3pjaC9hcHAuYnNreS5mZWVkLnBvc3QvM21taXdjMnNreGMycg';
    const path = getTweetPath(base64PostId, 'christophkappes.bsky.social');
    expect(path).toBe('/profile/christophkappes.bsky.social/post/3mmiwc2skxc2r');
  });

  it('extracts DID as fallback when username is not provided but post ID is a valid base64 encoded AT URI', () => {
    // at://did:plc:h23k6xrxot4xhgtahiefszch/app.bsky.feed.post/3mmiwc2skxc2r
    const base64PostId = 'YXQ6Ly9kaWQ6cGxjOmgyM2s2eHJ4b3Q0eGhndGFoaWVmc3pjaC9hcHAuYnNreS5mZWVkLnBvc3QvM21taXdjMnNreGMycg';
    const path = getTweetPath(base64PostId, null);
    expect(path).toBe('/profile/did%3Aplc%3Ah23k6xrxot4xhgtahiefszch/post/3mmiwc2skxc2r');
  });

  it('formats standard ATProto route when username and plain rkey are provided', () => {
    const path = getTweetPath('3mmiwc2skxc2r', 'jack.bsky.social');
    expect(path).toBe('/profile/jack.bsky.social/post/3mmiwc2skxc2r');
  });

  it('falls back to /tweet/rkey when no username is provided and post ID is not a base64 AT URI', () => {
    const path = getTweetPath('3mmiwc2skxc2r', null);
    expect(path).toBe('/tweet/3mmiwc2skxc2r');
  });
});

describe('getTweetQuotesPath', () => {
  it('correctly appends retweets comments subroute to standard ATProto path', () => {
    const base64PostId = 'YXQ6Ly9kaWQ6cGxjOmgyM2s2eHJ4b3Q0eGhndGFoaWVmc3pjaC9hcHAuYnNreS5mZWVkLnBvc3QvM21taXdjMnNreGMycg';
    const path = getTweetQuotesPath(base64PostId, 'christophkappes.bsky.social');
    expect(path).toBe('/profile/christophkappes.bsky.social/post/3mmiwc2skxc2r/retweets/with_comments');
  });
});

describe('Bluesky post route helpers', () => {
  const atUri = 'at://did:plc:abc123/app.bsky.feed.post/3mmht5rnfc2h';
  const encodedTweetId = postIdFromAtUri(atUri);

  it('creates canonical bsky.app share URLs from internal post IDs', () => {
    expect(getBskyTweetUrl(encodedTweetId, 'krouss.net')).toBe(
      'https://bsky.app/profile/krouss.net/post/3mmht5rnfc2h'
    );
  });

  it('detects canonical bsky.app post links', () => {
    expect(
      getBskyPostLinkFromText(
        'hey https://bsky.app/profile/krouss.net/post/3mmht5rnfc2h'
      )
    ).toMatchObject({
      actor: 'krouss.net',
      rkey: '3mmht5rnfc2h'
    });
  });

  it('detects self-host status links with internal encoded IDs', () => {
    expect(
      getBskyPostLinkFromText(
        `hey https://example.social/krouss.net/status/${encodedTweetId}`
      )
    ).toMatchObject({
      actor: 'krouss.net',
      rkey: '3mmht5rnfc2h',
      tweetId: encodedTweetId
    });
  });

  it('detects self-host status links with plain Bluesky post rkeys', () => {
    const postLink = getBskyPostLinkFromText(
      'hey https://example.social/krouss.net/status/3mmht5rnfc2h'
    );

    expect(postLink).toMatchObject({
      actor: 'krouss.net',
      rkey: '3mmht5rnfc2h'
    });
    expect(postLink?.tweetId).toBe(
      postIdFromAtUri('at://krouss.net/app.bsky.feed.post/3mmht5rnfc2h')
    );
  });

  it('canonicalizes self-host post links before posting', () => {
    expect(
      canonicalizeBskyPostLinksInText(
        'check https://example.social/krouss.net/status/3mmht5rnfc2h'
      )
    ).toBe('check https://bsky.app/profile/krouss.net/post/3mmht5rnfc2h');
  });

  it('removes an attached post link when it is represented by a quote embed', () => {
    const text = `John would like this\nhttps://example.social/krouss.net/status/${encodedTweetId}`;
    const postLink = getBskyPostLinkFromText(text);

    expect(removeBskyPostLinkFromText(text, postLink)).toBe(
      'John would like this'
    );
  });
});

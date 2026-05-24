import {
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

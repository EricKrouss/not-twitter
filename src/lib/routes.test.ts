import { getTweetPath, getTweetQuotesPath } from './routes';

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

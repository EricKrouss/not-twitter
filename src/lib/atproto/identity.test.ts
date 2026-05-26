jest.mock('@atproto/syntax', () => ({
  ensureValidDid: (input: string): void => {
    if (!/^did:[a-z]+:[a-zA-Z0-9._:%-]*[a-zA-Z0-9._-]$/.test(input))
      throw new Error('Invalid DID');
    if (input.length > 2048) throw new Error('Invalid DID');
  },
  isValidHandle: (input: string): boolean =>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
      input
    )
}));

import {
  formatAtprotoDisplayIdentifier,
  formatAtprotoHandleForDisplay,
  isAtprotoIdentityDid,
  normalizeAtprotoDid,
  normalizeAtprotoIdentifier,
  normalizeAtprotoLoginIdentifier,
  normalizeProfileSearchActor
} from './identity';

describe('ATProto identity helpers', () => {
  it('accepts hostname-level did:web identifiers', () => {
    expect(normalizeAtprotoDid('did:web:alice.example.com')).toBe(
      'did:web:alice.example.com'
    );
    expect(isAtprotoIdentityDid('did:web:api.bsky.app')).toBe(true);
  });

  it('normalizes did:web hostnames to lowercase', () => {
    expect(normalizeAtprotoDid('did:web:Alice.Example.COM')).toBe(
      'did:web:alice.example.com'
    );
  });

  it('rejects did:web paths and non-localhost ports', () => {
    expect(normalizeAtprotoDid('did:web:alice.example.com:path')).toBeNull();
    expect(normalizeAtprotoDid('did:web:alice.example.com%3A3000')).toBeNull();
  });

  it('allows localhost did:web ports for development', () => {
    expect(normalizeAtprotoDid('did:web:localhost%3A3000')).toBe(
      'did:web:localhost%3A3000'
    );
    expect(normalizeAtprotoDid('did:web:LOCALHOST%3a3000')).toBe(
      'did:web:localhost%3A3000'
    );
  });

  it('rejects unsupported DID methods', () => {
    expect(normalizeAtprotoIdentifier('did:key:zQ3shfake')).toBeNull();
    expect(() => normalizeAtprotoLoginIdentifier('did:key:zQ3shfake')).toThrow(
      'supported AT Protocol DID'
    );
  });

  it('keeps search actor shortcuts from treating DIDs like bsky handles', () => {
    expect(normalizeProfileSearchActor('alice')).toBe('alice.bsky.social');
    expect(normalizeAtprotoLoginIdentifier('did:web:Alice.Example.COM')).toBe(
      'did:web:alice.example.com'
    );
    expect(normalizeProfileSearchActor('did:web:alice.example.com')).toBe(
      'did:web:alice.example.com'
    );
    expect(normalizeProfileSearchActor('@did:web:alice.example.com')).toBe(
      'did:web:alice.example.com'
    );
  });

  it('hides only generic bsky.social handle suffixes when requested', () => {
    expect(formatAtprotoHandleForDisplay('alice.bsky.social', true)).toBe(
      'alice'
    );
    expect(
      formatAtprotoDisplayIdentifier('alice.bsky.social', {
        hideBskySocialSuffix: true
      })
    ).toBe('@alice');
    expect(
      formatAtprotoDisplayIdentifier('alice.example.com', {
        hideBskySocialSuffix: true
      })
    ).toBe('@alice.example.com');
    expect(
      formatAtprotoDisplayIdentifier('did:web:alice.example.com', {
        hideBskySocialSuffix: true
      })
    ).toBe('did:web:alice.example.com');
  });
});

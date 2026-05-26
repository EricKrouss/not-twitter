import { ensureValidDid, isValidHandle } from '@atproto/syntax';

const DID_WEB_PREFIX = 'did:web:';
const DID_PLC_PREFIX = 'did:plc:';
const BSKY_SOCIAL_HANDLE_SUFFIX = '.bsky.social';
const LOCALHOST_DID_WEB_PORT_PATTERN = /^localhost%3a\d+$/i;

export type AtprotoIdentityDid = `did:plc:${string}` | `did:web:${string}`;

function validateDidSyntax(did: string): boolean {
  try {
    ensureValidDid(did);
    return true;
  } catch {
    return false;
  }
}

function normalizeDidWeb(did: string): AtprotoIdentityDid | null {
  if (!did.startsWith(DID_WEB_PREFIX) || !validateDidSyntax(did)) return null;

  const hostname = did.slice(DID_WEB_PREFIX.length);
  if (!hostname || hostname.includes(':')) return null;

  const normalizedHostname = hostname.toLowerCase();

  // ATProto only supports hostname-level did:web. Ports are local-dev only.
  // https://atproto.com/specs/did#didweb-in-at-protocol
  if (/%3a/i.test(hostname)) {
    if (!LOCALHOST_DID_WEB_PORT_PATTERN.test(hostname)) return null;

    const normalizedLocalhost = hostname
      .replace(/^localhost/i, 'localhost')
      .replace(/%3a/i, '%3A');

    return `${DID_WEB_PREFIX}${normalizedLocalhost}` as AtprotoIdentityDid;
  }

  if (normalizedHostname === 'localhost')
    return `${DID_WEB_PREFIX}${normalizedHostname}` as AtprotoIdentityDid;

  return isValidHandle(normalizedHostname)
    ? (`${DID_WEB_PREFIX}${normalizedHostname}` as AtprotoIdentityDid)
    : null;
}

export function normalizeAtprotoDid(did: string): AtprotoIdentityDid | null {
  const trimmedDid = did.trim();

  if (trimmedDid.startsWith(DID_PLC_PREFIX) && validateDidSyntax(trimmedDid))
    return trimmedDid as AtprotoIdentityDid;

  return normalizeDidWeb(trimmedDid);
}

export function isAtprotoIdentityDid(did: string): did is AtprotoIdentityDid {
  return normalizeAtprotoDid(did) !== null;
}

export function normalizeAtprotoIdentifier(value: string): string | null {
  const identifier = value.trim();
  if (!identifier || identifier === 'null') return null;

  if (identifier.startsWith('did:')) return normalizeAtprotoDid(identifier);

  const normalizedHandle = identifier.toLowerCase();
  return isValidHandle(normalizedHandle) ? normalizedHandle : null;
}

export function normalizeProfileSearchActor(value: string): string | null {
  const identifier = value.trim().replace(/^@+/, '');
  if (!identifier || /\s/.test(identifier)) return null;

  if (identifier.startsWith('did:')) return normalizeAtprotoDid(identifier);

  const possibleHandle = identifier.includes('.')
    ? identifier
    : `${identifier}.bsky.social`;

  return normalizeAtprotoIdentifier(possibleHandle);
}

export function normalizeAtprotoLoginIdentifier(value: string): string {
  const identifier = value.trim().replace(/^@+/, '');
  const normalizedIdentifier = normalizeAtprotoIdentifier(identifier);

  if (identifier.startsWith('did:') && !normalizedIdentifier)
    throw new Error(
      'Enter a supported AT Protocol DID: did:plc or hostname-level did:web.'
    );

  return normalizedIdentifier ?? value.trim();
}

export function formatAtprotoHandleForDisplay(
  handle: string,
  hideBskySocialSuffix = false
): string {
  const trimmedHandle = handle.trim();

  if (
    hideBskySocialSuffix &&
    trimmedHandle.toLowerCase().endsWith(BSKY_SOCIAL_HANDLE_SUFFIX)
  )
    return trimmedHandle.slice(0, -BSKY_SOCIAL_HANDLE_SUFFIX.length);

  return trimmedHandle;
}

export function formatAtprotoDisplayIdentifier(
  value: string | null | undefined,
  options?: { hideBskySocialSuffix?: boolean }
): string {
  const identifier = value?.trim();
  if (!identifier) return '';

  return identifier.startsWith('did:')
    ? identifier
    : `@${formatAtprotoHandleForDisplay(
        identifier,
        options?.hideBskySocialSuffix
      )}`;
}

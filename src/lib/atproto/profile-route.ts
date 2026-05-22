import { ensureValidDid, isValidHandle } from '@atproto/syntax';

function isValidDid(value: string): boolean {
  try {
    ensureValidDid(value);
    return true;
  } catch {
    return false;
  }
}

export function isProfileRouteActor(value: string | null): boolean {
  const actor = value?.trim();

  if (!actor) return false;
  if (actor.startsWith('did:')) return isValidDid(actor);

  return isValidHandle(actor.toLowerCase());
}

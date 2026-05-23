import { normalizeAtprotoIdentifier } from './identity';

export function isProfileRouteActor(value: string | null): boolean {
  return value ? normalizeAtprotoIdentifier(value) !== null : false;
}

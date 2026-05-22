import { getAuth, type Auth } from './auth';
import { getFunctions, type Functions } from './functions';
import { getStorage, type AtprotoStorage } from './storage';
import type { Store } from './store';

export function initializeApp(): { backend: 'atproto' } {
  return { backend: 'atproto' };
}

export const app = initializeApp();
export const auth: Auth = getAuth();
export const db: Store = { backend: 'atproto' };
export const storage: AtprotoStorage = getStorage();
export const functions: Functions = getFunctions();

import {
  getSavedBlueskyAccounts as getSavedBlueskyAccountsBackend,
  getCurrentUser,
  removeBlueskyAccount as removeBlueskyAccountBackend,
  resumeAuthUser,
  signIn,
  signOut as signOutBackend,
  switchBlueskyAccount as switchBlueskyAccountBackend,
  subscribeBackend
} from './backend';
import type { SavedBlueskyAccount } from './backend';

export type Auth = { backend: 'atproto' };

export type User = {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
};

export function getAuth(): Auth {
  return { backend: 'atproto' };
}

export function connectAuthEmulator(): void {
  return undefined;
}

export function onAuthStateChanged(
  _auth: Auth,
  callback: (user: User | null) => void
): () => void {
  void resumeAuthUser()
    .then(callback)
    .catch(() => callback(null));

  return subscribeBackend(() => {
    const user = getCurrentUser();
    callback(
      user
        ? { uid: user.id, displayName: user.name, photoURL: user.photoURL }
        : null
    );
  }, ['auth']);
}

export async function signInWithBluesky(
  _auth: Auth,
  identifier: string
): Promise<{ user: User }> {
  void _auth;
  return { user: await signIn(identifier) };
}

export type BlueskyAccount = SavedBlueskyAccount;

export function getSavedBlueskyAccounts(_auth: Auth): BlueskyAccount[] {
  void _auth;
  return getSavedBlueskyAccountsBackend();
}

export async function switchBlueskyAccount(
  _auth: Auth,
  id: string
): Promise<{ user: User }> {
  void _auth;
  return { user: await switchBlueskyAccountBackend(id) };
}

export async function removeBlueskyAccount(
  _auth: Auth,
  id: string
): Promise<void> {
  void _auth;
  await removeBlueskyAccountBackend(id);
}

export async function signOut(_auth?: Auth): Promise<void> {
  void _auth;
  await signOutBackend();
}

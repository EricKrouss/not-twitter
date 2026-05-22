export type AtprotoStorage = { backend: 'atproto' };

export function getStorage(): AtprotoStorage {
  return { backend: 'atproto' };
}

export function connectStorageEmulator(): void {
  return undefined;
}

export function ref(): { backend: 'atproto-storage-ref' } {
  return { backend: 'atproto-storage-ref' };
}

export function uploadBytesResumable(): Promise<void> {
  return Promise.resolve();
}

export function getDownloadURL(): Promise<string> {
  return Promise.resolve('');
}

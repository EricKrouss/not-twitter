import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { Functions } from 'firebase/functions';
import type { FirebaseStorage } from 'firebase/storage';

export const app = { backend: 'atproto' };
export const auth: Auth = getAuth();
export const db: Firestore = { backend: 'atproto' };
export const storage: FirebaseStorage = getStorage();
export const functions: Functions = getFunctions();

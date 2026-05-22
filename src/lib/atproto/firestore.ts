import {
  addTweet,
  getCollection,
  getDocument,
  queryCollection,
  subscribeBackend,
  type BackendCollection,
  type BackendConstraint
} from './backend';
import { Timestamp } from './timestamp';

type SnapshotOptions = unknown;
type Unsubscribe = () => void;

export { Timestamp };

export type Firestore = { backend: 'atproto' };
export type QueryConstraint = BackendConstraint;
export type WithFieldValue<T> = T;

export type FirestoreDataConverter<T> = {
  toFirestore(data: T): unknown;
  fromFirestore(
    snapshot: QueryDocumentSnapshot<T>,
    options: SnapshotOptions
  ): T;
};

export type CollectionReference<T = unknown> = {
  type: 'collection';
  collection: BackendCollection;
  constraints: BackendConstraint[];
  readonly __type?: T;
  withConverter<U>(
    converter: FirestoreDataConverter<U>
  ): CollectionReference<U>;
};

export type Query<T = unknown> = CollectionReference<T>;

export type DocumentReference<T = unknown> = {
  type: 'document';
  id: string;
  collection: BackendCollection;
  readonly __type?: T;
};

export class QueryDocumentSnapshot<T = unknown> {
  constructor(
    readonly id: string,
    private readonly value: T,
    readonly ref: DocumentReference<T>
  ) {}

  exists(): true {
    return true;
  }

  data(_options?: SnapshotOptions): T {
    return this.value;
  }
}

export class DocumentSnapshot<T = unknown> {
  constructor(
    readonly id: string,
    private readonly value: T | null,
    readonly ref: DocumentReference<T>
  ) {}

  exists(): boolean {
    return this.value !== null;
  }

  data(_options?: SnapshotOptions): T {
    return this.value as T;
  }
}

export class QuerySnapshot<T = unknown> {
  readonly empty: boolean;
  readonly size: number;

  constructor(readonly docs: QueryDocumentSnapshot<T>[]) {
    this.empty = docs.length === 0;
    this.size = docs.length;
  }

  forEach(callback: (snapshot: QueryDocumentSnapshot<T>) => void): void {
    this.docs.forEach(callback);
  }
}

function withConverter<T>(
  this: CollectionReference,
  _converter: FirestoreDataConverter<T>
): CollectionReference<T> {
  return this as unknown as CollectionReference<T>;
}

export function collection(_db: Firestore, path: string): CollectionReference {
  return {
    type: 'collection',
    collection: getCollection(path),
    constraints: [],
    withConverter
  };
}

export function doc<T>(
  ref: CollectionReference<T>,
  id: string
): DocumentReference<T> {
  return {
    type: 'document',
    id,
    collection: ref.collection
  };
}

export function query<T>(
  ref: CollectionReference<T>,
  ...constraints: BackendConstraint[]
): Query<T> {
  return {
    ...ref,
    constraints: [...ref.constraints, ...constraints],
    withConverter
  };
}

export function where(
  field: string,
  op: string,
  value: unknown
): BackendConstraint {
  return { type: 'where', field, op, value };
}

export function orderBy(
  field: string,
  direction?: 'asc' | 'desc'
): BackendConstraint {
  return { type: 'orderBy', field, direction };
}

export function limit(count: number): BackendConstraint {
  return { type: 'limit', count };
}

export function documentId(): string {
  return 'id';
}

export async function getDoc<T>(
  ref: DocumentReference<T>
): Promise<DocumentSnapshot<T>> {
  const value = await getDocument<T>(
    ref.collection.collectionName,
    ref.id,
    ref.collection.ownerId
  );

  return new DocumentSnapshot(ref.id, value, ref);
}

export async function getDocs<T>(ref: Query<T>): Promise<QuerySnapshot<T>> {
  const values = await queryCollection<T>(
    ref.collection.collectionName,
    ref.constraints,
    ref.collection.ownerId
  );

  return new QuerySnapshot(
    values.map((value) => {
      const id =
        value && typeof value === 'object' && 'id' in value
          ? String((value as unknown as { id: unknown }).id)
          : crypto.randomUUID();

      return new QueryDocumentSnapshot(id, value, doc(ref, id));
    })
  );
}

export function onSnapshot<T>(
  ref: DocumentReference<T>,
  callback: (snapshot: DocumentSnapshot<T>) => void
): Unsubscribe;
export function onSnapshot<T>(
  ref: Query<T>,
  callback: (snapshot: QuerySnapshot<T>) => void
): Unsubscribe;
export function onSnapshot<T>(
  ref: DocumentReference<T> | Query<T>,
  callback: (snapshot: never) => void
): Unsubscribe {
  const emit = (): void => {
    if (ref.type === 'document') {
      void getDoc(ref).then(
        callback as (snapshot: DocumentSnapshot<T>) => void,
        () => undefined
      );
    } else {
      void getDocs(ref).then(
        callback as (snapshot: QuerySnapshot<T>) => void,
        () => undefined
      );
    }
  };

  emit();
  return subscribeBackend(emit);
}

export async function addDoc<T>(
  ref: CollectionReference<T>,
  data: WithFieldValue<T>
): Promise<DocumentReference<T>> {
  if (ref.collection.collectionName !== 'tweets') {
    const id = crypto.randomUUID();
    return doc(ref, id);
  }

  const tweet = await addTweet(data as never);
  return doc(ref, tweet.id);
}

export async function setDoc<T>(
  _ref?: DocumentReference<T>,
  _data?: WithFieldValue<T>
): Promise<void> {
  void _ref;
  void _data;
  await Promise.resolve();
}
export async function updateDoc<T>(
  _ref?: DocumentReference<T>,
  _data?: Partial<T>
): Promise<void> {
  void _ref;
  void _data;
  await Promise.resolve();
}
export async function deleteDoc<T>(_ref?: DocumentReference<T>): Promise<void> {
  void _ref;
  await Promise.resolve();
}

export function serverTimestamp(): Timestamp {
  return Timestamp.now();
}

export function increment(value: number): { op: 'increment'; value: number } {
  return { op: 'increment', value };
}

export function arrayUnion<T>(...value: T[]): { op: 'arrayUnion'; value: T[] } {
  return { op: 'arrayUnion', value };
}

export function arrayRemove<T>(...value: T[]): {
  op: 'arrayRemove';
  value: T[];
} {
  return { op: 'arrayRemove', value };
}

export function writeBatch(): {
  update(): void;
  delete(): void;
  commit(): Promise<void>;
} {
  return {
    update(): void {
      return undefined;
    },
    delete(): void {
      return undefined;
    },
    async commit(): Promise<void> {
      await Promise.resolve();
    }
  };
}

export async function getCountFromServer<T>(
  ref: Query<T>
): Promise<{ data(): { count: number } }> {
  const snapshot = await getDocs(ref);
  return { data: () => ({ count: snapshot.size }) };
}

export function refEqual<T>(
  left: DocumentReference<T>,
  right: DocumentReference<T>
): boolean {
  return left.collection.path === right.collection.path && left.id === right.id;
}

export function queryEqual<T>(left: Query<T>, right: Query<T>): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

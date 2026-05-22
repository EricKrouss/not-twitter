import {
  useState,
  useEffect,
  useContext,
  createContext,
  useMemo,
  useCallback
} from 'react';
import {
  getSavedBlueskyAccounts,
  removeBlueskyAccount as removeBlueskyAccountAuth,
  signInWithBluesky as signInWithBlueskyAuth,
  switchBlueskyAccount as switchBlueskyAccountAuth,
  onAuthStateChanged,
  signOut as signOutFirebase
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { auth } from '@lib/firebase/app';
import {
  usersCollection,
  userStatsCollection,
  userBookmarksCollection
} from '@lib/firebase/collections';
import {
  DEFAULT_PROFILE_COVER_URL,
  DEFAULT_PROFILE_PHOTO_URL
} from '@lib/default-images';
import { getRandomId, getRandomInt } from '@lib/random';
import { checkUsernameAvailability } from '@lib/firebase/utils';
import type { ReactNode } from 'react';
import type { BlueskyAccount, User as AuthUser } from 'firebase/auth';
import type { WithFieldValue } from 'firebase/firestore';
import type { User } from '@lib/types/user';
import type { Bookmark } from '@lib/types/bookmark';
import type { Stats } from '@lib/types/stats';

type AuthContext = {
  user: User | null;
  error: Error | null;
  loading: boolean;
  isAdmin: boolean;
  randomSeed: string;
  userBookmarks: Bookmark[] | null;
  accounts: BlueskyAccount[];
  signOut: () => Promise<void>;
  signInWithBluesky: (identifier: string) => Promise<void>;
  switchBlueskyAccount: (id: string) => Promise<void>;
  removeBlueskyAccount: (id: string) => Promise<void>;
};

export const AuthContext = createContext<AuthContext | null>(null);

type AuthContextProviderProps = {
  children: ReactNode;
};

export function AuthContextProvider({
  children
}: AuthContextProviderProps): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [userBookmarks, setUserBookmarks] = useState<Bookmark[] | null>(null);
  const [accounts, setAccounts] = useState<BlueskyAccount[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  const syncAccounts = useCallback((): void => {
    setAccounts(getSavedBlueskyAccounts(auth));
  }, []);

  useEffect(() => {
    const manageUser = async (authUser: AuthUser): Promise<void> => {
      const { uid, displayName, photoURL } = authUser;

      const userSnapshot = await getDoc(doc(usersCollection, uid));

      if (!userSnapshot.exists()) {
        let available = false;
        let randomUsername = '';

        while (!available) {
          const normalizeName = displayName?.replace(/\s/g, '').toLowerCase();
          const randomInt = getRandomInt(1, 10_000);

          randomUsername = `${normalizeName as string}${randomInt}`;

          const isUsernameAvailable = await checkUsernameAvailability(
            randomUsername
          );

          if (isUsernameAvailable) available = true;
        }

        const userData: WithFieldValue<User> = {
          id: uid,
          bio: null,
          name: displayName as string,
          theme: null,
          accent: null,
          website: null,
          location: null,
          photoURL: photoURL ?? DEFAULT_PROFILE_PHOTO_URL,
          username: randomUsername,
          verified: false,
          following: [],
          followers: [],
          followingCount: 0,
          followersCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: null,
          totalTweets: 0,
          totalPhotos: 0,
          pinnedTweet: null,
          coverPhotoURL: DEFAULT_PROFILE_COVER_URL
        };

        const userStatsData: WithFieldValue<Stats> = {
          likes: [],
          tweets: [],
          updatedAt: null
        };

        try {
          await Promise.all([
            setDoc(doc(usersCollection, uid), userData),
            setDoc(doc(userStatsCollection(uid), 'stats'), userStatsData)
          ]);

          const newUser = (await getDoc(doc(usersCollection, uid))).data();
          setUser(newUser as User);
        } catch (error) {
          setError(error as Error);
        }
      } else {
        const userData = userSnapshot.data();
        setUser(userData);
      }

      setLoading(false);
      syncAccounts();
    };

    const handleUserAuth = (authUser: AuthUser | null): void => {
      setLoading(true);
      syncAccounts();

      if (authUser) {
        setUserBookmarks(null);
        void manageUser(authUser);
      } else {
        setUser(null);
        setUserBookmarks(null);
        setLoading(false);
        syncAccounts();
      }
    };

    onAuthStateChanged(auth, handleUserAuth);
  }, [syncAccounts]);

  useEffect(() => {
    if (!user) return;

    const { id } = user;

    const unsubscribeUser = onSnapshot(doc(usersCollection, id), (doc) => {
      setUser(doc.data() as User);
    });

    const unsubscribeBookmarks = onSnapshot(
      userBookmarksCollection(id),
      (snapshot) => {
        const bookmarks = snapshot.docs.map((doc) => doc.data());
        setUserBookmarks(bookmarks);
      }
    );

    return () => {
      unsubscribeUser();
      unsubscribeBookmarks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const signInWithBluesky = async (identifier: string): Promise<void> => {
    try {
      setError(null);
      await signInWithBlueskyAuth(auth, identifier);
      syncAccounts();
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  };

  const switchBlueskyAccount = async (id: string): Promise<void> => {
    try {
      setError(null);
      await switchBlueskyAccountAuth(auth, id);
      syncAccounts();
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  };

  const removeBlueskyAccount = async (id: string): Promise<void> => {
    try {
      setError(null);
      await removeBlueskyAccountAuth(auth, id);
      syncAccounts();
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      await signOutFirebase(auth);
      syncAccounts();
    } catch (error) {
      setError(error as Error);
    }
  };

  const isAdmin = user ? user.username === 'ccrsxx' : false;
  const randomSeed = useMemo(getRandomId, [user?.id]);

  const value: AuthContext = {
    user,
    error,
    loading,
    isAdmin,
    randomSeed,
    userBookmarks,
    accounts,
    signOut,
    signInWithBluesky,
    switchBlueskyAccount,
    removeBlueskyAccount
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContext {
  const context = useContext(AuthContext);

  if (!context)
    throw new Error('useAuth must be used within an AuthContextProvider');

  return context;
}

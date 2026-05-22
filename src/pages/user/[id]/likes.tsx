import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '@lib/context/auth-context';
import { useCollection } from '@lib/hooks/useCollection';
import { tweetsCollection } from '@lib/firebase/collections';
import { useUser } from '@lib/context/user-context';
import { getUserPath } from '@lib/routes';
import { PublicUserLayout } from '@components/layout/common-layout';
import { SEO } from '@components/common/seo';
import { UserDataLayout } from '@components/layout/user-data-layout';
import { UserHomeLayout } from '@components/layout/user-home-layout';
import { Tweet } from '@components/tweet/tweet';
import { Loading } from '@components/ui/loading';
import { StatsEmpty } from '@components/tweet/stats-empty';
import { query, where, orderBy } from 'firebase/firestore';
import type { ReactElement, ReactNode } from 'react';

export default function UserLikes(): JSX.Element {
  const { user: authUser } = useAuth();
  const { user } = useUser();
  const { replace } = useRouter();

  const { id, name, username } = user ?? {};
  const likesVisible = !!authUser && authUser.id === id;

  const { data, loading } = useCollection(
    query(
      tweetsCollection,
      where('userLikes', 'array-contains', id),
      orderBy('createdAt', 'desc')
    ),
    { includeUser: true, allowNull: true, disabled: !likesVisible }
  );

  useEffect(() => {
    if (!likesVisible && username) void replace(getUserPath(username));
  }, [likesVisible, replace, username]);

  return (
    <section>
      <SEO
        title={`Tweets liked by ${name as string} (@${
          username as string
        }) / Not Twitter`}
      />
      {!likesVisible ? (
        <Loading className='mt-5' />
      ) : loading ? (
        <Loading className='mt-5' />
      ) : !data ? (
        <StatsEmpty
          title={`@${username as string} hasn't liked any Tweets`}
          description='When they do, those Tweets will show up here.'
        />
      ) : (
        <AnimatePresence>
          {data.map((tweet) => (
            <Tweet {...tweet} key={tweet.id} />
          ))}
        </AnimatePresence>
      )}
    </section>
  );
}

UserLikes.getLayout = (page: ReactElement): ReactNode => (
  <PublicUserLayout>
    <UserDataLayout>
      <UserHomeLayout>{page}</UserHomeLayout>
    </UserDataLayout>
  </PublicUserLayout>
);

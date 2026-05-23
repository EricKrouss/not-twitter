import { AnimatePresence } from 'framer-motion';
import { doc, query, where } from '@lib/atproto/store';
import { useUser } from '@lib/context/user-context';
import { useCollection } from '@lib/hooks/useCollection';
import { useDocument } from '@lib/hooks/useDocument';
import { tweetsCollection } from '@lib/atproto/collections';
import { mergeData } from '@lib/merge';
import { PublicUserLayout } from '@components/layout/common-layout';
import { UserDataLayout } from '@components/layout/user-data-layout';
import { UserHomeLayout } from '@components/layout/user-home-layout';
import { StatsEmpty } from '@components/tweet/stats-empty';
import { Loading } from '@components/ui/loading';
import { Tweet } from '@components/tweet/tweet';
import type { ReactElement, ReactNode } from 'react';

export default function UserTweets(): JSX.Element {
  const { user } = useUser();

  const { id, username, pinnedTweet } = user ?? {};
  const profileRestricted = !!user?.blocking || !!user?.blockedBy;

  const { data: pinnedData } = useDocument(
    doc(tweetsCollection, pinnedTweet ?? 'null'),
    {
      disabled: !pinnedTweet || profileRestricted,
      allowNull: true,
      includeUser: true
    }
  );

  const { data: ownerTweets, loading: ownerLoading } = useCollection(
    query(
      tweetsCollection,
      where('createdBy', '==', id),
      where('parent', '==', null)
    ),
    { includeUser: true, allowNull: true, disabled: profileRestricted }
  );

  const { data: peopleTweets, loading: peopleLoading } = useCollection(
    query(
      tweetsCollection,
      where('createdBy', '!=', id),
      where('userRetweets', 'array-contains', id)
    ),
    { includeUser: true, allowNull: true, disabled: profileRestricted }
  );

  const mergedTweets = mergeData(true, ownerTweets, peopleTweets);

  return (
    <section>
      {ownerLoading || peopleLoading ? (
        <Loading className='mt-5' />
      ) : !mergedTweets ? (
        <StatsEmpty
          title={`@${username as string} hasn't tweeted`}
          description='When they do, their Tweets will show up here.'
        />
      ) : (
        <AnimatePresence>
          {pinnedData && (
            <Tweet pinned {...pinnedData} key={`pinned-${pinnedData.id}`} />
          )}
          {mergedTweets.map((tweet) => (
            <Tweet {...tweet} profile={user} key={tweet.id} />
          ))}
        </AnimatePresence>
      )}
    </section>
  );
}

UserTweets.getLayout = (page: ReactElement): ReactNode => (
  <PublicUserLayout>
    <UserDataLayout>
      <UserHomeLayout>{page}</UserHomeLayout>
    </UserDataLayout>
  </PublicUserLayout>
);

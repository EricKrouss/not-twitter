import { AnimatePresence } from 'framer-motion';
import { doc, query, where, orderBy } from '@lib/atproto/store';
import { useCollection } from '@lib/hooks/useCollection';
import { useDocument } from '@lib/hooks/useDocument';
import { tweetsCollection } from '@lib/atproto/collections';
import { useUser } from '@lib/context/user-context';
import { PublicUserLayout } from '@components/layout/common-layout';
import { SEO } from '@components/common/seo';
import { UserDataLayout } from '@components/layout/user-data-layout';
import { UserHomeLayout } from '@components/layout/user-home-layout';
import { Tweet } from '@components/tweet/tweet';
import { Loading } from '@components/ui/loading';
import { StatsEmpty } from '@components/tweet/stats-empty';
import { TweetWithParent } from '@components/tweet/tweet-with-parent';
import type { ReactElement, ReactNode } from 'react';

export default function UserWithReplies(): JSX.Element {
  const { user } = useUser();

  const { id, name, username, pinnedTweet } = user ?? {};
  const profileRestricted = !!user?.blocking || !!user?.blockedBy;

  const { data: pinnedData } = useDocument(
    doc(tweetsCollection, pinnedTweet ?? 'null'),
    {
      disabled: !pinnedTweet || profileRestricted,
      allowNull: true,
      includeUser: true
    }
  );

  const { data, loading } = useCollection(
    query(
      tweetsCollection,
      where('createdBy', '==', id),
      orderBy('createdAt', 'desc')
    ),
    { includeUser: true, allowNull: true, disabled: profileRestricted }
  );

  return (
    <section>
      <SEO
        title={`Tweets with replies by ${name as string} (@${
          username as string
        }) / Not Twitter`}
      />
      {loading ? (
        <Loading className='mt-5' />
      ) : !data ? (
        <StatsEmpty
          title={`@${username as string} hasn't tweeted`}
          description='When they do, their Tweets will show up here.'
        />
      ) : (
        <AnimatePresence>
          {pinnedData && (
            <Tweet pinned {...pinnedData} key={`pinned-${pinnedData.id}`} />
          )}
          <TweetWithParent data={data} />
        </AnimatePresence>
      )}
    </section>
  );
}

UserWithReplies.getLayout = (page: ReactElement): ReactNode => (
  <PublicUserLayout>
    <UserDataLayout>
      <UserHomeLayout>{page}</UserHomeLayout>
    </UserDataLayout>
  </PublicUserLayout>
);

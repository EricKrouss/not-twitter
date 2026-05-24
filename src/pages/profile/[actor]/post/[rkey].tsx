import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { AnimatePresence } from 'framer-motion';
import useSWR from 'swr';
import { getTweetThread, subscribeBackend, getUser, postIdFromUri } from '@lib/atproto/backend';
import { isPlural } from '@lib/utils';
import { PublicTweetLayout } from '@components/layout/common-layout';
import { MainContainer } from '@components/home/main-container';
import { MainHeader } from '@components/home/main-header';
import { Tweet } from '@components/tweet/tweet';
import { ViewTweet } from '@components/view/view-tweet';
import { SEO } from '@components/common/seo';
import { Loading } from '@components/ui/loading';
import { Error } from '@components/ui/error';
import type { ReactElement, ReactNode } from 'react';
import type { TweetThreadPage } from '@lib/atproto/backend';
import type { User } from '@lib/types/user';

function getRouteParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default function ProfileTweetId(): JSX.Element {
  const { query: routeQuery, back } = useRouter();
  const actor = getRouteParam(routeQuery.actor);
  const rkey = getRouteParam(routeQuery.rkey);

  // We need to resolve the actor (handle) to get the DID, then construct the AT URI: at://{did}/app.bsky.feed.post/{rkey}
  const { data: userProfile, error: profileError } = useSWR<User | null, Error>(
    actor ? ['user-profile', actor] : null,
    () => getUser(actor!)
  );

  const resolvedDid = userProfile?.id;
  const tweetId = resolvedDid && rkey ? postIdFromUri(`at://${resolvedDid}/app.bsky.feed.post/${rkey}`) : null;
  const tweetPathId = tweetId ?? 'null';

  const {
    data: threadData,
    error: threadError,
    mutate
  } = useSWR<TweetThreadPage | null, Error>(
    tweetId ? ['tweet-thread', tweetPathId] : null,
    () => getTweetThread(tweetPathId),
    { revalidateOnFocus: false }
  );

  const viewTweetRef = useRef<HTMLElement>(null);

  const profileLoading = !!actor && !profileError && userProfile === undefined;
  const tweetLoading = profileLoading || (!!tweetId && !threadError && threadData === undefined);
  const error = profileError || threadError;

  const tweetData = threadData?.tweet ?? null;
  const parentTweets = threadData?.parents ?? [];
  const threadReplies = threadData?.threadReplies ?? [];
  const repliesData = threadData?.replies ?? [];

  const { text, images } = tweetData ?? {};

  const imagesLength = images?.length ?? 0;
  const hasParentTweets = parentTweets.length > 0;
  const hasThreadReplies = threadReplies.length > 0;
  const hasThread = hasParentTweets || hasThreadReplies;

  const pageTitle = tweetData
    ? `${tweetData.user.name} on Not Twitter: "${text ?? ''}${
        images ? ` (${imagesLength} image${isPlural(imagesLength)})` : ''
      }" / Not Twitter`
    : null;

  useEffect(() => {
    if (!tweetLoading && hasParentTweets)
      viewTweetRef.current?.scrollIntoView();
  }, [hasParentTweets, tweetData?.id, tweetLoading]);

  useEffect(() => {
    if (!tweetId) return undefined;

    return subscribeBackend(() => {
      void mutate();
    });
  }, [mutate, tweetId]);

  return (
    <MainContainer className='!pb-[1280px]'>
      <MainHeader
        useActionButton
        title={hasThread ? 'Thread' : 'Tweet'}
        action={back}
      />
      <section>
        {tweetLoading ? (
          <Loading className='mt-5' />
        ) : !tweetData ? (
          <>
            <SEO title='Tweet not found / Not Twitter' />
            <Error message='Tweet not found' />
          </>
        ) : (
          <>
            {pageTitle && <SEO title={pageTitle} />}
            {parentTweets.map((parentTweet) => (
              <Tweet parentTweet {...parentTweet} key={parentTweet.id} />
            ))}
            <ViewTweet viewTweetRef={viewTweetRef} {...tweetData} />
            <AnimatePresence>
              {threadReplies.map((tweet) => (
                <Tweet {...tweet} key={tweet.id} />
              ))}
              {repliesData.map((tweet) => (
                <Tweet {...tweet} key={tweet.id} />
              ))}
            </AnimatePresence>
          </>
        )}
      </section>
    </MainContainer>
  );
}

ProfileTweetId.getLayout = (page: ReactElement): ReactNode => (
  <PublicTweetLayout>{page}</PublicTweetLayout>
);

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { AnimatePresence } from 'framer-motion';
import useSWR from 'swr';
import { getTweetThread } from '@lib/atproto/backend';
import { isPlural } from '@lib/utils';
import { getTweetRouteId } from '@lib/static-routes';
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

function getRouteParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default function TweetId(): JSX.Element {
  const { asPath, query: routeQuery, back } = useRouter();
  const tweetId =
    getRouteParam(routeQuery.tweetId) ??
    getRouteParam(routeQuery.id) ??
    getTweetRouteId(asPath);
  const tweetPathId = tweetId ?? 'null';

  const { data: threadData, error } = useSWR<TweetThreadPage | null, Error>(
    tweetId ? ['tweet-thread', tweetPathId] : null,
    () => getTweetThread(tweetPathId),
    { revalidateOnFocus: false }
  );

  const viewTweetRef = useRef<HTMLElement>(null);

  const tweetLoading = !!tweetId && !error && threadData === undefined;
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

TweetId.getLayout = (page: ReactElement): ReactNode => (
  <PublicTweetLayout>{page}</PublicTweetLayout>
);

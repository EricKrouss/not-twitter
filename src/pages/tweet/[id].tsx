import { useRef } from 'react';
import { useRouter } from 'next/router';
import { AnimatePresence } from 'framer-motion';
import { tweetsCollection } from '@lib/atproto/collections';
import { useCollection } from '@lib/hooks/useCollection';
import { useDocument } from '@lib/hooks/useDocument';
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
import { ViewParentTweet } from '@components/view/view-parent-tweet';
import { doc, query, where, orderBy } from '@lib/atproto/store';
import type { ReactElement, ReactNode } from 'react';

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

  const { data: tweetData, loading: tweetLoading } = useDocument(
    doc(tweetsCollection, tweetPathId),
    { includeUser: true, allowNull: true }
  );

  const viewTweetRef = useRef<HTMLElement>(null);

  const { data: repliesData, loading: repliesLoading } = useCollection(
    query(
      tweetsCollection,
      where('parent.id', '==', tweetPathId),
      orderBy('createdAt', 'desc')
    ),
    { includeUser: true, allowNull: true }
  );

  const { text, images } = tweetData ?? {};

  const imagesLength = images?.length ?? 0;
  const parentId = tweetData?.parent?.id;

  const pageTitle = tweetData
    ? `${tweetData.user.name} on Not Twitter: "${text ?? ''}${
        images ? ` (${imagesLength} image${isPlural(imagesLength)})` : ''
      }" / Not Twitter`
    : null;

  return (
    <MainContainer className='!pb-[1280px]'>
      <MainHeader
        useActionButton
        title={parentId ? 'Thread' : 'Tweet'}
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
            {parentId && (
              <ViewParentTweet
                parentId={parentId}
                viewTweetRef={viewTweetRef}
              />
            )}
            <ViewTweet viewTweetRef={viewTweetRef} {...tweetData} />
            {tweetData &&
              (repliesLoading ? (
                <Loading className='mt-5' />
              ) : (
                <AnimatePresence>
                  {repliesData?.map((tweet) => (
                    <Tweet {...tweet} key={tweet.id} />
                  ))}
                </AnimatePresence>
              ))}
          </>
        )}
      </section>
    </MainContainer>
  );
}

TweetId.getLayout = (page: ReactElement): ReactNode => (
  <PublicTweetLayout>{page}</PublicTweetLayout>
);

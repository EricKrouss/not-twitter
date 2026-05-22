import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import cn from 'clsx';
import useSWR from 'swr';
import {
  getDiscoverHomeFeedPage,
  getFollowingHomeFeedPage,
  getSubscribedHomeFeedPage,
  getSubscribedHomeFeeds
} from '@lib/atproto/backend';
import { useLiveUpdates } from '@lib/context/live-updates-context';
import { useWindow } from '@lib/context/window-context';
import { HomeLayout, ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { SEO } from '@components/common/seo';
import { MainContainer } from '@components/home/main-container';
import { Input } from '@components/input/input';
import { UpdateUsername } from '@components/home/update-username';
import { MobileSidebar } from '@components/sidebar/mobile-sidebar';
import { Tweet } from '@components/tweet/tweet';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { Loading } from '@components/ui/loading';
import { Error } from '@components/ui/error';
import { ToolTip } from '@components/ui/tooltip';
import type {
  MouseEvent,
  PointerEvent,
  ReactElement,
  ReactNode
} from 'react';
import type {
  HomeFeedPage,
  SubscribedHomeFeed
} from '@lib/atproto/backend';
import type { TweetWithUser } from '@lib/types/tweet';

type HomeFeedTab = 'discover' | 'following' | `feed:${string}`;

type HomeFeedTabData = {
  label: string;
  value: HomeFeedTab;
};

const baseHomeFeedTabs: Readonly<HomeFeedTabData[]> = [
  { label: 'For you', value: 'discover' },
  { label: 'Following', value: 'following' }
];
const HOME_FEED_REFRESH_INTERVAL_MS = 15000;
const FEED_TAB_PREFIX = 'feed:';

async function getHomeFeedPage(
  tab: HomeFeedTab,
  cursor?: string
): Promise<HomeFeedPage> {
  if (tab === 'discover') return getDiscoverHomeFeedPage(cursor);
  if (tab === 'following') return getFollowingHomeFeedPage(cursor);

  return getSubscribedHomeFeedPage(tab.slice(FEED_TAB_PREFIX.length), cursor);
}

function mergeTweets(
  currentFeed: TweetWithUser[],
  nextFeed: TweetWithUser[]
): TweetWithUser[] {
  const seenIds = new Set(currentFeed.map(({ id }) => id));
  const newTweets = nextFeed.filter(({ id }) => !seenIds.has(id));

  return [...currentFeed, ...newTweets];
}

function prependTweets(
  currentFeed: TweetWithUser[],
  nextFeed: TweetWithUser[]
): TweetWithUser[] {
  const seenIds = new Set(currentFeed.map(({ id }) => id));
  const newTweets = nextFeed.filter(({ id }) => !seenIds.has(id));

  return [...newTweets, ...currentFeed];
}

function getNewTweetsBeforeCurrentTop(
  nextFeed: TweetWithUser[],
  currentFeed: TweetWithUser[],
  pendingTweets: TweetWithUser[]
): TweetWithUser[] {
  const currentTopId = currentFeed[0]?.id;
  const knownIds = new Set(
    [...currentFeed, ...pendingTweets].map(({ id }) => id)
  );
  const newTweets: TweetWithUser[] = [];

  for (const tweet of nextFeed) {
    if (tweet.id === currentTopId) break;
    if (!knownIds.has(tweet.id)) newTweets.push(tweet);
  }

  return newTweets;
}

function HomeTabs({
  activeTab,
  setActiveTab,
  subscribedFeeds
}: {
  activeTab: HomeFeedTab;
  setActiveTab: (tab: HomeFeedTab) => void;
  subscribedFeeds: SubscribedHomeFeed[];
}): JSX.Element {
  const scrollRef = useRef<HTMLElement | null>(null);
  const suppressNextClickRef = useRef(false);
  const dragStateRef = useRef({
    dragging: false,
    moved: false,
    pendingTab: null as HomeFeedTab | null,
    pointerId: 0,
    scrollLeft: 0,
    startX: 0
  });
  const homeFeedTabs = [
    ...baseHomeFeedTabs,
    ...subscribedFeeds.map<HomeFeedTabData>((feed) => ({
      label: feed.displayName,
      value: `${FEED_TAB_PREFIX}${feed.uri}` as HomeFeedTab
    }))
  ];

  const handlePointerDown = (event: PointerEvent<HTMLElement>): void => {
    if (event.button !== 0 || !scrollRef.current) return;

    const pendingTabButton =
      event.target instanceof HTMLElement
        ? (event.target.closest('[data-feed-tab]') as HTMLButtonElement | null)
        : null;

    dragStateRef.current = {
      dragging: true,
      moved: false,
      pendingTab: (pendingTabButton?.dataset.feedTab as HomeFeedTab) ?? null,
      pointerId: event.pointerId,
      scrollLeft: scrollRef.current.scrollLeft,
      startX: event.clientX
    };
    scrollRef.current.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>): void => {
    const dragState = dragStateRef.current;
    if (
      !dragState.dragging ||
      dragState.pointerId !== event.pointerId ||
      !scrollRef.current
    )
      return;

    const offset = event.clientX - dragState.startX;
    if (Math.abs(offset) > 4) dragState.moved = true;
    if (dragState.moved) event.preventDefault();
    scrollRef.current.scrollLeft = dragState.scrollLeft - offset;
  };

  const stopDragging = (event: PointerEvent<HTMLElement>): void => {
    const dragState = dragStateRef.current;
    if (!dragState.dragging || dragState.pointerId !== event.pointerId) return;

    if (dragState.moved) suppressNextClickRef.current = true;
    else if (dragState.pendingTab) setActiveTab(dragState.pendingTab);

    dragStateRef.current = {
      dragging: false,
      moved: false,
      pendingTab: null,
      pointerId: 0,
      scrollLeft: 0,
      startX: 0
    };

    if (scrollRef.current?.hasPointerCapture(event.pointerId))
      scrollRef.current.releasePointerCapture(event.pointerId);
  };

  const handleClickCapture = (event: MouseEvent<HTMLElement>): void => {
    if (!suppressNextClickRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    suppressNextClickRef.current = false;
  };

  return (
    <nav
      className='feed-tabs-scroll h-[53px] select-none overflow-x-auto overflow-y-hidden
                 border-b border-light-border dark:border-dark-border'
      ref={scrollRef}
      role='tablist'
      aria-label='Home feeds'
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onClickCapture={handleClickCapture}
    >
      <div className='flex h-full min-w-full'>
        {homeFeedTabs.map(({ label, value }) => {
          const active = activeTab === value;
          const selectTab = (): void => setActiveTab(value);

          return (
            <button
              className={cn(
                `accent-tab hover-card relative flex h-[53px] min-w-[128px] flex-1
                 items-center justify-center px-4 text-[15px] font-bold outline-none`,
                active
                  ? 'text-light-primary dark:text-dark-primary'
                  : 'text-light-secondary dark:text-dark-secondary'
              )}
              type='button'
              role='tab'
              aria-selected={active}
              data-feed-tab={value}
              onClick={selectTab}
              key={value}
            >
              <span className='max-w-full truncate'>{label}</span>
              {active && (
                <i className='absolute bottom-0 h-1 w-14 rounded-full bg-main-accent' />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default function Home(): JSX.Element {
  const { isMobile } = useWindow();
  const { clearHomeBadge } = useLiveUpdates();
  const [activeTab, setActiveTab] = useState<HomeFeedTab>('discover');
  const [feed, setFeed] = useState<TweetWithUser[]>([]);
  const [newTweets, setNewTweets] = useState<TweetWithUser[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [timelineSettingsOpen, setTimelineSettingsOpen] = useState(false);
  const feedRef = useRef<TweetWithUser[]>([]);
  const newTweetsRef = useRef<TweetWithUser[]>([]);
  const { data: subscribedFeeds = [] } = useSWR<SubscribedHomeFeed[], Error>(
    'home-subscribed-feeds',
    getSubscribedHomeFeeds,
    { revalidateOnFocus: false }
  );

  const { data, error } = useSWR<HomeFeedPage, Error>(
    ['home-feed', activeTab],
    () => getHomeFeedPage(activeTab),
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    setFeed([]);
    setNewTweets([]);
    setCursor(null);
    setLoadingMore(false);
  }, [activeTab]);

  useEffect(() => {
    feedRef.current = feed;
  }, [feed]);

  useEffect(() => {
    newTweetsRef.current = newTweets;
  }, [newTweets]);

  useEffect(() => {
    if (!data) return;

    setFeed(data.tweets);
    setNewTweets([]);
    setCursor(data.cursor);
    if (activeTab === 'following') clearHomeBadge(data.tweets[0]?.id ?? null);
  }, [activeTab, clearHomeBadge, data]);

  useEffect(() => {
    if (!data) return;

    let canceled = false;

    const refreshHomeFeed = async (): Promise<void> => {
      try {
        const nextPage = await getHomeFeedPage(activeTab);

        if (canceled) return;

        const currentFeed = feedRef.current;

        if (!currentFeed.length) {
          setFeed(nextPage.tweets);
          setCursor(nextPage.cursor);
          if (activeTab === 'following')
            clearHomeBadge(nextPage.tweets[0]?.id ?? null);
          return;
        }

        const freshTweets = getNewTweetsBeforeCurrentTop(
          nextPage.tweets,
          currentFeed,
          newTweetsRef.current
        );

        if (freshTweets.length)
          setNewTweets((currentNewTweets) =>
            prependTweets(currentNewTweets, freshTweets)
          );
      } catch {
        // Home can keep its current timeline if a background refresh fails.
      }
    };

    const refreshSoon = (): void => {
      void refreshHomeFeed();
    };

    const intervalId = window.setInterval(
      refreshSoon,
      HOME_FEED_REFRESH_INTERVAL_MS
    );

    window.addEventListener('focus', refreshSoon);

    return () => {
      canceled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshSoon);
    };
  }, [activeTab, clearHomeBadge, data]);

  const handleLoadMore = async (): Promise<void> => {
    if (!cursor || loadingMore) return;

    setLoadingMore(true);

    try {
      const nextPage = await getHomeFeedPage(activeTab, cursor);

      setCursor(nextPage.cursor);
      setFeed((currentFeed) => mergeTweets(currentFeed, nextPage.tweets));
    } finally {
      setLoadingMore(false);
    }
  };

  const loading = !data && !error;
  const loadMoreInView = (): void => {
    void handleLoadMore();
  };

  const toggleTimelineSettings = (): void =>
    setTimelineSettingsOpen((open) => !open);

  const switchToLatestTweets = (): void => {
    setActiveTab('following');
    setTimelineSettingsOpen(false);
  };

  const showNewTweets = (): void => {
    const pendingTweets = newTweetsRef.current;

    if (!pendingTweets.length) return;

    setFeed((currentFeed) => {
      const nextFeed = prependTweets(currentFeed, pendingTweets);
      if (activeTab === 'following') clearHomeBadge(nextFeed[0]?.id ?? null);
      return nextFeed;
    });
    setNewTweets([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <MainContainer
      className='relative before:pointer-events-none before:absolute before:inset-y-0 before:right-0
                 before:z-30 before:hidden before:w-px before:bg-light-border before:content-[""]
                 dark:before:bg-dark-border xs:before:block'
    >
      <SEO title='Home / Not Twitter' />
      <UpdateUsername />
      <header className='hover-animation sticky top-0 z-20 bg-main-background/80 backdrop-blur-md'>
        <div className='flex h-[53px] items-center justify-between px-4'>
          <div className='flex min-w-0 items-center gap-8'>
            <MobileSidebar />
            <h2 className='truncate text-xl font-bold'>Home</h2>
          </div>
          <div className='relative flex items-center gap-1'>
            <Button
              className='dark-bg-tab group relative p-2 hover:bg-light-primary/10 active:bg-light-primary/20
                         dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
              aria-label='Top Tweets'
              onClick={toggleTimelineSettings}
            >
              <HeroIcon className='h-5 w-5' iconName='SparklesIcon' />
              <ToolTip tip='Top Tweets' />
            </Button>
            <AnimatePresence>
              {timelineSettingsOpen && (
                <motion.div
                  className='menu-container absolute right-0 top-11 z-20 w-[320px] overflow-hidden py-2'
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12, ease: 'easeOut' }}
                >
                  <div className='px-4 py-3'>
                    <p className='text-xl font-extrabold'>
                      Home shows you top Tweets first
                    </p>
                    <p className='mt-1 text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
                      Tweets you&apos;re likely to care about most will show up
                      first in your timeline.
                    </p>
                  </div>
                  <Button
                    className='accent-tab flex w-full items-center gap-3 rounded-none px-4 py-3
                               text-left hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'
                    onClick={switchToLatestTweets}
                  >
                    <HeroIcon className='h-6 w-6' iconName='ArrowPathIcon' />
                    <div>
                      <p className='font-bold'>See latest Tweets instead</p>
                      <p className='text-sm text-light-secondary dark:text-dark-secondary'>
                        Show Tweets as they happen.
                      </p>
                    </div>
                  </Button>
                  <Button
                    className='accent-tab flex w-full cursor-not-allowed items-center gap-3 rounded-none px-4 py-3
                               text-left opacity-60 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'
                    disabled
                  >
                    <HeroIcon className='h-6 w-6' iconName='Cog6ToothIcon' />
                    <p className='font-bold'>View content preferences</p>
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <HomeTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          subscribedFeeds={subscribedFeeds}
        />
        <AnimatePresence>
          {newTweets.length > 0 && (
            <motion.div
              className='border-b border-light-border bg-main-background/95 backdrop-blur-md
                         dark:border-dark-border'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              <Button
                className='hover-card flex h-12 w-full items-center justify-center rounded-none
                           text-[15px] text-main-accent'
                onClick={showNewTweets}
              >
                Show {newTweets.length} Tweet
                {newTweets.length === 1 ? '' : 's'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
      {!isMobile && <Input />}
      <section className='mt-0.5 xs:mt-0'>
        {loading ? (
          <Loading className='mt-5' />
        ) : error ? (
          <Error message='Something went wrong' />
        ) : !feed.length ? (
          <p className='border-b border-light-border px-4 py-8 text-center text-light-secondary dark:border-dark-border dark:text-dark-secondary'>
            No posts found in this timeline.
          </p>
        ) : (
          <>
            <AnimatePresence>
              {feed.map((tweet) => (
                <Tweet {...tweet} key={tweet.id} />
              ))}
            </AnimatePresence>
            {cursor && (
              <motion.div
                className='border-b border-light-border dark:border-dark-border'
                viewport={{ margin: '0px 0px 1000px' }}
                onViewportEnter={loadMoreInView}
              >
                <Loading className='mt-5' />
              </motion.div>
            )}
          </>
        )}
      </section>
    </MainContainer>
  );
}

Home.getLayout = (page: ReactElement): ReactNode => (
  <ProtectedLayout>
    <MainLayout>
      <HomeLayout>{page}</HomeLayout>
    </MainLayout>
  </ProtectedLayout>
);

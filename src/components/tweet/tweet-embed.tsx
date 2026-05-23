import { useRouter } from 'next/router';
import cn from 'clsx';
import { formatDate } from '@lib/date';
import { getTweetPath } from '@lib/routes';
import { createYouTubeCardFromText, getYouTubeVideoInfo } from '@lib/youtube';
import { ImagePreview } from '@components/input/image-preview';
import { CustomIcon } from '@components/ui/custom-icon';
import { HeroIcon } from '@components/ui/hero-icon';
import { NextImage } from '@components/ui/next-image';
import { TweetText } from './tweet-text';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import type { EmbeddedTweet, TweetCard } from '@lib/types/tweet';
import type { YouTubeVideoInfo } from '@lib/youtube';

type TweetEmbedProps = {
  card: TweetCard | null;
  quotedTweet: EmbeddedTweet | null;
  viewTweet?: boolean;
  hideQuotedTweetMedia?: boolean;
};

type LinkCardProps = {
  card: TweetCard;
  compact?: boolean;
};

type CardEvent = MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;

function stopOuterTweet(event: CardEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

function onEnterOrSpace(
  callback: (event: KeyboardEvent<HTMLElement>) => void
): (event: KeyboardEvent<HTMLElement>) => void {
  return (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    callback(event);
  };
}

function CardShell({
  children,
  className,
  onClick,
  onKeyDown,
  ariaLabel
}: {
  children: ReactNode;
  className?: string;
  onClick: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  ariaLabel: string;
}): JSX.Element {
  return (
    <div
      className={cn(
        `group mt-2 block min-w-0 max-w-full cursor-pointer overflow-hidden rounded-2xl border
         border-light-border text-left outline-none transition-colors
         hover:bg-light-primary/5 focus-visible:ring-2 focus-visible:ring-main-accent
         dark:border-dark-border dark:hover:bg-dark-primary/5`,
        className
      )}
      role='link'
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}

function getCardTitle(card: TweetCard): string {
  return card.title ? card.title : card.url;
}

function getCardDescription(card: TweetCard): string | null {
  return card.description;
}

function LinkCardImage({ card, compact }: LinkCardProps): JSX.Element | null {
  if (!card.image && !compact) return null;

  if (!card.image)
    return (
      <div className='dark:bg-dark-hover flex h-full w-[94px] shrink-0 items-center justify-center bg-light-line-reply text-light-secondary dark:text-dark-secondary'>
        <HeroIcon className='h-7 w-7' iconName='LinkIcon' />
      </div>
    );

  if (compact)
    return (
      <div className='dark:bg-dark-hover relative h-full w-[94px] shrink-0 bg-light-line-reply'>
        <NextImage
          className='absolute inset-0'
          imgClassName='object-cover'
          layout='fill'
          src={card.image}
          alt=''
          useSkeleton
        />
      </div>
    );

  return (
    <div className='dark:bg-dark-hover relative w-full overflow-hidden bg-light-line-reply pt-[52.35%]'>
      <NextImage
        className='absolute inset-0'
        imgClassName='object-cover'
        layout='fill'
        src={card.image}
        alt=''
        useSkeleton
      />
    </div>
  );
}

function TweetYouTubeCard({
  card,
  video
}: {
  card: TweetCard;
  video: YouTubeVideoInfo;
}): JSX.Element {
  const title = getCardTitle(card);
  const openCard = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    window.open(video.url, '_blank', 'noopener,noreferrer');
  };
  const stopEmbedEvent = (
    event: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>
  ): void => event.stopPropagation();

  return (
    <div
      className='mt-2 overflow-hidden rounded-2xl border border-light-border bg-main-background
                 text-left dark:border-dark-border'
      onClick={stopEmbedEvent}
      onKeyDown={stopEmbedEvent}
    >
      <div className='relative bg-black pt-[56.25%]'>
        <iframe
          className='absolute inset-0 h-full w-full'
          src={video.embedUrl}
          title={title}
          allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
          allowFullScreen
          loading='lazy'
          referrerPolicy='strict-origin-when-cross-origin'
        />
      </div>
      <button
        className='flex w-full min-w-0 flex-col border-t border-light-border px-3 py-2.5
                   text-left transition-colors hover:bg-light-primary/[0.03]
                   focus-visible:bg-light-primary/[0.03] focus-visible:outline-none
                   dark:border-dark-border dark:hover:bg-dark-primary/[0.03]
                   dark:focus-visible:bg-dark-primary/[0.03]'
        type='button'
        aria-label={`Open ${title} on YouTube`}
        onClick={openCard}
      >
        <span className='truncate text-[13px] leading-4 text-light-secondary dark:text-dark-secondary'>
          {card.domain ?? video.domain}
        </span>
        <span className='line-clamp-2 text-[15px] leading-5 text-light-primary dark:text-dark-primary'>
          {title}
        </span>
      </button>
    </div>
  );
}

function TweetLinkCard({ card, compact }: LinkCardProps): JSX.Element {
  const router = useRouter();
  const title = getCardTitle(card);
  const description = getCardDescription(card);
  const youtubeVideo = getYouTubeVideoInfo(card.url);
  const isCompact = compact === true || card.type === 'summary' || !card.image;
  const openCard = (event: CardEvent): void => {
    stopOuterTweet(event);

    if (card.url.startsWith('/')) {
      void router.push(card.url);
      return;
    }

    window.open(card.url, '_blank', 'noopener,noreferrer');
  };

  if (youtubeVideo && compact !== true)
    return <TweetYouTubeCard card={card} video={youtubeVideo} />;

  if (isCompact)
    return (
      <CardShell
        className='min-h-[112px]'
        ariaLabel={title}
        onClick={openCard}
        onKeyDown={onEnterOrSpace(openCard)}
      >
        <div className='flex h-full min-h-[112px] min-w-0 max-w-full'>
          <LinkCardImage card={card} compact />
          <div className='flex min-w-0 flex-1 flex-col justify-center px-3 py-2'>
            <p className='truncate text-sm text-light-secondary dark:text-dark-secondary'>
              {card.domain ?? card.url}
            </p>
            <p className='truncate text-[15px] text-light-primary dark:text-dark-primary'>
              {title}
            </p>
            {description && (
              <p className='line-clamp-2 text-sm text-light-secondary dark:text-dark-secondary'>
                {description}
              </p>
            )}
          </div>
        </div>
      </CardShell>
    );

  return (
    <CardShell
      ariaLabel={title}
      onClick={openCard}
      onKeyDown={onEnterOrSpace(openCard)}
    >
      <LinkCardImage card={card} />
      <div className='min-w-0 px-3 py-2'>
        <p className='truncate text-sm text-light-secondary dark:text-dark-secondary'>
          {card.domain ?? card.url}
        </p>
        <p className='truncate text-[15px] text-light-primary dark:text-dark-primary'>
          {title}
        </p>
        {description && (
          <p className='line-clamp-2 text-sm text-light-secondary dark:text-dark-secondary'>
            {description}
          </p>
        )}
      </div>
    </CardShell>
  );
}

function TweetUnavailableCard({
  quotedTweet
}: {
  quotedTweet: EmbeddedTweet;
}): JSX.Element {
  const message =
    quotedTweet.unavailable === 'blocked'
      ? 'This Tweet is from an account you blocked.'
      : 'This Tweet is unavailable.';

  return (
    <div
      className='mt-2 rounded-2xl border border-light-border px-3 py-4 text-[15px]
                 text-light-secondary dark:border-dark-border dark:text-dark-secondary'
    >
      {message}
    </div>
  );
}

function QuotedTweetCard({
  quotedTweet,
  viewTweet,
  hideMedia
}: {
  quotedTweet: EmbeddedTweet;
  viewTweet?: boolean;
  hideMedia?: boolean;
}): JSX.Element {
  const router = useRouter();

  if (quotedTweet.unavailable)
    return <TweetUnavailableCard quotedTweet={quotedTweet} />;

  const quotedTweetCard = hideMedia
    ? null
    : quotedTweet.card ?? createYouTubeCardFromText(quotedTweet.text);
  const tweetHref = quotedTweet.id
    ? getTweetPath(quotedTweet.id, quotedTweet.authorUsername)
    : null;
  const openTweet = (event: CardEvent): void => {
    stopOuterTweet(event);
    if (tweetHref) void router.push(tweetHref);
  };

  return (
    <CardShell
      className={cn(viewTweet && 'mt-3')}
      ariaLabel={`Tweet by ${quotedTweet.authorName ?? 'unknown user'}`}
      onClick={openTweet}
      onKeyDown={onEnterOrSpace(openTweet)}
    >
      <div className='min-w-0 px-3 py-2'>
        <div className='flex min-w-0 items-center gap-1 text-[15px]'>
          {quotedTweet.authorAvatar && (
            <NextImage
              className='mr-1 shrink-0'
              imgClassName='rounded-full'
              width={20}
              height={20}
              src={quotedTweet.authorAvatar}
              alt={quotedTweet.authorName ?? 'User avatar'}
              useSkeleton
            />
          )}
          <span className='truncate font-bold text-light-primary dark:text-dark-primary'>
            {quotedTweet.authorName}
          </span>
          {quotedTweet.authorVerified && (
            <CustomIcon
              className='h-4 w-4 shrink-0'
              iconName='TwitterVerifiedIcon'
            />
          )}
          {quotedTweet.authorUsername && (
            <span className='truncate text-light-secondary dark:text-dark-secondary'>
              @{quotedTweet.authorUsername}
            </span>
          )}
          {quotedTweet.createdAt && (
            <>
              <span className='shrink-0 text-light-secondary dark:text-dark-secondary'>
                ·
              </span>
              <span className='shrink-0 text-light-secondary dark:text-dark-secondary'>
                {formatDate(quotedTweet.createdAt, 'tweet')}
              </span>
            </>
          )}
        </div>
        {quotedTweet.text && (
          <TweetText
            className='mt-1 text-[15px] text-light-primary dark:text-dark-primary'
            text={quotedTweet.text}
          />
        )}
        {!hideMedia && quotedTweet.images && (
          <ImagePreview
            tweet
            imagesPreview={quotedTweet.images}
            previewCount={quotedTweet.images.length}
          />
        )}
        {quotedTweetCard && <TweetLinkCard card={quotedTweetCard} compact />}
      </div>
    </CardShell>
  );
}

export function TweetEmbed({
  card,
  quotedTweet,
  viewTweet,
  hideQuotedTweetMedia
}: TweetEmbedProps): JSX.Element | null {
  if (!card && !quotedTweet) return null;

  return (
    <>
      {card && <TweetLinkCard card={card} />}
      {quotedTweet && (
        <QuotedTweetCard
          quotedTweet={quotedTweet}
          viewTweet={viewTweet}
          hideMedia={hideQuotedTweetMedia}
        />
      )}
    </>
  );
}

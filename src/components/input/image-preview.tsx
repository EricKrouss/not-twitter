/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import cn from 'clsx';
import { useModal } from '@lib/hooks/useModal';
import { preventBubbling } from '@lib/utils';
import { ImageModal } from '@components/modal/image-modal';
import { Modal } from '@components/modal/modal';
import { NextImage } from '@components/ui/next-image';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { ToolTip } from '@components/ui/tooltip';
import { TwitterVideoPlayer } from '@components/ui/twitter-video-player';
import type { MotionProps } from 'framer-motion';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { ImagesPreview, ImageData } from '@lib/types/file';
import type { TweetMediaWarning, TweetWithUser } from '@lib/types/tweet';

type ImagePreviewProps = {
  tweet?: boolean;
  viewTweet?: boolean;
  previewCount: number;
  imagesPreview: ImagesPreview;
  moderationWarning?: TweetMediaWarning | null;
  tweetData?: TweetWithUser;
  removeImage?: (targetId: string) => () => void;
};

const variants: MotionProps = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.15, ease: 'easeOut' }
  },
  exit: { opacity: 0, transition: { duration: 0.1, ease: 'easeOut' } }
};

type PostImageBorderRadius = Record<number, string[]>;

const postImageBorderRadius: Readonly<PostImageBorderRadius> = {
  1: ['rounded-2xl'],
  2: ['rounded-tl-2xl rounded-bl-2xl', 'rounded-tr-2xl rounded-br-2xl'],
  3: ['rounded-tl-2xl rounded-bl-2xl', 'rounded-tr-2xl', 'rounded-br-2xl'],
  4: ['rounded-tl-2xl', 'rounded-tr-2xl', 'rounded-bl-2xl', 'rounded-br-2xl']
};

const DEFAULT_TWEET_MEDIA_RATIO = 16 / 9;
const MIN_SINGLE_TWEET_MEDIA_RATIO = 4 / 5;
const MAX_SINGLE_TWEET_MEDIA_RATIO = 16 / 9;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isGifMedia({ src, type }: ImageData): boolean {
  return type === 'gif' || !!type?.includes('gif') || /\.gif($|\?)/i.test(src);
}

function isVideoMedia({ src, type }: ImageData): boolean {
  return (
    !!type?.includes('video') || /\.(m3u8|mp4|mov|m4v|webm)($|\?)/i.test(src)
  );
}

function getSingleGifStyle(
  media: ImageData | undefined
): CSSProperties | undefined {
  if (!media || !isGifMedia(media)) return undefined;

  const { aspectRatio } = media;
  const width =
    aspectRatio?.width && aspectRatio.width > 0 ? aspectRatio.width : 16;
  const height =
    aspectRatio?.height && aspectRatio.height > 0 ? aspectRatio.height : 9;

  return { aspectRatio: `${width} / ${height}` };
}

function getMediaRatio(media: ImageData | undefined): number {
  if (!media) return DEFAULT_TWEET_MEDIA_RATIO;

  const width = media.aspectRatio?.width;
  const height = media.aspectRatio?.height;

  if (!width || !height || width <= 0 || height <= 0)
    return DEFAULT_TWEET_MEDIA_RATIO;

  return width / height;
}

function getTweetMediaStyle({
  isTweet,
  previewCount,
  media
}: {
  isTweet: boolean | undefined;
  previewCount: number;
  media: ImageData | undefined;
}): CSSProperties | undefined {
  if (previewCount !== 1) return undefined;

  if (!isTweet) return getSingleGifStyle(media);

  const clampedRatio = clampNumber(
    getMediaRatio(media),
    MIN_SINGLE_TWEET_MEDIA_RATIO,
    MAX_SINGLE_TWEET_MEDIA_RATIO
  );

  return { aspectRatio: `${clampedRatio} / 1` };
}

function TwitterGifIcon({ playing }: { playing: boolean }): JSX.Element {
  return (
    <svg
      className='h-7 w-7 fill-current'
      viewBox='0 0 24 24'
      aria-hidden='true'
    >
      {playing ? (
        <path d='M7 5h3v14H7V5zm7 0h3v14h-3V5z' />
      ) : (
        <path d='M8 5v14l11-7L8 5z' />
      )}
    </svg>
  );
}

function TwitterGifMedia({
  media,
  className
}: {
  media: ImageData;
  className?: string;
}): JSX.Element {
  const [playing, setPlaying] = useState(true);
  const [animationKey, setAnimationKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoSource = isVideoMedia(media);
  const label = playing ? 'Pause this GIF' : 'Play this GIF';

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (playing) void video.play().catch(() => undefined);
    else video.pause();
  }, [playing]);

  const togglePlayback = (): void => {
    setPlaying((currentPlaying) => {
      const nextPlaying = !currentPlaying;

      if (nextPlaying && !videoSource) setAnimationKey((key) => key + 1);
      return nextPlaying;
    });
  };

  return (
    <div
      className={cn(
        'group/gif relative h-full w-full overflow-hidden bg-black text-white outline-none',
        className
      )}
      role='button'
      tabIndex={0}
      aria-label={label}
      data-testid='playButton'
      onClick={preventBubbling(togglePlayback)}
      onKeyDown={(event): void => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          togglePlayback();
        }
      }}
    >
      {videoSource ? (
        <video
          ref={videoRef}
          className='h-full w-full object-cover object-center'
          src={media.src}
          poster={media.poster ?? undefined}
          autoPlay
          loop
          muted
          playsInline
        />
      ) : (
        <img
          className='h-full w-full object-cover object-center'
          src={playing ? media.src : media.poster ?? media.src}
          alt={media.alt}
          key={`${media.src}-${animationKey}-${playing ? 'playing' : 'paused'}`}
          draggable={false}
        />
      )}
      <span
        className='absolute bottom-2 left-2 rounded-sm bg-black/75 px-1.5 py-0.5
                   text-[11px] font-bold leading-4 tracking-[0.02em] text-white'
      >
        GIF
      </span>
      <span
        className={cn(
          `bg-black/45 group-hover/gif:bg-black/55 absolute left-1/2 top-1/2 flex h-16 w-16
           -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white
           backdrop-blur-[1px] transition duration-150 group-focus-visible/gif:ring-2
           group-focus-visible/gif:ring-white/80`,
          playing
            ? 'opacity-0 group-hover/gif:opacity-100 group-focus-visible/gif:opacity-100'
            : 'opacity-100'
        )}
        aria-hidden='true'
      >
        <TwitterGifIcon playing={playing} />
      </span>
    </div>
  );
}

export function ImagePreview({
  tweet,
  viewTweet,
  previewCount,
  imagesPreview,
  moderationWarning,
  tweetData,
  removeImage
}: ImagePreviewProps): JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [warningRevealed, setWarningRevealed] = useState(false);

  const { open, openModal, closeModal } = useModal();

  useEffect(() => {
    const imageData = imagesPreview[selectedIndex];
    setSelectedImage(imageData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  useEffect(() => {
    setWarningRevealed(false);
  }, [moderationWarning?.label, imagesPreview]);

  const handleSelectedImage = (index: number) => () => {
    setSelectedImage(imagesPreview[index]);
    setSelectedIndex(index);
    openModal();
  };

  const handleNextIndex = (type: 'prev' | 'next') => () => {
    const mediaCount =
      imagesPreview.length > 0 ? imagesPreview.length : previewCount;
    const nextIndex =
      type === 'prev'
        ? selectedIndex === 0
          ? mediaCount - 1
          : selectedIndex - 1
        : selectedIndex === mediaCount - 1
        ? 0
        : selectedIndex + 1;

    setSelectedImage(imagesPreview[nextIndex]);
    setSelectedIndex(nextIndex);
  };

  const isTweet = tweet ?? viewTweet;
  const mediaCount =
    imagesPreview.length > 0 ? imagesPreview.length : previewCount;
  const visibleMedia = imagesPreview.slice(0, 4);
  const visiblePreviewCount = Math.min(mediaCount, 4);
  const firstMedia = imagesPreview[0];
  const singleMedia = visiblePreviewCount === 1;
  const tweetMediaStyle = getTweetMediaStyle({
    isTweet,
    previewCount: visiblePreviewCount,
    media: firstMedia
  });
  const singleGif = singleMedia && !!firstMedia && isGifMedia(firstMedia);
  const draftSingleGif = singleGif && !isTweet;
  const currentImage = selectedImage ?? imagesPreview[selectedIndex];
  const shouldWarnMedia = !!moderationWarning && !warningRevealed;

  return (
    <div
      className={cn(
        'relative grid rounded-2xl',
        singleMedia ? 'grid-cols-1 grid-rows-1' : 'grid-cols-2 grid-rows-2',
        isTweet
          ? `dark:bg-dark-hover mt-2 w-full overflow-hidden border border-light-border
             bg-light-line-reply dark:border-dark-border`
          : draftSingleGif
          ? 'mt-2 w-full overflow-hidden border border-light-border dark:border-dark-border'
          : 'h-[42vw] gap-3 xs:h-[37vw] md:h-[271px]',
        isTweet && singleMedia && 'max-h-[510px] min-h-[188px]',
        isTweet &&
          !singleMedia &&
          (viewTweet
            ? 'aspect-[16/9] max-h-[420px] min-h-[190px]'
            : 'aspect-[16/9] max-h-[285px] min-h-[180px]'),
        !isTweet && draftSingleGif && 'max-h-[510px] min-h-[188px] gap-0',
        isTweet && 'gap-0.5'
      )}
      style={tweetMediaStyle}
    >
      <Modal
        modalClassName={cn(
          tweetData
            ? 'relative flex h-screen w-screen items-stretch overflow-hidden bg-black text-white'
            : 'flex justify-center w-full items-center relative',
          isTweet && !tweetData && 'h-full'
        )}
        className={tweetData ? '!overflow-hidden !p-0' : undefined}
        open={open}
        closeModal={closeModal}
        closePanelOnClick
      >
        <ImageModal
          tweet={isTweet}
          imageData={currentImage as ImageData}
          previewCount={mediaCount}
          tweetData={tweetData}
          selectedIndex={selectedIndex}
          handleNextIndex={handleNextIndex}
          closeModal={closeModal}
        />
      </Modal>
      <AnimatePresence>
        {visibleMedia.map((media, index) => {
          const { id, src, alt, poster, viewCount } = media;
          const isGif = isGifMedia(media);
          const isVideo = isVideoMedia(media) && !isGif;
          const imageRadius = isTweet
            ? postImageBorderRadius[visiblePreviewCount][index]
            : 'rounded-2xl';
          const shouldCropImage = Boolean(isTweet) || visiblePreviewCount > 1;
          const mediaKey = `${id ?? src}-${index}`;
          const openPreview = handleSelectedImage(index);
          const handlePreviewKeyDown = (
            event: KeyboardEvent<HTMLDivElement>
          ): void => {
            if (event.key !== 'Enter' && event.key !== ' ') return;

            event.preventDefault();
            event.stopPropagation();
            openPreview();
          };

          return (
            <motion.div
              className={cn(
                'accent-tab group relative overflow-hidden transition-shadow',
                imageRadius,
                shouldWarnMedia &&
                  'pointer-events-none scale-[1.02] blur-lg brightness-75',
                {
                  'col-span-1 row-span-1': visiblePreviewCount === 1,
                  'row-span-2':
                    visiblePreviewCount === 2 ||
                    (index === 0 && visiblePreviewCount === 3)
                }
              )}
              role={shouldWarnMedia || isGif ? undefined : 'button'}
              tabIndex={shouldWarnMedia || isGif ? undefined : 0}
              aria-label={isGif ? undefined : `Open image ${index + 1}`}
              {...variants}
              onClick={isGif ? preventBubbling() : preventBubbling(openPreview)}
              onKeyDown={isGif ? undefined : handlePreviewKeyDown}
              key={mediaKey}
            >
              {isGif ? (
                <TwitterGifMedia media={media} className={imageRadius} />
              ) : isVideo ? (
                <>
                  <Button
                    className='visible absolute top-0 right-0 z-10 -translate-x-1 translate-y-1 
                               bg-light-primary/75 p-1 opacity-0 backdrop-blur-sm transition
                               hover:bg-image-preview-hover/75 group-hover:opacity-100 xs:invisible'
                    onClick={preventBubbling(handleSelectedImage(index))}
                  >
                    <HeroIcon className='h-5 w-5' iconName='ArrowUpRightIcon' />
                  </Button>
                  <TwitterVideoPlayer
                    className={imageRadius}
                    videoClassName='object-center'
                    src={src}
                    poster={poster ?? undefined}
                    muted={!isTweet}
                    compact={!isTweet || visiblePreviewCount > 1}
                    viewCount={viewCount}
                  />
                </>
              ) : (
                <NextImage
                  className='relative h-full w-full cursor-pointer transition-colors duration-200'
                  imgClassName={cn(
                    imageRadius,
                    shouldCropImage && 'object-cover object-center'
                  )}
                  previewCount={
                    shouldCropImage ? undefined : visiblePreviewCount
                  }
                  layout='fill'
                  src={src}
                  alt={alt}
                  useSkeleton={isTweet}
                />
              )}
              {removeImage && (
                <Button
                  className={cn(
                    `group absolute top-0 left-0 translate-x-1 translate-y-1
                     bg-light-primary/75 p-1 backdrop-blur-sm hover:bg-image-preview-hover/75`,
                    draftSingleGif &&
                      `active:bg-black/85 translate-x-2 translate-y-2 bg-black/60 text-white
                       hover:bg-black/75`
                  )}
                  onClick={preventBubbling(removeImage(id))}
                >
                  <HeroIcon
                    className='h-5 w-5 text-white'
                    iconName='XMarkIcon'
                  />
                  <ToolTip className='translate-y-2' tip='Remove' />
                </Button>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
      {shouldWarnMedia && (
        <div
          className='absolute inset-0 z-20 flex items-center justify-center bg-black/30
                     px-6 text-center text-white'
          onClick={preventBubbling(null, true)}
        >
          <div className='max-w-[285px]'>
            <HeroIcon
              className='mx-auto mb-2 h-6 w-6 text-white/90 drop-shadow-sm'
              iconName='EyeSlashIcon'
            />
            <p className='text-[14px] font-bold leading-5 text-white drop-shadow-sm'>
              Content warning: Sensitive content
            </p>
            <p className='mt-1 text-[13px] leading-5 text-white/80 drop-shadow-sm'>
              {moderationWarning.description}
            </p>
            {!moderationWarning.noOverride && (
              <button
                className='mt-2 text-[13px] font-bold leading-5 text-white underline-offset-2
                           hover:underline focus-visible:outline focus-visible:outline-2
                           focus-visible:outline-offset-2 focus-visible:outline-white/80'
                onClick={preventBubbling(() => setWarningRevealed(true))}
                type='button'
              >
                View
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

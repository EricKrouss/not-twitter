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
import type { CSSProperties } from 'react';
import type { ImagesPreview, ImageData } from '@lib/types/file';
import type { TweetWithUser } from '@lib/types/tweet';

type ImagePreviewProps = {
  tweet?: boolean;
  viewTweet?: boolean;
  previewCount: number;
  imagesPreview: ImagesPreview;
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
          className='h-full w-full object-cover'
          src={media.src}
          poster={media.poster ?? undefined}
          autoPlay
          loop
          muted
          playsInline
        />
      ) : (
        <img
          className='h-full w-full object-cover'
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
  tweetData,
  removeImage
}: ImagePreviewProps): JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);

  const { open, openModal, closeModal } = useModal();

  useEffect(() => {
    const imageData = imagesPreview[selectedIndex];
    setSelectedImage(imageData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  const handleSelectedImage = (index: number) => () => {
    setSelectedImage(imagesPreview[index]);
    setSelectedIndex(index);
    openModal();
  };

  const handleNextIndex = (type: 'prev' | 'next') => () => {
    const nextIndex =
      type === 'prev'
        ? selectedIndex === 0
          ? previewCount - 1
          : selectedIndex - 1
        : selectedIndex === previewCount - 1
        ? 0
        : selectedIndex + 1;

    setSelectedImage(imagesPreview[nextIndex]);
    setSelectedIndex(nextIndex);
  };

  const isTweet = tweet ?? viewTweet;
  const singleGifStyle =
    previewCount === 1 ? getSingleGifStyle(imagesPreview[0]) : undefined;
  const singleGif = !!singleGifStyle;
  const draftSingleGif = singleGif && !isTweet;
  const currentImage = selectedImage ?? imagesPreview[selectedIndex];

  return (
    <div
      className={cn(
        'grid rounded-2xl',
        draftSingleGif
          ? 'mt-2 grid-cols-1 grid-rows-1 overflow-hidden border border-light-border dark:border-dark-border'
          : 'grid-cols-2 grid-rows-2',
        singleGif
          ? 'max-h-[510px] min-h-[188px] w-full'
          : viewTweet
          ? 'h-[51vw] xs:h-[42vw] md:h-[305px]'
          : 'h-[42vw] xs:h-[37vw] md:h-[271px]',
        isTweet ? 'mt-2 gap-0.5' : draftSingleGif ? 'gap-0' : 'gap-3'
      )}
      style={singleGifStyle}
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
          previewCount={previewCount}
          tweetData={tweetData}
          selectedIndex={selectedIndex}
          handleNextIndex={handleNextIndex}
          closeModal={closeModal}
        />
      </Modal>
      <AnimatePresence>
        {imagesPreview.map((media, index) => {
          const { id, src, alt, poster, viewCount } = media;
          const isGif = isGifMedia(media);
          const isVideo = isVideoMedia(media) && !isGif;
          const imageRadius = isTweet
            ? postImageBorderRadius[previewCount][index]
            : 'rounded-2xl';

          return (
            <motion.button
              type='button'
              className={cn(
                'accent-tab group relative overflow-hidden transition-shadow',
                imageRadius,
                {
                  'col-span-2 row-span-2': previewCount === 1,
                  'row-span-2':
                    previewCount === 2 || (index === 0 && previewCount === 3)
                }
              )}
              {...variants}
              onClick={
                isGif
                  ? preventBubbling()
                  : preventBubbling(handleSelectedImage(index))
              }
              key={id}
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
                    src={src}
                    poster={poster ?? undefined}
                    muted={!isTweet}
                    compact={!isTweet || previewCount > 1}
                    viewCount={viewCount}
                  />
                </>
              ) : (
                <NextImage
                  className='relative h-full w-full cursor-pointer transition-colors duration-200'
                  imgClassName={cn(imageRadius)}
                  previewCount={previewCount}
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
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

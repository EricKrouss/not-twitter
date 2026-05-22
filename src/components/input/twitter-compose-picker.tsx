/* eslint-disable @next/next/no-img-element */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import cn from 'clsx';
import { Button } from '@components/ui/button';
import { CustomIcon } from '@components/ui/custom-icon';
import type { CSSProperties, ChangeEvent } from 'react';

export type ComposePickerType = 'gif' | 'emoji';

export type GifSelection = {
  id: string;
  title: string;
  src: string;
  preview: string;
  aspectRatio?: {
    width: number;
    height: number;
  } | null;
};

type TwitterComposePickerProps = {
  type: ComposePickerType;
  placement: 'above' | 'below';
  anchorElement?: HTMLElement | null;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  onSelectGif: (gif: GifSelection) => void;
};

type TenorGif = {
  id: string;
  title?: string;
  content_description?: string;
  media: {
    tinygif?: {
      url: string;
      preview: string;
      dims?: [number, number];
    };
    gif?: {
      url: string;
      preview: string;
      dims?: [number, number];
    };
  }[];
};

type TenorResponse = {
  results: TenorGif[];
};

type EmojiSection = {
  title: string;
  emojis: readonly string[];
};

type FilteredEmojiSection = {
  title: string;
  emojis: string[];
};

type FoundMediaCategory = {
  label: string;
  searchTerm: string;
};

type FoundMediaCategoryTile = FoundMediaCategory & {
  image: string | null;
};

const pickerViewportMargin = 12;
const emojiPickerWidth = 350;
const emojiPickerHeight = 427;
const pickerOffset = 12;

const tenorApiKey = process.env.NEXT_PUBLIC_TENOR_API_KEY ?? 'LIVDSRZULELA';

const foundMediaCategories: readonly FoundMediaCategory[] = [
  { label: 'Agree', searchTerm: 'agree' },
  { label: 'Applause', searchTerm: 'applause' },
  { label: 'Aww', searchTerm: 'aww' },
  { label: 'Dance', searchTerm: 'dance' },
  { label: 'Deal with it', searchTerm: 'deal with it' },
  { label: 'Do not want', searchTerm: 'do not want' },
  { label: 'Eww', searchTerm: 'eww' },
  { label: "Can't believe it", searchTerm: "can't believe it" },
  { label: 'Shocked', searchTerm: 'shocked' },
  { label: 'Fist bump', searchTerm: 'fist bump' },
  { label: 'You got this', searchTerm: 'you got this' },
  { label: 'Happy dance', searchTerm: 'happy dance' },
  { label: 'Love', searchTerm: 'love' },
  { label: 'High five', searchTerm: 'high five' },
  { label: 'Hug', searchTerm: 'hug' },
  { label: "I don't know", searchTerm: "i don't know" },
  { label: 'Kiss', searchTerm: 'kiss' },
  { label: 'Mic drop', searchTerm: 'mic drop' },
  { label: 'No', searchTerm: 'no' },
  { label: 'Oh no', searchTerm: 'oh no' },
  { label: 'Okay', searchTerm: 'okay' },
  { label: 'Oops', searchTerm: 'oops' },
  { label: 'Please', searchTerm: 'please' },
  { label: 'Popcorn', searchTerm: 'popcorn' },
  { label: 'Seriously?', searchTerm: 'seriously' },
  { label: 'Scared', searchTerm: 'scared' },
  { label: 'Surprised', searchTerm: 'surprised' },
  { label: 'Sigh', searchTerm: 'sigh' },
  { label: 'Slow clap', searchTerm: 'slow clap' },
  { label: 'Sorry', searchTerm: 'sorry' },
  { label: 'Thank you', searchTerm: 'thank you' },
  { label: 'Thumbs down', searchTerm: 'thumbs down' },
  { label: 'Thumbs up', searchTerm: 'thumbs up' },
  { label: 'Want', searchTerm: 'want' },
  { label: 'Win', searchTerm: 'win' },
  { label: 'Wink', searchTerm: 'wink' },
  { label: 'YOLO', searchTerm: 'yolo' },
  { label: 'Yawn', searchTerm: 'yawn' },
  { label: 'Yes', searchTerm: 'yes' },
  { label: 'Way to go', searchTerm: 'way to go' }
] as const;

const emojiSections: readonly EmojiSection[] = [
  {
    title: 'Smileys & people',
    emojis: [
      '😀',
      '😃',
      '😄',
      '😁',
      '😆',
      '😅',
      '😂',
      '🤣',
      '😊',
      '😍',
      '😘',
      '😎',
      '🤔',
      '🙄',
      '😢',
      '😭',
      '😡',
      '👍',
      '👏',
      '🙏',
      '🔥',
      '✨',
      '💙',
      '🎉'
    ]
  },
  {
    title: 'Animals & nature',
    emojis: [
      '🐶',
      '🐱',
      '🐭',
      '🐹',
      '🐰',
      '🦊',
      '🐻',
      '🐼',
      '🐨',
      '🐯',
      '🦁',
      '🐮',
      '🌸',
      '🌻',
      '🌈',
      '⭐'
    ]
  },
  {
    title: 'Food & drink',
    emojis: [
      '🍏',
      '🍎',
      '🍓',
      '🍕',
      '🍔',
      '🍟',
      '🌮',
      '🍩',
      '🍪',
      '☕',
      '🍺',
      '🥂'
    ]
  },
  {
    title: 'Activities',
    emojis: ['⚽', '🏀', '🏈', '⚾', '🎮', '🎧', '🎤', '🎬', '🚗', '✈️', '🚀']
  }
] as const;

function getTwemojiCodepoint(emoji: string): string {
  return Array.from(emoji)
    .map((char) => char.codePointAt(0)?.toString(16))
    .filter((codepoint): codepoint is string => !!codepoint)
    .filter((codepoint) => codepoint !== 'fe0f')
    .join('-');
}

function Twemoji({ emoji }: { emoji: string }): JSX.Element {
  return (
    <img
      className='h-7 w-7'
      src={`https://abs.twimg.com/emoji/v2/svg/${getTwemojiCodepoint(
        emoji
      )}.svg`}
      alt={emoji}
      draggable={false}
    />
  );
}

function mapTenorGif(gif: TenorGif): GifSelection | null {
  const media = gif.media[0];
  const gifMedia = media?.gif ?? media?.tinygif;

  if (!gifMedia) return null;

  return {
    id: gif.id,
    title: gif.content_description ?? gif.title ?? 'GIF',
    src: gifMedia.url,
    preview: gifMedia.preview,
    aspectRatio: gifMedia.dims
      ? { width: gifMedia.dims[0], height: gifMedia.dims[1] }
      : null
  };
}

function GifPicker({
  onClose,
  onSelectGif
}: Pick<TwitterComposePickerProps, 'onClose' | 'onSelectGif'>): JSX.Element {
  const [searchValue, setSearchValue] = useState('');
  const [categoryTiles, setCategoryTiles] = useState<FoundMediaCategoryTile[]>(
    () =>
      foundMediaCategories.map((category) => ({
        ...category,
        image: null
      }))
  );
  const [results, setResults] = useState<GifSelection[]>([]);
  const [loading, setLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchQuery = searchValue.trim();
  const handleSearchChange = ({
    target: { value }
  }: ChangeEvent<HTMLInputElement>): void => setSearchValue(value);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const getCategoryTile = async (
      category: FoundMediaCategory
    ): Promise<FoundMediaCategoryTile> => {
      const params = new URLSearchParams({
        key: tenorApiKey,
        q: category.searchTerm,
        limit: '1',
        media_filter: 'minimal'
      }).toString();

      try {
        const response = await fetch(
          `https://g.tenor.com/v1/search?${params}`,
          {
            signal: controller.signal
          }
        );
        const { results } = (await response.json()) as TenorResponse;
        const gif = results.map(mapTenorGif).find(Boolean);

        return { ...category, image: gif?.src ?? gif?.preview ?? null };
      } catch {
        return { ...category, image: null };
      }
    };

    void Promise.all(foundMediaCategories.map(getCategoryTile)).then(
      (nextTiles) => {
        if (!controller.signal.aborted) setCategoryTiles(nextTiles);
      }
    );

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      setResults([]);
      return;
    }

    const controller = new AbortController();

    setLoading(true);

    const params = new URLSearchParams({
      key: tenorApiKey,
      q: searchQuery,
      limit: '45',
      media_filter: 'minimal'
    }).toString();

    void fetch(`https://g.tenor.com/v1/search?${params}`, {
      signal: controller.signal
    })
      .then((response) => response.json() as Promise<TenorResponse>)
      .then(({ results }) => {
        setResults(
          results.map(mapTenorGif).filter((gif): gif is GifSelection => !!gif)
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setResults([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [searchQuery]);

  const closeOrBack = (): void => {
    if (searchQuery) {
      setSearchValue('');
      return;
    }

    onClose();
  };

  const clearSearch = (): void => {
    setSearchValue('');
    searchInputRef.current?.focus();
  };

  return (
    <>
      <div className='flex h-10 items-center gap-2 bg-main-background px-2'>
        <Button
          className='accent-tab flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-0 text-main-accent
                     hover:bg-main-accent/10 active:bg-main-accent/20'
          onClick={closeOrBack}
          aria-label={searchQuery ? 'Back' : 'Close'}
          title={searchQuery ? 'Back' : 'Close'}
        >
          <CustomIcon
            className='h-5 w-5'
            iconName={searchQuery ? 'TwitterArrowLeftIcon' : 'TwitterCloseIcon'}
          />
        </Button>
        <label
          className='flex h-8 min-w-0 flex-1 items-center gap-2 rounded-full border border-main-accent
                     bg-main-background px-3 text-[14px] leading-none text-light-secondary
                     dark:text-dark-secondary'
        >
          <CustomIcon
            className='h-4 w-4 shrink-0'
            iconName='TwitterSearchIcon'
          />
          <input
            className='min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-light-secondary
                       dark:placeholder:text-dark-secondary'
            placeholder='Search GIFs'
            value={searchValue}
            onChange={handleSearchChange}
            ref={searchInputRef}
          />
          {searchQuery && (
            <Button
              className='accent-tab -mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full
                         bg-main-accent p-0 text-main-background hover:bg-main-accent/90
                         active:bg-main-accent/80 dark:text-dark-primary'
              onClick={clearSearch}
              aria-label='Clear search'
              title='Clear search'
            >
              <CustomIcon className='h-3 w-3' iconName='TwitterCloseIcon' />
            </Button>
          )}
        </label>
      </div>
      {searchQuery && (
        <div className='flex h-[30px] items-center justify-between bg-main-background px-2 text-[14px] text-light-secondary dark:text-dark-secondary'>
          <span>Autoplay GIFs</span>
          <span
            className='relative h-4 w-8 rounded-full bg-main-accent'
            aria-hidden='true'
          >
            <span className='absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-white' />
          </span>
        </div>
      )}
      <div
        className={cn(
          'overflow-y-auto overscroll-contain bg-main-background',
          searchQuery ? 'h-[488px]' : 'h-[520px]'
        )}
      >
        {!searchQuery ? (
          <div className='grid grid-cols-2 gap-0.5'>
            {categoryTiles.map((category, index) => {
              const selectCategory = (): void =>
                setSearchValue(category.searchTerm);

              return (
                <button
                  className='accent-tab group relative flex h-[130px] items-end overflow-hidden bg-main-search-background
                               p-2 text-left text-[17px] font-bold leading-5 text-white'
                  type='button'
                  onClick={selectCategory}
                  key={category.searchTerm}
                >
                  {category.image ? (
                    <img
                      className='absolute inset-0 h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-95'
                      src={category.image}
                      alt=''
                      draggable={false}
                    />
                  ) : (
                    <span
                      className={cn(
                        'absolute inset-0',
                        index % 5 === 0 &&
                          'bg-gradient-to-br from-accent-blue to-accent-purple',
                        index % 5 === 1 &&
                          'bg-gradient-to-br from-accent-orange to-accent-pink',
                        index % 5 === 2 &&
                          'bg-gradient-to-br from-accent-green to-accent-blue',
                        index % 5 === 3 &&
                          'bg-gradient-to-br from-accent-purple to-accent-pink',
                        index % 5 === 4 &&
                          'bg-gradient-to-br from-accent-yellow to-accent-orange'
                      )}
                    />
                  )}
                  <span className='absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent' />
                  <span className='relative z-10 drop-shadow'>
                    {category.label}
                  </span>
                </button>
              );
            })}
          </div>
        ) : loading ? (
          <div className='flex h-full items-center justify-center text-light-secondary dark:text-dark-secondary'>
            Loading GIFs
          </div>
        ) : results.length ? (
          <div className='columns-3 gap-1 [column-fill:_balance]'>
            {results.map((gif) => {
              const selectGif = (): void => onSelectGif(gif);
              const width = gif.aspectRatio?.width ?? 16;
              const height = gif.aspectRatio?.height ?? 9;

              return (
                <button
                  className='accent-tab group mb-1 block w-full break-inside-avoid overflow-hidden
                             bg-main-search-background'
                  type='button'
                  title={gif.title}
                  onClick={selectGif}
                  key={gif.id}
                  style={{ aspectRatio: `${width} / ${height}` }}
                >
                  <img
                    className='h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-95'
                    src={gif.src}
                    alt={gif.title}
                    draggable={false}
                  />
                </button>
              );
            })}
          </div>
        ) : (
          <div className='mx-auto flex h-full max-w-[320px] flex-col justify-center px-8'>
            <h3 className='text-[28px] font-extrabold leading-9'>
              No GIFs found
            </h3>
            <p className='mt-2 text-[15px] text-light-secondary dark:text-dark-secondary'>
              Try searching for something else.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function EmojiPicker({
  onSelectEmoji
}: Pick<TwitterComposePickerProps, 'onSelectEmoji'>): JSX.Element {
  const [searchValue, setSearchValue] = useState('');
  const normalizedSearch = searchValue.trim().toLowerCase();
  const handleSearchChange = ({
    target: { value }
  }: ChangeEvent<HTMLInputElement>): void => setSearchValue(value);
  const sections = useMemo<FilteredEmojiSection[]>(
    () =>
      emojiSections
        .map((section) => ({
          ...section,
          emojis: section.emojis.filter(
            (emoji): boolean =>
              !normalizedSearch ||
              section.title.toLowerCase().includes(normalizedSearch) ||
              emoji.includes(normalizedSearch)
          )
        }))
        .filter(({ emojis }): boolean => !!emojis.length),
    [normalizedSearch]
  );

  return (
    <>
      <div className='px-3 pb-3'>
        <label
          className='flex h-11 items-center gap-3 rounded-full bg-main-search-background
                     px-4 text-light-secondary dark:text-dark-secondary'
        >
          <CustomIcon className='h-5 w-5' iconName='TwitterSearchIcon' />
          <input
            className='min-w-0 flex-1 bg-transparent outline-none placeholder:text-light-secondary
                       dark:placeholder:text-dark-secondary'
            placeholder='Search emojis'
            value={searchValue}
            onChange={handleSearchChange}
          />
        </label>
      </div>
      <div className='h-[318px] overflow-y-auto px-3 pb-3'>
        {sections.map(({ title, emojis }) => (
          <section className='mb-4' key={title}>
            <h3 className='mb-2 text-[13px] font-bold uppercase text-light-secondary dark:text-dark-secondary'>
              {title}
            </h3>
            <div className='grid grid-cols-8 gap-1'>
              {emojis.map((emoji) => {
                const selectEmoji = (): void => onSelectEmoji(emoji);

                return (
                  <button
                    className='accent-tab flex h-9 w-9 items-center justify-center rounded-full
                             hover:bg-main-accent/10 active:bg-main-accent/20'
                    type='button'
                    onClick={selectEmoji}
                    key={`${title}-${emoji}`}
                  >
                    <Twemoji emoji={emoji} />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function clampPosition(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function getEmojiPickerStyle(
  anchorElement: HTMLElement | null | undefined,
  placement: TwitterComposePickerProps['placement']
): CSSProperties {
  if (!anchorElement)
    return {
      left: '50%',
      top: pickerViewportMargin,
      transform: 'translateX(-50%)'
    };

  const rect = anchorElement.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxLeft = viewportWidth - emojiPickerWidth - pickerViewportMargin;
  const left = clampPosition(rect.left, pickerViewportMargin, maxLeft);
  const topBelow = rect.bottom + pickerOffset;
  const topAbove = rect.top - emojiPickerHeight - pickerOffset;
  const preferredTop = placement === 'below' ? topBelow : topAbove;
  const fallbackTop = placement === 'below' ? topAbove : topBelow;
  const top =
    preferredTop < pickerViewportMargin ||
    preferredTop + emojiPickerHeight > viewportHeight - pickerViewportMargin
      ? fallbackTop
      : preferredTop;
  const maxTop = viewportHeight - emojiPickerHeight - pickerViewportMargin;

  return {
    left,
    top: clampPosition(top, pickerViewportMargin, maxTop)
  };
}

export function TwitterComposePicker({
  type,
  placement,
  anchorElement,
  onClose,
  onSelectEmoji,
  onSelectGif
}: TwitterComposePickerProps): JSX.Element {
  const [mounted, setMounted] = useState(false);
  const [emojiPickerStyle, setEmojiPickerStyle] = useState<CSSProperties>({});
  const isGifPicker = type === 'gif';

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!mounted || isGifPicker) return;

    const updatePosition = (): void => {
      setEmojiPickerStyle(getEmojiPickerStyle(anchorElement, placement));
    };

    updatePosition();

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorElement, isGifPicker, mounted, placement]);

  if (!mounted) return <></>;

  if (isGifPicker)
    return createPortal(
      <div
        className='fixed inset-0 z-[70] bg-black/40 dark:bg-[#5B7083]/40'
        onClick={onClose}
      >
        <div
          className='fixed left-1/2 top-6 z-[80] w-[500px] max-w-[calc(100vw-24px)]
                     -translate-x-1/2 overflow-hidden rounded-[6px] bg-main-background text-light-primary
                     dark:text-dark-primary'
          role='dialog'
          aria-label='Choose a GIF'
          onClick={(event): void => event.stopPropagation()}
        >
          <GifPicker onClose={onClose} onSelectGif={onSelectGif} />
        </div>
      </div>,
      document.body
    );

  return createPortal(
    <div
      className='menu-container fixed z-[90] w-[350px] max-w-[calc(100vw-24px)] overflow-hidden
                 rounded-2xl border border-light-border bg-main-background text-light-primary
                 dark:border-dark-border dark:text-dark-primary'
      style={emojiPickerStyle}
      role='dialog'
      aria-label='Add an emoji'
    >
      <div className='grid h-[53px] grid-cols-[40px,1fr,40px] items-center px-2'>
        <Button
          className='accent-tab accent-bg-tab rounded-full p-2 text-light-primary
                     hover:bg-light-primary/10 active:bg-light-primary/20
                     dark:text-dark-primary dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
          onClick={onClose}
          aria-label='Close'
          title='Close'
        >
          <CustomIcon className='h-5 w-5' iconName='TwitterCloseIcon' />
        </Button>
        <h2 className='text-center text-xl font-extrabold'>
          {isGifPicker ? 'Choose a GIF' : 'Add an emoji'}
        </h2>
        <span aria-hidden='true' />
      </div>
      <EmojiPicker onSelectEmoji={onSelectEmoji} />
    </div>,
    document.body
  );
}

import Link from 'next/link';
import { useState, useEffect, useRef, useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import cn from 'clsx';
import { toast } from 'react-hot-toast';
import { tweetsCollection } from '@lib/atproto/collections';
import { getTweetPath, getUserPath } from '@lib/routes';
import {
  manageReply,
  uploadImages,
  manageTotalTweets,
  manageTotalPhotos
} from '@lib/atproto/utils';
import { useAuth } from '@lib/context/auth-context';
import {
  getHashtagSearchQuery,
  normalizeMention,
  type ActiveHashtag,
  type ActiveMention
} from '@lib/hashtags';
import { sleep } from '@lib/utils';
import { getImagesData } from '@lib/validation';
import { UserAvatar } from '@components/user/user-avatar';
import { TweetEmbed } from '@components/tweet/tweet-embed';
import { addDoc, getDoc, serverTimestamp } from '@lib/atproto/store';
import { InputForm, fromTop } from './input-form';
import { ImagePreview } from './image-preview';
import { InputOptions } from './input-options';
import type { GifSelection } from './twitter-compose-picker';
import type { ReactNode, FormEvent, ChangeEvent, ClipboardEvent } from 'react';
import type { WithFieldValue } from '@lib/atproto/store';
import type { Variants } from 'framer-motion';
import type { User } from '@lib/types/user';
import type {
  EmbeddedTweet,
  Tweet,
  TweetAudience,
  TweetReplySetting,
  TweetWithUser
} from '@lib/types/tweet';
import type {
  FileWithId,
  FilesWithId,
  ImagesPreview,
  ImageData
} from '@lib/types/file';

type InputProps = {
  modal?: boolean;
  reply?: boolean;
  compactReply?: boolean;
  focusSignal?: number;
  parent?: { id: string; username: string };
  disabled?: boolean;
  children?: ReactNode;
  quoteTweet?: TweetWithUser;
  replyModal?: boolean;
  closeModal?: () => void;
};

type TweetDraft = Omit<Tweet, 'id'> & {
  quoteTarget?: { id: string; createdBy: string };
  replySetting?: TweetReplySetting;
};

function getQuotedTweetPreview(tweet: TweetWithUser): EmbeddedTweet {
  return {
    id: tweet.id,
    authorName: tweet.user.name,
    authorUsername: tweet.user.username,
    authorAvatar: tweet.user.photoURL,
    authorVerified: tweet.user.verified,
    text: tweet.text,
    createdAt: tweet.createdAt,
    images: tweet.images,
    card: tweet.card
  };
}

export const variants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 }
};

export function Input({
  modal,
  reply,
  compactReply,
  focusSignal,
  parent,
  disabled,
  children,
  quoteTweet,
  replyModal,
  closeModal
}: InputProps): JSX.Element {
  const [selectedImages, setSelectedImages] = useState<FilesWithId>([]);
  const [imagesPreview, setImagesPreview] = useState<ImagesPreview>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [visited, setVisited] = useState(false);
  const [audience, setAudience] = useState<TweetAudience>('everyone');
  const [replySetting, setReplySetting] =
    useState<TweetReplySetting>('everyone');

  const { user, isAdmin } = useAuth();
  const { name, username, photoURL } = user as User;

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const previewCount = imagesPreview.length;
  const isUploadingImages = !!previewCount;

  useEffect(
    () => {
      if (modal) inputRef.current?.focus();
      return cleanImage;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    if (!focusSignal) return;

    setVisited(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [focusSignal]);

  const sendTweet = async (): Promise<void> => {
    inputRef.current?.blur();

    setLoading(true);

    const isReplying = reply ?? replyModal;

    const userId = user?.id as string;
    const quotedTweet = quoteTweet ? getQuotedTweetPreview(quoteTweet) : null;

    const tweetData: WithFieldValue<TweetDraft> = {
      text: inputValue.trim() || null,
      parent: isReplying && parent ? parent : null,
      images: await uploadImages(userId, selectedImages),
      card: null,
      quotedTweet,
      userLikes: [],
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: null,
      userReplies: 0,
      userRetweets: [],
      userQuotes: 0,
      bookmarkCount: 0,
      replySetting: isReplying ? undefined : replySetting,
      quoteTarget: quoteTweet
        ? { id: quoteTweet.id, createdBy: quoteTweet.createdBy }
        : undefined
    };

    await sleep(500);

    const [tweetRef] = await Promise.all([
      addDoc(tweetsCollection, tweetData as WithFieldValue<Omit<Tweet, 'id'>>),
      manageTotalTweets('increment', userId),
      tweetData.images && manageTotalPhotos('increment', userId),
      isReplying && manageReply('increment', parent?.id as string)
    ]);

    const { id: tweetId } = await getDoc(tweetRef);

    if (!modal && !replyModal) {
      discardTweet();
      setLoading(false);
    }

    if (closeModal) closeModal();

    toast.success(
      () => (
        <span className='flex gap-2'>
          Your Tweet was sent
          <Link href={getTweetPath(tweetId, username)}>
            <a className='custom-underline font-bold'>View</a>
          </Link>
        </span>
      ),
      { duration: 6000 }
    );
  };

  const handleImageUpload = (
    e: ChangeEvent<HTMLInputElement> | ClipboardEvent<HTMLTextAreaElement>
  ): void => {
    const isClipboardEvent = 'clipboardData' in e;

    if (isClipboardEvent) {
      const isPastingText = e.clipboardData.getData('text');
      if (isPastingText) return;
    }

    const files = isClipboardEvent ? e.clipboardData.files : e.target.files;

    const imagesData = getImagesData(files, {
      currentFiles: previewCount,
      allowUploadingVideos: true
    });

    if (!imagesData) {
      toast.error('Please choose a GIF or photo up to 4');
      return;
    }

    const { imagesPreviewData, selectedImagesData } = imagesData;

    setImagesPreview([...imagesPreview, ...imagesPreviewData]);
    setSelectedImages([...selectedImages, ...selectedImagesData]);

    inputRef.current?.focus();
  };

  const removeImage = (targetId: string) => (): void => {
    setSelectedImages(selectedImages.filter(({ id }) => id !== targetId));
    setImagesPreview(imagesPreview.filter(({ id }) => id !== targetId));

    const { src } = imagesPreview.find(
      ({ id }) => id === targetId
    ) as ImageData;

    URL.revokeObjectURL(src);
  };

  const cleanImage = (): void => {
    imagesPreview.forEach(({ src }) => URL.revokeObjectURL(src));

    setSelectedImages([]);
    setImagesPreview([]);
  };

  const discardTweet = (): void => {
    setInputValue('');
    setVisited(false);
    setAudience('everyone');
    setReplySetting('everyone');
    cleanImage();

    inputRef.current?.blur();
  };

  const handleChange = ({
    target: { value }
  }: ChangeEvent<HTMLTextAreaElement>): void => setInputValue(value);

  const handleEmojiSelect = (emoji: string): void => {
    const input = inputRef.current;
    const selectionStart = input?.selectionStart ?? inputValue.length;
    const selectionEnd = input?.selectionEnd ?? inputValue.length;
    const nextValue = `${inputValue.slice(
      0,
      selectionStart
    )}${emoji}${inputValue.slice(selectionEnd)}`;
    const nextCursorPosition = selectionStart + emoji.length;

    setInputValue(nextValue);

    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  };

  const handleHashtagSelect = (
    tag: string,
    { start, end }: ActiveHashtag
  ): void => {
    const input = inputRef.current;
    const hashtag = getHashtagSearchQuery(tag);
    const suffix = inputValue[end] && !/\s/.test(inputValue[end]) ? ' ' : '';
    const nextValue = `${inputValue.slice(
      0,
      start
    )}${hashtag}${suffix}${inputValue.slice(end)}`;
    const nextCursorPosition = start + hashtag.length + suffix.length;

    setInputValue(nextValue);

    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  };

  const handleMentionSelect = (
    username: string,
    { start, end }: ActiveMention
  ): void => {
    const input = inputRef.current;
    const mention = `@${normalizeMention(username)}`;
    const suffix = inputValue[end] && /\s/.test(inputValue[end]) ? '' : ' ';
    const nextValue = `${inputValue.slice(
      0,
      start
    )}${mention}${suffix}${inputValue.slice(end)}`;
    const nextCursorPosition = start + mention.length + suffix.length;

    setInputValue(nextValue);

    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  };

  const handleGifSelect = async ({
    id,
    title,
    src,
    preview,
    aspectRatio
  }: GifSelection): Promise<void> => {
    if (previewCount >= 4) {
      toast.error('Please choose a GIF or photo up to 4');
      return;
    }

    try {
      const response = await fetch(src);

      if (!response.ok) throw new Error('Unable to fetch GIF');

      const blob = await response.blob();
      const fileType = blob.type || 'image/gif';
      const extension = fileType.includes('png')
        ? 'png'
        : fileType.includes('mp4')
        ? 'mp4'
        : 'gif';
      const gifFile = Object.assign(
        new File([blob], `${id}.${extension}`, { type: fileType }),
        { id: crypto.randomUUID() }
      ) as FileWithId;
      const gifPreview = {
        id: gifFile.id,
        src,
        alt: title,
        type: 'gif',
        poster: preview,
        aspectRatio
      };

      setSelectedImages((currentImages) =>
        currentImages.length >= 4 ? currentImages : [...currentImages, gifFile]
      );
      setImagesPreview((currentPreview) =>
        currentPreview.length >= 4
          ? currentPreview
          : [...currentPreview, gifPreview]
      );

      inputRef.current?.focus();
    } catch {
      toast.error('Unable to add that GIF. Try another.');
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    void sendTweet();
  };

  const handleFocus = (): void => setVisited(!loading);

  const formId = useId();

  const inputLimit = isAdmin ? 560 : 280;
  const quotedTweetPreview = quoteTweet
    ? getQuotedTweetPreview(quoteTweet)
    : null;

  const inputLength = inputValue.length;
  const isValidInput = !!inputValue.trim().length;
  const isCharLimitExceeded = inputLength > inputLimit;

  const isValidTweet =
    !isCharLimitExceeded && (isValidInput || isUploadingImages || !!quoteTweet);

  return (
    <form
      className={cn('flex flex-col', {
        '-mx-4': reply,
        'gap-2': replyModal,
        'cursor-not-allowed': disabled
      })}
      onSubmit={handleSubmit}
    >
      {loading && (
        <motion.i className='h-1 animate-pulse bg-main-accent' {...variants} />
      )}
      {children}
      {reply && visited && (
        <motion.p
          className={cn(
            '-mb-2 mt-2 text-light-secondary dark:text-dark-secondary',
            compactReply ? 'ml-[68px]' : 'ml-[75px]'
          )}
          {...fromTop}
        >
          Replying to{' '}
          <Link href={getUserPath(parent?.username as string)}>
            <a className='custom-underline text-main-accent'>
              {parent?.username as string}
            </a>
          </Link>
        </motion.p>
      )}
      <label
        className={cn(
          'hover-animation grid w-full grid-cols-[auto,1fr] gap-3 px-4 py-3',
          reply
            ? 'pt-3 pb-1'
            : replyModal
            ? 'pt-0'
            : 'border-b-2 border-light-border dark:border-dark-border',
          compactReply && 'pr-5',
          (disabled || loading) && 'pointer-events-none opacity-50'
        )}
        htmlFor={formId}
      >
        <UserAvatar
          size={compactReply ? 40 : undefined}
          src={photoURL}
          alt={name}
          username={username}
        />
        <div className='flex w-full flex-col gap-4'>
          <InputForm
            modal={modal}
            reply={reply}
            quote={!!quoteTweet}
            formId={formId}
            visited={visited}
            loading={loading}
            inputRef={inputRef}
            replyModal={replyModal}
            inputValue={inputValue}
            audience={audience}
            replySetting={replySetting}
            isValidTweet={isValidTweet}
            isUploadingImages={isUploadingImages}
            setAudience={setAudience}
            setReplySetting={setReplySetting}
            sendTweet={sendTweet}
            handleHashtagSelect={handleHashtagSelect}
            handleMentionSelect={handleMentionSelect}
            handleFocus={handleFocus}
            discardTweet={discardTweet}
            handleChange={handleChange}
            handleImageUpload={handleImageUpload}
          >
            {isUploadingImages && (
              <ImagePreview
                imagesPreview={imagesPreview}
                previewCount={previewCount}
                removeImage={!loading ? removeImage : undefined}
              />
            )}
            {quotedTweetPreview && (
              <TweetEmbed card={null} quotedTweet={quotedTweetPreview} />
            )}
          </InputForm>
          <AnimatePresence initial={false}>
            {(reply ? reply && visited && !loading : !loading) && (
              <InputOptions
                reply={reply}
                modal={modal}
                inputLimit={inputLimit}
                inputLength={inputLength}
                isValidTweet={isValidTweet}
                isCharLimitExceeded={isCharLimitExceeded}
                handleImageUpload={handleImageUpload}
                handleEmojiSelect={handleEmojiSelect}
                handleGifSelect={handleGifSelect}
              />
            )}
          </AnimatePresence>
        </div>
      </label>
    </form>
  );
}

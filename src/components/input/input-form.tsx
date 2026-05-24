import { useEffect, useState } from 'react';
import TextArea from 'react-textarea-autosize';
import { AnimatePresence, motion } from 'framer-motion';
import cn from 'clsx';
import { useModal } from '@lib/hooks/useModal';
import {
  getActiveHashtag,
  getActiveMention,
  type ActiveHashtag,
  type ActiveMention
} from '@lib/hashtags';
import { Modal } from '@components/modal/modal';
import { ActionModal } from '@components/modal/action-modal';
import { HeroIcon } from '@components/ui/hero-icon';
import { Button } from '@components/ui/button';
import { HashtagSuggestions, MentionSuggestions } from './hashtag-suggestions';
import type {
  Dispatch,
  ReactNode,
  RefObject,
  SetStateAction,
  ChangeEvent,
  KeyboardEvent,
  ClipboardEvent
} from 'react';
import type { Variants } from 'framer-motion';
import type { TweetAudience, TweetReplySetting } from '@lib/types/tweet';

type InputFormProps = {
  modal?: boolean;
  formId: string;
  loading: boolean;
  visited: boolean;
  reply?: boolean;
  quote?: boolean;
  children: ReactNode;
  inputRef: RefObject<HTMLTextAreaElement>;
  inputValue: string;
  audience: TweetAudience;
  replySetting: TweetReplySetting;
  replyModal?: boolean;
  isValidTweet: boolean;
  isUploadingImages: boolean;
  setAudience: Dispatch<SetStateAction<TweetAudience>>;
  setReplySetting: Dispatch<SetStateAction<TweetReplySetting>>;
  sendTweet: () => Promise<void>;
  handleHashtagSelect: (tag: string, hashtag: ActiveHashtag) => void;
  handleMentionSelect: (username: string, mention: ActiveMention) => void;
  handleFocus: () => void;
  discardTweet: () => void;
  handleChange: ({
    target: { value }
  }: ChangeEvent<HTMLTextAreaElement>) => void;
  handleImageUpload: (
    e: ChangeEvent<HTMLInputElement> | ClipboardEvent<HTMLTextAreaElement>
  ) => void;
};

const variants: Variants[] = [
  {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.15, ease: 'easeOut' } },
    exit: { opacity: 0, transition: { duration: 0.1, ease: 'easeOut' } }
  },
  {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.15, ease: 'easeOut' } },
    exit: { opacity: 0, transition: { duration: 0.1, ease: 'easeOut' } }
  }
];

export const [fromTop, fromBottom] = variants;

const audienceOptions: Readonly<
  {
    value: TweetAudience;
    label: string;
    iconName: 'GlobeAmericasIcon';
  }[]
> = [
  {
    value: 'everyone',
    label: 'Everyone',
    iconName: 'GlobeAmericasIcon'
  }
];

const replyOptions: Readonly<
  {
    value: TweetReplySetting;
    label: string;
    iconName:
      | 'GlobeAmericasIcon'
      | 'UserPlusIcon'
      | 'UserGroupIcon'
      | 'AtSymbolIcon'
      | 'NoSymbolIcon';
  }[]
> = [
  {
    value: 'everyone',
    label: 'Everyone can reply',
    iconName: 'GlobeAmericasIcon'
  },
  {
    value: 'following',
    label: 'People you follow can reply',
    iconName: 'UserPlusIcon'
  },
  {
    value: 'followers',
    label: 'Your followers can reply',
    iconName: 'UserGroupIcon'
  },
  {
    value: 'mentioned',
    label: 'Accounts you mention can reply',
    iconName: 'AtSymbolIcon'
  },
  {
    value: 'none',
    label: 'No one can reply',
    iconName: 'NoSymbolIcon'
  }
];

function getActiveTextEntity(
  value: string,
  cursorPosition: number
): {
  hashtag: ActiveHashtag | null;
  mention: ActiveMention | null;
} {
  const hashtag = getActiveHashtag(value, cursorPosition);

  return {
    hashtag,
    mention: hashtag ? null : getActiveMention(value, cursorPosition)
  };
}

export function InputForm({
  modal,
  reply,
  quote,
  formId,
  loading,
  visited,
  children,
  inputRef,
  replyModal,
  inputValue,
  audience,
  replySetting,
  isValidTweet,
  isUploadingImages,
  setAudience,
  setReplySetting,
  sendTweet,
  handleHashtagSelect,
  handleMentionSelect,
  handleFocus,
  discardTweet,
  handleChange,
  handleImageUpload
}: InputFormProps): JSX.Element {
  const { open, openModal, closeModal } = useModal();
  const [activeHashtag, setActiveHashtag] = useState<ActiveHashtag | null>(
    null
  );
  const [activeMention, setActiveMention] = useState<ActiveMention | null>(
    null
  );
  const [audienceMenuOpen, setAudienceMenuOpen] = useState(false);
  const [replyMenuOpen, setReplyMenuOpen] = useState(false);

  const selectedAudience = audienceOptions.find(
    ({ value }) => value === audience
  ) as typeof audienceOptions[number];
  const selectedReplyOption = replyOptions.find(
    ({ value }) => value === replySetting
  ) as typeof replyOptions[number];
  const isVisibilityShown = visited && !reply && !replyModal && !loading;

  useEffect(() => handleShowHideNav(true), []);

  useEffect(() => {
    if (!isVisibilityShown) {
      setAudienceMenuOpen(false);
      setReplyMenuOpen(false);
    }
  }, [isVisibilityShown]);

  useEffect(() => {
    const input = inputRef.current;
    const cursorPosition = input?.selectionStart ?? inputValue.length;
    const { hashtag, mention } = getActiveTextEntity(
      inputValue,
      cursorPosition
    );

    setActiveHashtag(hashtag);
    setActiveMention(mention);
  }, [inputRef, inputValue]);

  const handleKeyboardShortcut = ({
    key,
    ctrlKey
  }: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!modal && key === 'Escape')
      if (isValidTweet) {
        inputRef.current?.blur();
        openModal();
      } else discardTweet();
    else if (ctrlKey && key === 'Enter' && isValidTweet) void sendTweet();
  };

  const handleShowHideNav = (blur?: boolean) => (): void => {
    const sidebar = document.getElementById('sidebar') as HTMLElement;

    if (!sidebar) return;

    if (blur) {
      setTimeout(() => (sidebar.style.opacity = ''), 200);
      return;
    }

    if (window.innerWidth < 500) sidebar.style.opacity = '0';
  };

  const handleFormFocus = (): void => {
    handleShowHideNav()();
    handleFocus();
  };

  const handleTextEntityState = (): void => {
    const input = inputRef.current;
    const cursorPosition = input?.selectionStart ?? inputValue.length;
    const { hashtag, mention } = getActiveTextEntity(
      inputValue,
      cursorPosition
    );

    setActiveHashtag(hashtag);
    setActiveMention(mention);
  };

  const handleTextAreaKeyUp = (
    event: KeyboardEvent<HTMLTextAreaElement>
  ): void => {
    handleKeyboardShortcut(event);
    handleTextEntityState();
  };

  const selectHashtag = (tag: string): void => {
    const hashtag =
      activeHashtag ??
      getActiveHashtag(
        inputValue,
        inputRef.current?.selectionStart ?? inputValue.length
      );

    if (!hashtag) return;

    handleHashtagSelect(tag, hashtag);
    setActiveHashtag(null);
    setActiveMention(null);
  };

  const selectMention = (username: string): void => {
    const mention =
      activeMention ??
      getActiveMention(
        inputValue,
        inputRef.current?.selectionStart ?? inputValue.length
      );

    if (!mention) return;

    handleMentionSelect(username, mention);
    setActiveHashtag(null);
    setActiveMention(null);
  };

  const handleClose = (): void => {
    discardTweet();
    closeModal();
  };

  const selectAudience = (nextAudience: TweetAudience) => (): void => {
    setAudience(nextAudience);
    setAudienceMenuOpen(false);
  };

  const selectReplySetting =
    (nextReplySetting: TweetReplySetting) => (): void => {
      setReplySetting(nextReplySetting);
      setReplyMenuOpen(false);
    };

  return (
    <div
      className={cn(
        'flex min-h-[48px] w-full min-w-0 flex-col justify-center',
        quote ? 'gap-2.5' : 'gap-4'
      )}
    >
      <Modal
        modalClassName='max-w-xs bg-main-background w-full p-8 rounded-2xl'
        open={open}
        closeModal={closeModal}
      >
        <ActionModal
          title='Discard Tweet?'
          description='This can’t be undone and you’ll lose your draft.'
          mainBtnClassName='bg-accent-red hover:bg-accent-red/90 active:bg-accent-red/75'
          mainBtnLabel='Discard'
          action={handleClose}
          closeModal={closeModal}
        />
      </Modal>
      <div className={cn('flex min-w-0 flex-col', quote ? 'gap-3' : 'gap-6')}>
        {isVisibilityShown && (
          <motion.div className='relative self-start' {...fromTop}>
            <button
              type='button'
              className='custom-button accent-tab accent-bg-tab flex items-center gap-1
                         border border-light-line-reply py-0 px-3 text-main-accent
                         hover:bg-main-accent/10 active:bg-main-accent/20 dark:border-light-secondary'
              aria-haspopup='menu'
              aria-expanded={audienceMenuOpen}
              onClick={(): void => {
                setAudienceMenuOpen(!audienceMenuOpen);
                setReplyMenuOpen(false);
              }}
            >
              <p className='font-bold'>{selectedAudience.label}</p>
              <HeroIcon className='h-4 w-4' iconName='ChevronDownIcon' />
            </button>
            <AnimatePresence>
              {audienceMenuOpen && (
                <motion.div
                  className='menu-container absolute left-0 top-full z-20 mt-2 w-64 overflow-hidden rounded-2xl
                             border border-light-line-reply bg-main-background py-2 shadow-xl
                             dark:border-dark-border'
                  role='menu'
                  {...fromTop}
                >
                  {audienceOptions.map(({ value, label, iconName }) => {
                    const selected = value === audience;

                    return (
                      <button
                        type='button'
                        className='accent-bg-tab flex w-full items-center gap-3 px-4 py-3 text-left
                                   hover:bg-main-accent/10 active:bg-main-accent/20'
                        role='menuitemradio'
                        aria-checked={selected}
                        onClick={selectAudience(value)}
                        key={value}
                      >
                        <HeroIcon
                          className='h-5 w-5 text-main-accent'
                          iconName={iconName}
                        />
                        <span className='min-w-0 flex-1 font-bold'>
                          {label}
                        </span>
                        {selected && (
                          <HeroIcon
                            className='h-5 w-5 text-main-accent'
                            iconName='CheckIcon'
                          />
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
        <div className='flex items-center gap-3'>
          <div className='relative min-w-0 flex-1'>
            <TextArea
              id={formId}
              className='w-full min-w-0 resize-none bg-transparent text-xl outline-none
                         placeholder:text-light-secondary dark:placeholder:text-dark-secondary'
              value={inputValue}
              placeholder={
                quote
                  ? 'Add a comment'
                  : reply || replyModal
                  ? 'Tweet your reply'
                  : "What's happening?"
              }
              onBlur={handleShowHideNav(true)}
              minRows={
                loading ? 1 : modal && !isUploadingImages && !quote ? 3 : 1
              }
              maxRows={isUploadingImages ? 5 : 15}
              onFocus={handleFormFocus}
              onPaste={handleImageUpload}
              onClick={handleTextEntityState}
              onSelect={handleTextEntityState}
              onKeyUp={handleTextAreaKeyUp}
              onChange={handleChange}
              ref={inputRef}
            />
            <AnimatePresence>
              {activeHashtag ? (
                <HashtagSuggestions
                  query={activeHashtag.query}
                  onSelect={selectHashtag}
                />
              ) : activeMention ? (
                <MentionSuggestions
                  query={activeMention.query}
                  onSelect={selectMention}
                />
              ) : null}
            </AnimatePresence>
          </div>
          {reply && !visited && (
            <Button
              className='cursor-pointer bg-main-accent px-4 py-1.5 font-bold text-white opacity-50'
              onClick={handleFocus}
            >
              Reply
            </Button>
          )}
        </div>
      </div>
      {children}
      {isVisibilityShown && (
        <motion.div
          className='flex border-b border-light-border pb-2 dark:border-dark-border'
          {...fromBottom}
        >
          <div className='relative'>
            <button
              type='button'
              className='custom-button accent-tab accent-bg-tab flex items-center gap-1 py-0
                         px-3 text-main-accent hover:bg-main-accent/10 active:bg-main-accent/20'
              aria-haspopup='menu'
              aria-expanded={replyMenuOpen}
              onClick={(): void => {
                setReplyMenuOpen(!replyMenuOpen);
                setAudienceMenuOpen(false);
              }}
            >
              <HeroIcon
                className='h-4 w-4'
                iconName={selectedReplyOption.iconName}
              />
              <p className='font-bold'>{selectedReplyOption.label}</p>
              <HeroIcon className='h-4 w-4' iconName='ChevronDownIcon' />
            </button>
            <AnimatePresence>
              {replyMenuOpen && (
                <motion.div
                  className='menu-container absolute left-0 top-full z-20 mt-2 w-72 overflow-hidden rounded-2xl
                             border border-light-line-reply bg-main-background py-2 shadow-xl
                             dark:border-dark-border'
                  role='menu'
                  {...fromBottom}
                >
                  {replyOptions.map(({ value, label, iconName }) => {
                    const selected = value === replySetting;

                    return (
                      <button
                        type='button'
                        className='accent-bg-tab flex w-full items-center gap-3 px-4 py-3 text-left
                                   hover:bg-main-accent/10 active:bg-main-accent/20'
                        role='menuitemradio'
                        aria-checked={selected}
                        onClick={selectReplySetting(value)}
                        key={value}
                      >
                        <HeroIcon
                          className='h-5 w-5 text-main-accent'
                          iconName={iconName}
                        />
                        <span className='min-w-0 flex-1 font-bold'>
                          {label}
                        </span>
                        {selected && (
                          <HeroIcon
                            className='h-5 w-5 text-main-accent'
                            iconName='CheckIcon'
                          />
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </div>
  );
}

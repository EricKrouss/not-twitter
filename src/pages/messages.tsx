import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import TextArea from 'react-textarea-autosize';
import { toast } from 'react-hot-toast';
import cn from 'clsx';
import {
  acceptChatConvo,
  addChatReaction,
  blockChatParticipant,
  getChatConvoForActor,
  getChatMessages,
  isChatAccessError,
  leaveChatConvo,
  listChatConvos,
  listChatConvoRequests,
  markChatConvoRead,
  reportChatParticipant,
  removeChatReaction,
  sendChatMessage,
  getChatSettings,
  setChatSettings,
  setChatConvoMuted,
  type ChatAllowIncoming,
  type ChatConvo,
  type ChatConvoPage,
  type ChatConvoRequestsPage,
  type ChatSettings,
  type ChatMessagesPage,
  type ChatMessage
} from '@lib/atproto/backend';
import { useAuth } from '@lib/context/auth-context';
import { formatDate } from '@lib/date';
import { DEFAULT_PROFILE_PHOTO_URL } from '@lib/default-images';
import { useModal } from '@lib/hooks/useModal';
import { ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { SEO } from '@components/common/seo';
import { MainContainer } from '@components/home/main-container';
import { Modal } from '@components/modal/modal';
import { ActionModal } from '@components/modal/action-modal';
import { NextImage } from '@components/ui/next-image';
import { Button } from '@components/ui/button';
import { CustomIcon, type CustomIconName } from '@components/ui/custom-icon';
import { Loading } from '@components/ui/loading';
import { TweetText } from '@components/tweet/tweet-text';
import type {
  ChangeEvent,
  FormEvent,
  ReactElement,
  ReactNode,
  UIEvent
} from 'react';

function getRouteParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? null;

  return null;
}

function getConvoTitle(convo: ChatConvo): string {
  if (!convo.members.length) return 'Conversation';
  return convo.members.map(({ name }) => name).join(', ');
}

function getConvoHandle(convo: ChatConvo): string {
  if (!convo.members.length) return '';
  return convo.members.map(({ username }) => `@${username}`).join(', ');
}

function getMessagePreview(message: ChatMessage | null): string {
  if (!message) return 'No messages yet';
  if (message.deleted) return 'This message was deleted';
  return message.text ?? '';
}

function getConvoTimestamp(convo: ChatConvo): number {
  return convo.lastMessage ? +convo.lastMessage.sentAt.toDate() : 0;
}

function mergeConvos(
  currentConvos: ChatConvo[],
  nextConvos: ChatConvo[]
): ChatConvo[] {
  const byId = new Map(currentConvos.map((convo) => [convo.id, convo]));

  nextConvos.forEach((convo) => {
    byId.set(convo.id, { ...byId.get(convo.id), ...convo });
  });

  return Array.from(byId.values()).sort(
    (a, b) => getConvoTimestamp(b) - getConvoTimestamp(a)
  );
}

function mergeMessages(
  currentMessages: ChatMessage[],
  nextMessages: ChatMessage[]
): ChatMessage[] {
  const byId = new Map(currentMessages.map((message) => [message.id, message]));

  nextMessages.forEach((message) => byId.set(message.id, message));

  return Array.from(byId.values()).sort(
    (a, b) => +a.sentAt.toDate() - +b.sentAt.toDate()
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function formatThreadMessageTime(message: ChatMessage): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit'
  }).format(message.sentAt.toDate());
}

function getUnreadTotal(convos: ChatConvo[]): number {
  return convos.reduce((total, { unreadCount }) => total + unreadCount, 0);
}

function getUnreadLabel(count: number): string {
  return count > 99 ? '99+' : count.toString();
}

const BLUESKY_REACTION_VALUES = ['❤️', '😂', '👍', '😮', '😢', '😡'];
const CONVO_REFRESH_INTERVAL_MS = 10000;
const ACTIVE_THREAD_REFRESH_INTERVAL_MS = 5000;
const CHAT_ALLOW_INCOMING_OPTIONS: ReadonlyArray<{
  value: ChatAllowIncoming;
  label: string;
}> = [
  { value: 'none', label: 'No one' },
  { value: 'following', label: 'Users I follow' },
  { value: 'all', label: 'Everyone' }
];

type MessageDeliveryStatus = 'delivered' | 'read';

type ReactionGroup = {
  value: string;
  count: number;
  reactedByViewer: boolean;
};

function getMessageDeliveryStatus(
  message: ChatMessage,
  viewerId: string | undefined,
  isMine: boolean
): MessageDeliveryStatus | null {
  if (!viewerId || !isMine || message.deleted) return null;

  const readerIds = new Set(message.readBy);
  const hasRemoteReadSignal =
    Array.from(readerIds).some((readerId) => readerId !== viewerId) ||
    message.reactions.some(({ senderId }) => senderId !== viewerId);

  return hasRemoteReadSignal ? 'read' : 'delivered';
}

function getReactionGroups(
  message: ChatMessage,
  viewerId: string | undefined
): ReactionGroup[] {
  const groups = new Map<string, ReactionGroup>();

  message.reactions.forEach(({ value, senderId }) => {
    const group = groups.get(value) ?? {
      value,
      count: 0,
      reactedByViewer: false
    };

    group.count += 1;
    group.reactedByViewer ||= !!viewerId && senderId === viewerId;
    groups.set(value, group);
  });

  return Array.from(groups.values());
}

function viewerReactedWith(
  message: ChatMessage,
  viewerId: string | undefined,
  value: string
): boolean {
  return message.reactions.some(
    (reaction) => reaction.value === value && reaction.senderId === viewerId
  );
}

type MessagesErrorProps = {
  error: Error;
  authorizingMessages: boolean;
  onAuthorizeMessages: () => void;
  className?: string;
};

function MessagesError({
  error,
  authorizingMessages,
  onAuthorizeMessages,
  className
}: MessagesErrorProps): JSX.Element {
  const canAuthorizeMessages = isChatAccessError(error);

  return (
    <div
      className={cn(
        `flex flex-col items-center justify-center gap-3 px-6 py-12 text-center
         text-light-secondary dark:text-dark-secondary`,
        className
      )}
    >
      <CustomIcon className='h-10 w-10' iconName='TwitterInfoIcon' />
      <p>{getErrorMessage(error)}</p>
      {canAuthorizeMessages && (
        <Button
          className='accent-tab accent-bg-tab mt-1 px-4 py-2 font-bold text-white'
          loading={authorizingMessages}
          onClick={onAuthorizeMessages}
        >
          Authorize messages
        </Button>
      )}
    </div>
  );
}

type IconButtonProps = {
  iconName: CustomIconName;
  label: string;
  disabled?: boolean;
  iconClassName?: string;
  onClick?: () => void;
};

function IconButton({
  iconName,
  label,
  disabled,
  iconClassName,
  onClick
}: IconButtonProps): JSX.Element {
  return (
    <Button
      className='dark-bg-tab group relative p-2 text-main-accent hover:bg-main-accent/10
                 active:bg-main-accent/20 disabled:cursor-default disabled:opacity-60'
      disabled={disabled}
      onClick={onClick}
      title={label}
    >
      <CustomIcon className={iconClassName ?? 'h-5 w-5'} iconName={iconName} />
    </Button>
  );
}

type MessageAvatarProps = {
  src?: string | null;
  alt: string;
  size?: number;
  className?: string;
};

function MessageAvatar({
  src,
  alt,
  size = 40,
  className
}: MessageAvatarProps): JSX.Element {
  return (
    <figure
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-main-sidebar-background',
        className
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        <NextImage
          useSkeleton
          imgClassName='rounded-full'
          width={size}
          height={size}
          src={src}
          alt={alt}
        />
      ) : (
        <CustomIcon
          className='h-1/2 w-1/2 text-light-secondary dark:text-dark-secondary'
          iconName='TwitterProfileIcon'
        />
      )}
    </figure>
  );
}

type NewMessageToastProps = {
  convo: ChatConvo;
  onOpen: () => void;
};

function NewMessageToast({ convo, onOpen }: NewMessageToastProps): JSX.Element {
  const participant = convo.members[0];

  return (
    <Button
      className='flex max-w-sm items-center gap-3 rounded-2xl border border-light-border bg-main-background
                 px-4 py-3 text-left shadow-lg dark:border-dark-border'
      onClick={onOpen}
    >
      <MessageAvatar
        src={participant?.photoURL}
        alt={participant?.name ?? 'Conversation'}
        size={40}
      />
      <div className='min-w-0'>
        <div className='flex min-w-0 items-center gap-1'>
          <p className='truncate font-bold'>{getConvoTitle(convo)}</p>
          {participant?.verified && (
            <CustomIcon
              className='h-4 w-4 shrink-0'
              iconName='TwitterVerifiedIcon'
            />
          )}
        </div>
        <p className='truncate text-[15px] text-light-secondary dark:text-dark-secondary'>
          {getMessagePreview(convo.lastMessage)}
        </p>
      </div>
    </Button>
  );
}

type MessageRequestsRowProps = {
  count: number;
  onClick: () => void;
};

function MessageRequestsRow({
  count,
  onClick
}: MessageRequestsRowProps): JSX.Element {
  return (
    <Button
      className='hover-card flex h-14 w-full items-center justify-between rounded-none border-b
                 border-light-border px-4 text-left text-[15px] dark:border-dark-border'
      title='Message requests'
      onClick={onClick}
    >
      <span className='font-normal'>Message requests</span>
      <span className='flex items-center gap-3'>
        {count > 0 && (
          <span className='flex h-6 min-w-[24px] items-center justify-center rounded-full bg-main-accent px-1.5 text-xs font-bold text-white'>
            {getUnreadLabel(count)}
          </span>
        )}
        <CustomIcon
          className='h-5 w-5 text-light-secondary dark:text-dark-secondary'
          iconName='TwitterChevronRightIcon'
        />
      </span>
    </Button>
  );
}

type MessageRequestsPanelProps = {
  requests: ChatConvo[];
  cursor: string | null;
  error?: Error;
  loading: boolean;
  loadingMore: boolean;
  authorizingMessages: boolean;
  processingRequestId: string | null;
  onAuthorizeMessages: () => void;
  onBack: () => void;
  onAccept: (convo: ChatConvo) => void;
  onDelete: (convo: ChatConvo) => void;
  onLoadMore: () => void;
  onOpenSettings: () => void;
};

function MessageRequestsPanel({
  requests,
  cursor,
  error,
  loading,
  loadingMore,
  authorizingMessages,
  processingRequestId,
  onAuthorizeMessages,
  onBack,
  onAccept,
  onDelete,
  onLoadMore,
  onOpenSettings
}: MessageRequestsPanelProps): JSX.Element {
  return (
    <section className='flex min-h-0 flex-1 flex-col'>
      <header className='flex h-[53px] shrink-0 items-center justify-between px-3'>
        <div className='flex min-w-0 items-center gap-5'>
          <Button
            className='dark-bg-tab p-2 hover:bg-light-primary/10 active:bg-light-primary/20
                       dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
            onClick={onBack}
            title='Back'
          >
            <CustomIcon className='h-5 w-5' iconName='TwitterArrowLeftIcon' />
          </Button>
          <h1 className='truncate text-xl font-extrabold'>Message requests</h1>
        </div>
        <Button
          className='dark-bg-tab p-2 hover:bg-light-primary/10 active:bg-light-primary/20
                     dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
          aria-label='Message request settings'
          onClick={onOpenSettings}
          title='Settings'
        >
          <CustomIcon className='h-5 w-5' iconName='TwitterSettingsIcon' />
        </Button>
      </header>
      <div className='px-8 pt-14'>
        <p className='max-w-[330px] text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
          Message requests from people you don&apos;t follow live here. To reply
          to their messages, you need to accept the request.{' '}
          <a
            className='font-bold underline'
            href='https://bsky.social/about/support'
          >
            Learn more
          </a>
        </p>
        <div className='mt-11 border-t border-light-border dark:border-dark-border' />
      </div>
      <div className='min-h-0 flex-1 overflow-y-auto'>
        {loading ? (
          <Loading className='mt-5' />
        ) : error ? (
          <MessagesError
            error={error}
            authorizingMessages={authorizingMessages}
            onAuthorizeMessages={onAuthorizeMessages}
          />
        ) : requests.length ? (
          <>
            {requests.map((convo) => {
              const participant = convo.members[0];
              const processing = processingRequestId === convo.id;

              return (
                <div
                  className='hover-card border-b border-light-border px-4 py-4 dark:border-dark-border'
                  key={convo.id}
                >
                  <div className='flex w-full items-start gap-3 text-left'>
                    <MessageAvatar
                      src={participant?.photoURL}
                      alt={participant?.name ?? 'Conversation'}
                      size={48}
                    />
                    <div className='min-w-0 flex-1'>
                      <div className='flex min-w-0 items-center gap-1'>
                        <p className='truncate font-bold'>
                          {getConvoTitle(convo)}
                        </p>
                        {participant?.verified && (
                          <CustomIcon
                            className='h-4 w-4 shrink-0'
                            iconName='TwitterVerifiedIcon'
                          />
                        )}
                        {convo.lastMessage && (
                          <p className='ml-auto shrink-0 text-sm text-light-secondary dark:text-dark-secondary'>
                            {formatDate(convo.lastMessage.sentAt, 'tweet')}
                          </p>
                        )}
                      </div>
                      <p className='truncate text-[15px] text-light-secondary dark:text-dark-secondary'>
                        {getConvoHandle(convo)}
                      </p>
                      <p className='mt-0.5 truncate text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
                        {getMessagePreview(convo.lastMessage)}
                      </p>
                    </div>
                  </div>
                  <div className='mt-4 flex justify-end gap-2'>
                    <Button
                      className='accent-tab rounded-full border border-light-line-reply px-5 py-1.5 text-[15px]
                                 font-bold text-accent-red hover:bg-accent-red/10 dark:border-dark-border'
                      disabled={processing}
                      onClick={(): void => onDelete(convo)}
                    >
                      Delete
                    </Button>
                    <Button
                      className='accent-tab accent-bg-tab rounded-full bg-main-accent px-5 py-1.5 text-[15px]
                                 font-bold text-white hover:bg-main-accent/90'
                      loading={processing}
                      onClick={(): void => onAccept(convo)}
                    >
                      Accept
                    </Button>
                  </div>
                </div>
              );
            })}
            {cursor && (
              <div className='border-b border-light-border px-4 py-3 text-center dark:border-dark-border'>
                <Button
                  className='accent-tab accent-bg-tab px-4 py-2 font-bold text-white'
                  loading={loadingMore}
                  onClick={onLoadMore}
                >
                  Show more
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className='min-h-full' />
        )}
      </div>
    </section>
  );
}

type ChatSettingsPanelProps = {
  settings?: ChatSettings;
  error?: Error;
  loading: boolean;
  savingAllowIncoming: ChatAllowIncoming | null;
  authorizingMessages: boolean;
  onAuthorizeMessages: () => void;
  onBack: () => void;
  onSelectAllowIncoming: (value: ChatAllowIncoming) => void;
};

function ChatSettingsPanel({
  settings,
  error,
  loading,
  savingAllowIncoming,
  authorizingMessages,
  onAuthorizeMessages,
  onBack,
  onSelectAllowIncoming
}: ChatSettingsPanelProps): JSX.Element {
  const selectedAllowIncoming = settings?.allowIncoming ?? 'all';

  return (
    <section className='flex min-h-0 flex-1 flex-col'>
      <header className='flex h-[53px] shrink-0 items-center gap-5 px-3'>
        <Button
          className='dark-bg-tab p-2 hover:bg-light-primary/10 active:bg-light-primary/20
                     dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
          onClick={onBack}
          title='Back'
        >
          <CustomIcon className='h-5 w-5' iconName='TwitterArrowLeftIcon' />
        </Button>
        <h1 className='truncate text-xl font-extrabold'>Chat</h1>
      </header>
      {loading ? (
        <Loading className='mt-5' />
      ) : error ? (
        <MessagesError
          error={error}
          authorizingMessages={authorizingMessages}
          onAuthorizeMessages={onAuthorizeMessages}
        />
      ) : (
        <div className='border-b border-light-border px-4 pt-10 pb-6 dark:border-dark-border'>
          <h2 className='text-[19px] font-extrabold leading-6'>
            Allow message requests from:
          </h2>
          <p className='mt-1 text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
            People you follow will always be able to message you.{' '}
            <a
              className='font-normal text-main-accent'
              href='https://bsky.social/about/support'
            >
              Learn more
            </a>
          </p>
          <div className='mt-2'>
            {CHAT_ALLOW_INCOMING_OPTIONS.map(({ value, label }) => {
              const selected = selectedAllowIncoming === value;
              const saving = savingAllowIncoming === value;

              return (
                <Button
                  className='flex min-h-[32px] w-full items-center justify-between rounded-none p-0
                             text-left text-[17px] font-normal disabled:opacity-70'
                  disabled={!!savingAllowIncoming}
                  onClick={(): void => onSelectAllowIncoming(value)}
                  key={value}
                >
                  <span>{label}</span>
                  <span
                    className={cn(
                      `flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full
                       border-2`,
                      selected
                        ? 'border-main-accent bg-main-accent text-white'
                        : 'border-light-secondary dark:border-dark-secondary'
                    )}
                  >
                    {selected && !saving && (
                      <CustomIcon
                        className='h-3.5 w-3.5'
                        iconName='TwitterCheckIcon'
                      />
                    )}
                    {saving && (
                      <CustomIcon
                        className='h-3.5 w-3.5'
                        iconName='SpinnerIcon'
                      />
                    )}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

type ConversationRowProps = {
  convo: ChatConvo;
  active: boolean;
  viewerId: string | undefined;
  onClick: () => void;
};

function ConversationRow({
  convo,
  active,
  viewerId,
  onClick
}: ConversationRowProps): JSX.Element {
  const participant = convo.members[0];
  const preview = getMessagePreview(convo.lastMessage);
  const lastMessageIsMine = convo.lastMessage?.senderId === viewerId;
  const deliveryStatus = convo.lastMessage
    ? getMessageDeliveryStatus(convo.lastMessage, viewerId, lastMessageIsMine)
    : null;

  return (
    <Button
      className={cn(
        `accent-tab hover-card flex w-full items-start gap-3 rounded-none border-r-2 border-b
         border-light-border border-r-transparent px-4 py-4 text-left dark:border-dark-border`,
        active &&
          'border-r-main-accent bg-main-accent/10 dark:bg-main-accent/20'
      )}
      onClick={onClick}
    >
      <MessageAvatar
        src={participant?.photoURL}
        alt={participant?.name ?? 'Conversation'}
        size={48}
      />
      <div className='min-w-0 flex-1'>
        <div className='flex min-w-0 items-center gap-1'>
          <p className='truncate font-bold'>{getConvoTitle(convo)}</p>
          {participant?.verified && (
            <CustomIcon
              className='h-4 w-4 shrink-0'
              iconName='TwitterVerifiedIcon'
            />
          )}
          {participant && (
            <p className='min-w-0 truncate text-light-secondary dark:text-dark-secondary'>
              @{participant.username}
            </p>
          )}
          {convo.lastMessage && (
            <p className='ml-auto shrink-0 text-sm text-light-secondary dark:text-dark-secondary'>
              {formatDate(convo.lastMessage.sentAt, 'tweet')}
            </p>
          )}
        </div>
        <div className='mt-0.5 flex items-center gap-2'>
          <p
            className={cn(
              'truncate text-[15px] text-light-secondary dark:text-dark-secondary',
              convo.unreadCount > 0 && 'font-bold text-main-accent'
            )}
          >
            {preview}
          </p>
          {convo.unreadCount > 0 ? (
            <span
              className='ml-auto flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded-full
                         bg-main-accent px-1.5 text-xs font-bold text-white'
            >
              {getUnreadLabel(convo.unreadCount)}
            </span>
          ) : (
            deliveryStatus && (
              <span className='ml-auto shrink-0 text-main-accent'>
                <DeliveryCheck status={deliveryStatus} />
              </span>
            )
          )}
        </div>
      </div>
    </Button>
  );
}

type ConversationInfoProps = {
  convo: ChatConvo;
  muting: boolean;
  blocking: boolean;
  reporting: boolean;
  onToggleMute: () => void;
  onBlockParticipant: () => void;
  onReportParticipant: () => void;
  onDeleteConversation: () => void;
};

type InfoSectionProps = {
  title: string;
  children: ReactNode;
};

function InfoSection({ title, children }: InfoSectionProps): JSX.Element {
  return (
    <section className='border-b border-light-border dark:border-dark-border'>
      <h3 className='px-4 pt-4 pb-2 text-[13px] font-bold text-light-secondary dark:text-dark-secondary'>
        {title}
      </h3>
      {children}
    </section>
  );
}

type InfoRowProps = {
  children: ReactNode;
  destructive?: boolean;
  loading?: boolean;
  onClick: () => void;
};

function InfoRow({
  children,
  destructive,
  loading,
  onClick
}: InfoRowProps): JSX.Element {
  return (
    <Button
      className={cn(
        `hover-card flex min-h-[52px] w-full items-center gap-4 rounded-none
         px-4 py-3 text-left text-[15px] font-normal`,
        destructive
          ? 'justify-center text-center text-accent-red'
          : 'justify-between'
      )}
      loading={loading}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

type TogglePillProps = {
  enabled: boolean;
};

function TogglePill({ enabled }: TogglePillProps): JSX.Element {
  return (
    <span
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors',
        enabled ? 'bg-main-accent' : 'bg-light-line-reply dark:bg-dark-border'
      )}
      aria-hidden='true'
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
          enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
        )}
      />
    </span>
  );
}

function ConversationInfo({
  convo,
  muting,
  blocking,
  reporting,
  onToggleMute,
  onBlockParticipant,
  onReportParticipant,
  onDeleteConversation
}: ConversationInfoProps): JSX.Element {
  const firstMember = convo.members[0];
  const firstHandle = firstMember ? `@${firstMember.username}` : '';

  return (
    <div className='min-h-0 flex-1 overflow-y-auto'>
      <InfoSection title='People'>
        {convo.members.map((member) => (
          <div
            className='flex w-full items-center gap-3 px-4 py-3'
            key={member.id}
          >
            <MessageAvatar src={member.photoURL} alt={member.name} size={48} />
            <div className='min-w-0 flex-1'>
              <div className='flex min-w-0 items-center gap-1'>
                <p className='truncate font-bold'>{member.name}</p>
                {member.verified && (
                  <CustomIcon
                    className='h-4 w-4 shrink-0'
                    iconName='TwitterVerifiedIcon'
                  />
                )}
              </div>
              <p className='truncate text-[15px] text-light-secondary dark:text-dark-secondary'>
                @{member.username}
              </p>
            </div>
            <CustomIcon
              className='h-5 w-5 shrink-0 text-light-secondary dark:text-dark-secondary'
              iconName='TwitterChevronRightIcon'
            />
          </div>
        ))}
      </InfoSection>

      <InfoSection title='Notifications'>
        <InfoRow loading={muting} onClick={onToggleMute}>
          <span>Snooze notifications</span>
          <TogglePill enabled={convo.muted} />
        </InfoRow>
      </InfoSection>

      <InfoSection title='Shared media'>
        <div className='px-4 py-8 text-center text-[15px] text-light-secondary dark:text-dark-secondary'>
          No photos or videos shared yet.
        </div>
      </InfoSection>

      <InfoSection title='Privacy & support'>
        {firstMember && (
          <>
            <InfoRow
              destructive
              loading={blocking}
              onClick={onBlockParticipant}
            >
              <span>Block {firstHandle}</span>
            </InfoRow>
            <InfoRow
              destructive
              loading={reporting}
              onClick={onReportParticipant}
            >
              <span>Report {firstHandle}</span>
            </InfoRow>
          </>
        )}
        <InfoRow destructive onClick={onDeleteConversation}>
          <span>Delete conversation</span>
        </InfoRow>
      </InfoSection>
    </div>
  );
}

type DeliveryCheckProps = {
  status: MessageDeliveryStatus;
};

function DeliveryCheck({ status }: DeliveryCheckProps): JSX.Element {
  const read = status === 'read';

  return (
    <span
      className={cn('inline-flex items-center', read && 'text-main-accent')}
      title={read ? 'Read' : 'Delivered'}
    >
      <CustomIcon
        className={read ? 'h-4 w-4' : 'h-3.5 w-3.5'}
        iconName={read ? 'TwitterDoubleCheckIcon' : 'TwitterCheckIcon'}
      />
    </span>
  );
}

type MessageReactionPillsProps = {
  message: ChatMessage;
  viewerId: string | undefined;
  disabled: boolean;
  isMine: boolean;
  onSelect: (message: ChatMessage, value: string) => void;
};

function MessageReactionPills({
  message,
  viewerId,
  disabled,
  isMine,
  onSelect
}: MessageReactionPillsProps): JSX.Element | null {
  const groups = getReactionGroups(message, viewerId);

  if (!groups.length) return null;

  return (
    <div
      className={cn(
        'flex max-w-full flex-wrap gap-1 px-2',
        isMine && 'justify-end'
      )}
    >
      {groups.map(({ value, count, reactedByViewer }) => (
        <Button
          className={cn(
            `flex h-7 items-center gap-1 rounded-full border border-light-border bg-main-background
             px-2 text-sm hover:bg-main-sidebar-background dark:border-dark-border`,
            reactedByViewer &&
              'border-main-accent bg-main-accent/10 text-main-accent'
          )}
          disabled={disabled}
          onClick={(): void => onSelect(message, value)}
          title={reactedByViewer ? 'Remove reaction' : 'React'}
          key={value}
        >
          <span aria-hidden='true'>{value}</span>
          <span className='text-xs font-bold'>{count}</span>
        </Button>
      ))}
    </div>
  );
}

type MessageReactionPickerProps = {
  message: ChatMessage;
  viewerId: string | undefined;
  disabled: boolean;
  isMine: boolean;
  onSelect: (message: ChatMessage, value: string) => void;
};

function MessageReactionPicker({
  message,
  viewerId,
  disabled,
  isMine,
  onSelect
}: MessageReactionPickerProps): JSX.Element {
  return (
    <div
      className={cn(
        `absolute bottom-full z-20 mb-2 flex rounded-full border border-light-border bg-main-background
         p-1 shadow-md dark:border-dark-border`,
        isMine ? 'right-0' : 'left-0'
      )}
    >
      {BLUESKY_REACTION_VALUES.map((value) => {
        const active = viewerReactedWith(message, viewerId, value);

        return (
          <Button
            className={cn(
              `flex h-8 w-8 items-center justify-center rounded-full text-base
               hover:bg-main-sidebar-background`,
              active && 'bg-main-accent/10'
            )}
            disabled={disabled}
            onClick={(): void => onSelect(message, value)}
            title={active ? 'Remove reaction' : 'React'}
            key={value}
          >
            <span aria-hidden='true'>{value}</span>
          </Button>
        );
      })}
    </div>
  );
}

export default function Messages(): JSX.Element {
  const { user, signInWithBluesky } = useAuth();
  const { isReady, query, replace } = useRouter();
  const [convos, setConvos] = useState<ChatConvo[]>([]);
  const [convoCursor, setConvoCursor] = useState<string | null>(null);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [loadingConvos, setLoadingConvos] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [openingActor, setOpeningActor] = useState(false);
  const [sending, setSending] = useState(false);
  const [authorizingMessages, setAuthorizingMessages] = useState(false);
  const [activeError, setActiveError] = useState<Error | null>(null);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<
    string | null
  >(null);
  const [reactingMessageId, setReactingMessageId] = useState<string | null>(
    null
  );
  const [showConversationInfo, setShowConversationInfo] = useState(false);
  const [showMessageRequests, setShowMessageRequests] = useState(false);
  const [mutingConvo, setMutingConvo] = useState(false);
  const [leavingConvo, setLeavingConvo] = useState(false);
  const [blockingParticipant, setBlockingParticipant] = useState(false);
  const [reportingParticipant, setReportingParticipant] = useState(false);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [requestConvos, setRequestConvos] = useState<ChatConvo[]>([]);
  const [requestCursor, setRequestCursor] = useState<string | null>(null);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(
    null
  );
  const [savingAllowIncoming, setSavingAllowIncoming] =
    useState<ChatAllowIncoming | null>(null);
  const unreadCountsRef = useRef<Map<string, number>>(new Map());
  const initializedConvosRef = useRef(false);
  const activeConvoIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const skipNextMessageScrollRef = useRef(false);
  const {
    open: deleteConversationOpen,
    openModal: openDeleteConversationModal,
    closeModal: closeDeleteConversationModal
  } = useModal();

  const { data, error, mutate } = useSWR<ChatConvoPage, Error>(
    user ? `chat-convos:${user.id}` : null,
    () => listChatConvos(),
    { revalidateOnFocus: false }
  );
  const {
    data: requestsData,
    error: requestsError,
    mutate: mutateRequests
  } = useSWR<ChatConvoRequestsPage, Error>(
    user ? `chat-convo-requests:${user.id}` : null,
    () => listChatConvoRequests(),
    { revalidateOnFocus: false }
  );
  const {
    data: chatSettingsData,
    error: chatSettingsError,
    mutate: mutateChatSettings
  } = useSWR<ChatSettings, Error>(
    user && showChatSettings ? `chat-settings:${user.id}` : null,
    () => getChatSettings(),
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (!data) return;

    setConvos(data.convos);
    setConvoCursor(data.cursor);
    data.convos.forEach(({ id, unreadCount }) =>
      unreadCountsRef.current.set(id, unreadCount)
    );
    initializedConvosRef.current = true;
  }, [data]);

  useEffect(() => {
    if (!requestsData) return;

    setRequestConvos(requestsData.requests);
    setRequestCursor(requestsData.cursor);
  }, [requestsData]);

  useEffect(() => {
    activeConvoIdRef.current = activeConvoId;
  }, [activeConvoId]);

  const activeConvo = useMemo(
    () => convos.find(({ id }) => id === activeConvoId) ?? null,
    [activeConvoId, convos]
  );

  const filteredConvos = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    if (!normalizedSearch) return convos;

    return convos.filter((convo) =>
      `${getConvoTitle(convo)} ${getConvoHandle(convo)}`
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [convos, searchValue]);
  const unreadTotal = useMemo(() => getUnreadTotal(convos), [convos]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = unreadTotal
      ? `(${getUnreadLabel(unreadTotal)}) Messages / Not Twitter`
      : 'Messages / Not Twitter';
  }, [unreadTotal]);

  useEffect(() => {
    if (!activeConvoId || loadingMessages || loadingMoreMessages) return;
    if (skipNextMessageScrollRef.current) {
      skipNextMessageScrollRef.current = false;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [activeConvoId, loadingMessages, loadingMoreMessages, messages.length]);

  const loadThread = useCallback(async (convoId: string): Promise<void> => {
    setActiveConvoId(convoId);
    setMessages([]);
    setMessageCursor(null);
    setActiveError(null);
    setReactionPickerMessageId(null);
    setShowConversationInfo(false);
    setLoadingMessages(true);

    try {
      const page = await getChatMessages(convoId);
      const lastMessage = page.messages[page.messages.length - 1];

      setMessages(page.messages);
      setMessageCursor(page.cursor);
      unreadCountsRef.current.set(convoId, 0);
      setConvos((currentConvos) =>
        currentConvos.map((convo) =>
          convo.id === convoId
            ? { ...convo, opened: true, unreadCount: 0 }
            : convo
        )
      );

      if (lastMessage) void markChatConvoRead(convoId, lastMessage.id);
    } catch (error) {
      setActiveError(toError(error));
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (
      activeConvoId ||
      showMessageRequests ||
      !convos.length ||
      openingActor ||
      typeof window === 'undefined' ||
      !window.matchMedia('(min-width: 768px)').matches
    )
      return;

    void loadThread(convos[0].id);
  }, [activeConvoId, convos, loadThread, openingActor, showMessageRequests]);

  useEffect(() => {
    if (!isReady) return;

    const actor = getRouteParam(query.actor);
    if (!actor) return;

    let canceled = false;

    setOpeningActor(true);
    setActiveError(null);

    void getChatConvoForActor(actor)
      .then(async (convo) => {
        if (canceled) return;

        setConvos((currentConvos) => mergeConvos(currentConvos, [convo]));
        await loadThread(convo.id);
        await replace('/messages', undefined, { shallow: true });
      })
      .catch((error) => {
        if (canceled) return;

        const message = getErrorMessage(error);
        setActiveError(toError(error));
        toast.error(message);
      })
      .finally(() => {
        if (!canceled) setOpeningActor(false);
      });

    return () => {
      canceled = true;
    };
  }, [isReady, loadThread, query.actor, replace]);

  const showNewMessageAlert = useCallback(
    (convo: ChatConvo): void => {
      const preview = getMessagePreview(convo.lastMessage);

      toast.custom(
        (toastData) => (
          <NewMessageToast
            convo={convo}
            onOpen={(): void => {
              toast.dismiss(toastData.id);
              void loadThread(convo.id);
            }}
          />
        ),
        { duration: 5500, position: 'bottom-left' }
      );

      if (
        typeof window !== 'undefined' &&
        document.hidden &&
        'Notification' in window &&
        window.Notification.permission === 'granted'
      ) {
        const participant = convo.members[0];
        new window.Notification(getConvoTitle(convo), {
          body: preview,
          icon: participant?.photoURL ?? DEFAULT_PROFILE_PHOTO_URL
        });
      }
    },
    [loadThread]
  );

  const applyConvoPage = useCallback(
    (page: ChatConvoPage, alert = true): void => {
      setConvoCursor(page.cursor);
      setConvos((currentConvos) => mergeConvos(currentConvos, page.convos));

      page.convos.forEach((convo) => {
        const previousUnreadCount =
          unreadCountsRef.current.get(convo.id) ?? convo.unreadCount;
        const unreadIncreased = convo.unreadCount > previousUnreadCount;

        if (
          initializedConvosRef.current &&
          alert &&
          unreadIncreased &&
          !convo.muted &&
          convo.id !== activeConvoIdRef.current
        )
          showNewMessageAlert(convo);

        unreadCountsRef.current.set(convo.id, convo.unreadCount);
      });

      initializedConvosRef.current = true;
    },
    [showNewMessageAlert]
  );

  const refreshConvos = useCallback(async (): Promise<void> => {
    const page = await listChatConvos();
    applyConvoPage(page);
  }, [applyConvoPage]);

  const applyMessagesPage = useCallback(
    (page: ChatMessagesPage, replaceCursor = false): void => {
      if (replaceCursor || !messageCursor) setMessageCursor(page.cursor);
      setMessages((currentMessages) =>
        mergeMessages(currentMessages, page.messages)
      );
    },
    [messageCursor]
  );

  const refreshActiveMessages = useCallback(async (): Promise<void> => {
    const activeId = activeConvoIdRef.current;
    if (!activeId) return;

    const page = await getChatMessages(activeId);
    applyMessagesPage(page);

    const lastMessage = page.messages[page.messages.length - 1];
    if (lastMessage) {
      unreadCountsRef.current.set(activeId, 0);
      setConvos((currentConvos) =>
        currentConvos.map((convo) =>
          convo.id === activeId ? { ...convo, unreadCount: 0 } : convo
        )
      );
      void markChatConvoRead(activeId, lastMessage.id);
    }
  }, [applyMessagesPage]);

  useEffect(() => {
    if (!user) return;

    const intervalId = window.setInterval(
      () => void refreshConvos().catch(() => undefined),
      CONVO_REFRESH_INTERVAL_MS
    );

    return () => window.clearInterval(intervalId);
  }, [refreshConvos, user]);

  useEffect(() => {
    if (!activeConvoId) return;

    const intervalId = window.setInterval(
      () => void refreshActiveMessages().catch(() => undefined),
      ACTIVE_THREAD_REFRESH_INTERVAL_MS
    );

    return () => window.clearInterval(intervalId);
  }, [activeConvoId, refreshActiveMessages]);

  const loadMoreConvos = async (): Promise<void> => {
    if (!convoCursor) return;

    setLoadingConvos(true);

    try {
      const nextPage = await listChatConvos(convoCursor);

      applyConvoPage(nextPage, false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoadingConvos(false);
    }
  };

  const loadMoreMessages = async (): Promise<void> => {
    if (!activeConvoId || !messageCursor) return;

    skipNextMessageScrollRef.current = true;
    setLoadingMoreMessages(true);

    try {
      const nextPage = await getChatMessages(activeConvoId, messageCursor);

      applyMessagesPage(nextPage, true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoadingMoreMessages(false);
    }
  };

  const handleConvosScroll = ({
    currentTarget
  }: UIEvent<HTMLDivElement>): void => {
    const distanceFromBottom =
      currentTarget.scrollHeight -
      currentTarget.scrollTop -
      currentTarget.clientHeight;

    if (distanceFromBottom < 96 && convoCursor && !loadingConvos)
      void loadMoreConvos();
  };

  const handleMessagesScroll = ({
    currentTarget
  }: UIEvent<HTMLDivElement>): void => {
    if (currentTarget.scrollTop < 96 && messageCursor && !loadingMoreMessages)
      void loadMoreMessages();
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();

    if (!activeConvoId || !inputValue.trim()) return;

    setSending(true);

    try {
      const message = await sendChatMessage(activeConvoId, inputValue);

      setInputValue('');
      setMessages((currentMessages) =>
        mergeMessages(currentMessages, [message])
      );
      setConvos((currentConvos) =>
        mergeConvos(
          currentConvos.map((convo) =>
            convo.id === activeConvoId
              ? { ...convo, lastMessage: message, opened: true, unreadCount: 0 }
              : convo
          ),
          []
        )
      );
      void mutate();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const handleAuthorizeMessages = async (): Promise<void> => {
    if (!user) return;

    setAuthorizingMessages(true);

    try {
      await signInWithBluesky(user.username);
      await mutate();
      await mutateRequests();
      await mutateChatSettings();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setAuthorizingMessages(false);
    }
  };

  const handleAuthorizeMessagesClick = (): void => {
    void handleAuthorizeMessages();
  };

  const closeThread = (): void => {
    setActiveConvoId(null);
    setMessages([]);
    setMessageCursor(null);
    setActiveError(null);
    setReactionPickerMessageId(null);
    setShowConversationInfo(false);
    setShowMessageRequests(false);
    setShowChatSettings(false);
    closeDeleteConversationModal();
  };

  const handleConvoClick =
    (convoId: string): (() => void) =>
    (): void => {
      setShowMessageRequests(false);
      setShowChatSettings(false);
      void loadThread(convoId);
    };

  const openMessageRequests = (): void => {
    setShowMessageRequests(true);
    setShowChatSettings(false);
    setActiveConvoId(null);
    setMessages([]);
    setMessageCursor(null);
    setActiveError(null);
    setReactionPickerMessageId(null);
    setShowConversationInfo(false);
    closeDeleteConversationModal();
  };

  const openChatSettings = (): void => {
    setShowMessageRequests(true);
    setShowChatSettings(true);
    setActiveConvoId(null);
    setMessages([]);
    setMessageCursor(null);
    setActiveError(null);
    setReactionPickerMessageId(null);
    setShowConversationInfo(false);
    closeDeleteConversationModal();
  };

  const closeChatSettings = (): void => {
    setShowChatSettings(false);
  };

  const closeMessageRequests = (): void => {
    setShowMessageRequests(false);
    setShowChatSettings(false);
  };

  const updateAllowIncoming = async (
    allowIncoming: ChatAllowIncoming
  ): Promise<void> => {
    if (allowIncoming === chatSettingsData?.allowIncoming) return;

    setSavingAllowIncoming(allowIncoming);

    try {
      const nextSettings = await setChatSettings(allowIncoming);

      await mutateChatSettings(nextSettings, false);
      toast.success('Chat settings updated');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingAllowIncoming(null);
    }
  };

  const handleAllowIncomingSelect = (
    allowIncoming: ChatAllowIncoming
  ): void => {
    void updateAllowIncoming(allowIncoming);
  };

  const loadMoreRequests = async (): Promise<void> => {
    if (!requestCursor) return;

    setLoadingRequests(true);

    try {
      const nextPage = await listChatConvoRequests(requestCursor);

      setRequestCursor(nextPage.cursor);
      setRequestConvos((currentRequests) =>
        mergeConvos(currentRequests, nextPage.requests)
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoadingRequests(false);
    }
  };

  const acceptRequest = async (convo: ChatConvo): Promise<void> => {
    setProcessingRequestId(convo.id);

    try {
      const acceptedConvo = await acceptChatConvo(convo.id);

      setRequestConvos((currentRequests) =>
        currentRequests.filter(({ id }) => id !== convo.id)
      );
      setConvos((currentConvos) => mergeConvos(currentConvos, [acceptedConvo]));
      setShowMessageRequests(false);
      setShowChatSettings(false);
      await loadThread(acceptedConvo.id);
      void mutate();
      void mutateRequests();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setProcessingRequestId(null);
    }
  };

  const acceptRequestClick = (convo: ChatConvo): void => {
    void acceptRequest(convo);
  };

  const deleteRequest = async (convo: ChatConvo): Promise<void> => {
    setProcessingRequestId(convo.id);

    try {
      await leaveChatConvo(convo.id);
      setRequestConvos((currentRequests) =>
        currentRequests.filter(({ id }) => id !== convo.id)
      );
      void mutateRequests();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setProcessingRequestId(null);
    }
  };

  const deleteRequestClick = (convo: ChatConvo): void => {
    void deleteRequest(convo);
  };

  const handleSearchChange = ({
    target: { value }
  }: ChangeEvent<HTMLInputElement>): void => setSearchValue(value);

  const handleInputChange = ({
    target: { value }
  }: ChangeEvent<HTMLTextAreaElement>): void => setInputValue(value);

  const toggleReactionPicker =
    (messageId: string): (() => void) =>
    (): void => {
      setReactionPickerMessageId((currentMessageId) =>
        currentMessageId === messageId ? null : messageId
      );
    };

  const handleReactionSelect = async (
    message: ChatMessage,
    value: string
  ): Promise<void> => {
    if (!activeConvoId || !user) return;

    const reacted = viewerReactedWith(message, user.id, value);

    setReactingMessageId(message.id);

    try {
      const nextMessage = reacted
        ? await removeChatReaction(activeConvoId, message.id, value)
        : await addChatReaction(activeConvoId, message.id, value);

      setMessages((currentMessages) =>
        mergeMessages(currentMessages, [nextMessage])
      );
      setConvos((currentConvos) =>
        currentConvos.map((convo) =>
          convo.id === activeConvoId && convo.lastMessage?.id === nextMessage.id
            ? { ...convo, lastMessage: nextMessage }
            : convo
        )
      );
      setReactionPickerMessageId(null);
      void mutate();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setReactingMessageId(null);
    }
  };

  const openConversationInfo = (): void => setShowConversationInfo(true);

  const closeConversationInfo = (): void => setShowConversationInfo(false);

  const updateActiveConvo = (nextConvo: ChatConvo): void => {
    setConvos((currentConvos) =>
      mergeConvos(
        currentConvos.map((convo) =>
          convo.id === nextConvo.id ? nextConvo : convo
        ),
        []
      )
    );
  };

  const handleToggleMute = async (): Promise<void> => {
    if (!activeConvo) return;

    setMutingConvo(true);

    try {
      const nextConvo = await setChatConvoMuted(
        activeConvo.id,
        !activeConvo.muted
      );

      updateActiveConvo(nextConvo);
      toast.success(
        nextConvo.muted ? 'Notifications snoozed' : 'Notifications unsnoozed'
      );
      void mutate();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setMutingConvo(false);
    }
  };

  const handleToggleMuteClick = (): void => {
    void handleToggleMute();
  };

  const handleDeleteConversation = async (): Promise<void> => {
    if (!activeConvoId) return;

    setLeavingConvo(true);

    try {
      await leaveChatConvo(activeConvoId);
      setConvos((currentConvos) =>
        currentConvos.filter(({ id }) => id !== activeConvoId)
      );
      closeDeleteConversationModal();
      closeThread();
      toast.success('Conversation deleted');
      void mutate();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLeavingConvo(false);
    }
  };

  const handleDeleteConversationClick = (): void => {
    void handleDeleteConversation();
  };

  const handleBlockParticipant = async (): Promise<void> => {
    if (!firstMember) return;

    setBlockingParticipant(true);

    try {
      await blockChatParticipant(firstMember.id);
      toast.success(`Blocked @${firstMember.username}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBlockingParticipant(false);
    }
  };

  const handleBlockParticipantClick = (): void => {
    void handleBlockParticipant();
  };

  const handleReportParticipant = async (): Promise<void> => {
    if (!firstMember) return;

    setReportingParticipant(true);

    try {
      await reportChatParticipant(firstMember.id);
      toast.success('Report submitted');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setReportingParticipant(false);
    }
  };

  const handleReportParticipantClick = (): void => {
    void handleReportParticipant();
  };

  const showThread = !!activeConvoId;
  const firstMember = activeConvo?.members[0];

  return (
    <>
      <Modal
        modalClassName='w-full max-w-xs rounded-2xl bg-main-background p-8'
        open={deleteConversationOpen}
        closeModal={closeDeleteConversationModal}
      >
        <ActionModal
          title='Delete conversation?'
          description='This conversation will be deleted from your inbox. Other people in the conversation will still be able to see it.'
          mainBtnClassName='accent-tab bg-accent-red hover:bg-accent-red/90 focus-visible:bg-accent-red/90 active:bg-accent-red/75'
          mainBtnLabel={leavingConvo ? 'Deleting...' : 'Delete'}
          action={handleDeleteConversationClick}
          closeModal={closeDeleteConversationModal}
        />
      </Modal>
      <MainContainer className='!max-w-[1296px] !pb-0'>
        <SEO title='Messages / Not Twitter' />
        <div className='flex min-h-screen w-full dark:bg-black'>
          <section
            className={cn(
              `flex w-full flex-col border-r border-light-border dark:border-dark-border
             md:shrink-0`,
              showChatSettings ? 'md:w-[600px]' : 'md:w-[360px]',
              showThread && !showMessageRequests && 'hidden md:flex'
            )}
          >
            {showChatSettings ? (
              <ChatSettingsPanel
                authorizingMessages={authorizingMessages}
                error={chatSettingsError}
                loading={!chatSettingsData && !chatSettingsError}
                savingAllowIncoming={savingAllowIncoming}
                settings={chatSettingsData}
                onAuthorizeMessages={handleAuthorizeMessagesClick}
                onBack={closeChatSettings}
                onSelectAllowIncoming={handleAllowIncomingSelect}
              />
            ) : showMessageRequests ? (
              <MessageRequestsPanel
                authorizingMessages={authorizingMessages}
                cursor={requestCursor}
                error={requestsError}
                loading={!requestsData && !requestsError}
                loadingMore={loadingRequests}
                processingRequestId={processingRequestId}
                requests={requestConvos}
                onAccept={acceptRequestClick}
                onAuthorizeMessages={handleAuthorizeMessagesClick}
                onBack={closeMessageRequests}
                onDelete={deleteRequestClick}
                onLoadMore={loadMoreRequests}
                onOpenSettings={openChatSettings}
              />
            ) : (
              <>
                <header className='flex h-16 shrink-0 items-center justify-between border-b border-light-border px-4 dark:border-dark-border'>
                  <h1 className='text-xl font-extrabold'>Messages</h1>
                  <IconButton
                    iconName='TwitterNewMessageIcon'
                    label='New message'
                  />
                </header>
                <MessageRequestsRow
                  count={requestConvos.length}
                  onClick={openMessageRequests}
                />
                <div className='border-b border-light-border px-4 py-4 dark:border-dark-border'>
                  <label
                    className='flex h-12 items-center gap-3 rounded-full bg-main-sidebar-background px-4
                               text-light-secondary dark:text-dark-secondary'
                  >
                    <CustomIcon
                      className='h-5 w-5 shrink-0'
                      iconName='TwitterSearchIcon'
                    />
                    <input
                      className='min-w-0 flex-1 bg-transparent text-[15px] text-light-primary outline-none
                                 placeholder:text-light-secondary dark:text-dark-primary
                                 dark:placeholder:text-dark-secondary'
                      placeholder='Search for people and groups'
                      value={searchValue}
                      onChange={handleSearchChange}
                    />
                  </label>
                </div>
                <div
                  className='min-h-0 flex-1 overflow-y-auto'
                  onScroll={handleConvosScroll}
                >
                  {!data && !error ? (
                    <Loading className='mt-5' />
                  ) : error ? (
                    <MessagesError
                      error={error}
                      authorizingMessages={authorizingMessages}
                      onAuthorizeMessages={handleAuthorizeMessagesClick}
                    />
                  ) : openingActor ? (
                    <Loading className='mt-5' />
                  ) : filteredConvos.length ? (
                    <>
                      {filteredConvos.map((convo) => (
                        <ConversationRow
                          active={activeConvoId === convo.id}
                          convo={convo}
                          viewerId={user?.id}
                          onClick={handleConvoClick(convo.id)}
                          key={convo.id}
                        />
                      ))}
                      {convoCursor && (
                        <div className='border-b border-light-border px-4 py-3 text-center dark:border-dark-border'>
                          <Button
                            className='accent-tab accent-bg-tab px-4 py-2 font-bold text-white'
                            loading={loadingConvos}
                            onClick={loadMoreConvos}
                          >
                            Show more
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className='mx-auto flex max-w-xs flex-col gap-2 px-8 py-16'>
                      <h2 className='text-2xl font-extrabold'>
                        No messages yet
                      </h2>
                      <p className='text-light-secondary dark:text-dark-secondary'>
                        Your Bluesky conversations will appear here.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          <section
            className={cn(
              'hidden min-w-0 flex-1 flex-col md:flex',
              showThread && '!flex'
            )}
          >
            {activeConvo ? (
              showConversationInfo ? (
                <>
                  <header className='flex h-16 shrink-0 items-center border-b border-light-border px-3 dark:border-dark-border'>
                    <div className='flex min-w-0 items-center gap-5'>
                      <Button
                        className='dark-bg-tab p-2 hover:bg-light-primary/10 active:bg-light-primary/20
                                   dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
                        onClick={closeConversationInfo}
                        title='Back'
                      >
                        <CustomIcon
                          className='h-5 w-5'
                          iconName='TwitterArrowLeftIcon'
                        />
                      </Button>
                      <h2 className='truncate text-xl font-extrabold'>
                        Conversation info
                      </h2>
                    </div>
                  </header>
                  <ConversationInfo
                    blocking={blockingParticipant}
                    convo={activeConvo}
                    muting={mutingConvo}
                    reporting={reportingParticipant}
                    onBlockParticipant={handleBlockParticipantClick}
                    onDeleteConversation={openDeleteConversationModal}
                    onReportParticipant={handleReportParticipantClick}
                    onToggleMute={handleToggleMuteClick}
                  />
                </>
              ) : (
                <>
                  <header className='flex h-16 shrink-0 items-center justify-between border-b border-light-border px-4 dark:border-dark-border'>
                    <div className='flex min-w-0 items-center gap-3'>
                      <Button
                        className='dark-bg-tab mr-1 p-2 hover:bg-light-primary/10 active:bg-light-primary/20
                               dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20 md:hidden'
                        onClick={closeThread}
                        title='Back'
                      >
                        <CustomIcon
                          className='h-5 w-5'
                          iconName='TwitterArrowLeftIcon'
                        />
                      </Button>
                      <div className='min-w-0'>
                        <div className='flex min-w-0 items-center gap-1'>
                          <p className='truncate text-xl font-extrabold'>
                            {getConvoTitle(activeConvo)}
                          </p>
                          {firstMember?.verified && (
                            <CustomIcon
                              className='h-4 w-4 shrink-0'
                              iconName='TwitterVerifiedIcon'
                            />
                          )}
                        </div>
                        <p className='truncate text-sm text-light-secondary dark:text-dark-secondary'>
                          {getConvoHandle(activeConvo)}
                        </p>
                      </div>
                    </div>
                    <IconButton
                      iconClassName='h-6 w-6'
                      iconName='TwitterInfoIcon'
                      label='Info'
                      onClick={openConversationInfo}
                    />
                  </header>
                  {loadingMessages || openingActor ? (
                    <Loading className='mt-5' />
                  ) : activeError ? (
                    <MessagesError
                      className='flex-1'
                      error={activeError}
                      authorizingMessages={authorizingMessages}
                      onAuthorizeMessages={handleAuthorizeMessagesClick}
                    />
                  ) : (
                    <>
                      <div
                        className='min-h-0 flex-1 overflow-y-auto'
                        onScroll={handleMessagesScroll}
                      >
                        <div className='flex min-h-full flex-col justify-end gap-2 px-6 py-6'>
                          {messageCursor && (
                            <Button
                              className='accent-tab accent-bg-tab mx-auto px-4 py-2 text-sm font-bold text-white'
                              loading={loadingMoreMessages}
                              onClick={loadMoreMessages}
                            >
                              Show older
                            </Button>
                          )}
                          {messages.map((message, index) => {
                            const isMine = message.senderId === user?.id;
                            const sender = activeConvo.members.find(
                              ({ id }) => id === message.senderId
                            );
                            const previousMessage = messages[index - 1];
                            const nextMessage = messages[index + 1];
                            const groupedWithPrevious =
                              previousMessage?.senderId === message.senderId;
                            const groupedWithNext =
                              nextMessage?.senderId === message.senderId;
                            const showAvatar = !isMine && !groupedWithPrevious;
                            const showTimestamp = !groupedWithNext;
                            const deliveryStatus = getMessageDeliveryStatus(
                              message,
                              user?.id,
                              isMine
                            );
                            const reacting = reactingMessageId === message.id;
                            const messageBubbleClassName = cn(
                              'px-5 py-3 text-[17px] leading-6',
                              isMine
                                ? 'rounded-[28px] rounded-br bg-main-accent text-white'
                                : 'rounded-[28px] rounded-bl bg-main-sidebar-background',
                              groupedWithPrevious &&
                                (isMine ? 'rounded-tr-lg' : 'rounded-tl-lg'),
                              groupedWithNext &&
                                (isMine ? 'rounded-br-lg' : 'rounded-bl-lg'),
                              message.deleted &&
                                'italic text-light-secondary dark:text-dark-secondary'
                            );

                            return (
                              <div
                                className={cn(
                                  'group/message flex items-end gap-3',
                                  isMine && 'justify-end'
                                )}
                                key={message.id}
                              >
                                {!isMine &&
                                  (showAvatar ? (
                                    <MessageAvatar
                                      className='mb-5'
                                      src={sender?.photoURL}
                                      alt={sender?.name ?? 'Sender'}
                                      size={40}
                                    />
                                  ) : (
                                    <div className='w-10 shrink-0' />
                                  ))}
                                <div
                                  className={cn(
                                    'flex max-w-[70%] flex-col gap-1',
                                    isMine && 'items-end',
                                    !showTimestamp && 'mb-0.5'
                                  )}
                                >
                                  <div className='relative'>
                                    {message.deleted ? (
                                      <p className={messageBubbleClassName}>
                                        This message was deleted
                                      </p>
                                    ) : (
                                      <TweetText
                                        className={messageBubbleClassName}
                                        linkClassName={cn(
                                          'custom-underline outline-none',
                                          isMine
                                            ? 'text-white'
                                            : 'text-main-accent'
                                        )}
                                        text={message.text ?? ''}
                                      />
                                    )}
                                    {!message.deleted && (
                                      <div
                                        className={cn(
                                          'absolute top-1/2 -translate-y-1/2',
                                          isMine ? '-left-14' : '-right-14'
                                        )}
                                      >
                                        <Button
                                          className={cn(
                                            `dark-bg-tab flex h-11 w-11 items-center justify-center rounded-full
                                         text-main-accent opacity-0 hover:bg-main-accent/10 focus:opacity-100
                                         active:bg-main-accent/20 group-hover/message:opacity-100`,
                                            reactionPickerMessageId ===
                                              message.id && 'opacity-100'
                                          )}
                                          disabled={reacting}
                                          onClick={toggleReactionPicker(
                                            message.id
                                          )}
                                          title='React'
                                        >
                                          <CustomIcon
                                            className='h-6 w-6'
                                            iconName='TwitterEmojiIcon'
                                          />
                                        </Button>
                                        {reactionPickerMessageId ===
                                          message.id && (
                                          <MessageReactionPicker
                                            disabled={reacting}
                                            isMine={isMine}
                                            message={message}
                                            viewerId={user?.id}
                                            onSelect={handleReactionSelect}
                                          />
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <MessageReactionPills
                                    disabled={reacting}
                                    isMine={isMine}
                                    message={message}
                                    viewerId={user?.id}
                                    onSelect={handleReactionSelect}
                                  />
                                  {showTimestamp && (
                                    <p
                                      className={cn(
                                        'flex items-center gap-1 px-2 text-sm text-light-secondary dark:text-dark-secondary',
                                        isMine && 'justify-end'
                                      )}
                                    >
                                      {formatThreadMessageTime(message)}
                                      {deliveryStatus && (
                                        <DeliveryCheck
                                          status={deliveryStatus}
                                        />
                                      )}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          <div ref={messagesEndRef} />
                        </div>
                      </div>
                      <form
                        className='shrink-0 border-t border-light-border bg-main-background px-5 py-4 dark:border-dark-border'
                        onSubmit={handleSubmit}
                      >
                        <div className='flex items-end gap-3'>
                          <IconButton
                            iconName='TwitterMediaIcon'
                            label='Add media'
                          />
                          <IconButton
                            iconName='TwitterGifIcon'
                            label='Add GIF'
                          />
                          <div className='flex min-h-[50px] flex-1 items-end rounded-[28px] bg-main-sidebar-background px-4'>
                            <TextArea
                              className='max-h-32 min-h-[48px] flex-1 resize-none bg-transparent py-3 text-[17px] leading-6 outline-none
                                     placeholder:text-light-secondary dark:placeholder:text-dark-secondary'
                              maxRows={5}
                              placeholder='Start your message'
                              value={inputValue}
                              onChange={handleInputChange}
                            />
                            <IconButton
                              iconName='TwitterEmojiIcon'
                              label='Emoji'
                            />
                          </div>
                          <Button
                            className='dark-bg-tab p-2.5 text-main-accent hover:bg-main-accent/10 active:bg-main-accent/20'
                            disabled={!inputValue.trim()}
                            loading={sending}
                            title='Send'
                            type='submit'
                          >
                            <CustomIcon
                              className='h-5 w-5'
                              iconName='TwitterSendIcon'
                            />
                          </Button>
                        </div>
                      </form>
                    </>
                  )}
                </>
              )
            ) : (
              <div className='flex flex-1 items-center justify-center px-8'>
                <div className='max-w-sm'>
                  <h2 className='text-3xl font-extrabold'>Select a message</h2>
                  <p className='mt-2 text-light-secondary dark:text-dark-secondary'>
                    {showChatSettings ? (
                      'Choose who can start new message requests with you.'
                    ) : showMessageRequests ? (
                      <>
                        Message requests from people you don&apos;t follow live
                        here. To reply to their messages, you need to accept the
                        request.{' '}
                        <a
                          className='font-bold underline'
                          href='https://bsky.social/about/support'
                        >
                          Learn more
                        </a>
                      </>
                    ) : (
                      'Choose from your existing conversations.'
                    )}
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </MainContainer>
    </>
  );
}

Messages.getLayout = (page: ReactElement): ReactNode => (
  <ProtectedLayout>
    <MainLayout>{page}</MainLayout>
  </ProtectedLayout>
);

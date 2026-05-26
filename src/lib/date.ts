import type { Timestamp } from '@lib/atproto/store';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatDate(
  targetDate: Timestamp,
  mode: 'tweet' | 'message' | 'full' | 'joined'
): string {
  const date = targetDate.toDate();

  if (mode === 'full') return getFullTime(date);
  if (mode === 'tweet') return getPostTime(date);
  if (mode === 'joined') return getJoinedTime(date);

  return getShortTime(date);
}

export function formatNumber(number: number): string {
  const formattedNumber = new Intl.NumberFormat('en-GB', {
    notation: number >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1
  }).format(number);

  return formattedNumber.replace(/([a-z])$/i, (suffix) => suffix.toUpperCase());
}

function getFullTime(date: Date): string {
  const fullDate = new Intl.DateTimeFormat('en-gb', {
    hour: 'numeric',
    minute: 'numeric',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);

  const splittedDate = fullDate.split(', ');

  const formattedDate =
    splittedDate.length === 2
      ? [...splittedDate].reverse().join(' · ')
      : [splittedDate.slice(0, 2).join(', '), splittedDate.slice(-1)]
          .reverse()
          .join(' · ');

  return formattedDate;
}

function getPostTime(date: Date): string {
  if (isWithinLastDay(date)) return getRelativeTime(date);
  if (isYesterday(date))
    return new Intl.DateTimeFormat('en-gb', {
      day: 'numeric',
      month: 'short'
    }).format(date);

  return new Intl.DateTimeFormat('en-gb', {
    day: 'numeric',
    month: 'short',
    year: isCurrentYear(date) ? undefined : 'numeric'
  }).format(date);
}

function getJoinedTime(date: Date): string {
  return new Intl.DateTimeFormat('en-gb', {
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function getShortTime(date: Date): string {
  const isNear = isToday(date)
    ? 'today'
    : isYesterday(date)
    ? 'yesterday'
    : null;

  return isNear
    ? `${isNear === 'today' ? 'Today' : 'Yesterday'} at ${date
        .toLocaleTimeString('en-gb')
        .slice(0, -3)}`
    : getFullTime(date);
}

function getRelativeTime(date: Date): string {
  const elapsed = Date.now() - date.getTime();

  if (elapsed < SECOND) return 'now';
  if (elapsed < MINUTE) return `${Math.floor(elapsed / SECOND)}s`;
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;

  return `${Math.floor(elapsed / HOUR)}h`;
}

function isWithinLastDay(date: Date): boolean {
  const elapsed = Date.now() - date.getTime();

  return elapsed >= 0 && elapsed < DAY;
}

function isToday(date: Date): boolean {
  return new Date().toDateString() === date.toDateString();
}

function isYesterday(date: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toDateString() === date.toDateString();
}

function isCurrentYear(date: Date): boolean {
  return date.getFullYear() === new Date().getFullYear();
}

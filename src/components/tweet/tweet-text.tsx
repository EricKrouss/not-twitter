import Link from 'next/link';
import cn from 'clsx';
import { getUserPath } from '@lib/routes';
import {
  getHashtagSearchQuery,
  normalizeHashtag,
  normalizeMention
} from '@lib/hashtags';
import type { MouseEvent } from 'react';

type TweetTextProps = {
  text: string;
  className?: string;
};

type TextPart =
  | { type: 'text'; value: string }
  | { type: 'hashtag'; value: string; tag: string }
  | { type: 'mention'; value: string; username: string };

const entityRegex =
  /#([A-Za-z0-9_]{1,139})|@([A-Za-z0-9_][A-Za-z0-9_.-]{0,251})/g;

function getTextParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = entityRegex.exec(text))) {
    const index = match.index;
    const previousCharacter = index > 0 ? text[index - 1] : '';
    const isHashtag = !!match[1];
    const invalidPreviousCharacter = isHashtag
      ? /[A-Za-z0-9_]/.test(previousCharacter)
      : /[A-Za-z0-9_.-]/.test(previousCharacter);

    if (previousCharacter && invalidPreviousCharacter) continue;

    if (index > lastIndex)
      parts.push({ type: 'text', value: text.slice(lastIndex, index) });

    if (isHashtag) {
      parts.push({
        type: 'hashtag',
        value: match[0],
        tag: normalizeHashtag(match[1])
      });

      lastIndex = index + match[0].length;
      continue;
    }

    const username = normalizeMention(match[2]);
    const value = `@${username}`;

    if (!username) continue;

    parts.push({ type: 'mention', value, username });
    lastIndex = index + value.length;
  }

  if (lastIndex < text.length)
    parts.push({ type: 'text', value: text.slice(lastIndex) });

  return parts;
}

export function TweetText({ text, className }: TweetTextProps): JSX.Element {
  const stopEntityClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    event.stopPropagation();
  };

  return (
    <p className={cn('whitespace-pre-line break-words', className)}>
      {getTextParts(text).map((part, index) =>
        part.type === 'hashtag' ? (
          <Link
            href={{
              pathname: '/explore',
              query: {
                q: getHashtagSearchQuery(part.tag),
                src: 'hashtag_click'
              }
            }}
            key={`${part.value}-${index}`}
          >
            <a
              className='custom-underline text-main-accent outline-none'
              onClick={stopEntityClick}
            >
              {part.value}
            </a>
          </Link>
        ) : part.type === 'mention' ? (
          <Link
            href={getUserPath(part.username)}
            key={`${part.value}-${index}`}
          >
            <a
              className='custom-underline text-main-accent outline-none'
              onClick={stopEntityClick}
            >
              {part.value}
            </a>
          </Link>
        ) : (
          <span key={`${part.value}-${index}`}>{part.value}</span>
        )
      )}
    </p>
  );
}

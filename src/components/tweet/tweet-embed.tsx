/* eslint-disable @next/next/no-img-element */

import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import cn from 'clsx';
import { toast } from 'react-hot-toast';
import { formatAtprotoDisplayIdentifier } from '@lib/atproto/identity';
import { useAuth } from '@lib/context/auth-context';
import { useTheme } from '@lib/context/theme-context';
import { formatDate } from '@lib/date';
import { useStandardSiteArticlesInline } from '@lib/hooks/use-standard-site-articles-inline';
import { getTweetPath } from '@lib/routes';
import { createYouTubeCardFromText, getYouTubeVideoInfo } from '@lib/youtube';
import { ImagePreview } from '@components/input/image-preview';
import { CustomIcon } from '@components/ui/custom-icon';
import { HeroIcon } from '@components/ui/hero-icon';
import { NextImage } from '@components/ui/next-image';
import { TweetText } from './tweet-text';
import { TweetTranslation } from './tweet-translation';
import {
  TweetTombstone,
  isViewableTweetTombstoneKind
} from './tweet-tombstone';
import type {
  CSSProperties,
  KeyboardEvent,
  MouseEvent,
  ReactNode
} from 'react';
import type {
  EmbeddedTweet,
  StandardSiteArticle,
  TweetCard
} from '@lib/types/tweet';
import type { ImageData, ImagesPreview } from '@lib/types/file';
import type { ActivityNotificationCategory, User } from '@lib/types/user';
import type { YouTubeVideoInfo } from '@lib/youtube';

type ArticleNotificationAuthor = Pick<
  User,
  'id' | 'username' | 'followers' | 'activityNotificationCategories'
>;

type TweetEmbedProps = {
  card: TweetCard | null;
  quotedTweet: EmbeddedTweet | null;
  viewTweet?: boolean;
  hideQuotedTweetMedia?: boolean;
  expandQuotedTweet?: boolean;
  articleAuthor?: ArticleNotificationAuthor | null;
  articleTweetPath?: string | null;
};

type LinkCardProps = {
  card: TweetCard;
  compact?: boolean;
  fullArticleReader?: boolean;
  standardSiteArticlesInline?: boolean;
  articleAuthor?: ArticleNotificationAuthor | null;
  articleTweetPath?: string | null;
};

type CardEvent = MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;

const quotedTweetPreviewTextStyleBase: CSSProperties = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden'
};

const activityNotificationIndividualCategories: ActivityNotificationCategory[] =
  ['tweets', 'articles', 'retweets', 'replies'];

function normalizeActivityNotificationCategories(
  categories: readonly ActivityNotificationCategory[]
): ActivityNotificationCategory[] {
  if (categories.includes('all')) return ['all'];

  const next = activityNotificationIndividualCategories.filter((category) =>
    categories.includes(category)
  );

  return next.length === activityNotificationIndividualCategories.length
    ? ['all']
    : next;
}

function activityNotificationCategoriesInclude(
  categories: readonly ActivityNotificationCategory[],
  category: ActivityNotificationCategory
): boolean {
  const normalized = normalizeActivityNotificationCategories(categories);

  return normalized.includes('all') || normalized.includes(category);
}

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

function isStandardSiteCard(card: TweetCard): boolean {
  if (card.domain?.toLowerCase() === 'standard.site') return true;
  if (/^https?:\/\/(?:www\.)?standard\.site\//i.test(card.url)) return true;

  return (
    !!card.source ||
    !!card.readingTime ||
    !!card.createdAt ||
    !!card.associatedRefs?.some(({ uri }) => uri.includes('/site.standard.'))
  );
}

function formatCardPublishedDate(value?: string | null): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('en-gb', {
    day: 'numeric',
    month: 'short',
    year:
      date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'
  }).format(date);
}

function getCardReadingTimeLabel(readingTime?: number | null): string | null {
  if (!readingTime || readingTime < 1) return null;

  return `${readingTime} min read`;
}

function getEnhancedCardMeta(card: TweetCard): string[] {
  return [
    formatCardPublishedDate(card.createdAt),
    getCardReadingTimeLabel(card.readingTime)
  ].filter((item): item is string => !!item);
}

function stripReaderMarkdownPreamble(text: string): string {
  const normalizedText = text.replace(/\r\n?/g, '\n');
  const lines = normalizedText.split('\n');
  const scanLimit = Math.min(lines.length, 12);
  let sawTitle = false;
  let sawURLSource = false;

  for (let index = 0; index < scanLimit; index++) {
    const line = lines[index].trim();

    if (/^title:\s+/i.test(line)) sawTitle = true;
    if (/^url source:\s+/i.test(line)) sawURLSource = true;

    if (/^markdown content:\s*$/i.test(line) && sawTitle && sawURLSource)
      return lines
        .slice(index + 1)
        .join('\n')
        .replace(/^\n+/, '')
        .trim();
  }

  return normalizedText.trim();
}

function getArticleParagraphs(text: string): string[] {
  return stripReaderMarkdownPreamble(text)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, ' ').trim())
    .filter(Boolean);
}

function getArticleExcerpt(text: string, maxLength = 420): string {
  const normalizedText = stripReaderMarkdownPreamble(text)
    .replace(/\s+/g, ' ')
    .trim();

  if (normalizedText.length <= maxLength) return normalizedText;

  const excerpt = normalizedText.slice(0, maxLength).replace(/\s+\S*$/, '');

  return `${excerpt}...`;
}

type StandardSiteArticleBlock =
  | { type: 'paragraph' | 'list' | 'code'; text: string }
  | { type: 'heading'; text: string; level: number }
  | { type: 'image'; url?: string; alt?: string; raw?: unknown };

const standardSiteArticleHTMLCache = new Map<string, Promise<string | null>>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function getContentString(
  record: Record<string, unknown>,
  keys = ['text', 'plainText', 'markdown', 'content', 'value']
): string | null {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return null;
}

function stringLooksLikeMarkdown(text: string): boolean {
  return (
    /(^|\n)#{1,6}\s+/.test(text) ||
    /(^|\n)!\[[^\]]*]\(/.test(text) ||
    /(^|\n)[-*+]\s+/.test(text) ||
    /\*\*[^*]+\*\*/.test(text)
  );
}

function getMarkdownTextFromContent(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (!isRecord(content)) return null;

  const type = typeof content.$type === 'string' ? content.$type : '';
  const markdown = getContentString(content);

  if (
    markdown &&
    (type.toLowerCase().includes('markdown') ||
      stringLooksLikeMarkdown(markdown))
  )
    return markdown;

  return null;
}

function getHtmlTextFromContent(content: unknown): string | null {
  if (!isRecord(content)) return null;

  const type = typeof content.$type === 'string' ? content.$type : '';
  const html = getContentString(content, ['html', 'text', 'content', 'value']);

  return html && type.toLowerCase().includes('html') ? html : null;
}

function stripMarkdownInline(text: string): string {
  return text
    .replace(/!?\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function getMarkdownImageBlock(line: string): StandardSiteArticleBlock | null {
  const match = line.match(/!\[([^\]]*)]\(([^)\s]+)(?:\s+"[^"]*")?\)/);

  if (!match?.[2]) return null;

  return { type: 'image', alt: match[1] ?? '', url: match[2] };
}

function appendBlocksFromMarkdownInlineImages(
  text: string,
  blocks: StandardSiteArticleBlock[]
): boolean {
  const imageRegex = /!\[([^\]]*)]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match: RegExpExecArray | null = imageRegex.exec(text);

  if (!match) return false;

  let cursor = 0;

  const appendText = (value: string): void => {
    const clean = value.trim();

    if (clean) blocks.push({ type: 'paragraph', text: clean });
  };

  while (match) {
    if (match.index > cursor) appendText(text.slice(cursor, match.index));

    blocks.push({
      type: 'image',
      alt: match[1] ?? '',
      url: match[2]
    });

    cursor = match.index + match[0].length;
    match = imageRegex.exec(text);
  }

  if (cursor < text.length) appendText(text.slice(cursor));

  return true;
}

function getBlocksFromMarkdown(
  markdown: string,
  articleTitle?: string
): StandardSiteArticleBlock[] {
  const lines = stripReaderMarkdownPreamble(markdown).split('\n');
  const blocks: StandardSiteArticleBlock[] = [];
  const paragraphLines: string[] = [];
  const codeLines: string[] = [];
  let inCode = false;

  const flushParagraph = (): void => {
    const text = paragraphLines.join(' ').trim();

    paragraphLines.length = 0;
    if (text) blocks.push({ type: 'paragraph', text });
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (inCode) {
        blocks.push({ type: 'code', text: codeLines.join('\n') });
        codeLines.length = 0;
        inCode = false;
      } else {
        flushParagraph();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const imageBlock = getMarkdownImageBlock(trimmed);

    if (imageBlock) {
      flushParagraph();
      blocks.push(imageBlock);
      continue;
    }

    if (/!\[[^\]]*]\([^)]+\)/.test(trimmed)) {
      flushParagraph();
      if (appendBlocksFromMarkdownInlineImages(trimmed, blocks)) continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      flushParagraph();
      const text = stripMarkdownInline(headingMatch[2]);

      if (!(blocks.length === 0 && text === articleTitle))
        blocks.push({
          type: 'heading',
          level: headingMatch[1].length,
          text
        });
      continue;
    }

    const listMatch = trimmed.match(/^([-*+]|\d+\.)\s+(.+)$/);

    if (listMatch) {
      flushParagraph();
      blocks.push({
        type: 'list',
        text: `${listMatch[1].endsWith('.') ? listMatch[1] : '•'} ${
          listMatch[2]
        }`
      });
      continue;
    }

    if (!trimmed) flushParagraph();
    else paragraphLines.push(trimmed);
  }

  flushParagraph();
  if (codeLines.length)
    blocks.push({ type: 'code', text: codeLines.join('\n') });

  return blocks;
}

function getBlocksFromHtml(
  html: string,
  articleTitle?: string,
  baseUrl?: string
): StandardSiteArticleBlock[] {
  if (typeof window !== 'undefined' && 'DOMParser' in window) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const root =
      doc.querySelector('article.content') ??
      doc.querySelector('article') ??
      doc.querySelector('main') ??
      doc.body;
    const blocks: StandardSiteArticleBlock[] = [];

    root.childNodes.forEach((node) =>
      appendBlocksFromHtmlNode(node, blocks, articleTitle, baseUrl)
    );

    if (blocks.length) return blocks;
  }

  return getBlocksFromHtmlText(html, articleTitle, baseUrl);
}

function getBlocksFromHtmlText(
  html: string,
  articleTitle?: string,
  baseUrl?: string
): StandardSiteArticleBlock[] {
  const fragment =
    html.match(
      /<article\b(?=[^>]*\bclass=["'][^"']*\bcontent\b)[^>]*>([\s\S]*?)<\/article>/i
    )?.[1] ??
    html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ??
    html;
  const blocks: StandardSiteArticleBlock[] = [];
  const tokenRegex =
    /<\s*(h[1-6]|p|li|pre|code)\b[^>]*>([\s\S]*?)<\/\s*\1\s*>|<\s*img\b([^>]*)>/gi;
  let token: RegExpExecArray | null = tokenRegex.exec(fragment);

  while (token) {
    const [, tag, innerHtml, imageAttrs] = token;

    if (imageAttrs !== undefined) {
      const image = getImageBlockFromHtmlAttributes(imageAttrs, baseUrl);

      if (image) blocks.push(image);
      token = tokenRegex.exec(fragment);
      continue;
    }

    const normalizedTag = tag.toLowerCase();

    if (normalizedTag.startsWith('h')) {
      const text = normalizeInlineText(
        htmlFragmentToMarkdownishText(innerHtml)
      );

      if (text && !(blocks.length === 0 && text === articleTitle))
        blocks.push({
          type: 'heading',
          level: Number(normalizedTag.slice(1)) || 2,
          text
        });
    } else if (normalizedTag === 'pre' || normalizedTag === 'code') {
      const text = normalizeInlineText(stripHtmlTags(innerHtml));

      if (text) blocks.push({ type: 'code', text });
    } else
      appendBlocksFromHtmlFragment(innerHtml, blocks, {
        baseUrl,
        listItem: normalizedTag === 'li'
      });

    token = tokenRegex.exec(fragment);
  }

  if (blocks.length) return blocks;

  const text = fragment
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .trim();

  return getBlocksFromMarkdown(decodeHtmlEntities(text), articleTitle);
}

function appendBlocksFromHtmlNode(
  node: ChildNode,
  blocks: StandardSiteArticleBlock[],
  articleTitle?: string,
  baseUrl?: string
): void {
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();

  if (/^h[1-6]$/.test(tag)) {
    const text = normalizeInlineText(element.textContent ?? '');

    if (text && !(blocks.length === 0 && text === articleTitle))
      blocks.push({ type: 'heading', level: Number(tag.slice(1)) || 2, text });
    return;
  }

  if (tag === 'p' || tag === 'li') {
    appendBlocksFromHtmlChildren(Array.from(element.childNodes), blocks, {
      baseUrl,
      listItem: tag === 'li'
    });
    return;
  }

  if (tag === 'pre' || tag === 'code') {
    const text = element.textContent?.trim();

    if (text) blocks.push({ type: 'code', text });
    return;
  }

  if (tag === 'img') {
    const image = getImageBlockFromHtmlElement(element, baseUrl);

    if (image) blocks.push(image);
    return;
  }

  element.childNodes.forEach((child) =>
    appendBlocksFromHtmlNode(child, blocks, articleTitle, baseUrl)
  );
}

function appendBlocksFromHtmlChildren(
  nodes: ChildNode[],
  blocks: StandardSiteArticleBlock[],
  {
    baseUrl,
    listItem
  }: {
    baseUrl?: string;
    listItem?: boolean;
  }
): void {
  const buffer: string[] = [];

  const flushText = (): void => {
    const text = normalizeInlineText(buffer.join(''));

    buffer.length = 0;
    if (!text) return;

    blocks.push({
      type: listItem ? 'list' : 'paragraph',
      text: listItem ? `• ${text}` : text
    });
  };

  const visit = (node: ChildNode): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      buffer.push(node.textContent ?? '');
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();

    if (tag === 'img') {
      flushText();
      const image = getImageBlockFromHtmlElement(element, baseUrl);

      if (image) blocks.push(image);
      return;
    }

    if (tag === 'br') {
      buffer.push('\n');
      return;
    }

    if (tag === 'strong' || tag === 'b') buffer.push('**');
    else if (tag === 'code') buffer.push('`');

    element.childNodes.forEach(visit);

    if (tag === 'strong' || tag === 'b') buffer.push('**');
    else if (tag === 'code') buffer.push('`');
  };

  nodes.forEach(visit);
  flushText();
}

function appendBlocksFromHtmlFragment(
  html: string,
  blocks: StandardSiteArticleBlock[],
  {
    baseUrl,
    listItem
  }: {
    baseUrl?: string;
    listItem?: boolean;
  }
): void {
  let cursor = 0;
  const imageRegex = /<\s*img\b([^>]*)>/gi;
  let image: RegExpExecArray | null = imageRegex.exec(html);

  const appendText = (value: string): void => {
    const text = normalizeInlineText(htmlFragmentToMarkdownishText(value));

    if (!text) return;
    blocks.push({
      type: listItem ? 'list' : 'paragraph',
      text: listItem ? `• ${text}` : text
    });
  };

  while (image) {
    if (image.index > cursor) appendText(html.slice(cursor, image.index));

    const imageBlock = getImageBlockFromHtmlAttributes(image[1], baseUrl);

    if (imageBlock) blocks.push(imageBlock);
    cursor = image.index + image[0].length;
    image = imageRegex.exec(html);
  }

  if (cursor < html.length) appendText(html.slice(cursor));
}

function getImageBlockFromHtmlElement(
  element: HTMLElement,
  baseUrl?: string
): StandardSiteArticleBlock | null {
  const url = resolveArticleAssetUrl(element.getAttribute('src'), baseUrl);

  if (!url) return null;

  return {
    type: 'image',
    url,
    alt: element.getAttribute('alt') ?? ''
  };
}

function getImageBlockFromHtmlAttributes(
  attrs: string,
  baseUrl?: string
): StandardSiteArticleBlock | null {
  const src = getHtmlAttribute(attrs, 'src');
  const url = resolveArticleAssetUrl(src, baseUrl);

  if (!url) return null;

  return {
    type: 'image',
    url,
    alt: getHtmlAttribute(attrs, 'alt') ?? ''
  };
}

function getHtmlAttribute(attrs: string, name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = attrs.match(
    new RegExp(
      `(?:^|\\s)${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
      'i'
    )
  );
  const value = match?.[1] ?? match?.[2] ?? match?.[3];

  return value ? decodeHtmlEntities(value) : null;
}

function resolveArticleAssetUrl(
  url: string | null | undefined,
  baseUrl?: string
): string | null {
  if (!url?.trim()) return null;

  try {
    return new URL(url.trim(), baseUrl).href;
  } catch {
    return /^https?:\/\//i.test(url.trim()) ? url.trim() : null;
  }
}

function htmlFragmentToMarkdownishText(html: string): string {
  return decodeHtmlEntities(
    stripHtmlTags(
      html
        .replace(/<\s*(strong|b)\b[^>]*>([\s\S]*?)<\/\s*\1\s*>/gi, '**$2**')
        .replace(/<\s*code\b[^>]*>([\s\S]*?)<\/\s*code\s*>/gi, '`$1`')
        .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    )
  );
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

function decodeHtmlEntities(text: string): string {
  if (typeof window === 'undefined') return text;

  const textarea = window.document.createElement('textarea');
  textarea.innerHTML = text;

  return textarea.value;
}

function normalizeInlineText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function hasRichArticleBlocks(blocks: StandardSiteArticleBlock[]): boolean {
  return blocks.some(({ type }) => type === 'heading' || type === 'image');
}

function getStandardSiteArticleHtmlProxyUrl(url: string): string | null {
  const proxy = process.env.NEXT_PUBLIC_STANDARD_SITE_HTML_PROXY?.trim();

  if (!proxy) return null;

  if (proxy.includes('{url}'))
    return proxy.replace('{url}', encodeURIComponent(url));

  try {
    const proxyUrl = new URL(proxy);
    proxyUrl.searchParams.set('url', url);

    return proxyUrl.href;
  } catch {
    return null;
  }
}

function getStandardSiteArticleReaderUrl(url: string): string {
  return `https://r.jina.ai/${url}`;
}

async function fetchStandardSiteArticleHTML(
  url: string
): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const cached = standardSiteArticleHTMLCache.get(url);

  if (cached) return cached;

  const request = (async (): Promise<string | null> => {
    const proxyUrl = getStandardSiteArticleHtmlProxyUrl(url);
    const candidates = proxyUrl
      ? [proxyUrl, url, getStandardSiteArticleReaderUrl(url)]
      : [url, getStandardSiteArticleReaderUrl(url)];

    for (const candidate of candidates)
      try {
        const response = await fetch(candidate, {
          credentials: 'omit',
          referrerPolicy: 'no-referrer'
        });

        if (!response.ok) continue;

        const html = await response.text();

        if (html.trim()) return html;
      } catch {
        // Cross-origin article hosts often block browsers; native clients can still use the same parser.
      }

    return null;
  })();

  standardSiteArticleHTMLCache.set(url, request);

  return request;
}

function getArticleDid(article: StandardSiteArticle): string | null {
  if (!article.documentURI?.startsWith('at://')) return null;

  return article.documentURI.slice(5).split('/')[0] || null;
}

function getBlobCid(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (!isRecord(value)) return null;

  if (typeof value.$link === 'string') return value.$link;
  if (typeof value.cid === 'string') return value.cid;

  return getBlobCid(value.ref);
}

function getImageURLFromObject(
  value: unknown,
  article?: StandardSiteArticle
): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();

    return /^https?:\/\//i.test(trimmed) ? trimmed : null;
  }

  if (!isRecord(value)) return null;

  for (const key of ['url', 'src', 'href', 'uri', 'fullsize', 'thumb']) {
    const url = getImageURLFromObject(value[key], article);

    if (url) return url;
  }

  for (const key of ['image', 'blob', 'file', 'media', 'raw']) {
    const url = getImageURLFromObject(value[key], article);

    if (url) return url;
  }

  const cid = getBlobCid(value);
  const did = article ? getArticleDid(article) : null;

  return cid && did
    ? `https://cdn.bsky.app/img/feed_fullsize/plain/${did}/${cid}@jpeg`
    : null;
}

function getBlockText(value: Record<string, unknown>): string | null {
  return getContentString(value);
}

function appendBlocksFromObject(
  value: unknown,
  blocks: StandardSiteArticleBlock[]
): void {
  if (Array.isArray(value)) {
    value.forEach((item) => appendBlocksFromObject(item, blocks));
    return;
  }

  if (!isRecord(value)) return;

  const type = typeof value.$type === 'string' ? value.$type.toLowerCase() : '';
  const text = getBlockText(value);

  if (/(header|heading)/.test(type) && text)
    blocks.push({ type: 'heading', level: 2, text });
  else if (type.includes('image')) {
    const url = getImageURLFromObject(value);

    blocks.push({
      type: 'image',
      raw: value,
      url: url ?? undefined,
      alt: typeof value.alt === 'string' ? value.alt : undefined
    });
  } else if (type.includes('code') && text) blocks.push({ type: 'code', text });
  else if (type.includes('list') && Array.isArray(value.items))
    value.items.forEach((item) => {
      const itemText = isRecord(item)
        ? getBlockText(item) ?? ''
        : String(item ?? '');

      if (itemText.trim()) blocks.push({ type: 'list', text: `• ${itemText}` });
    });
  else if (type.includes('text') && text)
    blocks.push({ type: 'paragraph', text });

  ['pages', 'blocks', 'children'].forEach((key) =>
    appendBlocksFromObject(value[key], blocks)
  );
}

function getBlocksFromStructuredContent(
  content: unknown
): StandardSiteArticleBlock[] {
  const blocks: StandardSiteArticleBlock[] = [];

  appendBlocksFromObject(content, blocks);

  return blocks;
}

function getStandardSiteArticleBlocks(
  article: StandardSiteArticle
): StandardSiteArticleBlock[] {
  const structuredBlocks = getBlocksFromStructuredContent(article.content);

  if (structuredBlocks.length) return structuredBlocks;

  const markdown = getMarkdownTextFromContent(article.content);

  if (markdown) return getBlocksFromMarkdown(markdown, article.title);

  const html = getHtmlTextFromContent(article.content);

  if (html) return getBlocksFromHtml(html, article.title, article.url);

  return getArticleParagraphs(article.textContent).map((text) => ({
    type: 'paragraph',
    text
  }));
}

function renderRichInlineText(text: string): ReactNode[] {
  const strippedText = text.replace(/!?\[([^\]]+)]\([^)]+\)/g, '$1');
  const parts = strippedText.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/g);

  return parts.filter(Boolean).map((part, index) => {
    if (
      (part.startsWith('**') && part.endsWith('**')) ||
      (part.startsWith('__') && part.endsWith('__'))
    )
      return <strong key={index}>{part.slice(2, -2)}</strong>;

    if (part.startsWith('`') && part.endsWith('`'))
      return (
        <code
          className='dark:bg-dark-hover rounded bg-light-line-reply px-1 py-0.5 font-mono text-[0.92em]'
          key={index}
        >
          {part.slice(1, -1)}
        </code>
      );

    return part;
  });
}

function useStandardSiteArticleReader(card: TweetCard): {
  article: StandardSiteArticle | null;
  loading: boolean;
} {
  const [article, setArticle] = useState<StandardSiteArticle | null>(null);
  const [loading, setLoading] = useState(false);
  const associatedRefKey =
    card.associatedRefs?.map(({ uri }) => uri).join('|') ?? '';

  useEffect(() => {
    let canceled = false;

    setArticle(null);

    if (!associatedRefKey) {
      setLoading(false);
      return;
    }

    setLoading(true);

    void import('@lib/atproto/backend')
      .then(({ getStandardSiteArticle }) => getStandardSiteArticle(card))
      .then((nextArticle) => {
        if (!canceled) setArticle(nextArticle);
      })
      .catch(() => {
        if (!canceled) setArticle(null);
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });

    return () => {
      canceled = true;
    };
  }, [associatedRefKey, card]);

  return { article, loading };
}

function ArticleNotificationButton({
  author
}: {
  author?: ArticleNotificationAuthor | null;
}): JSX.Element | null {
  const { user } = useAuth();
  const [categories, setCategories] = useState<ActivityNotificationCategory[]>(
    author?.activityNotificationCategories ?? []
  );
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!updating) setCategories(author?.activityNotificationCategories ?? []);
  }, [author?.activityNotificationCategories, updating]);

  if (!author || !user || user.id === author.id) return null;

  const enabled = activityNotificationCategoriesInclude(categories, 'articles');
  const alreadyFollowing = author.followers.includes(user.id);

  const handleClick = async (
    event: MouseEvent<HTMLButtonElement>
  ): Promise<void> => {
    event.preventDefault();
    event.stopPropagation();
    if (updating) return;

    const previous = categories;
    const next: ActivityNotificationCategory[] = ['articles'];
    setUpdating(true);
    setCategories(next);

    try {
      const { followUser, setActivityNotificationCategoriesForUser } =
        await import('@lib/atproto/backend');
      if (!alreadyFollowing) await followUser(author.id);
      const saved = await setActivityNotificationCategoriesForUser(
        author.id,
        next
      );
      setCategories(saved);
    } catch {
      setCategories(previous);
      toast.error(
        alreadyFollowing
          ? 'Could not turn on article notifications'
          : 'Could not follow and turn on article notifications'
      );
    } finally {
      setUpdating(false);
    }
  };

  return (
    <button
      className={cn(
        `mt-3 flex w-full items-center gap-2 border-t border-light-border pt-3 text-left
         text-[15px] font-bold leading-5 outline-none hover:underline focus-visible:underline
         dark:border-dark-border`,
        enabled
          ? 'text-main-accent'
          : 'text-light-primary dark:text-dark-primary'
      )}
      type='button'
      disabled={updating}
      onClick={handleClick}
    >
      <CustomIcon
        className='h-5 w-5 shrink-0'
        iconName={
          enabled
            ? 'TwitterNotificationsFilledIcon'
            : 'TwitterNotificationsIcon'
        }
      />
      <span className='min-w-0 truncate'>
        {enabled
          ? `Article notifications on for @${author.username}`
          : alreadyFollowing
          ? `Notify me of articles from @${author.username}`
          : `Follow & Notify me about articles from @${author.username}`}
      </span>
    </button>
  );
}

function isVideoCardImage(src: string): boolean {
  return /\.(mp4|mov|m4v|webm)($|\?)/i.test(src);
}

function isAnimatedCardImage(src: string): boolean {
  return /\.(gif|webp)($|\?)/i.test(src);
}

function LinkCardPreviewMedia({ card }: LinkCardProps): JSX.Element {
  const image = card.image as string;
  const className = 'absolute inset-0 h-full w-full object-cover';

  if (isVideoCardImage(image))
    return (
      <video
        className={className}
        src={image}
        autoPlay
        loop
        muted
        playsInline
      />
    );

  if (isAnimatedCardImage(image))
    return <img className={className} src={image} alt='' draggable={false} />;

  return (
    <NextImage
      className='absolute inset-0'
      imgClassName='object-cover'
      layout='fill'
      src={image}
      alt=''
      useSkeleton
    />
  );
}

function LinkCardSourceIcon({
  card,
  className,
  size = 20
}: LinkCardProps & { className?: string; size?: number }): JSX.Element {
  const sourceTitle = card.source?.title ?? card.domain ?? 'Link';

  if (card.source?.icon)
    return (
      <NextImage
        className={cn(
          'dark:bg-dark-hover shrink-0 overflow-hidden rounded bg-light-line-reply',
          className
        )}
        imgClassName='object-cover'
        src={card.source.icon}
        alt=''
        width={size}
        height={size}
        useSkeleton
      />
    );

  return (
    <span
      className={cn(
        `dark:bg-dark-hover flex shrink-0 items-center justify-center rounded
         bg-light-line-reply text-[13px] font-bold uppercase text-light-secondary
         dark:text-dark-secondary`,
        className
      )}
      aria-hidden='true'
    >
      {sourceTitle.slice(0, 1)}
    </span>
  );
}

function LinkCardImage({ card, compact }: LinkCardProps): JSX.Element | null {
  if (!card.image && !compact) return null;

  if (!card.image)
    return (
      <div className='dark:bg-dark-hover flex h-full w-[94px] shrink-0 items-center justify-center bg-light-line-reply text-light-secondary dark:text-dark-secondary'>
        {isStandardSiteCard(card) ? (
          <LinkCardSourceIcon
            card={card}
            compact
            className='h-10 w-10'
            size={40}
          />
        ) : (
          <HeroIcon className='h-7 w-7' iconName='LinkIcon' />
        )}
      </div>
    );

  if (compact)
    return (
      <div className='dark:bg-dark-hover relative h-full w-[94px] shrink-0 bg-light-line-reply'>
        <LinkCardPreviewMedia card={card} compact />
      </div>
    );

  return (
    <div className='dark:bg-dark-hover relative w-full overflow-hidden bg-light-line-reply pt-[52.35%]'>
      <LinkCardPreviewMedia card={card} />
    </div>
  );
}

function EnhancedLinkCardSourceRow({ card }: LinkCardProps): JSX.Element {
  const sourceTitle = card.source?.title ?? card.domain ?? card.url;
  const meta = getEnhancedCardMeta(card);

  return (
    <div className='mb-1 flex min-w-0 items-center gap-1.5 text-[13px] leading-4 text-light-secondary dark:text-dark-secondary'>
      <LinkCardSourceIcon card={card} className='h-5 w-5' />
      <span className='truncate'>{sourceTitle}</span>
      {meta.map((item) => (
        <span className='flex shrink-0 items-center gap-1.5' key={item}>
          <span aria-hidden='true'>·</span>
          <span>{item}</span>
        </span>
      ))}
    </div>
  );
}

function ArticleCover({ card }: LinkCardProps): JSX.Element {
  if (card.image)
    return (
      <div className='dark:bg-dark-hover relative w-full overflow-hidden bg-light-line-reply pt-[52.35%]'>
        <LinkCardPreviewMedia card={card} />
      </div>
    );

  return (
    <div className='dark:bg-dark-hover flex h-[140px] w-full items-center justify-center bg-light-line-reply text-light-secondary dark:text-dark-secondary'>
      <LinkCardSourceIcon
        card={card}
        className='h-16 w-16 rounded-lg'
        size={64}
      />
    </div>
  );
}

function TweetStandardSiteArticleCard({
  card,
  fullArticleReader = false,
  title,
  description,
  articleAuthor,
  onOpenArticle
}: LinkCardProps & {
  title: string;
  description: string | null;
  onOpenArticle: (event: CardEvent) => void;
}): JSX.Element {
  const { article, loading } = useStandardSiteArticleReader(card);
  const visibleTitle = article?.title ?? title;
  const visibleDescription = article?.description ?? description;

  return (
    <article
      className={cn(
        'mt-2 overflow-hidden rounded-2xl border border-light-border bg-main-background text-left dark:border-dark-border',
        !fullArticleReader &&
          'cursor-pointer transition-colors hover:bg-light-primary/[0.03] focus-visible:bg-light-primary/[0.03] focus-visible:outline-none dark:hover:bg-dark-primary/[0.03] dark:focus-visible:bg-dark-primary/[0.03]'
      )}
      role={fullArticleReader ? undefined : 'button'}
      tabIndex={fullArticleReader ? undefined : 0}
      aria-label={fullArticleReader ? undefined : `Open ${visibleTitle}`}
      onClick={fullArticleReader ? undefined : onOpenArticle}
      onKeyDown={fullArticleReader ? undefined : onEnterOrSpace(onOpenArticle)}
    >
      <ArticleCover card={card} />
      <div className='min-w-0 px-4 py-3'>
        <EnhancedLinkCardSourceRow card={card} />
        <h2 className='line-clamp-3 text-[22px] font-extrabold leading-7 text-light-primary dark:text-dark-primary'>
          {visibleTitle}
        </h2>
        {visibleDescription && (
          <p className='line-clamp-3 mt-1 text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
            {visibleDescription}
          </p>
        )}
        <button
          className='mt-2 inline-flex items-center gap-1 text-[15px] font-bold leading-5 text-main-accent outline-none hover:underline focus-visible:underline'
          type='button'
          onClick={onOpenArticle}
        >
          Read article
          <HeroIcon className='h-4 w-4' iconName='ArrowTopRightOnSquareIcon' />
        </button>
        {fullArticleReader && (
          <ArticleNotificationButton author={articleAuthor} />
        )}
        {article ? (
          <StandardSiteArticleBody
            article={article}
            fullArticleReader={fullArticleReader}
          />
        ) : loading ? (
          <StandardSiteArticleSkeleton />
        ) : null}
      </div>
    </article>
  );
}

function StandardSiteArticleSkeleton(): JSX.Element {
  return (
    <div className='mt-4 space-y-2 border-t border-light-border pt-4 dark:border-dark-border'>
      <div className='dark:bg-dark-hover h-3.5 w-full animate-pulse rounded bg-light-line-reply' />
      <div className='dark:bg-dark-hover h-3.5 w-11/12 animate-pulse rounded bg-light-line-reply' />
      <div className='dark:bg-dark-hover h-3.5 w-4/5 animate-pulse rounded bg-light-line-reply' />
    </div>
  );
}

function StandardSiteArticleBody({
  article,
  fullArticleReader
}: {
  article: StandardSiteArticle;
  fullArticleReader: boolean;
}): JSX.Element {
  const articleBlocks = useMemo(
    () => getStandardSiteArticleBlocks(article),
    [article]
  );
  const [htmlBlocks, setHtmlBlocks] = useState<
    StandardSiteArticleBlock[] | null
  >(null);
  const blocks = htmlBlocks ?? articleBlocks;
  const excerpt = useMemo(
    () => getArticleExcerpt(article.textContent),
    [article.textContent]
  );

  useEffect(() => {
    let canceled = false;

    setHtmlBlocks(null);

    if (!fullArticleReader || hasRichArticleBlocks(articleBlocks)) return;

    void fetchStandardSiteArticleHTML(article.url).then((html) => {
      if (canceled || !html) return;

      const parsedBlocks = getBlocksFromHtml(html, article.title, article.url);

      if (hasRichArticleBlocks(parsedBlocks)) setHtmlBlocks(parsedBlocks);
    });

    return () => {
      canceled = true;
    };
  }, [article.url, article.title, articleBlocks, fullArticleReader]);

  return (
    <div className='mt-4 border-t border-light-border pt-4 dark:border-dark-border'>
      {fullArticleReader ? (
        <div className='space-y-3 text-[17px] leading-6 text-light-primary dark:text-dark-primary'>
          {blocks.map((block, index) => (
            <StandardSiteArticleBlockView
              article={article}
              block={block}
              key={`${article.url}-${index}`}
            />
          ))}
        </div>
      ) : (
        <p className='text-[17px] leading-6 text-light-primary dark:text-dark-primary'>
          {excerpt}
        </p>
      )}
    </div>
  );
}

function StandardSiteArticleBlockView({
  article,
  block
}: {
  article: StandardSiteArticle;
  block: StandardSiteArticleBlock;
}): JSX.Element | null {
  if (block.type === 'image') {
    const url = block.url ?? getImageURLFromObject(block.raw, article);

    if (!url) return null;

    return (
      <img
        className='dark:bg-dark-hover max-h-[420px] w-full rounded-xl bg-light-line-reply object-contain'
        src={url}
        alt={block.alt ?? ''}
        loading='lazy'
        draggable={false}
      />
    );
  }

  if (block.type === 'heading') {
    const Heading = block.level <= 2 ? 'h3' : 'h4';

    return (
      <Heading className='pt-1 text-[20px] font-extrabold leading-6 text-light-primary dark:text-dark-primary'>
        {renderRichInlineText(block.text)}
      </Heading>
    );
  }

  if (block.type === 'code')
    return (
      <pre className='dark:bg-dark-hover overflow-x-auto rounded-xl bg-light-line-reply p-3 text-[14px] leading-5'>
        <code>{block.text}</code>
      </pre>
    );

  return (
    <p
      className={cn(
        'text-[17px] leading-6 text-light-primary dark:text-dark-primary',
        block.type === 'list' && 'pl-2'
      )}
    >
      {renderRichInlineText(block.text)}
    </p>
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

function TweetLinkCard({
  card,
  compact,
  fullArticleReader = false,
  standardSiteArticlesInline = false,
  articleAuthor,
  articleTweetPath
}: LinkCardProps): JSX.Element {
  const router = useRouter();
  const title = getCardTitle(card);
  const description = getCardDescription(card);
  const youtubeVideo = getYouTubeVideoInfo(card.url);
  const enhanced = isStandardSiteCard(card);
  const isCompact = compact === true || card.type === 'summary' || !card.image;
  const openCard = (event: CardEvent): void => {
    stopOuterTweet(event);

    if (enhanced) {
      if (articleTweetPath) void router.push(articleTweetPath);
      return;
    }

    if (card.url.startsWith('/')) {
      void router.push(card.url);
      return;
    }

    window.open(card.url, '_blank', 'noopener,noreferrer');
  };

  if (youtubeVideo && compact !== true)
    return <TweetYouTubeCard card={card} video={youtubeVideo} />;

  if (standardSiteArticlesInline && enhanced && compact !== true)
    return (
      <TweetStandardSiteArticleCard
        card={card}
        fullArticleReader={fullArticleReader}
        title={title}
        description={description}
        articleAuthor={articleAuthor}
        articleTweetPath={articleTweetPath}
        onOpenArticle={openCard}
      />
    );

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
            {enhanced ? (
              <EnhancedLinkCardSourceRow card={card} />
            ) : (
              <p className='truncate text-sm text-light-secondary dark:text-dark-secondary'>
                {card.domain ?? card.url}
              </p>
            )}
            <p
              className={cn(
                'text-[15px] leading-5 text-light-primary dark:text-dark-primary',
                enhanced ? 'line-clamp-2' : 'truncate'
              )}
            >
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
        {enhanced ? (
          <EnhancedLinkCardSourceRow card={card} />
        ) : (
          <p className='truncate text-sm text-light-secondary dark:text-dark-secondary'>
            {card.domain ?? card.url}
          </p>
        )}
        <p
          className={cn(
            'text-[15px] leading-5 text-light-primary dark:text-dark-primary',
            enhanced ? 'line-clamp-2' : 'truncate'
          )}
        >
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
  if (quotedTweet.unavailable === 'blocked')
    return <TweetTombstone kind='limited-visibility' className='mt-2' />;

  return <TweetTombstone kind='unavailable' className='mt-2' />;
}

function isVideoLikeMedia({ src, type }: ImageData): boolean {
  return (
    !!type?.includes('video') || /\.(m3u8|mp4|mov|m4v|webm)($|\?)/i.test(src)
  );
}

function isGifLikeMedia({ src, type }: ImageData): boolean {
  return type === 'gif' || !!type?.includes('gif') || /\.gif($|\?)/i.test(src);
}

function getMediaThumbnailSrc(media: ImageData): string | null | undefined {
  return isVideoLikeMedia(media) ? media.poster : media.poster ?? media.src;
}

function getQuotedCardPreviewMedia(
  card: TweetCard | null
): ImagesPreview | null {
  if (!card?.image) return null;

  return [
    {
      id: `${card.url}-quote-card-preview`,
      src: card.image,
      alt: card.title,
      type: card.type === 'youtube' ? 'video' : 'image',
      poster: card.image,
      aspectRatio: null
    }
  ];
}

function getQuotedTweetPreviewMedia({
  quotedTweet,
  card,
  hideMedia,
  expanded
}: {
  quotedTweet: EmbeddedTweet;
  card: TweetCard | null;
  hideMedia?: boolean;
  expanded?: boolean;
}): ImagesPreview | null {
  if (hideMedia || expanded) return null;

  if (quotedTweet.images?.length) return quotedTweet.images;

  return getQuotedCardPreviewMedia(card);
}

function getQuoteMediaGridClassName(
  index: number,
  previewCount: number
): string {
  if (previewCount === 1) return 'col-span-2 row-span-2';

  if (previewCount === 2) return 'row-span-2';

  if (previewCount === 3 && index === 0) return 'row-span-2';

  return '';
}

function QuotedTweetMediaThumbnail({
  media
}: {
  media: ImagesPreview;
}): JSX.Element {
  const visibleMedia = media.slice(0, 4);
  const firstMedia = visibleMedia[0];
  const previewCount = visibleMedia.length;
  const isVideo = !!firstMedia && isVideoLikeMedia(firstMedia);
  const isGif = !!firstMedia && isGifLikeMedia(firstMedia);
  const showBadge = previewCount === 1 && (isVideo || isGif);

  return (
    <div
      className='dark:bg-dark-hover relative grid h-[110px] w-[110px] shrink-0
                 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-xl bg-light-line-reply'
    >
      {visibleMedia.map((item, index) => {
        const thumbnailSrc = getMediaThumbnailSrc(item);

        return (
          <div
            className={cn(
              'relative min-h-0 min-w-0 overflow-hidden',
              getQuoteMediaGridClassName(index, previewCount)
            )}
            key={`${item.id}-${index}`}
          >
            {thumbnailSrc ? (
              <NextImage
                className='absolute inset-0'
                imgClassName='object-cover object-center'
                layout='fill'
                src={thumbnailSrc}
                alt={item.alt}
                useSkeleton
              />
            ) : (
              <div className='flex h-full w-full items-center justify-center text-light-secondary dark:text-dark-secondary'>
                <HeroIcon className='h-7 w-7' iconName='PlayIcon' solid />
              </div>
            )}
          </div>
        );
      })}
      {showBadge && (
        <span
          className='absolute bottom-2 left-2 flex h-5 items-center rounded
                     bg-black/40 px-[5px] text-[13px] font-bold leading-4 text-white'
        >
          {isGif ? (
            'GIF'
          ) : (
            <HeroIcon className='h-3 w-3' iconName='PlayIcon' solid />
          )}
        </span>
      )}
    </div>
  );
}

function getQuotedTweetCardClassName(
  viewTweet?: boolean,
  expanded?: boolean
): string {
  return cn(
    '!rounded-2xl',
    viewTweet && 'mt-3',
    expanded && 'overflow-visible'
  );
}

function getQuotedTweetTextClampStyle(
  expanded?: boolean
): CSSProperties | undefined {
  if (expanded) return undefined;

  return {
    ...quotedTweetPreviewTextStyleBase,
    WebkitLineClamp: 4
  };
}

function QuotedTweetHeader({
  quotedTweet
}: {
  quotedTweet: EmbeddedTweet;
}): JSX.Element {
  const { hideBskySocialSuffix } = useTheme();
  const authorUsername = formatAtprotoDisplayIdentifier(
    quotedTweet.authorUsername,
    { hideBskySocialSuffix }
  );

  return (
    <div className='flex min-w-0 items-center gap-1 text-[15px] leading-5'>
      {quotedTweet.authorAvatar && (
        <NextImage
          className='profile-picture mr-1 shrink-0'
          imgClassName='profile-picture'
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
          {authorUsername}
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
  );
}

function QuotedTweetCard({
  quotedTweet,
  viewTweet,
  hideMedia,
  expanded
}: {
  quotedTweet: EmbeddedTweet;
  viewTweet?: boolean;
  hideMedia?: boolean;
  expanded?: boolean;
}): JSX.Element {
  const router = useRouter();
  const [tombstoneRevealed, setTombstoneRevealed] = useState(false);

  useEffect(() => {
    setTombstoneRevealed(false);
  }, [quotedTweet.id, quotedTweet.tombstone]);

  if (quotedTweet.unavailable)
    return <TweetUnavailableCard quotedTweet={quotedTweet} />;

  if (quotedTweet.tombstone && !tombstoneRevealed)
    return (
      <TweetTombstone
        kind={quotedTweet.tombstone}
        className='mt-2'
        onView={
          isViewableTweetTombstoneKind(quotedTweet.tombstone)
            ? (): void => setTombstoneRevealed(true)
            : undefined
        }
      />
    );

  const quotedTweetCard = hideMedia
    ? null
    : quotedTweet.card ?? createYouTubeCardFromText(quotedTweet.text);
  const expandPreview = expanded && !hideMedia;
  const compactMedia = getQuotedTweetPreviewMedia({
    quotedTweet,
    card: quotedTweetCard,
    hideMedia,
    expanded: expandPreview
  });
  const quotedTweetCardPreview = expandPreview ? quotedTweetCard : null;
  const tweetHref = quotedTweet.id
    ? getTweetPath(quotedTweet.id, quotedTweet.authorUsername)
    : null;
  const openTweet = (event: CardEvent): void => {
    stopOuterTweet(event);
    if (tweetHref) void router.push(tweetHref);
  };

  return (
    <CardShell
      className={getQuotedTweetCardClassName(viewTweet, expandPreview)}
      ariaLabel={`Tweet by ${quotedTweet.authorName ?? 'unknown user'}`}
      onClick={openTweet}
      onKeyDown={onEnterOrSpace(openTweet)}
    >
      <div
        className={cn(
          'min-w-0 overflow-hidden px-3 py-3',
          expandPreview && 'overflow-visible'
        )}
      >
        {compactMedia ? (
          <>
            <QuotedTweetHeader quotedTweet={quotedTweet} />
            <div className='mt-2 flex min-w-0 gap-3'>
              <QuotedTweetMediaThumbnail media={compactMedia} />
              <div className='min-w-0 flex-1'>
                {quotedTweet.text && (
                  <TweetText
                    className='text-[15px] leading-5 text-light-primary dark:text-dark-primary'
                    style={getQuotedTweetTextClampStyle()}
                    text={quotedTweet.text}
                  />
                )}
                {quotedTweet.text && (
                  <TweetTranslation
                    className='text-[14px] leading-5'
                    text={quotedTweet.text}
                    langs={quotedTweet.langs}
                  />
                )}
              </div>
            </div>
          </>
        ) : quotedTweet.text ? (
          <>
            <QuotedTweetHeader quotedTweet={quotedTweet} />
            <TweetText
              className='mt-1 text-[15px] leading-5 text-light-primary dark:text-dark-primary'
              style={getQuotedTweetTextClampStyle(expandPreview)}
              text={quotedTweet.text}
            />
            <TweetTranslation
              className='text-[14px] leading-5'
              text={quotedTweet.text}
              langs={quotedTweet.langs}
            />
          </>
        ) : (
          <QuotedTweetHeader quotedTweet={quotedTweet} />
        )}
        {!hideMedia && !compactMedia && quotedTweet.images && (
          <ImagePreview
            tweet
            imagesPreview={quotedTweet.images}
            previewCount={quotedTweet.images.length}
            moderationWarning={quotedTweet.mediaWarning}
          />
        )}
        {quotedTweetCardPreview && (
          <TweetLinkCard
            card={quotedTweetCardPreview}
            compact
            articleTweetPath={tweetHref}
          />
        )}
      </div>
    </CardShell>
  );
}

export function TweetEmbed({
  card,
  quotedTweet,
  viewTweet,
  hideQuotedTweetMedia,
  expandQuotedTweet,
  articleAuthor,
  articleTweetPath
}: TweetEmbedProps): JSX.Element | null {
  const { standardSiteArticlesInline } = useStandardSiteArticlesInline();

  if (!card && !quotedTweet) return null;

  return (
    <>
      {card && (
        <TweetLinkCard
          card={card}
          fullArticleReader={viewTweet}
          standardSiteArticlesInline={standardSiteArticlesInline}
          articleAuthor={articleAuthor}
          articleTweetPath={articleTweetPath}
        />
      )}
      {quotedTweet && (
        <QuotedTweetCard
          quotedTweet={quotedTweet}
          viewTweet={viewTweet}
          hideMedia={hideQuotedTweetMedia}
          expanded={expandQuotedTweet}
        />
      )}
    </>
  );
}

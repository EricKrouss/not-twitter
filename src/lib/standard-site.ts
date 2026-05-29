import type { TweetCard } from './types/tweet';

export function isStandardSiteArticleCard(card: TweetCard | null): boolean {
  if (!card) return false;
  if (card.domain?.toLowerCase() === 'standard.site') return true;
  if (/^https?:\/\/(?:www\.)?standard\.site\//i.test(card.url)) return true;

  return (
    !!card.source ||
    !!card.readingTime ||
    !!card.createdAt ||
    !!card.associatedRefs?.some(({ uri }) => uri.includes('/site.standard.'))
  );
}

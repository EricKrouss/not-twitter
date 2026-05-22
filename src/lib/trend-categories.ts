type TrendTopicForCategory = {
  topic: string;
  displayName?: string;
  description?: string;
  [key: string]: unknown;
};

type TrendCategoryRule = {
  category: string;
  keywords: readonly string[];
};

const PROVIDED_CATEGORY_KEYS = ['category', 'categoryName', 'topicCategory'];

const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  ai: 'Technology',
  business: 'Business',
  entertainment: 'Entertainment',
  feeds: 'Feeds',
  gaming: 'Gaming',
  lifestyle: 'Lifestyle',
  movies: 'Entertainment',
  music: 'Entertainment',
  news: 'News',
  politics: 'Politics',
  science: 'Science',
  sports: 'Sports',
  technology: 'Technology',
  world: 'World'
};

const TREND_CATEGORY_OVERRIDES: Record<string, string> = {
  'andy burnham': 'Politics',
  'ben palmer': 'Politics',
  'digital art': 'Entertainment',
  desantis: 'Politics',
  'epstein files': 'Entertainment',
  'gop bill delay': 'Politics',
  'ice protests': 'Politics',
  'stephen colbert': 'Entertainment',
  'trans rights': 'Politics'
};

const TREND_CATEGORY_RULES: readonly TrendCategoryRule[] = [
  {
    category: 'World',
    keywords: [
      'conflict',
      'diplomacy',
      'foreign policy',
      'global',
      'middle east',
      'nato',
      'palestine',
      'russia',
      'ukraine',
      'war',
      'world'
    ]
  },
  {
    category: 'Politics',
    keywords: [
      'administration',
      'biden',
      'bill',
      'civil rights',
      'congress',
      'court',
      'democrat',
      'democratic',
      'election',
      'gop',
      'government',
      'governor',
      'harris',
      'human rights',
      'ice',
      'immigration',
      'lgbtq',
      'mayor',
      'minister',
      'obama',
      'parliament',
      'party',
      'policy',
      'politics',
      'president',
      'prime minister',
      'protest',
      'republican',
      'senate',
      'supreme court',
      'transgender',
      'trump',
      'white house'
    ]
  },
  {
    category: 'Sports',
    keywords: [
      'baseball',
      'basketball',
      'champions league',
      'f1',
      'football',
      'mlb',
      'nba',
      'nfl',
      'nhl',
      'olympics',
      'soccer',
      'sports',
      'wnba',
      'world cup'
    ]
  },
  {
    category: 'Entertainment',
    keywords: [
      'album',
      'anime',
      'art',
      'artist',
      'celebrity',
      'cinema',
      'comedian',
      'comedy',
      'film',
      'films',
      'movie',
      'movies',
      'music',
      'oscars',
      'pop culture',
      'review',
      'show',
      'television',
      'tv'
    ]
  },
  {
    category: 'Gaming',
    keywords: [
      'game dev',
      'game development',
      'gaming',
      'nintendo',
      'playstation',
      'steam',
      'video game',
      'xbox'
    ]
  },
  {
    category: 'Technology',
    keywords: [
      'ai',
      'android',
      'apple',
      'bluesky',
      'google',
      'ios',
      'openai',
      'programming',
      'software',
      'tech',
      'technology',
      'web dev'
    ]
  },
  {
    category: 'Business',
    keywords: [
      'business',
      'crypto',
      'economy',
      'market',
      'stock',
      'stocks',
      'tariff'
    ]
  },
  {
    category: 'Science',
    keywords: ['climate', 'nasa', 'science', 'space']
  },
  {
    category: 'Lifestyle',
    keywords: ['beauty', 'fashion', 'fitness', 'food', 'gardening', 'health']
  },
  {
    category: 'News',
    keywords: ['breaking news', 'headline', 'news', 'report']
  }
] as const;

function normalizeCategoryText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[#_]+/g, ' ')
    .replace(/[^a-z0-9&/ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatProvidedCategory(value: string): string | null {
  const normalizedCategory = normalizeCategoryText(value);

  if (!normalizedCategory) return null;

  return (
    CATEGORY_DISPLAY_NAMES[normalizedCategory] ??
    normalizedCategory.replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function getProvidedTrendCategory(topic: TrendTopicForCategory): string | null {
  for (const key of PROVIDED_CATEGORY_KEYS) {
    const value = topic[key];

    if (typeof value === 'string') return formatProvidedCategory(value);
  }

  return null;
}

function containsCategoryKeyword(value: string, keyword: string): boolean {
  const normalizedKeyword = normalizeCategoryText(keyword);
  const escapedKeyword = normalizedKeyword.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );

  return new RegExp(`(^|[^a-z0-9])${escapedKeyword}([^a-z0-9]|$)`).test(value);
}

export function getTrendCategory(topic: TrendTopicForCategory): string | null {
  const providedCategory = getProvidedTrendCategory(topic);

  if (providedCategory) return providedCategory;

  const normalizedTopic = normalizeCategoryText(topic.topic);
  const override = TREND_CATEGORY_OVERRIDES[normalizedTopic];

  if (override) return override;

  const searchableText = normalizeCategoryText(
    `${topic.topic} ${topic.displayName ?? ''} ${topic.description ?? ''}`
  );
  const matchingRule = TREND_CATEGORY_RULES.find(({ keywords }) =>
    keywords.some((keyword) => containsCategoryKeyword(searchableText, keyword))
  );

  return matchingRule?.category ?? null;
}

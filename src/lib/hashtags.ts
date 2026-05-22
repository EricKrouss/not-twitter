export type ActiveHashtag = {
  start: number;
  end: number;
  query: string;
};

export type ActiveMention = {
  start: number;
  end: number;
  query: string;
};

export const hashtagSuggestions = [
  'indiegame',
  'indiedev',
  'gamedev',
  'screenshotsaturday',
  'pixelart',
  'gameart',
  'gamemaker',
  'unity3d',
  'godot',
  'madewithunity'
];

export function normalizeHashtag(tag: string): string {
  return tag.replace(/^#+/, '').trim();
}

export function normalizeMention(username: string): string {
  return username
    .replace(/^@+/, '')
    .replace(/[.,:;!?]+$/, '')
    .trim();
}

export function getHashtagSearchQuery(tag: string): string {
  return `#${normalizeHashtag(tag)}`;
}

export function getActiveHashtag(
  value: string,
  cursorPosition: number
): ActiveHashtag | null {
  const beforeCursor = value.slice(0, cursorPosition);
  const match = beforeCursor.match(/(?:^|[\s([{])#([A-Za-z0-9_]*)$/);

  if (!match) return null;

  const hashIndex = beforeCursor.lastIndexOf('#');

  return {
    start: hashIndex,
    end: cursorPosition,
    query: match[1]
  };
}

export function getActiveMention(
  value: string,
  cursorPosition: number
): ActiveMention | null {
  const beforeCursor = value.slice(0, cursorPosition);
  const match = beforeCursor.match(/(?:^|[\s([{])@([A-Za-z0-9_.-]*)$/);

  if (!match) return null;

  const mentionIndex = beforeCursor.lastIndexOf('@');

  return {
    start: mentionIndex,
    end: cursorPosition,
    query: match[1]
  };
}

export function getHashtagSuggestions(query: string): string[] {
  const normalizedQuery = normalizeHashtag(query).toLowerCase();
  const filteredSuggestions = hashtagSuggestions.filter((tag) =>
    tag.toLowerCase().startsWith(normalizedQuery)
  );

  if (
    normalizedQuery &&
    !filteredSuggestions.some((tag) => tag.toLowerCase() === normalizedQuery)
  )
    return [normalizedQuery, ...filteredSuggestions].slice(0, 6);

  return filteredSuggestions.slice(0, 6);
}

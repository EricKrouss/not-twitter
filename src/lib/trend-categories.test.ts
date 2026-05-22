import { getTrendCategory } from './trend-categories';

const trendTopic = (
  topic: string,
  extra?: Record<string, unknown>
): Record<string, unknown> & { topic: string; link: string } => ({
  topic,
  link: `/profile/trending.bsky.app/feed/${topic}`,
  ...extra
});

describe('getTrendCategory', () => {
  it('categorizes current Bluesky topics instead of falling back to News', () => {
    expect(getTrendCategory(trendTopic('Obama Criticism'))).toBe('Politics');
    expect(getTrendCategory(trendTopic('Trans Rights'))).toBe('Politics');
    expect(getTrendCategory(trendTopic('Stephen Colbert'))).toBe(
      'Entertainment'
    );
    expect(getTrendCategory(trendTopic('Movies Discussion'))).toBe(
      'Entertainment'
    );
    expect(getTrendCategory(trendTopic('Game Development'))).toBe('Gaming');
    expect(getTrendCategory(trendTopic('Ukraine Conflict'))).toBe('World');
    expect(getTrendCategory(trendTopic('Democratic Party'))).toBe('Politics');
    expect(getTrendCategory(trendTopic('Andy Burnham'))).toBe('Politics');
    expect(getTrendCategory(trendTopic('DeSantis'))).toBe('Politics');
  });

  it('uses a provided upstream category when one exists', () => {
    expect(
      getTrendCategory(trendTopic('Anything', { category: 'sports' }))
    ).toBe('Sports');
  });

  it('does not invent a News category for unmatched topics', () => {
    expect(
      getTrendCategory(trendTopic('Completely Unmapped Topic'))
    ).toBeNull();
  });
});

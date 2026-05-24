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
    expect(getTrendCategory(trendTopic('NBA Playoffs'))).toBe('Sports');
    expect(getTrendCategory(trendTopic('Knicks'))).toBe('Sports');
    expect(getTrendCategory(trendTopic('Wrestling'))).toBe('Sports');
    expect(getTrendCategory(trendTopic('Svengoolie'))).toBe('Entertainment');
    expect(getTrendCategory(trendTopic('BFC Registration'))).toBe('Events');
    expect(getTrendCategory(trendTopic('Texier'))).toBe('Sports');
    expect(getTrendCategory(trendTopic('Habs'))).toBe('Sports');
    expect(getTrendCategory(trendTopic('Epstein Scandals'))).toBe('Politics');
    expect(getTrendCategory(trendTopic('Missile Threat'))).toBe('World');
    expect(getTrendCategory(trendTopic('Iran Agreement'))).toBe('World');
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
    expect(getTrendCategory(trendTopic('The Mandalorian'))).toBe(
      'Entertainment'
    );
    expect(getTrendCategory(trendTopic('Indie Games'))).toBe('Gaming');
    expect(getTrendCategory(trendTopic('European Cities'))).toBe('World');
    expect(getTrendCategory(trendTopic('UWCL Final'))).toBe('Sports');
    expect(getTrendCategory(trendTopic('1970s Music'))).toBe('Entertainment');
    expect(getTrendCategory(trendTopic('Hull FC'))).toBe('Sports');
    expect(getTrendCategory(trendTopic('Canadian GP'))).toBe('Sports');
    expect(getTrendCategory(trendTopic('Formula 1'))).toBe('Sports');
    expect(getTrendCategory(trendTopic('Colbert Show'))).toBe('Entertainment');
    expect(getTrendCategory(trendTopic('Blue Sky Art Show'))).toBe('Arts');
    expect(getTrendCategory(trendTopic('Tall Photography'))).toBe('Arts');
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

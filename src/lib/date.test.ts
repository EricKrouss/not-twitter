import { Timestamp } from './atproto/timestamp';
import { formatDate } from './date';

function timestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}

describe('date formatting', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 4, 24, 1, 0, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('formats tweets younger than 24 hours as compact relative ages', () => {
    expect(
      formatDate(timestamp(new Date(2026, 4, 24, 0, 59, 31)), 'tweet')
    ).toBe('29s');
    expect(
      formatDate(timestamp(new Date(2026, 4, 24, 0, 58, 1)), 'tweet')
    ).toBe('1m');
    expect(
      formatDate(timestamp(new Date(2026, 4, 23, 23, 0, 0)), 'tweet')
    ).toBe('2h');
    expect(formatDate(timestamp(new Date(2026, 4, 23, 1, 1, 0)), 'tweet')).toBe(
      '23h'
    );
  });

  it('uses the date once a tweet is 24 hours old', () => {
    expect(formatDate(timestamp(new Date(2026, 4, 23, 1, 0, 0)), 'tweet')).toBe(
      '23 May'
    );
  });
});

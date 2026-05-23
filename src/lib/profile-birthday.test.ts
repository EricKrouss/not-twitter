import {
  formatProfileBirthday,
  getBirthdayDayCount,
  isProfileBirthdayToday,
  normalizeProfileBirthday
} from './profile-birthday';

describe('profile birthday helpers', () => {
  it('normalizes valid month/day birthdays', () => {
    expect(normalizeProfileBirthday({ month: 5, day: 23 })).toEqual({
      month: 5,
      day: 23
    });
    expect(normalizeProfileBirthday('--02-29')).toEqual({
      month: 2,
      day: 29
    });
  });

  it('rejects impossible birthdays', () => {
    expect(normalizeProfileBirthday({ month: 2, day: 30 })).toBeNull();
    expect(normalizeProfileBirthday({ month: 13, day: 1 })).toBeNull();
    expect(normalizeProfileBirthday({ month: 0, day: 1 })).toBeNull();
  });

  it('formats and matches birthdays without storing a year', () => {
    const birthday = { month: 5, day: 23 };

    expect(getBirthdayDayCount(2)).toBe(29);
    expect(formatProfileBirthday(birthday, new Date(2026, 4, 24))).toBe(
      'Born May 23'
    );
    expect(formatProfileBirthday(birthday, new Date(2026, 4, 23))).toBe(
      'Born today'
    );
    expect(isProfileBirthdayToday(birthday, new Date(2026, 4, 23))).toBe(true);
    expect(isProfileBirthdayToday(birthday, new Date(2026, 4, 24))).toBe(false);
  });
});

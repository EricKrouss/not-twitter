export type ProfileBirthday = {
  month: number;
  day: number;
};

export const BIRTHDAY_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
] as const;

const BIRTHDAY_YEAR = 2024;
const BIRTHDAY_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric'
});

function getInteger(value: unknown): number | null {
  const number = typeof value === 'string' ? Number(value) : value;

  return typeof number === 'number' && Number.isInteger(number) ? number : null;
}

export function getBirthdayDayCount(month: number): number {
  return new Date(BIRTHDAY_YEAR, month, 0).getDate();
}

export function normalizeProfileBirthday(
  value: unknown
): ProfileBirthday | null {
  if (!value) return null;

  if (typeof value === 'string') {
    const match = value.match(/^(?:--)?(\d{1,2})-(\d{1,2})$/);
    if (!match) return null;

    return normalizeProfileBirthday({
      month: Number(match[1]),
      day: Number(match[2])
    });
  }

  if (typeof value !== 'object') return null;

  const birthday = value as Partial<ProfileBirthday>;
  const month = getInteger(birthday.month);
  const day = getInteger(birthday.day);

  if (!month || month < 1 || month > 12) return null;
  if (!day || day < 1 || day > getBirthdayDayCount(month)) return null;

  return { month, day };
}

export function formatProfileBirthday(
  birthday: ProfileBirthday,
  date = new Date()
): string {
  if (isProfileBirthdayToday(birthday, date)) return 'Born today';

  return `Born ${BIRTHDAY_DATE_FORMATTER.format(
    new Date(BIRTHDAY_YEAR, birthday.month - 1, birthday.day)
  )}`;
}

export function isProfileBirthdayToday(
  birthday: ProfileBirthday | null,
  date = new Date()
): boolean {
  return (
    !!birthday &&
    birthday.month === date.getMonth() + 1 &&
    birthday.day === date.getDate()
  );
}

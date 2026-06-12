import 'dayjs/locale/zh-cn';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';

dayjs.extend(duration);
dayjs.extend(relativeTime);

type RelativeTimeDate = string | number | Date | null | undefined;

/**
 * Formats a date as a human-readable relative time string (e.g. "3 hours
 * ago"). When baseDate is provided, the result is relative to that moment
 * instead of now.
 */
export default function (
  date: RelativeTimeDate,
  locale: string = 'en',
  baseDate?: RelativeTimeDate
): string {
  const value = dayjs(date).locale(locale);

  if (baseDate === undefined) {
    return value.fromNow();
  }

  return value.from(dayjs(baseDate));
}

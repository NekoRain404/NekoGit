/**
 * Returns '000000' or 'ffffff' depending on which provides better contrast
 * against the given hex background.
 */
export default function (backgroundColor: string): string {
  const normalizedColor = backgroundColor.trim().replace(/^#/, '');

  if (!/^[\da-f]{6}$/i.test(normalizedColor)) {
    return 'ffffff';
  }

  const r = Number.parseInt(normalizedColor.substring(0, 2), 16);
  const g = Number.parseInt(normalizedColor.substring(2, 4), 16);
  const b = Number.parseInt(normalizedColor.substring(4, 6), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255; // ITU-R BT.601 perceived luminance weights

  return luminance > 0.5 ? '000000' : 'ffffff';
}

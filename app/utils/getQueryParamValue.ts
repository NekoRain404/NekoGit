/// Safely extracts a single string value from a query parameter.
/**
 * Safely extracts a single string value from a query parameter that may be
 * a string or string array.
 */
export default function (value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }

  return typeof value === 'string' ? value : undefined;
}

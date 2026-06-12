import xss from 'xss';

/**
 * Strips dangerous HTML and returns a safe string containing only a
 * minimal allowlist of inline tags.
 */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) {
    return '';
  }

  return xss(dirty, {
    whiteList: {
      a: ['href', 'title'],
      b: [],
      code: [],
      em: [],
      i: [],
      s: [],
      strong: [],
      sub: [],
      sup: [],
      u: [],
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style'],
  });
}

/** Default export alias for sanitizeHtml. */
export default sanitizeHtml;

/// GitHub host detection and URL parsing helpers.
/** Canonical hostname for the GitHub REST API. */
export const GITHUB_API_HOST = 'api.github.com';
/** Canonical hostname for raw GitHub content. */
export const GITHUB_RAW_HOST = 'raw.githubusercontent.com';

const GITHUB_WEB_HOSTS = new Set(['github.com', 'www.github.com']);
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i;

/** Returns true if the string starts with an absolute URL protocol (e.g. https://). */
export function hasAbsoluteUrlProtocol(value: string) {
  return ABSOLUTE_URL_PATTERN.test(value);
}

/** Safely parses a URL string, returning null instead of throwing on invalid input. */
export function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** Returns true when the hostname belongs to the GitHub API. */
export function isGitHubApiHost(hostname: string) {
  return hostname.toLowerCase() === GITHUB_API_HOST;
}

/** Returns true when the hostname is raw.githubusercontent.com. */
export function isGitHubRawHost(hostname: string) {
  return hostname.toLowerCase() === GITHUB_RAW_HOST;
}

/** Returns true when the hostname is the GitHub web interface. */
export function isGitHubWebHost(hostname: string) {
  return GITHUB_WEB_HOSTS.has(hostname.toLowerCase());
}

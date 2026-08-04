import { describe, expect, test } from 'vitest';

import { resolveEnvProxyUrl } from '../shared/utils/proxy-url';

describe('resolveEnvProxyUrl', () => {
  test('prefers HTTPS_PROXY then HTTP_PROXY then ALL_PROXY', () => {
    expect(
      resolveEnvProxyUrl({
        HTTPS_PROXY: 'http://127.0.0.1:7890',
        HTTP_PROXY: 'http://127.0.0.1:8080',
      })
    ).toBe('http://127.0.0.1:7890');

    expect(
      resolveEnvProxyUrl({
        HTTP_PROXY: 'http://127.0.0.1:8080',
        ALL_PROXY: 'http://127.0.0.1:9999',
      })
    ).toBe('http://127.0.0.1:8080');

    expect(
      resolveEnvProxyUrl({
        all_proxy: 'http://127.0.0.1:1080',
      })
    ).toBe('http://127.0.0.1:1080');
  });

  test('returns empty string when no usable proxy env is set', () => {
    expect(resolveEnvProxyUrl({})).toBe('');
    expect(resolveEnvProxyUrl({ HTTPS_PROXY: 'socks5://127.0.0.1:1080' })).toBe('');
  });
});

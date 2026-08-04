import { describe, expect, test } from 'vitest';

import {
  getPathExtension,
  isActiveDocumentExtension,
  resolveRawRepoContentHeaders,
} from '../shared/utils/raw-content-type';

describe('resolveRawRepoContentHeaders', () => {
  test('serves SVG as non-navigable attachment octet-stream with CSP sandbox', () => {
    const headers = resolveRawRepoContentHeaders('docs/logo.svg');

    expect(headers.contentType).toBe('application/octet-stream');
    expect(headers.contentType).not.toBe('image/svg+xml');
    expect(headers.contentDisposition).toMatch(/^attachment;/);
    expect(headers.contentDisposition).toContain('logo.svg');
    expect(headers.contentSecurityPolicy).toContain("default-src 'none'");
    expect(headers.contentSecurityPolicy).toContain('sandbox');
    expect(headers.xContentTypeOptions).toBe('nosniff');
  });

  test('hardens HTML and XML the same way as SVG', () => {
    for (const path of ['index.html', 'feed.xml', 'sheet.xhtml']) {
      const headers = resolveRawRepoContentHeaders(path);
      expect(headers.contentType).toBe('application/octet-stream');
      expect(headers.contentDisposition).toMatch(/^attachment;/);
    }
  });

  test('keeps safe image types inline without attachment', () => {
    const headers = resolveRawRepoContentHeaders('assets/banner.png');
    expect(headers.contentType).toBe('image/png');
    expect(headers.contentDisposition).toBeUndefined();
  });

  test('extension helpers classify active documents', () => {
    expect(getPathExtension('path/to/File.SVG')).toBe('svg');
    expect(isActiveDocumentExtension('svg')).toBe(true);
    expect(isActiveDocumentExtension('png')).toBe(false);
  });
});

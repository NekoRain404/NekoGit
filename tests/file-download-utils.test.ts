import { describe, expect, test } from 'vitest';

import { sanitizeDownloadFileName } from '../app/utils/file-download-utils';

describe('file download helpers', () => {
  test('keeps normal repository file names unchanged', () => {
    expect(sanitizeDownloadFileName('README.md')).toBe('README.md');
    expect(sanitizeDownloadFileName('app.vue')).toBe('app.vue');
  });

  test('uses only the last path segment for save dialog defaults', () => {
    expect(sanitizeDownloadFileName('src/components/App.vue')).toBe('App.vue');
    expect(sanitizeDownloadFileName('src\\components\\App.vue')).toBe('App.vue');
  });

  test('replaces invalid filename characters and empty names', () => {
    expect(sanitizeDownloadFileName('bad:file?.txt')).toBe('bad-file-.txt');
    expect(sanitizeDownloadFileName('   ...   ')).toBe('download');
  });

  test('avoids reserved Windows device names', () => {
    expect(sanitizeDownloadFileName('CON')).toBe('CON-file');
    expect(sanitizeDownloadFileName('lpt1.txt')).toBe('lpt1.txt-file');
  });
});

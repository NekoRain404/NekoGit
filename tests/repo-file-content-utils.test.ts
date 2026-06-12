import { describe, expect, it } from 'vitest';

import {
  countRepositoryTextLines,
  decodeRepositoryFileBase64,
  decodeRepositoryFileText,
  formatRepositoryFileSize,
  getRepositoryFileExtension,
  getRepositoryFileName,
  isRepositoryFileBinary,
  resolveRepositoryFileLanguage,
} from '../app/utils/repo-file-content-utils';

describe('repository file content helpers', () => {
  it('decodes base64 repository file content into text', () => {
    const bytes = decodeRepositoryFileBase64(btoa('hello\nworld'));

    expect(decodeRepositoryFileText(bytes)).toBe('hello\nworld');
    expect(countRepositoryTextLines(decodeRepositoryFileText(bytes))).toBe(2);
  });

  it('handles invalid base64 and empty bytes safely', () => {
    const bytes = decodeRepositoryFileBase64('not base64!');

    expect(bytes).toHaveLength(0);
    expect(decodeRepositoryFileText(bytes)).toBe('');
    expect(isRepositoryFileBinary(bytes)).toBe(false);
  });

  it('detects binary content by null bytes', () => {
    expect(isRepositoryFileBinary(new Uint8Array([102, 111, 111]))).toBe(false);
    expect(isRepositoryFileBinary(new Uint8Array([102, 0, 111]))).toBe(true);
  });

  it('normalizes repository file names and extensions', () => {
    expect(getRepositoryFileName('src/components/App.vue')).toBe('App.vue');
    expect(getRepositoryFileExtension('src/components/App.vue')).toBe('vue');
    expect(getRepositoryFileExtension('README')).toBe('');
  });

  it('formats repository file sizes', () => {
    expect(formatRepositoryFileSize(0)).toBe('0 B');
    expect(formatRepositoryFileSize(512)).toBe('512 B');
    expect(formatRepositoryFileSize(1536)).toBe('1.5 KB');
    expect(formatRepositoryFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });

  it('maps common file extensions to shiki languages', () => {
    expect(resolveRepositoryFileLanguage('vue')).toBe('vue');
    expect(resolveRepositoryFileLanguage('TS')).toBe('typescript');
    expect(resolveRepositoryFileLanguage('md')).toBe('markdown');
    expect(resolveRepositoryFileLanguage('unknown')).toBe('text');
  });
});

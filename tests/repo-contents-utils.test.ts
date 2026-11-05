/// Unit tests for repository contents metadata mapping (large-file preview handling).
import { describe, expect, it, vi } from 'vitest';

// The mapping helper is pure; stub the request utilities so importing the
// server module does not pull in the Nuxt runtime dependency graph.
vi.mock('../server/utils/repo-route-utils', () => ({
  executeGitHubRequest: vi.fn(),
  extractRepoParams: vi.fn(),
}));

import { mapFileContent } from '../server/utils/repo-contents-utils';

const baseFile = {
  name: 'large.bin',
  path: 'large.bin',
  type: 'file' as const,
  size: 2 * 1024 * 1024,
  sha: 'abc123',
  url: 'https://api.github.com/repos/owner/repo/contents/large.bin',
  html_url: 'https://github.com/owner/repo/blob/main/large.bin',
  git_url: 'https://api.github.com/repos/owner/repo/git/blobs/abc123',
  download_url: 'https://raw.githubusercontent.com/owner/repo/main/large.bin',
  _links: {
    self: 'https://api.github.com/repos/owner/repo/contents/large.bin',
    git: 'https://api.github.com/repos/owner/repo/git/blobs/abc123',
    html: 'https://github.com/owner/repo/blob/main/large.bin',
  },
};

describe('mapFileContent', () => {
  it('returns metadata with empty content and tooLarge for encoding none', () => {
    const result = mapFileContent({ ...baseFile, encoding: 'none', content: '' });

    expect(result).toMatchObject({
      path: 'large.bin',
      type: 'file',
      content: '',
      encoding: 'none',
      tooLarge: true,
    });
  });

  it('keeps inline base64 content previewable', () => {
    const content = btoa('hello\nworld');
    const result = mapFileContent({ ...baseFile, size: 11, encoding: 'base64', content });

    expect(result).toMatchObject({
      type: 'file',
      content,
      encoding: 'base64',
      tooLarge: false,
    });
  });

  it('returns null for non-file entries', () => {
    expect(mapFileContent({ ...baseFile, type: 'dir' })).toBeNull();
  });
});

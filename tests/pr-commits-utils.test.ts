import { describe, expect, test } from 'vitest';

import { normalizePullCommit } from '../server/utils/pr-commits-utils';

describe('PR commit normalization', () => {
  test('normalizes a well-formed commit', () => {
    expect(
      normalizePullCommit({
        sha: 'a1b2c3d4e5f6',
        commit: { message: 'Fix the bug', author: { name: 'Ada', date: '2026-08-04T10:00:00Z' } },
        html_url: 'https://github.com/owner/repo/commit/a1b2c3d',
      })
    ).toEqual({
      sha: 'a1b2c3d4e5f6',
      shortSha: 'a1b2c3d',
      message: 'Fix the bug',
      authorName: 'Ada',
      authorDate: '2026-08-04T10:00:00Z',
      htmlUrl: 'https://github.com/owner/repo/commit/a1b2c3d',
    });
  });

  test('handles missing sha', () => {
    expect(normalizePullCommit({})).toEqual({
      sha: '',
      shortSha: '',
      message: '',
      authorName: '',
      authorDate: '',
      htmlUrl: undefined,
    });
  });

  test('uses only the first line of multi-line messages', () => {
    expect(normalizePullCommit({ commit: { message: 'Title line\n\nBody line' } })).toMatchObject({
      message: 'Title line',
    });
  });

  test('handles missing commit metadata', () => {
    expect(normalizePullCommit({ sha: 'abc1234' })).toEqual({
      sha: 'abc1234',
      shortSha: 'abc1234',
      message: '',
      authorName: '',
      authorDate: '',
      htmlUrl: undefined,
    });
  });
});

/// Unit tests for PR review workspace state persistence helpers.
import { describe, expect, test } from 'vitest';

import {
  buildPRReviewWorkspaceStateStorageKey,
  normalizePRReviewWorkspaceState,
  readPRReviewWorkspaceState,
  writePRReviewWorkspaceState,
} from '../app/utils/pr-review-workspace-state-utils';

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem'> {
  private items = new Map<string, string>();

  getItem(key: string) {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
}

describe('PR review workspace state helpers', () => {
  test('builds scoped storage keys by repository, pull request, and commit', () => {
    expect(
      buildPRReviewWorkspaceStateStorageKey({
        owner: 'Owner',
        repo: 'Repo',
        pullNumber: 7,
        commitId: 'ABC123',
      })
    ).toBe('nekogit:pr-review:workspace:owner/repo/7/abc123');

    expect(
      buildPRReviewWorkspaceStateStorageKey({
        owner: '',
        repo: 'Repo',
        pullNumber: 7,
        commitId: 'ABC123',
      })
    ).toBeNull();
  });

  test('normalizes malformed state and filters viewed filenames to loaded files', () => {
    expect(normalizePRReviewWorkspaceState(null)).toEqual({
      viewedFilenames: [],
      showUnviewedOnly: false,
      fileViewMode: 'tree',
      sidebarCollapsed: false,
      reviewPanelCollapsed: true,
      updatedAt: 0,
    });

    expect(
      normalizePRReviewWorkspaceState(
        {
          viewedFilenames: ['src/app.vue', 'src/app.vue', 'missing.ts', '', 7],
          showUnviewedOnly: true,
          fileViewMode: 'list',
          sidebarCollapsed: true,
          reviewPanelCollapsed: false,
          updatedAt: 123.8,
        },
        new Set(['src/app.vue'])
      )
    ).toEqual({
      viewedFilenames: ['src/app.vue'],
      showUnviewedOnly: true,
      fileViewMode: 'list',
      sidebarCollapsed: true,
      reviewPanelCollapsed: false,
      updatedAt: 123,
    });
  });

  test('reads and writes normalized state', () => {
    const storage = new MemoryStorage();
    const key = 'state';
    const allowedFilenames = new Set(['a.ts', 'b.ts']);

    const written = writePRReviewWorkspaceState(
      storage,
      key,
      {
        viewedFilenames: ['a.ts', 'c.ts'],
        showUnviewedOnly: true,
        fileViewMode: 'list',
        sidebarCollapsed: true,
        reviewPanelCollapsed: false,
      },
      allowedFilenames,
      42
    );

    expect(written.viewedFilenames).toEqual(['a.ts']);
    expect(readPRReviewWorkspaceState(storage, key, allowedFilenames)).toEqual(written);
  });
});

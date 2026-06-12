import { describe, expect, test } from 'vitest';

import { buildDesktopWindowTitle } from '../app/utils/desktop-window-title-utils';

describe('desktop window title helpers', () => {
  test('uses the active dashboard tab for list views', () => {
    expect(
      buildDesktopWindowTitle({
        path: '/dashboard',
        query: { tab: 'pulls' },
      })
    ).toBe('Pull Requests - NekoGit');
  });

  test('formats issue and pull request detail titles', () => {
    expect(
      buildDesktopWindowTitle({
        path: '/dashboard',
        query: { issue: 'owner/repo/42' },
      })
    ).toBe('#42 owner/repo - NekoGit');

    expect(
      buildDesktopWindowTitle({
        path: '/dashboard',
        query: { pr: 'owner/repo/7', prView: 'diff' },
      })
    ).toBe('#7 owner/repo Files - NekoGit');
  });

  test('formats repository and file titles', () => {
    expect(
      buildDesktopWindowTitle({
        path: '/dashboard',
        query: { repo: 'owner/repo', branch: 'feature/docs' },
      })
    ).toBe('owner/repo@feature/docs - NekoGit');

    expect(
      buildDesktopWindowTitle({
        path: '/dashboard',
        query: { repo: 'owner/repo', path: 'src/app.vue', branch: 'main' },
      })
    ).toBe('app.vue - owner/repo@main - NekoGit');
  });

  test('formats dashboard child routes and falls back to the app name', () => {
    expect(buildDesktopWindowTitle({ path: '/dashboard/settings', query: {} })).toBe(
      'Settings - NekoGit'
    );
    expect(buildDesktopWindowTitle({ path: '/', query: {} })).toBe('NekoGit');
  });
});

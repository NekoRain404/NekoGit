import { describe, expect, test } from 'vitest';

import {
  buildCurrentGitHubRepository,
  buildCurrentGitHubRouteKey,
  buildGitHubRepoContentUrl,
  buildGitHubUrlFromDashboardRoute,
  normalizeCurrentGitHubUrl,
  resolveCurrentGitHubRepository,
  resolveCurrentGitHubActionUrl,
} from '../app/utils/current-github-url-utils';

describe('current GitHub URL helpers', () => {
  test('builds external URLs for dashboard detail routes', () => {
    expect(
      buildGitHubUrlFromDashboardRoute({
        path: '/dashboard',
        query: { issue: 'owner/repo/42' },
      })
    ).toBe('https://github.com/owner/repo/issues/42');

    expect(
      buildGitHubUrlFromDashboardRoute({
        path: '/dashboard',
        query: { pr: 'owner/repo/7', prView: 'diff' },
      })
    ).toBe('https://github.com/owner/repo/pull/7/files');

    expect(
      buildGitHubUrlFromDashboardRoute({
        path: '/dashboard',
        query: { discussion: 'owner/repo/9' },
      })
    ).toBe('https://github.com/owner/repo/discussions/9');
  });

  test('builds repository and branch URLs from dashboard routes', () => {
    expect(
      buildGitHubUrlFromDashboardRoute({
        path: '/dashboard',
        query: { repo: 'owner/repo' },
      })
    ).toBe('https://github.com/owner/repo');

    expect(
      buildGitHubUrlFromDashboardRoute({
        path: '/dashboard',
        query: { repo: 'owner/repo', branch: 'feature/docs' },
      })
    ).toBe('https://github.com/owner/repo/tree/feature/docs');
  });

  test('builds precise file and directory content URLs', () => {
    expect(
      buildGitHubRepoContentUrl({
        owner: 'owner',
        repo: 'repo',
        branch: 'main',
        defaultBranch: 'main',
        path: '',
        type: 'directory',
      })
    ).toBe('https://github.com/owner/repo');

    expect(
      buildGitHubRepoContentUrl({
        owner: 'owner',
        repo: 'repo',
        branch: 'feature/docs',
        path: 'src/app.vue',
        type: 'file',
      })
    ).toBe('https://github.com/owner/repo/blob/feature/docs/src/app.vue');

    expect(
      buildGitHubRepoContentUrl({
        owner: 'owner',
        repo: 'repo',
        branch: 'feature/docs',
        path: 'src/components',
        type: 'directory',
      })
    ).toBe('https://github.com/owner/repo/tree/feature/docs/src/components');
  });

  test('preserves supported launch URLs and rejects unsafe targets', () => {
    expect(
      buildGitHubUrlFromDashboardRoute({
        path: '/dashboard',
        query: { url: 'https://github.com/owner/repo/pull/7' },
      })
    ).toBe('https://github.com/owner/repo/pull/7');

    expect(normalizeCurrentGitHubUrl('https://example.com/owner/repo')).toBeNull();
    expect(normalizeCurrentGitHubUrl('http://github.com/owner/repo')).toBeNull();
    expect(
      buildGitHubUrlFromDashboardRoute({
        path: '/dashboard/settings',
        query: { repo: 'owner/repo' },
      })
    ).toBeNull();
  });

  test('resolves a safe URL for native desktop GitHub actions', () => {
    expect(resolveCurrentGitHubActionUrl('https://github.com/owner/repo')).toBe(
      'https://github.com/owner/repo'
    );
    expect(
      resolveCurrentGitHubActionUrl('https://raw.githubusercontent.com/owner/repo/main/src/app.ts')
    ).toBe('https://raw.githubusercontent.com/owner/repo/main/src/app.ts');
    expect(resolveCurrentGitHubActionUrl(null)).toBe('https://github.com');
    expect(resolveCurrentGitHubActionUrl('https://example.com/owner/repo')).toBe(
      'https://github.com'
    );
  });

  test('resolves cloneable repositories from current GitHub URLs', () => {
    expect(resolveCurrentGitHubRepository('https://github.com/owner/repo/pull/7/files')).toEqual({
      owner: 'owner',
      repo: 'repo',
      fullName: 'owner/repo',
      htmlUrl: 'https://github.com/owner/repo',
      cloneUrl: 'https://github.com/owner/repo.git',
    });

    expect(resolveCurrentGitHubRepository('https://github.com/Owner/Repo.git')).toEqual({
      owner: 'Owner',
      repo: 'Repo',
      fullName: 'Owner/Repo',
      htmlUrl: 'https://github.com/Owner/Repo',
      cloneUrl: 'https://github.com/Owner/Repo.git',
    });

    expect(
      resolveCurrentGitHubRepository('https://api.github.com/repos/nuxt/nuxt/issues/42')
    ).toEqual({
      owner: 'nuxt',
      repo: 'nuxt',
      fullName: 'nuxt/nuxt',
      htmlUrl: 'https://github.com/nuxt/nuxt',
      cloneUrl: 'https://github.com/nuxt/nuxt.git',
    });

    expect(
      resolveCurrentGitHubRepository('https://raw.githubusercontent.com/owner/repo/main/app.ts')
    ).toMatchObject({
      cloneUrl: 'https://github.com/owner/repo.git',
    });

    expect(resolveCurrentGitHubRepository('https://github.com/settings/tokens')).toBeNull();
    expect(resolveCurrentGitHubRepository('https://example.com/owner/repo')).toBeNull();
  });

  test('builds cloneable repositories from owner and repo names', () => {
    expect(buildCurrentGitHubRepository('Owner', 'Repo.git')).toEqual({
      owner: 'Owner',
      repo: 'Repo',
      fullName: 'Owner/Repo',
      htmlUrl: 'https://github.com/Owner/Repo',
      cloneUrl: 'https://github.com/Owner/Repo.git',
    });

    expect(buildCurrentGitHubRepository('settings', 'tokens')).toEqual({
      owner: 'settings',
      repo: 'tokens',
      fullName: 'settings/tokens',
      htmlUrl: 'https://github.com/settings/tokens',
      cloneUrl: 'https://github.com/settings/tokens.git',
    });

    expect(buildCurrentGitHubRepository('../owner', 'repo')).toBeNull();
    expect(buildCurrentGitHubRepository('owner', 'repo/name')).toBeNull();
  });

  test('scopes precise URLs to relevant route query fields', () => {
    expect(
      buildCurrentGitHubRouteKey({
        path: '/dashboard',
        query: { repo: 'owner/repo', path: 'src/app.vue', ignored: 'value' },
      })
    ).toBe(
      buildCurrentGitHubRouteKey({
        path: '/dashboard',
        query: { repo: 'owner/repo', path: 'src/app.vue' },
      })
    );
  });
});

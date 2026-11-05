/// Unit tests for dashboard issue/pull filter and query helpers.
import { describe, expect, test } from 'vitest';

import {
  buildDashboardListFilterKey,
  buildDashboardListRequestPath,
  buildInvolvesSearchQuery,
  normalizeDashboardListFilter,
  normalizeDashboardListState,
  normalizeMergedFilter,
  resolveIssueListFilter,
  resolvePullListFilter,
} from '../shared/utils/dashboard-list-filter';

describe('dashboard list filters', () => {
  test('normalizes state values with open as the default', () => {
    expect(normalizeDashboardListState('open')).toBe('open');
    expect(normalizeDashboardListState('closed')).toBe('closed');
    expect(normalizeDashboardListState('all')).toBe('all');
    expect(normalizeDashboardListState(undefined)).toBe('open');
    expect(normalizeDashboardListState('merged')).toBe('open');
  });

  test('normalizes merged flags', () => {
    expect(normalizeMergedFilter('1')).toBe(true);
    expect(normalizeMergedFilter('true')).toBe(true);
    expect(normalizeMergedFilter(true)).toBe(true);
    expect(normalizeMergedFilter(1)).toBe(true);
    expect(normalizeMergedFilter('0')).toBe(false);
    expect(normalizeMergedFilter(undefined)).toBe(false);
  });

  test('produces separated cache keys for open, closed, and merged lists', () => {
    expect(buildDashboardListFilterKey(undefined)).toBe('state=open&merged=0');
    expect(buildDashboardListFilterKey({ state: 'closed' })).toBe('state=closed&merged=0');
    expect(buildDashboardListFilterKey({ state: 'all', merged: true })).toBe('state=all&merged=1');
  });

  test('builds request paths with state and merged params', () => {
    expect(buildDashboardListRequestPath('/api/issues', 2, 20, { state: 'closed' })).toBe(
      '/api/issues?page=2&per_page=20&state=closed'
    );
    expect(buildDashboardListRequestPath('/api/pulls', 1, 20, { state: 'all', merged: true })).toBe(
      '/api/pulls?page=1&per_page=20&state=all&merged=1'
    );
  });

  test('builds issue search queries without sort qualifiers', () => {
    const q = buildInvolvesSearchQuery({
      type: 'issues',
      createdAfter: '2025-01-01',
      userLogin: 'octocat',
    });

    expect(q).toBe('is:issue is:open archived:false created:>=2025-01-01 involves:octocat');
    expect(q).not.toContain('sort:');
  });

  test('builds closed and all issue search queries', () => {
    expect(
      buildInvolvesSearchQuery({
        type: 'issues',
        createdAfter: '2025-01-01',
        userLogin: 'octocat',
        filter: { state: 'closed' },
      })
    ).toBe('is:issue is:closed archived:false created:>=2025-01-01 involves:octocat');

    expect(
      buildInvolvesSearchQuery({
        type: 'issues',
        createdAfter: '2025-01-01',
        userLogin: 'octocat',
        filter: { state: 'all' },
      })
    ).toBe('is:issue archived:false created:>=2025-01-01 involves:octocat');
  });

  test('adds is:merged only for pull requests', () => {
    expect(
      buildInvolvesSearchQuery({
        type: 'pulls',
        createdAfter: '2025-01-01',
        userLogin: 'octocat',
        filter: { state: 'all', merged: true },
      })
    ).toBe('is:pr is:merged archived:false created:>=2025-01-01 involves:octocat');

    expect(
      buildInvolvesSearchQuery({
        type: 'pulls',
        createdAfter: '2025-01-01',
        userLogin: 'octocat',
        filter: { state: 'closed', merged: true },
      })
    ).toBe('is:pr is:closed is:merged archived:false created:>=2025-01-01 involves:octocat');

    expect(
      buildInvolvesSearchQuery({
        type: 'issues',
        createdAfter: '2025-01-01',
        userLogin: 'octocat',
        filter: { state: 'all', merged: true },
      })
    ).toBe('is:issue archived:false created:>=2025-01-01 involves:octocat');
  });

  test('resolves issue quick filters', () => {
    expect(resolveIssueListFilter(undefined)).toEqual({ state: 'open', merged: false });
    expect(resolveIssueListFilter({ open: false, closed: false })).toEqual({
      state: 'open',
      merged: false,
    });
    expect(resolveIssueListFilter({ open: false, closed: true })).toEqual({
      state: 'closed',
      merged: false,
    });
    expect(resolveIssueListFilter({ open: true, closed: true })).toEqual({
      state: 'all',
      merged: false,
    });
  });

  test('resolves pull request quick filters including merged', () => {
    expect(resolvePullListFilter(undefined)).toEqual({ state: 'open', merged: false });
    expect(resolvePullListFilter({ open: true })).toEqual({ state: 'open', merged: false });
    expect(resolvePullListFilter({ closed: true })).toEqual({ state: 'closed', merged: false });
    expect(resolvePullListFilter({ merged: true })).toEqual({ state: 'all', merged: true });
    expect(resolvePullListFilter({ closed: true, merged: true })).toEqual({
      state: 'closed',
      merged: true,
    });
    expect(resolvePullListFilter({ open: true, closed: true, merged: true })).toEqual({
      state: 'all',
      merged: true,
    });
  });

  test('normalizes incomplete filter input', () => {
    expect(normalizeDashboardListFilter({ state: 'closed' })).toEqual({
      state: 'closed',
      merged: false,
    });
    expect(normalizeDashboardListFilter({ merged: '1' })).toEqual({
      state: 'open',
      merged: true,
    });
  });
});

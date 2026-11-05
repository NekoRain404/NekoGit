/// Unit tests for repository total-count derivation from paginated responses.
import { describe, expect, test } from 'vitest';

import {
  computeRepositoryTotalCount,
  type RepositoryTotalCountInput,
} from '../shared/utils/github-repository-pagination';

const countFor = (overrides: Partial<RepositoryTotalCountInput> = {}) =>
  computeRepositoryTotalCount({
    page: 1,
    perPage: 20,
    lastPage: 1,
    lastPageCount: 0,
    ...overrides,
  });

describe('computeRepositoryTotalCount', () => {
  test('counts a single-page result', () => {
    expect(countFor({ page: 1, lastPage: 1, lastPageCount: 7 })).toBe(7);
  });

  test('uses the last page when requesting a middle page', () => {
    expect(countFor({ page: 2, lastPage: 5, lastPageCount: 7 })).toBe(87);
  });

  test('uses the last page when requesting the last page itself', () => {
    expect(countFor({ page: 5, lastPage: 5, lastPageCount: 7 })).toBe(87);
  });

  test('does not inflate the total for an out-of-range page', () => {
    expect(countFor({ page: 8, lastPage: 5, lastPageCount: 7 })).toBe(87);
  });

  test('counts a full last page', () => {
    expect(countFor({ page: 2, lastPage: 3, lastPageCount: 20 })).toBe(60);
  });

  test('handles an empty result set', () => {
    expect(countFor({ page: 1, lastPage: 1, lastPageCount: 0 })).toBe(0);
    expect(countFor({ page: 4, lastPage: 1, lastPageCount: 0 })).toBe(0);
  });

  test('falls back to the requested page when last page metadata is absent', () => {
    expect(countFor({ page: 2, lastPage: 0, lastPageCount: 4 })).toBe(24);
  });
});

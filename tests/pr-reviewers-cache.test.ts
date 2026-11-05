/// Unit tests for the PR reviewer summary TTL cache.
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  createPRReviewerSummaryCache,
  getPRReviewerSummaryCacheKey,
  usePRReviewers,
} from '../app/composables/usePRReviewers';

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PR reviewer summary cache', () => {
  test('builds keys from owner, repo, and pull number', () => {
    expect(getPRReviewerSummaryCacheKey('nekorain', 'nekogit', 12)).toBe('nekorain/nekogit/12');
  });

  test('reuses a cached summary within the TTL', async () => {
    let now = 0;
    const cache = createPRReviewerSummaryCache<string>({ ttlMs: 30_000, now: () => now });
    const loader = vi.fn(async () => 'cached');

    expect(await cache.load('key', loader)).toBe('cached');
    now = 29_999;
    expect(await cache.load('key', loader)).toBe('cached');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  test('reloads the summary once the TTL expires', async () => {
    let now = 0;
    const cache = createPRReviewerSummaryCache<string>({ ttlMs: 30_000, now: () => now });
    const loader = vi.fn().mockResolvedValueOnce('stale').mockResolvedValueOnce('fresh');

    expect(await cache.load('key', loader)).toBe('stale');
    now = 30_000;
    expect(await cache.load('key', loader)).toBe('fresh');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  test('keeps summaries for different pull requests separate', async () => {
    const cache = createPRReviewerSummaryCache<string>({ ttlMs: 30_000, now: () => 0 });
    const firstLoader = vi.fn(async () => 'first');
    const secondLoader = vi.fn(async () => 'second');

    expect(await cache.load('owner/repo/1', firstLoader)).toBe('first');
    expect(await cache.load('owner/repo/2', secondLoader)).toBe('second');
    expect(firstLoader).toHaveBeenCalledTimes(1);
    expect(secondLoader).toHaveBeenCalledTimes(1);
  });

  test('deduplicates concurrent requests for the same key', async () => {
    const cache = createPRReviewerSummaryCache<string>({ ttlMs: 30_000, now: () => 0 });
    const deferred = createDeferred<string>();
    const loader = vi.fn(() => deferred.promise);

    const first = cache.load('key', loader);
    const second = cache.load('key', loader);

    expect(loader).toHaveBeenCalledTimes(1);
    deferred.resolve('shared');

    await expect(Promise.all([first, second])).resolves.toEqual(['shared', 'shared']);
  });

  test('reloads after invalidation', async () => {
    const cache = createPRReviewerSummaryCache<string>({ ttlMs: 30_000, now: () => 0 });
    const loader = vi.fn().mockResolvedValueOnce('stale').mockResolvedValueOnce('fresh');

    expect(await cache.load('key', loader)).toBe('stale');
    cache.invalidate('key');
    expect(await cache.load('key', loader)).toBe('fresh');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  test('discards an in-flight response invalidated by a mutation', async () => {
    const cache = createPRReviewerSummaryCache<string>({ ttlMs: 30_000, now: () => 0 });
    const staleDeferred = createDeferred<string>();
    const loader = vi
      .fn()
      .mockImplementationOnce(() => staleDeferred.promise)
      .mockResolvedValueOnce('fresh');

    const staleLoad = cache.load('key', loader);
    cache.invalidate('key');
    expect(await cache.load('key', loader)).toBe('fresh');

    staleDeferred.resolve('stale');
    await expect(staleLoad).resolves.toBe('stale');

    const nextLoader = vi.fn(async () => 'should-not-run');
    expect(await cache.load('key', nextLoader)).toBe('fresh');
    expect(nextLoader).not.toHaveBeenCalled();
  });

  test('does not cache failed loads', async () => {
    const cache = createPRReviewerSummaryCache<string>({ ttlMs: 30_000, now: () => 0 });
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce('recovered');

    await expect(cache.load('key', loader)).rejects.toThrow('network down');
    expect(await cache.load('key', loader)).toBe('recovered');
    expect(loader).toHaveBeenCalledTimes(2);
  });
});

describe('usePRReviewers mutation invalidation', () => {
  test('refetches the summary after successful reviewer mutations', async () => {
    const summaryLoader = vi.fn(async () => ({ label: 'summary' }));
    const apiFetch = vi.fn(async (_url: string, options?: { method?: string }) => {
      if (options?.method === 'GET') {
        return summaryLoader();
      }

      return { reviewers: { label: 'mutation' } };
    });
    vi.stubGlobal('useNekoGitApiFetch', () => apiFetch);

    const reviewers = usePRReviewers();

    await reviewers.fetchReviewerSummary('cache-test', 'repo', 1);
    await reviewers.fetchReviewerSummary('cache-test', 'repo', 1);
    expect(summaryLoader).toHaveBeenCalledTimes(1);

    await reviewers.requestReviewers('cache-test', 'repo', 1, { reviewers: ['octocat'] });
    await reviewers.fetchReviewerSummary('cache-test', 'repo', 1);
    expect(summaryLoader).toHaveBeenCalledTimes(2);

    await reviewers.removeReviewers('cache-test', 'repo', 1, { reviewers: ['octocat'] });
    await reviewers.fetchReviewerSummary('cache-test', 'repo', 1);
    expect(summaryLoader).toHaveBeenCalledTimes(3);
  });
});

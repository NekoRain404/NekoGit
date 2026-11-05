/// Unit tests for selecting the commit used when submitting a PR review.
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  buildPRReviewSubmissionPayload,
  resolvePRReviewSubmitCommitId,
  usePRReview,
} from '../app/composables/usePRReview';

const messages = {
  loadFailed: 'load failed',
  submitFailed: 'submit failed',
  resolveThreadFailed: 'resolve failed',
  unresolveThreadFailed: 'unresolve failed',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PR review submit commit resolution', () => {
  test('prefers the selected commit over the pull request head', () => {
    expect(resolvePRReviewSubmitCommitId('head-sha', 'selected-sha')).toBe('selected-sha');
  });

  test('falls back to the head commit when no selected commit is available', () => {
    expect(resolvePRReviewSubmitCommitId('head-sha')).toBe('head-sha');
    expect(resolvePRReviewSubmitCommitId('head-sha', undefined)).toBe('head-sha');
    expect(resolvePRReviewSubmitCommitId('head-sha', '   ')).toBe('head-sha');
  });

  test('builds a submission payload with the selected commit and trimmed body', () => {
    const payload = buildPRReviewSubmissionPayload({
      commitId: 'selected-sha',
      event: 'COMMENT',
      body: '  Looks good to me  ',
      comments: [
        {
          id: 'src/app.ts:12',
          path: 'src/app.ts',
          line: 12,
          position: 4,
          body: 'nit',
        },
      ],
    });

    expect(payload).toEqual({
      commitId: 'selected-sha',
      event: 'COMMENT',
      body: 'Looks good to me',
      comments: [{ path: 'src/app.ts', position: 4, body: 'nit' }],
    });
  });
});

describe('usePRReview submission', () => {
  test('submits the selected commit SHA instead of the head SHA', async () => {
    const fetchMock = vi.fn(async () => ({ items: [] }));
    vi.stubGlobal('$fetch', fetchMock);

    const review = usePRReview({
      owner: () => 'owner',
      repo: () => 'repo',
      pullNumber: () => 7,
      commitId: () => 'head-sha',
      commitSha: () => 'selected-sha',
      submitCommitId: () => 'selected-sha',
      messages,
    });

    review.draftBody.value = 'Review summary';
    review.selectedEvent.value = 'APPROVE';

    expect(review.canSubmit.value).toBe(true);

    await review.submitReview();

    const reviewCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/pulls/7/reviews')
    );
    expect(reviewCall).toBeDefined();
    expect(reviewCall?.[1]).toMatchObject({
      method: 'POST',
      body: {
        commitId: 'selected-sha',
        event: 'APPROVE',
        body: 'Review summary',
      },
    });
  });

  test('cannot submit when neither the selected nor the head commit is known', () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn(async () => ({ items: [] }))
    );

    const review = usePRReview({
      owner: () => 'owner',
      repo: () => 'repo',
      pullNumber: () => 7,
      commitId: () => '',
      submitCommitId: () => undefined,
      messages,
    });

    review.draftBody.value = 'Review summary';

    expect(review.canSubmit.value).toBe(false);
  });
});

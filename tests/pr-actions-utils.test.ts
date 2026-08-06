/// Unit tests for PR pull update action normalization.
import { describe, expect, test } from 'vitest';

import { normalizePullUpdateAction } from '../server/utils/pr-actions-utils';

function captureError(callback: () => unknown) {
  try {
    callback();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('PR pull update action normalization', () => {
  test('rejects missing, null, and empty bodies', () => {
    for (const body of [undefined, null, {}]) {
      expect(captureError(() => normalizePullUpdateAction(body))).toMatchObject({
        statusCode: 400,
        statusMessage: 'state or merge is required',
      });
    }
  });

  test('rejects non-object bodies', () => {
    for (const body of ['closed', 42, []]) {
      expect(captureError(() => normalizePullUpdateAction(body))).toMatchObject({
        statusCode: 400,
      });
    }
  });

  test('rejects invalid state values', () => {
    expect(captureError(() => normalizePullUpdateAction({ state: 'merged' }))).toMatchObject({
      statusCode: 400,
      statusMessage: 'state must be "open" or "closed"',
    });
    expect(captureError(() => normalizePullUpdateAction({ state: '' }))).toMatchObject({
      statusCode: 400,
    });
  });

  test('normalizes open and close updates', () => {
    expect(normalizePullUpdateAction({ state: 'closed' })).toEqual({
      type: 'update',
      state: 'closed',
    });
    expect(normalizePullUpdateAction({ state: 'open' })).toEqual({ type: 'update', state: 'open' });
  });

  test('rejects invalid merge methods when merging', () => {
    expect(
      captureError(() => normalizePullUpdateAction({ merge: true, merge_method: 'fast-forward' }))
    ).toMatchObject({
      statusCode: 400,
      statusMessage: 'merge_method must be "merge", "squash", or "rebase"',
    });
  });

  test('ignores merge_method when not merging', () => {
    expect(
      normalizePullUpdateAction({ state: 'closed', merge: false, merge_method: 'bogus' })
    ).toEqual({
      type: 'update',
      state: 'closed',
    });
  });

  test('normalizes merge actions with a default merge method', () => {
    expect(normalizePullUpdateAction({ merge: true })).toEqual({
      type: 'merge',
      mergeMethod: 'merge',
    });
    expect(normalizePullUpdateAction({ merge: true, merge_method: 'squash' })).toEqual({
      type: 'merge',
      mergeMethod: 'squash',
    });
    expect(normalizePullUpdateAction({ merge: true, merge_method: 'rebase' })).toEqual({
      type: 'merge',
      mergeMethod: 'rebase',
    });
  });

  test('prefers merge over state updates', () => {
    expect(normalizePullUpdateAction({ state: 'closed', merge: true })).toEqual({
      type: 'merge',
      mergeMethod: 'merge',
    });
  });
});

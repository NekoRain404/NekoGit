/// Unit tests for issue creation body normalization.
import { describe, expect, test } from 'vitest';

import { normalizeIssueCreateBody } from '../shared/utils/issue-create';

function captureError(callback: () => unknown) {
  try {
    callback();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('issue create body normalization', () => {
  test('rejects missing, empty, and non-object bodies', () => {
    for (const body of [undefined, null, {}, 'title', 42, []]) {
      expect(captureError(() => normalizeIssueCreateBody(body))).toMatchObject({
        statusCode: 400,
      });
    }
  });

  test('rejects unknown fields', () => {
    expect(
      captureError(() => normalizeIssueCreateBody({ title: 'Hi', labels: ['bug'] }))
    ).toMatchObject({
      statusCode: 400,
      statusMessage: 'Unknown field: labels',
    });
  });

  test('rejects whitespace and non-string titles', () => {
    for (const title of ['', '   ', '\n\t ', 42, null, false, ['title']]) {
      expect(captureError(() => normalizeIssueCreateBody({ title }))).toMatchObject({
        statusCode: 400,
      });
    }
  });

  test('rejects non-string bodies', () => {
    for (const body of [42, null, false, { text: 'no' }]) {
      expect(captureError(() => normalizeIssueCreateBody({ title: 'Title', body }))).toMatchObject({
        statusCode: 400,
        statusMessage: 'body must be a string',
      });
    }
  });

  test('normalizes valid payloads and preserves empty bodies', () => {
    expect(normalizeIssueCreateBody({ title: '  New issue  ' })).toEqual({ title: 'New issue' });
    expect(normalizeIssueCreateBody({ title: 'Title', body: '' })).toEqual({
      title: 'Title',
      body: '',
    });
    expect(normalizeIssueCreateBody({ title: 'Title', body: 'Body' })).toEqual({
      title: 'Title',
      body: 'Body',
    });
  });
});

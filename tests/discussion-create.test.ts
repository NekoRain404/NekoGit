/// Unit tests for discussion creation body normalization.
import { describe, expect, test } from 'vitest';

import { normalizeDiscussionCreateBody } from '../shared/utils/discussion-create';

function captureError(callback: () => unknown) {
  try {
    callback();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('discussion create body normalization', () => {
  test('normalizes valid payloads', () => {
    expect(
      normalizeDiscussionCreateBody({
        title: '  Question  ',
        body: '  Body text  ',
        categoryId: '  DIC_kwDO  ',
      })
    ).toEqual({ title: 'Question', body: 'Body text', categoryId: 'DIC_kwDO' });
  });

  test('rejects invalid or incomplete payloads', () => {
    for (const body of [undefined, null, {}, 'x', []]) {
      expect(captureError(() => normalizeDiscussionCreateBody(body))).toMatchObject({
        statusCode: 400,
      });
    }

    for (const payload of [
      { title: '', body: 'Body', categoryId: 'id' },
      { title: 'Title', body: '', categoryId: 'id' },
      { title: 'Title', body: 'Body', categoryId: '' },
      { title: 1, body: 'Body', categoryId: 'id' },
      { title: 'Title', body: 1, categoryId: 'id' },
      { title: 'Title', body: 'Body', categoryId: 1 },
    ]) {
      expect(captureError(() => normalizeDiscussionCreateBody(payload))).toMatchObject({
        statusCode: 400,
      });
    }
  });
});

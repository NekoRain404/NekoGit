/// Unit tests for issue update body normalization.
import { describe, expect, test } from 'vitest';

import { normalizeIssueUpdateBody } from '../shared/utils/issue-update';

function captureError(callback: () => unknown) {
  try {
    callback();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('issue update body normalization', () => {
  test('rejects missing, empty, and non-object bodies', () => {
    for (const body of [undefined, null, {}, 'closed', 42, []]) {
      expect(captureError(() => normalizeIssueUpdateBody(body))).toMatchObject({
        statusCode: 400,
        statusMessage: 'At least one of title, body, or state is required',
      });
    }
  });

  test('rejects unknown fields', () => {
    expect(captureError(() => normalizeIssueUpdateBody({ assignee: 'octocat' }))).toMatchObject({
      statusCode: 400,
      statusMessage: 'Unknown field: assignee',
    });
    expect(
      captureError(() => normalizeIssueUpdateBody({ title: 'Hello', labels: ['bug'] }))
    ).toMatchObject({
      statusCode: 400,
      statusMessage: 'Unknown field: labels',
    });
  });

  test('rejects whitespace-only and non-string titles', () => {
    for (const title of ['', '   ', '\n\t ']) {
      expect(captureError(() => normalizeIssueUpdateBody({ title }))).toMatchObject({
        statusCode: 400,
        statusMessage: 'title must not be empty',
      });
    }

    for (const title of [42, null, false, ['title']]) {
      expect(captureError(() => normalizeIssueUpdateBody({ title }))).toMatchObject({
        statusCode: 400,
        statusMessage: 'title must be a string',
      });
    }
  });

  test('rejects non-string bodies', () => {
    for (const body of [42, null, false, { text: 'no' }]) {
      expect(captureError(() => normalizeIssueUpdateBody({ body }))).toMatchObject({
        statusCode: 400,
        statusMessage: 'body must be a string',
      });
    }
  });

  test('rejects invalid state values', () => {
    for (const state of ['merged', '', 'OPEN', 1, null]) {
      expect(captureError(() => normalizeIssueUpdateBody({ state }))).toMatchObject({
        statusCode: 400,
        statusMessage: 'state must be "open" or "closed"',
      });
    }
  });

  test('normalizes valid title, body, and state payloads', () => {
    expect(normalizeIssueUpdateBody({ title: '  New title  ' })).toEqual({ title: 'New title' });
    expect(normalizeIssueUpdateBody({ body: 'Updated description' })).toEqual({
      body: 'Updated description',
    });
    expect(normalizeIssueUpdateBody({ state: 'closed' })).toEqual({ state: 'closed' });
    expect(normalizeIssueUpdateBody({ state: 'open' })).toEqual({ state: 'open' });
    expect(normalizeIssueUpdateBody({ title: ' Title ', body: 'Body', state: 'closed' })).toEqual({
      title: 'Title',
      body: 'Body',
      state: 'closed',
    });
  });

  test('normalizes assignees and milestone updates', () => {
    expect(normalizeIssueUpdateBody({ assignees: [' octocat ', 'octocat', 'hubot'] })).toEqual({
      assignees: ['octocat', 'hubot'],
    });
    expect(normalizeIssueUpdateBody({ assignees: [] })).toEqual({ assignees: [] });
    expect(normalizeIssueUpdateBody({ milestone: 12 })).toEqual({ milestone: 12 });
    expect(normalizeIssueUpdateBody({ milestone: null })).toEqual({ milestone: null });
  });

  test('rejects invalid assignees and milestone values', () => {
    for (const assignees of ['octocat', [42], ['ok', ''], ['ok', null]]) {
      expect(captureError(() => normalizeIssueUpdateBody({ assignees }))).toMatchObject({
        statusCode: 400,
      });
    }

    for (const milestone of [0, -1, 1.5, '12', false]) {
      expect(captureError(() => normalizeIssueUpdateBody({ milestone }))).toMatchObject({
        statusCode: 400,
        statusMessage: 'milestone must be a positive integer or null',
      });
    }
  });

  test('allows an empty body to clear the description', () => {
    expect(normalizeIssueUpdateBody({ body: '' })).toEqual({ body: '' });
    expect(normalizeIssueUpdateBody({ body: '', state: 'open' })).toEqual({
      body: '',
      state: 'open',
    });
  });
});

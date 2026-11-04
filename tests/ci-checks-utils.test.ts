/// Unit tests for CI check-run normalization and summarization helpers.
import { describe, expect, test } from 'vitest';

import {
  extractActionsJobId,
  normalizeCheckRun,
  normalizeCheckRunId,
  summarizeCheckRuns,
  type NormalizedCheckRun,
} from '../server/utils/ci-checks-utils';

function captureError(callback: () => unknown) {
  try {
    callback();
  } catch (error) {
    return error;
  }
  return undefined;
}

const completedRun = (overrides: Partial<NormalizedCheckRun> = {}): NormalizedCheckRun => ({
  id: 1,
  name: 'build',
  head_sha: 'abc1234',
  status: 'completed',
  conclusion: 'success',
  html_url: 'https://example.com/run/1',
  details_url: 'https://example.com/details/1',
  output: { title: 'Build output', summary: 'summary', text: 'text' },
  app: { name: 'GitHub Actions' },
  ...overrides,
});

describe('check run id normalization', () => {
  test('normalizes valid positive integer ids', () => {
    expect(normalizeCheckRunId('42')).toBe(42);
    expect(normalizeCheckRunId(' 7 ')).toBe(7);
    expect(normalizeCheckRunId(7)).toBe(7);
  });

  test('rejects non-positive-integer ids', () => {
    for (const value of ['abc', '0', '-1', '12.5', '', undefined, null]) {
      expect(captureError(() => normalizeCheckRunId(value))).toMatchObject({
        statusCode: 400,
        statusMessage: 'Invalid check run ID',
      });
    }
  });
});

describe('check run normalization', () => {
  test('passes through well-formed check runs', () => {
    expect(
      normalizeCheckRun({
        id: 5,
        name: 'test',
        head_sha: 'abc1234',
        status: 'in_progress',
        conclusion: null,
        html_url: 'https://example.com/run/5',
        details_url: 'https://example.com/details/5',
        output: { title: 'Running', summary: '', text: '' },
        app: { name: 'Actions' },
      })
    ).toEqual({
      id: 5,
      name: 'test',
      head_sha: 'abc1234',
      status: 'in_progress',
      conclusion: null,
      html_url: 'https://example.com/run/5',
      details_url: 'https://example.com/details/5',
      output: { title: 'Running', summary: '', text: '' },
      app: { name: 'Actions' },
    });
  });

  test('fills safe defaults for missing fields', () => {
    const defaults = {
      id: 0,
      name: '',
      head_sha: '',
      status: 'queued',
      conclusion: null,
      html_url: '',
      details_url: '',
      output: { title: '', summary: '', text: '' },
      app: { name: '' },
    };

    expect(normalizeCheckRun(undefined)).toEqual(defaults);
    expect(normalizeCheckRun(null)).toEqual(defaults);
    expect(normalizeCheckRun({})).toEqual(defaults);
  });

  test('falls back to queued for unknown statuses and preserves known ones', () => {
    expect(normalizeCheckRun({ status: 'waiting' })).toMatchObject({ status: 'queued' });
    expect(normalizeCheckRun({ status: 'queued' })).toMatchObject({ status: 'queued' });
    expect(normalizeCheckRun({ status: 'completed' })).toMatchObject({ status: 'completed' });
  });
});

describe('check run summary', () => {
  test('counts passing, failing, pending, and skipped runs', () => {
    const runs = [
      completedRun({ id: 1, conclusion: 'success' }),
      completedRun({ id: 2, conclusion: 'failure' }),
      completedRun({ id: 3, conclusion: 'timed_out' }),
      completedRun({ id: 4, status: 'in_progress', conclusion: null }),
      completedRun({ id: 5, conclusion: 'skipped' }),
      completedRun({ id: 6, conclusion: 'neutral' }),
    ];

    expect(summarizeCheckRuns(runs)).toEqual({
      total: 6,
      passing: 1,
      failing: 2,
      pending: 1,
      skipped: 2,
    });
  });

  test('counts an empty list', () => {
    expect(summarizeCheckRuns([])).toEqual({
      total: 0,
      passing: 0,
      failing: 0,
      pending: 0,
      skipped: 0,
    });
  });

  test('treats completed runs without a conclusion as pending', () => {
    expect(summarizeCheckRuns([completedRun({ conclusion: null })])).toEqual({
      total: 1,
      passing: 0,
      failing: 0,
      pending: 1,
      skipped: 0,
    });
  });
});

describe('extractActionsJobId', () => {
  test('extracts the job id from a same-repo Actions details URL', () => {
    expect(
      extractActionsJobId('https://github.com/owner/repo/actions/runs/123/job/456', 'owner', 'repo')
    ).toBe(456);

    expect(
      extractActionsJobId(
        'https://github.com/Owner/Repo/actions/runs/123/job/789?pr=1#step:2:3',
        'owner',
        'repo'
      )
    ).toBe(789);

    expect(
      extractActionsJobId('https://github.com/owner/repo/actions/runs/9/job/10/', 'OWNER', 'REPO')
    ).toBe(10);
  });

  test('rejects details URLs for a different repository', () => {
    expect(
      extractActionsJobId('https://github.com/other/repo/actions/runs/1/job/2', 'owner', 'repo')
    ).toBeNull();

    expect(
      extractActionsJobId('https://github.com/owner/other/actions/runs/1/job/2', 'owner', 'repo')
    ).toBeNull();
  });

  test('rejects non-github.com hosts', () => {
    for (const url of [
      'https://example.com/owner/repo/actions/runs/1/job/2',
      'https://api.github.com/owner/repo/actions/runs/1/job/2',
      'https://github.com.example.com/owner/repo/actions/runs/1/job/2',
    ]) {
      expect(extractActionsJobId(url, 'owner', 'repo')).toBeNull();
    }
  });

  test('rejects malformed details URLs', () => {
    for (const url of [
      '',
      'not a url',
      'https://github.com/owner/repo/actions/runs/123/job/abc',
      'https://github.com/owner/repo/actions/runs/abc/job/456',
      'https://github.com/owner/repo/pull/1',
    ]) {
      expect(extractActionsJobId(url, 'owner', 'repo')).toBeNull();
    }

    expect(extractActionsJobId(null, 'owner', 'repo')).toBeNull();
    expect(extractActionsJobId(undefined, 'owner', 'repo')).toBeNull();
  });

  test('rejects Actions URLs without a job id', () => {
    expect(
      extractActionsJobId('https://github.com/owner/repo/actions/runs/123', 'owner', 'repo')
    ).toBeNull();
  });
});

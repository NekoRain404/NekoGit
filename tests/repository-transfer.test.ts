/// Unit tests for repository transfer payload normalization.
import { describe, expect, test } from 'vitest';

import { normalizeRepositoryTransferBody } from '../shared/utils/repository-transfer';

function captureError(callback: () => unknown) {
  try {
    callback();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('repository transfer normalization', () => {
  test('requires a target owner', () => {
    for (const body of [undefined, null, {}, [], { new_owner: '' }, { new_owner: 42 }]) {
      expect(
        captureError(() => normalizeRepositoryTransferBody(body, 'NekoRain404'))
      ).toMatchObject({ statusCode: 400, statusMessage: 'new_owner is required' });
    }
  });

  test('normalizes a valid target owner', () => {
    expect(
      normalizeRepositoryTransferBody({ new_owner: '  NekoGit-Org  ' }, 'NekoRain404')
    ).toEqual({ new_owner: 'NekoGit-Org' });
  });

  test('rejects invalid logins and the current owner', () => {
    for (const new_owner of ['bad owner', '-leading', 'trailing-', 'owner/name']) {
      expect(
        captureError(() => normalizeRepositoryTransferBody({ new_owner }, 'NekoRain404'))
      ).toMatchObject({
        statusCode: 400,
        statusMessage: 'new_owner must be a valid GitHub user or organization login',
      });
    }

    for (const new_owner of ['NekoRain404', 'nekorain404']) {
      expect(
        captureError(() => normalizeRepositoryTransferBody({ new_owner }, 'NekoRain404'))
      ).toMatchObject({
        statusCode: 400,
        statusMessage: 'new_owner must be different from the current owner',
      });
    }
  });

  test('rejects unknown fields', () => {
    expect(
      captureError(() =>
        normalizeRepositoryTransferBody({ new_owner: 'NekoGit-Org', team_ids: [1] }, 'NekoRain404')
      )
    ).toMatchObject({ statusCode: 400, statusMessage: 'Unknown field: team_ids' });
  });
});

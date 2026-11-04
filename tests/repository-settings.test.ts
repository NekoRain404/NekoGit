/// Unit tests for repository settings and delete confirmation normalization.
import { describe, expect, test } from 'vitest';

import {
  normalizeRepositoryDeleteConfirmation,
  normalizeRepositorySettingsUpdate,
  REPOSITORY_DESCRIPTION_MAX_LENGTH,
} from '../shared/utils/repository-settings';

function captureError(callback: () => unknown) {
  try {
    callback();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('repository settings normalization', () => {
  test('rejects missing, empty, and non-object bodies', () => {
    for (const body of [undefined, null, {}, 'archived', 42, []]) {
      expect(captureError(() => normalizeRepositorySettingsUpdate(body))).toMatchObject({
        statusCode: 400,
        statusMessage: 'At least one repository setting is required',
      });
    }
  });

  test('rejects unknown fields', () => {
    expect(
      captureError(() => normalizeRepositorySettingsUpdate({ name: 'renamed' }))
    ).toMatchObject({
      statusCode: 400,
      statusMessage: 'Unknown field: name',
    });
  });

  test('trims text fields and clears empty values', () => {
    expect(
      normalizeRepositorySettingsUpdate({
        description: '  Updated description  ',
        homepage: '  https://example.com/project  ',
      })
    ).toEqual({
      description: 'Updated description',
      homepage: 'https://example.com/project',
    });

    expect(normalizeRepositorySettingsUpdate({ description: '   ', homepage: '' })).toEqual({
      description: null,
      homepage: null,
    });
  });

  test('rejects non-string and oversized descriptions', () => {
    for (const description of [42, false, ['text']]) {
      expect(captureError(() => normalizeRepositorySettingsUpdate({ description }))).toMatchObject({
        statusCode: 400,
        statusMessage: 'description must be a string or null',
      });
    }

    expect(
      captureError(() =>
        normalizeRepositorySettingsUpdate({
          description: 'a'.repeat(REPOSITORY_DESCRIPTION_MAX_LENGTH + 1),
        })
      )
    ).toMatchObject({
      statusCode: 400,
      statusMessage: `description must be at most ${REPOSITORY_DESCRIPTION_MAX_LENGTH} characters`,
    });
  });

  test('rejects invalid homepage protocols and URLs', () => {
    for (const homepage of ['example.com', 'ftp://example.com', 'javascript:alert(1)', 42]) {
      expect(captureError(() => normalizeRepositorySettingsUpdate({ homepage }))).toMatchObject({
        statusCode: 400,
      });
    }
  });

  test('accepts boolean archive and visibility flags', () => {
    expect(normalizeRepositorySettingsUpdate({ archived: true, private: false })).toEqual({
      archived: true,
      private: false,
    });

    for (const archived of ['true', 1, null]) {
      expect(captureError(() => normalizeRepositorySettingsUpdate({ archived }))).toMatchObject({
        statusCode: 400,
        statusMessage: 'archived must be a boolean',
      });
    }
  });
});

describe('repository delete confirmation', () => {
  test('requires an exact repository name', () => {
    expect(normalizeRepositoryDeleteConfirmation({ confirmName: 'NekoGit' }, 'NekoGit')).toBe(
      'NekoGit'
    );

    for (const body of [null, {}, { confirmName: 'nekogit' }, { confirmName: '' }, 'NekoGit']) {
      expect(
        captureError(() => normalizeRepositoryDeleteConfirmation(body, 'NekoGit'))
      ).toMatchObject({
        statusCode: 400,
        statusMessage: 'confirmName must match the repository name "NekoGit"',
      });
    }
  });
});

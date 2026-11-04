/// Unit tests for repository creation payload normalization.
import { describe, expect, test } from 'vitest';

import {
  normalizeRepositoryCreateBody,
  REPOSITORY_NAME_MAX_LENGTH,
} from '../shared/utils/repository-create';

function captureError(callback: () => unknown) {
  try {
    callback();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('repository creation normalization', () => {
  test('requires a valid name', () => {
    for (const body of [undefined, null, {}, [], { name: '' }, { name: '   ' }, { name: 42 }]) {
      expect(captureError(() => normalizeRepositoryCreateBody(body))).toMatchObject({
        statusCode: 400,
        statusMessage: 'name is required',
      });
    }
  });

  test('rejects names with unsupported characters or no alphanumeric character', () => {
    for (const name of ['my repo', 'repo/name', 'emoji✨', '...', '---_']) {
      expect(captureError(() => normalizeRepositoryCreateBody({ name }))).toMatchObject({
        statusCode: 400,
        statusMessage: 'name may only contain letters, digits, dots, underscores, and hyphens',
      });
    }

    expect(
      captureError(() =>
        normalizeRepositoryCreateBody({ name: 'a'.repeat(REPOSITORY_NAME_MAX_LENGTH + 1) })
      )
    ).toMatchObject({
      statusCode: 400,
      statusMessage: `name must be at most ${REPOSITORY_NAME_MAX_LENGTH} characters`,
    });
  });

  test('normalizes optional fields and defaults flags to false', () => {
    expect(
      normalizeRepositoryCreateBody({
        name: '  NekoGit  ',
        description: '  GitHub dashboard  ',
        homepage: '  https://example.com  ',
      })
    ).toEqual({
      name: 'NekoGit',
      description: 'GitHub dashboard',
      homepage: 'https://example.com',
      private: false,
      auto_init: false,
    });
  });

  test('accepts explicit visibility, initialization, and organization owner', () => {
    expect(
      normalizeRepositoryCreateBody({
        name: 'NekoGit',
        owner: '  NekoRain404  ',
        private: true,
        auto_init: true,
      })
    ).toEqual({
      name: 'NekoGit',
      owner: 'NekoRain404',
      private: true,
      auto_init: true,
    });
  });

  test('rejects invalid organization owners', () => {
    for (const owner of ['bad owner', '-leading', 'trailing-', 'owner/name', 42]) {
      expect(
        captureError(() => normalizeRepositoryCreateBody({ name: 'NekoGit', owner }))
      ).toMatchObject({ statusCode: 400 });
    }
  });

  test('rejects unknown fields and invalid optional values', () => {
    expect(
      captureError(() => normalizeRepositoryCreateBody({ name: 'NekoGit', org: 'x' }))
    ).toMatchObject({ statusCode: 400, statusMessage: 'Unknown field: org' });

    for (const homepage of ['example.com', 'ftp://example.com', 42]) {
      expect(
        captureError(() => normalizeRepositoryCreateBody({ name: 'NekoGit', homepage }))
      ).toMatchObject({ statusCode: 400 });
    }

    for (const value of ['true', 1, null]) {
      expect(
        captureError(() => normalizeRepositoryCreateBody({ name: 'NekoGit', private: value }))
      ).toMatchObject({ statusCode: 400, statusMessage: 'private must be a boolean' });
    }
  });
});

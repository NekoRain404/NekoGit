/// Unit tests for repository label creation normalization.
import { describe, expect, test } from 'vitest';

import { normalizeLabelCreateBody } from '../shared/utils/label-create';

function captureError(callback: () => unknown) {
  try {
    callback();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('label create body normalization', () => {
  test('normalizes name, hex color and description', () => {
    expect(normalizeLabelCreateBody({ name: '  bug  ', color: '#FF0000' })).toEqual({
      name: 'bug',
      color: 'ff0000',
    });
    expect(
      normalizeLabelCreateBody({ name: 'feature', color: '00ff00', description: '  New feature  ' })
    ).toEqual({ name: 'feature', color: '00ff00', description: 'New feature' });
    expect(normalizeLabelCreateBody({ name: 'x', color: 'abcdef', description: null })).toEqual({
      name: 'x',
      color: 'abcdef',
    });
  });

  test('rejects missing/invalid names and colors', () => {
    for (const body of [undefined, null, {}, 'label', []]) {
      expect(captureError(() => normalizeLabelCreateBody(body))).toMatchObject({ statusCode: 400 });
    }
    for (const name of ['', '   ', 42, null]) {
      expect(captureError(() => normalizeLabelCreateBody({ name, color: 'abcdef' }))).toMatchObject(
        {
          statusCode: 400,
        }
      );
    }
    for (const color of ['', 'fff', 'gggggg', '#12345', 42, null]) {
      expect(captureError(() => normalizeLabelCreateBody({ name: 'bug', color }))).toMatchObject({
        statusCode: 400,
        statusMessage: 'color must be a six-digit hex value',
      });
    }
  });

  test('rejects long names/descriptions and non-string descriptions', () => {
    expect(
      captureError(() => normalizeLabelCreateBody({ name: 'a'.repeat(101), color: 'abcdef' }))
    ).toMatchObject({ statusCode: 400 });
    expect(
      captureError(() =>
        normalizeLabelCreateBody({ name: 'bug', color: 'abcdef', description: 'a'.repeat(201) })
      )
    ).toMatchObject({ statusCode: 400 });
    expect(
      captureError(() =>
        normalizeLabelCreateBody({ name: 'bug', color: 'abcdef', description: 42 })
      )
    ).toMatchObject({ statusCode: 400, statusMessage: 'description must be a string' });
  });
});

///  Utils / Repository Create - Validates personal repository creation payloads.
import {
  REPOSITORY_DESCRIPTION_MAX_LENGTH,
  REPOSITORY_HOMEPAGE_MAX_LENGTH,
} from './repository-settings';

/** Maximum repository name length accepted by GitHub. */
export const REPOSITORY_NAME_MAX_LENGTH = 100;

/** Normalized fields accepted by the GitHub repository creation endpoint. */
export interface RepositoryCreatePayload {
  name: string;
  owner?: string;
  description?: string;
  homepage?: string;
  private: boolean;
  auto_init: boolean;
}

const allowedFields = new Set(['name', 'owner', 'description', 'homepage', 'private', 'auto_init']);
const repositoryNamePattern = /^[A-Za-z0-9._-]+$/;
const ownerLoginPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

function throwValidationError(statusMessage: string): never {
  if (typeof createError === 'function') {
    throw createError({ statusCode: 400, statusMessage });
  }
  throw Object.assign(new Error(statusMessage), { statusCode: 400, statusMessage });
}

function normalizeOptionalText(
  value: unknown,
  field: string,
  maxLength: number
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throwValidationError(`${field} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength) {
    throwValidationError(`${field} must be at most ${maxLength} characters`);
  }

  return trimmed;
}

function normalizeHomepage(value: unknown): string | undefined {
  const homepage = normalizeOptionalText(value, 'homepage', REPOSITORY_HOMEPAGE_MAX_LENGTH);
  if (homepage === undefined) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(homepage);
  } catch {
    throwValidationError('homepage must be a valid http(s) URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throwValidationError('homepage must be a valid http(s) URL');
  }

  return homepage;
}

function normalizeOwner(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throwValidationError('owner must be a string');
  }

  const owner = value.trim();
  if (!owner) return undefined;
  if (!ownerLoginPattern.test(owner)) {
    throwValidationError('owner must be a valid GitHub user or organization login');
  }

  return owner;
}

/**
 * Validate and normalize a POST repository creation body.
 *
 * Creates repositories owned by the authenticated user. Names may contain
 * letters, digits, dots, underscores, and hyphens; descriptions and homepages
 * are optional. Unknown fields and invalid types are rejected with a 400 error.
 */
export function normalizeRepositoryCreateBody(body: unknown): RepositoryCreatePayload {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throwValidationError('name is required');
  }

  const record = body as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!allowedFields.has(key)) {
      throwValidationError(`Unknown field: ${key}`);
    }
  }

  if (typeof record.name !== 'string' || !record.name.trim()) {
    throwValidationError('name is required');
  }

  const name = record.name.trim();
  if (name.length > REPOSITORY_NAME_MAX_LENGTH) {
    throwValidationError(`name must be at most ${REPOSITORY_NAME_MAX_LENGTH} characters`);
  }
  if (!repositoryNamePattern.test(name) || !/[A-Za-z0-9]/.test(name)) {
    throwValidationError('name may only contain letters, digits, dots, underscores, and hyphens');
  }

  const owner = normalizeOwner(record.owner);

  const privateValue = record.private;
  if (privateValue !== undefined && typeof privateValue !== 'boolean') {
    throwValidationError('private must be a boolean');
  }

  const autoInitValue = record.auto_init;
  if (autoInitValue !== undefined && typeof autoInitValue !== 'boolean') {
    throwValidationError('auto_init must be a boolean');
  }

  const payload: RepositoryCreatePayload = {
    name,
    private: privateValue ?? false,
    auto_init: autoInitValue ?? false,
  };
  if (owner !== undefined) payload.owner = owner;

  const description = normalizeOptionalText(
    record.description,
    'description',
    REPOSITORY_DESCRIPTION_MAX_LENGTH
  );
  if (description !== undefined) payload.description = description;

  const homepage = normalizeHomepage(record.homepage);
  if (homepage !== undefined) payload.homepage = homepage;

  return payload;
}

///  Utils / Repository Settings - Validates repository settings and delete confirmation payloads.

/** Maximum repository description length accepted by GitHub. */
export const REPOSITORY_DESCRIPTION_MAX_LENGTH = 350;

/** Practical upper bound for repository homepage URLs. */
export const REPOSITORY_HOMEPAGE_MAX_LENGTH = 2048;

/** Normalized fields accepted by the GitHub repository settings endpoint. */
export interface RepositorySettingsUpdate {
  description?: string | null;
  homepage?: string | null;
  private?: boolean;
  archived?: boolean;
}

const allowedFields = new Set(['description', 'homepage', 'private', 'archived']);

function throwValidationError(statusMessage: string): never {
  if (typeof createError === 'function') {
    throw createError({ statusCode: 400, statusMessage });
  }
  throw Object.assign(new Error(statusMessage), { statusCode: 400, statusMessage });
}

function normalizeOptionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') {
    throwValidationError(`${field} must be a string or null`);
  }

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    throwValidationError(`${field} must be at most ${maxLength} characters`);
  }

  return trimmed;
}

function normalizeHomepage(value: unknown): string | null {
  const homepage = normalizeOptionalText(value, 'homepage', REPOSITORY_HOMEPAGE_MAX_LENGTH);
  if (homepage === null) return null;

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

/**
 * Validate and normalize a PATCH repository settings body.
 *
 * Accepts any combination of `description`, `homepage`, `private`, and `archived`;
 * at least one field is required. Empty text clears the field, and unknown fields
 * or invalid types are rejected with a 400 error.
 */
export function normalizeRepositorySettingsUpdate(body: unknown): RepositorySettingsUpdate {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throwValidationError('At least one repository setting is required');
  }

  const record = body as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!allowedFields.has(key)) {
      throwValidationError(`Unknown field: ${key}`);
    }
  }

  const payload: RepositorySettingsUpdate = {};

  if ('description' in record) {
    payload.description = normalizeOptionalText(
      record.description,
      'description',
      REPOSITORY_DESCRIPTION_MAX_LENGTH
    );
  }

  if ('homepage' in record) {
    payload.homepage = normalizeHomepage(record.homepage);
  }

  if ('private' in record) {
    if (typeof record.private !== 'boolean') {
      throwValidationError('private must be a boolean');
    }
    payload.private = record.private;
  }

  if ('archived' in record) {
    if (typeof record.archived !== 'boolean') {
      throwValidationError('archived must be a boolean');
    }
    payload.archived = record.archived;
  }

  if (Object.keys(payload).length === 0) {
    throwValidationError('At least one repository setting is required');
  }

  return payload;
}

/**
 * Require the caller to echo the repository name before deleting it.
 * This mirrors the typed confirmation shown in the desktop UI.
 */
export function normalizeRepositoryDeleteConfirmation(body: unknown, repo: string): string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throwValidationError(`confirmName must match the repository name "${repo}"`);
  }

  const { confirmName } = body as Record<string, unknown>;
  if (typeof confirmName !== 'string' || confirmName !== repo) {
    throwValidationError(`confirmName must match the repository name "${repo}"`);
  }

  return confirmName;
}

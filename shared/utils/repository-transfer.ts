///  Utils / Repository Transfer - Validates repository transfer payloads.

/** Normalized fields accepted by the GitHub repository transfer endpoint. */
export interface RepositoryTransferPayload {
  new_owner: string;
}

const ownerLoginPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

function throwValidationError(statusMessage: string): never {
  if (typeof createError === 'function') {
    throw createError({ statusCode: 400, statusMessage });
  }
  throw Object.assign(new Error(statusMessage), { statusCode: 400, statusMessage });
}

/**
 * Validate and normalize a repository transfer body.
 *
 * The target must be a valid GitHub user or organization login and must differ
 * from the current owner. Unknown fields are rejected with a 400 error.
 */
export function normalizeRepositoryTransferBody(
  body: unknown,
  currentOwner: string
): RepositoryTransferPayload {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throwValidationError('new_owner is required');
  }

  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== 'new_owner') {
      throwValidationError(`Unknown field: ${key}`);
    }
  }

  if (typeof record.new_owner !== 'string' || !record.new_owner.trim()) {
    throwValidationError('new_owner is required');
  }

  const newOwner = record.new_owner.trim();
  if (!ownerLoginPattern.test(newOwner)) {
    throwValidationError('new_owner must be a valid GitHub user or organization login');
  }
  if (newOwner.toLowerCase() === currentOwner.toLowerCase()) {
    throwValidationError('new_owner must be different from the current owner');
  }

  return { new_owner: newOwner };
}

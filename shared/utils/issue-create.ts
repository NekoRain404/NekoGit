///  Utils / Issue Create - Validates and normalizes issue creation request bodies.

/** Normalized fields accepted by the GitHub issue creation endpoint. */
export interface IssueCreatePayload {
  title: string;
  body?: string;
}

const allowedFields = new Set(['title', 'body']);

function throwValidationError(statusMessage: string): never {
  if (typeof createError === 'function') {
    throw createError({ statusCode: 400, statusMessage });
  }
  throw Object.assign(new Error(statusMessage), { statusCode: 400, statusMessage });
}

/**
 * Validate and normalize an issue creation body.
 * Title is required and trimmed; body is optional but must be a string.
 */
export function normalizeIssueCreateBody(body: unknown): IssueCreatePayload {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throwValidationError('title is required');
  }

  const record = body as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!allowedFields.has(key)) {
      throwValidationError(`Unknown field: ${key}`);
    }
  }

  if (typeof record.title !== 'string' || !record.title.trim()) {
    throwValidationError('title must be a non-empty string');
  }

  const payload: IssueCreatePayload = { title: record.title.trim() };

  if (record.body !== undefined) {
    if (typeof record.body !== 'string') {
      throwValidationError('body must be a string');
    }
    payload.body = record.body;
  }

  return payload;
}

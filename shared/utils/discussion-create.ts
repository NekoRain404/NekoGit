///  Utils / Discussion Create - Validates discussion creation and category query inputs.

/** Normalized discussion creation payload. */
export interface DiscussionCreatePayload {
  title: string;
  body: string;
  categoryId: string;
}

function throwValidationError(statusMessage: string): never {
  if (typeof createError === 'function') {
    throw createError({ statusCode: 400, statusMessage });
  }
  throw Object.assign(new Error(statusMessage), { statusCode: 400, statusMessage });
}

/** Validate and normalize a discussion creation body. */
export function normalizeDiscussionCreateBody(body: unknown): DiscussionCreatePayload {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throwValidationError('title, body, and categoryId are required');
  }

  const record = body as Record<string, unknown>;
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const bodyText = typeof record.body === 'string' ? record.body.trim() : '';
  const categoryId = typeof record.categoryId === 'string' ? record.categoryId.trim() : '';

  if (!title) {
    throwValidationError('title must be a non-empty string');
  }
  if (!bodyText) {
    throwValidationError('body must be a non-empty string');
  }
  if (!categoryId) {
    throwValidationError('categoryId must be a non-empty string');
  }

  return { title, body: bodyText, categoryId };
}

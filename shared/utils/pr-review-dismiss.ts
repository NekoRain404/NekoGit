/// Utils / PR Review Dismiss - Validates review dismissal ids and optional messages.

/** Maximum dismissal message length accepted by the GitHub API. */
export const PR_REVIEW_DISMISSAL_MESSAGE_MAX_LENGTH = 65535;

/** Normalized dismissal request body. */
export interface PRReviewDismissalBody {
  message?: string;
}

function throwValidationError(statusMessage: string): never {
  if (typeof createError === 'function') {
    throw createError({ statusCode: 400, statusMessage });
  }
  throw Object.assign(new Error(statusMessage), { statusCode: 400, statusMessage });
}

/** Validate a review id as a positive safe integer (numbers or numeric strings). */
export function validateReviewDismissalId(value: unknown): number {
  const raw = typeof value === 'string' ? value.trim() : value;
  let reviewId = Number.NaN;

  if (typeof raw === 'number') {
    reviewId = raw;
  } else if (typeof raw === 'string' && /^\d+$/.test(raw)) {
    reviewId = Number(raw);
  }

  if (!Number.isSafeInteger(reviewId) || reviewId < 1) {
    throwValidationError('review_id must be a positive integer');
  }

  return reviewId;
}

/** Trim and validate an optional dismissal message; empty messages are omitted. */
export function normalizeReviewDismissalMessage(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throwValidationError('message must be a string');
  }

  const message = value.trim();

  if (!message) {
    return undefined;
  }

  if (message.length > PR_REVIEW_DISMISSAL_MESSAGE_MAX_LENGTH) {
    throwValidationError(
      `message must be at most ${PR_REVIEW_DISMISSAL_MESSAGE_MAX_LENGTH} characters`
    );
  }

  return message;
}

/** Validate and normalize a dismissal request body as `{ message? }`. */
export function normalizeReviewDismissalBody(body: unknown): PRReviewDismissalBody {
  if (body === undefined || body === null) {
    return {};
  }

  if (typeof body !== 'object' || Array.isArray(body)) {
    throwValidationError('Request body must be an object');
  }

  return {
    message: normalizeReviewDismissalMessage((body as Record<string, unknown>).message),
  };
}

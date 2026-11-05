/// Utils / Discussion Actions - Validates discussion answer, upvote, and lock action bodies.

/** Lock reasons supported by the GitHub GraphQL LockReason enum. */
export const DISCUSSION_LOCK_REASONS = ['off-topic', 'too-heated', 'resolved', 'spam'] as const;

/** A normalized discussion lock reason. */
export type DiscussionLockReason = (typeof DISCUSSION_LOCK_REASONS)[number];

/** Normalized discussion lock action. */
export interface DiscussionLockAction {
  locked: boolean;
  reason?: DiscussionLockReason;
}

function throwValidationError(statusMessage: string): never {
  if (typeof createError === 'function') {
    throw createError({ statusCode: 400, statusMessage });
  }
  throw Object.assign(new Error(statusMessage), { statusCode: 400, statusMessage });
}

function normalizeBooleanActionBody(body: unknown, fieldName: string): boolean {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throwValidationError('Request body must be an object');
  }

  const value = (body as Record<string, unknown>)[fieldName];

  if (typeof value !== 'boolean') {
    throwValidationError(`${fieldName} must be a boolean`);
  }

  return value;
}

/** Whether a value is one of the supported discussion lock reasons. */
export function isDiscussionLockReason(value: unknown): value is DiscussionLockReason {
  return (
    typeof value === 'string' && DISCUSSION_LOCK_REASONS.includes(value as DiscussionLockReason)
  );
}

/** Validate and normalize a discussion answer action body as `{ answered: boolean }`. */
export function normalizeDiscussionAnswerAction(body: unknown): boolean {
  return normalizeBooleanActionBody(body, 'answered');
}

/** Validate and normalize a discussion upvote action body as `{ upvoted: boolean }`. */
export function normalizeDiscussionUpvoteAction(body: unknown): boolean {
  return normalizeBooleanActionBody(body, 'upvoted');
}

/** Validate and normalize a discussion lock action body as `{ locked, reason? }`. */
export function normalizeDiscussionLockAction(body: unknown): DiscussionLockAction {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throwValidationError('Request body must be an object');
  }

  const { locked, reason } = body as { locked?: unknown; reason?: unknown };

  if (typeof locked !== 'boolean') {
    throwValidationError('locked must be a boolean');
  }

  if (reason === undefined || reason === null) {
    return { locked };
  }

  if (!isDiscussionLockReason(reason)) {
    throwValidationError(
      `Invalid lock reason. Must be one of: ${DISCUSSION_LOCK_REASONS.join(', ')}`
    );
  }

  return { locked, reason };
}

///  Utils / PR Actions Utils - Validates and normalizes pull request update actions (merge/open/close) from PATCH request bodies.

export type PullUpdateState = 'open' | 'closed';
export type PullMergeMethod = 'merge' | 'squash' | 'rebase';

export type PullUpdateAction =
  | { type: 'merge'; mergeMethod: PullMergeMethod }
  | {
      type: 'update';
      state?: PullUpdateState;
      title?: string;
      body?: string;
    };

function throwValidationError(statusMessage: string): never {
  if (typeof createError === 'function') {
    throw createError({ statusCode: 400, statusMessage });
  }
  throw Object.assign(new Error(statusMessage), { statusCode: 400, statusMessage });
}

/**
 * Validate and normalize a PATCH pull request body into a pull action.
 * Returns `{ type: 'merge', mergeMethod }` when merging, otherwise
 * `{ type: 'update', ... }` for state/title/body edits.
 */
export function normalizePullUpdateAction(body: unknown): PullUpdateAction {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throwValidationError('state, title, body, or merge is required');
  }

  const {
    state,
    merge,
    merge_method,
    title,
    body: pullBody,
  } = body as {
    state?: unknown;
    merge?: unknown;
    merge_method?: unknown;
    title?: unknown;
    body?: unknown;
  };

  if (merge) {
    let mergeMethod: PullMergeMethod = 'merge';

    if (merge_method !== undefined) {
      if (merge_method !== 'merge' && merge_method !== 'squash' && merge_method !== 'rebase') {
        throwValidationError('merge_method must be "merge", "squash", or "rebase"');
      }
      mergeMethod = merge_method;
    }

    return { type: 'merge', mergeMethod };
  }

  const update: { state?: PullUpdateState; title?: string; body?: string } = {};

  if (state !== undefined) {
    if (state !== 'open' && state !== 'closed') {
      throwValidationError('state must be "open" or "closed"');
    }
    update.state = state;
  }

  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) {
      throwValidationError('title must be a non-empty string');
    }
    update.title = title.trim();
  }

  if (pullBody !== undefined) {
    if (typeof pullBody !== 'string') {
      throwValidationError('body must be a string');
    }
    update.body = pullBody;
  }

  if (Object.keys(update).length === 0) {
    throwValidationError('state, title, body, or merge is required');
  }

  return { type: 'update', ...update };
}

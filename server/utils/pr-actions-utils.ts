///  Utils / PR Actions Utils

export type PullUpdateState = 'open' | 'closed';
export type PullMergeMethod = 'merge' | 'squash' | 'rebase';

export type PullUpdateAction =
  | { type: 'merge'; mergeMethod: PullMergeMethod }
  | { type: 'update'; state: PullUpdateState };

function throwValidationError(statusMessage: string): never {
  if (typeof createError === 'function') {
    throw createError({ statusCode: 400, statusMessage });
  }
  throw Object.assign(new Error(statusMessage), { statusCode: 400, statusMessage });
}

/**
 * Validate and normalize a PATCH pull request body into a pull action.
 * Returns `{ type: 'merge', mergeMethod }` when merging, otherwise
 * `{ type: 'update', state }` for open/close updates.
 */
export function normalizePullUpdateAction(body: unknown): PullUpdateAction {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throwValidationError('state or merge is required');
  }

  const { state, merge, merge_method } = body as {
    state?: unknown;
    merge?: unknown;
    merge_method?: unknown;
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

  if (state === undefined) {
    throwValidationError('state or merge is required');
  }

  if (state !== 'open' && state !== 'closed') {
    throwValidationError('state must be "open" or "closed"');
  }

  return { type: 'update', state };
}

///  Utils / Issue Update - Validates and normalizes issue title/body/state updates from PATCH request bodies.

export type IssueUpdateState = 'open' | 'closed';

/** Normalized fields accepted by the GitHub issue update endpoint. */
export interface IssueUpdatePayload {
  title?: string;
  body?: string;
  state?: IssueUpdateState;
  assignees?: string[];
  milestone?: number | null;
}

const allowedFields = new Set(['title', 'body', 'state', 'assignees', 'milestone']);
const MAX_ASSIGNEES = 10;

function throwValidationError(statusMessage: string): never {
  if (typeof createError === 'function') {
    throw createError({ statusCode: 400, statusMessage });
  }
  throw Object.assign(new Error(statusMessage), { statusCode: 400, statusMessage });
}

/**
 * Validate and normalize a PATCH issue body.
 *
 * Accepts any combination of `title`, `body`, and `state`; at least one field
 * is required. Titles are trimmed and must be non-empty, bodies may be empty
 * to clear the description, and state must be `open` or `closed`. Unknown
 * fields and invalid types are rejected with a 400 error.
 */
export function normalizeIssueUpdateBody(body: unknown): IssueUpdatePayload {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throwValidationError('At least one of title, body, or state is required');
  }

  const record = body as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!allowedFields.has(key)) {
      throwValidationError(`Unknown field: ${key}`);
    }
  }

  const payload: IssueUpdatePayload = {};

  if ('title' in record) {
    if (typeof record.title !== 'string') {
      throwValidationError('title must be a string');
    }

    const title = record.title.trim();
    if (!title) {
      throwValidationError('title must not be empty');
    }

    payload.title = title;
  }

  if ('body' in record) {
    if (typeof record.body !== 'string') {
      throwValidationError('body must be a string');
    }

    payload.body = record.body;
  }

  if ('state' in record) {
    if (record.state !== 'open' && record.state !== 'closed') {
      throwValidationError('state must be "open" or "closed"');
    }

    payload.state = record.state;
  }

  if ('assignees' in record) {
    if (!Array.isArray(record.assignees)) {
      throwValidationError('assignees must be an array');
    }

    const assignees: string[] = [];
    for (const assignee of record.assignees) {
      if (typeof assignee !== 'string' || !assignee.trim()) {
        throwValidationError('assignees must contain non-empty strings');
      }
      const login = assignee.trim();
      if (!assignees.includes(login)) {
        assignees.push(login);
      }
    }

    if (assignees.length > MAX_ASSIGNEES) {
      throwValidationError(`assignees must contain at most ${MAX_ASSIGNEES} logins`);
    }

    payload.assignees = assignees;
  }

  if ('milestone' in record) {
    if (record.milestone !== null) {
      if (
        typeof record.milestone !== 'number' ||
        !Number.isSafeInteger(record.milestone) ||
        record.milestone < 1
      ) {
        throwValidationError('milestone must be a positive integer or null');
      }
    }

    payload.milestone = record.milestone as number | null;
  }

  if (Object.keys(payload).length === 0) {
    throwValidationError('At least one of title, body, or state is required');
  }

  return payload;
}

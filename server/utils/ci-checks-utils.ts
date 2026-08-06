///  Utils / CI Checks Utils

export type CheckRunStatus = 'queued' | 'in_progress' | 'completed';

export interface RawCheckRun {
  id?: unknown;
  name?: unknown;
  head_sha?: unknown;
  status?: unknown;
  conclusion?: unknown;
  html_url?: unknown;
  details_url?: unknown;
  output?: { title?: unknown; summary?: unknown; text?: unknown } | null;
  app?: { name?: unknown } | null;
}

export interface NormalizedCheckRun {
  id: number;
  name: string;
  head_sha: string;
  status: CheckRunStatus;
  conclusion: string | null;
  html_url: string;
  details_url: string;
  output: { title: string; summary: string; text: string };
  app: { name: string };
}

export interface CheckRunSummary {
  total: number;
  passing: number;
  failing: number;
  pending: number;
  skipped: number;
}

const validStatuses = new Set<CheckRunStatus>(['queued', 'in_progress', 'completed']);

function throwValidationError(statusMessage: string): never {
  if (typeof createError === 'function') {
    throw createError({ statusCode: 400, statusMessage });
  }
  throw Object.assign(new Error(statusMessage), { statusCode: 400, statusMessage });
}

/** Normalize a GitHub check run object, filling safe defaults for missing fields. */
export function normalizeCheckRun(run: RawCheckRun | null | undefined): NormalizedCheckRun {
  const status = validStatuses.has(run?.status as CheckRunStatus)
    ? (run?.status as CheckRunStatus)
    : 'queued';

  return {
    id: typeof run?.id === 'number' ? run.id : 0,
    name: typeof run?.name === 'string' ? run.name : '',
    head_sha: typeof run?.head_sha === 'string' ? run.head_sha : '',
    status,
    conclusion: typeof run?.conclusion === 'string' ? run.conclusion : null,
    html_url: typeof run?.html_url === 'string' ? run.html_url : '',
    details_url: typeof run?.details_url === 'string' ? run.details_url : '',
    output: {
      title: typeof run?.output?.title === 'string' ? run.output.title : '',
      summary: typeof run?.output?.summary === 'string' ? run.output.summary : '',
      text: typeof run?.output?.text === 'string' ? run.output.text : '',
    },
    app: { name: typeof run?.app?.name === 'string' ? run.app.name : '' },
  };
}

/** Group normalized check runs into passing/failing/pending/skipped counts. */
export function summarizeCheckRuns(runs: NormalizedCheckRun[]): CheckRunSummary {
  const summary: CheckRunSummary = {
    total: runs.length,
    passing: 0,
    failing: 0,
    pending: 0,
    skipped: 0,
  };

  for (const run of runs) {
    if (run.status !== 'completed' || run.conclusion === null) {
      summary.pending += 1;
    } else if (run.conclusion === 'success') {
      summary.passing += 1;
    } else if (run.conclusion === 'skipped' || run.conclusion === 'neutral') {
      summary.skipped += 1;
    } else {
      summary.failing += 1;
    }
  }

  return summary;
}

/** Validate and normalize a check run id from route params. */
export function normalizeCheckRunId(value: unknown): number {
  const runId = typeof value === 'number' ? value : Number(value);

  if (!Number.isInteger(runId) || runId < 1) {
    throwValidationError('Invalid check run ID');
  }

  return runId;
}

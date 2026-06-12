import type { DashboardUrlTarget } from './dashboard-url-navigation-utils';

/** Discriminator for the kind of quick-open target. */
export type DashboardQuickOpenTargetKind =
  | 'issue'
  | 'pull-request'
  | 'pull-request-diff'
  | 'discussion'
  | 'repository'
  | 'file';

/** Human-readable preview metadata for a quick-open entry. */
export interface DashboardQuickOpenPreview {
  kind: DashboardQuickOpenTargetKind;
  title: string;
  subtitle: string;
}

/** A recently opened quick-open entry with timestamp. */
export interface DashboardQuickOpenRecent {
  value: string;
  preview: DashboardQuickOpenPreview;
  openedAt: number;
}

/** LocalStorage key for persisted quick-open recents. */
export const DASHBOARD_QUICK_OPEN_RECENTS_STORAGE_KEY = 'nekogit:dashboard:quick-open:recents';
/** Maximum number of quick-open recents to retain. */
export const MAX_DASHBOARD_QUICK_OPEN_RECENTS = 8;

const MAX_DASHBOARD_QUICK_OPEN_VALUE_CHARS = 2048;
const MAX_DASHBOARD_QUICK_OPEN_PREVIEW_CHARS = 512;
const DASHBOARD_QUICK_OPEN_TARGET_KINDS = new Set<DashboardQuickOpenTargetKind>([
  'issue',
  'pull-request',
  'pull-request-diff',
  'discussion',
  'repository',
  'file',
]);

function formatRepoLabel(owner: string, repo: string) {
  return `${owner}/${repo}`;
}

function formatBranchSuffix(branch?: string) {
  return branch ? ` @ ${branch}` : '';
}

/**
 * Builds a display preview for a dashboard URL target, or null if the
 * target is empty.
 */
export function buildDashboardQuickOpenPreview(
  target: DashboardUrlTarget | null | undefined
): DashboardQuickOpenPreview | null {
  if (!target) return null;

  if (target.type === 'issue') {
    return {
      kind: 'issue',
      title: `#${target.number} ${formatRepoLabel(target.owner, target.repo)}`,
      subtitle: formatRepoLabel(target.owner, target.repo),
    };
  }

  if (target.type === 'pull-request') {
    return {
      kind: target.view === 'diff' ? 'pull-request-diff' : 'pull-request',
      title: `#${target.number} ${formatRepoLabel(target.owner, target.repo)}`,
      subtitle: formatRepoLabel(target.owner, target.repo),
    };
  }

  if (target.type === 'discussion') {
    return {
      kind: 'discussion',
      title: `#${target.number} ${formatRepoLabel(target.owner, target.repo)}`,
      subtitle: formatRepoLabel(target.owner, target.repo),
    };
  }

  if (target.type === 'repository') {
    return {
      kind: 'repository',
      title: `${formatRepoLabel(target.owner, target.repo)}${formatBranchSuffix(target.branch)}`,
      subtitle: target.branch ? target.branch : formatRepoLabel(target.owner, target.repo),
    };
  }

  return {
    kind: 'file',
    title: target.path || formatRepoLabel(target.owner, target.repo),
    subtitle: `${formatRepoLabel(target.owner, target.repo)}${formatBranchSuffix(target.branch)}`,
  };
}

function normalizePreviewText(value: unknown) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  return trimmed.slice(0, MAX_DASHBOARD_QUICK_OPEN_PREVIEW_CHARS);
}

function normalizeDashboardQuickOpenPreview(value: unknown): DashboardQuickOpenPreview | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const preview = value as Partial<DashboardQuickOpenPreview>;
  const title = normalizePreviewText(preview.title);
  const subtitle = normalizePreviewText(preview.subtitle);

  if (
    !preview.kind ||
    !DASHBOARD_QUICK_OPEN_TARGET_KINDS.has(preview.kind) ||
    !title ||
    !subtitle
  ) {
    return null;
  }

  return {
    kind: preview.kind,
    title,
    subtitle,
  };
}

function normalizeRecentValue(value: unknown) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_DASHBOARD_QUICK_OPEN_VALUE_CHARS) {
    return null;
  }

  return trimmed;
}

function normalizeOpenedAt(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.trunc(value);
}

/** Creates a normalized recent quick-open entry from a value and target. */
export function createDashboardQuickOpenRecent(
  value: string,
  target: DashboardUrlTarget,
  openedAt = Date.now()
): DashboardQuickOpenRecent | null {
  const recentValue = normalizeRecentValue(value);
  const preview = buildDashboardQuickOpenPreview(target);
  const recentOpenedAt = normalizeOpenedAt(openedAt);

  if (!recentValue || !preview || recentOpenedAt === null) {
    return null;
  }

  return {
    value: recentValue,
    preview,
    openedAt: recentOpenedAt,
  };
}

/** Normalizes and deduplicates raw recent entries, sorted by most recently opened. */
export function normalizeDashboardQuickOpenRecents(value: unknown): DashboardQuickOpenRecent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalizedRecents: DashboardQuickOpenRecent[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }

    const source = item as Partial<DashboardQuickOpenRecent>;
    const recentValue = normalizeRecentValue(source.value);
    const preview = normalizeDashboardQuickOpenPreview(source.preview);
    const openedAt = normalizeOpenedAt(source.openedAt);

    if (!recentValue || !preview || openedAt === null) {
      continue;
    }

    normalizedRecents.push({
      value: recentValue,
      preview,
      openedAt,
    });
  }

  const recents: DashboardQuickOpenRecent[] = [];
  const seenValues = new Set<string>();

  for (const recent of normalizedRecents.sort((left, right) => right.openedAt - left.openedAt)) {
    const valueKey = recent.value.toLowerCase();
    if (seenValues.has(valueKey)) {
      // deduplicate recents by case-insensitive value
      continue;
    }

    seenValues.add(valueKey);
    recents.push(recent);

    if (recents.length >= MAX_DASHBOARD_QUICK_OPEN_RECENTS) {
      break;
    }
  }

  return recents;
}

/** Inserts or updates a recent entry, deduplicating by value and capping the list. */
export function upsertDashboardQuickOpenRecent(
  recents: DashboardQuickOpenRecent[],
  recent: DashboardQuickOpenRecent
) {
  const recentKey = recent.value.toLowerCase();
  return [recent, ...recents.filter((item) => item.value.toLowerCase() !== recentKey)].slice(
    0,
    MAX_DASHBOARD_QUICK_OPEN_RECENTS
  );
}

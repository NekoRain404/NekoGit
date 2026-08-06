/// RepoPermissions type and factory returning all-permissions-disabled defaults.
/** Granular access flags for a GitHub repository. */
export interface RepoPermissions {
  admin: boolean;
  maintain: boolean;
  push: boolean;
  triage: boolean;
  pull: boolean;
  canEditLabels: boolean;
  canLockIssue: boolean;
}

/** Returns a RepoPermissions object with every permission disabled. */
export default function createEmptyRepoPermissions(): RepoPermissions {
  return {
    admin: false,
    maintain: false,
    push: false,
    triage: false,
    pull: false,
    canEditLabels: false,
    canLockIssue: false,
  };
}

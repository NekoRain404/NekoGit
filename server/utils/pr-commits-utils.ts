///  Utils / PR Commits Utils

export interface PullCommitResponse {
  sha?: string;
  commit?: {
    message?: string;
    author?: {
      name?: string;
      date?: string;
    };
  };
  html_url?: string;
}

export interface NormalizedPullCommit {
  sha: string;
  shortSha: string;
  message: string;
  authorName: string;
  authorDate: string;
  htmlUrl: string | undefined;
}

/** Normalize a GitHub pull request commit for the frontend commit list. */
export function normalizePullCommit(commit: PullCommitResponse): NormalizedPullCommit {
  return {
    sha: commit.sha ?? '',
    shortSha: (commit.sha ?? '').slice(0, 7),
    message: (commit.commit?.message ?? '').split('\n')[0] ?? '',
    authorName: commit.commit?.author?.name ?? '',
    authorDate: commit.commit?.author?.date ?? '',
    htmlUrl: commit.html_url,
  };
}

import { computed, ref, watch } from 'vue';
import type { LocationQueryRaw } from 'vue-router';

import { buildGitHubRepoContentUrl } from '~/utils/current-github-url-utils';
import getQueryParamValue from '~/utils/getQueryParamValue';
import parseGitHubRepoPath from '~/utils/parseGitHubRepoPath';

type RepoContentType = 'file' | 'dir' | 'symlink' | 'submodule';

interface RepoContentLinks {
  self: string;
  git: string;
  html: string;
}

/** A file, directory, symlink, or submodule entry in a repository tree. */
export interface RepoContentItem {
  name: string;
  path: string;
  type: RepoContentType;
  size: number;
  sha: string;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  _links: RepoContentLinks;
}

/** A file entry with decoded base64 content. */
export interface RepoFileContent extends RepoContentItem {
  type: 'file';
  content: string;
  encoding: 'base64';
}

/** A branch with its HEAD SHA and protection flag. */
export interface RepoBranch {
  name: string;
  sha: string;
  protected: boolean;
}

interface DefaultBranchResponse {
  default_branch: string;
}

interface RepoTarget {
  owner: string;
  repo: string;
}

type RepoContentsResponse = RepoContentItem[] | RepoFileContent | null;

const normalizePath = (path?: string) => {
  return (path || '').split('/').filter(Boolean).join('/');
};

const buildQuery = (query: LocationQueryRaw) => {
  const nextQuery: LocationQueryRaw = {};

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      nextQuery[key] = value;
    }
  }

  return nextQuery;
};

const buildBranchQueryValue = (branch: string, defaultBranch: string) => {
  return branch && branch !== defaultBranch ? branch : undefined;
};

const encodeContentPath = (path: string) => {
  const normalizedPath = normalizePath(path);
  if (!normalizedPath) return '';

  return normalizedPath.split('/').map(encodeURIComponent).join('/');
};

const isNotFoundError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;

  const statusCode = 'statusCode' in error ? error.statusCode : undefined;
  const status = 'status' in error ? error.status : undefined;

  return statusCode === 404 || status === 404;
};

const getRequestErrorMessage = (error: unknown, fallback: string) => {
  if (isNotFoundError(error)) {
    return 'Repository file path was not found.';
  }

  return error instanceof Error && error.message ? error.message : fallback;
};

const getBranchNotFoundMessage = (branch: string) => {
  return branch ? `Branch "${branch}" was not found.` : 'Repository branch was not found.';
};

/**
 * Options for useRepoFiles.
 * `explicitTarget` allows the caller (e.g. RepoDetail overlay) to supply
 * owner/repo directly, bypassing the route query dependency.
 */
interface UseRepoFilesOptions {
  explicitTarget?: RepoTarget | null;
  explicitPath?: string;
}

/** Browse a GitHub repository's file tree and load individual file contents. */
export function useRepoFiles(options?: UseRepoFilesOptions) {
  const apiFetch = useNekoGitApiFetch();
  const { loggedIn, ready: sessionReady } = useUserSession();
  const route = useRoute();
  const router = useRouter();
  const { clearCurrentGitHubUrl, setCurrentGitHubUrl } = useCurrentGitHubUrl();

  const currentPath = ref('');
  const currentBranch = ref('');
  const defaultBranch = ref('');
  const branches = ref<RepoBranch[]>([]);
  const directoryContents = ref<RepoContentItem[]>([]);
  const fileContent = ref<RepoFileContent | null>(null);
  const loading = ref(false);
  const error = ref('');
  const contentRequestId = ref(0);
  const repoRequestId = ref(0);

  // When an explicit target is provided (overlay mode), use it directly
  // instead of deriving from route.query.repo.
  const activeRepoTarget = computed<RepoTarget | null>(() => {
    if (options?.explicitTarget) {
      return options.explicitTarget;
    }

    const rawValue = getQueryParamValue(route.query.repo);
    if (!rawValue) return null;

    const repoPath = parseGitHubRepoPath(rawValue);
    if (!repoPath) return null;

    return {
      owner: repoPath.owner,
      repo: repoPath.repo,
    };
  });

  const activePath = computed(() => {
    if (options?.explicitPath !== undefined) {
      return normalizePath(options.explicitPath);
    }
    return normalizePath(getQueryParamValue(route.query.path));
  });
  const activeBranch = computed(() => getQueryParamValue(route.query.branch) || '');
  const hasActivePathQuery = computed(() => Object.hasOwn(route.query, 'path'));

  const isDirectory = computed(() => !fileContent.value);
  const isFile = computed(() => Boolean(fileContent.value));

  const clearState = () => {
    contentRequestId.value += 1;
    repoRequestId.value += 1;
    currentPath.value = '';
    currentBranch.value = '';
    defaultBranch.value = '';
    branches.value = [];
    directoryContents.value = [];
    fileContent.value = null;
    loading.value = false;
    error.value = '';
    clearCurrentGitHubUrl();
  };

  const setRepoContentGitHubUrl = (
    owner: string,
    repo: string,
    path: string,
    branch: string,
    type: 'directory' | 'file',
    htmlUrl?: string | null
  ) => {
    setCurrentGitHubUrl(
      htmlUrl ||
        buildGitHubRepoContentUrl({
          owner,
          repo,
          branch,
          defaultBranch: defaultBranch.value,
          path,
          type,
        })
    );
  };

  const pushRepoFilesQuery = async (query: LocationQueryRaw) => {
    await router.push({
      query: buildQuery(query),
    });
  };

  const replaceRepoFilesQuery = async (query: LocationQueryRaw) => {
    await router.replace({
      query: buildQuery(query),
    });
  };

  const loadRepoMetadata = async (owner: string, repo: string) => {
    const requestId = repoRequestId.value + 1;
    repoRequestId.value = requestId;

    try {
      const data = await apiFetch<{
        default_branch: string;
        branches?: RepoBranch[];
      }>(`/api/repos/${owner}/${repo}/default-branch`);

      if (requestId !== repoRequestId.value) return null;

      defaultBranch.value = data.default_branch;

      const branchesData = await apiFetch<{
        branches: RepoBranch[];
      }>(`/api/repos/${owner}/${repo}/branches`);

      if (requestId !== repoRequestId.value) return null;

      branches.value = branchesData.branches;
      currentBranch.value = activeBranch.value || data.default_branch;

      return data.default_branch;
    } catch (requestError) {
      console.error('Error fetching repo metadata:', requestError);
      if (requestId === repoRequestId.value) {
        error.value = getRequestErrorMessage(requestError, 'Failed to load repository metadata.');
      }
      return null;
    }
  };

  const loadContent = async (owner: string, repo: string, path: string, branch: string) => {
    const requestId = contentRequestId.value + 1;
    contentRequestId.value = requestId;
    loading.value = true;

    try {
      const encodedPath = encodeContentPath(path);
      const refQuery = branch ? `?ref=${encodeURIComponent(branch)}` : '';
      const basePath = `/api/repos/${owner}/${repo}/contents`;
      const fullPath = encodedPath ? `${basePath}/${encodedPath}` : basePath;
      const response = await apiFetch<RepoContentsResponse>(`${fullPath}${refQuery}`);

      if (requestId !== contentRequestId.value) return;

      if (Array.isArray(response)) {
        directoryContents.value = response;
        fileContent.value = null;
        setRepoContentGitHubUrl(owner, repo, path, branch, 'directory');
        return;
      }

      if (response) {
        directoryContents.value = [];
        fileContent.value = response;
        setRepoContentGitHubUrl(owner, repo, path, branch, 'file', response.html_url);
        return;
      }

      directoryContents.value = [];
      fileContent.value = null;
      setCurrentGitHubUrl(null);
      error.value = 'Repository file path was not found.';
    } catch (requestError) {
      console.error('Error fetching repository contents:', requestError);

      if (requestId === contentRequestId.value) {
        directoryContents.value = [];
        fileContent.value = null;
        setCurrentGitHubUrl(null);
        error.value = getRequestErrorMessage(requestError, 'Failed to load repository contents.');
      }
    } finally {
      if (requestId === contentRequestId.value) {
        loading.value = false;
      }
    }
  };

  const loadRepoFiles = async (target: RepoTarget, path: string, branch: string) => {
    loading.value = true;
    error.value = '';

    const loadedDefaultBranch = await loadRepoMetadata(target.owner, target.repo);
    if (!loadedDefaultBranch) {
      loading.value = false;
      return;
    }

    if (branch && !branches.value.some((repoBranch) => repoBranch.name === branch)) {
      contentRequestId.value += 1;
      currentPath.value = path;
      currentBranch.value = branch;
      directoryContents.value = [];
      fileContent.value = null;
      error.value = getBranchNotFoundMessage(branch);
      loading.value = false;
      return;
    }

    if (branch === loadedDefaultBranch) {
      const canonicalizingTarget = { ...target };
      const canonicalizingPath = path;
      const canonicalizingBranch = branch;
      const canonicalizingHasPathQuery = hasActivePathQuery.value;

      await loadContent(target.owner, target.repo, path, loadedDefaultBranch);

      const currentTarget = activeRepoTarget.value;
      if (
        !currentTarget ||
        currentTarget.owner !== canonicalizingTarget.owner ||
        currentTarget.repo !== canonicalizingTarget.repo ||
        activePath.value !== canonicalizingPath ||
        activeBranch.value !== canonicalizingBranch ||
        hasActivePathQuery.value !== canonicalizingHasPathQuery
      ) {
        return;
      }

      await replaceRepoFilesQuery({
        ...route.query,
        branch: undefined,
        path: hasActivePathQuery.value ? path : undefined,
      });
      return;
    }

    await loadContent(target.owner, target.repo, path, branch || loadedDefaultBranch);
  };

  const retry = async () => {
    const target = activeRepoTarget.value;
    if (!target) return;

    await loadRepoFiles(target, activePath.value, activeBranch.value || currentBranch.value);
  };

  const navigateToPath = async (path: string) => {
    await pushRepoFilesQuery({
      ...route.query,
      path: normalizePath(path),
      branch: buildBranchQueryValue(currentBranch.value, defaultBranch.value),
      view: undefined,
    });
  };

  const navigateToBranch = async (branch: string) => {
    await pushRepoFilesQuery({
      ...route.query,
      branch: buildBranchQueryValue(branch, defaultBranch.value),
      path: hasActivePathQuery.value ? currentPath.value : undefined,
    });
  };

  const navigateUp = async () => {
    const segments = currentPath.value.split('/').filter(Boolean);
    segments.pop();

    await navigateToPath(segments.join('/'));
  };

  const navigateToRoot = async () => {
    await navigateToPath('');
  };

  // Watch for target changes. When using explicitTarget, also watch that ref.
  const watchSources = options?.explicitTarget
    ? () => [options.explicitTarget, sessionReady.value, loggedIn.value]
    : () => [
        route.query.repo,
        route.query.path,
        route.query.branch,
        sessionReady.value,
        loggedIn.value,
      ];

  watch(
    watchSources,
    async () => {
      if (!import.meta.client) {
        return;
      }

      if (!sessionReady.value) {
        return;
      }

      if (!loggedIn.value) {
        clearState();
        return;
      }

      const target = activeRepoTarget.value;
      if (!target) {
        clearState();
        return;
      }

      await loadRepoFiles(target, activePath.value, activeBranch.value);
    },
    { immediate: true }
  );

  return {
    currentPath,
    currentBranch,
    defaultBranch,
    branches,
    directoryContents,
    fileContent,
    loading,
    error,
    isDirectory,
    isFile,
    navigateToPath,
    navigateToBranch,
    navigateUp,
    navigateToRoot,
    retry,
  };
}

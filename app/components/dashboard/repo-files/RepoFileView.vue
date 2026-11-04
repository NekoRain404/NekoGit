<!-- Repo File View — Detail view of a single repository file: content preview, raw/export actions and metadata. -->
<script setup lang="ts">
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileIcon,
  FolderOpenIcon,
  FolderIcon,
  HomeIcon,
  Loader2Icon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  WrapTextIcon,
} from 'lucide-vue-next';
import type { HighlighterCore, ThemeRegistration } from 'shiki/core';
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue';
import type { LocationQueryRaw } from 'vue-router';

import BranchSelector from '~/components/dashboard/repo-files/BranchSelector.vue';
import type { RepoContentItem } from '~/composables/useRepoFiles';
import {
  buildCurrentGitHubRepository,
  normalizeCurrentGitHubUrl,
} from '~/utils/current-github-url-utils';
import {
  buildDashboardQueryFromNavigationEntry,
  /** Dashboard Navigation Entry. */
  type DashboardNavigationEntry,
} from '~/utils/dashboard-url-navigation-utils';
import {
  countRepositoryTextLines,
  decodeRepositoryFileBase64,
  decodeRepositoryFileText,
  formatRepositoryFileSize,
  getRepositoryFileExtension,
  getRepositoryFileName,
  isRepositoryFileBinary,
  resolveRepositoryFileLanguage,
} from '~/utils/repo-file-content-utils';
import {
  buildRepositoryFileTree,
  buildVisibleRepositoryTreeRows,
  countRepositoryTreeFiles,
  findRepositoryTreeNodeByPath,
  /** Folder Tree Node. */
  type FolderTreeNode,
  /** Visible Tree Row. */
  type VisibleTreeRow,
} from '~/utils/repo-file-tree-utils';
import { loadShikiLanguage, normalizeShikiLanguage } from '~/utils/shiki-language-loader';

const props = defineProps<{
  owner: string;
  repo: string;
}>();

const { t } = useI18n();
const { writeClipboardText } = useClipboardWriter();
const { saveFile } = useFileDownloader();
const {
  available: desktopAvailable,
  getLocalRepositoryStatus,
  loadRuntimeInfo,
  openGithubUrl,
  openLocalRepositoryPath,
} = useDesktopRuntime();
const localePath = useLocalePath();
const apiFetch = useNekoGitApiFetch();
const router = useRouter();
const {
  currentEntry,
  goBack: goNavigationBack,
  goToHome,
  navigateToFile,
  previousEntry,
  replaceWithEntry,
} = useNavigationHistory();

const isPreviousEntryCurrentRepository = computed(() => {
  const entry = previousEntry.value;
  const data = entry?.data;

  return entry?.type === 'repository' && data?.owner === props.owner && data.repo === props.repo;
});

const shouldShowRepoButton = computed(() => !isPreviousEntryCurrentRepository.value);

const {
  branches,
  currentBranch,
  defaultBranch,
  directoryContents,
  fileContent,
  currentPath,
  loading,
  error,
  navigateToBranch,
  navigateToPath,
} = useRepoFiles();

const treeNodes = ref<FolderTreeNode[]>([]);
const collapsedDirectories = ref(new Set<string>());
const sidebarCollapsed = ref(false);
const treeLoading = ref(false);
const treeScrollElement = ref<HTMLElement | null>(null);
const wordWrap = ref(false);
const copiedAction = ref<'content' | 'path' | null>(null);
const copyResetTimer = shallowRef<ReturnType<typeof setTimeout> | null>(null);
const localRepositoryAvailable = ref(false);
const localRepositoryStatusLoading = ref(false);
const openingLocalPath = ref(false);
let localRepositoryStatusRequestId = 0;

const treeScrollPositions = useState<Record<string, number>>(
  'repo-file-tree-scroll-positions',
  () => ({})
);
const treeRequestId = ref(0);

const treeScrollKey = computed(() =>
  [
    'repo-tree',
    props.owner,
    props.repo,
    currentBranch.value || defaultBranch.value || 'default',
  ].join(':')
);
const currentBranchQueryValue = computed(() => {
  return canonicalBranch.value && canonicalBranch.value !== defaultBranch.value
    ? canonicalBranch.value
    : undefined;
});
const canonicalBranch = computed(() => currentBranch.value || defaultBranch.value || undefined);
const desktopRepository = computed(() => buildCurrentGitHubRepository(props.owner, props.repo));
const desktopCloneUrl = computed(() => desktopRepository.value?.cloneUrl ?? '');
const canOpenLocalPath = computed(
  () =>
    desktopAvailable.value &&
    localRepositoryAvailable.value &&
    Boolean(currentPath.value) &&
    !openingLocalPath.value
);

const buildBranchQueryValue = (branch?: string) => {
  return branch && branch !== defaultBranch.value ? branch : undefined;
};

const saveTreeScrollPosition = () => {
  treeScrollPositions.value = {
    ...treeScrollPositions.value,
    [treeScrollKey.value]: treeScrollElement.value?.scrollTop ?? 0,
  };
};

const restoreTreeScrollPosition = async () => {
  await nextTick();
  const element = treeScrollElement.value;
  if (!element) return;

  element.scrollTop = treeScrollPositions.value[treeScrollKey.value] ?? element.scrollTop;
};

const highlighter = shallowRef<HighlighterCore | null>(null);
const highlightedHtml = ref('');
const highlightLoading = ref(false);
const loadedHighlighterLanguages = new Set<string>();

/** Repo File Highlighter Runtime. */
interface RepoFileHighlighterRuntime {
  createHighlighter: (typeof import('shiki/core'))['createHighlighterCore'];
  createJavaScriptRegexEngine: (typeof import('shiki/engine/javascript'))['createJavaScriptRegexEngine'];
  githubLight: ThemeRegistration;
  githubDark: ThemeRegistration;
}

let highlighterRuntimePromise: Promise<RepoFileHighlighterRuntime> | null = null;

const loadHighlighterRuntime = (): Promise<RepoFileHighlighterRuntime> => {
  if (!highlighterRuntimePromise) {
    highlighterRuntimePromise = Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript'),
      import('@shikijs/themes/github-light'),
      import('@shikijs/themes/github-dark'),
    ]).then(([shikiCoreModule, shikiEngineModule, githubLightModule, githubDarkModule]) => ({
      createHighlighter: shikiCoreModule.createHighlighterCore,
      createJavaScriptRegexEngine: shikiEngineModule.createJavaScriptRegexEngine,
      githubLight: githubLightModule.default,
      githubDark: githubDarkModule.default,
    }));

    highlighterRuntimePromise.catch(() => {
      highlighterRuntimePromise = null;
    });
  }

  return highlighterRuntimePromise;
};

const fileBytes = computed(() => {
  return decodeRepositoryFileBase64(fileContent.value?.content);
});

const isFileTooLarge = computed(() => Boolean(fileContent.value?.tooLarge));

const decodedContent = computed(() => {
  return decodeRepositoryFileText(fileBytes.value);
});

const isBinaryFile = computed(() => {
  if (!fileContent.value) return false;
  return isRepositoryFileBinary(fileBytes.value);
});

const lineCount = computed(() => {
  if (isBinaryFile.value || !decodedContent.value) return 0;
  return countRepositoryTextLines(decodedContent.value);
});

const fileExtension = computed(() => {
  return getRepositoryFileExtension(currentPath.value);
});

const fileName = computed(() => {
  return getRepositoryFileName(currentPath.value);
});

const rawFileUrl = computed(() => {
  if (!fileContent.value?.download_url) return null;

  return normalizeCurrentGitHubUrl(fileContent.value.download_url);
});

/** Same-origin raw endpoint used to download files too large to inline for preview. */
const rawDownloadUrl = computed(() => {
  if (!currentPath.value) return null;

  const encodedPath = currentPath.value.split('/').map(encodeURIComponent).join('/');
  const refQuery = currentBranch.value ? `?ref=${encodeURIComponent(currentBranch.value)}` : '';
  const owner = encodeURIComponent(props.owner);
  const repo = encodeURIComponent(props.repo);

  return `/api/repos/${owner}/${repo}/raw/${encodedPath}${refQuery}`;
});

const sortedDirectoryContents = computed(() => {
  const dirs = directoryContents.value
    .filter((item) => item.type === 'dir')
    .sort((a, b) => a.name.localeCompare(b.name));

  const files = directoryContents.value
    .filter((item) => item.type === 'file')
    .sort((a, b) => a.name.localeCompare(b.name));

  return [...dirs, ...files];
});

const itemCount = computed(() => directoryContents.value.length);

const loadLanguageRegistration = async (language: string | null) => {
  if (!language || language === 'text' || loadedHighlighterLanguages.has(language)) return;

  const registrations = await loadShikiLanguage(language);
  if (registrations.length === 0) return;

  await highlighter.value?.loadLanguage(...registrations);
  loadedHighlighterLanguages.add(language);
};

const initHighlighter = async (
  language: string | null
): Promise<RepoFileHighlighterRuntime | null> => {
  const runtime = await loadHighlighterRuntime();

  if (highlighter.value) {
    await loadLanguageRegistration(language);
    return runtime;
  }

  try {
    highlighter.value = await runtime.createHighlighter({
      engine: runtime.createJavaScriptRegexEngine({ forgiving: true }),
      themes: [runtime.githubLight, runtime.githubDark],
      langs: [],
    });
    await loadLanguageRegistration(language);
    return runtime;
  } catch (err) {
    console.error('Failed to initialize highlighter:', err);
    return null;
  }
};

const highlightCode = async () => {
  if (!fileContent.value || isBinaryFile.value || isFileTooLarge.value) {
    highlightedHtml.value = '';
    return;
  }

  highlightLoading.value = true;

  try {
    const language = normalizeShikiLanguage(resolveRepositoryFileLanguage(fileExtension.value));
    const runtime = await initHighlighter(language);
    if (!highlighter.value || !runtime) return;

    const code = decodedContent.value;

    // Limit highlighting to prevent freezing on huge files
    if (code.length > 500_000) {
      highlightedHtml.value = '';
      return;
    }

    highlightedHtml.value = highlighter.value.codeToHtml(code, {
      lang: language ?? 'text',
      themes: {
        light: runtime.githubLight,
        dark: runtime.githubDark,
      },
      transformers: [
        {
          line(node, line) {
            node.properties['data-line'] = line;
          },
        },
      ],
    });
  } catch {
    highlightedHtml.value = '';
  } finally {
    highlightLoading.value = false;
  }
};

const clearCopyResetTimer = () => {
  if (!copyResetTimer.value) return;

  clearTimeout(copyResetTimer.value);
  copyResetTimer.value = null;
};

const markCopiedAction = (action: 'content' | 'path') => {
  copiedAction.value = action;
  copyResetTimer.value = setTimeout(() => {
    copiedAction.value = null;
    copyResetTimer.value = null;
  }, 2000);
};

const copyContent = async () => {
  if (!decodedContent.value) return;

  clearCopyResetTimer();
  copiedAction.value = null;

  try {
    const didCopy = await writeClipboardText(decodedContent.value, {
      label: 'NekoGit File Content',
    });
    if (!didCopy) return;

    markCopiedAction('content');
  } catch {
    // Silently fail
  }
};

const copyFilePath = async () => {
  if (!currentPath.value) return;

  clearCopyResetTimer();
  copiedAction.value = null;

  try {
    const didCopy = await writeClipboardText(currentPath.value, {
      label: 'NekoGit Repository File Path',
    });
    if (!didCopy) return;

    markCopiedAction('path');
  } catch {
    // Silently fail
  }
};

const openUrlInNewWindow = (url: string) => {
  if (!import.meta.client) return false;

  const openedWindow = window.open(url, '_blank', 'noopener,noreferrer');
  if (openedWindow) {
    openedWindow.opener = null;
  }

  return Boolean(openedWindow);
};

const openRawFile = async () => {
  const url = rawFileUrl.value;
  if (!url) return;

  try {
    await openGithubUrl(url);
  } catch {
    openUrlInNewWindow(url);
  }
};

const refreshLocalRepositoryStatus = async () => {
  const cloneUrl = desktopCloneUrl.value;
  const requestId = ++localRepositoryStatusRequestId;
  localRepositoryAvailable.value = false;

  if (!desktopAvailable.value || !cloneUrl) {
    return;
  }

  localRepositoryStatusLoading.value = true;
  try {
    const status = await getLocalRepositoryStatus(cloneUrl);
    if (requestId !== localRepositoryStatusRequestId) return;

    localRepositoryAvailable.value = status.exists;
  } catch {
    if (requestId === localRepositoryStatusRequestId) {
      localRepositoryAvailable.value = false;
    }
  } finally {
    if (requestId === localRepositoryStatusRequestId) {
      localRepositoryStatusLoading.value = false;
    }
  }
};

const openCurrentLocalPath = async () => {
  const cloneUrl = desktopCloneUrl.value;
  const path = currentPath.value;
  if (!cloneUrl || !path || openingLocalPath.value) return;

  openingLocalPath.value = true;
  try {
    const status = await openLocalRepositoryPath(cloneUrl, path);
    localRepositoryAvailable.value = Boolean(status.repositoryPath);
  } catch {
    localRepositoryAvailable.value = false;
  } finally {
    openingLocalPath.value = false;
  }
};

const downloadFile = async () => {
  if (!fileContent.value) return;

  // Inline previews only contain bytes for files GitHub returns as base64.
  // For larger files, stream the full content from the raw endpoint instead of
  // saving an empty placeholder.
  if (isFileTooLarge.value) {
    const url = rawDownloadUrl.value;
    if (!url || !import.meta.client) return;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Raw download failed with HTTP ${response.status}`);
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      await saveFile(fileName.value, bytes, {
        title: 'Save repository file',
      });
    } catch (error) {
      console.error('Failed to download large repository file:', error);
    }
    return;
  }

  await saveFile(fileName.value, fileBytes.value, {
    title: 'Save repository file',
  });
};

const loadTreeChildren = async (node: FolderTreeNode) => {
  if (node.loaded) return;

  try {
    const encodedPath = node.path.split('/').map(encodeURIComponent).join('/');
    const refQuery = currentBranch.value ? `?ref=${encodeURIComponent(currentBranch.value)}` : '';
    const response = await apiFetch<RepoContentItem[]>(
      `/api/repos/${props.owner}/${props.repo}/contents/${encodedPath}${refQuery}`
    );

    if (Array.isArray(response)) {
      const children = buildRepositoryFileTree(response);
      node.children = children;
      collapsedDirectories.value = new Set([
        ...collapsedDirectories.value,
        ...children.filter((child) => child.type === 'directory').map((child) => child.path),
      ]);
      node.loaded = true;
    }
  } catch {
    node.loaded = true;
  }
};

const loadRootTree = async () => {
  const requestId = treeRequestId.value + 1;
  treeRequestId.value = requestId;
  treeLoading.value = true;

  try {
    const refQuery = currentBranch.value ? `?ref=${encodeURIComponent(currentBranch.value)}` : '';
    const response = await apiFetch<RepoContentItem[]>(
      `/api/repos/${props.owner}/${props.repo}/contents${refQuery}`
    );

    if (requestId !== treeRequestId.value) return;

    if (Array.isArray(response)) {
      const nodes = buildRepositoryFileTree(response);
      treeNodes.value = nodes;
      collapsedDirectories.value = new Set(
        nodes.filter((node) => node.type === 'directory').map((node) => node.path)
      );
      await revealCurrentPath();
    }
  } catch {
    if (requestId === treeRequestId.value) {
      treeNodes.value = [];
    }
  } finally {
    if (requestId === treeRequestId.value) {
      treeLoading.value = false;
      await restoreTreeScrollPosition();
    }
  }
};

const isDirectoryCollapsed = (path: string) => collapsedDirectories.value.has(path);

const expandDirectoryChain = async (node: FolderTreeNode) => {
  let currentNode: FolderTreeNode | undefined = node;

  while (currentNode?.type === 'directory') {
    const nextCollapsed = new Set(collapsedDirectories.value);
    nextCollapsed.delete(currentNode.path);
    collapsedDirectories.value = nextCollapsed;

    if (!currentNode.loaded) {
      await loadTreeChildren(currentNode);
    }

    const directoryChildren: FolderTreeNode[] = currentNode.children.filter(
      (child) => child.type === 'directory'
    );
    const hasFileChildren = currentNode.children.some((child) => child.type === 'file');

    if (directoryChildren.length !== 1 || hasFileChildren) {
      return;
    }

    currentNode = directoryChildren[0];
  }
};

const toggleDirectory = async (path: string) => {
  const nextCollapsed = new Set(collapsedDirectories.value);
  const shouldExpand = nextCollapsed.has(path);

  if (shouldExpand) {
    nextCollapsed.delete(path);
  } else {
    nextCollapsed.add(path);
  }

  collapsedDirectories.value = nextCollapsed;

  const node = findRepositoryTreeNodeByPath(treeNodes.value, path);
  if (node && node.type === 'directory' && shouldExpand) {
    await expandDirectoryChain(node);
  }
};

const visibleTreeRows = computed(() => {
  return buildVisibleRepositoryTreeRows(treeNodes.value, collapsedDirectories.value);
});

const countFiles = countRepositoryTreeFiles;

const isCurrentPath = (path: string) => currentPath.value === path;

const normalizeNavigationEntryBranch = (
  entry: DashboardNavigationEntry,
  branch: string | undefined
) => {
  const data = entry.data;

  if (
    (entry.type === 'repository' || entry.type === 'file') &&
    data?.owner === props.owner &&
    data.repo === props.repo
  ) {
    return buildBranchQueryValue(
      entry.type === 'repository' ? (branch ?? canonicalBranch.value) : branch
    );
  }

  return branch;
};

const navigateToEntryRoute = async (entry: typeof previousEntry.value) => {
  if (!entry || entry.type === 'dashboard' || entry.type === 'notification') {
    await router.push(localePath('/dashboard'));
    return;
  }

  const query = buildDashboardQueryFromNavigationEntry(entry, {
    repositoryTab: 'repos',
    normalizeBranch: normalizeNavigationEntryBranch,
  });

  if (query) {
    await router.push({ path: localePath('/dashboard'), query });
    return;
  }

  await router.push(localePath('/dashboard'));
};

const handleTreeDirectoryClick = async (row: VisibleTreeRow) => {
  await navigateToPath(row.node.path);
};

const handleTreeFileClick = async (row: VisibleTreeRow) => {
  await navigateToPath(row.node.path);
};

const goBack = async () => {
  await navigateToEntryRoute(goNavigationBack());
};

const goHome = async () => {
  goToHome();
  await router.push(localePath('/dashboard'));
};

const navigateToRepoDetail = async () => {
  replaceWithEntry({
    type: 'repository',
    data: {
      owner: props.owner,
      repo: props.repo,
      tab: 'repos',
      branch: canonicalBranch.value,
    },
  });
  const query: LocationQueryRaw = {
    tab: 'repos',
    repo: `${props.owner}/${props.repo}`,
    branch: currentBranchQueryValue.value,
  };
  await router.push({ path: localePath('/dashboard'), query });
};

const syncFileNavigationEntry = () => {
  const branch = canonicalBranch.value;
  if (!branch) return;

  const currentData = currentEntry.value?.data;
  if (
    currentEntry.value?.type === 'file' &&
    currentData?.owner === props.owner &&
    currentData.repo === props.repo &&
    currentData.path === currentPath.value &&
    currentData.branch === branch
  ) {
    return;
  }

  navigateToFile(props.owner, props.repo, currentPath.value, branch);
};

const navigateToItem = async (item: RepoContentItem) => {
  await navigateToPath(item.path);
};

const navigateUp = async () => {
  const segments = currentPath.value.split('/').filter(Boolean);
  segments.pop();

  await navigateToPath(segments.join('/'));
};

const revealCurrentPath = async () => {
  const currentDir = currentPath.value;
  if (!currentDir) return;

  const parts = currentDir.split('/').filter(Boolean);
  let currentNodes = treeNodes.value;

  for (let i = 0; i < parts.length; i++) {
    const partPath = parts.slice(0, i + 1).join('/');
    const node = currentNodes.find((n) => n.path === partPath);

    if (!node || node.type !== 'directory') break;

    if (!node.loaded) {
      await loadTreeChildren(node);
    }

    if (isDirectoryCollapsed(partPath)) {
      const nextCollapsed = new Set(collapsedDirectories.value);
      nextCollapsed.delete(partPath);
      collapsedDirectories.value = nextCollapsed;
    }

    node.expanded = true;
    currentNodes = node.children;
  }
};

watch(currentPath, async () => {
  await revealCurrentPath();
  await restoreTreeScrollPosition();
});

watch(
  () => [props.owner, props.repo, currentPath.value, canonicalBranch.value],
  syncFileNavigationEntry,
  { immediate: true }
);

watch(
  () => [desktopAvailable.value, desktopCloneUrl.value],
  () => {
    void refreshLocalRepositoryStatus();
  },
  { immediate: true }
);

watch(treeScrollKey, async () => {
  treeNodes.value = [];
  collapsedDirectories.value = new Set();
  await loadRootTree();
  await restoreTreeScrollPosition();
});

watch(
  fileContent,
  () => {
    highlightCode();
  },
  { immediate: true }
);

onMounted(() => {
  loadRootTree();
  void loadRuntimeInfo();
});

onActivated(() => {
  restoreTreeScrollPosition();
});

onBeforeUnmount(clearCopyResetTimer);
</script>

<template>
  <section class="repo-file-view">
    <header class="repo-file-view__header">
      <div class="repo-file-view__identity">
        <div class="repo-file-view__nav-buttons">
          <button
            type="button"
            class="repo-file-view__nav-button"
            :aria-label="t('repoFileView.back')"
            :title="t('repoFileView.back')"
            @click="goBack"
          >
            <ArrowLeftIcon :size="16" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="repo-file-view__nav-button"
            :aria-label="t('repoFileView.home')"
            :title="t('repoFileView.home')"
            @click="goHome"
          >
            <HomeIcon :size="16" aria-hidden="true" />
          </button>
          <button
            v-if="shouldShowRepoButton"
            type="button"
            class="repo-file-view__nav-button"
            :aria-label="t('repoFileView.backToRepo')"
            :title="t('repoFileView.backToRepo')"
            @click="navigateToRepoDetail"
          >
            <FolderIcon :size="16" aria-hidden="true" />
          </button>
        </div>
        <FileIcon
          v-if="fileContent"
          :size="18"
          class="repo-file-view__header-icon"
          aria-hidden="true"
        />
        <FolderIcon v-else :size="18" class="repo-file-view__header-icon" aria-hidden="true" />
        <div class="repo-file-view__title-block">
          <p class="repo-file-view__eyebrow mb-0">{{ owner }}/{{ repo }}</p>
          <h1 v-if="fileName" class="repo-file-view__title mb-0">{{ fileName }}</h1>
        </div>
      </div>

      <div class="repo-file-view__summary">
        <BranchSelector
          :branches="branches"
          :current-branch="currentBranch"
          :default-branch="defaultBranch"
          :loading="loading && branches.length === 0"
          @select="navigateToBranch"
        />
        <span v-if="fileContent && !loading" class="repo-file-view__summary-pill">
          {{ formatRepositoryFileSize(fileContent.size) }}
        </span>
        <span
          v-if="!isBinaryFile && !isFileTooLarge && lineCount > 0"
          class="repo-file-view__summary-pill"
        >
          {{ t('repoFileView.lines', { count: lineCount }) }}
        </span>
        <span v-if="!fileContent && !loading" class="repo-file-view__summary-pill">
          {{ t('repoFileView.items', { count: itemCount }) }}
        </span>
      </div>
    </header>

    <div
      :class="[
        'repo-file-view__grid',
        { 'repo-file-view__grid--sidebar-collapsed': sidebarCollapsed },
      ]"
    >
      <aside
        :class="[
          'repo-file-view__sidebar',
          { 'repo-file-view__sidebar--collapsed': sidebarCollapsed },
        ]"
      >
        <button
          v-if="sidebarCollapsed"
          type="button"
          class="repo-file-view__collapsed-handle"
          :aria-label="t('repoFileView.expandSidebar')"
          :title="t('repoFileView.expandSidebar')"
          @click="sidebarCollapsed = false"
        >
          <PanelLeftOpenIcon :size="16" aria-hidden="true" />
        </button>

        <template v-else>
          <div class="repo-file-view__sidebar-header">
            <h2 class="repo-file-view__sidebar-title">{{ t('repoFileView.fileTree') }}</h2>
            <button
              type="button"
              class="repo-file-view__collapse-button"
              :aria-label="t('repoFileView.collapseSidebar')"
              :title="t('repoFileView.collapseSidebar')"
              @click="sidebarCollapsed = true"
            >
              <PanelLeftCloseIcon :size="14" aria-hidden="true" />
            </button>
          </div>

          <div v-if="treeLoading" class="repo-file-view__tree-loading">
            <Loader2Icon :size="16" class="spin-animation" />
            <span>{{ t('repoFileView.loadingTree') }}</span>
          </div>

          <div
            v-else
            ref="treeScrollElement"
            class="repo-file-view__tree"
            @scroll.passive="saveTreeScrollPosition"
          >
            <button
              type="button"
              :class="[
                'repo-file-view__tree-root',
                { 'repo-file-view__tree-root--active': !currentPath },
              ]"
              @click="navigateToPath('')"
            >
              <FolderIcon :size="14" aria-hidden="true" />
              <span class="repo-file-view__tree-label">{{ t('repoFileView.root') }}</span>
            </button>

            <template v-for="row in visibleTreeRows" :key="row.node.path">
              <div v-if="row.node.type === 'directory'" class="repo-file-view__tree-group">
                <button
                  type="button"
                  :class="[
                    'repo-file-view__tree-directory',
                    { 'repo-file-view__tree-directory--active': isCurrentPath(row.node.path) },
                  ]"
                  :style="{ paddingLeft: `${0.45 + row.depth * 0.9}rem` }"
                  :aria-expanded="!isDirectoryCollapsed(row.collapsePath)"
                  :aria-label="
                    isDirectoryCollapsed(row.collapsePath)
                      ? t('repoFileView.expandDirectory', { name: row.label })
                      : t('repoFileView.collapseDirectory', { name: row.label })
                  "
                  :title="row.label"
                  @click="handleTreeDirectoryClick(row)"
                >
                  <ChevronRightIcon
                    :size="14"
                    :class="[
                      'repo-file-view__tree-chevron',
                      {
                        'repo-file-view__tree-chevron--expanded': !isDirectoryCollapsed(
                          row.collapsePath
                        ),
                      },
                    ]"
                    aria-hidden="true"
                    @click.stop="toggleDirectory(row.collapsePath)"
                  />
                  <FolderIcon :size="14" aria-hidden="true" />
                  <span class="repo-file-view__tree-label">{{ row.label }}</span>
                  <span v-if="row.node.children.length" class="repo-file-view__tree-count">
                    {{ countFiles(row.node) }}
                  </span>
                </button>
              </div>

              <button
                v-else
                type="button"
                :class="[
                  'repo-file-view__tree-file',
                  { 'repo-file-view__tree-file--active': isCurrentPath(row.node.path) },
                ]"
                :style="{ paddingLeft: `${1.2 + row.depth * 0.9}rem` }"
                @click="handleTreeFileClick(row)"
              >
                <FileIcon :size="14" aria-hidden="true" />
                <span class="repo-file-view__tree-label">{{ row.node.name }}</span>
              </button>
            </template>
          </div>
        </template>
      </aside>

      <div class="repo-file-view__content">
        <div v-if="loading" class="repo-file-view__loading">
          <Loader2Icon :size="24" class="spin-animation" />
        </div>

        <div v-else-if="error" class="repo-file-view__error">
          <div class="notification is-danger is-light">
            <p>{{ error }}</p>
          </div>
        </div>

        <template v-else-if="!fileContent">
          <div v-if="sortedDirectoryContents.length" class="repo-file-view__file-list">
            <div class="repo-file-view__file-list-header">
              <span class="repo-file-view__file-list-col--name">
                {{ t('repoFileView.name') }}
              </span>
              <span class="repo-file-view__file-list-col--size">
                {{ t('repoFileView.size') }}
              </span>
            </div>

            <button
              v-if="currentPath"
              type="button"
              class="repo-file-view__file-item repo-file-view__file-item--parent"
              @click="navigateUp"
            >
              <ArrowLeftIcon :size="14" class="repo-file-view__file-icon" aria-hidden="true" />
              <span class="repo-file-view__file-name">..</span>
              <span class="repo-file-view__file-size">{{ t('repoFileView.backToParent') }}</span>
            </button>

            <button
              v-for="item in sortedDirectoryContents"
              :key="item.path"
              type="button"
              :class="[
                'repo-file-view__file-item',
                { 'repo-file-view__file-item--dir': item.type === 'dir' },
              ]"
              @click="navigateToItem(item)"
            >
              <FolderIcon
                v-if="item.type === 'dir'"
                :size="14"
                class="repo-file-view__file-icon repo-file-view__file-icon--dir"
                aria-hidden="true"
              />
              <FileIcon
                v-else
                :size="14"
                class="repo-file-view__file-icon repo-file-view__file-icon--file"
                aria-hidden="true"
              />
              <span class="repo-file-view__file-name">{{ item.name }}</span>
              <span class="repo-file-view__file-size">
                {{ item.type === 'file' ? formatRepositoryFileSize(item.size) : '' }}
              </span>
            </button>
          </div>

          <div v-else class="repo-file-view__empty">
            <p>{{ t('repoFileView.emptyDirectory') }}</p>
          </div>
        </template>

        <template v-else-if="fileContent">
          <div class="repo-file-view__toolbar">
            <div class="repo-file-view__toolbar-left">
              <span class="repo-file-view__file-name">
                <FileIcon :size="14" aria-hidden="true" />
                {{ fileName }}
              </span>
            </div>
            <div class="repo-file-view__toolbar-right">
              <button
                type="button"
                class="repo-file-view__toolbar-button"
                :disabled="!currentPath"
                :aria-label="t('repoFileView.copyPath')"
                :title="t('repoFileView.copyPath')"
                @click="copyFilePath"
              >
                <CheckIcon
                  v-if="copiedAction === 'path'"
                  :size="14"
                  aria-hidden="true"
                  class="repo-file-view__copied-icon"
                />
                <CopyIcon v-else :size="14" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="repo-file-view__toolbar-button"
                :disabled="!rawFileUrl"
                :aria-label="t('repoFileView.openRaw')"
                :title="t('repoFileView.openRaw')"
                @click="openRawFile"
              >
                <ExternalLinkIcon :size="14" aria-hidden="true" />
              </button>
              <button
                v-if="desktopAvailable"
                type="button"
                class="repo-file-view__toolbar-button"
                :disabled="!canOpenLocalPath"
                :aria-label="t('repoFileView.openLocal')"
                :title="
                  localRepositoryStatusLoading
                    ? t('repoFileView.checkingLocalRepository')
                    : t('repoFileView.openLocal')
                "
                @click="openCurrentLocalPath"
              >
                <Loader2Icon
                  v-if="openingLocalPath || localRepositoryStatusLoading"
                  :size="14"
                  class="spin-animation"
                  aria-hidden="true"
                />
                <FolderOpenIcon v-else :size="14" aria-hidden="true" />
              </button>
              <button
                v-if="!isBinaryFile && !isFileTooLarge"
                type="button"
                class="repo-file-view__toolbar-button"
                :class="{ 'repo-file-view__toolbar-button--active': wordWrap }"
                :aria-label="t('repoFileView.toggleWrap')"
                :title="t('repoFileView.toggleWrap')"
                @click="wordWrap = !wordWrap"
              >
                <WrapTextIcon :size="14" aria-hidden="true" />
              </button>
              <button
                v-if="!isFileTooLarge"
                type="button"
                class="repo-file-view__toolbar-button"
                :aria-label="t('repoFileView.copyContent')"
                :title="t('repoFileView.copyContent')"
                @click="copyContent"
              >
                <CheckIcon
                  v-if="copiedAction === 'content'"
                  :size="14"
                  aria-hidden="true"
                  class="repo-file-view__copied-icon"
                />
                <CopyIcon v-else :size="14" aria-hidden="true" />
              </button>
              <a
                :href="fileContent.download_url || undefined"
                download
                class="repo-file-view__toolbar-button"
                :aria-label="t('repoFileView.download')"
                :title="t('repoFileView.download')"
                @click.prevent="downloadFile"
              >
                <DownloadIcon :size="14" aria-hidden="true" />
              </a>
            </div>
          </div>

          <div v-if="isFileTooLarge" class="repo-file-view__binary">
            <FileIcon :size="32" aria-hidden="true" />
            <p class="repo-file-view__binary-title">{{ t('repoFileView.fileTooLarge') }}</p>
            <p class="repo-file-view__binary-hint">{{ t('repoFileView.fileTooLargeHint') }}</p>
            <button
              type="button"
              class="button is-small is-link is-light mt-3"
              @click="downloadFile"
            >
              <DownloadIcon :size="14" aria-hidden="true" />
              <span>{{ t('repoFileView.download') }}</span>
            </button>
          </div>

          <div v-else-if="isBinaryFile" class="repo-file-view__binary">
            <FileIcon :size="32" aria-hidden="true" />
            <p class="repo-file-view__binary-title">{{ t('repoFileView.binaryFile') }}</p>
            <p class="repo-file-view__binary-hint">{{ t('repoFileView.binaryFileHint') }}</p>
            <button
              type="button"
              class="button is-small is-link is-light mt-3"
              @click="downloadFile"
            >
              <DownloadIcon :size="14" aria-hidden="true" />
              <span>{{ t('repoFileView.download') }}</span>
            </button>
          </div>

          <div
            v-else
            :class="[
              'repo-file-view__code-wrapper',
              { 'repo-file-view__code-wrapper--wrap': wordWrap },
            ]"
          >
            <div v-if="highlightLoading" class="repo-file-view__highlight-loading">
              <Loader2Icon :size="16" class="spin-animation" />
            </div>
            <div
              v-else-if="highlightedHtml"
              class="repo-file-view__code"
              v-html="highlightedHtml"
            />
            <div v-else class="repo-file-view__code-plain">
              <table class="repo-file-view__code-table">
                <tbody>
                  <tr
                    v-for="(line, index) in decodedContent.split('\n')"
                    :key="index"
                    class="repo-file-view__code-line"
                  >
                    <td class="repo-file-view__line-number">{{ index + 1 }}</td>
                    <td class="repo-file-view__line-content">{{ line }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>

        <div v-else class="repo-file-view__empty" />
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '~/assets/scss/_variables' as *;

.repo-file-view {
  height: 100%;
  min-height: 0;
  background: var(--nekogit-surface);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

// Header

.repo-file-view__header {
  min-height: 3.25rem;
  padding: 0.45rem 0.75rem;
  border-bottom: 1px solid var(--nekogit-border);
  background: var(--nekogit-surface-muted);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex: none;
}

.repo-file-view__identity,
.repo-file-view__summary {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.repo-file-view__header-icon {
  flex: none;
  color: var(--nekogit-text-muted);
}

.repo-file-view__title-block {
  min-width: 0;
}

.repo-file-view__eyebrow {
  color: var(--nekogit-text-muted);
  font-size: 0.72rem;
  font-weight: 600;
}

.repo-file-view__title {
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
  font-size: 0.9rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.repo-file-view__summary {
  flex: none;
  justify-content: flex-end;
}

.repo-file-view__summary-pill {
  min-height: 1.65rem;
  padding: 0.18rem 0.5rem;
  border: 1px solid var(--nekogit-border);
  border-radius: 999px;
  background: var(--nekogit-surface);
  color: var(--nekogit-text-muted);
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.72rem;
  font-weight: 700;
}

.repo-file-view__back-button {
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--nekogit-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background 0.1s ease,
    color 0.1s ease;

  &:hover {
    background: var(--nekogit-surface-hover);
    color: var(--bulma-text-strong, var(--nekogit-text-strong));
  }
}

.repo-file-view__nav-buttons {
  display: flex;
  align-items: center;
  gap: 0.125rem;
  margin-right: 0.5rem;
  padding: 0.125rem;
  border-radius: 8px;
  background: var(--nekogit-surface);
  border: 1px solid var(--nekogit-border);
}

.repo-file-view__nav-button {
  width: 1.75rem;
  height: 1.75rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--nekogit-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background 0.1s ease,
    color 0.1s ease;

  &:hover {
    background: var(--nekogit-surface-hover);
    color: var(--bulma-text-strong, var(--nekogit-text-strong));
  }
}

.repo-file-view__grid {
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-columns: var(--file-sidebar-width, 15.5rem) minmax(0, 1fr);
  transition: grid-template-columns 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

.repo-file-view__grid--sidebar-collapsed {
  --file-sidebar-width: 2.75rem;
}

.repo-file-view__grid > * {
  min-width: 0;
  min-height: 0;
}

// Sidebar

.repo-file-view__sidebar {
  height: 100%;
  border-right: 1px solid var(--nekogit-border);
  background: var(--nekogit-surface-muted);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.repo-file-view__sidebar--collapsed {
  background: var(--nekogit-surface);
}

.repo-file-view__collapsed-handle {
  width: 100%;
  height: 100%;
  border: 0;
  background: transparent;
  color: var(--nekogit-text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.repo-file-view__collapsed-handle:hover {
  background: var(--nekogit-info-soft);
  color: var(--nekogit-info);
}

.repo-file-view__sidebar-header {
  min-height: 2.5rem;
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid var(--nekogit-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.repo-file-view__sidebar-title {
  margin: 0;
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
  font-size: 0.82rem;
  font-weight: 700;
}

.repo-file-view__collapse-button {
  width: 1.75rem;
  height: 1.75rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--nekogit-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.repo-file-view__collapse-button:hover {
  background: var(--nekogit-surface-hover);
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
}

.repo-file-view__tree-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--nekogit-text-muted);
  font-size: 0.75rem;
}

.repo-file-view__tree {
  overflow-y: auto;
  flex: 1;
  padding: 0.35rem;
}

.repo-file-view__tree-root {
  width: 100%;
  min-height: 2rem;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0 0.45rem;
  text-align: left;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
}

.repo-file-view__tree-root:hover,
.repo-file-view__tree-root--active {
  background: var(--nekogit-info-soft);
}

.repo-file-view__tree-directory,
.repo-file-view__tree-file {
  width: 100%;
  min-height: 2rem;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0 0.45rem;
  text-align: left;
  cursor: pointer;
}

.repo-file-view__tree-file {
  min-height: 2.15rem;
  margin-top: 0.08rem;
  border-left: 3px solid transparent;
}

.repo-file-view__tree-group + .repo-file-view__tree-group,
.repo-file-view__tree-file + .repo-file-view__tree-group {
  margin-top: 0.15rem;
}

.repo-file-view__tree-chevron {
  transition: transform 0.15s ease;
  flex-shrink: 0;
  cursor: pointer;
}

.repo-file-view__tree-directory:hover,
.repo-file-view__tree-file:hover,
.repo-file-view__tree-directory--active,
.repo-file-view__tree-file--active {
  background: var(--nekogit-info-soft);
}

.repo-file-view__tree-directory--active {
  border-left: 3px solid var(--nekogit-info);
  font-weight: 700;
}

.repo-file-view__tree-file--active {
  border-left-color: var(--nekogit-info);
  font-weight: 700;
}

.repo-file-view__tree-chevron--expanded {
  transform: rotate(90deg);
}

.repo-file-view__tree-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
}

.repo-file-view__tree-count {
  color: var(--nekogit-text-muted);
  font-size: 0.68rem;
  font-weight: 700;
}

// Content panel

.repo-file-view__content {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.repo-file-view__loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--nekogit-text-muted);
}

.repo-file-view__error {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.repo-file-view__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--nekogit-text-muted);
  font-size: 0.85rem;
}

.repo-file-view__file-list {
  flex: 1;
  overflow-y: auto;
}

.repo-file-view__file-list-header {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--nekogit-border);
  background: var(--nekogit-surface-muted);
  color: var(--nekogit-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
}

.repo-file-view__file-list-col--name {
  flex: 1;
  min-width: 0;
}

.repo-file-view__file-list-col--size {
  width: 6rem;
  text-align: right;
  flex: none;
}

.repo-file-view__file-item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 0;
  border-bottom: 1px solid var(--nekogit-border);
  background: transparent;
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
  font-size: 0.82rem;
  text-align: left;
  cursor: pointer;
  transition: background 0.1s ease;

  &:last-child {
    border-bottom: 0;
  }

  &:hover {
    background: var(--nekogit-surface-hover);
  }
}

.repo-file-view__file-item--parent {
  color: var(--nekogit-text-muted);
  font-weight: 600;
}

.repo-file-view__file-icon {
  flex-shrink: 0;
}

.repo-file-view__file-icon--dir {
  color: $brand-primary;
}

.repo-file-view__file-icon--file {
  color: var(--nekogit-text-muted);
}

.repo-file-view__file-size {
  width: 6rem;
  text-align: right;
  flex: none;
  color: var(--nekogit-text-muted);
  font-size: 0.72rem;
}

// Toolbar

.repo-file-view__toolbar {
  min-height: 2.5rem;
  padding: 0.35rem 0.75rem;
  border-bottom: 1px solid var(--nekogit-border);
  background: var(--nekogit-surface-muted);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex: none;
}

.repo-file-view__toolbar-left {
  display: flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
}

.repo-file-view__file-name {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex: 1;
  min-width: 0;
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
  font-size: 0.82rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.repo-file-view__toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex: none;
}

.repo-file-view__toolbar-button {
  width: 1.75rem;
  height: 1.75rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--nekogit-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  text-decoration: none;

  &:hover {
    background: var(--nekogit-surface-hover);
    color: var(--bulma-text-strong, var(--nekogit-text-strong));
  }

  &:disabled {
    cursor: default;
    opacity: 0.45;
  }

  &:disabled:hover {
    background: transparent;
    color: var(--nekogit-text-muted);
  }
}

.repo-file-view__toolbar-button--active {
  background: var(--nekogit-info-soft);
  color: var(--nekogit-info);
}

.repo-file-view__copied-icon {
  color: var(--nekogit-success);
}

// Binary file

.repo-file-view__binary {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--nekogit-text-muted);
  padding: 2rem;
}

.repo-file-view__binary-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
}

.repo-file-view__binary-hint {
  margin: 0;
  font-size: 0.82rem;
  text-align: center;
}

// Code display

.repo-file-view__code-wrapper {
  flex: 1;
  overflow: auto;
  min-height: 0;
  background: var(--nekogit-surface);
}

.repo-file-view__code-wrapper--wrap {
  :deep(.line-content) {
    white-space: pre-wrap;
    word-break: break-all;
  }
}

.repo-file-view__highlight-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: var(--nekogit-text-muted);
}

.repo-file-view__code {
  font-family: var(--nekogit-code-font-family);
  font-size: 0.82rem;
  line-height: 1.6;

  :deep(pre) {
    margin: 0;
    padding: 0.75rem;
    background: transparent !important;
  }

  :deep(code) {
    display: block;
  }

  :deep(.line) {
    display: inline-block;
    width: 100%;
    padding: 0 0.75rem;
    min-height: 1.6em;
  }

  :deep(.line[data-line]) {
    position: relative;

    &::before {
      content: attr(data-line);
      display: inline-block;
      width: 3rem;
      margin-right: 1rem;
      text-align: right;
      color: var(--nekogit-text-muted);
      opacity: 0.5;
      font-size: 0.75rem;
      user-select: none;
      pointer-events: none;
    }
  }
}

.repo-file-view__code-plain {
  font-family: var(--nekogit-code-font-family);
  font-size: 0.82rem;
  line-height: 1.6;
}

.repo-file-view__code-table {
  width: 100%;
  border-collapse: collapse;
}

.repo-file-view__code-line {
  &:hover {
    background: var(--nekogit-surface-hover);
  }
}

.repo-file-view__line-number {
  width: 3rem;
  padding: 0 0.75rem 0 0.75rem;
  text-align: right;
  color: var(--nekogit-text-muted);
  opacity: 0.5;
  font-size: 0.75rem;
  user-select: none;
  vertical-align: top;
  border-right: 1px solid var(--nekogit-border);
}

.repo-file-view__line-content {
  padding: 0 0.75rem;
  white-space: pre;
}

.repo-file-view__code-wrapper--wrap .repo-file-view__line-content {
  white-space: pre-wrap;
  word-break: break-all;
}

.spin-animation {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 900px) {
  .repo-file-view__grid {
    grid-template-columns: var(--file-sidebar-width, 12rem) minmax(0, 1fr);
  }
}
</style>

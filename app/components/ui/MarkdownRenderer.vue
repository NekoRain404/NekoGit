<!-- MarkdownRenderer — Renders GitHub markdown with syntax highlighting, autolinks, and mermaid diagrams. -->
<script setup lang="ts">
import { parse } from 'comark';
import type { ComarkNode, ComarkTree } from 'comark';
import type { highlightCodeBlocks } from 'comark/plugins/highlight';
import security from 'comark/plugins/security';
import type { LanguageRegistration, ThemeRegistration } from 'shiki/core';
import type { DefineComponent } from 'vue';
import { computed, provide, shallowRef } from 'vue';

import MarkdownRendererProseA from '~/components/ui/MarkdownRendererProseA.vue';
import MarkdownRendererProseMedia from '~/components/ui/MarkdownRendererProseMedia.vue';
import MarkdownRendererProseMermaidWrapper from '~/components/ui/MarkdownRendererProseMermaidWrapper.vue';
import useGitHubAutolinks from '~/composables/useGitHubAutolinks';
import { markdownRepoContextKey } from '~/utils/markdown-repo-path-utils';
import { loadShikiLanguage, normalizeShikiLanguage } from '~/utils/shiki-language-loader';

const props = defineProps<{
  value: string;
  repoOwner?: string;
  repoName?: string;
  basePath?: string;
  branch?: string;
}>();

const ast = shallowRef<ComarkTree | null>(null);
const renderRequestId = shallowRef(0);
const { applyGitHubAutolinks } = useGitHubAutolinks();
const markdownPlugins = createMarkdownPlugins();
const markdownRepoContext = computed(() => ({
  owner: props.repoOwner,
  repo: props.repoName,
  basePath: props.basePath,
  branch: props.branch,
}));

provide(markdownRepoContextKey, markdownRepoContext);

function createMarkdownPlugins() {
  return [
    security({
      blockedTags: ['script', 'style', 'iframe', 'object', 'embed'],
      allowedProtocols: ['http', 'https', 'mailto', 'tel'],
      allowDataImages: false,
    }),
  ];
}

let markdownHighlighterRuntimePromise: Promise<MarkdownHighlighterRuntime> | null = null;
let highlightQueue: Promise<void> = Promise.resolve();

/** Markdown Code Block Info. */
interface MarkdownCodeBlockInfo {
  hasCodeBlocks: boolean;
  languages: Set<string>;
}

/** Markdown Highlighter Runtime. */
interface MarkdownHighlighterRuntime {
  highlightCodeBlocks: typeof highlightCodeBlocks;
  githubLight: ThemeRegistration;
  githubDark: ThemeRegistration;
}

async function highlightMarkdownCodeBlocks(
  tree: ComarkTree,
  languageNames: Set<string>
): Promise<ComarkTree> {
  const [languages, highlighterRuntime] = await Promise.all([
    loadMarkdownLanguages(languageNames),
    loadMarkdownHighlighterRuntime(),
  ]);

  const highlightedTree = highlightQueue.then(() =>
    highlighterRuntime.highlightCodeBlocks(tree, {
      themes: {
        light: highlighterRuntime.githubLight,
        dark: highlighterRuntime.githubDark,
      },
      registerDefaultLanguages: false,
      registerDefaultThemes: false,
      languages,
      preStyles: true,
    })
  );

  // Comark keeps a module-level highlighter; serialize registration so concurrent renders
  // cannot tokenize before their language grammars are loaded.
  highlightQueue = highlightedTree.then(
    () => undefined,
    () => undefined
  );

  return highlightedTree;
}

function loadMarkdownHighlighterRuntime(): Promise<MarkdownHighlighterRuntime> {
  if (!markdownHighlighterRuntimePromise) {
    markdownHighlighterRuntimePromise = Promise.all([
      import('comark/plugins/highlight'),
      import('@shikijs/themes/github-light'),
      import('@shikijs/themes/github-dark'),
    ]).then(([highlightModule, githubLightModule, githubDarkModule]) => ({
      highlightCodeBlocks: highlightModule.highlightCodeBlocks,
      githubLight: githubLightModule.default,
      githubDark: githubDarkModule.default,
    }));
    markdownHighlighterRuntimePromise.catch(() => {
      markdownHighlighterRuntimePromise = null;
    });
  }

  return markdownHighlighterRuntimePromise;
}

async function loadMarkdownLanguages(languages: Set<string>): Promise<LanguageRegistration[]> {
  if (languages.size === 0) {
    return [];
  }

  const modules = await Promise.all([...languages].map((language) => loadShikiLanguage(language)));

  return modules.flat();
}

function inspectMarkdownCodeBlocks(tree: ComarkTree): MarkdownCodeBlockInfo {
  const codeBlockInfo: MarkdownCodeBlockInfo = {
    hasCodeBlocks: false,
    languages: new Set<string>(),
  };

  for (const node of tree.nodes) {
    collectCodeBlockInfo(node, codeBlockInfo);
  }

  return codeBlockInfo;
}

function collectCodeBlockInfo(node: ComarkNode, codeBlockInfo: MarkdownCodeBlockInfo) {
  if (!Array.isArray(node)) {
    return;
  }

  if (node[0] === 'pre' && Array.isArray(node[2]) && node[2][0] === 'code') {
    codeBlockInfo.hasCodeBlocks = true;
    const language = normalizeShikiLanguage(node[1].language);
    if (language) {
      codeBlockInfo.languages.add(language);
    }
  }

  for (const child of node.slice(2)) {
    if (Array.isArray(child)) {
      collectCodeBlockInfo(child, codeBlockInfo);
    }
  }
}

const rendererComponents: Record<string, string | DefineComponent<any, any, any>> = {
  a: MarkdownRendererProseA,
  audio: MarkdownRendererProseMedia,
  img: MarkdownRendererProseMedia,
  pre: MarkdownRendererProseMermaidWrapper,
  source: MarkdownRendererProseMedia,
  track: MarkdownRendererProseMedia,
  video: MarkdownRendererProseMedia,
};

watch(
  () => [props.value, props.repoOwner, props.repoName, props.basePath, props.branch],
  async ([value, repoOwner, repoName]) => {
    const requestId = renderRequestId.value + 1;
    renderRequestId.value = requestId;

    if (!value) {
      ast.value = null;
      return;
    }

    const parsedMarkdown = await parse(value, {
      plugins: markdownPlugins,
    });
    const codeBlockInfo = inspectMarkdownCodeBlocks(parsedMarkdown);
    const renderedMarkdown =
      codeBlockInfo.languages.size > 0
        ? await highlightMarkdownCodeBlocks(parsedMarkdown, codeBlockInfo.languages)
        : parsedMarkdown;

    await applyGitHubAutolinks(renderedMarkdown, {
      repoOwner,
      repoName,
    });

    if (requestId !== renderRequestId.value) {
      return;
    }

    ast.value = renderedMarkdown;
  },
  { immediate: true }
);
</script>

<template>
  <ComarkRenderer v-if="ast" class="markdown-body" :tree="ast" :components="rendererComponents" />
</template>

<style lang="scss" src="@primer/css/color-modes/themes/light.scss" />
<style lang="scss" src="@primer/css/color-modes/themes/dark.scss" />
<style lang="scss" src="@primer/css/primitives/index.scss" />
<style lang="scss" src="@primer/css/markdown/index.scss" />
<style lang="scss">
.markdown-body {
  font-size: 14px;
  p {
    white-space: normal;
  }
  hr {
    display: revert;
  }
  h3:not(:first-child) {
    margin-top: revert;
  }
  code {
    color: revert;
    font-weight: revert;
  }
  blockquote:not(:last-child) {
    margin-bottom: revert;
  }
  blockquote {
    background-color: revert;
  }
  a {
    text-decoration: underline;
    text-underline-offset: 0.2rem;
  }
  ul {
    list-style: none;
    margin-inline-start: revert;
    padding-left: 1em;
  }

  a > img {
    margin-right: 4px;
  }
}
</style>

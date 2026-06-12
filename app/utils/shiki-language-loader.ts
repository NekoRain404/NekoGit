import type { LanguageRegistration } from 'shiki/core';

type ShikiLanguageModule = {
  default?: LanguageRegistration | LanguageRegistration[];
};

type ShikiLanguageLoader = () => Promise<ShikiLanguageModule | LanguageRegistration>;

const shikiLanguageLoaders: Record<string, ShikiLanguageLoader> = {
  astro: () => import('shiki/langs/astro.mjs'),
  bash: () => import('shiki/langs/bash.mjs'),
  c: () => import('shiki/langs/c.mjs'),
  clojure: () => import('shiki/langs/clojure.mjs'),
  cpp: () => import('shiki/langs/cpp.mjs'),
  csharp: () => import('shiki/langs/csharp.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  dart: () => import('shiki/langs/dart.mjs'),
  diff: () => import('shiki/langs/diff.mjs'),
  dockerfile: () => import('shiki/langs/dockerfile.mjs'),
  elixir: () => import('shiki/langs/elixir.mjs'),
  erlang: () => import('shiki/langs/erlang.mjs'),
  go: () => import('shiki/langs/go.mjs'),
  graphql: () => import('shiki/langs/graphql.mjs'),
  groovy: () => import('shiki/langs/groovy.mjs'),
  haskell: () => import('shiki/langs/haskell.mjs'),
  hcl: () => import('shiki/langs/hcl.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  java: () => import('shiki/langs/java.mjs'),
  javascript: () => import('shiki/langs/javascript.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  jsx: () => import('shiki/langs/jsx.mjs'),
  kotlin: () => import('shiki/langs/kotlin.mjs'),
  latex: () => import('shiki/langs/latex.mjs'),
  less: () => import('shiki/langs/less.mjs'),
  lua: () => import('shiki/langs/lua.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  nim: () => import('shiki/langs/nim.mjs'),
  php: () => import('shiki/langs/php.mjs'),
  powershell: () => import('shiki/langs/powershell.mjs'),
  prisma: () => import('shiki/langs/prisma.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  r: () => import('shiki/langs/r.mjs'),
  ruby: () => import('shiki/langs/ruby.mjs'),
  rust: () => import('shiki/langs/rust.mjs'),
  sass: () => import('shiki/langs/sass.mjs'),
  scala: () => import('shiki/langs/scala.mjs'),
  scss: () => import('shiki/langs/scss.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  svelte: () => import('shiki/langs/svelte.mjs'),
  swift: () => import('shiki/langs/swift.mjs'),
  toml: () => import('shiki/langs/toml.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs'),
  v: () => import('shiki/langs/v.mjs'),
  vala: () => import('shiki/langs/vala.mjs'),
  vue: () => import('shiki/langs/vue.mjs'),
  xml: () => import('shiki/langs/xml.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
  zig: () => import('shiki/langs/zig.mjs'),
};

const languageAliases: Record<string, string> = {
  cjs: 'javascript',
  cmd: 'bash',
  console: 'bash',
  docker: 'dockerfile',
  golang: 'go',
  h: 'c',
  hpp: 'cpp',
  hs: 'haskell',
  js: 'javascript',
  kt: 'kotlin',
  md: 'markdown',
  mjs: 'javascript',
  ps1: 'powershell',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  sh: 'bash',
  shell: 'bash',
  ts: 'typescript',
  yml: 'yaml',
  zsh: 'bash',
};

const languageRegistrationPromises = new Map<string, Promise<LanguageRegistration[]>>();

/**
 * Normalizes a language string to a Shiki-compatible identifier, resolving
 * aliases.
 */
export function normalizeShikiLanguage(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  if (
    !normalized ||
    normalized === 'text' ||
    normalized === 'plain' ||
    normalized === 'plaintext'
  ) {
    return null;
  }

  return languageAliases[normalized] ?? normalized;
}

/**
 * Lazily loads and caches Shiki language grammars for the given language
 * identifier.
 */
export async function loadShikiLanguage(language: string): Promise<LanguageRegistration[]> {
  const loader = shikiLanguageLoaders[language];
  if (!loader) return [];

  let promise = languageRegistrationPromises.get(language);
  if (!promise) {
    promise = loader()
      .then((module) => {
        const registration =
          typeof module === 'object' && 'default' in module ? module.default : module;
        return [registration].flat().filter(Boolean) as LanguageRegistration[];
      })
      .catch(() => {
        languageRegistrationPromises.delete(language); // evict failed entry so a future load can retry
        return [];
      });
    languageRegistrationPromises.set(language, promise);
  }

  return promise;
}

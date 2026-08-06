/// Repository file content helpers: decoding, binary detection, and language mapping.
const repositoryFileLanguageByExtension: Record<string, string> = {
  astro: 'astro',
  bash: 'bash',
  c: 'c',
  clj: 'clojure',
  cpp: 'cpp',
  cs: 'csharp',
  css: 'css',
  dart: 'dart',
  dockerfile: 'dockerfile',
  erl: 'erlang',
  ex: 'elixir',
  exs: 'elixir',
  fish: 'bash',
  go: 'go',
  gql: 'graphql',
  graphql: 'graphql',
  groovy: 'groovy',
  h: 'c',
  hpp: 'cpp',
  hs: 'haskell',
  htm: 'html',
  html: 'html',
  java: 'java',
  js: 'javascript',
  json: 'json',
  jsx: 'jsx',
  kt: 'kotlin',
  less: 'less',
  lua: 'lua',
  md: 'markdown',
  nim: 'nim',
  php: 'php',
  prisma: 'prisma',
  py: 'python',
  r: 'r',
  rb: 'ruby',
  rs: 'rust',
  sass: 'sass',
  scala: 'scala',
  scss: 'scss',
  sh: 'bash',
  sql: 'sql',
  svelte: 'svelte',
  swift: 'swift',
  tex: 'latex',
  tf: 'hcl',
  toml: 'toml',
  ts: 'typescript',
  tsx: 'tsx',
  v: 'v',
  vala: 'vala',
  vue: 'vue',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  zig: 'zig',
  zsh: 'bash',
};

/** Decodes a base64 string into a Uint8Array, returning an empty array on failure. */
export const decodeRepositoryFileBase64 = (content: string | null | undefined) => {
  if (!content) return new Uint8Array();

  try {
    const binary = atob(content);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  } catch {
    return new Uint8Array();
  }
};

/** Decodes a byte array into a UTF-8 text string. */
export const decodeRepositoryFileText = (bytes: Uint8Array) => {
  if (!bytes.length) return '';

  try {
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
};

/**
 * Heuristically detects binary content by scanning for null bytes in the
 * first sampleSize bytes.
 */
export const isRepositoryFileBinary = (bytes: Uint8Array, sampleSize = 8000) => {
  if (!bytes.length) return false;

  for (let index = 0; index < Math.min(sampleSize, bytes.length); index += 1) {
    if (bytes[index] === 0) return true;
  }

  return false;
};

/** Returns the number of newline-delimited lines in a text string. */
export const countRepositoryTextLines = (text: string) => {
  return text ? text.split('\n').length : 0;
};

/** Extracts the lowercase file extension from a path. */
export const getRepositoryFileExtension = (path: string | null | undefined) => {
  if (!path) return '';

  const fileName = getRepositoryFileName(path);
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1]!.toLowerCase() : '';
};

/** Extracts the filename (last path segment) from a file path. */
export const getRepositoryFileName = (path: string | null | undefined) => {
  if (!path) return '';

  const parts = path.split('/');
  return parts[parts.length - 1] || '';
};

/** Formats a byte count into a human-readable size string (B, KB, MB). */
export const formatRepositoryFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Maps a file extension to a Shiki-compatible language identifier. */
export const resolveRepositoryFileLanguage = (extension: string | null | undefined) => {
  const normalizedExtension = extension?.toLowerCase() ?? '';
  return repositoryFileLanguageByExtension[normalizedExtension] || 'text';
};

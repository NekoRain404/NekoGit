/// Determines content-type and security headers for streaming raw repository content.
/** Headers applied when streaming authenticated raw repository content. */
export type RawContentResponseHeaders = {
  contentType: string;
  contentDisposition?: string;
  contentSecurityPolicy?: string;
  xContentTypeOptions: string;
};

const ACTIVE_DOCUMENT_EXTENSIONS = new Set([
  'svg',
  'svgz',
  'html',
  'htm',
  'xhtml',
  'xml',
  'xsl',
  'xslt',
  'mhtml',
  'mht',
]);

const IMAGE_EXTENSIONS: Record<string, string> = {
  apng: 'image/apng',
  avif: 'image/avif',
  gif: 'image/gif',
  ico: 'image/x-icon',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const AUDIO_EXTENSIONS: Record<string, string> = {
  aac: 'audio/aac',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  oga: 'audio/ogg',
  wav: 'audio/wav',
};

const VIDEO_EXTENSIONS: Record<string, string> = {
  '3gp': 'video/3gpp',
  m4v: 'video/mp4',
  mp4: 'video/mp4',
  ogv: 'video/ogg',
  mov: 'video/quicktime',
  webm: 'video/webm',
};

/** Extract a lowercase file extension from a repository path. */
export function getPathExtension(path: string): string {
  const baseName = path.split(/[\\/]/).pop() ?? path;
  const lastDot = baseName.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === baseName.length - 1) {
    return '';
  }
  return baseName.slice(lastDot + 1).toLowerCase();
}

/** True when the extension can become an active navigable document (XSS risk). */
export function isActiveDocumentExtension(extension: string): boolean {
  return ACTIVE_DOCUMENT_EXTENSIONS.has(extension);
}

/**
 * Map repository path → safe response headers for raw content proxying.
 * Active document types (SVG/HTML/XML) are forced to octet-stream + attachment
 * so they cannot execute as same-origin documents when navigated to.
 */
export function resolveRawRepoContentHeaders(path: string): RawContentResponseHeaders {
  const extension = getPathExtension(path);
  const base: RawContentResponseHeaders = {
    contentType: 'application/octet-stream',
    xContentTypeOptions: 'nosniff',
  };

  if (!extension) {
    return base;
  }

  if (isActiveDocumentExtension(extension)) {
    const fileName = path.split(/[\\/]/).pop() || `download.${extension}`;
    return {
      contentType: 'application/octet-stream',
      contentDisposition: `attachment; filename="${fileName.replace(/"/g, '')}"`,
      contentSecurityPolicy: "default-src 'none'; sandbox",
      xContentTypeOptions: 'nosniff',
    };
  }

  if (IMAGE_EXTENSIONS[extension]) {
    return { ...base, contentType: IMAGE_EXTENSIONS[extension] };
  }
  if (AUDIO_EXTENSIONS[extension]) {
    return { ...base, contentType: AUDIO_EXTENSIONS[extension] };
  }
  if (VIDEO_EXTENSIONS[extension]) {
    return { ...base, contentType: VIDEO_EXTENSIONS[extension] };
  }
  if (extension === 'vtt') {
    return { ...base, contentType: 'text/vtt; charset=utf-8' };
  }

  return base;
}

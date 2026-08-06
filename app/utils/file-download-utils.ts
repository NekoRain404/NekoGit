/// Safe download filename sanitization helpers.
const DEFAULT_DOWNLOAD_FILE_NAME = 'download';

const WINDOWS_RESERVED_FILE_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
]);

/**
 * Strips unsafe characters from a filename and appends a suffix for
 * Windows reserved names.
 */
export const sanitizeDownloadFileName = (name: string): string => {
  const baseName = name.split(/[\\/]/).pop()?.trim() ?? '';
  const sanitized = baseName
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '-')
    .replace(/[. ]+$/g, '')
    .trim();

  if (!sanitized) return DEFAULT_DOWNLOAD_FILE_NAME;

  const stem = sanitized.split('.')[0]?.toLowerCase();
  if (stem && WINDOWS_RESERVED_FILE_NAMES.has(stem)) {
    return `${sanitized}-file`;
  }

  return sanitized;
};

/** Tab Group Source. */
export type TabGroupSource = 'system' | 'github-search';

/** BUILTIN TAB GROUP ID. */
export const BUILTIN_TAB_GROUP_ID = 'built-in';
/** DEFAULT CUSTOM TAB GROUP ID. */
export const DEFAULT_CUSTOM_TAB_GROUP_ID = 'default';

/** Tab Group. */
export interface TabGroup {
  id: string;
  name: string;
  parentId?: string | null;
  collapsed?: boolean;
  source?: TabGroupSource;
}

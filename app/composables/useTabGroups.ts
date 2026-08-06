/// CRUD management for dashboard tab groups with legacy localStorage migration support.
import type { TabGroup, TabGroupSource } from '#shared/types/tab-groups';
import { BUILTIN_TAB_GROUP_ID } from '#shared/types/tab-groups';
import {
  cloneTabGroups,
  createDefaultTabGroups,
  ensureRequiredTabGroups,
  isDefaultTabGroups,
  normalizeTabGroups,
} from '#shared/utils/user-settings';

export type { TabGroup, TabGroupSource } from '#shared/types/tab-groups';
export { BUILTIN_TAB_GROUP_ID, DEFAULT_CUSTOM_TAB_GROUP_ID } from '#shared/types/tab-groups';

/** Fields accepted when creating a new tab group. */
export interface CreateTabGroupInput {
  id?: string;
  name: string;
  parentId?: string | null;
  collapsed?: boolean;
  source?: TabGroupSource;
}

/** Fields that can be updated on an existing tab group. */
export interface UpdateTabGroupInput {
  name?: string;
  parentId?: string | null;
  collapsed?: boolean;
  source?: TabGroupSource;
}

/** localStorage key used before settings were server-persisted. */
const buildLegacyStorageKey = (login: string): string => {
  return `nekogit:dashboard:tab-groups:${login}`;
};

let migratedLegacyGroupsLogin: string | null = null;

/** Read tab groups from the old localStorage-based storage format. */
const readLegacyStoredGroups = (login: string): TabGroup[] | null => {
  if (!import.meta.client) {
    return null;
  }

  const raw = window.localStorage.getItem(buildLegacyStorageKey(login));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const groups = normalizeTabGroups(parsed, []);
    return groups.length > 0 ? groups : null;
  } catch {
    return null;
  }
};

/** Delete the legacy localStorage entry after successful migration. */
const removeLegacyStoredGroups = (login: string) => {
  if (!import.meta.client) {
    return;
  }

  window.localStorage.removeItem(buildLegacyStorageKey(login));
};

/** Generate a collision-resistant unique group identifier. */
const createGroupId = () => {
  return `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

/** Persist and manage dashboard tab groups (create, rename, reorder, collapse). */
export function useTabGroups(initialGroups: TabGroup[] = createDefaultTabGroups()) {
  const { user } = useUserSession();
  const login = computed(() => user.value?.login ?? 'anonymous');
  const { settings, loaded, loadSettings, updateSettings } = useUserSettings();

  if (import.meta.client) {
    void loadSettings();
  }

  const fallbackGroups = computed(() => normalizeTabGroups(initialGroups));
  const groups = computed<TabGroup[]>({
    get() {
      return settings.value.tabGroups.length > 0
        ? settings.value.tabGroups
        : cloneTabGroups(fallbackGroups.value);
    },
    set(nextGroups) {
      void setGroups(nextGroups);
    },
  });

  const setGroups = async (nextGroups: TabGroup[]) => {
    const normalizedGroups = ensureRequiredTabGroups(
      normalizeTabGroups(nextGroups, fallbackGroups.value)
    );
    await updateSettings({ tabGroups: normalizedGroups });
    return normalizedGroups;
  };

  const migrateLegacyGroups = (nextLogin: string) => {
    if (
      !import.meta.client ||
      !loaded.value ||
      nextLogin === 'anonymous' ||
      migratedLegacyGroupsLogin === nextLogin ||
      !isDefaultTabGroups(settings.value.tabGroups)
    ) {
      return;
    }

    migratedLegacyGroupsLogin = nextLogin;
    const legacyGroups = readLegacyStoredGroups(nextLogin);
    if (!legacyGroups) {
      return;
    }

    void setGroups(legacyGroups).then(() => removeLegacyStoredGroups(nextLogin));
  };

  watch([login, loaded], ([nextLogin]) => migrateLegacyGroups(nextLogin), { immediate: true });

  const getGroupById = (groupId: string) => {
    return groups.value.find((group) => group.id === groupId);
  };

  const createGroup = (input: CreateTabGroupInput) => {
    const id = input.id && input.id.length > 0 ? input.id : createGroupId();

    if (getGroupById(id)) {
      return null;
    }

    const group: TabGroup = {
      id,
      name: input.name,
      parentId: input.parentId ?? null,
      collapsed: input.collapsed ?? false,
      source: input.source ?? 'github-search',
    };

    void setGroups([...groups.value, group]);
    return group;
  };

  const updateGroup = (groupId: string, updates: UpdateTabGroupInput) => {
    const target = getGroupById(groupId);
    if (!target) {
      return null;
    }

    if (target.source === 'system') {
      return target;
    }

    const updatedGroup: TabGroup = {
      ...target,
      ...updates,
    };

    void setGroups(
      groups.value.map((group) => {
        if (group.id !== groupId) {
          return group;
        }

        return updatedGroup;
      })
    );

    return updatedGroup;
  };

  const deleteGroup = (groupId: string) => {
    const exists = groups.value.some((group) => group.id === groupId);
    if (!exists || groupId === BUILTIN_TAB_GROUP_ID) {
      return false;
    }

    void setGroups(groups.value.filter((group) => group.id !== groupId));
    return true;
  };

  const toggleGroupCollapsed = (groupId: string) => {
    const target = getGroupById(groupId);
    if (!target) {
      return null;
    }

    return updateGroup(groupId, { collapsed: !target.collapsed });
  };

  const setGroupCollapsed = (groupId: string, collapsed: boolean) => {
    return updateGroup(groupId, { collapsed });
  };

  const sortGroups = (compareFn: (a: TabGroup, b: TabGroup) => number) => {
    const sortedGroups = [...groups.value].sort(compareFn);
    void setGroups(sortedGroups);
    return sortedGroups;
  };

  const reorderGroups = (orderedGroupIds: string[]) => {
    const groupMap = new Map(groups.value.map((group) => [group.id, group]));
    const reordered = orderedGroupIds
      .map((id) => groupMap.get(id))
      .filter((group): group is TabGroup => Boolean(group));

    const leftovers = groups.value.filter((group) => !orderedGroupIds.includes(group.id));
    const nextGroups = [...reordered, ...leftovers];
    void setGroups(nextGroups);
    return nextGroups;
  };

  const moveGroup = (fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || fromIndex >= groups.value.length) {
      return false;
    }

    if (toIndex < 0 || toIndex >= groups.value.length) {
      return false;
    }

    const next = [...groups.value];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) {
      return false;
    }

    next.splice(toIndex, 0, moved);
    void setGroups(next);
    return true;
  };

  const resetGroups = () => {
    const nextGroups = cloneTabGroups(fallbackGroups.value);
    void setGroups(nextGroups);
    return nextGroups;
  };

  return {
    groups,
    getGroupById,
    createGroup,
    updateGroup,
    deleteGroup,
    sortGroups,
    reorderGroups,
    moveGroup,
    toggleGroupCollapsed,
    setGroupCollapsed,
    resetGroups,
  };
}

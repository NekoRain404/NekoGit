/// local Repository Panel Context — shared component context.
import { inject, provide, type ComputedRef, type InjectionKey } from 'vue';

import type {
  LocalRepositoryCopy,
  LocalRepositoryPanelState,
} from '~/composables/useLocalRepositoryPanel';

/** Local Repository Panel Context. */
export type LocalRepositoryPanelContext = {
  copy: ComputedRef<LocalRepositoryCopy>;
  formatDate: (value?: string | null) => string;
  state: LocalRepositoryPanelState;
};

const localRepositoryPanelKey: InjectionKey<LocalRepositoryPanelContext> =
  Symbol('localRepositoryPanel');

export const provideLocalRepositoryPanel = (context: LocalRepositoryPanelContext) => {
  provide(localRepositoryPanelKey, context);
};

export const useLocalRepositoryPanelContext = () => {
  const context = inject(localRepositoryPanelKey);
  if (!context) {
    throw new Error('Local repository panel context is missing.');
  }

  return context;
};

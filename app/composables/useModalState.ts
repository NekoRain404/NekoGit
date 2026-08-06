/// Tracks the open/close count of dashboard modals so sibling components can react to nesting changes.
import { readonly } from 'vue';

/** Track the open/close count of modals in the dashboard so sibling components can react. */

export function useModalState() {
  const isAnyModalOpen = useState<boolean>('nekogit-modal-any-open', () => false);
  const openModalCount = useState<number>('nekogit-modal-open-count', () => 0);

  const openModal = () => {
    openModalCount.value += 1;
    isAnyModalOpen.value = true;
  };

  const closeModal = () => {
    openModalCount.value = Math.max(0, openModalCount.value - 1);
    if (openModalCount.value === 0) {
      isAnyModalOpen.value = false;
    }
  };

  const resetModals = () => {
    openModalCount.value = 0;
    isAnyModalOpen.value = false;
  };

  return {
    /** Whether any modal is currently open */
    isAnyModalOpen: readonly(isAnyModalOpen),
    /** Number of currently open modals (supports nested modals) */
    openModalCount: readonly(openModalCount),
    /** Call when opening a modal */
    openModal,
    /** Call when closing a modal */
    closeModal,
    /** Reset all modal state (e.g., when navigating away) */
    resetModals,
  };
}

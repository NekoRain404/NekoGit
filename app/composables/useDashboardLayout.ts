/// Manages persisted dashboard layout state (tab sidebar and widgets panel widths, widgets visibility).
import { watch } from 'vue';

/** Persisted layout dimensions for the dashboard sidebar and widgets panel. */
export interface DashboardLayoutState {
  isWidgetsPanelVisible: boolean;
  tabSidebarWidth: number;
  widgetsPanelWidth: number;
}

/** Partial layout overrides accepted by the layout setter. */
export interface DashboardLayoutInput {
  isWidgetsPanelVisible?: boolean;
  tabSidebarWidth?: number;
  widgetsPanelWidth?: number;
}

const STORAGE_KEY = 'nekogit:dashboard:layout';

const DEFAULT_LAYOUT: DashboardLayoutState = {
  isWidgetsPanelVisible: true,
  tabSidebarWidth: 240,
  widgetsPanelWidth: 280,
};

const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 320;
const WIDGETS_MIN_WIDTH = 250;
const WIDGETS_MAX_WIDTH = 360;

/** Constrain a numeric value between a minimum and maximum. */
const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

/** Clamp raw layout values to their min/max bounds. */
const normalizeLayout = (input: Partial<DashboardLayoutState>): DashboardLayoutState => {
  const isWidgetsPanelVisible =
    typeof input.isWidgetsPanelVisible === 'boolean'
      ? input.isWidgetsPanelVisible
      : DEFAULT_LAYOUT.isWidgetsPanelVisible;

  const tabSidebarWidth =
    typeof input.tabSidebarWidth === 'number' && Number.isFinite(input.tabSidebarWidth)
      ? clamp(input.tabSidebarWidth, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH)
      : DEFAULT_LAYOUT.tabSidebarWidth;

  const widgetsPanelWidth =
    typeof input.widgetsPanelWidth === 'number' && Number.isFinite(input.widgetsPanelWidth)
      ? clamp(input.widgetsPanelWidth, WIDGETS_MIN_WIDTH, WIDGETS_MAX_WIDTH)
      : DEFAULT_LAYOUT.widgetsPanelWidth;

  return {
    isWidgetsPanelVisible,
    tabSidebarWidth,
    widgetsPanelWidth,
  };
};

/** Read persisted layout state from localStorage. */
const readStoredLayout = (): DashboardLayoutState | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DashboardLayoutState>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    return normalizeLayout(parsed);
  } catch {
    return null;
  }
};

/** Persist the current layout state to localStorage. */
const writeStoredLayout = (layout: DashboardLayoutState) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
};

/** Persist and manage the dashboard sidebar and widget panel layout dimensions. */
export function useDashboardLayout(initialLayout: DashboardLayoutInput = DEFAULT_LAYOUT) {
  const layout = useState<DashboardLayoutState>('nekogit-dashboard-layout', () => {
    return normalizeLayout(initialLayout);
  });

  if (typeof window !== 'undefined') {
    const storedLayout = readStoredLayout();
    if (storedLayout) {
      layout.value = storedLayout;
    }
  }

  watch(
    layout,
    (nextLayout) => {
      writeStoredLayout(nextLayout);
    },
    { deep: true }
  );

  const setLayout = (updates: DashboardLayoutInput) => {
    layout.value = normalizeLayout({
      ...layout.value,
      ...updates,
    });

    return layout.value;
  };

  const toggleWidgetsPanel = () => {
    return setLayout({ isWidgetsPanelVisible: !layout.value.isWidgetsPanelVisible });
  };

  const setWidgetsPanelVisible = (visible: boolean) => {
    return setLayout({ isWidgetsPanelVisible: visible });
  };

  const setTabSidebarWidth = (width: number) => {
    return setLayout({ tabSidebarWidth: width });
  };

  const setWidgetsPanelWidth = (width: number) => {
    return setLayout({ widgetsPanelWidth: width });
  };

  const resetLayout = () => {
    layout.value = normalizeLayout(initialLayout);
    return layout.value;
  };

  const isWidgetsPanelVisible = computed(() => layout.value.isWidgetsPanelVisible);
  const tabSidebarWidth = computed(() => layout.value.tabSidebarWidth);
  const widgetsPanelWidth = computed(() => layout.value.widgetsPanelWidth);

  return {
    layout,
    isWidgetsPanelVisible,
    tabSidebarWidth,
    widgetsPanelWidth,
    setLayout,
    toggleWidgetsPanel,
    setWidgetsPanelVisible,
    setTabSidebarWidth,
    setWidgetsPanelWidth,
    resetLayout,
  };
}

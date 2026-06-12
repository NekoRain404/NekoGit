<script setup lang="ts">
import {
  ClipboardIcon,
  FileTextIcon,
  FolderOpenIcon,
  GithubIcon,
  ClipboardPasteIcon,
  PaletteIcon,
  PowerIcon,
  RefreshCwIcon,
  SearchIcon,
  ServerIcon,
  TypeIcon,
} from 'lucide-vue-next';
import { computed, nextTick, onMounted, shallowRef, useTemplateRef } from 'vue';

import type { AppFontId, CodeFontId } from '#shared/types/user-settings';
import { normalizeSystemFontFamily } from '#shared/utils/user-settings';
import DetailOverlay from '~/components/dashboard/DetailOverlay.vue';
import FontPickerModal from '~/components/ui/FontPickerModal.vue';
import { useDesktopRuntime } from '~/composables/useDesktopRuntime';
import {
  builtinAppFontOptions,
  builtinCodeFontOptions,
  useUserSettings,
} from '~/composables/useUserSettings';

const { t } = useI18n();
const localePath = useLocalePath();
const router = useRouter();
const { settings, loading, saving, error, loadSettings, updateFonts, updateDesktopNotifications } =
  useUserSettings();
const {
  runtimeInfo,
  serverStatus,
  autostartStatus,
  available: desktopAvailable,
  loading: desktopLoading,
  error: desktopError,
  loadRuntimeInfo,
  loadServerStatus,
  loadAutostartStatus,
  setAutostartEnabled,
  createDiagnosticsReport,
  openAppData,
  openServerLog,
  openGithub,
  restartBundledServer,
} = useDesktopRuntime();
const { openClipboardGithubUrl } = useClipboardGithubNavigation();
const { writeClipboardText } = useClipboardWriter();

// Font picker modal state
const showAppFontPicker = shallowRef(false);
const showCodeFontPicker = shallowRef(false);
const desktopActionError = shallowRef('');
const desktopActionMessage = shallowRef('');
const restartingBundledServer = shallowRef(false);
const updatingAutostart = shallowRef(false);

// Editable font name state
const editingAppFont = shallowRef(false);
const editingCodeFont = shallowRef(false);
const appFontInput = shallowRef('');
const codeFontInput = shallowRef('');
const appFontInputInitial = shallowRef('');
const codeFontInputInitial = shallowRef('');
const appFontInputRef = useTemplateRef<HTMLInputElement>('appFontInput');
const codeFontInputRef = useTemplateRef<HTMLInputElement>('codeFontInput');

// Bundled-only options passed to the modal; the modal loads system fonts on demand
const bundledAppFontOptions = builtinAppFontOptions.map((f) => ({
  id: f.id,
  label: f.label,
  source: 'bundled' as const,
}));

const bundledCodeFontOptions = builtinCodeFontOptions.map((f) => ({
  id: f.id,
  label: f.label,
  source: 'bundled' as const,
}));

// Current font display names
const currentAppFontName = computed(() => {
  const { appFont, appSystemFont } = settings.value.fonts;
  if (appFont === 'system' && appSystemFont) return appSystemFont;
  const found = builtinAppFontOptions.find((f) => f.id === appFont);
  return found?.label ?? appFont;
});

const currentCodeFontName = computed(() => {
  const { codeFont, codeSystemFont } = settings.value.fonts;
  if (codeFont === 'system' && codeSystemFont) return codeSystemFont;
  const found = builtinCodeFontOptions.find((f) => f.id === codeFont);
  return found?.label ?? codeFont;
});

const appFontPickerValue = computed(() => {
  const { appFont, appSystemFont } = settings.value.fonts;
  return appFont === 'system' && appSystemFont ? `system:${appSystemFont}` : appFont;
});

const codeFontPickerValue = computed(() => {
  const { codeFont, codeSystemFont } = settings.value.fonts;
  return codeFont === 'system' && codeSystemFont ? `system:${codeSystemFont}` : codeFont;
});

const desktopModeLabel = computed(() => {
  const info = runtimeInfo.value;
  if (!info) return t('dashboard.settings.desktopUnavailable');
  if (info.externalClient) return t('dashboard.settings.desktopModeExternal');
  if (info.bundledServer) return t('dashboard.settings.desktopModeBundled');
  return t('dashboard.settings.desktopModeDev');
});

const desktopServerStatusLabel = computed(() => {
  const status = serverStatus.value;
  if (!runtimeInfo.value) return t('dashboard.settings.desktopServerStatusUnavailable');
  if (!status?.bundledServer) return t('dashboard.settings.desktopServerStatusExternal');
  if (status.running) return t('dashboard.settings.desktopServerStatusRunning');
  return t('dashboard.settings.desktopServerStatusStopped');
});

const desktopServerStatusTone = computed(() => {
  const status = serverStatus.value;
  if (!runtimeInfo.value) return 'neutral';
  if (!status?.bundledServer) return 'neutral';
  return status.running ? 'success' : 'danger';
});

const desktopInfoRows = computed(() => {
  const info = runtimeInfo.value;
  if (!info) return [];

  return [
    {
      label: t('dashboard.settings.desktopClientUrl'),
      value: info.clientUrl,
    },
    {
      label: t('dashboard.settings.desktopAppDataDir'),
      value: info.appDataDir,
    },
    {
      label: t('dashboard.settings.desktopServerLogPath'),
      value: info.serverLogPath,
    },
    {
      label: t('dashboard.settings.desktopUserSettingsDir'),
      value: info.userSettingsDir,
    },
    ...(info.nodeBinary
      ? [
          {
            label: t('dashboard.settings.desktopNodeBinary'),
            value: info.nodeBinary,
          },
        ]
      : []),
    ...(autostartStatus.value?.path
      ? [
          {
            label: t('dashboard.settings.desktopAutostartPath'),
            value: autostartStatus.value.path,
          },
        ]
      : []),
  ];
});

const desktopServerRows = computed(() => {
  const status = serverStatus.value;
  if (!status) return [];

  return [
    {
      label: t('dashboard.settings.desktopServerStatus'),
      value: desktopServerStatusLabel.value,
    },
    ...(typeof status.pid === 'number'
      ? [
          {
            label: t('dashboard.settings.desktopServerPid'),
            value: String(status.pid),
          },
        ]
      : []),
    ...(typeof status.port === 'number'
      ? [
          {
            label: t('dashboard.settings.desktopServerPort'),
            value: String(status.port),
          },
        ]
      : []),
    ...(status.address
      ? [
          {
            label: t('dashboard.settings.desktopServerAddress'),
            value: status.address,
          },
        ]
      : []),
    ...(status.lastExitStatus
      ? [
          {
            label: t('dashboard.settings.desktopServerLastExit'),
            value: status.lastExitStatus,
          },
        ]
      : []),
  ];
});

const canRestartBundledServer = computed(() => Boolean(runtimeInfo.value?.bundledServer));
const canToggleAutostart = computed(() => Boolean(autostartStatus.value?.supported));

const refreshDesktopRuntime = async () => {
  await loadRuntimeInfo();
};

const handleDesktopAction = async (action: () => Promise<void>) => {
  desktopActionError.value = '';
  desktopActionMessage.value = '';

  try {
    await action();
  } catch (caughtError) {
    desktopActionError.value =
      caughtError instanceof Error
        ? caughtError.message
        : t('dashboard.settings.desktopActionFailed');
  }
};

const handleDesktopClipboardOpen = async () => {
  await handleDesktopAction(async () => {
    await openClipboardGithubUrl();
  });
};

const handleCopyDesktopDiagnostics = async () => {
  await handleDesktopAction(async () => {
    const report = await createDiagnosticsReport();
    const copied = await writeClipboardText(report, { label: 'NekoGit diagnostics' });
    if (!copied) throw new Error(t('dashboard.settings.desktopCopyDiagnosticsFailed'));

    desktopActionMessage.value = t('dashboard.settings.desktopCopyDiagnosticsDone');
  });
};

const handleRestartBundledServer = async () => {
  restartingBundledServer.value = true;

  await handleDesktopAction(async () => {
    await restartBundledServer();
    desktopActionMessage.value = t('dashboard.settings.desktopRestartServerDone');
    await loadRuntimeInfo();
    await loadServerStatus();
  });

  restartingBundledServer.value = false;
};

const handleToggleAutostart = async () => {
  if (!canToggleAutostart.value || updatingAutostart.value) return;

  updatingAutostart.value = true;

  await handleDesktopAction(async () => {
    const nextEnabled = !autostartStatus.value?.enabled;
    await setAutostartEnabled(nextEnabled);
    desktopActionMessage.value = nextEnabled
      ? t('dashboard.settings.desktopAutostartEnabled')
      : t('dashboard.settings.desktopAutostartDisabled');
    await loadAutostartStatus();
  });

  updatingAutostart.value = false;
};

const handleToggleDesktopNotifications = () => {
  void updateDesktopNotifications({
    enabled: !settings.value.desktopNotifications.enabled,
  });
};

const handleToggleDesktopNotificationBatching = () => {
  void updateDesktopNotifications({
    batchNewNotifications: !settings.value.desktopNotifications.batchNewNotifications,
  });
};

const handleToggleDesktopNotificationFocusQuiet = () => {
  void updateDesktopNotifications({
    quietWhenFocused: !settings.value.desktopNotifications.quietWhenFocused,
  });
};

// Apply font from modal selection
const applyAppFontFromModal = (fontId: string) => {
  if (fontId.startsWith('system:')) {
    const appSystemFont = normalizeSystemFontFamily(fontId.slice('system:'.length));
    if (appSystemFont) {
      void updateFonts({ appFont: 'system', appSystemFont });
    }
  } else if (builtinAppFontOptions.some((f) => f.id === fontId)) {
    void updateFonts({ appFont: fontId as AppFontId });
  }
};

const applyCodeFontFromModal = (fontId: string) => {
  if (fontId.startsWith('system:')) {
    const codeSystemFont = normalizeSystemFontFamily(fontId.slice('system:'.length));
    if (codeSystemFont) {
      void updateFonts({ codeFont: 'system', codeSystemFont });
    }
  } else if (builtinCodeFontOptions.some((f) => f.id === fontId)) {
    void updateFonts({ codeFont: fontId as CodeFontId });
  }
};

// Manual input handlers
const focusEditableFontInput = (input: HTMLInputElement | null) => {
  if (!input) return;

  input.focus({ preventScroll: true });
  const cursorPosition = input.value.length;
  input.setSelectionRange(cursorPosition, cursorPosition);
};

const getChangedSystemFontInput = (value: string, initialValue: string) => {
  const systemFont = normalizeSystemFontFamily(value);
  if (!systemFont || systemFont === normalizeSystemFontFamily(initialValue)) {
    return undefined;
  }

  return systemFont;
};

const startEditingAppFont = () => {
  const currentName = currentAppFontName.value;
  appFontInput.value = currentName;
  appFontInputInitial.value = currentName;
  editingAppFont.value = true;
  void nextTick(() => focusEditableFontInput(appFontInputRef.value));
};

const startEditingCodeFont = () => {
  const currentName = currentCodeFontName.value;
  codeFontInput.value = currentName;
  codeFontInputInitial.value = currentName;
  editingCodeFont.value = true;
  void nextTick(() => focusEditableFontInput(codeFontInputRef.value));
};

const applyAppFontFromInput = () => {
  editingAppFont.value = false;
  const appSystemFont = getChangedSystemFontInput(appFontInput.value, appFontInputInitial.value);
  if (appSystemFont) {
    void updateFonts({ appFont: 'system', appSystemFont });
  }
};

const applyCodeFontFromInput = () => {
  editingCodeFont.value = false;
  const codeSystemFont = getChangedSystemFontInput(codeFontInput.value, codeFontInputInitial.value);
  if (codeSystemFont) {
    void updateFonts({ codeFont: 'system', codeSystemFont });
  }
};

const handleAppFontInputKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    applyAppFontFromInput();
  } else if (e.key === 'Escape') {
    editingAppFont.value = false;
  }
};

const handleCodeFontInputKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    applyCodeFontFromInput();
  } else if (e.key === 'Escape') {
    editingCodeFont.value = false;
  }
};

const handleBack = () => {
  void router.push(localePath('/dashboard'));
};

onMounted(() => {
  void loadSettings();
  void refreshDesktopRuntime();
});
</script>

<template>
  <DetailOverlay
    :loading="loading"
    :loading-title="t('dashboard.settings.statusLoading')"
    loading-subtitle=""
    :back-label="t('dashboard.settings.backToDashboard')"
    home-label=""
    :show-home-button="false"
    @back="handleBack"
  >
    <div class="settings">
      <!-- Sidebar -->
      <aside class="settings__sidebar">
        <nav class="settings__nav">
          <div class="settings__nav-group">
            <span class="settings__nav-label">{{ t('dashboard.settings.pageTitle') }}</span>
            <div class="settings__nav-item is-active">
              <TypeIcon :size="15" />
              <span>{{ t('dashboard.settings.fontsTitle') }}</span>
            </div>
          </div>
        </nav>
      </aside>

      <!-- Main -->
      <main class="settings__main">
        <div class="settings__content">
          <div class="settings__header">
            <div class="settings__header-icon">
              <PaletteIcon :size="20" />
            </div>
            <div>
              <h1 class="settings__title">{{ t('dashboard.settings.fontsTitle') }}</h1>
              <p class="settings__desc">{{ t('dashboard.settings.pageKicker') }}</p>
            </div>
          </div>

          <div v-if="error" class="settings__error">{{ error }}</div>

          <!-- App Font -->
          <section class="settings__section">
            <h2 class="settings__section-title">{{ t('dashboard.settings.appFontSection') }}</h2>
            <div class="settings__font-card">
              <div class="settings__font-field">
                <label class="settings__label">{{ t('dashboard.settings.appFontLabel') }}</label>
                <div class="settings__font-input-row">
                  <input
                    v-if="editingAppFont"
                    ref="appFontInput"
                    v-model="appFontInput"
                    class="settings__font-input"
                    type="text"
                    @blur="applyAppFontFromInput"
                    @keydown="handleAppFontInputKeydown"
                  />
                  <span v-else class="settings__font-value" @click="startEditingAppFont">
                    {{ currentAppFontName }}
                  </span>
                  <button
                    class="settings__font-picker-btn"
                    type="button"
                    :aria-label="t('dashboard.settings.selectAppFont')"
                    @click="showAppFontPicker = true"
                  >
                    <SearchIcon :size="14" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- Code Font -->
          <section class="settings__section">
            <h2 class="settings__section-title">{{ t('dashboard.settings.codeFontSection') }}</h2>
            <div class="settings__font-card">
              <div class="settings__font-field">
                <label class="settings__label">{{ t('dashboard.settings.codeFontLabel') }}</label>
                <div class="settings__font-input-row">
                  <input
                    v-if="editingCodeFont"
                    ref="codeFontInput"
                    v-model="codeFontInput"
                    class="settings__font-input"
                    type="text"
                    @blur="applyCodeFontFromInput"
                    @keydown="handleCodeFontInputKeydown"
                  />
                  <span v-else class="settings__font-value" @click="startEditingCodeFont">
                    {{ currentCodeFontName }}
                  </span>
                  <button
                    class="settings__font-picker-btn"
                    type="button"
                    :aria-label="t('dashboard.settings.selectCodeFont')"
                    @click="showCodeFontPicker = true"
                  >
                    <SearchIcon :size="14" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- Desktop Runtime -->
          <section class="settings__section">
            <div class="settings__section-heading">
              <h2 class="settings__section-title">
                {{ t('dashboard.settings.desktopRuntimeTitle') }}
              </h2>
              <button
                class="settings__icon-btn"
                type="button"
                :title="t('dashboard.settings.desktopRefresh')"
                :aria-label="t('dashboard.settings.desktopRefresh')"
                :disabled="desktopLoading"
                @click="refreshDesktopRuntime"
              >
                <RefreshCwIcon :size="14" />
              </button>
            </div>

            <div class="settings__desktop-panel">
              <div class="settings__desktop-summary">
                <div class="settings__desktop-icon">
                  <ServerIcon :size="18" />
                </div>
                <div class="settings__desktop-summary-main">
                  <div class="settings__desktop-title-row">
                    <span class="settings__desktop-title">
                      {{ runtimeInfo?.productName ?? 'NekoGit' }}
                    </span>
                    <span class="settings__desktop-pill">
                      {{ desktopModeLabel }}
                    </span>
                    <span
                      v-if="runtimeInfo"
                      class="settings__desktop-pill"
                      :class="`is-${desktopServerStatusTone}`"
                    >
                      {{ desktopServerStatusLabel }}
                    </span>
                  </div>
                  <p class="settings__desktop-meta">
                    <span v-if="runtimeInfo">
                      v{{ runtimeInfo.version }} · {{ runtimeInfo.platform }}
                    </span>
                    <span v-else-if="desktopLoading">
                      {{ t('dashboard.settings.desktopLoading') }}
                    </span>
                    <span v-else>
                      {{ t('dashboard.settings.desktopUnavailable') }}
                    </span>
                  </p>
                </div>
              </div>

              <div
                v-if="(desktopError && !desktopAvailable) || desktopActionError"
                class="settings__desktop-error"
              >
                {{ desktopActionError || desktopError }}
              </div>
              <div v-else-if="desktopActionMessage" class="settings__desktop-success">
                {{ desktopActionMessage }}
              </div>

              <dl v-if="runtimeInfo" class="settings__desktop-list">
                <div
                  v-for="row in desktopServerRows"
                  :key="`server-${row.label}`"
                  class="settings__desktop-row"
                >
                  <dt>{{ row.label }}</dt>
                  <dd :title="row.value">{{ row.value }}</dd>
                </div>
                <div v-for="row in desktopInfoRows" :key="row.label" class="settings__desktop-row">
                  <dt>{{ row.label }}</dt>
                  <dd :title="row.value">{{ row.value }}</dd>
                </div>
              </dl>

              <div v-if="runtimeInfo" class="settings__desktop-toggle-row">
                <div>
                  <div class="settings__desktop-toggle-title">
                    {{ t('dashboard.settings.desktopAutostart') }}
                  </div>
                  <div class="settings__desktop-toggle-desc">
                    {{
                      canToggleAutostart
                        ? t('dashboard.settings.desktopAutostartDescription')
                        : t('dashboard.settings.desktopAutostartUnsupported')
                    }}
                  </div>
                </div>
                <button
                  class="settings__desktop-switch"
                  type="button"
                  role="switch"
                  :aria-checked="Boolean(autostartStatus?.enabled)"
                  :disabled="!canToggleAutostart || updatingAutostart"
                  @click="handleToggleAutostart"
                >
                  <span class="settings__desktop-switch-knob"></span>
                </button>
              </div>

              <div class="settings__desktop-toggle-row">
                <div>
                  <div class="settings__desktop-toggle-title">
                    {{ t('dashboard.settings.desktopNotifications') }}
                  </div>
                  <div class="settings__desktop-toggle-desc">
                    {{ t('dashboard.settings.desktopNotificationsDescription') }}
                  </div>
                </div>
                <button
                  class="settings__desktop-switch"
                  type="button"
                  role="switch"
                  :aria-checked="settings.desktopNotifications.enabled"
                  :disabled="saving"
                  @click="handleToggleDesktopNotifications"
                >
                  <span class="settings__desktop-switch-knob"></span>
                </button>
              </div>

              <div class="settings__desktop-toggle-row">
                <div>
                  <div class="settings__desktop-toggle-title">
                    {{ t('dashboard.settings.desktopNotificationsBatch') }}
                  </div>
                  <div class="settings__desktop-toggle-desc">
                    {{ t('dashboard.settings.desktopNotificationsBatchDescription') }}
                  </div>
                </div>
                <button
                  class="settings__desktop-switch"
                  type="button"
                  role="switch"
                  :aria-checked="settings.desktopNotifications.batchNewNotifications"
                  :disabled="saving || !settings.desktopNotifications.enabled"
                  @click="handleToggleDesktopNotificationBatching"
                >
                  <span class="settings__desktop-switch-knob"></span>
                </button>
              </div>

              <div class="settings__desktop-toggle-row">
                <div>
                  <div class="settings__desktop-toggle-title">
                    {{ t('dashboard.settings.desktopNotificationsQuietWhenFocused') }}
                  </div>
                  <div class="settings__desktop-toggle-desc">
                    {{ t('dashboard.settings.desktopNotificationsQuietWhenFocusedDescription') }}
                  </div>
                </div>
                <button
                  class="settings__desktop-switch"
                  type="button"
                  role="switch"
                  :aria-checked="settings.desktopNotifications.quietWhenFocused"
                  :disabled="saving || !settings.desktopNotifications.enabled"
                  @click="handleToggleDesktopNotificationFocusQuiet"
                >
                  <span class="settings__desktop-switch-knob"></span>
                </button>
              </div>

              <div v-if="runtimeInfo" class="settings__desktop-actions">
                <button
                  class="settings__desktop-action"
                  type="button"
                  :title="t('dashboard.settings.desktopOpenAppData')"
                  @click="handleDesktopAction(openAppData)"
                >
                  <FolderOpenIcon :size="15" />
                  <span>{{ t('dashboard.settings.desktopOpenAppData') }}</span>
                </button>
                <button
                  class="settings__desktop-action"
                  type="button"
                  :title="t('dashboard.settings.desktopOpenServerLog')"
                  @click="handleDesktopAction(openServerLog)"
                >
                  <FileTextIcon :size="15" />
                  <span>{{ t('dashboard.settings.desktopOpenServerLog') }}</span>
                </button>
                <button
                  class="settings__desktop-action"
                  type="button"
                  :title="t('dashboard.settings.desktopCopyDiagnostics')"
                  @click="handleCopyDesktopDiagnostics"
                >
                  <ClipboardIcon :size="15" />
                  <span>{{ t('dashboard.settings.desktopCopyDiagnostics') }}</span>
                </button>
                <button
                  class="settings__desktop-action"
                  type="button"
                  :disabled="!canRestartBundledServer || restartingBundledServer"
                  :title="
                    canRestartBundledServer
                      ? t('dashboard.settings.desktopRestartServer')
                      : t('dashboard.settings.desktopRestartServerUnavailable')
                  "
                  @click="handleRestartBundledServer"
                >
                  <PowerIcon :size="15" />
                  <span>
                    {{
                      restartingBundledServer
                        ? t('dashboard.settings.desktopRestartServerWorking')
                        : t('dashboard.settings.desktopRestartServer')
                    }}
                  </span>
                </button>
                <button
                  class="settings__desktop-action"
                  type="button"
                  :title="t('dashboard.settings.desktopOpenGithub')"
                  @click="handleDesktopAction(openGithub)"
                >
                  <GithubIcon :size="15" />
                  <span>{{ t('dashboard.settings.desktopOpenGithub') }}</span>
                </button>
                <button
                  class="settings__desktop-action"
                  type="button"
                  :title="t('dashboard.settings.desktopOpenGithubFromClipboard')"
                  @click="handleDesktopClipboardOpen"
                >
                  <ClipboardPasteIcon :size="15" />
                  <span>{{ t('dashboard.settings.desktopOpenGithubFromClipboard') }}</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>

    <!-- Font Picker Modals -->
    <FontPickerModal
      :is-visible="showAppFontPicker"
      :title="t('dashboard.settings.selectAppFont')"
      :model-value="appFontPickerValue"
      :bundled-fonts="bundledAppFontOptions"
      @close="showAppFontPicker = false"
      @update:model-value="applyAppFontFromModal"
    />

    <FontPickerModal
      :is-visible="showCodeFontPicker"
      :title="t('dashboard.settings.selectCodeFont')"
      :model-value="codeFontPickerValue"
      :bundled-fonts="bundledCodeFontOptions"
      @close="showCodeFontPicker = false"
      @update:model-value="applyCodeFontFromModal"
    />
  </DetailOverlay>
</template>

<style scoped lang="scss">
.settings {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* ── Sidebar (backgroundless; active item uses soft accent fill) ── */
.settings__sidebar {
  width: 14rem;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 1.5rem 0;
  background: transparent;
}

.settings__nav {
  flex: 1;
  padding: 0 0.75rem;
  overflow-y: auto;
}

.settings__nav-group {
  margin-bottom: 0.5rem;
}

.settings__nav-label {
  display: block;
  padding: 0 0.5rem 0.35rem;
  color: var(--nekogit-text-subtle);
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.settings__nav-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem 0.45rem 0.85rem;
  margin-left: 0.25rem;
  border-radius: 0 6px 6px 0;
  border-left: 2px solid transparent;
  color: var(--nekogit-text-muted);
  font-size: 0.8rem;
  font-weight: 550;
  cursor: default;
  transition:
    color 0.12s ease,
    border-color 0.12s ease;

  &.is-active {
    color: var(--bulma-text-strong, var(--nekogit-text-strong));
    border-left-color: var(--nekogit-accent);
    font-weight: 650;
  }
}

/* ── Main ── */
.settings__main {
  flex: 1;
  overflow-y: auto;
  background: var(--nekogit-surface);
}

.settings__content {
  max-width: 36rem;
  margin: 0 auto;
  padding: 2.5rem 2rem 4rem;
}

/* ── Header ── */
.settings__header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 2.5rem;
}

.settings__header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 10px;
  background: var(--nekogit-accent-soft);
  color: var(--nekogit-accent);
  flex-shrink: 0;
}

.settings__title {
  margin: 0 0 0.15rem;
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.settings__desc {
  margin: 0;
  color: var(--nekogit-text-muted);
  font-size: 0.82rem;
  line-height: 1.4;
}

/* ── Error ── */
.settings__error {
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  border-radius: 8px;
  background: var(--nekogit-danger-soft);
  color: var(--nekogit-danger);
  font-size: 0.82rem;
  font-weight: 500;
}

/* ── Section (replaces CollapsibleGroup) ── */
.settings__section {
  margin-bottom: 1.75rem;

  &:last-child {
    margin-bottom: 0;
  }
}

.settings__section-title {
  margin: 0 0 0.6rem;
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.settings__section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.6rem;

  .settings__section-title {
    margin-bottom: 0;
  }
}

.settings__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--nekogit-border);
  border-radius: 6px;
  background: var(--nekogit-surface);
  color: var(--nekogit-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    border-color: var(--nekogit-border-strong);
    background: var(--nekogit-surface-hover);
    color: var(--nekogit-text);
  }

  &:disabled {
    cursor: wait;
    opacity: 0.6;
  }
}

/* ── Font Card ── */
.settings__font-card {
  padding: 1rem;
  border: 1px solid var(--nekogit-border);
  border-radius: 8px;
  background: var(--nekogit-surface);
}

.settings__font-field {
  margin-bottom: 0.5rem;

  &:last-child {
    margin-bottom: 0;
  }
}

.settings__label {
  display: block;
  margin-bottom: 0.3rem;
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
  font-size: 0.82rem;
  font-weight: 650;
}

.settings__font-input-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.settings__font-value {
  flex: 1;
  height: 2.35rem;
  padding: 0 0.75rem;
  display: flex;
  align-items: center;
  border: 1px solid var(--nekogit-input-border);
  border-radius: 6px;
  background: var(--nekogit-surface-muted);
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
  font-size: 0.82rem;
  font-weight: 500;
  cursor: text;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: var(--nekogit-border-strong);
  }
}

.settings__font-input {
  flex: 1;
  height: 2.35rem;
  padding: 0 0.75rem;
  border: 1px solid var(--nekogit-accent);
  border-radius: 6px;
  background: var(--nekogit-surface);
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
  font-size: 0.82rem;
  font-weight: 500;
  outline: none;
  box-shadow: 0 0 0 3px var(--nekogit-accent-soft);
}

.settings__font-picker-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.35rem;
  height: 2.35rem;
  padding: 0;
  border: 1px solid var(--nekogit-border);
  border-radius: 6px;
  background: var(--nekogit-surface);
  color: var(--nekogit-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--nekogit-border-strong);
    background: var(--nekogit-surface-hover);
    color: var(--nekogit-text);
  }
}

/* ── Desktop Runtime ── */
.settings__desktop-panel {
  padding: 1rem;
  border: 1px solid var(--nekogit-border);
  border-radius: 8px;
  background: var(--nekogit-surface);
}

.settings__desktop-summary {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.settings__desktop-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.35rem;
  height: 2.35rem;
  flex-shrink: 0;
  border-radius: 7px;
  background: var(--nekogit-accent-soft);
  color: var(--nekogit-accent);
}

.settings__desktop-summary-main {
  min-width: 0;
  flex: 1;
}

.settings__desktop-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.settings__desktop-title {
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
  font-size: 0.9rem;
  font-weight: 750;
}

.settings__desktop-pill {
  display: inline-flex;
  align-items: center;
  min-height: 1.35rem;
  padding: 0 0.45rem;
  border-radius: 999px;
  background: var(--nekogit-success-soft);
  color: var(--nekogit-success);
  font-size: 0.68rem;
  font-weight: 750;
  line-height: 1;

  &.is-neutral {
    background: var(--nekogit-surface-muted);
    color: var(--nekogit-text-muted);
  }

  &.is-success {
    background: var(--nekogit-success-soft);
    color: var(--nekogit-success);
  }

  &.is-danger {
    background: var(--nekogit-danger-soft);
    color: var(--nekogit-danger);
  }
}

.settings__desktop-meta {
  margin: 0.2rem 0 0;
  color: var(--nekogit-text-muted);
  font-size: 0.75rem;
  line-height: 1.35;
}

.settings__desktop-error {
  margin-top: 0.85rem;
  padding: 0.65rem 0.75rem;
  border-radius: 6px;
  background: var(--nekogit-danger-soft);
  color: var(--nekogit-danger);
  font-size: 0.78rem;
  font-weight: 550;
}

.settings__desktop-success {
  margin-top: 0.85rem;
  padding: 0.65rem 0.75rem;
  border-radius: 6px;
  background: var(--nekogit-success-soft);
  color: var(--nekogit-success);
  font-size: 0.78rem;
  font-weight: 550;
}

.settings__desktop-list {
  display: grid;
  gap: 0.55rem;
  margin: 1rem 0 0;
}

.settings__desktop-row {
  min-width: 0;

  dt {
    margin-bottom: 0.2rem;
    color: var(--nekogit-text-muted);
    font-size: 0.68rem;
    font-weight: 750;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  dd {
    min-width: 0;
    margin: 0;
    padding: 0.48rem 0.6rem;
    overflow: hidden;
    border: 1px solid var(--nekogit-border);
    border-radius: 6px;
    background: var(--nekogit-surface-muted);
    color: var(--bulma-text-strong, var(--nekogit-text-strong));
    font-family: var(--nekogit-code-font-family);
    font-size: 0.72rem;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.settings__desktop-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1rem;
  padding: 0.75rem 0.8rem;
  border: 1px solid var(--nekogit-border);
  border-radius: 6px;
  background: var(--nekogit-surface-muted);
}

.settings__desktop-toggle-title {
  color: var(--bulma-text-strong, var(--nekogit-text-strong));
  font-size: 0.8rem;
  font-weight: 700;
}

.settings__desktop-toggle-desc {
  margin-top: 0.18rem;
  color: var(--nekogit-text-muted);
  font-size: 0.72rem;
  line-height: 1.35;
}

.settings__desktop-switch {
  position: relative;
  width: 2.55rem;
  height: 1.45rem;
  flex: 0 0 auto;
  padding: 0;
  border: 1px solid var(--nekogit-border-strong);
  border-radius: 999px;
  background: var(--nekogit-surface);
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  &[aria-checked='true'] {
    border-color: var(--nekogit-accent);
    background: var(--nekogit-accent);

    .settings__desktop-switch-knob {
      transform: translateX(1.08rem);
    }
  }

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
}

.settings__desktop-switch-knob {
  position: absolute;
  top: 0.18rem;
  left: 0.18rem;
  width: 0.98rem;
  height: 0.98rem;
  border-radius: 50%;
  background: var(--nekogit-surface);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
  transition: transform 0.15s ease;
}

.settings__desktop-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
  gap: 0.55rem;
  margin-top: 1rem;
}

.settings__desktop-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.42rem;
  min-width: 0;
  height: 2.35rem;
  padding: 0 0.7rem;
  border: 1px solid var(--nekogit-border);
  border-radius: 6px;
  background: var(--nekogit-surface);
  color: var(--nekogit-text);
  font-size: 0.76rem;
  font-weight: 650;
  cursor: pointer;
  transition: all 0.15s ease;

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &:hover {
    border-color: var(--nekogit-border-strong);
    background: var(--nekogit-surface-hover);
    color: var(--bulma-text-strong, var(--nekogit-text-strong));
  }

  &:disabled {
    cursor: default;
    opacity: 0.58;
  }

  &:disabled:hover {
    border-color: var(--nekogit-border);
    background: var(--nekogit-surface);
    color: var(--nekogit-text);
  }
}

/* ── Transitions ── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ── Mobile ── */
@media screen and (max-width: 768px) {
  .settings {
    flex-direction: column;
  }

  .settings__sidebar {
    width: 100%;
  }

  .settings__nav {
    padding: 0.5rem;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .settings__nav-group {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 0;
  }

  .settings__nav-label {
    display: none;
  }

  .settings__nav-item {
    flex-shrink: 0;
    padding: 0.4rem 0.75rem;
    font-size: 0.78rem;
  }

  .settings__content {
    padding: 1.5rem 1rem 3rem;
  }

  .settings__header {
    margin-bottom: 1.5rem;
  }

  .settings__desktop-actions {
    grid-template-columns: 1fr;
  }
}
</style>

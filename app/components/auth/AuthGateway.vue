<!-- Auth Gateway — NekoGit dashboard component. -->
<template>
  <div class="auth-gateway">
    <div class="auth-gateway__header mb-4">
      <p class="auth-gateway__eyebrow mb-2">{{ modeLabel }}</p>
      <h2 class="title is-4 mb-2">{{ t('landing.authCardTitle') }}</h2>
      <p class="subtitle is-6 has-text-grey mb-0">{{ t('landing.authCardSubtitle') }}</p>
    </div>

    <div class="auth-gateway__content">
      <Button
        v-if="providers.oauthEnabled"
        href="/auth/github"
        class="is-fullwidth is-justify-content-center mb-0"
      >
        <GitHubIcon class="mr-3" />
        {{ t('auth.connectWithGithub') }}
      </Button>

      <div v-if="showDivider" class="auth-gateway__divider" aria-hidden="true">
        <span>{{ t('auth.or') }}</span>
      </div>

      <form v-if="showPatSection" class="auth-gateway__pat" @submit.prevent="handlePatSubmit">
        <Button
          v-if="desktopAvailable"
          type="button"
          color="dark"
          class="is-fullwidth is-justify-content-center auth-gateway__desktop-auth"
          :disabled="submitting || desktopTokenLoading"
          @click="handleGithubCliSubmit"
        >
          <LoadingIcon v-if="desktopTokenLoading" class="mr-3" :size="18" />
          <TerminalIcon v-else class="mr-3" :size="18" />
          {{ desktopTokenLoading ? t('auth.desktopCliConnecting') : t('auth.useDesktopCliToken') }}
        </Button>

        <div
          v-if="desktopAvailable"
          class="auth-gateway__desktop-tip"
          :class="{ 'auth-gateway__desktop-tip--error': desktopTokenError }"
        >
          {{ desktopTokenError || t('auth.desktopCliTokenHelp') }}
        </div>

        <div class="field">
          <label class="label auth-gateway__label" for="github-pat-input">{{
            t('auth.tokenLabel')
          }}</label>
          <div class="control has-icons-left">
            <input
              id="github-pat-input"
              v-model="token"
              class="input"
              type="password"
              autocomplete="off"
              spellcheck="false"
              :placeholder="t('auth.tokenPlaceholder')"
              :disabled="submitting"
            />
            <span class="icon is-left auth-gateway__input-icon">
              <KeyRoundIcon :size="18" />
            </span>
          </div>
          <p class="help has-text-grey-dark auth-gateway__help">
            {{ t('auth.tokenHelp') }}
            <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">
              {{ t('auth.tokenHelpLink') }}
            </a>
          </p>

          <div
            class="auth-gateway__gh-auth-tip"
            v-html="
              t('auth.tokenTipGhAuth').replace(
                /`([^`]+)`/g,
                '<code class=&quot;auth-gateway__code&quot;>$1</code>'
              )
            "
          />
        </div>

        <div v-if="tokenError" class="notification is-danger is-light auth-gateway__error">
          {{ tokenError }}
        </div>

        <Button type="submit" class="is-fullwidth is-justify-content-center" :disabled="submitting">
          <LoadingIcon v-if="submitting" class="mr-3" :size="18" />
          <KeyRoundIcon v-else class="mr-3" :size="18" />
          {{ submitting ? t('auth.connectingWithPat') : t('auth.continueWithPat') }}
        </Button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { KeyRoundIcon, TerminalIcon } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import { GitHubIcon } from 'vue3-simple-icons';

import Button from '~/components/ui/Button.vue';
import LoadingIcon from '~/components/ui/LoadingIcon.vue';
import { useDesktopRuntime } from '~/composables/useDesktopRuntime';

const props = defineProps<{
  providers: AuthProviderState;
}>();

const { t } = useI18n();
const { fetch: fetchUserSession } = useUserSession();
const localePath = useLocalePath();
const { available: desktopAvailable, loadRuntimeInfo, readGithubCliToken } = useDesktopRuntime();
const apiFetch = useNekoGitApiFetch();
const token = ref('');
const tokenError = ref('');
const submitting = ref(false);
const desktopTokenLoading = ref(false);
const desktopTokenError = ref('');

const getTokenLoginErrorMessage = (error: unknown) => {
  if (typeof error !== 'object' || error === null) {
    return '';
  }

  const data = 'data' in error ? error.data : undefined;
  const dataStatusMessage =
    typeof data === 'object' &&
    data !== null &&
    'statusMessage' in data &&
    typeof data.statusMessage === 'string'
      ? data.statusMessage
      : '';

  if (dataStatusMessage) {
    return dataStatusMessage;
  }

  return 'statusMessage' in error && typeof error.statusMessage === 'string'
    ? error.statusMessage
    : '';
};

watch(
  () => props.providers,
  (_) => {
    tokenError.value = '';
    desktopTokenError.value = '';
    token.value = '';
  },
  { deep: true }
);

onMounted(() => {
  void loadRuntimeInfo();
});

const modeLabel = computed(() => {
  switch (props.providers.mode) {
    case 'hybrid':
      return t('landing.authStatusHybrid');
    case 'oauth-only':
      return t('landing.authStatusOAuthOnly');
    default:
      return t('landing.authStatusPatOnly');
  }
});

const showDivider = computed(() => props.providers.oauthEnabled && props.providers.patEnabled);
const showPatSection = computed(() => props.providers.patEnabled);

const handlePatLogin = async (candidateToken: string) => {
  const normalizedToken = candidateToken.trim();

  if (!normalizedToken) {
    tokenError.value = t('auth.tokenRequired');
    return;
  }

  submitting.value = true;
  tokenError.value = '';
  desktopTokenError.value = '';

  try {
    await apiFetch('/auth/pat', {
      method: 'POST',
      body: {
        token: normalizedToken,
      },
    });

    await fetchUserSession();
    await navigateTo(localePath('/dashboard'));
  } catch (error) {
    const statusMessage = getTokenLoginErrorMessage(error);

    tokenError.value =
      statusMessage === 'Invalid GitHub token'
        ? t('auth.tokenInvalid')
        : statusMessage || t('auth.tokenLoginFailed');
  } finally {
    submitting.value = false;
  }
};

const handlePatSubmit = async () => {
  await handlePatLogin(token.value);
};

const handleGithubCliSubmit = async () => {
  desktopTokenLoading.value = true;
  desktopTokenError.value = '';
  tokenError.value = '';

  try {
    const cliToken = await readGithubCliToken();
    token.value = cliToken;
    await handlePatLogin(cliToken);
  } catch (error) {
    desktopTokenError.value =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : t('auth.desktopCliTokenFailed');
  } finally {
    desktopTokenLoading.value = false;
  }
};
</script>

<style scoped lang="scss">
@use '~/assets/scss/variables' as *;

.auth-gateway {
  height: 100%;
}

.auth-gateway__eyebrow {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: $brand-primary;
}

.auth-gateway__divider {
  position: relative;
  margin: 1.2rem 0;
  text-align: center;
}

.auth-gateway__divider::before {
  position: absolute;
  inset: 50% 0 auto;
  border-top: 1px solid var(--nekogit-border);
  content: '';
}

.auth-gateway__divider span {
  position: relative;
  display: inline-block;
  padding: 0 0.85rem;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--nekogit-text-muted);
  background: var(--nekogit-surface);
}

.auth-gateway__label {
  font-size: 0.9rem;
  margin-bottom: 0.55rem;
}

.auth-gateway__input-icon {
  color: var(--nekogit-text-muted);
}

.auth-gateway__help {
  margin-top: 0.55rem;
  line-height: 1.55;
}

.auth-gateway__help a {
  font-weight: 600;
}

.auth-gateway__pat {
  display: grid;
  gap: 0.9rem;
}

.auth-gateway__desktop-auth {
  margin-bottom: -0.15rem;
}

.auth-gateway__desktop-tip {
  padding: 0.55rem 0.7rem;
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--nekogit-text-muted);
  background: var(--nekogit-surface-muted);
  border: 1px solid var(--nekogit-border);
  border-radius: var(--nekogit-radius-md);
}

.auth-gateway__desktop-tip--error {
  color: var(--nekogit-danger);
  background: var(--nekogit-danger-soft);
  border-color: color-mix(in srgb, var(--nekogit-danger) 24%, transparent);
}

.auth-gateway__error {
  margin: 0;
}

.auth-gateway__gh-auth-tip {
  margin-top: 0.25rem;
  padding: 0.5rem 0.65rem;
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--nekogit-text-muted);
  background: var(--nekogit-accent-soft);
  border: 1px solid color-mix(in srgb, var(--nekogit-accent) 18%, transparent);
  border-radius: var(--nekogit-radius-md);
}

.auth-gateway__gh-auth-tip :deep(.auth-gateway__code) {
  padding: 0.15em 0.4em;
  font-size: 0.92em;
  font-weight: 600;
  font-family: var(--nekogit-code-font-family);
  background: var(--nekogit-code-bg);
  border: 1px solid color-mix(in srgb, var(--nekogit-accent) 15%, transparent);
  border-radius: 4px;
  color: var(--nekogit-text-strong);
}
</style>

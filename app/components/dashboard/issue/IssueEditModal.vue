<!-- Issue Edit Modal — Modal form to edit an issue's title, description, assignees and milestone. -->
<template>
  <div class="modal" :class="{ 'is-active': isVisible }">
    <div class="modal-background" @click="handleClose"></div>
    <div class="modal-card">
      <header class="modal-card-head">
        <p class="modal-card-title">{{ t('issueDetail.editIssue') }}</p>
        <button class="delete" @click="handleClose" aria-label="close" :disabled="loading"></button>
      </header>
      <section class="modal-card-body">
        <div v-if="error" class="notification is-danger is-light is-size-7 py-2 px-3 mb-4">
          {{ error }}
        </div>

        <div class="field">
          <label class="label is-size-7" for="issue-edit-title">
            {{ t('issueDetail.editIssueTitle') }}
          </label>
          <div class="control">
            <input
              id="issue-edit-title"
              v-model="title"
              class="input"
              type="text"
              :disabled="loading"
              @keyup.enter="submit"
            />
          </div>
          <p v-if="showTitleRequired" class="help is-danger">
            {{ t('issueDetail.issueTitleRequired') }}
          </p>
        </div>

        <div class="field">
          <label class="label is-size-7" for="issue-edit-body">
            {{ t('issueDetail.editIssueBody') }}
          </label>
          <div class="control">
            <textarea
              id="issue-edit-body"
              v-model="body"
              class="textarea"
              rows="10"
              :placeholder="t('issueDetail.editIssueBodyPlaceholder')"
              :disabled="loading"
            ></textarea>
          </div>
          <p class="help">{{ t('issueDetail.editIssueHint') }}</p>
        </div>

        <div class="field">
          <label class="label is-size-7">
            {{ t('issueDetail.assignees') }}
            <span v-if="loadingAssignees" class="issue-edit__loading">
              {{ t('issueDetail.loading') }}
            </span>
          </label>
          <div
            v-if="assigneeChoices.length > 0"
            id="issue-edit-assignees"
            class="issue-edit__assignee-list"
          >
            <label
              v-for="assignee in assigneeChoices"
              :key="assignee.login"
              class="issue-edit__assignee"
              :class="{ 'is-selected': selectedAssignees.includes(assignee.login) }"
            >
              <input
                type="checkbox"
                :checked="selectedAssignees.includes(assignee.login)"
                :disabled="
                  loading || (!selectedAssignees.includes(assignee.login) && assigneeLimitReached)
                "
                @change="toggleAssignee(assignee.login)"
              />
              <img
                v-if="assignee.avatarUrl"
                :src="assignee.avatarUrl"
                class="issue-edit__avatar"
                alt=""
              />
              <span>{{ assignee.login }}</span>
            </label>
          </div>
          <p v-else-if="!loadingAssignees" class="help">{{ t('issueDetail.none') }}</p>
          <p v-if="assigneesError" class="help is-danger">{{ assigneesError }}</p>
        </div>

        <div class="field mb-0">
          <label class="label is-size-7" for="issue-edit-milestone">
            {{ t('issueDetail.milestone') }}
            <span v-if="loadingMilestones" class="issue-edit__loading">
              {{ t('issueDetail.loading') }}
            </span>
          </label>
          <div class="control">
            <div class="select is-fullwidth">
              <select
                id="issue-edit-milestone"
                v-model="selectedMilestone"
                :disabled="loading || loadingMilestones"
              >
                <option :value="null">{{ t('issueDetail.none') }}</option>
                <option
                  v-for="milestone in milestoneChoices"
                  :key="milestone.number"
                  :value="milestone.number"
                >
                  {{ milestone.title }}
                </option>
              </select>
            </div>
          </div>
          <p v-if="milestonesError" class="help is-danger">{{ milestonesError }}</p>
        </div>
      </section>
      <footer class="modal-card-foot">
        <button class="button is-light" type="button" :disabled="loading" @click="handleClose">
          {{ t('issueDetail.cancelEditIssue') }}
        </button>
        <button
          class="button is-primary ml-4"
          type="button"
          :disabled="loading || !canSubmit"
          @click="submit"
        >
          <span v-if="loading" class="is-flex is-align-items-center">
            <LoadingIcon class="mr-2" :size="14" />
            {{ t('issueDetail.saving') }}
          </span>
          <span v-else>{{ t('issueDetail.saveIssueChanges') }}</span>
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import LoadingIcon from '~/components/ui/LoadingIcon.vue';
import getFetchErrorMessage from '~/utils/getFetchErrorMessage';

/** Assignable user shown in the assignee picker. */
interface AssigneeOption {
  login: string;
  avatarUrl: string;
  url: string;
}

/** Open milestone shown in the milestone picker. */
interface MilestoneOption {
  number: number;
  title: string;
  state: string;
  dueOn: string | null;
  url: string;
}

/** GitHub rejects updates that assign more than 10 users to an issue. */
const MAX_ASSIGNEES = 10;

const props = withDefaults(
  defineProps<{
    isVisible: boolean;
    loading: boolean;
    initialTitle: string;
    initialBody: string;
    error?: string;
    owner?: string;
    repo?: string;
    initialAssignees?: string[];
    initialMilestone?: number | null;
  }>(),
  {
    owner: '',
    repo: '',
    initialAssignees: () => [],
    initialMilestone: null,
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (
    e: 'save',
    payload: { title: string; body: string; assignees: string[]; milestone: number | null }
  ): void;
}>();

const { t } = useI18n();
const apiFetch = useNekoGitApiFetch();

const title = ref(props.initialTitle);
const body = ref(props.initialBody);
const showTitleRequired = ref(false);
const selectedAssignees = ref<string[]>([]);
const selectedMilestone = ref<number | null>(null);
const assigneeOptions = ref<AssigneeOption[]>([]);
const milestoneOptions = ref<MilestoneOption[]>([]);
const loadingAssignees = ref(false);
const loadingMilestones = ref(false);
const assigneesError = ref('');
const milestonesError = ref('');
const optionsRequestId = ref(0);

const canSubmit = computed(() => title.value.trim().length > 0 && !props.loading);

const assigneeLimitReached = computed(() => selectedAssignees.value.length >= MAX_ASSIGNEES);

const assigneeChoices = computed(() => {
  const choices = new Map<string, AssigneeOption>();

  for (const assignee of assigneeOptions.value) {
    choices.set(assignee.login, assignee);
  }

  for (const login of [...props.initialAssignees, ...selectedAssignees.value]) {
    if (!choices.has(login)) {
      choices.set(login, {
        login,
        avatarUrl: `https://github.com/${login}.png`,
        url: `https://github.com/${login}`,
      });
    }
  }

  return [...choices.values()];
});

const milestoneChoices = computed(() => {
  const choices = new Map<number, MilestoneOption>();

  for (const milestone of milestoneOptions.value) {
    choices.set(milestone.number, milestone);
  }

  // Preserve an assigned milestone that is closed and therefore absent from
  // the open-milestone list.
  if (props.initialMilestone !== null && !choices.has(props.initialMilestone)) {
    choices.set(props.initialMilestone, {
      number: props.initialMilestone,
      title: `#${props.initialMilestone}`,
      state: 'open',
      dueOn: null,
      url: '',
    });
  }

  return [...choices.values()];
});

const resetForm = () => {
  title.value = props.initialTitle;
  body.value = props.initialBody;
  selectedAssignees.value = [...props.initialAssignees];
  selectedMilestone.value = props.initialMilestone;
  showTitleRequired.value = false;
  assigneesError.value = '';
  milestonesError.value = '';
};

const loadAssignees = async (requestId: number) => {
  assigneesError.value = '';
  assigneeOptions.value = [];

  if (!props.owner || !props.repo) {
    loadingAssignees.value = false;
    return;
  }

  loadingAssignees.value = true;

  try {
    const data = await apiFetch<{ items?: AssigneeOption[] }>(
      `/api/repos/${props.owner}/${props.repo}/assignees`,
      { method: 'GET' }
    );

    if (requestId !== optionsRequestId.value) return;
    assigneeOptions.value = Array.isArray(data?.items) ? data.items : [];
  } catch (err: unknown) {
    if (requestId !== optionsRequestId.value) return;
    console.error('Error fetching assignable users:', err);
    assigneeOptions.value = [];
    assigneesError.value = getFetchErrorMessage(err, t('issueDetail.loadFailed'));
  } finally {
    if (requestId === optionsRequestId.value) {
      loadingAssignees.value = false;
    }
  }
};

const loadMilestones = async (requestId: number) => {
  milestonesError.value = '';
  milestoneOptions.value = [];

  if (!props.owner || !props.repo) {
    loadingMilestones.value = false;
    return;
  }

  loadingMilestones.value = true;

  try {
    const data = await apiFetch<{ items?: MilestoneOption[] }>(
      `/api/repos/${props.owner}/${props.repo}/milestones`,
      { method: 'GET' }
    );

    if (requestId !== optionsRequestId.value) return;
    milestoneOptions.value = Array.isArray(data?.items)
      ? data.items.filter((item) => Number.isSafeInteger(item?.number) && item.number > 0)
      : [];
  } catch (err: unknown) {
    if (requestId !== optionsRequestId.value) return;
    console.error('Error fetching repository milestones:', err);
    milestoneOptions.value = [];
    milestonesError.value = getFetchErrorMessage(err, t('issueDetail.loadFailed'));
  } finally {
    if (requestId === optionsRequestId.value) {
      loadingMilestones.value = false;
    }
  }
};

const loadOptions = () => {
  optionsRequestId.value += 1;
  const requestId = optionsRequestId.value;
  assigneesError.value = '';
  milestonesError.value = '';

  void Promise.all([loadAssignees(requestId), loadMilestones(requestId)]);
};

const toggleAssignee = (login: string) => {
  const index = selectedAssignees.value.indexOf(login);

  if (index > -1) {
    selectedAssignees.value.splice(index, 1);
    return;
  }

  if (selectedAssignees.value.length >= MAX_ASSIGNEES) return;
  selectedAssignees.value.push(login);
};

watch(
  () => props.isVisible,
  (isVisible) => {
    if (!isVisible) {
      optionsRequestId.value += 1;
      loadingAssignees.value = false;
      loadingMilestones.value = false;
      return;
    }

    resetForm();
    loadOptions();
  }
);

const handleClose = () => {
  if (props.loading) return;
  emit('close');
};

const submit = () => {
  if (props.loading) return;

  const trimmedTitle = title.value.trim();
  if (!trimmedTitle) {
    showTitleRequired.value = true;
    return;
  }

  showTitleRequired.value = false;
  emit('save', {
    title: trimmedTitle,
    body: body.value,
    assignees: [...selectedAssignees.value],
    milestone: selectedMilestone.value,
  });
};
</script>

<style scoped lang="scss">
.issue-edit__loading {
  margin-left: 0.5rem;
  font-weight: 400;
  color: var(--nekogit-text-subtle);
}

.issue-edit__assignee-list {
  max-height: 9rem;
  overflow-y: auto;
  padding: 0.25rem;
  border: 1px solid var(--nekogit-border);
  border-radius: 4px;
}

.issue-edit__assignee {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.2rem 0.35rem;
  border-radius: 3px;
  font-size: 0.8rem;
  cursor: pointer;

  input {
    margin: 0;
  }

  &:hover {
    background: var(--nekogit-surface-muted);
  }

  &.is-selected {
    background: var(--nekogit-accent-soft);
  }
}

.issue-edit__avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
}
</style>

// @vitest-environment happy-dom
/// Component tests for the inline label creation form.
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const apiFetch = vi.fn();

import LabelCreateForm from '../../app/components/dashboard/issue/LabelCreateForm.vue';

describe('LabelCreateForm', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    vi.stubGlobal('useNekoGitApiFetch', () => apiFetch);
  });

  test('creates a label and emits the created label', async () => {
    apiFetch.mockResolvedValue({ id: 1, name: 'bug', color: 'ff0000' });
    const wrapper = mount(LabelCreateForm, { props: { owner: 'owner', repo: 'repo' } });

    await wrapper.find('.label-create__toggle').trigger('click');
    await wrapper.find('.label-create__row input[type="text"]').setValue('  bug  ');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(apiFetch).toHaveBeenCalledWith('/api/repos/owner/repo/labels', {
      method: 'POST',
      body: { name: 'bug', color: '0969da', description: undefined },
    });
    expect(wrapper.emitted('created')?.[0]).toEqual([{ id: 1, name: 'bug', color: 'ff0000' }]);
    expect(wrapper.find('form').exists()).toBe(false);
  });

  test('shows a validation error for an empty name', async () => {
    const wrapper = mount(LabelCreateForm, { props: { owner: 'owner', repo: 'repo' } });
    await wrapper.find('.label-create__toggle').trigger('click');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(apiFetch).not.toHaveBeenCalled();
    expect(wrapper.find('.label-create__error').text()).toBe('issueDetail.labelNameRequired');
  });
});

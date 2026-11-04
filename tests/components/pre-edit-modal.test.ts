// @vitest-environment happy-dom
/// Component tests for the PR title/body edit modal.
import { mount } from '@vue/test-utils';
import { describe, expect, test, vi } from 'vitest';

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

import PREditModal from '../../app/components/dashboard/pr/PREditModal.vue';

describe('PREditModal', () => {
  test('prefills title/body and emits the edited payload', async () => {
    const wrapper = mount(PREditModal, {
      props: { visible: true, title: 'Old title', body: 'Old body', saving: false },
    });

    expect((wrapper.find('#pr-edit-title').element as HTMLInputElement).value).toBe('Old title');
    expect((wrapper.find('#pr-edit-body').element as HTMLTextAreaElement).value).toBe('Old body');

    await wrapper.find('#pr-edit-title').setValue('  New title  ');
    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('save')?.[0]).toEqual([{ title: 'New title', body: 'Old body' }]);
  });

  test('disables submit for empty titles and emits close', async () => {
    const wrapper = mount(PREditModal, {
      props: { visible: true, title: 'Title', body: '', saving: false },
    });

    await wrapper.find('#pr-edit-title').setValue('   ');
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined();

    await wrapper.find('.pr-edit-form__close').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});

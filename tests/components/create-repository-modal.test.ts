// @vitest-environment happy-dom
/// Component tests for the repository creation modal.
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const apiFetch = vi.fn();

import CreateRepositoryModal from '../../app/components/dashboard/repo/CreateRepositoryModal.vue';

describe('CreateRepositoryModal', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    vi.stubGlobal('useNekoGitApiFetch', () => apiFetch);
  });

  test('loads organizations and creates a repository under the selected owner', async () => {
    apiFetch.mockImplementation((url: string) => {
      if (url === '/api/user/orgs') {
        return Promise.resolve({ items: [{ login: 'acme' }, { login: 'nekogit-org' }] });
      }
      return Promise.resolve({ name: 'demo', owner: { login: 'acme' } });
    });

    const wrapper = mount(CreateRepositoryModal, { props: { isVisible: false } });
    await wrapper.setProps({ isVisible: true });
    await flushPromises();

    const options = wrapper.findAll('#create-repo-owner option');
    expect(options.map((option) => option.text())).toEqual([
      'repoCreate.personalOwner',
      'acme',
      'nekogit-org',
    ]);

    await wrapper.find('#create-repo-name').setValue('  demo  ');
    await wrapper.find('#create-repo-owner').setValue('acme');
    await wrapper.find('.modal-card-foot .is-primary').trigger('click');
    await flushPromises();

    expect(apiFetch).toHaveBeenCalledWith('/api/repos', {
      method: 'POST',
      body: {
        name: 'demo',
        owner: 'acme',
        description: '',
        homepage: '',
        private: false,
        auto_init: true,
      },
    });
    expect(wrapper.emitted('created')?.[0]).toEqual([{ name: 'demo', owner: { login: 'acme' } }]);
  });

  test('disables creation for invalid repository names', async () => {
    apiFetch.mockResolvedValue({ items: [] });
    const wrapper = mount(CreateRepositoryModal, { props: { isVisible: false } });
    await wrapper.setProps({ isVisible: true });
    await flushPromises();

    await wrapper.find('#create-repo-name').setValue('bad name');
    expect(wrapper.find('.modal-card-foot .is-primary').attributes('disabled')).toBeDefined();

    await wrapper.find('#create-repo-name').setValue('valid-name');
    expect(wrapper.find('.modal-card-foot .is-primary').attributes('disabled')).toBeUndefined();
  });
});

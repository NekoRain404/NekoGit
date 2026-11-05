// @vitest-environment happy-dom
/// Component tests for repository settings, archive, transfer, and deletion.
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const apiFetch = vi.fn();

import RepositorySettingsModal from '../../app/components/dashboard/repo/RepositorySettingsModal.vue';

const baseProps = {
  isVisible: false,
  owner: 'NekoRain404',
  repo: 'NekoGit',
  repository: { description: 'Old description', homepage: 'https://old.example.com' },
};

describe('RepositorySettingsModal', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    vi.stubGlobal('useNekoGitApiFetch', () => apiFetch);
  });

  test('updates description and homepage', async () => {
    const updated = { description: 'New', homepage: 'https://new.example.com' };
    apiFetch.mockResolvedValue(updated);
    const wrapper = mount(RepositorySettingsModal, { props: baseProps });
    await wrapper.setProps({ isVisible: true });

    expect((wrapper.find('#repo-settings-description').element as HTMLTextAreaElement).value).toBe(
      'Old description'
    );

    await wrapper.find('#repo-settings-description').setValue('  New  ');
    await wrapper.find('#repo-settings-homepage').setValue('https://new.example.com');
    await wrapper.find('.modal-card-foot .is-primary').trigger('click');
    await flushPromises();

    expect(apiFetch).toHaveBeenCalledWith('/api/repos/NekoRain404/NekoGit', {
      method: 'PATCH',
      body: { description: '  New  ', homepage: 'https://new.example.com' },
    });
    expect(wrapper.emitted('updated')?.[0]).toEqual([updated]);
  });

  test('transfers the repository after confirmation', async () => {
    apiFetch.mockResolvedValue({ name: 'NekoGit', owner: { login: 'nekogit-org' } });
    const wrapper = mount(RepositorySettingsModal, { props: baseProps });
    await wrapper.setProps({ isVisible: true });

    await wrapper.find('.repo-settings-modal__transfer input').setValue('nekogit-org');
    const transferButton = wrapper.find('.repo-settings-modal__transfer button');
    expect(transferButton.attributes('disabled')).toBeUndefined();
    await transferButton.trigger('click');
    await flushPromises();

    expect(apiFetch).toHaveBeenCalledWith('/api/repos/NekoRain404/NekoGit/transfer', {
      method: 'POST',
      body: { new_owner: 'nekogit-org' },
    });
    expect(wrapper.emitted('transferred')?.[0]).toEqual(['nekogit-org']);
  });

  test('requires the exact repository name before deletion', async () => {
    apiFetch.mockResolvedValue({ deleted: true });
    const wrapper = mount(RepositorySettingsModal, { props: baseProps });
    await wrapper.setProps({ isVisible: true });

    await wrapper.find('#repo-settings-confirm').setValue('nekogit');
    expect(
      wrapper.find('.repo-settings-modal__danger .is-danger').attributes('disabled')
    ).toBeDefined();

    await wrapper.find('#repo-settings-confirm').setValue('NekoGit');
    await wrapper.find('.repo-settings-modal__danger .is-danger').trigger('click');
    await flushPromises();

    expect(apiFetch).toHaveBeenCalledWith('/api/repos/NekoRain404/NekoGit', {
      method: 'DELETE',
      body: { confirmName: 'NekoGit' },
    });
    expect(wrapper.emitted('deleted')).toHaveLength(1);
  });
});

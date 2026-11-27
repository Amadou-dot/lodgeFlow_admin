import { Providers } from '@/app/providers';
import { Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/modal';
import { addToast, closeAll } from '@heroui/toast';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';

jest.unmock('@heroui/toast');

const toastRegion = { name: /notification/i };

function StartupNotification() {
  useEffect(() => {
    addToast({ title: 'Dashboard ready', timeout: 0 });
  }, []);

  return null;
}

async function clearNotifications() {
  closeAll();
  await waitFor(() => {
    expect(document.querySelector('[role=region][data-placement]')).toBeNull();
  });
}

describe('admin notifications', () => {
  it('keeps notifications emitted by a child on its first effect', async () => {
    render(
      <Providers>
        <StartupNotification />
      </Providers>
    );

    try {
      expect(await screen.findByRole('region', toastRegion)).toHaveTextContent(
        'Dashboard ready'
      );
    } finally {
      await clearNotifications();
    }
  });

  it('exposes a notification first emitted while the editor is open', async () => {
    render(
      <Providers>
        <h1>Dashboard</h1>
        <Modal isOpen disableAnimation>
          <ModalContent>
            <ModalHeader>Editor</ModalHeader>
            <ModalBody>Editor contents</ModalBody>
          </ModalContent>
        </Modal>
      </Providers>
    );

    expect(await screen.findByRole('dialog', { name: 'Editor' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).toBeNull();

    act(() => {
      addToast({ title: 'Unable to save', timeout: 0 });
    });

    try {
      expect(await screen.findByRole('region', toastRegion)).toHaveTextContent(
        'Unable to save'
      );
    } finally {
      await clearNotifications();
    }
  });
});

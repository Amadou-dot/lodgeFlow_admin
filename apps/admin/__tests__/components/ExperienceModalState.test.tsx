import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { FormProps, FormData } from '@/components/AddExperienceForm/types';
import { ExperienceModal } from '@/components/ExperienceModal';
jest.mock('@/components/AuthGuard', () => ({ usePermission: () => true }));
jest.mock('@/components/EditExperienceForm', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/AddExperienceForm', () => ({
  __esModule: true,
  default: ({ formData, setFormData }: FormProps) => (
    <label>
      Title
      <input
        value={formData.title ?? ''}
        onChange={event =>
          setFormData(current => ({ ...current, title: event.target.value }))
        }
      />
    </label>
  ),
}));
test('a failed create handled by the page keeps the entered modal draft for retry', async () => {
  const submit = jest
    .fn<Promise<void>, [FormData]>()
    .mockResolvedValue(undefined);
  render(
    <ExperienceModal
      isOpen
      mode='create'
      onClose={jest.fn()}
      onCreateSubmit={submit}
      onUpdateSubmit={async () => undefined}
      isUpdating={false}
    />
  );
  fireEvent.change(await screen.findByLabelText('Title'), {
    target: { value: 'Forest walk' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create Experience' }));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  expect(screen.getByLabelText('Title')).toHaveValue('Forest walk');
  fireEvent.click(screen.getByRole('button', { name: 'Create Experience' }));
  expect(submit).toHaveBeenCalledTimes(2);
  expect(submit.mock.calls[1][0].title).toBe('Forest walk');
});
test('create pending follows the page mutation and prevents submission', async () => {
  const submit = jest.fn();
  render(
    <ExperienceModal
      isOpen
      mode='create'
      isCreating
      onClose={jest.fn()}
      onCreateSubmit={submit}
      onUpdateSubmit={async () => undefined}
      isUpdating={false}
    />
  );
  const button = await screen.findByRole('button', {
    name: /Create Experience/,
  });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(submit).not.toHaveBeenCalled();
});

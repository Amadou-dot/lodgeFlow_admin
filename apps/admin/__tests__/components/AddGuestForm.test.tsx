import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AddGuestForm from '@/components/AddGuestForm';
import type { GuestFormCustomer } from '@/types/customer-json';
import { updateCustomerSchema } from '@/lib/validations/customer';

const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockReset = jest.fn();
jest.mock('@/hooks/useCustomers', () => ({
  useCreateCustomer: () => ({ mutateAsync: mockCreate, reset: mockReset }),
  useUpdateCustomer: () => ({ mutateAsync: mockUpdate, reset: mockReset }),
}));

beforeEach(() => jest.clearAllMocks());

test('new guests start with empty nested fields after another form is discarded', () => {
  const first = render(<AddGuestForm />);
  fireEvent.change(screen.getByLabelText('City'), {
    target: { value: 'Denver' },
  });
  fireEvent.change(screen.getByLabelText('Contact First Name'), {
    target: { value: 'Alice' },
  });
  fireEvent.change(screen.getByLabelText('Dietary Restrictions'), {
    target: { value: 'Vegetarian' },
  });
  first.unmount();
  render(<AddGuestForm />);
  expect(screen.getByLabelText('City')).toHaveValue('');
  expect(screen.getByLabelText('Contact First Name')).toHaveValue('');
  expect(screen.getByLabelText('Dietary Restrictions')).toHaveValue('');
});

test('editing nested fields preserves other profile fields and normalized preferences', async () => {
  mockUpdate.mockImplementation(async (input: unknown) =>
    updateCustomerSchema.parse(input)
  );
  const onSuccess = jest.fn();
  const guest: GuestFormCustomer = {
    id: 'user_guest',
    first_name: 'Grace',
    last_name: 'Hopper',
    email: 'guest@example.test',
    phone: '',
    nationality: 'United States',
    nationalId: 'guest-id',
    address: { street: '10 Main Street', city: 'Boulder' },
    emergencyContact: { firstName: 'Alice', lastName: 'Hopper' },
    preferences: {
      smokingPreference: 'non-smoking',
      dietaryRestrictions: ['Vegetarian'],
    },
  };
  const { container } = render(
    <AddGuestForm initialData={guest} isEditing onSuccess={onSuccess} />
  );
  fireEvent.change(screen.getByLabelText('City'), {
    target: { value: 'Denver' },
  });
  fireEvent.change(screen.getByLabelText('Contact First Name'), {
    target: { value: 'Bob' },
  });
  fireEvent.change(screen.getByLabelText('Dietary Restrictions'), {
    target: { value: 'Vegan, Gluten-free' },
  });
  const form = container.querySelector('form');
  if (!form) throw new Error('Guest form missing');
  fireEvent.submit(form);
  await waitFor(() =>
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user_guest',
        firstName: 'Grace',
        lastName: 'Hopper',
        nationalId: 'guest-id',
        address: {
          street: '10 Main Street',
          city: 'Denver',
          state: '',
          country: '',
          zipCode: '',
        },
        emergencyContact: {
          firstName: 'Bob',
          lastName: 'Hopper',
          phone: '',
          relationship: '',
        },
        preferences: {
          smokingPreference: 'non-smoking',
          dietaryRestrictions: ['Vegan', 'Gluten-free'],
          accessibilityNeeds: [],
        },
      })
    )
  );
  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  expect(mockCreate).not.toHaveBeenCalled();
  expect(guest.address?.city).toBe('Boulder');
});

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from '@tanstack/react-query';
import BulkActionsToolbar from '@/components/BulkActionsToolbar';
const mockDelete = jest.fn<Promise<{ deletedCount: number }>, [string[]]>();
const mockDiscount = jest.fn<
  Promise<{ modifiedCount: number }>,
  [{ ids: string[]; discount: number }]
>();
const mockClear = jest.fn();
function Toolbar({ ids }: { ids: string[] }) {
  const bulkDelete = useMutation({ mutationFn: mockDelete });
  const bulkUpdateDiscount = useMutation({ mutationFn: mockDiscount });
  return (
    <BulkActionsToolbar
      selectedCount={ids.length}
      selectedNames={['Pine']}
      selectedIds={ids}
      onClearSelection={mockClear}
      bulkDelete={bulkDelete}
      bulkUpdateDiscount={bulkUpdateDiscount}
    />
  );
}
function show(ids = ['one']) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <Toolbar ids={ids} />
    </QueryClientProvider>
  );
  return {
    ...view,
    showIds: (next: string[]) =>
      view.rerender(
        <QueryClientProvider client={client}>
          <Toolbar ids={next} />
        </QueryClientProvider>
      ),
  };
}
beforeEach(() => {
  jest.clearAllMocks();
  mockDelete.mockResolvedValue({ deletedCount: 1 });
  mockDiscount.mockResolvedValue({ modifiedCount: 1 });
});
test('keeps API inputs and selection until discount success; failure keeps dialog and draft for retry', async () => {
  mockDiscount.mockRejectedValueOnce(new Error('Discount exceeds price'));
  show(['one', 'two']);
  fireEvent.click(screen.getByRole('button', { name: 'Set Discount' }));
  fireEvent.change(await screen.findByLabelText('Discount Amount ($)'), {
    target: { value: '15' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply Discount' }));
  await waitFor(() => expect(mockDiscount).toHaveBeenCalledTimes(1));
  expect(mockClear).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Discount Amount ($)')).toHaveValue(15);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Apply Discount' })
    ).not.toBeDisabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Apply Discount' }));
  await waitFor(() => expect(mockClear).toHaveBeenCalledTimes(1));
  expect(mockDiscount).toHaveBeenNthCalledWith(
    1,
    { ids: ['one', 'two'], discount: 15 },
    expect.anything()
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  );
});
test('opening delete replaces discount; cancel and reopen reset its draft', async () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Set Discount' }));
  fireEvent.change(await screen.findByLabelText('Discount Amount ($)'), {
    target: { value: '15' },
  });
  fireEvent.click(screen.getByText('Delete Selected'));
  await screen.findByText('Delete 1 Cabins');
  expect(
    screen.queryByLabelText('Discount Amount ($)')
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Set Discount' }));
  expect(await screen.findByLabelText('Discount Amount ($)')).toHaveValue(null);
});
test('late deletion completion cannot clear changed selection or close a reopened dialog', async () => {
  let finish: (value: { deletedCount: number }) => void = () => {
    throw new Error('not started');
  };
  mockDelete.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  const view = show();
  fireEvent.click(screen.getByRole('button', { name: 'Delete Selected' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Delete All' }));
  view.showIds(['two']);
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Set Discount' }));
  await screen.findByLabelText('Discount Amount ($)');
  await act(async () => {
    finish({ deletedCount: 1 });
  });
  expect(mockClear).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Discount Amount ($)')).toBeInTheDocument();
});

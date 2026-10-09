import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type { Cabin, Dining, Experience } from '@/types';
import type CabinModal from '@/components/CabinModal';
import type { DiningModal } from '@/components/DiningModal';
import type { ExperienceModal } from '@/components/ExperienceModal';
import type CabinCard from '@/components/CabinCard';
import type { DiningGrid } from '@/components/DiningGrid';
import type { ExperienceGrid } from '@/components/ExperienceGrid';
import type DeletionModal from '@/components/DeletionModal';

const mockCabin: Cabin = {
  _id: 'cabin',
  id: 'cabin',
  name: 'Pine',
  image: '',
  images: [],
  status: 'active',
  capacity: 2,
  price: 100,
  discountedPrice: 100,
  discount: 0,
  description: 'Pine cabin',
  amenities: [],
  extraGuestFee: 0,
};
const mockDining: Dining = {
  _id: 'dining',
  name: 'Supper',
  description: 'Dinner',
  type: 'menu',
  mealType: 'dinner',
  price: 10,
  servingTime: { start: '18:00', end: '20:00' },
  maxPeople: 4,
  category: 'regular',
  image: '',
};
const mockExperience: Experience = {
  _id: 'experience',
  name: 'Walk',
  price: 10,
  duration: '1 hour',
  difficulty: 'Easy',
  category: 'nature',
  description: 'A walk',
  image: '',
  ctaText: 'Book',
};
const mockOldClose: (() => void)[] = [];
let mockCanWrite = true;
jest.mock('@/components/AuthGuard', () => ({
  usePermission: () => mockCanWrite,
}));
jest.mock('@/hooks/useCabins', () => ({
  useCabins: () => ({ data: [mockCabin], isLoading: false }),
  useDeleteCabin: () => ({}),
  useBulkDeleteCabins: () => ({}),
  useBulkUpdateDiscount: () => ({}),
}));
jest.mock('@/hooks/useDining', () => ({
  useDining: () => ({ data: [mockDining], isLoading: false }),
  useDeleteDining: () => ({}),
}));
jest.mock('@/hooks/useExperiences', () => ({
  useExperiences: () => ({ data: [mockExperience], isLoading: false }),
  useDeleteExperience: () => ({}),
  useCreateExperience: () => ({}),
}));
jest.mock('@/components/CabinStats', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/DiningStats', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/ExperienceStats', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/CabinFilters', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/DiningFilters', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/ExperienceFilters', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/CabinTableView', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/DiningTableView', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/ExperienceTableView', () => ({
  __esModule: true,
  default: () => null,
}));
function mockActions({
  view,
  edit,
  remove,
}: {
  view: () => void;
  edit: () => void;
  remove: () => void;
}) {
  return (
    <>
      <button onClick={view}>View item</button>
      <button onClick={edit}>Edit item</button>
      <button onClick={remove}>Delete item</button>
    </>
  );
}
jest.mock('@/components/CabinCard', () => ({
  __esModule: true,
  default: ({
    cabin,
    onView,
    onEdit,
    onDelete,
  }: ComponentProps<typeof CabinCard>) =>
    mockActions({
      view: () => onView?.(cabin),
      edit: () => onEdit(cabin),
      remove: () => onDelete(cabin),
    }),
}));
jest.mock('@/components/DiningGrid', () => ({
  DiningGrid: ({
    dining,
    onView,
    onEdit,
    onDelete,
  }: ComponentProps<typeof DiningGrid>) =>
    mockActions({
      view: () => onView?.(dining[0]),
      edit: () => onEdit?.(dining[0]),
      remove: () => onDelete?.(dining[0]),
    }),
}));
jest.mock('@/components/ExperienceGrid', () => ({
  ExperienceGrid: ({
    items,
    onView,
    onEdit,
    onDelete,
  }: ComponentProps<typeof ExperienceGrid>) =>
    mockActions({
      view: () => onView?.(items[0]),
      edit: () => onEdit?.(items[0]),
      remove: () => onDelete?.(items[0]),
    }),
}));
function mockEditor({
  mode,
  name,
  onClose,
  edit,
  isOpen,
}: {
  mode: string;
  name?: string;
  onClose: () => void;
  edit: () => void;
  isOpen: boolean;
}) {
  if (!isOpen) return null;
  mockOldClose.push(onClose);
  return (
    <section role='dialog' aria-label={mode}>
      <p>{name ?? 'New item'}</p>
      <button onClick={onClose}>Close editor</button>
      <button onClick={edit}>Edit viewed item</button>
    </section>
  );
}
jest.mock('@/components/CabinModal', () => ({
  __esModule: true,
  default: ({
    mode,
    cabin,
    onClose,
    onEdit,
    isOpen,
  }: ComponentProps<typeof CabinModal>) =>
    mockEditor({
      mode,
      name: cabin?.name,
      onClose,
      isOpen,
      edit: () => {
        if (cabin) onEdit?.(cabin);
      },
    }),
}));
jest.mock('@/components/DiningModal', () => ({
  DiningModal: ({
    mode,
    dining,
    onClose,
    onEdit,
    isOpen,
  }: ComponentProps<typeof DiningModal>) =>
    mockEditor({
      mode,
      name: dining?.name,
      onClose,
      isOpen,
      edit: () => {
        if (dining) onEdit?.(dining);
      },
    }),
}));
jest.mock('@/components/ExperienceModal', () => ({
  ExperienceModal: ({
    mode,
    experience,
    onClose,
    onEdit,
    isOpen,
  }: ComponentProps<typeof ExperienceModal>) =>
    mockEditor({
      mode,
      name: experience?.name,
      onClose,
      isOpen,
      edit: () => {
        if (experience) onEdit?.(experience);
      },
    }),
}));
jest.mock('@/components/DeletionModal', () => ({
  __esModule: true,
  default: ({
    itemName,
    onOpenChange,
    isOpen,
  }: ComponentProps<typeof DeletionModal>) =>
    isOpen ? (
      <section role='dialog' aria-label='delete'>
        <p>{itemName}</p>
        <button onClick={() => onOpenChange?.(false)}>Cancel delete</button>
      </section>
    ) : null,
}));
import CabinsPage from '@/app/(dashboard)/cabins/page';
import DiningPage from '@/app/(dashboard)/dining/page';
import ExperiencesPage from '@/app/(dashboard)/experiences/page';
beforeEach(() => {
  mockOldClose.length = 0;
  mockCanWrite = true;
  localStorage.clear();
});
test.each([
  { Page: CabinsPage, create: 'Add New Cabin', name: 'Pine' },
  { Page: DiningPage, create: 'Add Dining Item', name: 'Supper' },
  { Page: ExperiencesPage, create: 'Add New Experience', name: 'Walk' },
])('$name preserves view → edit → close → create', ({ Page, create, name }) => {
  render(<Page />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View item' }));
  expect(screen.getByRole('dialog', { name: 'view' })).toHaveTextContent(name);
  fireEvent.click(screen.getByRole('button', { name: 'Edit viewed item' }));
  expect(screen.getByRole('dialog', { name: 'edit' })).toHaveTextContent(name);
  fireEvent.click(screen.getByRole('button', { name: 'Close editor' }));
  fireEvent.click(screen.getByRole('button', { name: create }));
  expect(screen.getByRole('dialog', { name: 'create' })).toHaveTextContent(
    'New item'
  );
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
});
test.each([CabinsPage, DiningPage, ExperiencesPage])(
  'delete replaces an open editor and cancels to closed',
  Page => {
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: 'View item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'delete' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel delete' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  }
);
test('an old editor completion cannot close a newly opened cabin dialog', () => {
  render(<CabinsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit item' }));
  const finishOld = mockOldClose[mockOldClose.length - 1];
  fireEvent.click(screen.getByRole('button', { name: 'Close editor' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add New Cabin' }));
  fireEvent.click(screen.getByRole('button', { name: 'View item' }));
  act(() => finishOld());
  expect(screen.getByRole('dialog', { name: 'view' })).toBeInTheDocument();
});
test('write permission keeps the catalog create action disabled', () => {
  mockCanWrite = false;
  render(<DiningPage />);
  expect(
    screen.getByRole('button', { name: 'Add Dining Item' })
  ).toBeDisabled();
});

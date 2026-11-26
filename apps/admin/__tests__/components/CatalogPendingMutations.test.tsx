import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import type { Cabin, Dining, Experience } from '@/types';
import type CabinCard from '@/components/CabinCard';
import type { DiningGrid } from '@/components/DiningGrid';
import type { ExperienceGrid } from '@/components/ExperienceGrid';
import { createCabinSchema, updateCabinSchema } from '@/lib/validations/cabin';
import {
  createDiningSchema,
  updateDiningSchema,
} from '@/lib/validations/dining';
import { updateExperienceSchema } from '@/lib/validations/experience';
import CabinsPage from '@/app/(dashboard)/cabins/page';
import DiningPage from '@/app/(dashboard)/dining/page';
import ExperiencesPage from '@/app/(dashboard)/experiences/page';

jest.mock('@/components/AuthGuard', () => ({ usePermission: () => true }));
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
jest.mock('@/components/CabinCard', () => ({
  __esModule: true,
  default: ({ cabin, onEdit }: ComponentProps<typeof CabinCard>) => (
    <button onClick={() => onEdit(cabin)}>Edit item</button>
  ),
}));
jest.mock('@/components/DiningGrid', () => ({
  DiningGrid: ({ dining, onEdit }: ComponentProps<typeof DiningGrid>) => (
    <button onClick={() => onEdit?.(dining[0])}>Edit item</button>
  ),
}));
jest.mock('@/components/ExperienceGrid', () => ({
  ExperienceGrid: ({
    items,
    onEdit,
  }: ComponentProps<typeof ExperienceGrid>) => (
    <button onClick={() => onEdit?.(items[0])}>Edit item</button>
  ),
}));
jest.mock('@/utils/utilityFunctions', () => ({
  isImageUrl: jest.fn().mockResolvedValue(true),
}));
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

const cabin: Cabin = {
  _id: '507f1f77bcf86cd799439011',
  id: '507f1f77bcf86cd799439011',
  name: 'Pine Cabin',
  image: 'https://example.com/pine.jpg',
  images: [],
  status: 'active',
  capacity: 2,
  price: 100,
  discountedPrice: 100,
  discount: 0,
  description: 'A quiet cabin by the lake.',
  amenities: [],
  extraGuestFee: 0,
};
const dining: Dining = {
  _id: '507f1f77bcf86cd799439012',
  name: 'Supper',
  description: 'Dinner beside the lake.',
  type: 'menu',
  mealType: 'dinner',
  price: 10,
  servingTime: { start: '18:00', end: '20:00' },
  maxPeople: 4,
  category: 'regular',
  image: 'https://example.com/supper.jpg',
  minPeople: 1,
  gallery: [],
  ingredients: [],
  allergens: [],
  dietary: [],
  beverages: [],
  includes: [],
  specialRequirements: [],
  isPopular: false,
  isAvailable: true,
  tags: [],
  reviewCount: 0,
};
const experience: Experience = {
  _id: '507f1f77bcf86cd799439013',
  name: 'Forest walk',
  price: 10,
  duration: '1 hour',
  difficulty: 'Easy',
  category: 'nature',
  description: 'A guided walk through the forest.',
  image: 'https://example.com/walk.jpg',
  ctaText: 'Book',
  includes: ['Guide'],
  available: ['Daily'],
  isPopular: false,
  gallery: [],
  requirements: [],
  highlights: [],
  whatToBring: [],
  tags: [],
  reviewCount: 0,
};

async function fillCabin(name: string) {
  fireEvent.change(await screen.findByPlaceholderText('Enter cabin name'), {
    target: { value: name },
  });
  fireEvent.change(screen.getByPlaceholderText('Enter image URL'), {
    target: { value: cabin.image },
  });
  fireEvent.change(screen.getByPlaceholderText('Number of guests'), {
    target: { value: '2' },
  });
  fireEvent.change(screen.getByPlaceholderText('Enter price'), {
    target: { value: '100' },
  });
  fireEvent.change(screen.getByPlaceholderText('Enter cabin description'), {
    target: { value: cabin.description },
  });
  await act(async () => {
    await Promise.resolve();
  });
}

async function fillDining(name: string) {
  fireEvent.change(
    await screen.findByPlaceholderText('Enter dining item name'),
    {
      target: { value: name },
    }
  );
  fireEvent.change(screen.getByPlaceholderText('0.00'), {
    target: { value: '10' },
  });
  fireEvent.change(screen.getByPlaceholderText('Describe this dining item'), {
    target: { value: dining.description },
  });
  fireEvent.change(
    screen.getByPlaceholderText('https://example.com/image.jpg'),
    {
      target: { value: dining.image },
    }
  );
}

async function fillExperience(name: string) {
  fireEvent.click(
    await screen.findByRole('button', { name: 'Basic Information' })
  );
  fireEvent.change(await screen.findByLabelText('Experience Title'), {
    target: { value: name },
  });
}

const operations = [
  {
    name: 'cabin create',
    Page: CabinsPage,
    record: cabin,
    open: 'Add New Cabin',
    save: /Create Cabin/,
    fill: fillCabin,
    method: 'POST',
    url: '/api/cabins',
    schema: createCabinSchema,
  },
  {
    name: 'cabin edit',
    Page: CabinsPage,
    record: cabin,
    open: 'Edit item',
    save: /Save Changes/,
    fill: fillCabin,
    method: 'PUT',
    url: `/api/cabins/${cabin._id}`,
    schema: updateCabinSchema,
  },
  {
    name: 'dining create',
    Page: DiningPage,
    record: dining,
    open: 'Add Dining Item',
    save: /Create Dining Item/,
    fill: fillDining,
    method: 'POST',
    url: '/api/dining',
    schema: createDiningSchema,
  },
  {
    name: 'dining edit',
    Page: DiningPage,
    record: dining,
    open: 'Edit item',
    save: /Update Dining Item/,
    fill: fillDining,
    method: 'PUT',
    url: `/api/dining/${dining._id}`,
    schema: updateDiningSchema,
  },
  {
    name: 'experience edit',
    Page: ExperiencesPage,
    record: experience,
    open: 'Edit item',
    save: /Save Changes|Saving/,
    fill: fillExperience,
    method: 'PUT',
    url: `/api/experiences/${experience._id}`,
    schema: updateExperienceSchema,
  },
];

beforeEach(() => {
  localStorage.clear();
});

test.each(operations)(
  '$name stays pending across close/reopen and permits retry after settlement',
  async ({ Page, record, open, save, fill, method, url, schema }) => {
    const requests: Array<{
      url: string;
      method: string;
      body: unknown;
      finish: (success: boolean) => void;
    }> = [];
    jest.mocked(fetch).mockImplementation((input, options) => {
      if (options?.method === 'POST' || options?.method === 'PUT') {
        return new Promise<Response>(resolve => {
          requests.push({
            url: String(input),
            method: options.method ?? '',
            body: JSON.parse(String(options.body)),
            finish: success =>
              resolve({
                ok: success,
                json: async () =>
                  success
                    ? { success: true, data: record }
                    : { success: false, error: 'Save failed' },
              } as Response),
          });
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [record] }),
      } as Response);
    });
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const rendered = render(
      <QueryClientProvider client={client}>
        <Page />
      </QueryClientProvider>
    );

    const reopen = async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      );
      const opener = await screen.findByRole('button', { name: open });
      await act(async () => {
        fireEvent.click(opener);
      });
    };

    try {
      const opener = await screen.findByRole('button', { name: open });
      await act(async () => {
        fireEvent.click(opener);
      });
      await fill('First draft');
      const submit = await screen.findByRole('button', { name: save });
      await waitFor(() => expect(submit).toBeEnabled());
      fireEvent.click(submit);
      await waitFor(() => expect(requests).toHaveLength(1));
      await waitFor(() => expect(submit).toBeDisabled());

      await reopen();
      await fill('Retry draft');
      const retry = screen.getByRole('button', { name: save });
      expect(retry).toBeDisabled();
      fireEvent.click(retry);
      expect(requests).toHaveLength(1);

      await act(async () => {
        requests[0].finish(false);
      });
      await waitFor(() => expect(retry).toBeEnabled());
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      fireEvent.click(retry);
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(requests[1].body).toMatchObject({ name: 'Retry draft' });
      await waitFor(() => expect(retry).toBeDisabled());

      await reopen();
      await fill('Next draft');
      const next = screen.getByRole('button', { name: save });
      expect(next).toBeDisabled();
      fireEvent.click(next);
      expect(requests).toHaveLength(2);

      await act(async () => {
        requests[1].finish(true);
      });
      await waitFor(() => expect(next).toBeEnabled());
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      fireEvent.click(next);
      await waitFor(() => expect(requests).toHaveLength(3));
      expect(requests[2].body).toMatchObject({ name: 'Next draft' });
      await act(async () => {
        requests[2].finish(true);
      });
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      );

      for (const request of requests) {
        expect(request).toMatchObject({ url, method });
        expect(schema.safeParse(request.body).success).toBe(true);
      }
    } finally {
      rendered.unmount();
      await act(async () => {
        requests.forEach(request => request.finish(false));
      });
      client.clear();
    }
  }
);

const legacyEdits = [
  {
    name: 'Dining',
    Page: DiningPage,
    record: {
      ...dining,
      location: null,
      tags: ['Local', null],
      beverages: [
        {
          _id: '507f1f77bcf86cd799439014',
          name: 'Juice',
          category: 'non-alcoholic',
          price: null,
        },
      ],
      isAvailable: null,
    },
    title: 'Enter dining item name',
    invalidFields: ['location', 'tags', 'beverages', 'isAvailable'],
    save: /Update Dining Item/,
    async select() {
      fireEvent.click(screen.getByRole('switch', { name: 'Available' }));
    },
    selected: { isAvailable: true },
    schema: updateDiningSchema,
  },
  {
    name: 'Experience',
    Page: ExperiencesPage,
    record: {
      ...experience,
      location: null,
      available: null,
      tags: ['Local', null],
      isPopular: null,
    },
    title: 'Experience Title',
    invalidFields: ['location', 'tags', 'available', 'isPopular'],
    save: /Save Changes/,
    async select() {
      fireEvent.click(
        screen.getByRole('button', { name: 'Booking & Policies' })
      );
      fireEvent.click(
        await screen.findByRole('checkbox', { name: 'Mark as popular' })
      );
    },
    selected: { isPopular: true },
    schema: updateExperienceSchema,
  },
];

test.each(legacyEdits)(
  '$name omits untouched nullable fields but submits an explicit selection',
  async ({
    name,
    Page,
    record,
    title,
    invalidFields,
    save,
    select,
    selected,
    schema,
  }) => {
    const requests: unknown[] = [];
    const originalFetch = global.fetch;
    global.fetch = jest
      .fn()
      .mockImplementation(
        async (_input: RequestInfo | URL, options?: RequestInit) => {
          if (options?.method === 'PUT') {
            requests.push(JSON.parse(String(options.body)));
            // Keep the same editor open after the first response so a real field can be selected.
            return {
              ok: false,
              json: async () => ({ success: false, error: 'Try again' }),
            };
          }
          return {
            ok: true,
            json: async () => ({ success: true, data: [record] }),
          };
        }
      );
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const rendered = render(
      <QueryClientProvider client={client}>
        <Page />
      </QueryClientProvider>
    );

    try {
      fireEvent.click(await screen.findByRole('button', { name: 'Edit item' }));
      if (name === 'Experience') {
        fireEvent.click(
          await screen.findByRole('button', { name: 'Basic Information' })
        );
      }
      const titleInput =
        name === 'Dining'
          ? screen.getByPlaceholderText(title)
          : await screen.findByLabelText(title);
      fireEvent.change(titleInput, { target: { value: 'Renamed' } });
      const submit = await screen.findByRole('button', { name: save });
      fireEvent.click(submit);
      await waitFor(() => expect(requests).toHaveLength(1));
      await waitFor(() => expect(submit).toBeEnabled());
      expect(requests[0]).toMatchObject({ _id: record._id, name: 'Renamed' });
      for (const field of invalidFields) {
        expect(requests[0]).not.toHaveProperty(field);
      }
      expect(schema.safeParse(requests[0]).success).toBe(true);

      await select();
      fireEvent.click(submit);
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(requests[1]).toMatchObject({
        _id: record._id,
        name: 'Renamed',
        ...selected,
      });
      expect(schema.safeParse(requests[1]).success).toBe(true);
    } finally {
      global.fetch = originalFetch;
      rendered.unmount();
      client.clear();
    }
  }
);

import { renderHook, act } from '@testing-library/react';
import { ReadonlyURLSearchParams } from 'next/navigation';

type Navigation = typeof import('next/navigation');
type Router = ReturnType<Navigation['useRouter']>;
type FilterRouter = Pick<Router, 'push' | 'replace'>;
const mockPush = jest.fn<
  ReturnType<Router['push']>,
  Parameters<Router['push']>
>();
const mockReplace = jest.fn<
  ReturnType<Router['replace']>,
  Parameters<Router['replace']>
>();
let currentSearchParams = new ReadonlyURLSearchParams();

// Override the global next/navigation mock for this test.
jest.mock('next/navigation', () => ({
  ReadonlyURLSearchParams:
    jest.requireActual<Navigation>('next/navigation').ReadonlyURLSearchParams,
  useRouter: (): FilterRouter => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: (): ReturnType<Navigation['useSearchParams']> =>
    currentSearchParams,
  usePathname: (): ReturnType<Navigation['usePathname']> => '/bookings',
}));

import {
  useURLFilters,
  bookingsFilterConfig,
  guestsFilterConfig,
  type URLFilterConfig,
} from '@/hooks/useURLFilters';

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  currentSearchParams = new ReadonlyURLSearchParams();
});

describe('useURLFilters', () => {
  describe('parsing filters from URL', () => {
    it('returns default values when no URL params', () => {
      const { result } = renderHook(() =>
        useURLFilters({ filterConfig: bookingsFilterConfig })
      );

      expect(result.current.filters.page).toBe(1);
      expect(result.current.filters.limit).toBe(10);
      expect(result.current.filters.status).toBeUndefined();
      expect(result.current.filters.sortBy).toBe('checkInDate');
      expect(result.current.filters.sortOrder).toBe('desc');
    });

    it('parses string values from URL', () => {
      currentSearchParams = new ReadonlyURLSearchParams('status=confirmed');

      const { result } = renderHook(() =>
        useURLFilters({ filterConfig: bookingsFilterConfig })
      );

      expect(result.current.filters.status).toBe('confirmed');
    });

    it('parses number values from URL', () => {
      currentSearchParams = new ReadonlyURLSearchParams('page=3&limit=20');

      const { result } = renderHook(() =>
        useURLFilters({ filterConfig: bookingsFilterConfig })
      );

      expect(result.current.filters.page).toBe(3);
      expect(result.current.filters.limit).toBe(20);
    });

    it('rejects invalid enum values', () => {
      currentSearchParams = new ReadonlyURLSearchParams(
        'status=invalid_status'
      );

      const { result } = renderHook(() =>
        useURLFilters({ filterConfig: bookingsFilterConfig })
      );

      expect(result.current.filters.status).toBeUndefined();
    });

    it('handles NaN number values', () => {
      currentSearchParams = new ReadonlyURLSearchParams('page=abc');

      const { result } = renderHook(() =>
        useURLFilters({ filterConfig: bookingsFilterConfig })
      );

      expect(result.current.filters.page).toBe(1);
    });

    it('parses boolean values', () => {
      const config: URLFilterConfig = {
        active: { type: 'boolean', defaultValue: false },
      };
      currentSearchParams = new ReadonlyURLSearchParams('active=true');

      const { result } = renderHook(() =>
        useURLFilters({ filterConfig: config })
      );

      expect(result.current.filters.active).toBe(true);
    });
  });

  describe('updating filters', () => {
    it('updateFilter calls router.replace by default', () => {
      const { result } = renderHook(() =>
        useURLFilters({ filterConfig: bookingsFilterConfig })
      );

      act(() => {
        result.current.updateFilter('status', 'confirmed');
      });

      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining('status=confirmed'),
        { scroll: false }
      );
    });

    it('updateFilter calls router.push when addToHistory is true', () => {
      const { result } = renderHook(() =>
        useURLFilters({ filterConfig: bookingsFilterConfig })
      );

      act(() => {
        result.current.updateFilter('status', 'confirmed', true);
      });

      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining('status=confirmed'),
        { scroll: false }
      );
    });

    it('updateFilters updates multiple values at once', () => {
      const { result } = renderHook(() =>
        useURLFilters({ filterConfig: bookingsFilterConfig })
      );

      act(() => {
        result.current.updateFilters({
          page: 2,
          status: 'checked-in',
        });
      });

      const calledURL = mockReplace.mock.calls[0][0];
      expect(calledURL).toContain('page=2');
      expect(calledURL).toContain('status=checked-in');
    });

    it('removes params set to default value', () => {
      currentSearchParams = new ReadonlyURLSearchParams('page=3');

      const { result } = renderHook(() =>
        useURLFilters({ filterConfig: bookingsFilterConfig })
      );

      act(() => {
        result.current.updateFilter('page', 1);
      });

      const calledURL = mockReplace.mock.calls[0][0];
      expect(calledURL).not.toContain('page=');
    });

    it('removes params set to undefined via clearFilter', () => {
      currentSearchParams = new ReadonlyURLSearchParams('search=test');

      const { result } = renderHook(() =>
        useURLFilters({ filterConfig: bookingsFilterConfig })
      );

      act(() => {
        result.current.clearFilter('search');
      });

      const calledURL = mockReplace.mock.calls[0][0];
      expect(calledURL).not.toContain('search=');
    });
  });

  describe('resetFilters', () => {
    it('resets all filters to defaults', () => {
      currentSearchParams = new ReadonlyURLSearchParams(
        'page=5&status=confirmed&search=test'
      );

      const { result } = renderHook(() =>
        useURLFilters({ filterConfig: bookingsFilterConfig })
      );

      act(() => {
        result.current.resetFilters();
      });

      const calledURL = mockReplace.mock.calls[0][0];
      expect(calledURL).not.toContain('page=');
      expect(calledURL).not.toContain('status=');
      expect(calledURL).not.toContain('search=');
    });
  });

  describe('filter configs', () => {
    it('bookingsFilterConfig has correct defaults', () => {
      expect(bookingsFilterConfig.page.defaultValue).toBe(1);
      expect(bookingsFilterConfig.limit.defaultValue).toBe(10);
      expect(bookingsFilterConfig.sortBy.defaultValue).toBe('checkInDate');
      expect(bookingsFilterConfig.sortOrder.defaultValue).toBe('desc');
    });

    it('guestsFilterConfig has correct defaults', () => {
      expect(guestsFilterConfig.page.defaultValue).toBe(1);
      expect(guestsFilterConfig.limit.defaultValue).toBe(12);
      expect(guestsFilterConfig.sortBy.defaultValue).toBe('name');
      expect(guestsFilterConfig.sortOrder.defaultValue).toBe('asc');
    });
  });
});

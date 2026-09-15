import { renderHook } from '@testing-library/react';

// Mock sessionStorage
const mockSessionStorage: Record<string, string> = {};

beforeEach(() => {
  Object.keys(mockSessionStorage).forEach(
    key => delete mockSessionStorage[key]
  );

  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: jest.fn((key: string) => mockSessionStorage[key] ?? null),
      setItem: jest.fn((key: string, value: string) => {
        mockSessionStorage[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete mockSessionStorage[key];
      }),
    },
    writable: true,
  });
});

import {
  useDetailPageMemory,
  clearDetailMemory,
  getDetailMemory,
} from '@/hooks/useDetailPageMemory';

describe('useDetailPageMemory', () => {
  it('stores current pathname in sessionStorage', () => {
    renderHook(() => useDetailPageMemory('bookings'));

    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
      'detailMemory:bookings',
      expect.any(String)
    );
  });

  it('uses correct storage key prefix', () => {
    renderHook(() => useDetailPageMemory('cabins'));

    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
      'detailMemory:cabins',
      expect.any(String)
    );
  });
});

describe('clearDetailMemory', () => {
  it('removes item from sessionStorage', () => {
    clearDetailMemory('bookings');

    expect(window.sessionStorage.removeItem).toHaveBeenCalledWith(
      'detailMemory:bookings'
    );
  });
});

describe('getDetailMemory', () => {
  it('returns stored path from sessionStorage', () => {
    mockSessionStorage['detailMemory:bookings'] = '/bookings/123';

    const result = getDetailMemory('bookings');

    expect(result).toBe('/bookings/123');
  });

  it('returns null when nothing is stored', () => {
    const result = getDetailMemory('nonexistent');

    expect(result).toBeNull();
  });
});

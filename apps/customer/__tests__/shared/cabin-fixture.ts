import type { CabinDetail } from '@/types/cabin-read';

export function createCabinFixture(
  overrides: Partial<CabinDetail> = {}
): CabinDetail {
  return {
    _id: '507f1f77bcf86cd7994390ab',
    id: overrides._id ?? '507f1f77bcf86cd7994390ab',
    name: 'Pine Cabin',
    description: 'A forest retreat',
    image: 'https://example.invalid/pine.jpg',
    images: [],
    capacity: 4,
    price: 200,
    discount: 0,
    discountedPrice: (overrides.price ?? 200) - (overrides.discount ?? 0),
    extraGuestFee: 0,
    amenities: ['WiFi'],
    status: 'active',
    ...overrides,
  };
}

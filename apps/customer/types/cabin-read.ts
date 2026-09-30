import type { CABIN_STATUSES } from '@lodgeflow/database/config';

/** Legacy wire fields retain their existing null/omission distinction. */
/** JSON projection used by booking history. */
export interface CabinSummary {
  _id: string;
  name: string;
  image: string;
  images: string[];
  capacity: number;
  price: number;
  discount: number;
  description: string;
  status: (typeof CABIN_STATUSES)[number];
  bedrooms?: number | null;
  bathrooms?: number | null;
  size?: number | null;
  minNights?: number | null;
}

/** Full cabin JSON used by catalog, availability and populated booking reads. */
export interface CabinDetail extends CabinSummary {
  id: string;
  amenities: string[];
  extraGuestFee?: number;
  discountedPrice?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  __v?: number | null;
}

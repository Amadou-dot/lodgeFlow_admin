import { Types } from 'mongoose';
import type { CabinSummary, CabinDetail } from '@/types/cabin-read';

export type CabinSummarySource = Omit<CabinSummary, '_id'> & {
  _id: Types.ObjectId;
};
export type CabinDetailSource = Omit<
  CabinDetail,
  '_id' | 'id' | 'createdAt' | 'updatedAt'
> & { _id: Types.ObjectId; createdAt?: Date | null; updatedAt?: Date | null };

function objectId(value: unknown): string {
  if (!(value instanceof Types.ObjectId))
    throw new TypeError('Expected a MongoDB ObjectId');
  return value.toHexString();
}

function optionalDate(value: Date | null | undefined) {
  return value == null ? value : value.toISOString();
}

export function serializeCabinSummary(cabin: CabinSummarySource): CabinSummary {
  return {
    _id: objectId(cabin._id),
    name: cabin.name,
    image: cabin.image,
    images: cabin.images == null ? cabin.images : [...cabin.images],
    capacity: cabin.capacity,
    price: cabin.price,
    discount: cabin.discount,
    description: cabin.description,
    status: cabin.status,
    ...(cabin.bedrooms === undefined ? {} : { bedrooms: cabin.bedrooms }),
    ...(cabin.bathrooms === undefined ? {} : { bathrooms: cabin.bathrooms }),
    ...(cabin.size === undefined ? {} : { size: cabin.size }),
    ...(cabin.minNights === undefined ? {} : { minNights: cabin.minNights }),
  };
}

export function serializeCabinDetail(cabin: CabinDetailSource): CabinDetail {
  return {
    ...serializeCabinSummary(cabin),
    id: objectId(cabin._id),
    amenities: cabin.amenities == null ? cabin.amenities : [...cabin.amenities],
    ...(cabin.extraGuestFee === undefined
      ? {}
      : { extraGuestFee: cabin.extraGuestFee }),
    ...(cabin.discountedPrice === undefined
      ? {}
      : { discountedPrice: cabin.discountedPrice }),
    ...(cabin.createdAt === undefined
      ? {}
      : { createdAt: optionalDate(cabin.createdAt) }),
    ...(cabin.updatedAt === undefined
      ? {}
      : { updatedAt: optionalDate(cabin.updatedAt) }),
    ...(cabin.__v === undefined ? {} : { __v: cabin.__v }),
  };
}

import { Types } from 'mongoose';
import type { IDining } from './models/Dining';

// Pick data fields only: persistence dates and identifiers never cross this boundary.
type DiningFields = Omit<
  IDining,
  | '_id'
  | 'createdAt'
  | 'updatedAt'
  | 'beverages'
  | 'minPeople'
  | 'isPopular'
  | 'isAvailable'
>;
type BeverageFields = NonNullable<IDining['beverages']>[number];

export interface DiningJson extends DiningFields {
  minPeople?: number;
  isPopular?: boolean;
  isAvailable?: boolean;
  _id: string;
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
  reservationVersion?: number;
  beverages?: (BeverageFields & { _id?: string })[];
}

export interface DiningJsonSource extends DiningFields {
  minPeople?: number;
  isPopular?: boolean;
  isAvailable?: boolean;
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
  reservationVersion?: number;
  beverages?: (BeverageFields & { _id?: Types.ObjectId })[];
}

function objectId(value: Types.ObjectId): string {
  if (!(value instanceof Types.ObjectId)) {
    throw new TypeError('Expected a MongoDB ObjectId');
  }
  return value.toHexString();
}

/** Preserve hydrated defaults, lean omissions and legacy nulls without mutation. */
export function serializeDining(item: DiningJsonSource): DiningJson {
  return {
    _id: objectId(item._id),
    name: item.name,
    description: item.description,
    type: item.type,
    mealType: item.mealType,
    price: item.price,
    servingTime:
      item.servingTime == null
        ? item.servingTime
        : {
            start: item.servingTime.start,
            end: item.servingTime.end,
          },
    maxPeople: item.maxPeople,
    minPeople: item.minPeople,
    category: item.category,
    subCategory: item.subCategory,
    image: item.image,
    gallery: item.gallery == null ? item.gallery : [...item.gallery],
    ingredients:
      item.ingredients == null ? item.ingredients : [...item.ingredients],
    allergens: item.allergens == null ? item.allergens : [...item.allergens],
    dietary: item.dietary == null ? item.dietary : [...item.dietary],
    beverages:
      item.beverages == null
        ? item.beverages
        : item.beverages.map(beverage => ({
            ...(beverage._id === undefined
              ? {}
              : { _id: objectId(beverage._id) }),
            name: beverage.name,
            description: beverage.description,
            price: beverage.price,
            alcoholContent: beverage.alcoholContent,
            category: beverage.category,
          })),
    includes: item.includes == null ? item.includes : [...item.includes],
    duration: item.duration,
    location: item.location,
    specialRequirements:
      item.specialRequirements == null
        ? item.specialRequirements
        : [...item.specialRequirements],
    isPopular: item.isPopular,
    isAvailable: item.isAvailable,
    seasonality: item.seasonality,
    tags: item.tags == null ? item.tags : [...item.tags],
    rating: item.rating,
    reviewCount: item.reviewCount,
    createdAt:
      item.createdAt == null ? item.createdAt : item.createdAt.toISOString(),
    updatedAt:
      item.updatedAt == null ? item.updatedAt : item.updatedAt.toISOString(),
    __v: item.__v,
    reservationVersion: item.reservationVersion,
  };
}

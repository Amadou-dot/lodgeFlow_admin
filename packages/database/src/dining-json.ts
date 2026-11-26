import { Types } from 'mongoose';
import type { IDining } from './models/Dining';

type DiningFields = Pick<
  IDining,
  | 'name'
  | 'description'
  | 'type'
  | 'mealType'
  | 'price'
  | 'servingTime'
  | 'maxPeople'
  | 'category'
  | 'image'
>;
type DietaryOption = NonNullable<IDining['dietary']>[number];
type BeverageFields = NonNullable<IDining['beverages']>[number];
type BeverageJson = Pick<BeverageFields, 'name' | 'category'> & {
  _id?: string;
  description?: string | null;
  price?: number | null;
  alcoholContent?: number | null;
};

// Legacy wire fields preserve nulls and lean reads can omit hydrated defaults.
export interface DiningJson extends DiningFields {
  _id: string;
  minPeople?: number | null;
  subCategory?: string | null;
  gallery?: (string | null)[] | null;
  ingredients?: (string | null)[] | null;
  allergens?: (string | null)[] | null;
  dietary?: (DietaryOption | null)[] | null;
  beverages?: BeverageJson[] | null;
  includes?: (string | null)[] | null;
  duration?: string | null;
  location?: string | null;
  specialRequirements?: (string | null)[] | null;
  isPopular?: boolean | null;
  isAvailable?: boolean | null;
  seasonality?: string | null;
  tags?: (string | null)[] | null;
  rating?: number | null;
  reviewCount?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  __v?: number | null;
  reservationVersion?: number;
}

export type DiningJsonSource = Omit<
  DiningJson,
  '_id' | 'createdAt' | 'updatedAt' | 'beverages'
> & {
  _id: Types.ObjectId;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  beverages?: (Omit<BeverageJson, '_id'> & { _id?: Types.ObjectId })[] | null;
};

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

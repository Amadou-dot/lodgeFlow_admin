import { Types } from 'mongoose';
import type { IExperience } from './models/Experience';

type ExperienceFields = Pick<
  IExperience,
  | 'name'
  | 'price'
  | 'duration'
  | 'difficulty'
  | 'category'
  | 'description'
  | 'image'
  | 'ctaText'
>;

// Legacy wire fields preserve nulls and lean reads can omit hydrated defaults.
export interface ExperienceJson extends ExperienceFields {
  _id: string;
  longDescription?: string | null;
  gallery?: (string | null)[] | null;
  includes?: (string | null)[] | null;
  available?: (string | null)[] | null;
  isPopular?: boolean | null;
  maxParticipants?: number | null;
  minAge?: number | null;
  requirements?: (string | null)[] | null;
  location?: string | null;
  highlights?: (string | null)[] | null;
  whatToBring?: (string | null)[] | null;
  cancellationPolicy?: string | null;
  seasonality?: string | null;
  tags?: (string | null)[] | null;
  rating?: number | null;
  reviewCount?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  __v?: number | null;
  reservationVersion?: number;
}

export type ExperienceJsonSource = Omit<
  ExperienceJson,
  '_id' | 'createdAt' | 'updatedAt'
> & {
  _id: Types.ObjectId;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

/** Preserve hydrated defaults, lean omissions and legacy nulls without mutation. */
export function serializeExperience(
  item: ExperienceJsonSource
): ExperienceJson {
  if (!(item._id instanceof Types.ObjectId))
    throw new TypeError('Expected a MongoDB ObjectId');
  return {
    _id: item._id.toHexString(),
    name: item.name,
    price: item.price,
    duration: item.duration,
    difficulty: item.difficulty,
    category: item.category,
    description: item.description,
    longDescription: item.longDescription,
    image: item.image,
    gallery: item.gallery == null ? item.gallery : [...item.gallery],
    includes: item.includes == null ? item.includes : [...item.includes],
    available: item.available == null ? item.available : [...item.available],
    ctaText: item.ctaText,
    isPopular: item.isPopular,
    maxParticipants: item.maxParticipants,
    minAge: item.minAge,
    requirements:
      item.requirements == null ? item.requirements : [...item.requirements],
    location: item.location,
    highlights:
      item.highlights == null ? item.highlights : [...item.highlights],
    whatToBring:
      item.whatToBring == null ? item.whatToBring : [...item.whatToBring],
    cancellationPolicy: item.cancellationPolicy,
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

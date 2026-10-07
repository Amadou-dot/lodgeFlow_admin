import { Types } from 'mongoose';
import type { IExperience } from './models/Experience';

type ExperienceFields = Omit<
  IExperience,
  '_id' | 'createdAt' | 'updatedAt' | 'includes' | 'available' | 'isPopular'
> & { includes?: string[]; available?: string[]; isPopular?: boolean };
export interface ExperienceJson extends ExperienceFields {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
  reservationVersion?: number;
}
export interface ExperienceJsonSource extends ExperienceFields {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
  reservationVersion?: number;
}

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

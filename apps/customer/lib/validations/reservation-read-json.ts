import { z } from 'zod';
import {
  diningJsonSchema,
  experienceJsonSchema,
} from '@lodgeflow/database/catalog-json-schema';
import {
  dining,
  experience,
  objectId,
} from '@lodgeflow/database/reservation-read-fields';
import { DINING_TYPES, MEAL_TYPES } from '@lodgeflow/database/config';
import { ownedDetail, type MutationTarget } from './mutation-response';
import { decodeSuccess, forDetailId } from './read-response';

const catalog = z.object({
  _id: objectId,
  name: z.string().min(1),
  image: z.string().min(1),
  price: z.number(),
  location: z.string().nullish(),
});
const diningHistory = dining.partial({ status: true, isPaid: true }).extend({
  dining: catalog
    .extend({
      type: z.enum(DINING_TYPES),
      mealType: z.enum(MEAL_TYPES),
      servingTime: z.object({
        start: z.string().min(1),
        end: z.string().min(1),
      }),
      maxPeople: z.number().optional(),
    })
    .nullable(),
});
const experienceHistory = experience
  .partial({ status: true, isPaid: true })
  .extend({
    experience: catalog
      .extend({ category: z.string().min(1), duration: z.string().min(1) })
      .nullable(),
  });
export const decodeDiningHistory = decodeSuccess(z.array(diningHistory));
export const decodeExperienceHistory = decodeSuccess(
  z.array(experienceHistory)
);
const diningDetail = dining.extend({
  id: objectId,
  dining: diningJsonSchema.nullable(),
});
const experienceDetail = experience.extend({
  id: objectId,
  experience: experienceJsonSchema.nullable(),
});
export const decodeDiningDetail = (id: string) => forDetailId(diningDetail, id);
export const decodeExperienceDetail = (id: string) =>
  forDetailId(experienceDetail, id);

type ReservationWriteTarget = Pick<MutationTarget, 'customerId'> &
  ({ listingId: string } | { id: string });
export function diningMutationResult(target: ReservationWriteTarget) {
  return ownedDetail(diningDetail, target)
    .refine(
      row =>
        !('listingId' in target) ||
        row.dining === null ||
        row.dining._id.toLowerCase() === target.listingId.toLowerCase()
    )
    .nullable();
}
export function experienceMutationResult(target: ReservationWriteTarget) {
  return ownedDetail(experienceDetail, target)
    .refine(
      row =>
        !('listingId' in target) ||
        row.experience === null ||
        row.experience._id.toLowerCase() === target.listingId.toLowerCase()
    )
    .nullable();
}

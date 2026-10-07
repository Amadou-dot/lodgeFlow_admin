import type { Dining, Experience } from '@/types';
import type { UpdateDiningInput } from '@/lib/validations/dining';
import type { UpdateExperienceInput } from '@/lib/validations/experience';

export function diningEditableFields(
  item: Partial<Dining>
): Omit<UpdateDiningInput, '_id'> {
  return {
    name: item.name,
    description: item.description,
    type: item.type,
    mealType: item.mealType,
    price: item.price,
    servingTime:
      item.servingTime == null
        ? item.servingTime
        : { start: item.servingTime.start, end: item.servingTime.end },
    maxPeople: item.maxPeople,
    minPeople: item.minPeople,
    category: item.category,
    subCategory: item.subCategory,
    image: item.image,
    gallery: item.gallery,
    ingredients: item.ingredients,
    allergens: item.allergens,
    dietary: item.dietary,
    includes: item.includes,
    duration: item.duration,
    location: item.location,
    specialRequirements: item.specialRequirements,
    isPopular: item.isPopular,
    isAvailable: item.isAvailable,
    seasonality: item.seasonality,
    tags: item.tags,
    rating: item.rating,
    reviewCount: item.reviewCount,
    beverages:
      item.beverages == null
        ? item.beverages
        : item.beverages.map(row => ({
            name: row.name,
            description: row.description,
            price: row.price,
            alcoholContent: row.alcoholContent,
            category: row.category,
          })),
  };
}

export function experienceEditableFields(
  item: Partial<Experience>
): Omit<UpdateExperienceInput, '_id'> {
  return {
    name: item.name,
    price: item.price,
    duration: item.duration,
    difficulty: item.difficulty,
    category: item.category,
    description: item.description,
    longDescription: item.longDescription,
    image: item.image,
    gallery: item.gallery,
    includes: item.includes,
    available: item.available,
    ctaText: item.ctaText,
    isPopular: item.isPopular,
    maxParticipants: item.maxParticipants,
    minAge: item.minAge,
    requirements: item.requirements,
    location: item.location,
    highlights: item.highlights,
    whatToBring: item.whatToBring,
    cancellationPolicy: item.cancellationPolicy,
    seasonality: item.seasonality,
    tags: item.tags,
    rating: item.rating,
    reviewCount: item.reviewCount,
  };
}

import type { Dining, Experience } from '@/types';
import type { UpdateDiningInput } from '@/lib/validations/dining';
import type { UpdateExperienceInput } from '@/lib/validations/experience';

// A partial update can leave legacy nulls in place by omitting that field.
function editableArray<T>(values: (T | null)[] | null | undefined) {
  return values?.every(value => value !== null) ? values : undefined;
}

function editableBeverages(beverages: Dining['beverages']) {
  if (
    !beverages ||
    beverages.some(
      row =>
        row.description === null ||
        row.price === null ||
        row.alcoholContent === null
    )
  )
    return undefined;

  return beverages.map(row => ({
    name: row.name,
    description: row.description ?? undefined,
    price: row.price ?? undefined,
    alcoholContent: row.alcoholContent ?? undefined,
    category: row.category,
  }));
}

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
    minPeople: item.minPeople ?? undefined,
    category: item.category,
    subCategory: item.subCategory ?? undefined,
    image: item.image,
    gallery: editableArray(item.gallery),
    ingredients: editableArray(item.ingredients),
    allergens: editableArray(item.allergens),
    dietary: editableArray(item.dietary),
    includes: editableArray(item.includes),
    duration: item.duration ?? undefined,
    location: item.location ?? undefined,
    specialRequirements: editableArray(item.specialRequirements),
    isPopular: item.isPopular ?? undefined,
    isAvailable: item.isAvailable ?? undefined,
    seasonality: item.seasonality ?? undefined,
    tags: editableArray(item.tags),
    rating: item.rating ?? undefined,
    reviewCount: item.reviewCount ?? undefined,
    beverages: editableBeverages(item.beverages),
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
    longDescription: item.longDescription ?? undefined,
    image: item.image,
    gallery: editableArray(item.gallery),
    includes: editableArray(item.includes),
    available: editableArray(item.available),
    ctaText: item.ctaText,
    isPopular: item.isPopular ?? undefined,
    maxParticipants: item.maxParticipants ?? undefined,
    minAge: item.minAge ?? undefined,
    requirements: editableArray(item.requirements),
    location: item.location ?? undefined,
    highlights: editableArray(item.highlights),
    whatToBring: editableArray(item.whatToBring),
    cancellationPolicy: item.cancellationPolicy ?? undefined,
    seasonality: item.seasonality ?? undefined,
    tags: editableArray(item.tags),
    rating: item.rating ?? undefined,
    reviewCount: item.reviewCount ?? undefined,
  };
}

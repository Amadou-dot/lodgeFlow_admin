import { Dining } from '@/types';
import { useEffect, useState } from 'react';
import {
  DiningBasicInfo,
  DiningExperienceDetails,
  DiningFormActions,
  DiningImageSection,
  DiningIngredientsManager,
  DiningServingDetails,
  DiningSettingsToggles,
  DiningTagsManager,
} from './DiningForm/';

interface DiningFormProps {
  dining?: Partial<Dining>;
  onSubmit: (data: Partial<Dining>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const DiningForm = ({
  dining,
  onSubmit,
  onCancel,
  isLoading = false,
}: DiningFormProps) => {
  const [formData, setFormData] = useState<Partial<Dining>>({
    name: '',
    description: '',
    type: 'menu',
    mealType: 'lunch',
    price: 0,
    servingTime: { start: '09:00', end: '17:00' },
    maxPeople: 1,
    minPeople: 1,
    category: 'regular',
    subCategory: '',
    image: '',
    gallery: [],
    ingredients: [],
    allergens: [],
    dietary: [],
    beverages: [],
    includes: [],
    duration: '',
    location: '',
    specialRequirements: [],
    isPopular: false,
    isAvailable: true,
    seasonality: '',
    tags: [],
    ...dining,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (dining) {
      setFormData({ ...formData, ...dining });
    }
  }, [dining]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.description?.trim()) {
      newErrors.description = 'Description is required';
    }
    if (!formData.price || formData.price <= 0) {
      newErrors.price = 'Price must be greater than 0';
    }
    if (!formData.image?.trim()) {
      newErrors.image = 'Image URL is required';
    }
    if (!formData.servingTime?.start || !formData.servingTime?.end) {
      newErrors.servingTime = 'Serving time is required';
    }
    if (!formData.maxPeople || formData.maxPeople <= 0) {
      newErrors.maxPeople = 'Max people must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    await onSubmit(formData);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className='space-y-6 max-h-[80vh] overflow-y-auto'
    >
      <DiningBasicInfo
        formData={formData}
        onFormDataChange={setFormData}
        errors={errors}
      />

      <DiningServingDetails
        formData={formData}
        onFormDataChange={setFormData}
        errors={errors}
      />

      <DiningImageSection
        formData={formData}
        onFormDataChange={setFormData}
        errors={errors}
      />

      <DiningExperienceDetails
        formData={formData}
        onFormDataChange={setFormData}
      />

      <DiningTagsManager formData={formData} onFormDataChange={setFormData} />

      <DiningIngredientsManager
        formData={formData}
        onFormDataChange={setFormData}
      />

      <DiningSettingsToggles
        formData={formData}
        onFormDataChange={setFormData}
      />

      <DiningFormActions
        dining={dining}
        onCancel={onCancel}
        isLoading={isLoading}
      />
    </form>
  );
};

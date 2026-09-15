import { Experience } from '@/types';

export interface EditExperienceFormProps {
  experience: Experience;
  onSave: (updatedExperience: Experience) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export interface ExperienceSectionProps {
  editedItem: Experience;
  onInputChange: (
    field: keyof Experience,
    value: Experience[keyof Experience]
  ) => void;
}

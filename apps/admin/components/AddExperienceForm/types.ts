export interface FormData {
  name: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  price: number;
  capacity: number;
  location: string;
  difficulty?: string;
  includes?: string; // Comma-separated includes
  requirements?: string; // Comma-separated requirements
  imageUrl?: string;
  imageGallery?: string; // Comma-separated image URLs
  tags?: string; // Comma-separated tags
  seasonalAvailability?: string[] | string; // Seasonal availability
  shortDescription?: string;
  longDescription?: string;
  highlights?: string;
  whatToBring?: string; // Comma-separated what to bring
  availableTimes?: string; // Comma-separated available times. Ex: Weekends, Weekdays, Mornings, Afternoons
  callToAction?: string;
  cancellationPolicy?: string;
  maxParticipants?: number;
  minimumAge?: number;
  isPopular?: boolean;
  rating?: number;
  reviewCount?: number;
  availability?: {
    days: string[];
    times: string[];
  };
  image?: string;
  featured?: boolean;
  active?: boolean;
  [key: string]: unknown;
}

export interface FormProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}

export interface AddExperienceSectionProps {
  formData: FormData;
  onInputChange: (name: string, value: unknown) => void;
}

import { Dining } from '@/types';
import { Input } from '@heroui/input';

interface DiningImageSectionProps {
  formData: Partial<Dining>;
  onFormDataChange: (data: Partial<Dining>) => void;
  errors: Record<string, string>;
}

export default function DiningImageSection({
  formData,
  onFormDataChange,
  errors,
}: DiningImageSectionProps) {
  return (
    <Input
      label='Image URL'
      placeholder='https://example.com/image.jpg'
      value={formData.image || ''}
      onChange={e => onFormDataChange({ ...formData, image: e.target.value })}
      isRequired
      errorMessage={errors.image}
      isInvalid={!!errors.image}
    />
  );
}

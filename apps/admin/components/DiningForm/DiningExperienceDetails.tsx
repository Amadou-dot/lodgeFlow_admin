import { Dining } from '@/types';
import { Input } from '@heroui/input';

interface DiningExperienceDetailsProps {
  formData: Partial<Dining>;
  onFormDataChange: (data: Partial<Dining>) => void;
}

export default function DiningExperienceDetails({
  formData,
  onFormDataChange,
}: DiningExperienceDetailsProps) {
  if (formData.type !== 'experience') {
    return null;
  }

  return (
    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
      <Input
        label='Duration'
        placeholder='e.g., 2 hours'
        value={formData.duration || ''}
        onChange={e =>
          onFormDataChange({ ...formData, duration: e.target.value })
        }
      />

      <Input
        label='Location'
        placeholder='e.g., Main Dining Room'
        value={formData.location || ''}
        onChange={e =>
          onFormDataChange({ ...formData, location: e.target.value })
        }
      />
    </div>
  );
}

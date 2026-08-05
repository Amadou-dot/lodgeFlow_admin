import { Dining } from '@/types';
import { Switch } from '@heroui/switch';

interface DiningSettingsTogglesProps {
  formData: Partial<Dining>;
  onFormDataChange: (data: Partial<Dining>) => void;
}

export default function DiningSettingsToggles({
  formData,
  onFormDataChange,
}: DiningSettingsTogglesProps) {
  return (
    <div className='flex justify-between items-center'>
      <div className='flex gap-4'>
        <Switch
          isSelected={formData.isPopular}
          onValueChange={checked =>
            onFormDataChange({ ...formData, isPopular: checked })
          }
        >
          Popular Item
        </Switch>

        <Switch
          isSelected={formData.isAvailable}
          onValueChange={checked =>
            onFormDataChange({ ...formData, isAvailable: checked })
          }
        >
          Available
        </Switch>
      </div>
    </div>
  );
}

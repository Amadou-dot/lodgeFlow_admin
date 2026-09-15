import { Textarea } from '@heroui/input';
import { Select, SelectItem } from '@heroui/select';
import type { FormData } from './types';

interface PreferencesSectionProps {
  formData: FormData;
  onInputChange: (field: string, value: string) => void;
}

export default function PreferencesSection({
  formData,
  onInputChange,
}: PreferencesSectionProps) {
  return (
    <div className='space-y-4 w-full'>
      <h3 className='text-lg font-semibold'>Preferences</h3>
      <div className='space-y-4'>
        <Select
          label='Smoking Preference'
          placeholder='Select smoking preference'
          selectedKeys={[formData.preferences.smokingPreference]}
          onSelectionChange={keys => {
            const selected = Array.from(keys)[0] as string;
            onInputChange(
              'preferences.smokingPreference',
              selected || 'no-preference'
            );
          }}
        >
          <SelectItem key='smoking'>Smoking</SelectItem>
          <SelectItem key='non-smoking'>Non-smoking</SelectItem>
          <SelectItem key='no-preference'>No Preference</SelectItem>
        </Select>
        <Textarea
          label='Dietary Restrictions'
          placeholder='Enter dietary restrictions (comma-separated)'
          value={formData.preferences.dietaryRestrictions}
          onValueChange={(value: string) =>
            onInputChange('preferences.dietaryRestrictions', value)
          }
          minRows={2}
        />
        <Textarea
          label='Accessibility Needs'
          placeholder='Enter accessibility needs (comma-separated)'
          value={formData.preferences.accessibilityNeeds}
          onValueChange={(value: string) =>
            onInputChange('preferences.accessibilityNeeds', value)
          }
          minRows={2}
        />
      </div>
    </div>
  );
}

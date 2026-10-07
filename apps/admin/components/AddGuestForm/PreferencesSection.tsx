import { Textarea } from '@heroui/input';
import { Select, SelectItem } from '@heroui/select';
import type { FormData, GuestInputChange } from './types';

interface PreferencesSectionProps {
  formData: FormData;
  onInputChange: GuestInputChange;
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
            const selected = Array.from(keys)[0];
            const value =
              selected === 'smoking' || selected === 'non-smoking'
                ? selected
                : 'no-preference';
            onInputChange({
              section: 'preferences',
              field: 'smokingPreference',
              value: value,
            });
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
            onInputChange({
              section: 'preferences',
              field: 'dietaryRestrictions',
              value: value,
            })
          }
          minRows={2}
        />
        <Textarea
          label='Accessibility Needs'
          placeholder='Enter accessibility needs (comma-separated)'
          value={formData.preferences.accessibilityNeeds}
          onValueChange={(value: string) =>
            onInputChange({
              section: 'preferences',
              field: 'accessibilityNeeds',
              value: value,
            })
          }
          minRows={2}
        />
      </div>
    </div>
  );
}

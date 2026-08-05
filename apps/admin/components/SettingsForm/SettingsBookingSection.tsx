import type { AppSettings } from '@/types';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Chip } from '@heroui/chip';
import { Input } from '@heroui/input';
import { Select, SelectItem } from '@heroui/select';
import type { SharedSelection } from '@heroui/system';

interface SettingsBookingSectionProps {
  formData: Partial<AppSettings>;
  onInputChange: (
    field: keyof AppSettings,
    value: AppSettings[keyof AppSettings]
  ) => void;
}

export default function SettingsBookingSection({
  formData,
  onInputChange,
}: SettingsBookingSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className='flex items-center gap-2'>
          <h3 className='text-lg font-semibold'>Booking Settings</h3>
          <Chip size='sm' color='primary' variant='flat'>
            Core
          </Chip>
        </div>
      </CardHeader>
      <CardBody className='space-y-4'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <Input
            label='Minimum Booking Length'
            type='number'
            value={formData.minBookingLength?.toString() || ''}
            onChange={e =>
              onInputChange('minBookingLength', parseInt(e.target.value) || 1)
            }
            endContent='nights'
            min='1'
            max='30'
          />
          <Input
            label='Maximum Booking Length'
            type='number'
            value={formData.maxBookingLength?.toString() || ''}
            onChange={e =>
              onInputChange('maxBookingLength', parseInt(e.target.value) || 1)
            }
            endContent='nights'
            min='1'
            max='365'
          />
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <Input
            label='Maximum Guests Per Booking'
            type='number'
            value={formData.maxGuestsPerBooking?.toString() || ''}
            onChange={e =>
              onInputChange(
                'maxGuestsPerBooking',
                parseInt(e.target.value) || 1
              )
            }
            endContent='guests'
            min='1'
            max='20'
          />
          <Select
            label='Cancellation Policy'
            selectedKeys={
              formData.cancellationPolicy ? [formData.cancellationPolicy] : []
            }
            onSelectionChange={(keys: SharedSelection) => {
              const value = Array.from(keys)[0] as string;
              onInputChange('cancellationPolicy', value);
            }}
          >
            <SelectItem key='flexible'>Flexible</SelectItem>
            <SelectItem key='moderate'>Moderate</SelectItem>
            <SelectItem key='strict'>Strict</SelectItem>
          </Select>
        </div>
      </CardBody>
    </Card>
  );
}

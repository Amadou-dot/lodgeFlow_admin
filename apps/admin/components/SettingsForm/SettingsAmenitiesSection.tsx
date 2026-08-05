import type { AppSettings } from '@/types';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Chip } from '@heroui/chip';
import { Divider } from '@heroui/divider';
import { Input } from '@heroui/input';
import { Switch } from '@heroui/switch';

interface SettingsAmenitiesSectionProps {
  formData: Partial<AppSettings>;
  onInputChange: (
    field: keyof AppSettings,
    value: AppSettings[keyof AppSettings]
  ) => void;
}

export default function SettingsAmenitiesSection({
  formData,
  onInputChange,
}: SettingsAmenitiesSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className='flex items-center gap-2'>
          <h3 className='text-lg font-semibold'>Amenities & Policies</h3>
          <Chip size='sm' color='warning' variant='flat'>
            Policies
          </Chip>
        </div>
      </CardHeader>
      <CardBody className='space-y-4'>
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='font-medium'>WiFi Included</p>
              <p className='text-sm text-default-600'>
                Free WiFi for all guests
              </p>
            </div>
            <Switch
              isSelected={formData.wifiIncluded || false}
              onValueChange={value => onInputChange('wifiIncluded', value)}
            />
          </div>

          <div className='flex items-center justify-between'>
            <div>
              <p className='font-medium'>Parking Included</p>
              <p className='text-sm text-default-600'>
                Free parking for guests
              </p>
            </div>
            <Switch
              isSelected={formData.parkingIncluded || false}
              onValueChange={value => onInputChange('parkingIncluded', value)}
            />
          </div>

          {!formData.parkingIncluded && (
            <Input
              label='Parking Fee'
              type='number'
              value={formData.parkingFee?.toString() || ''}
              onChange={e =>
                onInputChange('parkingFee', parseInt(e.target.value) || 0)
              }
              startContent='$'
              endContent='per night'
              min='0'
            />
          )}

          <Divider />

          <div className='flex items-center justify-between'>
            <div>
              <p className='font-medium'>Allow Pets</p>
              <p className='text-sm text-default-600'>
                Pets are welcome (fee may apply)
              </p>
            </div>
            <Switch
              isSelected={formData.allowPets || false}
              onValueChange={value => onInputChange('allowPets', value)}
            />
          </div>

          <div className='flex items-center justify-between'>
            <div>
              <p className='font-medium'>Smoking Allowed</p>
              <p className='text-sm text-default-600'>
                Allow smoking in designated areas
              </p>
            </div>
            <Switch
              isSelected={formData.smokingAllowed || false}
              onValueChange={value => onInputChange('smokingAllowed', value)}
            />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

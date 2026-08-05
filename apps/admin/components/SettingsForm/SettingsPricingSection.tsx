import type { AppSettings } from '@/types';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Chip } from '@heroui/chip';
import { Divider } from '@heroui/divider';
import { Input } from '@heroui/input';
import { Switch } from '@heroui/switch';

interface SettingsPricingSectionProps {
  formData: Partial<AppSettings>;
  onInputChange: (
    field: keyof AppSettings,
    value: AppSettings[keyof AppSettings]
  ) => void;
}

export default function SettingsPricingSection({
  formData,
  onInputChange,
}: SettingsPricingSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className='flex items-center gap-2'>
          <h3 className='text-lg font-semibold'>Pricing & Deposits</h3>
          <Chip size='sm' color='success' variant='flat'>
            Financial
          </Chip>
        </div>
      </CardHeader>
      <CardBody className='space-y-4'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <Input
            label='Breakfast Price'
            type='number'
            value={formData.breakfastPrice?.toString() || ''}
            onChange={e =>
              onInputChange('breakfastPrice', parseInt(e.target.value) || 0)
            }
            startContent='$'
            endContent='per person'
            min='0'
          />
          <Input
            label='Pet Fee'
            type='number'
            value={formData.petFee?.toString() || ''}
            onChange={e =>
              onInputChange('petFee', parseInt(e.target.value) || 0)
            }
            startContent='$'
            endContent='per night'
            min='0'
          />
        </div>

        <Divider />

        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='font-medium'>Require Deposit</p>
              <p className='text-sm text-default-600'>
                Require guests to pay a deposit when booking
              </p>
            </div>
            <Switch
              isSelected={formData.requireDeposit || false}
              onValueChange={value => onInputChange('requireDeposit', value)}
            />
          </div>

          {formData.requireDeposit && (
            <Input
              label='Deposit Percentage'
              type='number'
              value={formData.depositPercentage?.toString() || ''}
              onChange={e =>
                onInputChange(
                  'depositPercentage',
                  parseInt(e.target.value) || 0
                )
              }
              endContent='%'
              min='0'
              max='100'
            />
          )}
        </div>
      </CardBody>
    </Card>
  );
}

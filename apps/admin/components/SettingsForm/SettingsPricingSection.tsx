import { Card, CardBody, CardHeader } from '@heroui/card';
import { Chip } from '@heroui/chip';
import { Divider } from '@heroui/divider';
import { Input } from '@heroui/input';
import { Switch } from '@heroui/switch';
import type { SettingsSectionProps } from './types';

export default function SettingsPricingSection({
  formData,
  onInputChange,
}: SettingsSectionProps) {
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
            step='any'
            value={formData.breakfastPrice?.toString() || ''}
            onChange={e =>
              onInputChange({
                field: 'breakfastPrice',
                value: e.target.valueAsNumber || 0,
              })
            }
            startContent='$'
            endContent='per person'
            min='0'
          />
          <Input
            label='Pet Fee'
            type='number'
            step='any'
            value={formData.petFee?.toString() || ''}
            onChange={e =>
              onInputChange({
                field: 'petFee',
                value: e.target.valueAsNumber || 0,
              })
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
              onValueChange={value =>
                onInputChange({ field: 'requireDeposit', value })
              }
            />
          </div>

          {formData.requireDeposit && (
            <Input
              label='Deposit Percentage'
              type='number'
              step='any'
              value={formData.depositPercentage?.toString() || ''}
              onChange={e =>
                onInputChange({
                  field: 'depositPercentage',
                  value: e.target.valueAsNumber || 0,
                })
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

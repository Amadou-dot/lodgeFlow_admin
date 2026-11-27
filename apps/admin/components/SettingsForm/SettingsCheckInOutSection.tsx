import { Card, CardBody, CardHeader } from '@heroui/card';
import { Chip } from '@heroui/chip';
import { Input } from '@heroui/input';
import type { SettingsSectionProps } from './types';

export default function SettingsCheckInOutSection({
  formData,
  onInputChange,
}: SettingsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className='flex items-center gap-2'>
          <h3 className='text-lg font-semibold'>Check-in & Check-out</h3>
          <Chip size='sm' color='secondary' variant='flat'>
            Operations
          </Chip>
        </div>
      </CardHeader>
      <CardBody className='space-y-4'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <Input
            label='Check-in Time'
            type='time'
            value={formData.checkInTime || ''}
            onChange={e =>
              onInputChange({ field: 'checkInTime', value: e.target.value })
            }
          />
          <Input
            label='Check-out Time'
            type='time'
            value={formData.checkOutTime || ''}
            onChange={e =>
              onInputChange({ field: 'checkOutTime', value: e.target.value })
            }
          />
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <Input
            label='Early Check-in Fee'
            type='number'
            step='any'
            value={formData.earlyCheckInFee?.toString() || ''}
            onChange={e =>
              onInputChange({
                field: 'earlyCheckInFee',
                value: e.target.valueAsNumber || 0,
              })
            }
            startContent='$'
            min='0'
          />
          <Input
            label='Late Check-out Fee'
            type='number'
            step='any'
            value={formData.lateCheckOutFee?.toString() || ''}
            onChange={e =>
              onInputChange({
                field: 'lateCheckOutFee',
                value: e.target.valueAsNumber || 0,
              })
            }
            startContent='$'
            min='0'
          />
        </div>
      </CardBody>
    </Card>
  );
}

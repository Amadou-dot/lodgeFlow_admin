import type { AppSettings } from '@/types';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Chip } from '@heroui/chip';
import { Input } from '@heroui/input';

interface SettingsCheckInOutSectionProps {
  formData: Partial<AppSettings>;
  onInputChange: (
    field: keyof AppSettings,
    value: AppSettings[keyof AppSettings]
  ) => void;
}

export default function SettingsCheckInOutSection({
  formData,
  onInputChange,
}: SettingsCheckInOutSectionProps) {
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
            onChange={e => onInputChange('checkInTime', e.target.value)}
          />
          <Input
            label='Check-out Time'
            type='time'
            value={formData.checkOutTime || ''}
            onChange={e => onInputChange('checkOutTime', e.target.value)}
          />
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <Input
            label='Early Check-in Fee'
            type='number'
            value={formData.earlyCheckInFee?.toString() || ''}
            onChange={e =>
              onInputChange('earlyCheckInFee', parseInt(e.target.value) || 0)
            }
            startContent='$'
            min='0'
          />
          <Input
            label='Late Check-out Fee'
            type='number'
            value={formData.lateCheckOutFee?.toString() || ''}
            onChange={e =>
              onInputChange('lateCheckOutFee', parseInt(e.target.value) || 0)
            }
            startContent='$'
            min='0'
          />
        </div>
      </CardBody>
    </Card>
  );
}

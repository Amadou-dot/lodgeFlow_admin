import { Button } from '@heroui/button';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Input } from '@heroui/input';
import { BookingFormFieldProps } from './types';

interface SpecialRequestsProps extends BookingFormFieldProps {
  specialRequestInput: string;
  onSpecialRequestInputChange: (value: string) => void;
  onAddSpecialRequest: () => void;
  onRemoveSpecialRequest: (index: number) => void;
}

export default function SpecialRequests({
  formData,
  onInputChange,
  specialRequestInput,
  onSpecialRequestInputChange,
  onAddSpecialRequest,
  onRemoveSpecialRequest,
}: SpecialRequestsProps) {
  return (
    <Card>
      <CardHeader>
        <h3 className='text-lg font-semibold'>Special Requests</h3>
      </CardHeader>
      <CardBody className='space-y-4'>
        <div className='flex gap-2'>
          <Input
            placeholder='Add a special request'
            value={specialRequestInput}
            onChange={e => onSpecialRequestInputChange(e.target.value)}
            className='flex-1'
          />
          <Button
            onPress={onAddSpecialRequest}
            variant='bordered'
            type='button'
          >
            Add
          </Button>
        </div>

        {formData.specialRequests.length > 0 && (
          <div className='space-y-2'>
            {formData.specialRequests.map((request, index) => (
              <div
                key={index}
                className='flex items-center justify-between bg-default-100 p-2 rounded'
              >
                <span>{request}</span>
                <Button
                  size='sm'
                  color='danger'
                  variant='light'
                  onPress={() => onRemoveSpecialRequest(index)}
                  type='button'
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}

        <Input
          label='Observations'
          placeholder='Any additional notes or observations for staff'
          value={formData.observations}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onInputChange('observations', e.target.value)
          }
        />
      </CardBody>
    </Card>
  );
}

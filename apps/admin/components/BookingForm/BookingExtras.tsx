import type { Settings } from '@/types';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Switch } from '@heroui/switch';
import { BookingFormFieldProps } from './types';

interface BookingExtrasProps extends BookingFormFieldProps {
  settings?: Settings;
  formatCurrency: (amount: number) => string;
}

export default function BookingExtras({
  formData,
  onInputChange,
  settings,
  formatCurrency,
}: BookingExtrasProps) {
  return (
    <Card>
      <CardHeader>
        <h3 className='text-lg font-semibold'>Extras & Services</h3>
      </CardHeader>
      <CardBody className='space-y-4'>
        <div className='flex flex-col gap-4'>
          <Switch
            isSelected={formData.hasBreakfast}
            onValueChange={checked => onInputChange('hasBreakfast', checked)}
          >
            Include Breakfast ({formatCurrency(settings?.breakfastPrice || 0)}
            /person/night)
          </Switch>

          {settings?.allowPets && (
            <Switch
              isSelected={formData.hasPets}
              onValueChange={checked => onInputChange('hasPets', checked)}
            >
              Pets ({formatCurrency(settings.petFee)}/night)
            </Switch>
          )}

          {!settings?.parkingIncluded && (
            <Switch
              isSelected={formData.hasParking}
              onValueChange={checked => onInputChange('hasParking', checked)}
            >
              Parking ({formatCurrency(settings?.parkingFee || 0)}/night)
            </Switch>
          )}

          <Switch
            isSelected={formData.hasEarlyCheckIn}
            onValueChange={checked => onInputChange('hasEarlyCheckIn', checked)}
          >
            Early Check-in ({formatCurrency(settings?.earlyCheckInFee || 0)})
          </Switch>

          <Switch
            isSelected={formData.hasLateCheckOut}
            onValueChange={checked => onInputChange('hasLateCheckOut', checked)}
          >
            Late Check-out ({formatCurrency(settings?.lateCheckOutFee || 0)})
          </Switch>
        </div>
      </CardBody>
    </Card>
  );
}

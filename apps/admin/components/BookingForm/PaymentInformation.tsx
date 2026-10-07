import { Card, CardBody, CardHeader } from '@heroui/card';
import { Select, SelectItem } from '@heroui/select';
import { BookingFormFieldProps, PriceBreakdown } from './types';
import type { Settings } from '@/types';
import type { SharedSelection } from '@heroui/system';

interface PaymentInformationProps extends BookingFormFieldProps {
  settings?: Pick<Settings, 'requireDeposit' | 'currency'>;
  priceBreakdown: PriceBreakdown;
}

export default function PaymentInformation({
  formData,
  onInputChange,
  settings,
  priceBreakdown,
}: PaymentInformationProps) {
  return (
    <Card>
      <CardHeader>
        <h3 className='text-lg font-semibold'>Payment Information</h3>
      </CardHeader>
      <CardBody className='space-y-4'>
        <Select
          label='Payment Method'
          placeholder='Select payment method'
          selectedKeys={formData.paymentMethod ? [formData.paymentMethod] : []}
          onSelectionChange={(keys: SharedSelection) => {
            const selected = Array.from(keys)[0];
            if (
              selected === 'cash' ||
              selected === 'card' ||
              selected === 'bank-transfer' ||
              selected === 'online'
            ) {
              onInputChange('paymentMethod', selected);
            } else if (selected === undefined) {
              onInputChange('paymentMethod', '');
            }
          }}
        >
          <SelectItem key='cash'>Cash</SelectItem>
          <SelectItem key='card'>Card</SelectItem>
          <SelectItem key='bank-transfer'>Bank Transfer</SelectItem>
          <SelectItem key='online'>Online</SelectItem>
        </Select>

        {settings?.requireDeposit && (
          <p>
            Required deposit:{' '}
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: settings.currency,
            }).format(priceBreakdown.depositAmount)}
          </p>
        )}
        <p className='text-sm text-default-500'>
          Save the reservation, then use Record Payment to record money
          received.
        </p>
      </CardBody>
    </Card>
  );
}

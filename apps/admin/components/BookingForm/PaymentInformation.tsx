import { Card, CardBody, CardHeader } from '@heroui/card';
import { Select, SelectItem } from '@heroui/select';
import { Switch } from '@heroui/switch';
import { BookingFormFieldProps, PriceBreakdown } from './types';
import type { ISettings } from '@/models/Settings';
import type { SharedSelection } from '@heroui/system';

interface PaymentInformationProps extends BookingFormFieldProps {
  settings?: ISettings | null;
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
          onSelectionChange={(keys: SharedSelection) =>
            onInputChange('paymentMethod', Array.from(keys)[0] as string)
          }
        >
          <SelectItem key='cash'>Cash</SelectItem>
          <SelectItem key='card'>Card</SelectItem>
          <SelectItem key='bank-transfer'>Bank Transfer</SelectItem>
          <SelectItem key='online'>Online</SelectItem>
        </Select>

        <Switch
          isSelected={formData.isPaid}
          onValueChange={checked => onInputChange('isPaid', checked)}
        >
          Mark as Paid
        </Switch>

        {settings?.requireDeposit && (
          <Switch
            isSelected={formData.depositPaid}
            onValueChange={checked => onInputChange('depositPaid', checked)}
          >
            Deposit Paid (
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
            }).format(priceBreakdown.depositAmount)}
            )
          </Switch>
        )}
      </CardBody>
    </Card>
  );
}

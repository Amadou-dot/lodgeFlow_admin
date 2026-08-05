import { Input } from '@heroui/input';
import type { FormData } from './types';

interface AddressSectionProps {
  formData: FormData;
  onInputChange: (field: string, value: string) => void;
}

export default function AddressSection({
  formData,
  onInputChange,
}: AddressSectionProps) {
  return (
    <div className='space-y-4 w-full'>
      <h3 className='text-lg font-semibold'>Address</h3>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <Input
          label='Street Address'
          placeholder='Enter street address'
          value={formData.address.street}
          onValueChange={value => onInputChange('address.street', value)}
          className='md:col-span-2'
        />
        <Input
          label='City'
          placeholder='Enter city'
          value={formData.address.city}
          onValueChange={value => onInputChange('address.city', value)}
        />
        <Input
          label='State/Province'
          placeholder='Enter state/province'
          value={formData.address.state}
          onValueChange={value => onInputChange('address.state', value)}
        />
        <Input
          label='Country'
          placeholder='Enter country'
          value={formData.address.country}
          onValueChange={value => onInputChange('address.country', value)}
        />
        <Input
          label='ZIP/Postal Code'
          placeholder='Enter ZIP code'
          value={formData.address.zipCode}
          onValueChange={value => onInputChange('address.zipCode', value)}
        />
      </div>
    </div>
  );
}

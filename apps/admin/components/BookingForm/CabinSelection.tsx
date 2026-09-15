import type { Cabin } from '@/types';
import { Autocomplete, AutocompleteItem } from '@heroui/autocomplete';
import { Avatar } from '@heroui/avatar';
import { BookingFormFieldProps } from './types';

interface CabinSelectionProps extends BookingFormFieldProps {
  cabins: Cabin[];
  formatCurrency: (amount: number) => string;
}

export default function CabinSelection({
  formData,
  onInputChange,
  cabins,
  formatCurrency,
}: CabinSelectionProps) {
  return (
    <Autocomplete
      label='Select Cabin'
      placeholder='Search and choose a cabin'
      selectedKey={formData.cabin || ''}
      onSelectionChange={key => onInputChange('cabin', key as string)}
      isRequired
      defaultItems={cabins || []}
      variant='bordered'
      classNames={{
        listbox: 'max-h-[200px]',
        listboxWrapper: 'max-h-[200px]',
      }}
    >
      {cabin => (
        <AutocompleteItem
          key={cabin._id.toString()}
          textValue={cabin.name}
          classNames={{
            base: 'py-2',
            title: 'text-small font-medium',
            description: 'text-tiny text-default-400',
          }}
        >
          <div className='flex gap-3 items-center py-1'>
            <Avatar
              alt={cabin.name}
              className='shrink-0'
              size='sm'
              src={cabin.image}
              name={cabin.name.substring(0, 2).toUpperCase()}
            />
            <div className='flex flex-col gap-0.5 min-w-0 flex-1'>
              <span className='text-small font-medium truncate'>
                {cabin.name}
              </span>
              <span className='text-tiny text-default-400 truncate'>
                {formatCurrency(cabin.price)}/night • Capacity: {cabin.capacity}
                {cabin.discount > 0 &&
                  ` • ${formatCurrency(cabin.discount)} discount`}
              </span>
            </div>
          </div>
        </AutocompleteItem>
      )}
    </Autocomplete>
  );
}

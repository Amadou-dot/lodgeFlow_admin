import type { Customer } from '@/types';
import { Autocomplete, AutocompleteItem } from '@heroui/autocomplete';
import { Avatar } from '@heroui/avatar';
import { BookingFormFieldProps } from './types';

interface CustomerSelectionProps extends BookingFormFieldProps {
  customers: Customer[];
  customersLoading: boolean;
  scrollerRef?: React.RefObject<HTMLElement>;
  onOpenChange?: (isOpen: boolean) => void;
  onSearchChange?: (search: string) => void;
}

export default function CustomerSelection({
  formData,
  onInputChange,
  customers,
  customersLoading,
  scrollerRef,
  onOpenChange,
  onSearchChange,
}: CustomerSelectionProps) {
  return (
    <Autocomplete
      isVirtualized={false}
      label='Select Customer'
      placeholder='Search and choose a customer'
      selectedKey={formData.customer || ''}
      onSelectionChange={key => onInputChange('customer', key as string)}
      isRequired
      defaultItems={customers || []}
      variant='bordered'
      isLoading={customersLoading}
      onInputChange={onSearchChange}
      allowsCustomValue={false}
      {...(scrollerRef && { scrollRef: scrollerRef })}
      {...(onOpenChange && { onOpenChange })}
      classNames={{
        listbox: 'max-h-[200px]',
        listboxWrapper: 'max-h-[200px]',
      }}
    >
      {customer => (
        <AutocompleteItem
          key={customer.id}
          textValue={customer.name}
          classNames={{
            base: 'py-2',
            title: 'text-small font-medium',
            description: 'text-tiny text-default-400',
          }}
        >
          <div className='flex gap-3 items-center py-1'>
            <Avatar
              alt={customer.name}
              className='shrink-0'
              size='sm'
              src={customer.image_url}
              name={customer.name
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .substring(0, 2)}
            />
            <div className='flex flex-col gap-0.5 min-w-0 flex-1'>
              <span className='text-small font-medium truncate'>
                {customer.name}
              </span>
              <span className='text-tiny text-default-400 truncate'>
                {customer.email}
              </span>
            </div>
          </div>
        </AutocompleteItem>
      )}
    </Autocomplete>
  );
}

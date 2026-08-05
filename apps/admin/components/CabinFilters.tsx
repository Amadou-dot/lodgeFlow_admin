'use client';

import type { CabinFilters } from '@/types';
import { Button } from '@heroui/button';
import { Select, SelectItem } from '@heroui/select';
import type { SharedSelection } from '@heroui/system';
import StandardFilters, { FilterOption } from './StandardFilters';

interface CabinFiltersProps {
  filters: CabinFilters;
  onFiltersChange: (filters: CabinFilters) => void;
  onReset: () => void;
  totalCount?: number;
}

export default function CabinFiltersComponent({
  filters,
  onFiltersChange,
  onReset,
  totalCount,
}: CabinFiltersProps) {
  const sortOptions: FilterOption[] = [
    { key: 'name', label: 'Name', value: 'name' },
    { key: 'price', label: 'Price', value: 'price' },
    { key: 'capacity', label: 'Capacity', value: 'capacity' },
  ];

  const handleSearchChange = (search: string) => {
    onFiltersChange({
      ...filters,
      search: search || undefined,
    });
  };

  const handleSortChange = (sortBy: string) => {
    onFiltersChange({
      ...filters,
      sortBy,
    });
  };

  const handleSortOrderChange = (sortOrder: 'asc' | 'desc') => {
    onFiltersChange({
      ...filters,
      sortOrder,
    });
  };

  const handleCapacityChange = (capacity: string) => {
    onFiltersChange({
      ...filters,
      capacity: capacity as 'small' | 'medium' | 'large' | undefined,
    });
  };

  const handleDiscountChange = (discount: string) => {
    onFiltersChange({
      ...filters,
      discount: discount as 'with' | 'without' | undefined,
    });
  };

  const handleStatusChange = (status: string) => {
    onFiltersChange({
      ...filters,
      status: status as 'active' | 'maintenance' | 'inactive' | undefined,
    });
  };

  const hasActiveFilters =
    filters.capacity || filters.discount || filters.status;

  const additionalFilters = (
    <>
      <Select
        aria-label='Filter by status'
        placeholder='All statuses'
        selectedKeys={filters.status ? [filters.status] : []}
        onSelectionChange={(keys: SharedSelection) => {
          const value = Array.from(keys)[0] as string;
          handleStatusChange(value);
        }}
        className='w-36'
        size='sm'
        variant='bordered'
      >
        <SelectItem key='active'>Active</SelectItem>
        <SelectItem key='maintenance'>Maintenance</SelectItem>
        <SelectItem key='inactive'>Inactive</SelectItem>
      </Select>

      <Select
        aria-label='Filter by capacity'
        placeholder='All capacities'
        selectedKeys={filters.capacity ? [filters.capacity] : []}
        onSelectionChange={(keys: SharedSelection) => {
          const value = Array.from(keys)[0] as string;
          handleCapacityChange(value);
        }}
        className='w-36'
        size='sm'
        variant='bordered'
      >
        <SelectItem key='small'>Small (1-3)</SelectItem>
        <SelectItem key='medium'>Medium (4-7)</SelectItem>
        <SelectItem key='large'>Large (8+)</SelectItem>
      </Select>

      <Select
        aria-label='Filter by discount'
        placeholder='All discounts'
        selectedKeys={filters.discount ? [filters.discount] : []}
        onSelectionChange={(keys: SharedSelection) => {
          const value = Array.from(keys)[0] as string;
          handleDiscountChange(value);
        }}
        className='w-36'
        size='sm'
        variant='bordered'
      >
        <SelectItem key='with'>With Discount</SelectItem>
        <SelectItem key='without'>No Discount</SelectItem>
      </Select>

      {hasActiveFilters && (
        <Button color='default' variant='light' onPress={onReset} size='sm'>
          Clear
        </Button>
      )}
    </>
  );

  return (
    <StandardFilters
      searchPlaceholder='Search cabins...'
      searchValue={filters.search}
      onSearchChange={handleSearchChange}
      sortOptions={sortOptions}
      currentSort={filters.sortBy}
      onSortChange={handleSortChange}
      sortOrder={filters.sortOrder || 'asc'}
      onSortOrderChange={handleSortOrderChange}
      additionalFilters={additionalFilters}
      totalCount={totalCount}
      itemName='cabin'
    />
  );
}

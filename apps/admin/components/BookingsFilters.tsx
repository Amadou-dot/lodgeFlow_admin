'use client';

import { Button } from '@heroui/button';
import { Select, SelectItem } from '@heroui/select';
import type { SharedSelection } from '@heroui/system';
import StandardFilters, { FilterOption } from './StandardFilters';

export interface BookingsFiltersData {
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface BookingsFiltersProps {
  filters: BookingsFiltersData;
  onFiltersChange: (filters: BookingsFiltersData) => void;
  onReset: () => void;
  totalCount?: number;
}

export default function BookingsFilters({
  filters,
  onFiltersChange,
  onReset,
  totalCount,
}: BookingsFiltersProps) {
  const sortOptions: FilterOption[] = [
    { key: 'created_at', label: 'Recent', value: 'created_at' },
    { key: 'checkInDate', label: 'Check-in', value: 'checkInDate' },
    { key: 'totalPrice', label: 'Amount', value: 'totalPrice' },
    { key: 'guestName', label: 'Guest', value: 'guestName' },
    { key: 'cabinName', label: 'Cabin', value: 'cabinName' },
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

  const handleStatusChange = (status: string) => {
    onFiltersChange({
      ...filters,
      status: status || undefined,
    });
  };

  const hasActiveFilters = filters.status && filters.status !== 'all';

  const additionalFilters = (
    <>
      <Select
        placeholder='All statuses'
        selectedKeys={filters.status ? [filters.status] : []}
        onSelectionChange={(keys: SharedSelection) => {
          const value = Array.from(keys)[0] as string;
          handleStatusChange(value);
        }}
        className='w-40'
        size='sm'
        variant='bordered'
      >
        <SelectItem key='all'>All</SelectItem>
        <SelectItem key='unconfirmed'>Unconfirmed</SelectItem>
        <SelectItem key='checked-in'>Checked In</SelectItem>
        <SelectItem key='checked-out'>Checked Out</SelectItem>
        <SelectItem key='cancelled'>Cancelled</SelectItem>
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
      searchPlaceholder='Search by cabin, guest name, or email...'
      searchValue={filters.search}
      onSearchChange={handleSearchChange}
      sortOptions={sortOptions}
      currentSort={filters.sortBy}
      onSortChange={handleSortChange}
      sortOrder={filters.sortOrder || 'desc'}
      onSortOrderChange={handleSortOrderChange}
      additionalFilters={additionalFilters}
      totalCount={totalCount}
      itemName='booking'
    />
  );
}

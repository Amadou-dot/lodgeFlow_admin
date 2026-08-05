'use client';

import type { DiningFilters } from '@/types';
import { Button } from '@heroui/button';
import { Select, SelectItem } from '@heroui/select';
import type { SharedSelection } from '@heroui/system';
import StandardFilters, { FilterOption } from './StandardFilters';

interface DiningFiltersProps {
  filters: DiningFilters;
  onFiltersChange: (filters: DiningFilters) => void;
  onReset: () => void;
  totalCount?: number;
}

export default function DiningFiltersComponent({
  filters,
  onFiltersChange,
  onReset,
  totalCount,
}: DiningFiltersProps) {
  const sortOptions: FilterOption[] = [
    { key: 'name', label: 'Name', value: 'name' },
    { key: 'price', label: 'Price', value: 'price' },
    { key: 'type', label: 'Type', value: 'type' },
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

  const hasActiveFilters =
    filters.type || filters.mealType || filters.category || filters.isAvailable;

  const additionalFilters = (
    <>
      <Select
        aria-label='Filter by type'
        placeholder='All types'
        selectedKeys={filters.type ? [filters.type] : []}
        onSelectionChange={(keys: SharedSelection) => {
          const selected = Array.from(keys)[0] as string;
          onFiltersChange({ ...filters, type: selected || undefined });
        }}
        className='w-36'
        size='sm'
        variant='bordered'
      >
        <SelectItem key='menu'>Regular Menu</SelectItem>
        <SelectItem key='experience'>Dining Experience</SelectItem>
      </Select>

      <Select
        aria-label='Filter by meal type'
        placeholder='All meals'
        selectedKeys={filters.mealType ? [filters.mealType] : []}
        onSelectionChange={(keys: SharedSelection) => {
          const selected = Array.from(keys)[0] as string;
          onFiltersChange({ ...filters, mealType: selected || undefined });
        }}
        className='w-36'
        size='sm'
        variant='bordered'
      >
        <SelectItem key='breakfast'>Breakfast</SelectItem>
        <SelectItem key='lunch'>Lunch</SelectItem>
        <SelectItem key='dinner'>Dinner</SelectItem>
        <SelectItem key='all-day'>All Day</SelectItem>
      </Select>

      <Select
        aria-label='Filter by category'
        placeholder='All categories'
        selectedKeys={filters.category ? [filters.category] : []}
        onSelectionChange={(keys: SharedSelection) => {
          const selected = Array.from(keys)[0] as string;
          onFiltersChange({ ...filters, category: selected || undefined });
        }}
        className='w-36'
        size='sm'
        variant='bordered'
      >
        <SelectItem key='regular'>Regular Food</SelectItem>
        <SelectItem key='craft-beer'>Craft Beer</SelectItem>
        <SelectItem key='wine'>Wine</SelectItem>
        <SelectItem key='spirits'>Spirits</SelectItem>
        <SelectItem key='non-alcoholic'>Non-Alcoholic</SelectItem>
      </Select>

      <Select
        aria-label='Filter by availability'
        placeholder='All items'
        selectedKeys={filters.isAvailable ? [filters.isAvailable] : []}
        onSelectionChange={(keys: SharedSelection) => {
          const selected = Array.from(keys)[0] as string;
          onFiltersChange({ ...filters, isAvailable: selected || undefined });
        }}
        className='w-36'
        size='sm'
        variant='bordered'
      >
        <SelectItem key='true'>Available</SelectItem>
        <SelectItem key='false'>Unavailable</SelectItem>
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
      searchPlaceholder='Search dining items...'
      searchValue={filters.search}
      onSearchChange={handleSearchChange}
      sortOptions={sortOptions}
      currentSort={filters.sortBy}
      onSortChange={handleSortChange}
      sortOrder={filters.sortOrder || 'asc'}
      onSortOrderChange={handleSortOrderChange}
      additionalFilters={additionalFilters}
      totalCount={totalCount}
      itemName='item'
    />
  );
}

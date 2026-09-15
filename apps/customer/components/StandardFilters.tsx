'use client';

import { Button } from '@heroui/button';
import { Input } from '@heroui/input';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

export interface FilterOption {
  key: string;
  label: string;
  value: string;
}

export interface StandardFiltersProps {
  searchPlaceholder: string;
  searchValue?: string;
  onSearchChange: (value: string) => void;
  sortOptions: FilterOption[];
  currentSort?: string;
  onSortChange: (sortBy: string) => void;
  sortOrder?: 'asc' | 'desc';
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  additionalFilters?: React.ReactNode;
  totalCount?: number;
  itemName: string; // e.g., "dining option", "cabin", "experience"
}

export default function StandardFilters({
  searchPlaceholder,
  searchValue = '',
  onSearchChange,
  sortOptions,
  currentSort,
  onSortChange,
  sortOrder = 'asc',
  onSortOrderChange,
  additionalFilters,
  totalCount,
  itemName,
}: StandardFiltersProps) {
  const [localSearchValue, setLocalSearchValue] = useState(searchValue);

  // Sync local search value when external value changes (e.g., from reset)
  useEffect(() => {
    setLocalSearchValue(searchValue);
  }, [searchValue]);

  const handleSearchSubmit = () => {
    onSearchChange(localSearchValue);
  };

  const handleSearchClear = () => {
    setLocalSearchValue('');
    onSearchChange('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearchSubmit();
    }
  };

  return (
    <div className='space-y-4'>
      {/* Search and Sort Row */}
      <div className='flex flex-col gap-4'>
        {/* Search Input */}
        <div className='flex gap-2'>
          <Input
            className='flex-1'
            isClearable
            placeholder={searchPlaceholder}
            startContent={<Search className='w-4 h-4' />}
            value={localSearchValue}
            onChange={e => setLocalSearchValue(e.target.value)}
            onClear={handleSearchClear}
            onKeyPress={handleKeyPress}
          />
          <Button
            color='primary'
            isDisabled={localSearchValue === searchValue}
            variant='solid'
            onPress={handleSearchSubmit}
          >
            Search
          </Button>
        </div>

        {/* Sort Options - Mobile: 2 rows x 3 columns, Desktop: single row */}
        <div className='grid grid-cols-3 md:flex gap-2'>
          {sortOptions.map(option => (
            <Button
              key={option.key}
              className='text-xs md:text-sm'
              size='sm'
              variant={currentSort === option.value ? 'solid' : 'bordered'}
              onPress={() => onSortChange(option.value)}
            >
              {option.label}
            </Button>
          ))}

          {/* Sort Order Toggle */}
          <Button
            isIconOnly
            size='sm'
            variant='bordered'
            onPress={() =>
              onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')
            }
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </Button>
        </div>
      </div>

      {/* Additional Filters Row (if provided) */}
      {additionalFilters && (
        <div className='flex flex-wrap gap-2 items-center'>
          {additionalFilters}
        </div>
      )}

      {/* Results Count */}
      {totalCount !== undefined && (
        <div className='text-sm text-default-600'>
          {totalCount} {itemName}
          {totalCount !== 1 ? 's' : ''} found
        </div>
      )}
    </div>
  );
}

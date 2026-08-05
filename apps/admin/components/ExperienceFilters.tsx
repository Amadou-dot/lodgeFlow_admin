'use client';

import type { ExperienceFilters } from '@/types';
import { Button } from '@heroui/button';
import { Select, SelectItem } from '@heroui/select';
import type { SharedSelection } from '@heroui/system';
import StandardFilters, { FilterOption } from './StandardFilters';

interface ExperienceFiltersProps {
  filters: ExperienceFilters;
  onFiltersChange: (filters: ExperienceFilters) => void;
  onReset: () => void;
  totalCount?: number;
}

export default function ExperienceFiltersComponent({
  filters,
  onFiltersChange,
  onReset,
  totalCount,
}: ExperienceFiltersProps) {
  const sortOptions: FilterOption[] = [
    { key: 'name', label: 'Name', value: 'name' },
    { key: 'price', label: 'Price', value: 'price' },
    { key: 'rating', label: 'Rating', value: 'rating' },
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

  const handleCategoryChange = (category: string) => {
    onFiltersChange({
      ...filters,
      category: category || undefined,
    });
  };

  const handleDifficultyChange = (
    difficulty: 'Easy' | 'Moderate' | 'Challenging' | undefined
  ) => {
    onFiltersChange({
      ...filters,
      difficulty,
    });
  };

  const hasActiveFilters = filters.category || filters.difficulty;

  const additionalFilters = (
    <>
      <Select
        placeholder='All categories'
        aria-label='Filter by category'
        selectedKeys={filters.category ? [filters.category] : []}
        onSelectionChange={(keys: SharedSelection) => {
          const value = Array.from(keys)[0] as string;
          handleCategoryChange(value);
        }}
        className='w-40'
        size='sm'
        variant='bordered'
      >
        <SelectItem key='Adventure'>Adventure</SelectItem>
        <SelectItem key='Nature'>Nature</SelectItem>
        <SelectItem key='Culture'>Culture</SelectItem>
        <SelectItem key='Relaxation'>Relaxation</SelectItem>
        <SelectItem key='Food & Drink'>Food & Drink</SelectItem>
        <SelectItem key='Sports'>Sports</SelectItem>
      </Select>

      <Select
        placeholder='All difficulties'
        aria-label='Filter by difficulty'
        selectedKeys={filters.difficulty ? [filters.difficulty] : []}
        onSelectionChange={(keys: SharedSelection) => {
          const value = Array.from(keys)[0] as
            | 'Easy'
            | 'Moderate'
            | 'Challenging'
            | undefined;
          handleDifficultyChange(value);
        }}
        className='w-40'
        size='sm'
        variant='bordered'
      >
        <SelectItem key='Easy'>Easy</SelectItem>
        <SelectItem key='Moderate'>Moderate</SelectItem>
        <SelectItem key='Challenging'>Challenging</SelectItem>
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
      searchPlaceholder='Search experiences...'
      searchValue={filters.search}
      onSearchChange={handleSearchChange}
      sortOptions={sortOptions}
      currentSort={filters.sortBy}
      onSortChange={handleSortChange}
      sortOrder={filters.sortOrder || 'asc'}
      onSortOrderChange={handleSortOrderChange}
      additionalFilters={additionalFilters}
      totalCount={totalCount}
      itemName='experience'
    />
  );
}

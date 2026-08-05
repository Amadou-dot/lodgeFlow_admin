'use client';

import { Button } from '@heroui/button';
import { Select, SelectItem } from '@heroui/select';
import { useEffect, useState } from 'react';

import CabinCard from '@/components/CabinCard';
import StandardFilters from '@/components/StandardFilters';
import { PageHeader } from '@/components/ui';
import type { Cabin, CabinsQueryParams } from '@/types';

interface CabinsFilters extends CabinsQueryParams {}

interface CabinsListClientProps {
  initialCabins: Cabin[];
}

export default function CabinsListClient({
  initialCabins,
}: CabinsListClientProps) {
  const [filters, setFilters] = useState<CabinsFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const sortOptions = [
    { key: 'name', label: 'Name', value: 'name' },
    { key: 'price', label: 'Price', value: 'price' },
    { key: 'capacity', label: 'Capacity', value: 'capacity' },
  ];

  const filtered = initialCabins.filter(c => {
    if (filters.capacity && c.capacity < filters.capacity) return false;
    if (filters.minPrice && c.price < filters.minPrice) return false;
    if (filters.maxPrice && c.price > filters.maxPrice) return false;
    if (searchTerm) {
      const needle = searchTerm.toLowerCase();
      const hay =
        `${c.name} ${c.description} ${(c.amenities ?? []).join(' ')}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const sortedCabins = [...filtered].sort((a, b) => {
    let aValue: any = a[sortBy as keyof Cabin];
    let bValue: any = b[sortBy as keyof Cabin];
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }
    if (sortOrder === 'asc') return aValue > bValue ? 1 : -1;
    return aValue < bValue ? 1 : -1;
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setFilters({
      capacity: urlParams.get('capacity')
        ? parseInt(urlParams.get('capacity')!)
        : undefined,
      minPrice: urlParams.get('minPrice')
        ? parseInt(urlParams.get('minPrice')!)
        : undefined,
      maxPrice: urlParams.get('maxPrice')
        ? parseInt(urlParams.get('maxPrice')!)
        : undefined,
    });
  }, []);

  const additionalFilters = (
    <div className='flex flex-wrap gap-2'>
      <Select
        className='w-40'
        placeholder='Capacity'
        selectedKeys={filters.capacity ? [filters.capacity.toString()] : []}
        size='sm'
        onSelectionChange={keys => {
          const selected = Array.from(keys)[0] as string;
          const capacity = selected ? parseInt(selected) : undefined;
          setFilters(prev => ({ ...prev, capacity }));
        }}
      >
        <SelectItem key='1'>1+ guests</SelectItem>
        <SelectItem key='2'>2+ guests</SelectItem>
        <SelectItem key='4'>4+ guests</SelectItem>
        <SelectItem key='6'>6+ guests</SelectItem>
        <SelectItem key='8'>8+ guests</SelectItem>
      </Select>

      <Select
        className='w-40'
        placeholder='Min Price'
        selectedKeys={filters.minPrice ? [filters.minPrice.toString()] : []}
        size='sm'
        onSelectionChange={keys => {
          const selected = Array.from(keys)[0] as string;
          const minPrice = selected ? parseInt(selected) : undefined;
          setFilters(prev => ({ ...prev, minPrice }));
        }}
      >
        <SelectItem key='50'>$50+</SelectItem>
        <SelectItem key='100'>$100+</SelectItem>
        <SelectItem key='150'>$150+</SelectItem>
        <SelectItem key='200'>$200+</SelectItem>
      </Select>

      <Select
        className='w-40'
        placeholder='Max Price'
        selectedKeys={filters.maxPrice ? [filters.maxPrice.toString()] : []}
        size='sm'
        onSelectionChange={keys => {
          const selected = Array.from(keys)[0] as string;
          const maxPrice = selected ? parseInt(selected) : undefined;
          setFilters(prev => ({ ...prev, maxPrice }));
        }}
      >
        <SelectItem key='100'>Up to $100</SelectItem>
        <SelectItem key='150'>Up to $150</SelectItem>
        <SelectItem key='200'>Up to $200</SelectItem>
        <SelectItem key='300'>Up to $300</SelectItem>
      </Select>

      <Button
        size='sm'
        variant='bordered'
        onPress={() => {
          setFilters({});
          setSearchTerm('');
        }}
      >
        Clear Filters
      </Button>
    </div>
  );

  return (
    <div className='max-w-7xl mx-auto py-8'>
      <div className='text-center mb-8'>
        <PageHeader
          subtitle='Discover our collection of beautiful cabins, each offering unique experiences in the heart of nature. From cozy retreats to spacious family accommodations.'
          title='Our'
          titleAccent='Cabins'
        />
      </div>

      <StandardFilters
        additionalFilters={additionalFilters}
        currentSort={sortBy}
        itemName='cabin'
        searchPlaceholder='Search cabins by name, amenities, or description...'
        searchValue={searchTerm}
        sortOptions={sortOptions}
        sortOrder={sortOrder}
        totalCount={sortedCabins.length}
        onSearchChange={setSearchTerm}
        onSortChange={setSortBy}
        onSortOrderChange={setSortOrder}
      />

      {sortedCabins.length > 0 ? (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {sortedCabins.map(cabin => (
            <CabinCard key={cabin._id.toString()} cabin={cabin} />
          ))}
        </div>
      ) : (
        <div className='text-center py-12'>
          <h3 className='text-xl font-semibold mb-2'>No cabins found</h3>
          <p className='text-default-500 mb-4'>
            Try adjusting your search or filters to see more options.
          </p>
        </div>
      )}
    </div>
  );
}

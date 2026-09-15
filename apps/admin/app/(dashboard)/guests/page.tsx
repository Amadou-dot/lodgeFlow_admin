'use client';

import GuestGrid from '@/components/GuestGrid';
import { PlusIcon } from '@/components/icons';
import StandardFilters, { FilterOption } from '@/components/StandardFilters';
import { useCustomers } from '@/hooks/useCustomers';
import { clearDetailMemory } from '@/hooks/useDetailPageMemory';
import { useURLFilters, guestsFilterConfig } from '@/hooks/useURLFilters';
import type { CustomersFilters } from '@/types';
import { Button } from '@heroui/button';
import { Card, CardBody } from '@heroui/card';
import { addToast } from '@heroui/toast';
import { useRouter } from 'next/navigation';
import { useEffect, Suspense } from 'react';

function GuestsContent() {
  const router = useRouter();

  // Use URL-based filter state
  const { filters, updateFilter, updateFilters } =
    useURLFilters<CustomersFilters>({
      filterConfig: guestsFilterConfig,
      basePath: '/guests',
    });

  const {
    data: customers,
    pagination,
    isLoading,
    error,
    mutate,
  } = useCustomers({
    page: filters.page || 1,
    limit: filters.limit || 12,
    search: filters.search,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  });

  // Clear detail page memory when landing on the list page
  useEffect(() => {
    clearDetailMemory('guests');
  }, []);

  // Check for success message in URL (when coming back from new guest page)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('created') === 'true') {
      addToast({
        title: 'Success',
        description: 'Guest created successfully',
        color: 'success',
      });
      // Remove the query parameter from URL while preserving other filters
      urlParams.delete('created');
      const newURL = urlParams.toString()
        ? `/guests?${urlParams.toString()}`
        : '/guests';
      router.replace(newURL);
      // Refresh the guests data
      mutate();
    }
  }, [mutate]);

  const sortOptions: FilterOption[] = [
    { key: 'name', label: 'Name', value: 'name' },
  ];

  const handleSearch = (value: string) => {
    updateFilters({
      search: value || undefined,
      page: 1, // Reset to first page when searching
    });
  };

  const handleSortChange = (newSortBy: string) => {
    updateFilters({
      sortBy: newSortBy,
      page: 1,
    });
  };

  const handleSortOrderChange = (newSortOrder: 'asc' | 'desc') => {
    updateFilters({
      sortOrder: newSortOrder,
      page: 1,
    });
  };

  const handlePageChange = (page: number) => {
    updateFilter('page', page, true); // Add to history for pagination
  };

  if (error) {
    return (
      <div className='container mx-auto p-4 md:p-6'>
        <div className='bg-danger-50 border border-danger-200 p-4 rounded-lg'>
          <p className='text-danger-600'>Failed to load guests</p>
        </div>
      </div>
    );
  }

  return (
    <div className='container mx-auto p-4 md:p-6'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6'>
        <div>
          <h1 className='text-2xl md:text-3xl font-bold'>Guests</h1>
          <p className='text-default-600 mt-1'>
            Manage your hotel guests and their information
          </p>
        </div>
        <Button
          color='primary'
          startContent={<PlusIcon />}
          onPress={() => router.push('/guests/new')}
          className='w-full sm:w-auto'
        >
          Add New Guest
        </Button>
      </div>

      {/* Search and Filters */}
      <div className='mb-6'>
        <StandardFilters
          searchPlaceholder='Search guests by name, email, nationality...'
          searchValue={filters.search || ''}
          onSearchChange={handleSearch}
          sortOptions={sortOptions}
          currentSort={filters.sortBy || 'name'}
          onSortChange={handleSortChange}
          sortOrder={filters.sortOrder || 'asc'}
          onSortOrderChange={handleSortOrderChange}
          totalCount={pagination?.totalItems || customers?.length || 0}
          itemName='guest'
        />
      </div>

      {/* Guest Grid Component */}
      <GuestGrid
        customers={customers || []}
        pagination={pagination}
        isLoading={isLoading}
        currentPage={filters.page || 1}
        onPageChange={handlePageChange}
      />
    </div>
  );
}

export default function GuestsPage() {
  return (
    <Suspense
      fallback={
        <div className='container mx-auto p-4 md:p-6'>
          <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6'>
            <div>
              <h1 className='text-2xl md:text-3xl font-bold'>Guests</h1>
              <p className='text-default-600 mt-1'>
                Manage your hotel guests and their information
              </p>
            </div>
            <Button
              color='primary'
              startContent={<PlusIcon />}
              isDisabled
              className='w-full sm:w-auto'
            >
              Add New Guest
            </Button>
          </div>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6'>
            {[...Array(12)].map((_, i) => (
              <Card key={i}>
                <CardBody className='p-4'>
                  <div className='flex items-start gap-3'>
                    <div className='w-10 h-10 bg-default-200 rounded-full animate-pulse flex-shrink-0' />
                    <div className='flex-1 min-w-0'>
                      <div className='h-4 bg-default-200 rounded animate-pulse' />
                      <div className='h-3 bg-default-200 rounded w-2/3 animate-pulse mt-1.5' />
                      <div className='h-3 bg-default-200 rounded w-1/2 animate-pulse mt-1.5' />
                    </div>
                  </div>
                  <div className='mt-4 space-y-2'>
                    <div className='flex justify-between items-center'>
                      <div className='h-3 bg-default-200 rounded w-16 animate-pulse' />
                      <div className='h-3 bg-default-200 rounded w-8 animate-pulse' />
                    </div>
                    <div className='flex justify-between items-center'>
                      <div className='h-3 bg-default-200 rounded w-12 animate-pulse' />
                      <div className='h-3 bg-default-200 rounded w-14 animate-pulse' />
                    </div>
                    <div className='flex justify-between items-center'>
                      <div className='h-3 bg-default-200 rounded w-14 animate-pulse' />
                      <div className='h-5 bg-default-200 rounded-full w-16 animate-pulse' />
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      }
    >
      <GuestsContent />
    </Suspense>
  );
}

'use client';

import type { Customer, PaginationData } from '@/types';
import { Card, CardBody } from '@heroui/card';
import { Pagination } from '@heroui/pagination';
import GuestCard from './GuestCard';

interface GuestGridProps {
  customers: Customer[];
  pagination?: PaginationData;
  isLoading: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export default function GuestGrid({
  customers,
  pagination,
  isLoading,
  currentPage,
  onPageChange,
}: GuestGridProps) {
  // Loading State
  if (isLoading) {
    return (
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
    );
  }

  // Empty State
  if (!customers || customers.length === 0) {
    return (
      <Card className='p-8'>
        <CardBody className='text-center'>
          <p className='text-default-600 text-lg'>No guests found</p>
          <p className='text-default-400 text-sm mt-1'>
            Try adjusting your search terms or add your first guest to get
            started
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      {/* Guests Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6'>
        {customers.map(customer => {
          return <GuestCard key={customer.id} customer={customer} />;
        })}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className='flex justify-center'>
          <Pagination
            total={pagination.totalPages}
            page={currentPage}
            onChange={onPageChange}
            showControls
            className='gap-2'
          />
        </div>
      )}
    </>
  );
}

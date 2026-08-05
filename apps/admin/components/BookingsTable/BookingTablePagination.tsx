'use client';

import { Pagination } from '@heroui/pagination';

interface BookingTablePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function BookingTablePagination({
  currentPage,
  totalPages,
  onPageChange,
}: BookingTablePaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className='flex justify-center mt-6'>
      <Pagination
        total={totalPages}
        page={currentPage}
        onChange={onPageChange}
        showControls
        showShadow
        color='primary'
        size='sm'
        className='md:hidden'
      />
      <Pagination
        total={totalPages}
        page={currentPage}
        onChange={onPageChange}
        showControls
        showShadow
        color='primary'
        className='hidden md:flex'
      />
    </div>
  );
}

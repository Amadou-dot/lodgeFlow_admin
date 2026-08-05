'use client';

import DiningFilters from '@/components/DiningFilters';
import { DiningGrid } from '@/components/DiningGrid';
import { DiningModal } from '@/components/DiningModal';
import DiningStats from '@/components/DiningStats';
import DiningTableView from '@/components/DiningTableView';
import DeletionModal from '@/components/DeletionModal';
import { GridIcon, ListIcon, PlusIcon } from '@/components/icons';
import { useDining, useDeleteDining } from '@/hooks/useDining';
import type { Dining, DiningFilters as DiningFiltersType } from '@/types';
import { Button } from '@heroui/button';
import { Card, CardBody } from '@heroui/card';
import { useEffect, useState } from 'react';

type ViewMode = 'grid' | 'list';

function DiningCardSkeleton() {
  return (
    <div className='bg-content1 rounded-lg border border-divider animate-pulse'>
      <div className='h-48 bg-default-200 rounded-t-lg' />
      <div className='p-4 space-y-3'>
        <div className='h-5 bg-default-200 rounded w-3/4' />
        <div className='h-6 bg-default-200 rounded w-1/2' />
        <div className='h-4 bg-default-200 rounded w-full' />
        <div className='flex gap-1'>
          <div className='h-6 bg-default-200 rounded-full w-16' />
          <div className='h-6 bg-default-200 rounded-full w-16' />
          <div className='h-6 bg-default-200 rounded-full w-16' />
        </div>
      </div>
    </div>
  );
}

export default function DiningPage() {
  const [filters, setFilters] = useState<DiningFiltersType>({});
  const [selectedDining, setSelectedDining] = useState<Dining | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'create' | 'edit'>(
    'view'
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [diningToDelete, setDiningToDelete] = useState<Dining | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  useEffect(() => {
    const saved = localStorage.getItem('dining-view-mode') as ViewMode | null;
    if (saved === 'grid' || saved === 'list') {
      setViewMode(saved);
    }
  }, []);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('dining-view-mode', mode);
  };

  const { data: dining, isLoading, error, refetch } = useDining(filters);
  const deleteDining = useDeleteDining();

  const handleViewDining = (item: Dining) => {
    setSelectedDining(item);
    setModalMode('view');
    setIsModalOpen(true);
  };

  const handleCreateDining = () => {
    setSelectedDining(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleEditDining = (item: Dining) => {
    setSelectedDining(item);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleDeleteDining = (item: Dining) => {
    setDiningToDelete(item);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDining(null);
  };

  const handleResetFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = Object.values(filters).some(v => v);

  return (
    <div className='container mx-auto px-4 py-8'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8'>
        <div>
          <h1 className='text-3xl font-bold'>Dining Management</h1>
          <p className='text-default-600 mt-1'>
            Manage your restaurant menu items and dining experiences
          </p>
        </div>
        <div className='flex items-center gap-2 w-full sm:w-auto'>
          {/* View Toggle — hidden on mobile */}
          <div className='hidden md:flex items-center gap-1'>
            <Button
              isIconOnly
              size='sm'
              variant={viewMode === 'grid' ? 'solid' : 'light'}
              color={viewMode === 'grid' ? 'primary' : 'default'}
              onPress={() => handleViewModeChange('grid')}
              aria-label='Grid view'
            >
              <GridIcon size={18} />
            </Button>
            <Button
              isIconOnly
              size='sm'
              variant={viewMode === 'list' ? 'solid' : 'light'}
              color={viewMode === 'list' ? 'primary' : 'default'}
              onPress={() => handleViewModeChange('list')}
              aria-label='List view'
            >
              <ListIcon size={18} />
            </Button>
          </div>
          <Button
            color='primary'
            startContent={<PlusIcon size={18} />}
            onPress={handleCreateDining}
            className='w-full sm:w-auto'
          >
            Add Dining Item
          </Button>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className='mb-8'>
        <DiningStats />
      </div>

      {/* Filters */}
      <div className='mb-8'>
        <DiningFilters
          filters={filters}
          onFiltersChange={setFilters}
          onReset={handleResetFilters}
          totalCount={dining?.length || 0}
        />
      </div>

      {/* Error State */}
      {error && (
        <Card className='bg-danger-50 border-danger-200'>
          <CardBody className='text-center py-8'>
            <p className='text-danger text-lg mb-4'>
              Error loading dining items: {error.message}
            </p>
            <Button
              color='primary'
              variant='bordered'
              onPress={() => refetch()}
            >
              Retry
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && !error && (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
          {[...Array(8)].map((_, i) => (
            <DiningCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && dining && (
        <>
          {dining.length === 0 ? (
            <Card className='bg-default-50'>
              <CardBody className='text-center py-16'>
                <div className='text-6xl mb-4'>
                  {hasActiveFilters ? '🔍' : '🍽️'}
                </div>
                <p className='text-default-600 text-lg mb-2'>
                  {hasActiveFilters
                    ? 'No dining items match your current filters'
                    : 'No dining items available yet'}
                </p>
                <p className='text-default-400 text-sm mb-6'>
                  {hasActiveFilters
                    ? 'Try adjusting your filters to see more results'
                    : 'Create your first dining item to get started'}
                </p>
                {hasActiveFilters ? (
                  <Button
                    color='default'
                    variant='bordered'
                    onPress={handleResetFilters}
                  >
                    Clear All Filters
                  </Button>
                ) : (
                  <Button
                    color='primary'
                    onPress={handleCreateDining}
                    startContent={<PlusIcon size={18} />}
                  >
                    Create Your First Dining Item
                  </Button>
                )}
              </CardBody>
            </Card>
          ) : (
            <>
              {/* Grid view — shown on desktop when grid selected, always on mobile */}
              <div
                className={viewMode === 'grid' ? 'block' : 'block md:hidden'}
              >
                <DiningGrid
                  dining={dining}
                  onView={handleViewDining}
                  onEdit={handleEditDining}
                  onDelete={handleDeleteDining}
                />
              </div>

              {/* List/table view — only on md+ when list selected */}
              {viewMode === 'list' && (
                <div className='hidden md:block'>
                  <DiningTableView
                    dining={dining}
                    isLoading={isLoading}
                    onView={handleViewDining}
                    onEdit={handleEditDining}
                    onDelete={handleDeleteDining}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Modal */}
      <DiningModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        dining={selectedDining}
        mode={modalMode}
        onEdit={handleEditDining}
      />

      {/* Delete Confirmation Modal */}
      {diningToDelete && diningToDelete._id && (
        <DeletionModal
          resourceId={diningToDelete._id}
          resourceName='Dining Item'
          itemName={diningToDelete.name}
          onDelete={deleteDining}
          onResourceDeleted={() => setDiningToDelete(null)}
          isOpen={true}
          onOpenChange={open => !open && setDiningToDelete(null)}
        />
      )}
    </div>
  );
}

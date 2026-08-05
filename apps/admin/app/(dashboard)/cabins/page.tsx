'use client';

import BulkActionsToolbar from '@/components/BulkActionsToolbar';
import CabinCard from '@/components/CabinCard';
import CabinFilters from '@/components/CabinFilters';
import CabinModal from '@/components/CabinModal';
import CabinStats from '@/components/CabinStats';
import CabinTableView from '@/components/CabinTableView';
import DeletionModal from '@/components/DeletionModal';
import { GridIcon, ListIcon, PlusIcon } from '@/components/icons';
import {
  useBulkDeleteCabins,
  useBulkUpdateDiscount,
  useCabins,
  useDeleteCabin,
} from '@/hooks/useCabins';
import type { Cabin, CabinFilters as CabinFiltersType } from '@/types';
import { Button } from '@heroui/button';
import { Card, CardBody } from '@heroui/card';
import { Checkbox } from '@heroui/checkbox';
import { type Selection } from '@heroui/table';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ViewMode = 'grid' | 'list';

function CabinCardSkeleton() {
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

export default function CabinsPage() {
  const [filters, setFilters] = useState<CabinFiltersType>({});
  const [selectedCabin, setSelectedCabin] = useState<Cabin | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'create' | 'edit'>(
    'view'
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cabinToDelete, setCabinToDelete] = useState<Cabin | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem('cabin-view-mode') as ViewMode | null;
    if (saved === 'grid' || saved === 'list') {
      setViewMode(saved);
    }
  }, []);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters]);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('cabin-view-mode', mode);
  };

  const { data: cabins, isLoading, error, refetch } = useCabins(filters);
  const deleteCabin = useDeleteCabin();
  const bulkDelete = useBulkDeleteCabins();
  const bulkUpdateDiscount = useBulkUpdateDiscount();

  const selectedNames = useMemo(() => {
    if (!cabins) return [];
    return cabins.filter(c => selectedIds.has(c.id)).map(c => c.name);
  }, [cabins, selectedIds]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleTableSelectionChange = useCallback(
    (keys: Selection) => {
      if (keys === 'all') {
        setSelectedIds(new Set(cabins?.map(c => c.id) || []));
      } else {
        setSelectedIds(new Set(keys as Set<string>));
      }
    },
    [cabins]
  );

  const handleGridSelectAll = useCallback(() => {
    if (!cabins) return;
    if (selectedIds.size === cabins.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cabins.map(c => c.id)));
    }
  }, [cabins, selectedIds.size]);

  const handleToggleCardSelect = useCallback((cabinId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(cabinId)) {
        next.delete(cabinId);
      } else {
        next.add(cabinId);
      }
      return next;
    });
  }, []);

  const handleViewCabin = (cabin: Cabin) => {
    setSelectedCabin(cabin);
    setModalMode('view');
    setIsModalOpen(true);
  };

  const handleCreateCabin = () => {
    setSelectedCabin(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleEditCabin = (cabin: Cabin) => {
    setSelectedCabin(cabin);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleDeleteCabin = (cabin: Cabin) => {
    setCabinToDelete(cabin);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCabin(null);
  };

  const handleResetFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = Object.values(filters).some(v => v);
  const isSelectionMode = selectedIds.size > 0;

  return (
    <div className='container mx-auto px-4 py-8'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8'>
        <div>
          <h1 className='text-3xl font-bold'>Cabins</h1>
          <p className='text-default-600 mt-1'>
            Manage your cabin inventory and pricing
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
            onPress={handleCreateCabin}
            className='w-full sm:w-auto'
          >
            Add New Cabin
          </Button>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className='mb-8'>
        <CabinStats />
      </div>

      {/* Filters */}
      <div className='mb-8'>
        <CabinFilters
          filters={filters}
          onFiltersChange={setFilters}
          onReset={handleResetFilters}
          totalCount={cabins?.length || 0}
        />
      </div>

      {/* Bulk Actions Toolbar */}
      {isSelectionMode && (
        <div className='mb-4'>
          <BulkActionsToolbar
            selectedCount={selectedIds.size}
            selectedNames={selectedNames}
            selectedIds={Array.from(selectedIds)}
            onClearSelection={handleClearSelection}
            bulkDelete={bulkDelete}
            bulkUpdateDiscount={bulkUpdateDiscount}
          />
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className='bg-danger-50 border-danger-200'>
          <CardBody className='text-center py-8'>
            <p className='text-danger text-lg mb-4'>
              Error loading cabins: {error.message}
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
            <CabinCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && cabins && (
        <>
          {cabins.length === 0 ? (
            <Card className='bg-default-50'>
              <CardBody className='text-center py-16'>
                <div className='text-6xl mb-4'>
                  {hasActiveFilters ? '🔍' : '🏡'}
                </div>
                <p className='text-default-600 text-lg mb-2'>
                  {hasActiveFilters
                    ? 'No cabins match your current filters'
                    : 'No cabins available yet'}
                </p>
                <p className='text-default-400 text-sm mb-6'>
                  {hasActiveFilters
                    ? 'Try adjusting your filters to see more results'
                    : 'Create your first cabin to get started'}
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
                    onPress={handleCreateCabin}
                    startContent={<PlusIcon size={18} />}
                  >
                    Create Your First Cabin
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
                {/* Grid Select All */}
                <div className='flex items-center gap-2 mb-4'>
                  <Checkbox
                    isSelected={selectedIds.size === cabins.length}
                    isIndeterminate={
                      selectedIds.size > 0 && selectedIds.size < cabins.length
                    }
                    onValueChange={handleGridSelectAll}
                    aria-label='Select all cabins'
                    size='sm'
                  />
                  <span className='text-sm text-default-500'>
                    Select all ({cabins.length})
                  </span>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
                  {cabins.map(cabin => (
                    <CabinCard
                      key={cabin.id}
                      cabin={cabin}
                      onView={handleViewCabin}
                      onEdit={() => handleEditCabin(cabin)}
                      onDelete={() => handleDeleteCabin(cabin)}
                      isSelected={selectedIds.has(cabin.id)}
                      onToggleSelect={() => handleToggleCardSelect(cabin.id)}
                      selectionMode={isSelectionMode}
                    />
                  ))}
                </div>
              </div>

              {/* List/table view — only on md+ when list selected */}
              {viewMode === 'list' && (
                <div className='hidden md:block'>
                  <CabinTableView
                    cabins={cabins}
                    isLoading={isLoading}
                    onView={handleViewCabin}
                    onEdit={handleEditCabin}
                    onDelete={handleDeleteCabin}
                    selectedKeys={selectedIds}
                    onSelectionChange={handleTableSelectionChange}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Modal */}
      <CabinModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        cabin={selectedCabin}
        mode={modalMode}
        onEdit={handleEditCabin}
      />

      {/* Delete Confirmation Modal */}
      {cabinToDelete && (
        <DeletionModal
          resourceId={cabinToDelete.id}
          resourceName='Cabin'
          itemName={cabinToDelete.name}
          note='Cabins with active bookings cannot be deleted.'
          onDelete={deleteCabin}
          onResourceDeleted={() => setCabinToDelete(null)}
          isOpen={true}
          onOpenChange={open => !open && setCabinToDelete(null)}
        />
      )}
    </div>
  );
}

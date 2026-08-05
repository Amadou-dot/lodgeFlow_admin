'use client';

import DeletionModal from '@/components/DeletionModal';
import ExperienceFilters from '@/components/ExperienceFilters';
import { ExperienceGrid } from '@/components/ExperienceGrid';
import { ExperienceModal } from '@/components/ExperienceModal';
import ExperienceStats from '@/components/ExperienceStats';
import ExperienceTableView from '@/components/ExperienceTableView';
import { GridIcon, ListIcon, PlusIcon } from '@/components/icons';
import {
  useCreateExperience,
  useDeleteExperience,
  useExperiences,
} from '@/hooks/useExperiences';
import type { FormData } from '@/components/AddExperienceForm/types';
import type {
  Experience,
  ExperienceFilters as ExperienceFiltersType,
} from '@/types';
import { Button } from '@heroui/button';
import { Card, CardBody } from '@heroui/card';
import { addToast } from '@heroui/toast';
import { useEffect, useState } from 'react';

type ViewMode = 'grid' | 'list';

function ExperienceCardSkeleton() {
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

export default function ExperiencesPage() {
  const [filters, setFilters] = useState<ExperienceFiltersType>({});
  const [selectedExperience, setSelectedExperience] =
    useState<Experience | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'create' | 'edit'>(
    'view'
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [experienceToDelete, setExperienceToDelete] =
    useState<Experience | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  useEffect(() => {
    const saved = localStorage.getItem(
      'experience-view-mode'
    ) as ViewMode | null;
    if (saved === 'grid' || saved === 'list') {
      setViewMode(saved);
    }
  }, []);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('experience-view-mode', mode);
  };

  const {
    data: experiences,
    isLoading,
    error,
    refetch,
  } = useExperiences(filters);
  const createExperience = useCreateExperience();
  const deleteExperience = useDeleteExperience();

  const handleViewExperience = (item: Experience) => {
    setSelectedExperience(item);
    setModalMode('view');
    setIsModalOpen(true);
  };

  const handleCreateExperience = () => {
    setSelectedExperience(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleEditExperience = (item: Experience) => {
    setSelectedExperience(item);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleDeleteExperience = (item: Experience) => {
    setExperienceToDelete(item);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedExperience(null);
  };

  const handleResetFilters = () => {
    setFilters({});
  };

  const handleCreateSubmit = async (formData: FormData) => {
    try {
      const requiredFields = [
        'title',
        'price',
        'duration',
        'category',
        'shortDescription',
        'imageUrl',
        'callToAction',
      ];
      const missingFields = requiredFields.filter(field => !formData[field]);

      if (missingFields.length > 0) {
        addToast({
          title: 'Validation Error',
          description: `Please fill in all required fields: ${missingFields.join(', ')}`,
          color: 'danger',
        });
        return;
      }

      const transformedData = {
        name: formData.title,
        price: Number(formData.price) || 0,
        duration: formData.duration,
        difficulty: (formData.difficulty || 'Easy') as
          | 'Easy'
          | 'Moderate'
          | 'Challenging',
        category: formData.category,
        description: formData.shortDescription || '',
        longDescription: formData.longDescription,
        image: formData.imageUrl || '',
        gallery: formData.imageGallery
          ? formData.imageGallery.split(',').map((url: string) => url.trim())
          : [],
        includes: formData.includes
          ? formData.includes.split(',').map((item: string) => item.trim())
          : [],
        available: formData.availableTimes
          ? formData.availableTimes
              .split(',')
              .map((time: string) => time.trim())
          : [],
        ctaText: formData.callToAction || 'Book Now',
        isPopular: formData.isPopular || false,
        maxParticipants: Number(formData.maxParticipants) || undefined,
        minAge: Number(formData.minimumAge) || undefined,
        requirements: formData.requirements
          ? formData.requirements.split(',').map((req: string) => req.trim())
          : [],
        location: formData.location,
        highlights: formData.highlights
          ? formData.highlights
              .split(',')
              .map((highlight: string) => highlight.trim())
          : [],
        whatToBring: formData.whatToBring
          ? formData.whatToBring.split(',').map((item: string) => item.trim())
          : [],
        cancellationPolicy: formData.cancellationPolicy,
        seasonality: Array.isArray(formData.seasonalAvailability)
          ? formData.seasonalAvailability.join(', ')
          : formData.seasonalAvailability || '',
        tags: formData.tags
          ? formData.tags.split(',').map((tag: string) => tag.trim())
          : [],
        rating:
          typeof formData.rating === 'number' ? formData.rating : undefined,
        reviewCount:
          typeof formData.reviewCount === 'number'
            ? formData.reviewCount
            : undefined,
      };

      await createExperience.mutateAsync(transformedData);
      handleCloseModal();
    } catch (error) {
      console.error('Error creating experience:', error);
      addToast({
        title: 'Error',
        description: 'Failed to create experience. Please try again.',
        color: 'danger',
      });
    }
  };

  const hasActiveFilters = Object.values(filters).some(v => v);

  return (
    <div className='container mx-auto px-4 py-8'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8'>
        <div>
          <h1 className='text-3xl font-bold'>Experiences</h1>
          <p className='text-default-600 mt-1'>
            Manage your experience offerings and activities
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
            onPress={handleCreateExperience}
            className='w-full sm:w-auto'
          >
            Add New Experience
          </Button>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className='mb-8'>
        <ExperienceStats />
      </div>

      {/* Filters */}
      <div className='mb-8'>
        <ExperienceFilters
          filters={filters}
          onFiltersChange={setFilters}
          onReset={handleResetFilters}
          totalCount={experiences?.length || 0}
        />
      </div>

      {/* Error State */}
      {error && (
        <Card className='bg-danger-50 border-danger-200'>
          <CardBody className='text-center py-8'>
            <p className='text-danger text-lg mb-4'>
              Error loading experiences: {error.message}
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
            <ExperienceCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && experiences && (
        <>
          {experiences.length === 0 ? (
            <Card className='bg-default-50'>
              <CardBody className='text-center py-16'>
                <div className='text-6xl mb-4'>
                  {hasActiveFilters ? '\u{1F50D}' : '\u{1F9ED}'}
                </div>
                <p className='text-default-600 text-lg mb-2'>
                  {hasActiveFilters
                    ? 'No experiences match your current filters'
                    : 'No experiences available yet'}
                </p>
                <p className='text-default-400 text-sm mb-6'>
                  {hasActiveFilters
                    ? 'Try adjusting your filters to see more results'
                    : 'Create your first experience to get started'}
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
                    onPress={handleCreateExperience}
                    startContent={<PlusIcon size={18} />}
                  >
                    Create Your First Experience
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
                <ExperienceGrid
                  items={experiences}
                  onView={handleViewExperience}
                  onEdit={handleEditExperience}
                  onDelete={handleDeleteExperience}
                />
              </div>

              {/* List/table view — only on md+ when list selected */}
              {viewMode === 'list' && (
                <div className='hidden md:block'>
                  <ExperienceTableView
                    experiences={experiences}
                    isLoading={isLoading}
                    onView={handleViewExperience}
                    onEdit={handleEditExperience}
                    onDelete={handleDeleteExperience}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Modal */}
      <ExperienceModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        experience={selectedExperience}
        mode={modalMode}
        onEdit={handleEditExperience}
        onCreateSubmit={handleCreateSubmit}
      />

      {/* Delete Confirmation Modal */}
      {experienceToDelete && experienceToDelete._id && (
        <DeletionModal
          resourceId={experienceToDelete._id}
          resourceName='Experience'
          itemName={experienceToDelete.name}
          onDelete={deleteExperience}
          onResourceDeleted={() => setExperienceToDelete(null)}
          isOpen={true}
          onOpenChange={open => !open && setExperienceToDelete(null)}
        />
      )}
    </div>
  );
}

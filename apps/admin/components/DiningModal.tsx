'use client';

import { useCreateDining, useUpdateDining } from '@/hooks/useDining';
import { Dining } from '@/types';
import { Button } from '@heroui/button';
import { Chip } from '@heroui/chip';
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/modal';
import { addToast } from '@heroui/toast';
import Image from 'next/image';
import { getCategoryColor, getMealTypeColor } from './DiningCard';
import { DiningForm } from './DiningForm';

interface DiningModalProps {
  isOpen: boolean;
  onClose: () => void;
  dining?: Dining | null;
  mode: 'view' | 'create' | 'edit';
  onEdit?: (dining: Dining) => void;
}

const formatTime = (time: string) => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

export const DiningModal = ({
  isOpen,
  onClose,
  dining,
  mode,
  onEdit,
}: DiningModalProps) => {
  const createDining = useCreateDining();
  const updateDining = useUpdateDining();

  const isViewMode = mode === 'view';
  const isLoading = createDining.isPending || updateDining.isPending;

  const handleSubmit = async (data: Partial<Dining>) => {
    try {
      if (mode === 'create') {
        await createDining.mutateAsync(data);
      } else if (mode === 'edit' && dining?._id) {
        await updateDining.mutateAsync({ ...data, _id: dining._id });
      }
      onClose();
    } catch (error) {
      addToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Unknown error',
        color: 'danger',
      });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size='5xl'
      scrollBehavior='inside'
      classNames={{
        base: 'max-h-[90vh]',
        body: 'p-6',
      }}
    >
      <ModalContent>
        <ModalHeader className='flex flex-col gap-1 px-6 pt-6 pb-2'>
          <h2 className='text-2xl font-bold'>
            {mode === 'view' && `${dining?.name} - Details`}
            {mode === 'create' && 'Add New Dining Item'}
            {mode === 'edit' && `Edit ${dining?.name}`}
          </h2>
          {!isViewMode && (
            <p className='text-sm text-default-600'>
              {mode === 'create'
                ? 'Create a new dining menu item or experience.'
                : 'Update the dining item details below.'}
            </p>
          )}
        </ModalHeader>

        <ModalBody>
          {isViewMode && dining ? (
            <div className='space-y-5'>
              {/* Hero Image */}
              <Image
                src={dining.image}
                alt={dining.name}
                width={800}
                height={300}
                className='w-full h-56 object-cover rounded-lg'
              />

              {/* Quick Info Boxes */}
              <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
                <div className='bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700/60 rounded-lg p-3 text-center'>
                  <p className='text-xs text-blue-600 dark:text-blue-300'>
                    Type
                  </p>
                  <p className='text-lg font-bold text-blue-700 dark:text-blue-100 capitalize'>
                    {dining.type}
                  </p>
                </div>
                <div className='bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-700/60 rounded-lg p-3 text-center'>
                  <p className='text-xs text-green-600 dark:text-green-300'>
                    Price
                  </p>
                  <p className='text-lg font-bold text-green-700 dark:text-green-100'>
                    ${dining.price}
                  </p>
                </div>
                <div className='bg-orange-50 dark:bg-orange-900/40 border border-orange-200 dark:border-orange-700/60 rounded-lg p-3 text-center'>
                  <p className='text-xs text-orange-600 dark:text-orange-300'>
                    Meal Type
                  </p>
                  <p className='text-lg font-bold text-orange-700 dark:text-orange-100 capitalize'>
                    {dining.mealType}
                  </p>
                </div>
                <div className='bg-purple-50 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-700/60 rounded-lg p-3 text-center'>
                  <p className='text-xs text-purple-600 dark:text-purple-300'>
                    Category
                  </p>
                  <p className='text-lg font-bold text-purple-700 dark:text-purple-100 capitalize'>
                    {dining.category.replace('-', ' ')}
                  </p>
                </div>
              </div>

              {/* Description */}
              {dining.description && (
                <div>
                  <h4 className='text-sm font-semibold text-default-500 mb-2'>
                    Description
                  </h4>
                  <p className='text-default-700'>{dining.description}</p>
                </div>
              )}

              {/* Serving Details */}
              <div>
                <h4 className='text-sm font-semibold text-default-500 mb-2'>
                  Serving Details
                </h4>
                <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
                  <div className='text-sm'>
                    <span className='text-default-400'>Time: </span>
                    <span className='text-default-700'>
                      {formatTime(dining.servingTime.start)} -{' '}
                      {formatTime(dining.servingTime.end)}
                    </span>
                  </div>
                  <div className='text-sm'>
                    <span className='text-default-400'>Capacity: </span>
                    <span className='text-default-700'>
                      {dining.minPeople === dining.maxPeople
                        ? `${dining.maxPeople} person${dining.maxPeople > 1 ? 's' : ''}`
                        : `${dining.minPeople}-${dining.maxPeople} people`}
                    </span>
                  </div>
                  {dining.duration && (
                    <div className='text-sm'>
                      <span className='text-default-400'>Duration: </span>
                      <span className='text-default-700'>
                        {dining.duration}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Dietary */}
              {dining.dietary && dining.dietary.length > 0 && (
                <div>
                  <h4 className='text-sm font-semibold text-default-500 mb-2'>
                    Dietary
                  </h4>
                  <div className='flex flex-wrap gap-2'>
                    {dining.dietary.map(diet => (
                      <Chip key={diet} color='success' variant='flat' size='sm'>
                        {diet}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {/* Ingredients */}
              {dining.ingredients && dining.ingredients.length > 0 && (
                <div>
                  <h4 className='text-sm font-semibold text-default-500 mb-2'>
                    Ingredients
                  </h4>
                  <div className='flex flex-wrap gap-2'>
                    {dining.ingredients.map(ingredient => (
                      <Chip
                        key={ingredient}
                        color='default'
                        variant='flat'
                        size='sm'
                      >
                        {ingredient}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {dining.tags && dining.tags.length > 0 && (
                <div>
                  <h4 className='text-sm font-semibold text-default-500 mb-2'>
                    Tags
                  </h4>
                  <div className='flex flex-wrap gap-2'>
                    {dining.tags.map(tag => (
                      <Chip
                        key={tag}
                        color='primary'
                        variant='bordered'
                        size='sm'
                      >
                        {tag}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {/* Availability & Popularity */}
              <div className='flex gap-2'>
                <Chip
                  color={dining.isAvailable ? 'success' : 'default'}
                  variant='flat'
                >
                  {dining.isAvailable ? 'Available' : 'Unavailable'}
                </Chip>
                {dining.isPopular && (
                  <Chip color='danger' variant='flat'>
                    Popular
                  </Chip>
                )}
                {dining.mealType && (
                  <Chip
                    color={getMealTypeColor(dining.mealType)}
                    variant='flat'
                  >
                    {dining.mealType}
                  </Chip>
                )}
                {dining.category && (
                  <Chip
                    color={getCategoryColor(dining.category)}
                    variant='flat'
                  >
                    {dining.category.replace('-', ' ')}
                  </Chip>
                )}
              </div>
            </div>
          ) : (
            <DiningForm
              dining={dining || undefined}
              onSubmit={handleSubmit}
              onCancel={onClose}
              isLoading={isLoading}
            />
          )}
        </ModalBody>

        {isViewMode && (
          <ModalFooter>
            <Button color='default' variant='light' onPress={onClose}>
              Close
            </Button>
            {onEdit && dining && (
              <Button
                color='primary'
                variant='bordered'
                onPress={() => onEdit(dining)}
              >
                Edit Dining Item
              </Button>
            )}
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
  );
};

'use client';

import { useUpdateExperience } from '@/hooks/useExperiences';
import { Experience } from '@/types';
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
import { useState } from 'react';
import AddExperienceForm from './AddExperienceForm';
import { FormData } from './AddExperienceForm/types';
import EditExperienceForm from './EditExperienceForm';
import { getDifficultyColor } from './ExperienceCard';

interface ExperienceModalProps {
  isOpen: boolean;
  onClose: () => void;
  experience?: Experience | null;
  mode: 'view' | 'create' | 'edit';
  onEdit?: (experience: Experience) => void;
  onCreateSubmit?: (formData: FormData) => void;
}

export const ExperienceModal = ({
  isOpen,
  onClose,
  experience,
  mode,
  onEdit,
  onCreateSubmit,
}: ExperienceModalProps) => {
  const updateExperience = useUpdateExperience();
  const [formData, setFormData] = useState<FormData>({} as FormData);

  const isViewMode = mode === 'view';
  const isLoading = updateExperience.isPending;

  const handleEditSave = async (updatedExperience: Experience) => {
    if (!experience?._id) return;
    try {
      await updateExperience.mutateAsync({
        ...updatedExperience,
        _id: experience._id,
      });
      onClose();
    } catch (error) {
      addToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Unknown error',
        color: 'danger',
      });
    }
  };

  const handleCreateSubmit = () => {
    if (onCreateSubmit) {
      onCreateSubmit(formData);
      setFormData({} as FormData);
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
            {mode === 'view' && `${experience?.name} - Details`}
            {mode === 'create' && 'Add New Experience'}
            {mode === 'edit' && `Edit ${experience?.name}`}
          </h2>
          {!isViewMode && (
            <p className='text-sm text-default-600'>
              {mode === 'create'
                ? 'Create a new experience or activity.'
                : 'Update the experience details below.'}
            </p>
          )}
        </ModalHeader>

        <ModalBody>
          {isViewMode && experience ? (
            <div className='space-y-5'>
              {/* Hero Image */}
              <Image
                src={experience.image || '/placeholder-experience.jpg'}
                alt={experience.name}
                width={800}
                height={300}
                className='w-full h-56 object-cover rounded-lg'
              />

              {/* Quick Info Boxes */}
              <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
                <div className='bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700/60 rounded-lg p-3 text-center'>
                  <p className='text-xs text-blue-600 dark:text-blue-300'>
                    Category
                  </p>
                  <p className='text-lg font-bold text-blue-700 dark:text-blue-100 capitalize'>
                    {experience.category}
                  </p>
                </div>
                <div className='bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-700/60 rounded-lg p-3 text-center'>
                  <p className='text-xs text-green-600 dark:text-green-300'>
                    Price
                  </p>
                  <p className='text-lg font-bold text-green-700 dark:text-green-100'>
                    ${experience.price}
                  </p>
                </div>
                <div className='bg-orange-50 dark:bg-orange-900/40 border border-orange-200 dark:border-orange-700/60 rounded-lg p-3 text-center'>
                  <p className='text-xs text-orange-600 dark:text-orange-300'>
                    Difficulty
                  </p>
                  <p className='text-lg font-bold text-orange-700 dark:text-orange-100 capitalize'>
                    {experience.difficulty}
                  </p>
                </div>
                <div className='bg-purple-50 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-700/60 rounded-lg p-3 text-center'>
                  <p className='text-xs text-purple-600 dark:text-purple-300'>
                    Duration
                  </p>
                  <p className='text-lg font-bold text-purple-700 dark:text-purple-100'>
                    {experience.duration}
                  </p>
                </div>
              </div>

              {/* Description */}
              {experience.description && (
                <div>
                  <h4 className='text-sm font-semibold text-default-500 mb-2'>
                    Description
                  </h4>
                  <p className='text-default-700'>{experience.description}</p>
                </div>
              )}

              {/* Long Description */}
              {experience.longDescription && (
                <div>
                  <h4 className='text-sm font-semibold text-default-500 mb-2'>
                    Full Description
                  </h4>
                  <p className='text-default-700'>
                    {experience.longDescription}
                  </p>
                </div>
              )}

              {/* Includes */}
              {experience.includes && experience.includes.length > 0 && (
                <div>
                  <h4 className='text-sm font-semibold text-default-500 mb-2'>
                    Includes
                  </h4>
                  <ul className='text-sm text-default-700 space-y-1'>
                    {experience.includes.map(item => (
                      <li key={item} className='flex items-center gap-2'>
                        <span className='text-success'>&#10003;</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Highlights */}
              {experience.highlights && experience.highlights.length > 0 && (
                <div>
                  <h4 className='text-sm font-semibold text-default-500 mb-2'>
                    Highlights
                  </h4>
                  <div className='flex flex-wrap gap-2'>
                    {experience.highlights.map(highlight => (
                      <Chip
                        key={highlight}
                        color='warning'
                        variant='flat'
                        size='sm'
                      >
                        {highlight}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {/* Requirements */}
              {experience.requirements &&
                experience.requirements.length > 0 && (
                  <div>
                    <h4 className='text-sm font-semibold text-default-500 mb-2'>
                      Requirements
                    </h4>
                    <div className='flex flex-wrap gap-2'>
                      {experience.requirements.map(req => (
                        <Chip key={req} color='danger' variant='flat' size='sm'>
                          {req}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}

              {/* What to Bring */}
              {experience.whatToBring && experience.whatToBring.length > 0 && (
                <div>
                  <h4 className='text-sm font-semibold text-default-500 mb-2'>
                    What to Bring
                  </h4>
                  <div className='flex flex-wrap gap-2'>
                    {experience.whatToBring.map(item => (
                      <Chip key={item} color='default' variant='flat' size='sm'>
                        {item}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {/* Availability */}
              {experience.available && experience.available.length > 0 && (
                <div>
                  <h4 className='text-sm font-semibold text-default-500 mb-2'>
                    Availability
                  </h4>
                  <div className='flex flex-wrap gap-2'>
                    {experience.available.map(avail => (
                      <Chip
                        key={avail}
                        color='success'
                        variant='flat'
                        size='sm'
                      >
                        {avail}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {experience.tags && experience.tags.length > 0 && (
                <div>
                  <h4 className='text-sm font-semibold text-default-500 mb-2'>
                    Tags
                  </h4>
                  <div className='flex flex-wrap gap-2'>
                    {experience.tags.map(tag => (
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

              {/* Details Grid */}
              <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
                {experience.location && (
                  <div className='text-sm'>
                    <span className='text-default-400'>Location: </span>
                    <span className='text-default-700'>
                      {experience.location}
                    </span>
                  </div>
                )}
                {experience.minAge && (
                  <div className='text-sm'>
                    <span className='text-default-400'>Min Age: </span>
                    <span className='text-default-700'>
                      {experience.minAge}+
                    </span>
                  </div>
                )}
                {experience.maxParticipants && (
                  <div className='text-sm'>
                    <span className='text-default-400'>Max Participants: </span>
                    <span className='text-default-700'>
                      {experience.maxParticipants}
                    </span>
                  </div>
                )}
                {experience.cancellationPolicy && (
                  <div className='text-sm'>
                    <span className='text-default-400'>Cancellation: </span>
                    <span className='text-default-700'>
                      {experience.cancellationPolicy}
                    </span>
                  </div>
                )}
              </div>

              {/* Status Chips */}
              <div className='flex gap-2'>
                <Chip
                  color={getDifficultyColor(experience.difficulty)}
                  variant='flat'
                >
                  {experience.difficulty}
                </Chip>
                {experience.isPopular && (
                  <Chip color='danger' variant='flat'>
                    Popular
                  </Chip>
                )}
              </div>
            </div>
          ) : mode === 'create' ? (
            <AddExperienceForm formData={formData} setFormData={setFormData} />
          ) : mode === 'edit' && experience ? (
            <EditExperienceForm
              experience={experience}
              onSave={handleEditSave}
              onCancel={onClose}
              isLoading={isLoading}
            />
          ) : null}
        </ModalBody>

        {isViewMode && (
          <ModalFooter>
            <Button color='default' variant='light' onPress={onClose}>
              Close
            </Button>
            {onEdit && experience && (
              <Button
                color='primary'
                variant='bordered'
                onPress={() => onEdit(experience)}
              >
                Edit Experience
              </Button>
            )}
          </ModalFooter>
        )}

        {mode === 'create' && (
          <ModalFooter>
            <Button color='default' variant='light' onPress={onClose}>
              Cancel
            </Button>
            <Button
              color='primary'
              onPress={handleCreateSubmit}
              isLoading={isLoading}
            >
              Create Experience
            </Button>
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
  );
};

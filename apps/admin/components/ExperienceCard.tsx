'use client';

import { Experience } from '@/types';
import { Button } from '@heroui/button';
import { Card, CardBody } from '@heroui/card';
import { Chip } from '@heroui/chip';
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from '@heroui/dropdown';
import { Eye, Users } from 'lucide-react';
import Image from 'next/image';
import { EditIcon, TrashIcon, VerticalDotsIcon } from './icons';

interface ExperienceCardProps {
  experience: Experience;
  onView?: (experience: Experience) => void;
  onEdit?: (experience: Experience) => void;
  onDelete?: (experience: Experience) => void;
}

export const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'Easy':
      return 'success';
    case 'Moderate':
      return 'warning';
    case 'Challenging':
      return 'danger';
    default:
      return 'default';
  }
};

const getCategoryColor = (category: string) => {
  switch (category?.toLowerCase()) {
    case 'adventure':
      return 'danger';
    case 'nature':
      return 'success';
    case 'culture':
      return 'secondary';
    case 'relaxation':
      return 'primary';
    case 'food & drink':
      return 'warning';
    case 'sports':
      return 'danger';
    default:
      return 'default';
  }
};

export const ExperienceCard = ({
  experience,
  onView,
  onEdit,
  onDelete,
}: ExperienceCardProps) => {
  return (
    <Card
      shadow='sm'
      className='w-full transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5'
    >
      <CardBody
        className='p-0 cursor-pointer'
        onClick={() => onView?.(experience)}
      >
        <div className='relative'>
          <Image
            src={experience.image || '/placeholder-experience.jpg'}
            alt={experience.name}
            className='w-full h-48 object-cover rounded-t-lg'
            width={400}
            height={192}
          />
          <div className='absolute top-2 left-2 flex gap-1 flex-wrap'>
            {experience.isPopular && (
              <Chip
                color='danger'
                variant='solid'
                size='sm'
                className='text-white'
              >
                Popular
              </Chip>
            )}
            {experience.difficulty && (
              <Chip
                color={getDifficultyColor(experience.difficulty)}
                variant='solid'
                size='sm'
                className='text-white'
              >
                {experience.difficulty}
              </Chip>
            )}
          </div>
        </div>

        <div className='p-4'>
          <div className='flex justify-between items-start mb-2'>
            <h3 className='text-lg font-semibold line-clamp-2'>
              {experience.name}
            </h3>
            <div className='flex items-center gap-1 ml-2'>
              <span className='text-lg font-bold text-primary'>
                ${experience.price}
              </span>
              <Dropdown>
                <DropdownTrigger>
                  <Button
                    isIconOnly
                    variant='light'
                    size='sm'
                    aria-label='Experience actions'
                    onClick={e => e.stopPropagation()}
                  >
                    <VerticalDotsIcon size={18} />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label='Experience actions'>
                  {onView ? (
                    <DropdownItem
                      key='view'
                      startContent={<Eye className='w-4 h-4' />}
                      onPress={() => onView(experience)}
                    >
                      View Details
                    </DropdownItem>
                  ) : null}
                  {onEdit ? (
                    <DropdownItem
                      key='edit'
                      startContent={<EditIcon size={16} />}
                      onPress={() => onEdit(experience)}
                    >
                      Edit
                    </DropdownItem>
                  ) : null}
                  {onDelete ? (
                    <DropdownItem
                      key='delete'
                      className='text-danger'
                      color='danger'
                      startContent={<TrashIcon size={16} />}
                      onPress={() => onDelete(experience)}
                    >
                      Delete
                    </DropdownItem>
                  ) : null}
                </DropdownMenu>
              </Dropdown>
            </div>
          </div>

          <p className='text-sm text-default-600 line-clamp-2 mb-3'>
            {experience.description}
          </p>

          <div className='flex gap-2 mb-3 flex-wrap'>
            {experience.category && (
              <Chip
                color={getCategoryColor(experience.category)}
                variant='flat'
                size='sm'
              >
                {experience.category}
              </Chip>
            )}
            {experience.duration && (
              <Chip color='default' variant='flat' size='sm'>
                {experience.duration}
              </Chip>
            )}
          </div>

          <div className='flex justify-between items-center text-sm text-default-600'>
            {experience.maxParticipants && (
              <span className='flex items-center gap-1'>
                <Users className='w-4 h-4' />
                Max {experience.maxParticipants}
              </span>
            )}
            {experience.location && (
              <span className='truncate max-w-[150px]'>
                {experience.location}
              </span>
            )}
          </div>

          {experience.includes && experience.includes.length > 0 && (
            <div className='mt-2'>
              <div className='flex gap-1 flex-wrap'>
                {experience.includes.slice(0, 3).map(item => (
                  <Chip key={item} color='success' variant='dot' size='sm'>
                    {item}
                  </Chip>
                ))}
                {experience.includes.length > 3 && (
                  <Chip color='default' variant='flat' size='sm'>
                    +{experience.includes.length - 3} more
                  </Chip>
                )}
              </div>
            </div>
          )}

          {experience.available && experience.available.length > 0 && (
            <div className='mt-2'>
              <div className='flex gap-1 flex-wrap'>
                {experience.available.map(avail => (
                  <Chip key={avail} color='primary' variant='dot' size='sm'>
                    {avail}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

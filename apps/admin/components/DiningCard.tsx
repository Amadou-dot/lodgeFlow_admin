'use client';

import { Dining } from '@/types';
import { Button } from '@heroui/button';
import { Card, CardBody } from '@heroui/card';
import { Chip } from '@heroui/chip';
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from '@heroui/dropdown';
import { Clock, Eye } from 'lucide-react';
import Image from 'next/image';
import { EditIcon, TrashIcon, VerticalDotsIcon } from './icons';

interface DiningCardProps {
  dining: Dining;
  onView?: (dining: Dining) => void;
  onEdit?: (dining: Dining) => void;
  onDelete?: (dining: Dining) => void;
}

export const getMealTypeColor = (mealType: string) => {
  switch (mealType) {
    case 'breakfast':
      return 'warning';
    case 'lunch':
      return 'primary';
    case 'dinner':
      return 'secondary';
    case 'all-day':
      return 'success';
    default:
      return 'default';
  }
};

export const getCategoryColor = (category: string) => {
  switch (category) {
    case 'craft-beer':
      return 'warning';
    case 'wine':
      return 'danger';
    case 'spirits':
      return 'secondary';
    case 'non-alcoholic':
      return 'success';
    default:
      return 'primary';
  }
};

const formatTime = (time: string) => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

export const DiningCard = ({
  dining,
  onView,
  onEdit,
  onDelete,
}: DiningCardProps) => {
  return (
    <Card
      shadow='sm'
      className='w-full transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5'
    >
      <CardBody className='p-0 cursor-pointer' onClick={() => onView?.(dining)}>
        <div className='relative'>
          <Image
            src={dining.image}
            alt={dining.name}
            className='w-full h-48 object-cover rounded-t-lg'
            width={400}
            height={192}
          />
          <div className='absolute top-2 left-2 flex gap-1 flex-wrap'>
            <Chip
              color={getMealTypeColor(dining.mealType)}
              variant='solid'
              size='sm'
              className='text-white'
            >
              {dining.mealType}
            </Chip>
            {dining.type === 'experience' && (
              <Chip
                color='default'
                variant='solid'
                size='sm'
                className='text-white bg-black/50'
              >
                Experience
              </Chip>
            )}
            {dining.isPopular && (
              <Chip
                color='danger'
                variant='solid'
                size='sm'
                className='text-white'
              >
                Popular
              </Chip>
            )}
          </div>
          {!dining.isAvailable && (
            <div className='absolute inset-0 bg-black/50 flex items-center justify-center'>
              <Chip
                color='default'
                variant='solid'
                size='lg'
                className='text-white'
              >
                Unavailable
              </Chip>
            </div>
          )}
        </div>

        <div className='p-4'>
          <div className='flex justify-between items-start mb-2'>
            <h3 className='text-lg font-semibold line-clamp-2'>
              {dining.name}
            </h3>
            <div className='flex items-center gap-1 ml-2'>
              <span className='text-lg font-bold text-primary'>
                ${dining.price}
              </span>
              <Dropdown>
                <DropdownTrigger>
                  <Button
                    isIconOnly
                    variant='light'
                    size='sm'
                    aria-label='Dining actions'
                    onClick={e => e.stopPropagation()}
                  >
                    <VerticalDotsIcon size={18} />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label='Dining actions'>
                  {onView ? (
                    <DropdownItem
                      key='view'
                      startContent={<Eye className='w-4 h-4' />}
                      onPress={() => onView(dining)}
                    >
                      View Details
                    </DropdownItem>
                  ) : null}
                  {onEdit ? (
                    <DropdownItem
                      key='edit'
                      startContent={<EditIcon size={16} />}
                      onPress={() => onEdit(dining)}
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
                      onPress={() => onDelete(dining)}
                    >
                      Delete
                    </DropdownItem>
                  ) : null}
                </DropdownMenu>
              </Dropdown>
            </div>
          </div>

          <p className='text-sm text-default-600 line-clamp-2 mb-3'>
            {dining.description}
          </p>

          <div className='flex items-center gap-2 mb-2'>
            <Clock className='w-4 h-4 text-default-500' />
            <span className='text-sm text-default-600'>
              {formatTime(dining.servingTime.start)} -{' '}
              {formatTime(dining.servingTime.end)}
            </span>
          </div>

          <div className='flex gap-2 mb-3 flex-wrap'>
            <Chip
              color={getCategoryColor(dining.category)}
              variant='flat'
              size='sm'
            >
              {dining.category.replace('-', ' ')}
            </Chip>
            {dining.subCategory && (
              <Chip color='default' variant='flat' size='sm'>
                {dining.subCategory}
              </Chip>
            )}
          </div>

          <div className='flex justify-between items-center text-sm text-default-600'>
            <span>
              {dining.minPeople === dining.maxPeople
                ? `${dining.maxPeople} person${dining.maxPeople > 1 ? 's' : ''}`
                : `${dining.minPeople}-${dining.maxPeople} people`}
            </span>
            {dining.duration && <span>{dining.duration}</span>}
          </div>

          {dining.dietary && dining.dietary.length > 0 && (
            <div className='mt-2'>
              <div className='flex gap-1 flex-wrap'>
                {dining.dietary.map(diet => (
                  <Chip key={diet} color='success' variant='dot' size='sm'>
                    {diet}
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

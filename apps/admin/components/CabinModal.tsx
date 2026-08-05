'use client';

import { useCreateCabin, useUpdateCabin } from '@/hooks/useCabins';
import type { Cabin } from '@/types';
import { isImageUrl } from '@/utils/utilityFunctions';
import { Button } from '@heroui/button';
import { Chip } from '@heroui/chip';
import { Input, Textarea } from '@heroui/input';
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/modal';
import { Select, SelectItem } from '@heroui/select';
import type { SharedSelection } from '@heroui/system';
import { addToast } from '@heroui/toast';
import Image from 'next/image';
import { useEffect, useState } from 'react';

interface CabinModalProps {
  isOpen: boolean;
  onClose: () => void;
  cabin?: Cabin | null;
  mode: 'view' | 'create' | 'edit';
  onEdit?: (cabin: Cabin) => void;
}

export default function CabinModal({
  isOpen,
  onClose,
  cabin,
  mode,
  onEdit,
}: CabinModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    image: '',
    images: [] as string[],
    status: 'active' as 'active' | 'maintenance' | 'inactive',
    capacity: 0,
    price: 0,
    discount: 0,
    description: '',
    amenities: [] as string[],
    bedrooms: undefined as number | undefined,
    bathrooms: undefined as number | undefined,
    size: undefined as number | undefined,
    minNights: undefined as number | undefined,
    extraGuestFee: 0,
  });

  const [newAmenity, setNewAmenity] = useState('');
  const [newGalleryImage, setNewGalleryImage] = useState('');
  const [isValidImage, setIsValidImage] = useState(false);
  const createCabin = useCreateCabin();
  const updateCabin = useUpdateCabin();

  useEffect(() => {
    if (cabin && (mode === 'edit' || mode === 'view')) {
      setFormData({
        name: cabin.name,
        image: cabin.image,
        images: cabin.images || [],
        status: cabin.status || 'active',
        capacity: cabin.capacity,
        price: cabin.price,
        discount: cabin.discount,
        description: cabin.description,
        amenities: cabin.amenities,
        bedrooms: cabin.bedrooms,
        bathrooms: cabin.bathrooms,
        size: cabin.size,
        minNights: cabin.minNights,
        extraGuestFee: cabin.extraGuestFee || 0,
      });
    } else if (mode === 'create') {
      setFormData({
        name: '',
        image: '',
        images: [],
        status: 'active',
        capacity: 0,
        price: 0,
        discount: 0,
        description: '',
        amenities: [],
        bedrooms: undefined,
        bathrooms: undefined,
        size: undefined,
        minNights: undefined,
        extraGuestFee: 0,
      });
    }
  }, [cabin, mode, isOpen]);

  // Validate image URL whenever it changes
  useEffect(() => {
    const validateImage = async () => {
      if (formData.image.trim()) {
        try {
          const isValid = await isImageUrl(formData.image);
          setIsValidImage(isValid);
        } catch {
          setIsValidImage(false);
        }
      } else {
        setIsValidImage(false);
      }
    };

    validateImage();
  }, [formData.image]);

  const handleSubmit = async () => {
    try {
      if (mode === 'create') {
        await createCabin.mutateAsync(formData);
      } else if (mode === 'edit' && cabin) {
        await updateCabin.mutateAsync({
          ...cabin,
          ...formData,
          _id: cabin._id.toString(),
        });
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

  const addAmenity = () => {
    if (newAmenity.trim() && !formData.amenities.includes(newAmenity.trim())) {
      setFormData(prev => ({
        ...prev,
        amenities: [...prev.amenities, newAmenity.trim()],
      }));
      setNewAmenity('');
    }
  };

  const removeAmenity = (amenityToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.filter(amenity => amenity !== amenityToRemove),
    }));
  };

  const addGalleryImage = () => {
    if (
      newGalleryImage.trim() &&
      !formData.images.includes(newGalleryImage.trim())
    ) {
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, newGalleryImage.trim()],
      }));
      setNewGalleryImage('');
    }
  };

  const removeGalleryImage = (url: string) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter(img => img !== url),
    }));
  };

  const statusColorMap = {
    active: 'success',
    maintenance: 'warning',
    inactive: 'danger',
  } as const;

  const isViewMode = mode === 'view';
  const isLoading = createCabin.isPending || updateCabin.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size='2xl' scrollBehavior='inside'>
      <ModalContent>
        <ModalHeader className='flex flex-col gap-1'>
          {mode === 'view' && `${cabin?.name} - Details`}
          {mode === 'create' && 'Add New Cabin'}
          {mode === 'edit' && `Edit ${cabin?.name}`}
        </ModalHeader>

        <ModalBody>
          {isViewMode ? (
            <div className='space-y-5'>
              {/* Hero Image */}
              {isValidImage && (
                <div className='relative'>
                  <Image
                    src={formData.image}
                    alt={formData.name}
                    width={600}
                    height={300}
                    className='w-full h-56 object-cover rounded-lg'
                  />
                  <Chip
                    color={statusColorMap[formData.status]}
                    variant='solid'
                    size='sm'
                    className='absolute top-2 right-2 shadow-md capitalize'
                  >
                    {formData.status}
                  </Chip>
                </div>
              )}

              {/* Gallery Images */}
              {formData.images.length > 0 && (
                <div className='flex gap-2 overflow-x-auto pb-1'>
                  {formData.images.map((img, idx) => (
                    <Image
                      key={idx}
                      src={img}
                      alt={`${formData.name} gallery ${idx + 1}`}
                      width={120}
                      height={80}
                      className='w-24 h-16 object-cover rounded-md flex-shrink-0'
                    />
                  ))}
                </div>
              )}

              {/* Quick Info Row */}
              <div className='grid grid-cols-3 gap-3'>
                <div className='bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700/60 rounded-lg p-3 text-center'>
                  <p className='text-xs text-blue-600 dark:text-blue-300'>
                    Capacity
                  </p>
                  <p className='text-lg font-bold text-blue-700 dark:text-blue-100'>
                    {formData.capacity} guests
                  </p>
                </div>
                <div className='bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-700/60 rounded-lg p-3 text-center'>
                  <p className='text-xs text-green-600 dark:text-green-300'>
                    Price/Night
                  </p>
                  <p className='text-lg font-bold text-green-700 dark:text-green-100'>
                    ${formData.price}
                  </p>
                </div>
                <div className='bg-orange-50 dark:bg-orange-900/40 border border-orange-200 dark:border-orange-700/60 rounded-lg p-3 text-center'>
                  <p className='text-xs text-orange-600 dark:text-orange-300'>
                    Discount
                  </p>
                  <p className='text-lg font-bold text-orange-700 dark:text-orange-100'>
                    {formData.discount > 0 ? `$${formData.discount}` : '-'}
                  </p>
                </div>
              </div>

              {/* Property Details */}
              {(formData.bedrooms || formData.bathrooms || formData.size) && (
                <div className='grid grid-cols-3 gap-3'>
                  {formData.bedrooms && (
                    <div className='bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-600/60 rounded-lg p-3 text-center'>
                      <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                        Bedrooms
                      </p>
                      <p className='text-lg font-bold text-zinc-800 dark:text-zinc-100'>
                        {formData.bedrooms}
                      </p>
                    </div>
                  )}
                  {formData.bathrooms && (
                    <div className='bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-600/60 rounded-lg p-3 text-center'>
                      <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                        Bathrooms
                      </p>
                      <p className='text-lg font-bold text-zinc-800 dark:text-zinc-100'>
                        {formData.bathrooms}
                      </p>
                    </div>
                  )}
                  {formData.size && (
                    <div className='bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-600/60 rounded-lg p-3 text-center'>
                      <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                        Size
                      </p>
                      <p className='text-lg font-bold text-zinc-800 dark:text-zinc-100'>
                        {formData.size} ft&sup2;
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Booking Rules */}
              {(formData.minNights || formData.extraGuestFee > 0) && (
                <div className='grid grid-cols-2 gap-3'>
                  {formData.minNights && (
                    <div className='bg-purple-50 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-700/60 rounded-lg p-3 text-center'>
                      <p className='text-xs text-purple-600 dark:text-purple-300'>
                        Min. Nights
                      </p>
                      <p className='text-lg font-bold text-purple-700 dark:text-purple-100'>
                        {formData.minNights}
                      </p>
                    </div>
                  )}
                  {formData.extraGuestFee > 0 && (
                    <div className='bg-purple-50 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-700/60 rounded-lg p-3 text-center'>
                      <p className='text-xs text-purple-600 dark:text-purple-300'>
                        Extra Guest Fee
                      </p>
                      <p className='text-lg font-bold text-purple-700 dark:text-purple-100'>
                        ${formData.extraGuestFee}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Effective Price */}
              {formData.discount > 0 && (
                <div className='bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-700/60 rounded-lg p-4'>
                  <div className='flex items-center gap-2'>
                    <span className='text-2xl font-bold text-success'>
                      ${formData.price - formData.discount}
                    </span>
                    <span className='text-default-500 line-through'>
                      ${formData.price}
                    </span>
                    <span className='text-sm text-default-400'>per night</span>
                  </div>
                </div>
              )}

              {/* Description */}
              {formData.description && (
                <div>
                  <h4 className='text-sm font-semibold text-default-500 mb-2'>
                    Description
                  </h4>
                  <p className='text-default-700'>{formData.description}</p>
                </div>
              )}

              {/* Amenities */}
              <div>
                <h4 className='text-sm font-semibold text-default-500 mb-2'>
                  Amenities
                </h4>
                {formData.amenities.length > 0 ? (
                  <div className='flex flex-wrap gap-2'>
                    {formData.amenities.map(amenity => (
                      <Chip key={amenity} color='primary' variant='flat'>
                        {amenity}
                      </Chip>
                    ))}
                  </div>
                ) : (
                  <p className='text-default-400 text-sm'>
                    No amenities listed
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className='space-y-4'>
              {/* Image */}
              <div>
                <label className='text-sm font-medium'>Cabin Image</label>
                {isValidImage && (
                  <div className='mt-2 mb-3'>
                    <Image
                      src={formData.image}
                      alt='Cabin preview'
                      width={400}
                      height={250}
                      className='w-full h-48 object-cover rounded-lg'
                    />
                  </div>
                )}
                <Input
                  type='url'
                  placeholder='Enter image URL'
                  value={formData.image}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, image: e.target.value }))
                  }
                />
              </div>

              {/* Basic Info */}
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <Input
                  label='Cabin Name'
                  placeholder='Enter cabin name'
                  value={formData.name}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, name: e.target.value }))
                  }
                />

                <Input
                  label='Capacity'
                  type='number'
                  placeholder='Number of guests'
                  value={formData.capacity.toString()}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      capacity: parseInt(e.target.value) || 0,
                    }))
                  }
                  min='1'
                  max='12'
                />
              </div>

              {/* Pricing */}
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <Input
                  label='Price per Night'
                  type='number'
                  placeholder='Enter price'
                  value={formData.price.toString()}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      price: parseInt(e.target.value) || 0,
                    }))
                  }
                  startContent='$'
                  min='0'
                />

                <Input
                  label='Discount'
                  type='number'
                  placeholder='Enter discount'
                  value={formData.discount.toString()}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      discount: parseInt(e.target.value) || 0,
                    }))
                  }
                  startContent='$'
                  min='0'
                />
              </div>

              {/* Status (edit mode only) */}
              {mode === 'edit' && (
                <Select
                  label='Status'
                  selectedKeys={[formData.status]}
                  onSelectionChange={(keys: SharedSelection) => {
                    const value = Array.from(keys)[0] as
                      | 'active'
                      | 'maintenance'
                      | 'inactive';
                    if (value)
                      setFormData(prev => ({ ...prev, status: value }));
                  }}
                  variant='bordered'
                >
                  <SelectItem key='active'>Active</SelectItem>
                  <SelectItem key='maintenance'>Maintenance</SelectItem>
                  <SelectItem key='inactive'>Inactive</SelectItem>
                </Select>
              )}

              {/* Property Details */}
              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                <Input
                  label='Bedrooms'
                  type='number'
                  placeholder='e.g. 2'
                  value={
                    formData.bedrooms !== undefined
                      ? formData.bedrooms.toString()
                      : ''
                  }
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      bedrooms: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    }))
                  }
                  min='1'
                />
                <Input
                  label='Bathrooms'
                  type='number'
                  placeholder='e.g. 1'
                  value={
                    formData.bathrooms !== undefined
                      ? formData.bathrooms.toString()
                      : ''
                  }
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      bathrooms: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    }))
                  }
                  min='1'
                />
                <Input
                  label='Size (sq ft)'
                  type='number'
                  placeholder='e.g. 1200'
                  value={
                    formData.size !== undefined ? formData.size.toString() : ''
                  }
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      size: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    }))
                  }
                  min='1'
                />
              </div>

              {/* Booking Rules */}
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <Input
                  label='Min. Nights'
                  type='number'
                  placeholder='Override global minimum'
                  value={
                    formData.minNights !== undefined
                      ? formData.minNights.toString()
                      : ''
                  }
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      minNights: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    }))
                  }
                  min='1'
                />
                <Input
                  label='Extra Guest Fee'
                  type='number'
                  placeholder='Per guest above base'
                  value={formData.extraGuestFee.toString()}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      extraGuestFee: parseInt(e.target.value) || 0,
                    }))
                  }
                  startContent='$'
                  min='0'
                />
              </div>

              {/* Description */}
              <Textarea
                label='Description'
                placeholder='Enter cabin description'
                value={formData.description}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData(prev => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                minRows={3}
              />

              {/* Gallery Images */}
              <div>
                <label className='text-sm font-medium mb-2 block'>
                  Gallery Images
                </label>

                <div className='flex gap-2 mb-3'>
                  <Input
                    placeholder='Add image URL'
                    value={newGalleryImage}
                    onChange={e => setNewGalleryImage(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && addGalleryImage()}
                    className='flex-1'
                  />
                  <Button
                    color='primary'
                    onPress={addGalleryImage}
                    isDisabled={!newGalleryImage.trim()}
                  >
                    Add
                  </Button>
                </div>

                {formData.images.length > 0 && (
                  <div className='flex flex-wrap gap-2'>
                    {formData.images.map((img, idx) => (
                      <div key={idx} className='relative group'>
                        <Image
                          src={img}
                          alt={`Gallery ${idx + 1}`}
                          width={80}
                          height={60}
                          className='w-20 h-14 object-cover rounded-md'
                        />
                        <button
                          type='button'
                          onClick={() => removeGalleryImage(img)}
                          className='absolute -top-1 -right-1 w-5 h-5 bg-danger text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity'
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Amenities */}
              <div>
                <label className='text-sm font-medium mb-2 block'>
                  Amenities
                </label>

                <div className='flex gap-2 mb-3'>
                  <Input
                    placeholder='Add amenity'
                    value={newAmenity}
                    onChange={e => setNewAmenity(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && addAmenity()}
                    className='flex-1'
                  />
                  <Button
                    color='primary'
                    onPress={addAmenity}
                    isDisabled={!newAmenity.trim()}
                  >
                    Add
                  </Button>
                </div>

                <div className='flex flex-wrap gap-2'>
                  {formData.amenities.map(amenity => (
                    <Chip
                      key={amenity}
                      color='primary'
                      variant='flat'
                      onClose={() => removeAmenity(amenity)}
                    >
                      {amenity}
                    </Chip>
                  ))}
                  {formData.amenities.length === 0 && (
                    <span className='text-default-400 text-sm'>
                      No amenities added
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button color='default' variant='light' onPress={onClose}>
            {isViewMode ? 'Close' : 'Cancel'}
          </Button>

          {isViewMode && onEdit && cabin && (
            <Button
              color='primary'
              variant='bordered'
              onPress={() => onEdit(cabin)}
            >
              Edit Cabin
            </Button>
          )}

          {!isViewMode && (
            <Button
              color='primary'
              onPress={handleSubmit}
              isLoading={isLoading}
              isDisabled={!formData.name.trim() || !formData.image.trim()}
            >
              {mode === 'create' ? 'Create Cabin' : 'Save Changes'}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

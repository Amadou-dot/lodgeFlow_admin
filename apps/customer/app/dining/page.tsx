'use client';

import { Button } from '@heroui/button';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Chip } from '@heroui/chip';
import { Link } from '@heroui/link';
import { Select, SelectItem } from '@heroui/select';
import { Spinner } from '@heroui/spinner';

import { subtitle, title } from '@/components/primitives';
import { useDining } from '@/hooks/useDining';
import type { Dining, DiningQueryParams } from '@/types';
import Image from 'next/image';
import NextLink from 'next/link';
import { useState } from 'react';
import { Mail, Phone } from 'lucide-react';

export default function DiningPage() {
  const [filters, setFilters] = useState<DiningQueryParams>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Combine filters with search and sorting
  const queryParams: DiningQueryParams = {
    ...filters,
    search: searchTerm || undefined,
  };

  const { data: diningData, isLoading, error } = useDining(queryParams);

  // Sort options for the filters
  const sortOptions = [
    { key: 'name', label: 'Name', value: 'name' },
    { key: 'price', label: 'Price', value: 'price' },
    { key: 'mealType', label: 'Meal Type', value: 'mealType' },
    { key: 'type', label: 'Type', value: 'type' },
  ];

  // Handle search change
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  // Handle sort change
  const handleSortChange = (sortValue: string) => {
    setSortBy(sortValue);
  };

  // Handle sort order change
  const handleSortOrderChange = (order: 'asc' | 'desc') => {
    setSortOrder(order);
  };

  // Sort the data based on current sort settings
  const sortedData = diningData
    ? [...diningData].sort((a, b) => {
        let aValue: any = a[sortBy as keyof Dining];
        let bValue: any = b[sortBy as keyof Dining];

        // Handle different data types
        if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }

        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      })
    : [];

  // Additional filters component
  const additionalFilters = (
    <div className='flex flex-wrap gap-2'>
      <Select
        className='w-40'
        placeholder='Filter by type'
        selectedKeys={filters.type ? [filters.type] : []}
        size='sm'
        onSelectionChange={keys => {
          const selected = Array.from(keys)[0] as string;
          setFilters(prev => ({ ...prev, type: selected as any }));
        }}
      >
        <SelectItem key='menu'>Menu Items</SelectItem>
        <SelectItem key='experience'>Experiences</SelectItem>
      </Select>

      <Select
        className='w-40'
        placeholder='Filter by meal'
        selectedKeys={filters.mealType ? [filters.mealType] : []}
        size='sm'
        onSelectionChange={keys => {
          const selected = Array.from(keys)[0] as string;
          setFilters(prev => ({ ...prev, mealType: selected as any }));
        }}
      >
        <SelectItem key='breakfast'>Breakfast</SelectItem>
        <SelectItem key='lunch'>Lunch</SelectItem>
        <SelectItem key='dinner'>Dinner</SelectItem>
        <SelectItem key='all-day'>All Day</SelectItem>
      </Select>

      <Select
        className='w-40'
        placeholder='Filter by category'
        selectedKeys={filters.category ? [filters.category] : []}
        size='sm'
        onSelectionChange={keys => {
          const selected = Array.from(keys)[0] as string;
          setFilters(prev => ({ ...prev, category: selected as any }));
        }}
      >
        <SelectItem key='regular'>Regular</SelectItem>
        <SelectItem key='craft-beer'>Craft Beer</SelectItem>
        <SelectItem key='wine'>Wine</SelectItem>
        <SelectItem key='spirits'>Spirits</SelectItem>
        <SelectItem key='non-alcoholic'>Non-Alcoholic</SelectItem>
      </Select>

      <Button
        size='sm'
        variant='bordered'
        onPress={() => {
          setFilters({});
          setSearchTerm('');
        }}
      >
        Clear Filters
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <div className='flex justify-center items-center min-h-screen'>
        <Spinner size='lg' />
      </div>
    );
  }

  if (error) {
    return (
      <div className='text-center py-8'>
        <h2 className={title({ size: 'md' })}>Error Loading Dining Options</h2>
        <p className='text-default-600 mt-4'>
          We're having trouble loading the dining menu. Please try again later.
        </p>
      </div>
    );
  }

  if (!diningData || diningData.length === 0) {
    return (
      <div className='space-y-12 py-8'>
        {/* Header Section */}
        <section className='text-center'>
          <h1 className={title({ size: 'lg' })}>
            Culinary{' '}
            <span className={title({ color: 'green', size: 'lg' })}>
              Excellence
            </span>
          </h1>
          <p className={subtitle({ class: 'mt-4 max-w-3xl mx-auto' })}>
            Experience farm-to-table dining at its finest. Our culinary team
            transforms locally sourced, seasonal ingredients into unforgettable
            meals that celebrate the flavors of our region.
          </p>
        </section>

        <div className='text-center py-8'>
          <h2 className={title({ size: 'md' })}>Coming Soon</h2>
          <p className='text-default-600 mt-4'>
            Our dining menu is being prepared. Please check back soon for our
            complete culinary offerings.
          </p>
        </div>
      </div>
    );
  }

  // Use sorted data instead of original diningData
  const menusByMealType =
    sortedData
      ?.filter(item => item.type === 'menu')
      .reduce(
        (acc, item) => {
          if (!acc[item.mealType]) {
            acc[item.mealType] = [];
          }
          acc[item.mealType].push(item);
          return acc;
        },
        {} as Record<string, Dining[]>
      ) || {};

  // Get dining experiences
  const diningExperiences =
    sortedData?.filter(item => item.type === 'experience') || [];

  // Group beverages by category
  const beveragesByCategory =
    sortedData
      ?.filter(item => item.category !== 'regular')
      .reduce(
        (acc, item) => {
          if (!acc[item.category]) {
            acc[item.category] = [];
          }
          acc[item.category].push(item);
          return acc;
        },
        {} as Record<string, Dining[]>
      ) || {};

  const mealTypeDisplayNames = {
    breakfast: 'Farm-to-Table Breakfast',
    lunch: 'Artisan Lunch',
    dinner: 'Gourmet Dinner',
    'all-day': 'All-Day Dining',
  };

  const mealTypeDescriptions = {
    breakfast:
      'Start your day with fresh, locally sourced ingredients prepared to perfection.',
    lunch: 'Light, fresh meals perfect for fueling your outdoor adventures.',
    dinner:
      'Elevated dining experiences showcasing the best of regional cuisine.',
    'all-day': 'Available throughout the day for your convenience.',
  };

  return (
    <div className='space-y-12 py-8'>
      {/* Header Section */}
      <section className='text-center'>
        <h1 className={title({ size: 'lg' })}>
          Culinary{' '}
          <span className={title({ color: 'green', size: 'lg' })}>
            Excellence
          </span>
        </h1>
        <p className={subtitle({ class: 'mt-4 max-w-3xl mx-auto' })}>
          Experience farm-to-table dining at its finest. Our culinary team
          transforms locally sourced, seasonal ingredients into unforgettable
          meals that celebrate the flavors of our region.
        </p>
      </section>

      {/* Loading State */}
      {isLoading && (
        <div className='flex flex-col justify-center items-center py-12 gap-4'>
          <Spinner label='Loading dining options...' size='lg' />
        </div>
      )}

      {/* No Results */}
      {!isLoading && sortedData && sortedData.length === 0 && (
        <div className='text-center py-12'>
          <h3 className='text-xl font-semibold mb-2'>
            No dining options found
          </h3>
          <p className='text-default-500 mb-4'>
            Try adjusting your search or filters to see more options.
          </p>
        </div>
      )}

      {/* Results when we have data */}
      {!isLoading && sortedData && sortedData.length > 0 && (
        <>
          {/* Philosophy Section */}
          <section className='bg-green-50 dark:bg-green-950 rounded-2xl p-8'>
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-8 items-center'>
              <div>
                <h2 className={title({ size: 'md' })}>
                  Our Culinary Philosophy
                </h2>
                <div className='space-y-4 mt-6 text-default-600'>
                  <p>
                    At LodgeFlow, we believe great food connects us to the land
                    and each other. Our executive chef works with local farmers,
                    foragers, and artisans to create menus that change with the
                    seasons.
                  </p>
                  <p>
                    Every ingredient tells a story - from the wild mushrooms
                    gathered in our own forests to the organic vegetables grown
                    in nearby farms. We're committed to sustainable practices
                    that honor both our guests and our environment.
                  </p>
                </div>
                <div className='flex flex-wrap gap-2 mt-6'>
                  <Chip color='success' variant='flat'>
                    Locally Sourced
                  </Chip>
                  <Chip color='success' variant='flat'>
                    Organic
                  </Chip>
                  <Chip color='success' variant='flat'>
                    Sustainable
                  </Chip>
                  <Chip color='success' variant='flat'>
                    Seasonal Menu
                  </Chip>
                </div>
              </div>
              <div className='relative h-64 lg:h-80'>
                <Image
                  alt='Dining Philosophy'
                  className='rounded-2xl'
                  fill
                  src='https://images.unsplash.com/photo-1684954215462-cad9f3693b41?q=80&w=1740&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
                  style={{ objectFit: 'cover' }}
                />
              </div>
            </div>
          </section>
          {/* Daily Menus */}
          <section>
            <div className='text-center mb-8'>
              <h2 className={title({ size: 'md' })}>Daily Dining</h2>
              <p className={subtitle({ class: 'mt-4' })}>
                Seasonal menus that showcase the best of local ingredients
              </p>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {Object.entries(menusByMealType).map(([mealType, items]) => {
                const displayName =
                  mealTypeDisplayNames[
                    mealType as keyof typeof mealTypeDisplayNames
                  ] || mealType;
                const description =
                  mealTypeDescriptions[
                    mealType as keyof typeof mealTypeDescriptions
                  ];
                const servingTime =
                  items.length > 0
                    ? `${items[0].servingTime.start} - ${items[0].servingTime.end}`
                    : '';

                // Get the CTA text based on meal type
                const getCtaText = (mealType: string) => {
                  switch (mealType) {
                    case 'breakfast':
                      return 'Reserve Breakfast';
                    case 'lunch':
                      return 'Reserve Lunch';
                    case 'dinner':
                      return 'Reserve Dinner';
                    case 'all-day':
                      return 'Reserve Meal';
                    default:
                      return 'Reserve Meal';
                  }
                };

                return (
                  <Card key={mealType} className='py-4 flex flex-col h-full'>
                    {/* Image Section */}
                    {items.length > 0 && items[0].image && (
                      <div className='relative w-full h-48 mb-4'>
                        <Image
                          alt={displayName}
                          className='rounded-t-lg'
                          fill
                          src={items[0].image}
                          style={{ objectFit: 'cover' }}
                        />
                      </div>
                    )}

                    <CardHeader className='pb-0 pt-2 px-4 flex-col items-start'>
                      <h4 className='font-bold text-large'>{displayName}</h4>
                      {servingTime && (
                        <Chip
                          className='mt-2'
                          color='primary'
                          size='sm'
                          variant='flat'
                        >
                          {servingTime}
                        </Chip>
                      )}
                      <p className='text-default-600 mt-3 text-sm'>
                        {description}
                      </p>
                    </CardHeader>

                    <CardBody className='overflow-visible py-2 flex flex-col flex-grow'>
                      {/* Featured Dishes */}
                      <div className='space-y-3 mb-4 flex-grow'>
                        {items.slice(0, 3).map(dish => (
                          <div
                            key={dish._id.toString()}
                            className='border-b border-default-200 pb-3 last:border-b-0'
                          >
                            <div className='flex justify-between items-start mb-1'>
                              <h5 className='font-semibold text-sm'>
                                {dish.name}
                              </h5>
                              <span className='text-green-600 font-bold text-sm'>
                                ${dish.price}
                              </span>
                            </div>
                            <p className='text-xs text-default-500 mb-2'>
                              {dish.description}
                            </p>
                            {dish.dietary && dish.dietary.length > 0 && (
                              <div className='flex flex-wrap gap-1'>
                                {dish.dietary.slice(0, 2).map(diet => (
                                  <Chip
                                    key={diet}
                                    color='success'
                                    size='sm'
                                    variant='flat'
                                  >
                                    {diet}
                                  </Chip>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <NextLink
                        href={`/dining/${items[0]._id.toString()}/reserve`}
                      >
                        <Button
                          className='w-full mt-auto'
                          color='primary'
                          size='sm'
                        >
                          {getCtaText(mealType)}
                        </Button>
                      </NextLink>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          </section>
          ;{/* Special Dining Experiences */}
          <section>
            <div className='text-center mb-8'>
              <h2 className={title({ size: 'md' })}>
                Special Dining Experiences
              </h2>
              <p className={subtitle({ class: 'mt-4' })}>
                Unique culinary adventures beyond our regular dining service
              </p>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
              {diningExperiences.map(experience => (
                <Card
                  key={experience._id.toString()}
                  className='py-4 flex flex-col h-full'
                >
                  <CardHeader className='pb-0 pt-2 px-4 flex-col items-start'>
                    <h4 className='font-bold text-large'>{experience.name}</h4>
                    <div className='flex items-center gap-2 text-small text-default-500 mt-1'>
                      {experience.duration && (
                        <>
                          <span>⏱️ {experience.duration}</span>
                          <span>•</span>
                        </>
                      )}
                      <span>👥 Max {experience.maxPeople}</span>
                    </div>
                    <div className='mt-2'>
                      <span className='text-2xl font-bold text-green-600'>
                        ${experience.price}
                      </span>
                      <span className='text-sm text-default-500'>/person</span>
                    </div>
                  </CardHeader>
                  <CardBody className='overflow-visible py-2 flex flex-col flex-grow'>
                    <div className='relative mb-4'>
                      <Image
                        alt={experience.name}
                        className='w-full h-32 object-cover rounded-lg'
                        height={128}
                        src={experience.image}
                        width={300}
                      />
                    </div>

                    <div className='flex-grow'>
                      <p className='text-default-500 mb-3 text-sm'>
                        {experience.description}
                      </p>

                      {experience.includes &&
                        experience.includes.length > 0 && (
                          <div className='mb-4'>
                            <h5 className='text-sm font-semibold mb-2'>
                              Includes:
                            </h5>
                            <div className='space-y-1'>
                              {experience.includes
                                .slice(0, 4)
                                .map((item, itemIndex) => (
                                  <div
                                    key={itemIndex}
                                    className='flex items-center gap-2 text-sm'
                                  >
                                    <span className='text-green-500'>✓</span>
                                    <span className='text-default-600'>
                                      {item}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                    </div>

                    <NextLink
                      href={`/dining/${experience._id.toString()}/reserve`}
                    >
                      <Button
                        className='w-full mt-auto'
                        color='primary'
                        size='sm'
                      >
                        Reserve Experience
                      </Button>
                    </NextLink>
                  </CardBody>
                </Card>
              ))}
            </div>
          </section>
          ;{/* Beverages Section */}
          <section className='bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 rounded-2xl p-8'>
            <div className='text-center mb-8'>
              <h2 className={title({ size: 'md' })}>Curated Beverages</h2>
              <p className={subtitle({ class: 'mt-4' })}>
                Local wines, craft beers, artisan spirits, and non-alcoholic
                options
              </p>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
              {Object.entries(beveragesByCategory).map(([category, items]) => {
                const categoryDisplayNames = {
                  'craft-beer': 'Local Craft Beer',
                  wine: 'Regional Wines',
                  spirits: 'Artisan Spirits',
                  'non-alcoholic': 'Non-Alcoholic',
                };

                return (
                  <Card
                    key={category}
                    className='py-4 bg-white dark:bg-default-100 flex flex-col h-full'
                  >
                    {/* Image Section */}
                    {items.length > 0 && items[0].image && (
                      <div className='relative w-full h-32 mb-4'>
                        <Image
                          className='rounded-t-lg'
                          fill
                          src={items[0].image}
                          style={{ objectFit: 'cover' }}
                          alt={
                            categoryDisplayNames[
                              category as keyof typeof categoryDisplayNames
                            ] || category
                          }
                        />
                      </div>
                    )}

                    <CardHeader className='pb-0 pt-2 px-4 flex-col items-start'>
                      <h4 className='font-bold text-center w-full mb-3'>
                        {categoryDisplayNames[
                          category as keyof typeof categoryDisplayNames
                        ] || category}
                      </h4>
                    </CardHeader>

                    <CardBody className='overflow-visible py-2 flex flex-col flex-grow'>
                      <div className='flex-grow'>
                        <ul className='space-y-2'>
                          {items.slice(0, 5).map(item => (
                            <li
                              key={item._id.toString()}
                              className='text-sm text-default-600 text-center border-b border-default-200 pb-2 last:border-b-0'
                            >
                              <div className='font-medium'>{item.name}</div>
                              {item.price && (
                                <span className='text-xs text-green-600'>
                                  ${item.price}
                                </span>
                              )}
                              {item.description && (
                                <p className='text-xs text-default-500 mt-1'>
                                  {item.description.substring(0, 50)}...
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>

                        {items.length > 5 && (
                          <div className='text-center mt-3'>
                            <span className='text-xs text-default-400'>
                              +{items.length - 5} more options
                            </span>
                          </div>
                        )}
                      </div>

                      <Button
                        className='w-full mt-auto'
                        color='primary'
                        size='sm'
                        variant='bordered'
                      >
                        View Full Selection
                      </Button>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          </section>
          ;{/* Reservations CTA */}
          <section className='text-center'>
            <h3 className={title({ size: 'sm' })}>Ready to Dine With Us?</h3>
            <p className={subtitle({ class: 'mt-2 mb-6' })}>
              Reservations are recommended, especially for dinner and special
              experiences
            </p>

            <div className='flex flex-col sm:flex-row gap-4 justify-center'>
              <Button
                as={Link}
                color='primary'
                href='tel:+1-800-LODGEFLOW'
                size='lg'
                startContent={<Phone className='w-4 h-4' />}
              >
                Make Reservation
              </Button>
              <Button
                as={Link}
                href='mailto:dining@lodgeflow.app'
                size='lg'
                startContent={<Mail className='w-4 h-4' />}
                variant='bordered'
              >
                Special Requests
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

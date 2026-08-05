'use client';
import { useExperiences } from '@/hooks/useExperiences';
import { Spinner } from '@heroui/spinner';
import { Mail, Phone } from 'lucide-react';

import {
  CallToActionSection,
  PageHeader,
  PricingGrid,
  SectionHeader,
} from '@/components/ui';

export default function ExperiencesPage() {
  const { data: experiences = [], isLoading, error } = useExperiences();

  const categories = [
    { name: 'All Experiences', count: experiences.length },
    {
      name: 'Nature',
      count: experiences.filter(e => e.category === 'Nature').length,
    },
    {
      name: 'Adventure',
      count: experiences.filter(e => e.category === 'Adventure').length,
    },
    {
      name: 'Water Sports',
      count: experiences.filter(e => e.category === 'Water Sports').length,
    },
    {
      name: 'Wellness',
      count: experiences.filter(e => e.category === 'Wellness').length,
    },
    {
      name: 'Creative',
      count: experiences.filter(e => e.category === 'Creative').length,
    },
  ];

  return (
    <div className='space-y-12 py-8'>
      {/* Header Section */}
      <PageHeader
        subtitle='Immerse yourself in nature with our carefully curated adventures and activities. From peaceful meditation sessions to thrilling mountain expeditions, discover the perfect way to connect with the wilderness.'
        title='Wild'
        titleAccent='Experiences'
      />

      {/* Loading State */}
      {isLoading && (
        <div className='flex flex-col justify-center items-center py-12 gap-4'>
          <Spinner label='Loading experiences...' size='lg' />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className='flex justify-center items-center py-12'>
          <div className='text-lg text-red-500'>
            Error loading experiences:{' '}
            {error instanceof Error ? error.message : 'An error occurred'}
          </div>
        </div>
      )}

      {/* Content - only show if not loading */}
      {!isLoading && (
        <>
          {/* Categories Overview */}
          <section className='bg-green-50 dark:bg-green-950 rounded-2xl p-8'>
            <SectionHeader
              className='mb-8'
              subtitle='Choose from our diverse range of outdoor activities'
              title='Experience Categories'
            />

            <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4'>
              {categories.map((category, index) => (
                <div
                  key={index}
                  className='text-center p-4 bg-white dark:bg-gray-800 rounded-lg'
                >
                  <div className='text-2xl font-bold text-green-600 mb-1'>
                    {category.count}
                  </div>
                  <div className='text-sm text-default-600'>
                    {category.name}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Experiences Grid */}
          <section>
            <SectionHeader
              className='mb-12'
              subtitle='Book your next adventure and create unforgettable memories'
              title='Available Experiences'
            />

            <PricingGrid
              columns={3}
              items={experiences.map(exp => ({
                ...exp,
                ctaHref: `/experiences/${exp._id}`,
              }))}
            />
          </section>

          {/* Booking Information */}
          <section className='bg-blue-50 dark:bg-blue-950 rounded-2xl p-8'>
            <SectionHeader className='mb-8' title='Booking Information' />

            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              <div className='space-y-2'>
                <h4 className='font-semibold text-blue-600'>🎯 Easy Booking</h4>
                <p className='text-sm text-default-600'>
                  Reserve your spot with just a few clicks. All experiences can
                  be booked online or by phone.
                </p>
              </div>
              <div className='space-y-2'>
                <h4 className='font-semibold text-blue-600'>
                  📅 Flexible Scheduling
                </h4>
                <p className='text-sm text-default-600'>
                  Most experiences are available daily with flexible timing to
                  fit your itinerary.
                </p>
              </div>
              <div className='space-y-2'>
                <h4 className='font-semibold text-blue-600'>
                  👨‍🏫 Expert Guides
                </h4>
                <p className='text-sm text-default-600'>
                  All activities are led by certified professionals with
                  extensive local knowledge.
                </p>
              </div>
              <div className='space-y-2'>
                <h4 className='font-semibold text-blue-600'>
                  🎒 Equipment Included
                </h4>
                <p className='text-sm text-default-600'>
                  We provide all necessary equipment and safety gear for your
                  adventures.
                </p>
              </div>
              <div className='space-y-2'>
                <h4 className='font-semibold text-blue-600'>
                  🌤️ Weather Policy
                </h4>
                <p className='text-sm text-default-600'>
                  Full refund or rescheduling available for weather-related
                  cancellations.
                </p>
              </div>
              <div className='space-y-2'>
                <h4 className='font-semibold text-blue-600'>
                  👥 Group Discounts
                </h4>
                <p className='text-sm text-default-600'>
                  Special rates available for groups of 4 or more. Contact us
                  for pricing.
                </p>
              </div>
            </div>
          </section>

          {/* Call to Action */}
          <CallToActionSection
            subtitle='Contact our adventure specialists to plan the perfect wilderness experience tailored to your interests and skill level.'
            title='Ready for Your Next Adventure?'
            buttons={[
              {
                label: 'Contact Us',
                href: '/contact',
                color: 'primary',
                startContent: <Mail className='w-4 h-4' />,
              },
              {
                label: 'Call Now',
                href: 'tel:+1-800-LODGEFLOW',
                variant: 'bordered',
                startContent: <Phone className='w-4 h-4' />,
              },
            ]}
          />
        </>
      )}
    </div>
  );
}

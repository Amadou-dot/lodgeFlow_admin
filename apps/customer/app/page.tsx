import { Link } from '@heroui/link';
import { Button } from '@heroui/button';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Chip } from '@heroui/chip';
import { Image } from '@heroui/image';
import { Phone, Mail } from 'lucide-react';

import { siteConfig } from '@/config/site';
import { siteToLodgingBusiness } from '@/lib/seo/jsonLd';
import { connectDB, Cabin } from '@/models';
import {
  HeroSection,
  SectionHeader,
  FeatureGrid,
  CallToActionSection,
} from '@/components/ui';

async function getFeaturedCabins() {
  try {
    await connectDB();
    const cabins = await Cabin.find({}).limit(3).sort({ price: 1 });
    return cabins;
  } catch (error) {
    console.error('Error fetching featured cabins:', error);
    return [];
  }
}

export default async function Home() {
  const featuredCabins = await getFeaturedCabins();

  const features = [
    {
      title: 'Luxury Cabins',
      description: 'Premium accommodations nestled in pristine wilderness',
      image:
        'https://images.unsplash.com/photo-1740446568651-1d31966b228a?q=80&w=1740&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      imagePlaceholder: 'Luxury Cabins Image',
    },
    {
      title: 'Fine Dining',
      description: 'Gourmet cuisine crafted with local, organic ingredients',
      image:
        'https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=1548&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      imagePlaceholder: 'Fine Dining Image',
    },
    {
      title: 'Nature Activities',
      description: 'Hiking, fishing, wildlife watching, and more adventures',
      image:
        'https://images.unsplash.com/photo-1501555088652-021faa106b9b?q=80&w=1746&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      imagePlaceholder: 'Nature Activities Image',
    },
  ];

  return (
    <div className='space-y-16 py-8'>
      <script type='application/ld+json'>
        {JSON.stringify(siteToLodgingBusiness())}
      </script>
      {/* Hero Section */}
      <HeroSection
        subtitle='Escape to paradise. Experience luxury in the heart of untouched nature, where comfort meets wilderness in perfect harmony.'
        title='Welcome to'
        titleAccent='LodgeFlow'
        buttons={[
          {
            label: 'Explore Cabins',
            href: '/cabins',
            color: 'primary',
          },
          {
            label: 'Learn More',
            href: '/about',
            variant: 'bordered',
          },
        ]}
      />

      {/* Features Section */}
      <section className='container mx-auto px-6'>
        <SectionHeader
          className='mb-12'
          subtitle='Discover what makes LodgeFlow the perfect retreat'
          title="Experience Nature's Luxury"
        />
        <FeatureGrid features={features} />
      </section>

      {/* Featured Cabins Section */}
      <section className='container mx-auto px-6'>
        <SectionHeader
          className='mb-12'
          subtitle='Discover our most popular accommodations'
          title='Featured Cabins'
        />

        <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
          {featuredCabins.map((cabin: any) => {
            const effectivePrice = cabin.price - (cabin.discount || 0);
            const hasDiscount = cabin.discount > 0;

            return (
              <Card
                key={cabin._id.toString()}
                className='py-4 hover:shadow-lg transition-shadow'
              >
                <CardHeader className='pb-0 pt-2 px-4 flex-col items-start'>
                  <div className='flex justify-between items-start w-full mb-2'>
                    <h4 className='font-bold text-large'>{cabin.name}</h4>
                    {hasDiscount && (
                      <Chip color='danger' size='sm' variant='flat'>
                        Save ${cabin.discount}
                      </Chip>
                    )}
                  </div>
                  <div className='flex items-center gap-2 text-small text-default-500'>
                    <span>👥 Up to {cabin.capacity} guests</span>
                    <span>•</span>
                    <div className='flex items-center gap-1'>
                      {hasDiscount && (
                        <span className='line-through text-default-400'>
                          ${cabin.price}
                        </span>
                      )}
                      <span className='font-semibold text-green-600'>
                        ${effectivePrice}/night
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardBody className='overflow-visible py-2'>
                  <div className='relative mb-4'>
                    <Image
                      alt={`${cabin.name} - Luxury cabin at LodgeFlow`}
                      className='w-full h-48 object-cover rounded-lg'
                      fallbackSrc='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDMwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMjUgNzVMMTUwIDEwMEwxNzUgNzVMMjAwIDEwMFYxNTBIMTAwVjEwMEwxMjUgNzVaIiBmaWxsPSIjOUNBM0FGIi8+CjxjaXJjbGUgY3g9IjEzMCIgY3k9IjkwIiByPSI1IiBmaWxsPSIjOUNBM0FGIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iMTEwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjM3MzgxIiBmb250LXNpemU9IjEyIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiI+SW1hZ2UgTm90IEZvdW5kPC90ZXh0Pgo8L3N2Zz4K'
                      src={cabin.image}
                      classNames={{
                        wrapper: 'w-full h-48',
                        img: 'w-full h-full object-cover',
                      }}
                    />
                  </div>
                  <p className='text-default-500 text-small mb-4'>
                    {cabin.description}
                  </p>
                  <Button
                    as={Link}
                    className='w-full'
                    color='primary'
                    href={`/cabins/${cabin._id}`}
                  >
                    View Details
                  </Button>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Call to Action */}
      <CallToActionSection
        subtitle='Book your perfect getaway at LodgeFlow today and create memories that will last a lifetime.'
        title='Ready for Your Escape?'
        buttons={[
          {
            label: 'Browse All Cabins',
            href: '/cabins',
            color: 'primary',
          },
          {
            label: 'View Experiences',
            href: '/experiences',
            variant: 'bordered',
          },
        ]}
      />

      {/* Contact Section */}
      <section className='bg-green-50 dark:bg-green-950 rounded-2xl p-8 text-center'>
        <h3 className='text-xl font-bold'>Need Help Planning?</h3>
        <p className='text-default-600 mt-2 mb-6'>
          Our team is here to help you create the perfect wilderness getaway
        </p>
        <div className='flex flex-col sm:flex-row gap-4 justify-center'>
          <Button
            as={Link}
            color='primary'
            href='tel:+1-800-LODGEFLOW'
            startContent={<Phone className='w-4 h-4' />}
          >
            Call Us
          </Button>
          <Button
            as={Link}
            href={siteConfig.links.email}
            startContent={<Mail className='w-4 h-4' />}
            variant='bordered'
          >
            Email Us
          </Button>
        </div>
      </section>
    </div>
  );
}

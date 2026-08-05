'use client';

import { Card, CardBody } from '@heroui/card';
import { Button } from '@heroui/button';
import { Input, Textarea } from '@heroui/input';
import { Link } from '@heroui/link';
import { Skeleton } from '@heroui/skeleton';
import {
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  Instagram,
  Facebook,
} from 'lucide-react';

import { siteConfig } from '@/config/site';
import { PageHeader, ContactInfoCard } from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';

// Default fallback values when settings are not available
const FALLBACK_PHONE = ['+1 (800) LODGEFLOW', '+1 (800) 563-4335'];
const FALLBACK_EMAIL = ['hello@lodgeflow.app', 'reservations@lodgeflow.app'];
const FALLBACK_LOCATION = [
  'LodgeFlow Resort',
  '1000 Wilderness Drive',
  'Pine Valley, MT 59718',
];
const FALLBACK_HOURS = 'Daily: 8:00 AM - 10:00 PM';

function ContactSkeleton() {
  return (
    <div className='space-y-8 py-8'>
      <PageHeader
        subtitle="We're here to help you plan the perfect escape to LodgeFlow. Get in touch with our team for any questions or assistance."
        title='Contact'
        titleAccent='Us'
      />
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-12'>
        <Card>
          <CardBody className='space-y-6'>
            <Skeleton className='h-6 w-32 rounded-lg' />
            {[1, 2, 3].map(i => (
              <div key={i} className='flex items-start gap-3'>
                <Skeleton className='w-10 h-10 rounded-lg flex-shrink-0' />
                <div className='space-y-2 flex-1'>
                  <Skeleton className='h-4 w-20 rounded-lg' />
                  <Skeleton className='h-4 w-48 rounded-lg' />
                  <Skeleton className='h-3 w-36 rounded-lg' />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardBody className='space-y-4'>
            <Skeleton className='h-6 w-48 rounded-lg' />
            <Skeleton className='h-4 w-64 rounded-lg' />
            <div className='grid grid-cols-2 gap-4'>
              <Skeleton className='h-12 rounded-lg' />
              <Skeleton className='h-12 rounded-lg' />
            </div>
            <Skeleton className='h-12 rounded-lg' />
            <Skeleton className='h-12 rounded-lg' />
            <Skeleton className='h-12 rounded-lg' />
            <Skeleton className='h-24 rounded-lg' />
            <Skeleton className='h-12 rounded-lg' />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default function ContactPage() {
  const { data: settings, isLoading } = useSettings();

  if (isLoading) {
    return <ContactSkeleton />;
  }

  // Build phone lines from settings or use fallback
  const phoneLines = settings?.contactInfo?.phone
    ? [settings.contactInfo.phone]
    : FALLBACK_PHONE;

  // Build email lines from settings or use fallback
  const emailLines = settings?.contactInfo?.email
    ? [settings.contactInfo.email]
    : FALLBACK_EMAIL;

  // Build location lines from settings address or use fallback
  const locationLines = (() => {
    const addr = settings?.contactInfo?.address;
    if (!addr) return FALLBACK_LOCATION;

    const lines: string[] = [];
    if (addr.street) lines.push(addr.street);
    const cityStateZip = [addr.city, addr.state, addr.zipCode]
      .filter(Boolean)
      .join(', ');
    if (cityStateZip) lines.push(cityStateZip);
    if (addr.country) lines.push(addr.country);

    return lines.length > 0 ? lines : FALLBACK_LOCATION;
  })();

  // Build business hours subtitle from settings or use fallback
  const businessHoursSubtitle =
    settings?.businessHours?.open && settings?.businessHours?.close
      ? `Daily: ${settings.businessHours.open} - ${settings.businessHours.close}`
      : FALLBACK_HOURS;

  const contactItems = [
    {
      icon: <Phone className='w-5 h-5 text-green-600' />,
      title: 'Phone',
      lines: phoneLines,
      subtitle: businessHoursSubtitle,
    },
    {
      icon: <Mail className='w-5 h-5 text-green-600' />,
      title: 'Email',
      lines: emailLines,
      subtitle: 'We respond within 2 hours',
    },
    {
      icon: <MapPin className='w-5 h-5 text-green-600' />,
      title: 'Location',
      lines: locationLines,
    },
  ];

  return (
    <div className='space-y-8 py-8'>
      {/* Header */}
      <PageHeader
        subtitle="We're here to help you plan the perfect escape to LodgeFlow. Get in touch with our team for any questions or assistance."
        title='Contact'
        titleAccent='Us'
      />

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-12'>
        {/* Contact Information */}
        <div className='space-y-8'>
          <ContactInfoCard items={contactItems} title='Get in Touch'>
            <div className='pt-4 border-t'>
              <h4 className='font-semibold mb-3'>Follow Us</h4>
              <div className='flex gap-4'>
                <Button
                  as={Link}
                  href={siteConfig.links.instagram}
                  isExternal
                  size='sm'
                  startContent={<Instagram className='w-4 h-4' />}
                  variant='flat'
                >
                  Instagram
                </Button>
                <Button
                  as={Link}
                  href={siteConfig.links.facebook}
                  isExternal
                  size='sm'
                  startContent={<Facebook className='w-4 h-4' />}
                  variant='flat'
                >
                  Facebook
                </Button>
              </div>
            </div>
          </ContactInfoCard>
        </div>

        {/* Contact Form */}
        <div>
          <Card>
            <CardBody>
              <h3 className='text-xl font-bold'>Send us a Message</h3>
              <p className='text-default-600 mt-2 mb-6'>
                Fill out the form below and we'll get back to you as soon as
                possible.
              </p>

              <form className='space-y-4'>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <Input
                    isRequired
                    label='First Name'
                    placeholder='Enter your first name'
                  />
                  <Input
                    isRequired
                    label='Last Name'
                    placeholder='Enter your last name'
                  />
                </div>

                <Input
                  isRequired
                  label='Email'
                  placeholder='Enter your email'
                  type='email'
                />

                <Input
                  label='Phone'
                  placeholder='Enter your phone number'
                  type='tel'
                />

                <Input
                  isRequired
                  label='Subject'
                  placeholder='What is this regarding?'
                />

                <Textarea
                  isRequired
                  label='Message'
                  minRows={4}
                  placeholder='Tell us how we can help you...'
                />

                <Button
                  className='w-full'
                  color='primary'
                  size='lg'
                  type='submit'
                >
                  Send Message
                </Button>

                <p className='text-xs text-default-500 text-center'>
                  We'll respond to your message within 2 hours during business
                  hours.
                </p>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Emergency Contact */}
      <section className='bg-orange-50 dark:bg-orange-950 rounded-2xl p-8 text-center'>
        <h3 className='text-xl font-bold'>Emergency Contact</h3>
        <p className='text-default-600 mt-2 mb-6'>
          For guests currently staying with us who need immediate assistance
        </p>
        <Button
          as={Link}
          color='warning'
          href='tel:+1-800-911-FLOW'
          size='lg'
          startContent={<AlertTriangle className='w-5 h-5' />}
        >
          Emergency: +1 (800) 911-FLOW
        </Button>
      </section>
    </div>
  );
}

'use client';
import { Card, CardBody } from '@heroui/card';
import { Star } from 'lucide-react';

interface Testimonial {
  author: string;
  date: string;
  id: number;
  location: string;
  rating: number;
  text: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    author: 'Sarah M.',
    date: 'January 2026',
    id: 1,
    location: 'New York, NY',
    rating: 5,
    text: 'Absolutely stunning cabin. The views were breathtaking and the amenities were top-notch. We will definitely be coming back!',
  },
  {
    author: 'James R.',
    date: 'December 2025',
    id: 2,
    location: 'Austin, TX',
    rating: 5,
    text: 'Perfect getaway for our family. The kids loved exploring and we loved the peace and quiet. The check-in process was seamless.',
  },
  {
    author: 'Priya K.',
    date: 'November 2025',
    id: 3,
    location: 'San Francisco, CA',
    rating: 4,
    text: 'Cozy, clean, and well-equipped. The location is ideal and the host was incredibly responsive. Highly recommend for a weekend trip.',
  },
];

export default function CabinTestimonials() {
  return (
    <div>
      <h2 className='mb-4 text-xl font-semibold'>What Guests Are Saying</h2>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
        {TESTIMONIALS.map(t => (
          <Card key={t.id} role='article'>
            <CardBody className='space-y-3'>
              <div className='flex gap-0.5'>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={16}
                    className={
                      i < t.rating
                        ? 'fill-warning-400 text-warning-400'
                        : 'text-foreground-300'
                    }
                  />
                ))}
              </div>
              <p className='text-sm text-foreground-600'>{t.text}</p>
              <div>
                <p className='text-sm font-semibold'>{t.author}</p>
                <p className='text-xs text-foreground-400'>
                  {t.location} · {t.date}
                </p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}

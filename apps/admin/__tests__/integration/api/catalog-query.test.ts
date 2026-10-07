import { NextRequest } from 'next/server';
import { Cabin, Dining, Experience } from '@lodgeflow/database';
import { GET as cabins } from '@/app/api/cabins/route';
import { GET as dining } from '@/app/api/dining/route';
import { GET as experiences } from '@/app/api/experiences/route';
import { requireApiAuth } from '@/lib/api-utils';
beforeEach(() =>
  jest.mocked(requireApiAuth).mockResolvedValue({
    authenticated: true,
    userId: 'staff',
    role: 'front_desk',
  })
);
test('cabin queries retain literal search, ignored unknown capacity and safe fallback sort', async () => {
  await Cabin.create(
    ['Zulu*', 'Alpha*', 'Unmatched'].map(name => ({
      name,
      description: 'A forest cabin',
      image: 'https://example.test/cabin.jpg',
      capacity: 4,
      price: 100,
      discount: 0,
      amenities: [],
      status: 'active',
    }))
  );
  const response = await cabins(
    new NextRequest(
      'https://admin.test/api/cabins?search=*&capacity=unknown&sortBy=$where&sortOrder=desc'
    )
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.data.map((item: { name: string }) => item.name)).toEqual([
    'Zulu*',
    'Alpha*',
  ]);
});
test('dining retains non-true availability as false and literal combined filters', async () => {
  const item = {
    name: 'Hidden*',
    description: 'A meal',
    type: 'menu',
    mealType: 'lunch',
    price: 20,
    servingTime: { start: '12:00', end: '15:00' },
    maxPeople: 10,
    category: 'regular',
    image: 'https://example.test/meal.jpg',
    isAvailable: false,
  };
  await Dining.create([
    item,
    { ...item, name: 'Visible*', isAvailable: true },
    { ...item, name: 'No wildcard' },
  ]);
  const response = await dining(
    new NextRequest(
      'https://admin.test/api/dining?type=menu&search=*&isAvailable=unexpected&sortBy=invalid'
    )
  );
  expect(response.status).toBe(200);
  expect(
    (await response.json()).data.map((item: { name: string }) => item.name)
  ).toEqual(['Hidden*']);
});
test('experience filters retain custom categories and literal query text', async () => {
  const item = {
    name: 'River?',
    description: 'A guided trip',
    price: 20,
    duration: '2 hours',
    difficulty: 'Easy',
    category: 'Local tours',
    image: 'https://example.test/trip.jpg',
    includes: [],
    available: [],
    ctaText: 'Book',
  };
  await Experience.create([
    item,
    { ...item, name: 'River tour' },
    { ...item, name: 'River?', category: 'Other' },
  ]);
  const response = await experiences(
    new NextRequest(
      'https://admin.test/api/experiences?search=%3F&category=Local%20tours&difficulty=Easy&sortBy=invalid'
    )
  );
  expect(response.status).toBe(200);
  expect(
    (await response.json()).data.map((item: { name: string }) => item.name)
  ).toEqual(['River?']);
});

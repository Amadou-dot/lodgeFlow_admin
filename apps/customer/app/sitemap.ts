import type { MetadataRoute } from 'next';

import { siteConfig } from '@/config/site';
import { connectDB, Cabin, Dining, Experience } from '@/models';

export const revalidate = 3600; // Regenerate sitemap hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url.replace(/\/$/, '');
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${base}/cabins`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${base}/experiences`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${base}/dining`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${base}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${base}/contact`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  try {
    await connectDB();
    const [cabins, experiences, dining] = await Promise.all([
      Cabin.find({ status: 'active' }).select('_id updatedAt').lean(),
      Experience.find({}).select('_id updatedAt').lean(),
      Dining.find({ isAvailable: true }).select('_id updatedAt').lean(),
    ]);

    const cabinEntries: MetadataRoute.Sitemap = cabins.map((c: any) => ({
      url: `${base}/cabins/${c._id}`,
      lastModified: c.updatedAt ?? now,
      changeFrequency: 'weekly',
      priority: 0.8,
    }));

    const experienceEntries: MetadataRoute.Sitemap = experiences.map(
      (e: any) => ({
        url: `${base}/experiences/${e._id}`,
        lastModified: e.updatedAt ?? now,
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    );

    const diningEntries: MetadataRoute.Sitemap = dining.map((d: any) => ({
      url: `${base}/dining/${d._id}`,
      lastModified: d.updatedAt ?? now,
      changeFrequency: 'weekly',
      priority: 0.7,
    }));

    return [
      ...staticEntries,
      ...cabinEntries,
      ...experienceEntries,
      ...diningEntries,
    ];
  } catch (error) {
    console.error('sitemap: failed to fetch dynamic entries', error);
    return staticEntries;
  }
}

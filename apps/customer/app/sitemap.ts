import { logger } from '@lodgeflow/database/logger';
import type { MetadataRoute } from 'next';
import type { Types } from 'mongoose';

interface CatalogSitemapSource {
  _id: Types.ObjectId;
  updatedAt?: Date;
}

import { siteConfig } from '@/config/site';
import { connectDB, Cabin, Dining, Experience } from '@lodgeflow/database';

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
      Cabin.find({ status: 'active' })
        .select('_id updatedAt')
        .lean<CatalogSitemapSource[]>(),
      Experience.find({})
        .select('_id updatedAt')
        .lean<CatalogSitemapSource[]>(),
      Dining.find({ isAvailable: true })
        .select('_id updatedAt')
        .lean<CatalogSitemapSource[]>(),
    ]);

    const cabinEntries: MetadataRoute.Sitemap = cabins.map(c => ({
      url: `${base}/cabins/${c._id}`,
      lastModified: c.updatedAt ?? now,
      changeFrequency: 'weekly',
      priority: 0.8,
    }));

    const experienceEntries: MetadataRoute.Sitemap = experiences.map(e => ({
      url: `${base}/experiences/${e._id}`,
      lastModified: e.updatedAt ?? now,
      changeFrequency: 'weekly',
      priority: 0.7,
    }));

    const diningEntries: MetadataRoute.Sitemap = dining.map(d => ({
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
    logger.error('sitemap: failed to fetch dynamic entries', error);
    return staticEntries;
  }
}

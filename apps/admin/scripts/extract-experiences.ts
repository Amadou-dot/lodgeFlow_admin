import { config } from 'dotenv';
import { resolve } from 'path';
import connectDB from '../lib/mongodb';
import { Experience } from '../models';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function extractExperiencesData() {
  try {
    console.log('🔍 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected');

    console.log('🎯 Fetching experiences data...');
    const experiences = await Experience.find({})
      .select(
        'name price duration difficulty category description longDescription image gallery includes available ctaText isPopular maxParticipants minAge requirements location highlights whatToBring cancellationPolicy seasonality tags rating reviewCount'
      )
      .lean();

    console.log(`🎪 Found ${experiences.length} experiences`);

    // Format the data for use in seed file
    const formattedData = experiences.map(item => ({
      name: item.name,
      price: item.price,
      duration: item.duration,
      difficulty: item.difficulty,
      category: item.category,
      description: item.description,
      ...(item.longDescription && { longDescription: item.longDescription }),
      image: item.image,
      ...(item.gallery && { gallery: item.gallery }),
      includes: item.includes,
      available: item.available,
      ctaText: item.ctaText,
      isPopular: item.isPopular,
      ...(item.maxParticipants && { maxParticipants: item.maxParticipants }),
      ...(item.minAge && { minAge: item.minAge }),
      ...(item.requirements && { requirements: item.requirements }),
      ...(item.location && { location: item.location }),
      ...(item.highlights && { highlights: item.highlights }),
      ...(item.whatToBring && { whatToBring: item.whatToBring }),
      ...(item.cancellationPolicy && {
        cancellationPolicy: item.cancellationPolicy,
      }),
      ...(item.seasonality && { seasonality: item.seasonality }),
      ...(item.tags && { tags: item.tags }),
      ...(item.rating && { rating: item.rating }),
      ...(item.reviewCount && { reviewCount: item.reviewCount }),
    }));

    console.log('📝 Experiences data extracted:');
    console.log(JSON.stringify(formattedData, null, 2));

    return formattedData;
  } catch (error) {
    console.error('❌ Error extracting experiences data:', error);
    throw error;
  }
}

// Run extraction if this file is executed directly
if (require.main === module) {
  extractExperiencesData()
    .then(() => {
      console.log('✅ Extraction completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Extraction failed:', error);
      process.exit(1);
    });
}

export default extractExperiencesData;

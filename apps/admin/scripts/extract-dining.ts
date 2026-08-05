import { config } from 'dotenv';
import { resolve } from 'path';
import connectDB from '../lib/mongodb';
import { Dining } from '../models';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function extractDiningData() {
  try {
    console.log('🔍 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected');

    console.log('📊 Fetching dining data...');
    const diningItems = await Dining.find({})
      .select(
        'name description type mealType price servingTime maxPeople minPeople category subCategory image gallery ingredients allergens dietary beverages includes duration location specialRequirements isPopular isAvailable seasonality tags rating reviewCount'
      )
      .lean();

    console.log(`🍽️ Found ${diningItems.length} dining items`);

    // Format the data for use in seed file
    const formattedData = diningItems.map(item => ({
      name: item.name,
      description: item.description,
      type: item.type,
      mealType: item.mealType,
      price: item.price,
      servingTime: item.servingTime,
      maxPeople: item.maxPeople,
      minPeople: item.minPeople,
      category: item.category,
      ...(item.subCategory && { subCategory: item.subCategory }),
      image: item.image,
      ...(item.gallery && { gallery: item.gallery }),
      ...(item.ingredients && { ingredients: item.ingredients }),
      ...(item.allergens && { allergens: item.allergens }),
      ...(item.dietary && { dietary: item.dietary }),
      ...(item.beverages && { beverages: item.beverages }),
      ...(item.includes && { includes: item.includes }),
      ...(item.duration && { duration: item.duration }),
      ...(item.location && { location: item.location }),
      ...(item.specialRequirements && {
        specialRequirements: item.specialRequirements,
      }),
      isPopular: item.isPopular,
      isAvailable: item.isAvailable,
      ...(item.seasonality && { seasonality: item.seasonality }),
      ...(item.tags && { tags: item.tags }),
      ...(item.rating && { rating: item.rating }),
      ...(item.reviewCount && { reviewCount: item.reviewCount }),
    }));

    console.log('📝 Dining data extracted:');
    console.log(JSON.stringify(formattedData, null, 2));

    return formattedData;
  } catch (error) {
    console.error('❌ Error extracting dining data:', error);
    throw error;
  }
}

// Run extraction if this file is executed directly
if (require.main === module) {
  extractDiningData()
    .then(() => {
      console.log('✅ Extraction completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Extraction failed:', error);
      process.exit(1);
    });
}

export default extractDiningData;

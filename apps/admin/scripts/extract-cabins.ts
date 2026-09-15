import { config } from 'dotenv';
import { resolve } from 'path';
import connectDB from '../lib/mongodb';
import { Cabin } from '../models';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function extractCabins() {
  try {
    console.log('🔗 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected');

    console.log('📦 Fetching cabin data...');
    const cabins = await Cabin.find({}).lean();

    console.log(`📋 Found ${cabins.length} cabins`);

    // Format the cabin data for the seed script
    const cabinData = cabins.map(cabin => ({
      name: cabin.name,
      image: cabin.image,
      capacity: cabin.capacity,
      price: cabin.price,
      discount: cabin.discount || 0,
      description: cabin.description,
      amenities: cabin.amenities || [],
    }));

    console.log('\n🏠 Cabin Data (copy this to your seed script):');
    console.log(
      'const cabinData = ' + JSON.stringify(cabinData, null, 2) + ';'
    );

    console.log('\n✅ Cabin data extracted successfully!');
  } catch (error) {
    console.error('❌ Error extracting cabin data:', error);
  } finally {
    process.exit(0);
  }
}

extractCabins();

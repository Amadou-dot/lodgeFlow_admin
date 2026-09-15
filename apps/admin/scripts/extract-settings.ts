import { config } from 'dotenv';
import { resolve } from 'path';
import connectDB from '../lib/mongodb';
import { Settings } from '../models';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function extractSettingsData() {
  try {
    console.log('🔍 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected');

    console.log('⚙️ Fetching settings data...');
    const settings = await Settings.find({}).lean();

    console.log(`📋 Found ${settings.length} settings records`);

    // Format the data for use in seed file (preserving all fields)
    const formattedData = settings.map(item => ({
      minBookingLength: item.minBookingLength,
      maxBookingLength: item.maxBookingLength,
      maxGuestsPerBooking: item.maxGuestsPerBooking,
      breakfastPrice: item.breakfastPrice,
      checkInTime: item.checkInTime,
      checkOutTime: item.checkOutTime,
      cancellationPolicy: item.cancellationPolicy,
      requireDeposit: item.requireDeposit,
      depositPercentage: item.depositPercentage,
      allowPets: item.allowPets,
      petFee: item.petFee,
      smokingAllowed: item.smokingAllowed,
      earlyCheckInFee: item.earlyCheckInFee,
      lateCheckOutFee: item.lateCheckOutFee,
      wifiIncluded: item.wifiIncluded,
      parkingIncluded: item.parkingIncluded,
      parkingFee: item.parkingFee,
      currency: item.currency,
      timezone: item.timezone,
      businessHours: item.businessHours,
      contactInfo: item.contactInfo,
      notifications: item.notifications,
    }));

    console.log('📝 Settings data extracted:');
    console.log(JSON.stringify(formattedData, null, 2));

    return formattedData;
  } catch (error) {
    console.error('❌ Error extracting settings data:', error);
    throw error;
  }
}

// Run extraction if this file is executed directly
if (require.main === module) {
  extractSettingsData()
    .then(() => {
      console.log('✅ Extraction completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Extraction failed:', error);
      process.exit(1);
    });
}

export default extractSettingsData;

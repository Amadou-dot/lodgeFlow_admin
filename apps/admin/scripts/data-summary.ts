import { config } from 'dotenv';
import { resolve } from 'path';
import connectDB from '../lib/mongodb';
import { Booking, Cabin, Dining, Experience, Settings } from '../models';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function getDataSummary() {
  try {
    console.log('📊 LodgeFlow Database Summary');
    console.log('============================\n');

    await connectDB();

    // Get counts of each data type
    const [
      cabinCount,
      experienceCount,
      diningCount,
      bookingCount,
      settingsCount,
    ] = await Promise.all([
      Cabin.countDocuments(),
      Experience.countDocuments(),
      Dining.countDocuments(),
      Booking.countDocuments(),
      Settings.countDocuments(),
    ]);

    console.log('🏠 Cabins:', cabinCount);
    console.log('🎯 Experiences:', experienceCount);
    console.log('🍽️ Dining Items:', diningCount);
    console.log('📅 Bookings:', bookingCount);
    console.log('⚙️ Settings:', settingsCount);

    // Get booking statistics
    if (bookingCount > 0) {
      const bookingStats = await Booking.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalPrice' },
            avgBookingValue: { $avg: '$totalPrice' },
            totalNights: { $sum: '$numNights' },
          },
        },
      ]);

      const statusBreakdown = await Booking.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]);

      const uniqueUsers = await Booking.distinct('customer');

      console.log('\n📈 Booking Statistics:');
      console.log(
        '├─ Total Revenue: $' + bookingStats[0].totalRevenue.toLocaleString()
      );
      console.log(
        '├─ Average Booking Value: $' +
          Math.round(bookingStats[0].avgBookingValue)
      );
      console.log('├─ Total Nights Booked:', bookingStats[0].totalNights);
      console.log('└─ Unique Clerk Users:', uniqueUsers.length);

      console.log('\n📋 Booking Status Breakdown:');
      statusBreakdown.forEach(status => {
        console.log(`   ${status._id}: ${status.count}`);
      });
    }

    // Check for Clerk user IDs file
    const fs = await import('fs/promises');
    try {
      const userIdsData = await fs.readFile('clerk-user-ids.json', 'utf-8');
      const userIds = JSON.parse(userIdsData);
      console.log('\n👥 Clerk Integration:');
      console.log('├─ Clerk User IDs file: ✅ Found');
      console.log('└─ Available User IDs:', userIds.length);
    } catch (error) {
      console.log('\n👥 Clerk Integration:');
      console.log('├─ Clerk User IDs file: ❌ Not found');
      console.log('└─ Run `npm run clerk:list` to generate');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error getting data summary:', error);
    process.exit(1);
  }
}

getDataSummary();

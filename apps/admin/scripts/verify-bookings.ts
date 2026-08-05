import { config } from 'dotenv';
import { resolve } from 'path';
import connectDB from '../lib/mongodb';
import { Booking } from '../models';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function verifyBookings() {
  try {
    console.log('🔍 Verifying booking data...');
    await connectDB();

    // Get a few sample bookings to verify the Clerk user IDs
    const bookings = await Booking.find({}).limit(5).lean();

    console.log(`\n📋 Found ${bookings.length} sample bookings:`);

    bookings.forEach((booking, index) => {
      console.log(`\n${index + 1}. Booking ID: ${booking._id}`);
      console.log(`   Clerk User ID: ${booking.customer}`);
      console.log(`   Check-in: ${booking.checkInDate?.toDateString()}`);
      console.log(`   Check-out: ${booking.checkOutDate?.toDateString()}`);
      console.log(`   Nights: ${booking.numNights}`);
      console.log(`   Guests: ${booking.numGuests}`);
      console.log(`   Total Price: $${booking.totalPrice}`);
      console.log(`   Status: ${booking.status}`);
      console.log(`   Paid: ${booking.isPaid}`);
    });

    // Get unique Clerk user IDs from bookings
    const uniqueUserIds = await Booking.distinct('customer');
    console.log(
      `\n👥 Unique Clerk User IDs in bookings: ${uniqueUserIds.length}`
    );
    console.log('User IDs:', uniqueUserIds.slice(0, 5), '...');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error verifying bookings:', error);
    process.exit(1);
  }
}

verifyBookings();

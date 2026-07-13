import {
  createErrorResponse,
  createValidationErrorResponse,
  requireApiAuth,
} from '@/lib/api-utils';
import { AUTHORIZED_ROLES, isAuthBypassEnabled } from '@/lib/auth-helpers';
import { settingsData } from '@/lib/data/seed-data';
import connectDB from '@/lib/mongodb';
import {
  getBookingLengthRangeError,
  stripSettingsMongoMetadata,
  updateSettingsSchema,
} from '@/lib/validations/settings';
import { isMongooseValidationError } from '@/types/errors';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { Settings } from '../../../models';

const DEFAULT_SETTINGS = {
  ...settingsData,
  businessHours: {
    open: '09:00',
    close: '18:00',
    daysOpen: [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ],
  },
  contactInfo: {
    phone: '18005634336',
    email: 'info@lodgeflow.com',
    address: {
      street: '1000 Wilderness Drive',
      city: 'Pine Valley',
      state: 'MT',
      country: 'USA',
      zipCode: '59718',
    },
  },
  notifications: {
    emailEnabled: true,
    smsEnabled: false,
    bookingConfirmation: true,
    paymentReminders: true,
    checkInReminders: true,
  },
};

export async function GET() {
  // Require authentication
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();

    // Get settings or create default if none exist
    let settings = await Settings.findOne();

    if (!settings) {
      // Clear invalid settings first (in case there are partial documents)
      await Settings.deleteMany({});

      // Create default settings if none exist
      settings = await Settings.create(DEFAULT_SETTINGS);
    }

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch settings',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  // Require authentication
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();

    const body = await request.json();

    const validationResult = updateSettingsSchema.safeParse(
      typeof body === 'object' && body !== null
        ? stripSettingsMongoMetadata(body as Record<string, unknown>)
        : body
    );
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    // Get current settings or create new if none exist
    let settings = await Settings.findOne();

    const effectiveMinBookingLength =
      validationResult.data.minBookingLength ?? settings?.minBookingLength;
    const effectiveMaxBookingLength =
      validationResult.data.maxBookingLength ?? settings?.maxBookingLength;

    if (
      effectiveMinBookingLength !== undefined &&
      effectiveMaxBookingLength !== undefined
    ) {
      const rangeError = getBookingLengthRangeError(
        effectiveMinBookingLength,
        effectiveMaxBookingLength
      );
      if (rangeError) {
        return createErrorResponse('Validation failed', 400, {
          maxBookingLength: [rangeError],
        });
      }
    }

    if (settings) {
      // Update existing settings
      Object.assign(settings, validationResult.data);
      await settings.save();
    } else {
      // Create new settings
      settings = await Settings.create(validationResult.data);
    }

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error: unknown) {
    console.error('Error updating settings:', error);

    if (isMongooseValidationError(error)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update settings',
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  // Require authentication
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  // Resetting settings is a destructive operation — require admin role
  if (!isAuthBypassEnabled()) {
    const { has } = await auth();
    if (!has?.({ role: AUTHORIZED_ROLES.ADMIN })) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin role required' },
        { status: 403 }
      );
    }
  }

  try {
    await connectDB();

    // Delete existing settings and recreate with defaults
    await Settings.deleteMany({});
    const settings = await Settings.create(DEFAULT_SETTINGS);

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error resetting settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to reset settings',
      },
      { status: 500 }
    );
  }
}

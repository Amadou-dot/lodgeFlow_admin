import { logger } from '@lodgeflow/database/logger';
import { serializeSettings } from '@lodgeflow/database/settings-json';
import { NextResponse } from 'next/server';
import { connectDB, Settings } from '@lodgeflow/database';
import type { ApiResponse, Settings as SettingsType } from '@/types';

export async function GET() {
  try {
    await connectDB();

    const settings = await Settings.getSettings();

    const response: ApiResponse<SettingsType> = {
      success: true,
      data: serializeSettings(settings.toObject()),
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Failed to fetch settings', error);

    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch settings',
    };

    return NextResponse.json(response, { status: 500 });
  }
}

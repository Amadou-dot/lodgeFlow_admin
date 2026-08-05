import { NextRequest, NextResponse } from 'next/server';
import { connectDB, Settings } from '@/models';
import type { ApiResponse, Settings as SettingsType } from '@/types';

export async function GET() {
  try {
    await connectDB();

    const settings = await Settings.getSettings();

    const response: ApiResponse<SettingsType> = {
      success: true,
      data: settings,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching settings:', error);

    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch settings',
    };

    return NextResponse.json(response, { status: 500 });
  }
}

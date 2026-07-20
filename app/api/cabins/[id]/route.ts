import { createValidationErrorResponse, requireApiAuth } from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import { updateCabinSchema } from '@/lib/validations';
import { isMongooseValidationError } from '@/types/errors';
import { NextRequest, NextResponse } from 'next/server';
import { Cabin } from '../../../../models';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authentication
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();
    const { id } = await params;

    const cabin = await Cabin.findById(id);

    if (!cabin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cabin not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: cabin,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch cabin',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authentication
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();
    const { id } = await params;

    const body = await request.json();

    const validationResult = updateCabinSchema.safeParse({ ...body, _id: id });
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error);
    }

    const { _id: _validatedId, ...updateData } = validationResult.data;

    const cabin = await Cabin.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!cabin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cabin not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: cabin,
    });
  } catch (error: unknown) {
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
        error: 'Failed to update cabin',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authentication
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();
    const { id } = await params;

    const cabin = await Cabin.findByIdAndDelete(id);

    if (!cabin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cabin not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Cabin deleted successfully',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete cabin',
      },
      { status: 500 }
    );
  }
}

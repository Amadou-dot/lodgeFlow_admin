import {
  createErrorResponse,
  createSuccessResponse,
  createValidationErrorResponse,
  HTTP_STATUS,
  requireApiAuth,
} from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import connectDB from '@/lib/mongodb';
import { isDiscountValid, updateCabinSchema } from '@/lib/validations';
import { isMongooseValidationError } from '@/types/errors';
import { NextRequest } from 'next/server';
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
      return createErrorResponse('Cabin not found', HTTP_STATUS.NOT_FOUND);
    }

    return createSuccessResponse(cabin);
  } catch (error) {
    logger.error(
      'Error fetching cabin',
      error instanceof Error ? error : undefined
    );
    return createErrorResponse(
      'Failed to fetch cabin',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
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

    // An update touching only `discount` or only `price` has no counterpart
    // in the payload for the schema's refine to check against — fetch the
    // stored value of whichever field is missing and compare against that.
    if (
      (updateData.discount !== undefined) !==
      (updateData.price !== undefined)
    ) {
      const existingCabin = await Cabin.findById(id);
      if (!existingCabin) {
        return createErrorResponse('Cabin not found', HTTP_STATUS.NOT_FOUND);
      }
      const effectiveDiscount = updateData.discount ?? existingCabin.discount;
      const effectivePrice = updateData.price ?? existingCabin.price;
      if (!isDiscountValid(effectiveDiscount, effectivePrice)) {
        return createErrorResponse(
          'Validation failed',
          HTTP_STATUS.BAD_REQUEST,
          {
            discount: ['Discount cannot be greater than or equal to the price'],
          }
        );
      }
    }

    const cabin = await Cabin.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!cabin) {
      return createErrorResponse('Cabin not found', HTTP_STATUS.NOT_FOUND);
    }

    return createSuccessResponse(cabin);
  } catch (error: unknown) {
    if (isMongooseValidationError(error)) {
      return createErrorResponse(
        'Validation failed',
        HTTP_STATUS.BAD_REQUEST,
        error.errors
      );
    }

    logger.error(
      'Error updating cabin',
      error instanceof Error ? error : undefined
    );
    return createErrorResponse(
      'Failed to update cabin',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
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
      return createErrorResponse('Cabin not found', HTTP_STATUS.NOT_FOUND);
    }

    return createSuccessResponse(null, 'Cabin deleted successfully');
  } catch (error) {
    logger.error(
      'Error deleting cabin',
      error instanceof Error ? error : undefined
    );
    return createErrorResponse(
      'Failed to delete cabin',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

import { CABIN_STATUSES } from '@/lib/config';
import mongoose, { Document, Schema } from 'mongoose';

export interface ICabin extends Document {
  name: string;
  image: string;
  images: string[];
  status: 'active' | 'maintenance' | 'inactive';
  capacity: number;
  price: number;
  discount: number;
  description: string;
  amenities: string[];
  bedrooms?: number;
  bathrooms?: number;
  size?: number;
  minNights?: number;
  extraGuestFee: number;
  createdAt: Date;
  updatedAt: Date;
}

const CabinSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Cabin name is required'],
      trim: true,
      maxlength: [100, 'Cabin name cannot exceed 100 characters'],
    },
    image: {
      type: String,
      required: [true, 'Cabin image is required'],
      validate: {
        validator: function (v: string) {
          return /^https?:\/\/.+\..+/.test(v);
        },
        message: 'Please provide a valid image URL',
      },
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: [1, 'Capacity must be at least 1'],
      max: [20, 'Capacity cannot exceed 20'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be positive'],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount must be positive'],
      validate: {
        // On `.create()`/`.save()`, `this` is the document, so `this.price`
        // is the persisted price. On `findByIdAndUpdate`, `this` is the
        // Query instead — the persisted price isn't visible here unless the
        // update payload also sets `price`. A discount-only update (no
        // `price` in the payload) can't be checked here; the API routes
        // validate that case against the stored price before persisting.
        validator: function (this: unknown, value: number) {
          const query = this as { getUpdate?: () => Record<string, unknown> };
          const price =
            (this as Partial<ICabin>).price ??
            (query.getUpdate?.()?.$set as Partial<ICabin> | undefined)?.price ??
            (query.getUpdate?.() as Partial<ICabin> | undefined)?.price;
          if (price === undefined) return true;
          return value < price;
        },
        message: 'Discount must be less than the cabin price',
      },
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    amenities: [
      {
        type: String,
        trim: true,
      },
    ],
    images: [
      {
        type: String,
        validate: {
          validator: function (v: string) {
            return /^https?:\/\/.+\..+/.test(v);
          },
          message: 'Please provide a valid image URL',
        },
      },
    ],
    status: {
      type: String,
      enum: CABIN_STATUSES,
      default: 'active',
    },
    bedrooms: {
      type: Number,
      min: [1, 'Bedrooms must be at least 1'],
    },
    bathrooms: {
      type: Number,
      min: [1, 'Bathrooms must be at least 1'],
    },
    size: {
      type: Number,
      min: [1, 'Size must be at least 1 sq ft'],
    },
    minNights: {
      type: Number,
      min: [1, 'Minimum nights must be at least 1'],
    },
    extraGuestFee: {
      type: Number,
      min: [0, 'Extra guest fee must be positive'],
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
CabinSchema.index({ capacity: 1 });
CabinSchema.index({ price: 1 });
CabinSchema.index({ status: 1 });
CabinSchema.index({ name: 'text', description: 'text' });

// Virtual for discounted price
CabinSchema.virtual('discountedPrice').get(function (this: ICabin) {
  return this.price - this.discount;
});

// Ensure virtual fields are serialized
CabinSchema.set('toJSON', { virtuals: true });
CabinSchema.set('toObject', { virtuals: true });

export default mongoose.models.Cabin ||
  mongoose.model<ICabin>('Cabin', CabinSchema);

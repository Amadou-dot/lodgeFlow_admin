import mongoose, { Document, Schema } from 'mongoose';

export interface ICabin extends Document {
  name: string;
  image: string;
  capacity: number;
  price: number;
  discount: number;
  description: string;
  amenities: string[];
  images?: string[];
  status?: 'active' | 'maintenance' | 'inactive';
  bedrooms?: number;
  bathrooms?: number;
  size?: number;
  minNights?: number;
  extraGuestFee?: number;
  discountedPrice: number; // virtual
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
        validator: function (this: ICabin, discount: number) {
          return discount < this.price;
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
    amenities: {
      type: [String],
      default: [],
      validate: {
        validator: function (amenities: string[]) {
          return amenities.length <= 20;
        },
        message: 'Cannot have more than 20 amenities',
      },
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: function (images: string[]) {
          return images.every(url => /^https?:\/\/.+\..+/.test(url));
        },
        message: 'All gallery images must be valid URLs',
      },
    },
    status: {
      type: String,
      enum: ['active', 'maintenance', 'inactive'],
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
      min: [1, 'Size must be at least 1'],
    },
    minNights: {
      type: Number,
      min: [1, 'Minimum nights must be at least 1'],
    },
    extraGuestFee: {
      type: Number,
      default: 0,
      min: [0, 'Extra guest fee must be positive'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for discounted price (price - discount)
CabinSchema.virtual('discountedPrice').get(function (this: ICabin) {
  return this.price - this.discount;
});

// Indexes for efficient queries
// NOTE: The old compound index { capacity: 1, price: 1 } has been replaced with
// three separate indexes. If upgrading a running MongoDB instance, the old
// compound index must be dropped manually: db.cabins.dropIndex("capacity_1_price_1")
CabinSchema.index({ capacity: 1 });
CabinSchema.index({ price: 1 });
CabinSchema.index({ status: 1 });
CabinSchema.index({ name: 'text', description: 'text' });

// Prevent model re-compilation in development
const Cabin =
  mongoose.models.Cabin || mongoose.model<ICabin>('Cabin', CabinSchema);

export default Cabin;

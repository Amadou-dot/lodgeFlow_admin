import { Schema, model, models, Document } from 'mongoose';

export interface IDining extends Document {
  name: string;
  description: string;
  type: 'menu' | 'experience';
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'all-day';
  price: number;
  servingTime: {
    start: string; // HH:MM format
    end: string; // HH:MM format
  };
  maxPeople: number;
  minPeople: number;
  category: 'regular' | 'craft-beer' | 'wine' | 'spirits' | 'non-alcoholic';
  subCategory?: string;
  image: string;
  gallery?: string[];
  ingredients?: string[];
  allergens?: string[];
  dietary?: (
    'vegetarian' | 'vegan' | 'gluten-free' | 'dairy-free' | 'keto' | 'paleo'
  )[];
  beverages?: {
    name: string;
    description?: string;
    price?: number;
    alcoholContent?: number;
    category: 'craft-beer' | 'wine' | 'spirits' | 'non-alcoholic';
  }[];
  includes?: string[];
  duration?: string; // For dining experiences
  location?: string;
  specialRequirements?: string[];
  isPopular: boolean;
  isAvailable: boolean;
  seasonality?: string;
  tags?: string[];
  rating?: number;
  reviewCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const diningSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['menu', 'experience'],
    },
    mealType: {
      type: String,
      required: true,
      enum: ['breakfast', 'lunch', 'dinner', 'all-day'],
    },
    price: { type: Number, required: true },
    servingTime: {
      start: { type: String, required: true },
      end: { type: String, required: true },
    },
    maxPeople: { type: Number, required: true },
    minPeople: { type: Number, default: 1 },
    category: {
      type: String,
      required: true,
      enum: ['regular', 'craft-beer', 'wine', 'spirits', 'non-alcoholic'],
    },
    subCategory: { type: String },
    image: { type: String, required: true },
    gallery: { type: [String], default: [] },
    ingredients: { type: [String], default: [] },
    allergens: { type: [String], default: [] },
    dietary: {
      type: [String],
      enum: [
        'vegetarian',
        'vegan',
        'gluten-free',
        'dairy-free',
        'keto',
        'paleo',
      ],
      default: [],
    },
    beverages: [
      {
        name: { type: String, required: true },
        description: { type: String },
        price: { type: Number },
        alcoholContent: { type: Number },
        category: {
          type: String,
          required: true,
          enum: ['craft-beer', 'wine', 'spirits', 'non-alcoholic'],
        },
      },
    ],
    includes: { type: [String], default: [] },
    duration: { type: String },
    location: { type: String },
    specialRequirements: { type: [String], default: [] },
    isPopular: { type: Boolean, default: false },
    isAvailable: { type: Boolean, default: true },
    seasonality: { type: String },
    tags: { type: [String], default: [] },
    rating: { type: Number, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// Create indexes for better query performance
diningSchema.index({ type: 1, mealType: 1 });
diningSchema.index({ category: 1 });
diningSchema.index({ isAvailable: 1 });
diningSchema.index({ isPopular: 1 });

export default models.Dining || model<IDining>('Dining', diningSchema);

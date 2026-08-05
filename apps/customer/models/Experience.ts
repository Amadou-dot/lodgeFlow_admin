import { Schema, model, models } from 'mongoose';

export interface IExperience {
  _id?: string;
  name: string;
  price: number;
  duration: string;
  difficulty: 'Easy' | 'Moderate' | 'Challenging';
  category: string;
  description: string;
  longDescription?: string;
  image: string;
  gallery?: string[];
  includes: string[];
  available: string[];
  ctaText: string;
  isPopular: boolean;
  maxParticipants?: number;
  minAge?: number;
  requirements?: string[];
  location?: string;
  highlights?: string[];
  whatToBring?: string[];
  cancellationPolicy?: string;
  seasonality?: string;
  tags?: string[];
  rating?: number;
  reviewCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const experienceSchema = new Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    duration: { type: String, required: true },
    difficulty: {
      type: String,
      required: true,
      enum: ['Easy', 'Moderate', 'Challenging'],
    },
    category: { type: String, required: true },
    description: { type: String, required: true },
    longDescription: { type: String },
    image: { type: String, required: true },
    gallery: { type: [String], default: [] },
    includes: { type: [String], required: true },
    available: { type: [String], required: true },
    ctaText: { type: String, required: true },
    isPopular: { type: Boolean, default: false },
    maxParticipants: { type: Number },
    minAge: { type: Number },
    requirements: { type: [String], default: [] },
    location: { type: String },
    highlights: { type: [String], default: [] },
    whatToBring: { type: [String], default: [] },
    cancellationPolicy: { type: String },
    seasonality: { type: String },
    tags: { type: [String], default: [] },
    rating: { type: Number, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

export const Experience =
  models.Experience || model('Experience', experienceSchema);

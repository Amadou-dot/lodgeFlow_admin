import mongoose, { Document, Schema } from 'mongoose';

export interface IProcessedStripeEvent extends Document {
  eventId: string;
  eventType: string;
  processedAt: Date;
}

const ProcessedStripeEventSchema: Schema = new Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// TTL index to auto-delete events older than 30 days (Stripe replays within 72 hours max)
ProcessedStripeEventSchema.index(
  { processedAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

const ProcessedStripeEvent =
  mongoose.models.ProcessedStripeEvent ||
  mongoose.model<IProcessedStripeEvent>(
    'ProcessedStripeEvent',
    ProcessedStripeEventSchema
  );

export default ProcessedStripeEvent;

import mongoose from 'mongoose';

import { DB_CONFIG } from './config';
import { logger } from './logger';

interface GlobalMongoose {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: GlobalMongoose | undefined;
}

const cached =
  global.mongoose || (global.mongoose = { conn: null, promise: null });

/**
 * Connect to MongoDB with connection caching and proper error handling
 * @returns Cached or new MongoDB connection
 */
async function connectDB(): Promise<typeof mongoose> {
  // Return existing connection if available
  if (cached.conn) {
    return cached.conn;
  }

  // Check for MongoDB URI
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error(
      'Please define the MONGODB_URI environment variable inside .env.local'
    );
  }

  // Create new connection promise if not already pending
  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: DB_CONFIG.MAX_POOL_SIZE,
      serverSelectionTimeoutMS: DB_CONFIG.SERVER_SELECTION_TIMEOUT,
      socketTimeoutMS: DB_CONFIG.SOCKET_TIMEOUT,
      family: 4, // Use IPv4
    };

    logger.debug('Initiating MongoDB connection', {
      uri: MONGODB_URI.replace(/\/\/.*@/, '//***@'),
    });

    cached.promise = mongoose.connect(MONGODB_URI, opts).then(mongoose => {
      logger.info('MongoDB connected successfully');
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null; // Reset promise on failure
    logger.error('Failed to connect to MongoDB', error);
    throw error;
  }

  return cached.conn;
}

export default connectDB;

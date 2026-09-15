import { config } from 'dotenv';
import { resolve } from 'path';
import mongoose from 'mongoose';
import { seedDatabase } from '../lib/seed-database';
config({ path: resolve(process.cwd(), '.env.local') });
seedDatabase()
  .then(results => console.log(JSON.stringify(results)))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

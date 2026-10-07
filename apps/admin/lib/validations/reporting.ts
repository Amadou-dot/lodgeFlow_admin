import { z } from 'zod';

export const analyticsPeriodSchema = z.enum(['7d', '30d', '90d', '1y', 'all']);

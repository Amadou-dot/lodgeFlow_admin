import { z } from 'zod';

// Generous ceilings for booking form notes, applied to both creates and edits.
export const bookingNotesSchema = z.array(z.string().max(1000)).max(100);

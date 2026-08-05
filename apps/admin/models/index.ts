// Export all models
// `CabinBookingLock` is deliberately absent: it is infrastructure for the
// per-cabin booking mutex, not a domain model, and re-exporting it here
// would put raw lock CRUD one autocomplete away from every route that
// imports from this barrel. Use `withCabinBookingLock()` from
// `@/lib/cabin-booking-lock` instead (issue #126).
export { default as Booking, type IBooking } from './Booking';
export { default as Cabin, type ICabin } from './Cabin';
export { default as Dining, type IDining } from './Dining';
export { Experience, type IExperience } from './Experience';
export { default as Settings, type ISettings } from './Settings';

// Re-export database connection
export { default as connectDB } from '../lib/mongodb';

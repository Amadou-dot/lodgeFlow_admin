// Keep the local entry point inert until development has its own database.
// The shared server seed operation remains available for live seeding.
console.warn(
  'Local seeding is disabled until a separate testing database is configured. Live seeding is managed by n8n.'
);

export {};

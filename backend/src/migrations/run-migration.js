/**
 * Migration runner — uses DATABASE_PUBLIC_URL for local execution via Railway CLI
 * Run with: railway run -- node src/migrations/run-migration.js
 */

// Override DATABASE_URL with the public URL so we can connect from outside Railway's network
if (process.env.DATABASE_PUBLIC_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;
  console.log('Using DATABASE_PUBLIC_URL for connection');
}

// Force production SSL
process.env.NODE_ENV = 'production';

// Now dynamically import and run the migration (it auto-executes on import)
await import('./001-multi-tenancy.js');

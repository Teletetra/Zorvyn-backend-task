// src/config/db.ts
import { Pool } from 'pg';

// Create a new PostgreSQL connection pool
// Will use environment variables by default (PGHOST, PGUSER, PGDATABASE, PGPASSWORD, PGPORT)
// Or you can pass a connection string explicitly if DATABASE_URL is defined.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // If no DATABASE_URL is provided, it falls back to standard PG env vars
});

// Test the connection on startup
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Error connecting to the database', err);
    } else {
        console.log('Successfully connected to the database.');
    }
});

export default pool;

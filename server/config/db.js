import pkg from 'pg';
const { Pool } = pkg;

// We do NOT validate or exit here. This allows the file to be imported 
// without side effects (like crashing) if env vars are missing during build.
const connectionString = process.env.DATABASE_URL;

// Create pool lazily or allows it to be created with undefined (will fail only on connect)
const pool = new Pool({
  connectionString: connectionString,
  connectionTimeoutMillis: 5000, 
  ssl: {
    rejectUnauthorized: false
  }
});

// Suppress unhandled error on idle clients to prevent random crashes
pool.on('error', (err, client) => {
  // Just log it, don't crash. The query attempts will handle the errors.
  console.error('Unexpected error on idle database client', err.message);
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const initDB = async () => {
  // --- RUNTIME VALIDATION ---
  // This logic now runs ONLY when server starts, not during build.
  if (!connectionString) {
      console.error("\n❌ FATAL ERROR: DATABASE_URL is missing.");
      console.error("   Please set DATABASE_URL in your environment variables.\n");
      // Only exit the process if we are actually trying to start the DB
      process.exit(1);
  }

  const MAX_RETRIES = 5;
  const RETRY_DELAY = 3000; 

  let client;
  let attempt = 1;

  while (attempt <= MAX_RETRIES) {
    try {
      console.log(`Connecting to Database (Attempt ${attempt}/${MAX_RETRIES})...`);
      client = await pool.connect();
      console.log("✅ Successfully connected to PostgreSQL Database");
      
      // --- SCHEMA INITIALIZATION ---
      
      // 1. Users Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          phone TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL
        );
      `);

      // 2. Migration
      const userColumns = [
          "ADD COLUMN IF NOT EXISTS name TEXT",
          "ADD COLUMN IF NOT EXISTS email TEXT",
          "ADD COLUMN IF NOT EXISTS bio TEXT",
          "ADD COLUMN IF NOT EXISTS avatar TEXT",
          "ADD COLUMN IF NOT EXISTS joined_date TEXT",
          "ADD COLUMN IF NOT EXISTS learned_data JSONB DEFAULT '[]'",
          "ADD COLUMN IF NOT EXISTS traits JSONB DEFAULT '[]'",
          "ADD COLUMN IF NOT EXISTS custom_instructions TEXT"
      ];

      for (const col of userColumns) {
          await client.query(`ALTER TABLE users ${col}`);
      }

      // Sessions Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
          title TEXT,
          messages JSONB DEFAULT '[]',
          created_at BIGINT,
          updated_at BIGINT
        );
      `);

      // Tasks Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
          category_id TEXT,
          title TEXT,
          description TEXT,
          status TEXT,
          date TEXT,
          created_at BIGINT
        );
      `);

      // Categories Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
          title TEXT,
          color TEXT
        );
      `);

      console.log("✅ PostgreSQL Tables & Schema Verified.");
      return true; // Success

    } catch (err) {
      console.error(`⚠️ Database connection failed (Attempt ${attempt}): ${err.message}`);
      
      if (client) {
        client.release();
        client = null;
      }

      if (attempt === MAX_RETRIES) {
        console.error("\n❌ FATAL: Could not connect to database after multiple attempts.");
        
        if (err.message.includes('ENOTFOUND') && connectionString.includes('railway.internal')) {
             console.error("\n💡 HINT: 'railway.internal' hosts are only accessible from INSIDE Railway.");
             console.error("         If you are running this locally, use the Public Domain provided by Railway.");
             console.error("         If deploying, ensure the PostgreSQL service is active.\n");
        }
        
        // Throwing here allows index.js to handle the exit gracefully
        throw err; 
      }

      console.log(`⏳ Retrying in ${RETRY_DELAY/1000} seconds...`);
      await sleep(RETRY_DELAY);
      attempt++;
    } finally {
      if (client) client.release();
    }
  }
};

export default pool;
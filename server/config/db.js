import pkg from 'pg';
const { Pool } = pkg;

// Get connection string strictly from environment variables
const connectionString = process.env.DATABASE_URL;

// Fail fast if DATABASE_URL is missing
if (!connectionString) {
  console.error("------------------------------------------------------------------");
  console.error("❌ FATAL ERROR: DATABASE_URL environment variable is undefined.");
  console.error("   - If running locally: Add DATABASE_URL to your .env file or environment.");
  console.error("   - If on Railway: Ensure the PostgreSQL service is connected.");
  console.error("------------------------------------------------------------------");
  process.exit(1);
}

const pool = new Pool({
  connectionString: connectionString,
  connectionTimeoutMillis: 10000,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle database client', err);
  process.exit(-1);
});

export const initDB = async () => {
  let client;
  try {
    client = await pool.connect();
    console.log("✅ Successfully connected to PostgreSQL Database");
    
    // 1. Users Table (Create if not exists - Basic Structure)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        phone TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      );
    `);

    // 2. Users Table Schema Update (Ensure all columns exist for existing tables)
    // This acts as a basic migration system to fix "column does not exist" errors
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
  } catch (err) {
    console.error("❌ FATAL: Error initializing database:", err);
  } finally {
    if (client) client.release();
  }
};

export default pool;
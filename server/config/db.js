import pkg from 'pg';
const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL;

// --- VALIDATION & GUIDANCE ---
if (!connectionString) {
  console.error("\n❌ FATAL ERROR: DATABASE_URL is missing.");
  console.error("   Please set DATABASE_URL in your environment variables.\n");
  process.exit(1);
}

// Check for common mistake: Using internal URL locally
if (connectionString.includes('railway.internal') && !process.env.RAILWAY_ENVIRONMENT) {
  console.warn("\n⚠️  WARNING: You seem to be using a Railway Internal URL ('railway.internal') locally.");
  console.warn("   This usually fails with ENOTFOUND because it's not accessible outside Railway.");
  console.warn("   SOLUTION: Use the 'Public Networking' URL from Railway (usually ends with .rlwy.net)\n");
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
});

export const initDB = async () => {
  let client;
  try {
    client = await pool.connect();
    console.log("✅ Successfully connected to PostgreSQL Database");
    
    // 1. Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        phone TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      );
    `);

    // 2. Migration: Add columns if they don't exist
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
    return true; // Success indicator
  } catch (err) {
    console.error("\n❌ FATAL DATABASE CONNECTION ERROR:");
    console.error(err.message);
    if (err.message.includes('ENOTFOUND') && connectionString.includes('railway.internal')) {
        console.error("\n💡 HINT: You are using an internal Railway URL locally. Please replace DATABASE_URL with the Public URL from Railway dashboard.\n");
    }
    throw err; // Propagate error to stop server start
  } finally {
    if (client) client.release();
  }
};

export default pool;
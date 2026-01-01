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
  connectionTimeoutMillis: 10000, // Allow more time for initial connection
  // Railway and most cloud providers require SSL for external connections.
  // rejectUnauthorized: false is often needed for self-signed certs in PaaS environments.
  ssl: {
    rejectUnauthorized: false
  }
});

// Listener to catch errors on idle clients to prevent crashing
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle database client', err);
  process.exit(-1);
});

export const initDB = async () => {
  let client;
  try {
    client = await pool.connect();
    console.log("✅ Successfully connected to PostgreSQL Database");
    
    // Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        phone TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        email TEXT,
        bio TEXT,
        avatar TEXT,
        joined_date TEXT,
        learned_data JSONB DEFAULT '[]',
        traits JSONB DEFAULT '[]',
        custom_instructions TEXT
      );
    `);

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

    console.log("✅ PostgreSQL Tables Initialized/Verified.");
  } catch (err) {
    console.error("❌ FATAL: Error initializing database:", err);
  } finally {
    if (client) client.release();
  }
};

export default pool;
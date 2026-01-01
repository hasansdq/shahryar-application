import pkg from 'pg';
const { Pool } = pkg;

// Using the internal connection string provided for Railway
const connectionString = 'postgresql://postgres:bGCpEGarvDCFPfAWAfcWJqeHzmfrjjAE@postgres.railway.internal:5432/railway';

const pool = new Pool({
  connectionString: connectionString,
  // Internal connections usually don't need SSL, but if forced, we set rejectUnauthorized to false.
  // We keep it simple first. If strict SSL is required by the server config, uncomment the next line:
  // ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000, // Fail fast if connection hangs
});

// Listener to catch errors on idle clients to prevent crashing
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle database client', err);
  process.exit(-1);
});

export const initDB = async () => {
  try {
    const client = await pool.connect();
    console.log("Successfully connected to PostgreSQL");
    
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

    console.log("PostgreSQL Tables Initialized Successfully.");
    client.release();
  } catch (err) {
    console.error("FATAL: Error initializing database:", err);
  }
};

export default pool;
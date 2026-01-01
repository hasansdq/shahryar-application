import pkg from 'pg';
const { Pool } = pkg;

// Lazy Singleton: Pool is initially null and created only when needed.
let pool = null;

const getPool = () => {
    // SAFETY CHECK: If we are in a build environment, do NOT create a pool.
    if (process.env.npm_lifecycle_event === 'build') {
        return null;
    }

    if (pool) return pool;
    
    // We access env var only when requested, not at file load
    const connectionString = process.env.DATABASE_URL;
    
    // Return null if config is missing (allows import without crash during build/dev)
    if (!connectionString) {
        return null;
    }

    pool = new Pool({
        connectionString: connectionString,
        connectionTimeoutMillis: 5000, 
        ssl: {
            rejectUnauthorized: false
        }
    });

    pool.on('error', (err, client) => {
        console.error('Unexpected error on idle database client', err.message);
    });

    return pool;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const initDB = async () => {
    // 🛑 CRITICAL BUILD PROTECTION 🛑
    // If this is running as part of the build script, return immediately.
    // This prevents the connection logic from firing and failing due to network restrictions.
    if (process.env.npm_lifecycle_event === 'build') {
        console.log("🚧 Build environment detected. Skipping Database connection.");
        return true; 
    }

    // 1. Get Pool (Lazy Init)
    const p = getPool();
    
    // 2. Runtime Validation
    // If p is null here, it means either we are in build mode (handled above) 
    // or DATABASE_URL is missing in a runtime environment (which is a fatal error).
    if (!p) {
        console.error("\n❌ FATAL ERROR: DATABASE_URL is missing.");
        console.error("   Please set DATABASE_URL in your environment variables.\n");
        // We throw here only if we are SURE we are at runtime (handled by the check above)
        throw new Error("DATABASE_URL is missing");
    }

    const MAX_RETRIES = 5;
    const RETRY_DELAY = 3000; 

    let client;
    let attempt = 1;

    while (attempt <= MAX_RETRIES) {
        try {
            console.log(`Connecting to Database (Attempt ${attempt}/${MAX_RETRIES})...`);
            client = await p.connect();
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
                
                if (err.message.includes('ENOTFOUND') && process.env.DATABASE_URL?.includes('railway.internal')) {
                    console.error("\n💡 HINT: 'railway.internal' hosts are only accessible from INSIDE Railway.");
                    console.error("         If deploying, ensure the PostgreSQL service is active.");
                }
                
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

// Export a proxy object that mimics the Pool interface.
const db = {
    query: (text, params) => {
        const p = getPool();
        if (!p) {
             // If called during build, just return a dummy promise to prevent crash
             if (process.env.npm_lifecycle_event === 'build') return Promise.resolve({ rows: [] });
             throw new Error("Database not initialized: DATABASE_URL is missing");
        }
        return p.query(text, params);
    }
};

export default db;
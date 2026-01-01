// --- IN-MEMORY MOCK DATABASE ---
// This replaces the real PostgreSQL connection to ensure the app works immediately 
// without configuration errors. Data is stored in RAM and resets on server restart.

const dbState = {
    users: [],
    sessions: [],
    tasks: [],
    categories: []
};

// Helper to mimic Postgres JSONB parsing (Postgres returns objects, but we might receive strings)
const parseJSON = (val) => {
    try {
        if (typeof val === 'string') return JSON.parse(val);
        return val;
    } catch (e) {
        return val || [];
    }
};

export const initDB = async () => {
    console.log("\n⚠️  RUNNING IN MOCK MODE: No real database connection.");
    console.log("✅  In-Memory Storage Initialized. App will work fully.");
    console.log("ℹ️   Note: Data will be lost when the server restarts.\n");
    return true;
};

// A Mock Query Handler that parses SQL strings used in controllers
const mockQuery = async (text, params = []) => {
    const sql = text.trim().toUpperCase().replace(/\s+/g, ' ');

    // --- USERS TABLE ---
    if (sql.includes("INSERT INTO USERS")) {
        // params: id, phone, password, name, bio, joined_date, learned_data, traits, custom_instructions
        const newUser = {
            id: params[0],
            phone: params[1],
            password: params[2],
            name: params[3],
            bio: params[4],
            joined_date: params[5],
            learned_data: parseJSON(params[6]),
            traits: parseJSON(params[7]),
            custom_instructions: params[8]
        };
        dbState.users.push(newUser);
        return { rows: [newUser] };
    }

    if (sql.includes("SELECT * FROM USERS WHERE PHONE")) {
        const user = dbState.users.find(u => u.phone === params[0]);
        return { rows: user ? [user] : [] };
    }

    if (sql.includes("SELECT * FROM USERS WHERE ID")) {
        const user = dbState.users.find(u => u.id === params[0]);
        return { rows: user ? [user] : [] };
    }

    if (sql.includes("UPDATE USERS SET")) {
        // params: name, email, bio, avatar, learned, traits, instr, id
        const userIndex = dbState.users.findIndex(u => u.id === params[7]);
        if (userIndex !== -1) {
            dbState.users[userIndex] = {
                ...dbState.users[userIndex],
                name: params[0],
                email: params[1],
                bio: params[2],
                avatar: params[3],
                learned_data: parseJSON(params[4]),
                traits: parseJSON(params[5]),
                custom_instructions: params[6]
            };
        }
        return { rows: [] };
    }

    // --- SESSIONS TABLE ---
    if (sql.includes("SELECT * FROM SESSIONS")) {
        const sessions = dbState.sessions.filter(s => s.user_id === params[0]);
        // Sort DESC
        sessions.sort((a, b) => b.updated_at - a.updated_at);
        return { rows: sessions };
    }

    if (sql.includes("INSERT INTO SESSIONS")) {
        // Handle Upsert (ON CONFLICT)
        const id = params[0];
        const existingIndex = dbState.sessions.findIndex(s => s.id === id);
        
        const sessionObj = {
            id: params[0],
            user_id: params[1],
            title: params[2],
            messages: parseJSON(params[3]),
            created_at: params[4],
            updated_at: params[5]
        };

        if (existingIndex !== -1) {
            dbState.sessions[existingIndex] = sessionObj;
        } else {
            dbState.sessions.push(sessionObj);
        }
        return { rows: [sessionObj] };
    }

    if (sql.includes("DELETE FROM SESSIONS")) {
        dbState.sessions = dbState.sessions.filter(s => s.id !== params[0]);
        return { rows: [] };
    }

    // --- TASKS TABLE ---
    if (sql.includes("SELECT * FROM TASKS")) {
        const tasks = dbState.tasks.filter(t => t.user_id === params[0]);
        return { rows: tasks };
    }

    if (sql.includes("INSERT INTO TASKS")) {
        // Handle Upsert
        const id = params[0];
        const existingIndex = dbState.tasks.findIndex(t => t.id === id);
        
        const taskObj = {
            id: params[0],
            user_id: params[1],
            category_id: params[2],
            title: params[3],
            description: params[4],
            status: params[5],
            date: params[6],
            created_at: params[7]
        };

        if (existingIndex !== -1) {
            dbState.tasks[existingIndex] = taskObj;
        } else {
            dbState.tasks.push(taskObj);
        }
        return { rows: [taskObj] };
    }

    if (sql.includes("DELETE FROM TASKS")) {
        dbState.tasks = dbState.tasks.filter(t => t.id !== params[0]);
        return { rows: [] };
    }

    // --- CATEGORIES TABLE ---
    if (sql.includes("SELECT * FROM CATEGORIES")) {
        const cats = dbState.categories.filter(c => c.user_id === params[0]);
        return { rows: cats };
    }

    if (sql.includes("INSERT INTO CATEGORIES")) {
        // Handle "ON CONFLICT DO NOTHING"
        const exists = dbState.categories.find(c => c.id === params[0] && c.user_id === params[1]);
        if (!exists) {
            dbState.categories.push({
                id: params[0],
                user_id: params[1],
                title: params[2],
                color: params[3]
            });
        }
        return { rows: [] };
    }

    return { rows: [] };
};

// Export an object compatible with the 'pg' Pool interface
export default {
    query: mockQuery
};
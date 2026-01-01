import pool from '../config/db.js';

export const register = async (req, res) => {
    const { phone, password, name } = req.body;
    if (!phone || !password || !name) return res.status(400).json({ error: "Missing fields" });

    try {
        const id = 'user_' + Date.now();
        const joinedDate = new Date().toLocaleDateString('fa-IR');
        
        await pool.query(
            `INSERT INTO users (id, phone, password, name, bio, joined_date, learned_data, traits, custom_instructions) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [id, phone, password, name, 'کاربر جدید', joinedDate, '[]', '[]', '']
        );

        const newUser = {
            id, phone, name, email: '', bio: 'کاربر جدید',
            joinedDate, learnedData: [], traits: [], customInstructions: ''
        };
        res.status(200).json(newUser);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: "Phone exists" });
        console.error(err);
        res.status(500).json({ error: "Database Error" });
    }
};

export const login = async (req, res) => {
    const { phone, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
        if (result.rows.length === 0) return res.status(401).json({ error: "User not found" });
        
        const user = result.rows[0];
        if (user.password !== password) return res.status(401).json({ error: "Invalid credentials" });

        const userSafe = {
            id: user.id,
            phone: user.phone,
            name: user.name,
            email: user.email || '',
            bio: user.bio || '',
            avatar: user.avatar,
            joinedDate: user.joined_date,
            learnedData: user.learned_data || [],
            traits: user.traits || [],
            customInstructions: user.custom_instructions || ''
        };
        res.status(200).json(userSafe);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database Error" });
    }
};
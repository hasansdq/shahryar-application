import pool from '../config/db.js';

export const register = async (req, res) => {
    const { phone, password, name } = req.body;
    if (!phone || !password || !name) return res.status(400).json({ error: "لطفا تمام فیلدها را پر کنید" });

    try {
        const id = 'user_' + Date.now();
        const joinedDate = new Date().toLocaleDateString('fa-IR');
        
        // Ensure JSON fields are passed as valid JSON strings for JSONB columns
        const emptyJsonArray = JSON.stringify([]);
        
        await pool.query(
            `INSERT INTO users (id, phone, password, name, bio, joined_date, learned_data, traits, custom_instructions) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [id, phone, password, name, 'کاربر جدید', joinedDate, emptyJsonArray, emptyJsonArray, '']
        );

        const newUser = {
            id, phone, name, email: '', bio: 'کاربر جدید',
            joinedDate, learnedData: [], traits: [], customInstructions: ''
        };
        res.status(200).json(newUser);
    } catch (err) {
        console.error("Register Error:", err);
        if (err.code === '23505') return res.status(409).json({ error: "این شماره تلفن قبلا ثبت شده است." });
        
        // Return actual error message for debugging
        res.status(500).json({ error: "خطای پایگاه داده: " + err.message });
    }
};

export const login = async (req, res) => {
    const { phone, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
        if (result.rows.length === 0) return res.status(401).json({ error: "کاربری با این شماره یافت نشد." });
        
        const user = result.rows[0];
        if (user.password !== password) return res.status(401).json({ error: "رمز عبور اشتباه است." });

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
        console.error("Login Error:", err);
        res.status(500).json({ error: "خطای سرور: " + err.message });
    }
};
import pool from '../config/db.js';

export const getUser = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
        
        const user = result.rows[0];
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
        res.json(userSafe);
    } catch (err) {
        res.status(500).json({ error: "Database Error" });
    }
};

export const updateUser = async (req, res) => {
    const u = req.body;
    try {
        await pool.query(
            `UPDATE users SET 
             name=$1, email=$2, bio=$3, avatar=$4, learned_data=$5, traits=$6, custom_instructions=$7 
             WHERE id=$8`,
            [u.name, u.email, u.bio, u.avatar, JSON.stringify(u.learnedData), JSON.stringify(u.traits), u.customInstructions, u.id]
        );
        res.json(u);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Update failed" });
    }
};
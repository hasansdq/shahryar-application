import pool from '../config/db.js';

export const getSessions = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sessions WHERE user_id = $1 ORDER BY updated_at DESC', [req.params.userId]);
        const sessions = result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            title: row.title,
            messages: row.messages || [],
            createdAt: parseInt(row.created_at),
            updatedAt: parseInt(row.updated_at)
        }));
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: "DB Error" });
    }
};

export const saveSession = async (req, res) => {
    const s = req.body;
    try {
        await pool.query(
            `INSERT INTO sessions (id, user_id, title, messages, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
             title = EXCLUDED.title,
             messages = EXCLUDED.messages,
             updated_at = EXCLUDED.updated_at`,
            [s.id, s.userId, s.title, JSON.stringify(s.messages), s.createdAt, s.updatedAt]
        );
        res.json(s);
    } catch (err) {
        console.error("Session Save Error:", err);
        res.status(500).json({ error: "Save Failed" });
    }
};

export const deleteSession = async (req, res) => {
    try {
        await pool.query('DELETE FROM sessions WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Delete Failed" });
    }
};
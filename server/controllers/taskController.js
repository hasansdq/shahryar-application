import pool from '../config/db.js';

export const getTasks = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tasks WHERE user_id = $1', [req.params.userId]);
        const tasks = result.rows.map(r => ({
            id: r.id,
            userId: r.user_id,
            categoryId: r.category_id,
            title: r.title,
            description: r.description,
            status: r.status,
            date: r.date,
            createdAt: parseInt(r.created_at)
        }));
        res.json(tasks);
    } catch (err) { res.status(500).json({ error: "DB Error" }); }
};

export const saveTask = async (req, res) => {
    const t = req.body;
    try {
        await pool.query(
            `INSERT INTO tasks (id, user_id, category_id, title, description, status, date, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET
             category_id = EXCLUDED.category_id,
             title = EXCLUDED.title,
             description = EXCLUDED.description,
             status = EXCLUDED.status,
             date = EXCLUDED.date`,
            [t.id, t.userId, t.categoryId, t.title, t.description, t.status, t.date, t.createdAt]
        );
        res.json(t);
    } catch (err) { res.status(500).json({ error: "Save Failed" }); }
};

export const deleteTask = async (req, res) => {
    try {
        await pool.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [req.params.taskId, req.params.userId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Delete Failed" }); }
};

export const getCategories = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM categories WHERE user_id = $1', [req.params.userId]);
        if (result.rows.length === 0) {
            const defaults = [
                { id: 'cat_todo', title: 'برای انجام', color: '#3b82f6' },
                { id: 'cat_doing', title: 'در حال انجام', color: '#eab308' },
                { id: 'cat_done', title: 'انجام شده', color: '#22c55e' }
            ];
            for (const d of defaults) {
                await pool.query(
                    'INSERT INTO categories (id, user_id, title, color) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
                    [d.id, req.params.userId, d.title, d.color]
                );
            }
            return res.json(defaults);
        }
        
        const cats = result.rows.map(r => ({
            id: r.id,
            userId: r.user_id,
            title: r.title,
            color: r.color
        }));
        res.json(cats);
    } catch (err) { res.status(500).json({ error: "DB Error" }); }
};
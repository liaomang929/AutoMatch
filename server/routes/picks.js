const express = require('express');
const router = express.Router();
const pool = require('../services/pgPool');
const { authMiddleware } = require('./auth');

// GET /api/picks?date=2026-04-21  获取某天的精选（所有人可访问）
router.get('/', async (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  try {
    const result = await pool.query(
      `SELECT p.*, u.nickname as publisher_name
       FROM picks p
       LEFT JOIN users u ON p.published_by = u.id
       WHERE p.date = $1
       ORDER BY p.created_at DESC
       LIMIT 1`,
      [date]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (e) {
    console.error('获取精选失败:', e);
    res.json({ success: false, error: '获取失败' });
  }
});

// POST /api/picks  发布精选（管理员）
router.post('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.json({ success: false, error: '无权限' });

  const { date, matches, opinion, combo_odds } = req.body;
  if (!date || !matches || matches.length === 0) {
    return res.json({ success: false, error: '请填写日期和比赛信息' });
  }
  if (matches.length > 3) {
    return res.json({ success: false, error: '最多3场比赛' });
  }

  try {
    // 同一天只保留最新一条（先删旧的）
    await pool.query('DELETE FROM picks WHERE date=$1', [date]);

    const result = await pool.query(
      `INSERT INTO picks (date, matches, opinion, combo_odds, published_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [date, JSON.stringify(matches), opinion || '', combo_odds || null, req.user.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    console.error('发布精选失败:', e);
    res.json({ success: false, error: '发布失败' });
  }
});

// DELETE /api/picks/:date  删除某天精选（管理员）
router.delete('/:date', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.json({ success: false, error: '无权限' });
  try {
    await pool.query('DELETE FROM picks WHERE date=$1', [req.params.date]);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: '删除失败' });
  }
});

// GET /api/picks/history  获取历史精选列表（最近30条）
router.get('/history', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.date, p.combo_odds, p.created_at, p.opinion,
              u.nickname as publisher_name,
              jsonb_array_length(p.matches) as match_count
       FROM picks p
       LEFT JOIN users u ON p.published_by = u.id
       ORDER BY p.date DESC LIMIT 30`
    );
    res.json({ success: true, data: result.rows });
  } catch (e) {
    res.json({ success: false, error: '获取失败' });
  }
});

module.exports = router;

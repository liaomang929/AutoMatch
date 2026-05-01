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
  console.log('----------------user:', req.user);
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

// GET /api/picks/all  获取所有精选（含完整比赛数据）
router.get('/all', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.nickname as publisher_name
       FROM picks p
       LEFT JOIN users u ON p.published_by = u.id
       ORDER BY p.date DESC LIMIT 100`
    );
    res.json({ success: true, data: result.rows });
  } catch (e) {
    console.error('获取所有精选失败:', e);
    res.json({ success: false, error: '获取失败' });
  }
});

// GET /api/picks/hit-rate?days=7  计算近N天命中率（从昨天往前推N天，不含今天）
router.get('/hit-rate', async (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const dateStrs = [];
  const today = new Date();
  for (let i = 1; i <= days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dateStrs.push(d.toISOString().slice(0, 10));
  }

  try {
    const result = await pool.query(
      `SELECT date, matches FROM picks WHERE date = ANY($1) ORDER BY date DESC`,
      [dateStrs]
    );

    const picksByDate = {};
    for (const row of result.rows) {
      picksByDate[row.date] = row.matches;
    }

    let hitDays = 0;
    let totalDays = 0;
    for (const dateStr of dateStrs) {
      const matches = picksByDate[dateStr];
      if (!matches || matches.length === 0) continue;
      const allHaveResult = matches.every(m => m.actualResult);
      if (!allHaveResult) continue;
      totalDays++;
      const allCorrect = matches.every(m =>
        m.predictions && m.predictions.includes(m.actualResult)
      );
      if (allCorrect) hitDays++;
    }

    res.json({
      success: true,
      data: {
        hitDays,
        totalDays,
        rate: totalDays > 0 ? +(hitDays / totalDays).toFixed(3) : 0,
        startDate: dateStrs[dateStrs.length - 1],
        endDate: dateStrs[0],
      }
    });
  } catch (e) {
    console.error('计算命中率失败:', e);
    res.json({ success: false, error: '计算失败' });
  }
});

// PUT /api/picks/result  更新某场比赛的实际结果（管理员）
router.put('/result', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.json({ success: false, error: '无权限' });

  const { date, matchNo, actualResult } = req.body;
  if (!date || matchNo === undefined || matchNo === null || !actualResult) {
    return res.status(400).json({ success: false, error: '缺少必要参数' });
  }

  try {
    // 获取该日精选
    const pick = await pool.query(
      'SELECT * FROM picks WHERE date = $1 ORDER BY created_at DESC LIMIT 1',
      [date]
    );
    if (!pick.rows[0]) {
      return res.status(404).json({ success: false, error: '未找到该日精选' });
    }

    const matches = pick.rows[0].matches;
    const matchNoStr = String(matchNo);
    let found = false;
    const updated = matches.map(m => {
      if (String(m.no) === matchNoStr) {
        found = true;
        return { ...m, actualResult };
      }
      return m;
    });

    if (!found) {
      return res.status(404).json({ success: false, error: '未找到该编号的比赛' });
    }

    await pool.query(
      'UPDATE picks SET matches = $1 WHERE id = $2',
      [JSON.stringify(updated), pick.rows[0].id]
    );

    res.json({ success: true, data: { date, matchNo, actualResult } });
  } catch (e) {
    console.error('更新实际结果失败:', e);
    res.status(500).json({ success: false, error: '更新失败' });
  }
});

module.exports = router;

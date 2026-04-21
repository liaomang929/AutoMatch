const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../services/pgPool');

const JWT_SECRET = process.env.JWT_SECRET || 'qiuzhijian_secret_2026';
const TRIAL_DAYS = 3;

// 生成随机授权码 XXXX-XXXX-XXXX
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${seg()}-${seg()}-${seg()}`;
}

// 中间件：验证 JWT
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: '未登录' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'token已过期，请重新登录' });
  }
}

// 中间件：验证管理员
function adminMiddleware(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  next();
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, nickname } = req.body;
  if (!email || !password) return res.json({ success: false, error: '邮箱和密码不能为空' });
  if (password.length < 6) return res.json({ success: false, error: '密码至少6位' });

  try {
    const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
    if (exists.rows.length > 0) return res.json({ success: false, error: '该邮箱已注册' });

    const hash = await bcrypt.hash(password, 10);
    const trialExpire = new Date(Date.now() + TRIAL_DAYS * 24 * 3600 * 1000);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, nickname, trial_expire_at)
       VALUES ($1, $2, $3, $4) RETURNING id, email, nickname, role, trial_expire_at`,
      [email.toLowerCase(), hash, nickname || email.split('@')[0], trialExpire]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });

    res.json({ success: true, data: { token, user: { id: user.id, email: user.email, nickname: user.nickname, role: user.role, trialExpireAt: user.trial_expire_at } } });
  } catch (e) {
    console.error('注册失败:', e);
    res.json({ success: false, error: '注册失败，请稍后重试' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.json({ success: false, error: '邮箱和密码不能为空' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase()]);
    if (result.rows.length === 0) return res.json({ success: false, error: '邮箱或密码错误' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.json({ success: false, error: '邮箱或密码错误' });

    // 获取最新授权状态
    const license = await pool.query(
      `SELECT expire_at FROM license_codes WHERE user_id=$1 AND status='active' ORDER BY expire_at DESC LIMIT 1`,
      [user.id]
    );

    const now = new Date();
    const trialValid = new Date(user.trial_expire_at) > now;
    const licenseExpire = license.rows[0]?.expire_at;
    const licenseValid = licenseExpire && new Date(licenseExpire) > now;
    const authorized = trialValid || licenseValid;
    const expireAt = licenseValid ? licenseExpire : user.trial_expire_at;

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, email: user.email, nickname: user.nickname, role: user.role },
        auth: { authorized, expireAt, isTrial: trialValid && !licenseValid }
      }
    });
  } catch (e) {
    console.error('登录失败:', e);
    res.json({ success: false, error: '登录失败，请稍后重试' });
  }
});

// GET /api/auth/status  (需要登录)
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const user = await pool.query('SELECT id, email, nickname, role, trial_expire_at FROM users WHERE id=$1', [req.user.id]);
    if (user.rows.length === 0) return res.json({ success: false, error: '用户不存在' });

    const u = user.rows[0];
    const license = await pool.query(
      `SELECT expire_at FROM license_codes WHERE user_id=$1 AND status='active' ORDER BY expire_at DESC LIMIT 1`,
      [u.id]
    );

    const now = new Date();
    const trialValid = new Date(u.trial_expire_at) > now;
    const licenseExpire = license.rows[0]?.expire_at;
    const licenseValid = licenseExpire && new Date(licenseExpire) > now;
    const authorized = trialValid || licenseValid;
    const expireAt = licenseValid ? licenseExpire : u.trial_expire_at;

    res.json({
      success: true,
      data: {
        user: { id: u.id, email: u.email, nickname: u.nickname, role: u.role },
        auth: { authorized, expireAt, isTrial: trialValid && !licenseValid }
      }
    });
  } catch (e) {
    res.json({ success: false, error: '获取状态失败' });
  }
});

// POST /api/auth/activate  (需要登录，输入授权码)
router.post('/activate', authMiddleware, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.json({ success: false, error: '请输入授权码' });

  try {
    const result = await pool.query('SELECT * FROM license_codes WHERE code=$1', [code.toUpperCase()]);
    if (result.rows.length === 0) return res.json({ success: false, error: '授权码不存在' });

    const lic = result.rows[0];
    if (lic.status !== 'unused') return res.json({ success: false, error: '授权码已被使用' });

    const now = new Date();
    const expireAt = new Date(now.getTime() + lic.days * 24 * 3600 * 1000);

    await pool.query(
      `UPDATE license_codes SET status='active', user_id=$1, activated_at=$2, expire_at=$3 WHERE id=$4`,
      [req.user.id, now, expireAt, lic.id]
    );

    res.json({ success: true, data: { expireAt, days: lic.days, message: `授权成功，有效期至 ${expireAt.toLocaleDateString('zh-CN')}` } });
  } catch (e) {
    console.error('激活失败:', e);
    res.json({ success: false, error: '激活失败，请稍后重试' });
  }
});

// ====== 管理员接口 ======

// POST /api/auth/admin/codes  生成授权码
router.post('/admin/codes', authMiddleware, adminMiddleware, async (req, res) => {
  const { days, count = 1, note } = req.body;
  if (!days || days < 1) return res.json({ success: false, error: '请指定有效天数' });

  try {
    const codes = [];
    for (let i = 0; i < Math.min(count, 50); i++) {
      let code, exists;
      do {
        code = generateCode();
        exists = await pool.query('SELECT id FROM license_codes WHERE code=$1', [code]);
      } while (exists.rows.length > 0);

      await pool.query(
        'INSERT INTO license_codes (code, days, note) VALUES ($1, $2, $3)',
        [code, days, note || null]
      );
      codes.push(code);
    }
    res.json({ success: true, data: { codes, days } });
  } catch (e) {
    console.error('生成授权码失败:', e);
    res.json({ success: false, error: '生成失败' });
  }
});

// GET /api/auth/admin/codes  查看所有授权码
router.get('/admin/codes', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT lc.*, u.email as user_email, u.nickname as user_nickname
       FROM license_codes lc
       LEFT JOIN users u ON lc.user_id = u.id
       ORDER BY lc.created_at DESC LIMIT 200`
    );
    res.json({ success: true, data: result.rows });
  } catch (e) {
    res.json({ success: false, error: '查询失败' });
  }
});

// GET /api/auth/admin/users  查看所有用户
router.get('/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.nickname, u.role, u.trial_expire_at, u.created_at,
        (SELECT expire_at FROM license_codes WHERE user_id=u.id AND status='active' ORDER BY expire_at DESC LIMIT 1) as license_expire_at
       FROM users u ORDER BY u.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (e) {
    res.json({ success: false, error: '查询失败' });
  }
});

// DELETE /api/auth/admin/codes/:code  删除未使用的授权码
router.delete('/admin/codes/:code', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM license_codes WHERE code=$1 AND status=\'unused\' RETURNING id',
      [req.params.code]
    );
    if (result.rows.length === 0) return res.json({ success: false, error: '授权码不存在或已被使用' });
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: '删除失败' });
  }
});

module.exports = { router, authMiddleware };

const { pool } = require('./db');
const fileStorage = require('./fileStorage');

// ===== 原始比赛数据 (matches_raw JSONB) =====

async function saveRawMatches(date, matches) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM matches_raw WHERE date = $1', [date]);
    await client.query(
      'INSERT INTO matches_raw (date, matches, scraped_at) VALUES ($1, $2::jsonb, NOW())',
      [date, JSON.stringify(matches)]
    );
    await client.query('COMMIT');
    console.log(`💾 原始数据已保存到DB: ${date} 共${matches.length}场`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function readRawMatches(date) {
  try {
    const res = await pool.query(
      'SELECT matches FROM matches_raw WHERE date = $1',
      [date]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0].matches;
  } catch (e) {
    console.error('读取原始数据失败:', e.message);
    return null;
  }
}

// ===== 选场预测数据 (matches_selected JSONB) =====

async function saveSelectedMatches(date, selectedMatches) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM matches_selected WHERE date = $1', [date]);

    for (const m of selectedMatches) {
      await client.query(
        'INSERT INTO matches_selected (date, match_id, data, updated_at) VALUES ($1, $2, $3::jsonb, NOW())',
        [date, m.matchId, JSON.stringify(m)]
      );
    }
    await client.query('COMMIT');
    console.log(`💾 重点比赛已保存到DB: ${date} 共${selectedMatches.length}场`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function readSelectedMatches(date) {
  try {
    const res = await pool.query(
      'SELECT match_id, data FROM matches_selected WHERE date = $1 ORDER BY id',
      [date]
    );
    return res.rows.map(r => r.data);
  } catch (e) {
    console.error('读取重点比赛失败:', e.message);
    return null;
  }
}

// ===== AI分析 (表已删除, 回退到文件存储) =====

async function saveAnalysis(date, matchId, analysis) {
  return fileStorage.saveAnalysis(date, matchId, analysis);
}

function readAnalyses(date) {
  return fileStorage.readAnalyses(date);
}

// ===== 文案 (表已删除, 回退到文件存储) =====

async function saveWechatArticle(date, article) {
  return fileStorage.saveWechatArticle(date, article);
}

async function saveLiveScript(date, script) {
  return fileStorage.saveLiveScript(date, script);
}

function readWechatArticle(date) {
  return fileStorage.readWechatArticle(date);
}

function readLiveScript(date) {
  return fileStorage.readLiveScript(date);
}

// ===== 日期列表 =====

function getAvailableDates() {
  return pool.query(
    "SELECT DISTINCT date FROM matches_raw ORDER BY date DESC"
  ).then(res => res.rows.map(r => {
    const d = r.date;
    return typeof d === 'object'
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : String(d);
  })).catch(() => []);
}

// ===== 历史记录 (只查 matches_selected, 无 ai_analyses 关联) =====

async function getHistoryRecords({ startDate, endDate, page = 1, pageSize = 10 } = {}) {
  let whereClause = 'WHERE 1=1';
  const params = [];
  let paramIdx = 1;

  if (startDate) {
    whereClause += ` AND date >= $${paramIdx++}`;
    params.push(startDate);
  }
  if (endDate) {
    whereClause += ` AND date <= $${paramIdx++}`;
    params.push(endDate);
  }

  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM matches_selected ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total);

  const offset = (page - 1) * pageSize;
  const dataResult = await pool.query(
    `SELECT date, match_id, data FROM matches_selected ${whereClause} ORDER BY date DESC, id LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, pageSize, offset]
  );

  const list = dataResult.rows.map(row => {
    const r = row.data || {};
    if (r.date && typeof r.date === 'object') {
      const d = r.date;
      r.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } else if (row.date) {
      r.date = typeof row.date === 'object'
        ? `${row.date.getFullYear()}-${String(row.date.getMonth() + 1).padStart(2, '0')}-${String(row.date.getDate()).padStart(2, '0')}`
        : String(row.date);
    }
    return r;
  });

  return { list, total, page, pageSize };
}

// ===== AI配置 (表已删除, 回退到文件存储) =====

function getAIConfig() {
  return fileStorage.getConfig();
}

function saveAIConfig(config) {
  return fileStorage.saveConfig(config);
}

function getActiveConfig() {
  return fileStorage.getActiveConfig();
}

// ===== 通用辅助 =====

function getToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function ensureDir() { /* PG模式不需要 */ }
function readMarkdownFile(filePath) { return fileStorage.readMarkdownFile(filePath); }
function getDateDir() { return ''; }

module.exports = {
  BASE_DIR: '',
  getToday,
  getDateDir,
  saveRawMatches,
  readRawMatches,
  saveSelectedMatches,
  readSelectedMatches,
  saveAnalysis,
  readAnalyses,
  saveWechatArticle,
  saveLiveScript,
  readWechatArticle,
  readLiveScript,
  getAvailableDates,
  readMarkdownFile,
  ensureDir,
  getHistoryRecords,
  getConfig: getAIConfig,
  saveConfig: saveAIConfig,
  getActiveConfig,
};

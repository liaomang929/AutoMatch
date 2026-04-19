const { pool } = require('./db');

// ===== 辅助函数 =====

/** 将 camelCase 对象转为 snake_case 用于 SQL */
function toSnakeCase(obj) {
  const map = {
    matchId: 'match_id', homeTeam: 'home_team', awayTeam: 'away_team',
    matchTime: 'match_time', oddsWin: 'odds_win', oddsDraw: 'odds_draw',
    oddsLoss: 'odds_loss', handicapLine: 'handicap_line', handicapWin: 'handicap_win',
    handicapDraw: 'handicap_draw', handicapLoss: 'handicap_loss', matchIndex: 'match_index',
    scrapedAt: 'scraped_at', analysisNote: 'analysis_note', isHot: 'is_hot',
    actualResult: 'actual_result', bannedWordsFound: 'banned_words_found',
    createdAt: 'created_at', updatedAt: 'updated_at', aiAnalysis: 'ai_analysis',
  };
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    const newKey = map[key] || key;
    result[newKey] = val;
  }
  return result;
}

/** 将 snake_case 行转为 camelCase 对象 */
function toCamelCase(row) {
  const map = {
    match_id: 'matchId', home_team: 'homeTeam', away_team: 'awayTeam',
    match_time: 'matchTime', odds_win: 'oddsWin', odds_draw: 'oddsDraw',
    odds_loss: 'oddsLoss', handicap_line: 'handicapLine', handicap_win: 'handicapWin',
    handicap_draw: 'handicapDraw', handicap_loss: 'handicapLoss', match_index: 'matchIndex',
    scraped_at: 'scrapedAt', analysis_note: 'analysisNote', is_hot: 'isHot',
    actual_result: 'actualResult', banned_words_found: 'bannedWordsFound',
    created_at: 'createdAt', updated_at: 'updatedAt',
  };
  const result = {};
  for (const [key, val] of Object.entries(row)) {
    const newKey = map[key] || key;
    result[newKey] = val;
  }
  return result;
}

/** 将空字符串转为 null（PostgreSQL numeric 字段不接受空字符串） */
function cleanNumeric(val) {
  if (val === '' || val === undefined || val === null) return null;
  return val;
}

// ===== 原始比赛数据 =====

async function saveRawMatches(date, matches) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // 先删除该日期旧数据
    await client.query('DELETE FROM matches WHERE date = $1', [date]);
    
    for (const m of matches) {
      const s = toSnakeCase({ ...m, date });
      await client.query(`
        INSERT INTO matches (date, match_id, league, home_team, away_team, match_time,
          odds_win, odds_draw, odds_loss, handicap_line, handicap_win, handicap_draw, handicap_loss,
          match_index, scraped_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      `, [s.date, s.match_id, s.league, s.home_team, s.away_team, s.match_time,
          cleanNumeric(s.odds_win), cleanNumeric(s.odds_draw), cleanNumeric(s.odds_loss), 
          s.handicap_line, cleanNumeric(s.handicap_win), cleanNumeric(s.handicap_draw), cleanNumeric(s.handicap_loss),
          s.match_index, s.scraped_at]);
    }
    await client.query('COMMIT');
    console.log(`💾 原始数据已保存: ${date} 共${matches.length}场`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function readRawMatches(date) {
  return pool.query(
    'SELECT * FROM matches WHERE date = $1 ORDER BY match_index',
    [date]
  ).then(res => res.rows.map(toCamelCase)).catch(() => null);
}

// ===== 选场预测数据 =====

async function saveSelectedMatches(date, selectedMatches) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM selected_matches WHERE date = $1', [date]);
    
    for (const m of selectedMatches) {
      const s = toSnakeCase({ ...m, date });
      await client.query(`
        INSERT INTO selected_matches (date, match_id, league, home_team, away_team, match_time,
          odds_win, odds_draw, odds_loss, handicap_line, handicap_win, handicap_draw, handicap_loss,
          prediction, confidence, analysis_note, is_hot, actual_result)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      `, [s.date, s.match_id, s.league, s.home_team, s.away_team, s.match_time,
          cleanNumeric(s.odds_win), cleanNumeric(s.odds_draw), cleanNumeric(s.odds_loss), 
          s.handicap_line, cleanNumeric(s.handicap_win), cleanNumeric(s.handicap_draw), cleanNumeric(s.handicap_loss),
          s.prediction, s.confidence, s.analysis_note, s.is_hot, s.actual_result]);
    }
    await client.query('COMMIT');
    console.log(`💾 重点比赛已保存: ${date} 共${selectedMatches.length}场`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function readSelectedMatches(date) {
  return pool.query(
    'SELECT * FROM selected_matches WHERE date = $1 ORDER BY id',
    [date]
  ).then(res => res.rows.map(toCamelCase)).catch(() => null);
}

// ===== AI分析 =====

async function saveAnalysis(date, matchId, analysis) {
  const s = toSnakeCase(analysis);
  const existing = await pool.query(
    'SELECT id FROM ai_analyses WHERE date = $1 AND match_id = $2',
    [date, matchId]
  );
  
  if (existing.rows.length > 0) {
    await pool.query(`
      UPDATE ai_analyses SET home_team = $1, away_team = $2, prediction = $3,
        content = $4, banned_words_found = $5, updated_at = NOW()
      WHERE date = $6 AND match_id = $7
    `, [s.home_team, s.away_team, s.prediction, s.content, s.banned_words_found, date, matchId]);
  } else {
    await pool.query(`
      INSERT INTO ai_analyses (date, match_id, home_team, away_team, prediction, content, banned_words_found)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [date, matchId, s.home_team, s.away_team, s.prediction, s.content, s.banned_words_found]);
  }
  console.log(`💾 AI分析已保存: ${date}/${matchId}`);
}

function readAnalyses(date) {
  return pool.query(
    'SELECT * FROM ai_analyses WHERE date = $1 ORDER BY id',
    [date]
  ).then(res => res.rows.map(toCamelCase)).catch(() => []);
}

// ===== 文案 =====

async function saveWechatArticle(date, article) {
  const s = toSnakeCase(article);
  await pool.query(`
    INSERT INTO articles (date, type, content, banned_words_found, meta)
    VALUES ($1, 'wechat', $2, $3, $4)
    ON CONFLICT (date, type) DO UPDATE SET
      content = EXCLUDED.content, banned_words_found = EXCLUDED.banned_words_found,
      meta = EXCLUDED.meta, created_at = NOW()
  `, [date, s.content, s.banned_words_found, JSON.stringify({ hotMatch: article.hotMatch })]);
  console.log(`💾 公众号文案已保存: ${date}`);
}

async function saveLiveScript(date, script) {
  const s = toSnakeCase(script);
  await pool.query(`
    INSERT INTO articles (date, type, content, banned_words_found, meta)
    VALUES ($1, 'live', $2, $3, $4)
    ON CONFLICT (date, type) DO UPDATE SET
      content = EXCLUDED.content, banned_words_found = EXCLUDED.banned_words_found,
      meta = EXCLUDED.meta, created_at = NOW()
  `, [date, s.content, s.banned_words_found, JSON.stringify({ matches: script.matches })]);
  console.log(`💾 直播文案已保存: ${date}`);
}

function readWechatArticle(date) {
  return pool.query(
    "SELECT * FROM articles WHERE date = $1 AND type = 'wechat'",
    [date]
  ).then(res => {
    if (res.rows.length === 0) return null;
    const row = toCamelCase(res.rows[0]);
    row.createdAt = row.createdAt?.toISOString?.() || row.createdAt;
    if (row.meta && typeof row.meta === 'string') row.meta = JSON.parse(row.meta);
    return row;
  }).catch(() => null);
}

function readLiveScript(date) {
  return pool.query(
    "SELECT * FROM articles WHERE date = $1 AND type = 'live'",
    [date]
  ).then(res => {
    if (res.rows.length === 0) return null;
    const row = toCamelCase(res.rows[0]);
    row.createdAt = row.createdAt?.toISOString?.() || row.createdAt;
    if (row.meta && typeof row.meta === 'string') row.meta = JSON.parse(row.meta);
    return row;
  }).catch(() => null);
}

// ===== 日期列表 =====

function getAvailableDates() {
  return pool.query(
    "SELECT DISTINCT date FROM matches ORDER BY date DESC"
  ).then(res => res.rows.map(r => {
    const d = r.date;
    return typeof d === 'object' ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : String(d);
  })).catch(() => []);
}

// ===== 历史记录 =====

async function getHistoryRecords({ startDate, endDate, page = 1, pageSize = 10 } = {}) {
  let whereClause = 'WHERE 1=1';
  const params = [];
  let paramIdx = 1;
  
  if (startDate) {
    whereClause += ` AND sm.date >= $${paramIdx++}`;
    params.push(startDate);
  }
  if (endDate) {
    whereClause += ` AND sm.date <= $${paramIdx++}`;
    params.push(endDate);
  }
  
  // 总数
  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM selected_matches sm ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total);
  
  // 分页数据
  const offset = (page - 1) * pageSize;
  const dataResult = await pool.query(
    `SELECT sm.*, aa.content as ai_analysis
     FROM selected_matches sm
     LEFT JOIN ai_analyses aa ON sm.date = aa.date AND sm.match_id = aa.match_id
     ${whereClause}
     ORDER BY sm.date DESC, sm.id
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, pageSize, offset]
  );
  
  const list = dataResult.rows.map(row => {
    const r = toCamelCase(row);
    // 格式化日期
    if (r.date && typeof r.date === 'object') {
      const d = r.date;
      r.date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    } else if (r.date) {
      r.date = String(r.date);
    }
    return r;
  });
  
  return { list, total, page, pageSize };
}

// ===== AI配置 (ai_config 表) =====

const DEFAULT_CONFIG = {
  provider: 'zhipu',
  zhipu: { apiKey: '', model: 'glm-4' },
  openai_compatible: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4' },
  custom: { apiKey: '', baseUrl: '', model: '' },
};

async function getAIConfig() {
  try {
    const res = await pool.query(
      "SELECT config_value FROM ai_config WHERE config_key = 'main'"
    );
    if (res.rows.length === 0) return { ...DEFAULT_CONFIG };
    const saved = res.rows[0].config_value;
    return {
      ...DEFAULT_CONFIG,
      ...saved,
      zhipu: { ...DEFAULT_CONFIG.zhipu, ...(saved.zhipu || {}) },
      openai_compatible: { ...DEFAULT_CONFIG.openai_compatible, ...(saved.openai_compatible || {}) },
      custom: { ...DEFAULT_CONFIG.custom, ...(saved.custom || {}) },
    };
  } catch (e) {
    console.error('读取AI配置失败:', e.message);
    return { ...DEFAULT_CONFIG };
  }
}

async function saveAIConfig(config) {
  await pool.query(`
    INSERT INTO ai_config (config_key, config_value, updated_at)
    VALUES ('main', $1, NOW())
    ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = NOW()
  `, [JSON.stringify(config)]);
  console.log('💾 AI配置已保存');
}

// ===== 通用辅助 =====

function getToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function ensureDir() { /* PG模式不需要 */ }
function readMarkdownFile() { return null; }
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
  getActiveConfig: async () => {
    const config = await getAIConfig();
    const provider = config.provider;
    const providerConfig = config[provider] || {};
    return {
      provider,
      apiKey: providerConfig.apiKey || '',
      baseUrl: providerConfig.baseUrl || '',
      model: providerConfig.model || '',
    };
  },
};

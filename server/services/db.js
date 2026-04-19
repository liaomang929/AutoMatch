const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/automatch';

const pool = new Pool({
  connectionString: DATABASE_URL,
  // 连接池配置
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

/**
 * 初始化数据库表结构
 */
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 表1: matches - 原始比赛数据
    await client.query(`
      CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        match_id VARCHAR(20) NOT NULL,
        league VARCHAR(50),
        home_team VARCHAR(100),
        away_team VARCHAR(100),
        match_time VARCHAR(20),
        odds_win NUMERIC(6,2),
        odds_draw NUMERIC(6,2),
        odds_loss NUMERIC(6,2),
        handicap_line VARCHAR(10),
        handicap_win NUMERIC(6,2),
        handicap_draw NUMERIC(6,2),
        handicap_loss NUMERIC(6,2),
        match_index INTEGER,
        scraped_at TIMESTAMP,
        UNIQUE(date, match_id)
      )
    `);

    // 表2: selected_matches - 选场预测数据
    await client.query(`
      CREATE TABLE IF NOT EXISTS selected_matches (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        match_id VARCHAR(20) NOT NULL,
        league VARCHAR(50),
        home_team VARCHAR(100),
        away_team VARCHAR(100),
        match_time VARCHAR(20),
        odds_win NUMERIC(6,2),
        odds_draw NUMERIC(6,2),
        odds_loss NUMERIC(6,2),
        handicap_line VARCHAR(10),
        handicap_win NUMERIC(6,2),
        handicap_draw NUMERIC(6,2),
        handicap_loss NUMERIC(6,2),
        prediction VARCHAR(20),
        confidence INTEGER DEFAULT 3,
        analysis_note TEXT,
        is_hot BOOLEAN DEFAULT false,
        actual_result VARCHAR(10),
        UNIQUE(date, match_id)
      )
    `);

    // 表3: ai_analyses - AI分析
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_analyses (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        match_id VARCHAR(20) NOT NULL,
        home_team VARCHAR(100),
        away_team VARCHAR(100),
        prediction VARCHAR(20),
        content TEXT NOT NULL,
        banned_words_found TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP,
        UNIQUE(date, match_id)
      )
    `);

    // 表4: articles - 文案
    await client.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        type VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        banned_words_found TEXT,
        meta JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(date, type)
      )
    `);

    // 表5: ai_config - AI模型配置
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_config (
        id SERIAL PRIMARY KEY,
        config_key VARCHAR(50) UNIQUE NOT NULL,
        config_value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query('COMMIT');
    console.log('✅ 数据库表初始化完成');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ 数据库初始化失败:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 测试数据库连接
 */
async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ 数据库连接成功:', result.rows[0].now);
    return true;
  } catch (err) {
    console.error('❌ 数据库连接失败:', err.message);
    return false;
  }
}

module.exports = { pool, initDatabase, testConnection };

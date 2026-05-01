const { Pool } = require('pg');

const pool = new Pool({
  host: '8.163.73.185',
  port: 5432,
  database: 'qiuzhijian',
  user: 'qzj_user',
  password: 'Wyk4sGkY8jXbRz3T',
  ssl: false,
  connectionTimeoutMillis: 10000,
});

async function init() {
  const client = await pool.connect();
  try {
    console.log('✅ 数据库连接成功');

    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        phone VARCHAR(20) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        nickname VARCHAR(50),
        role VARCHAR(20) DEFAULT 'user',
        trial_expire_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ users 表创建成功');

    await client.query(`
      CREATE TABLE license_codes (
        id SERIAL PRIMARY KEY,
        code VARCHAR(20) UNIQUE NOT NULL,
        days INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'unused',
        user_id INTEGER REFERENCES users(id),
        note TEXT,
        activated_at TIMESTAMP,
        expire_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ license_codes 表创建成功');

    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_license_codes_code ON license_codes(code)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_license_codes_user_id ON license_codes(user_id)`);
    console.log('✅ 索引创建成功');

    console.log('\n🎉 数据库初始化完成！');
  } catch (e) {
    console.error('❌ 初始化失败:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

init();

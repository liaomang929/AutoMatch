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
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        nickname VARCHAR(100),
        role VARCHAR(20) DEFAULT 'user',
        trial_expire_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✅ users 表创建成功');

    await client.query(`
      CREATE TABLE IF NOT EXISTS license_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(20) UNIQUE NOT NULL,
        days INTEGER NOT NULL,
        user_id UUID REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'unused',
        activated_at TIMESTAMPTZ,
        expire_at TIMESTAMPTZ,
        note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
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

const { Pool } = require('pg');

const pool = new Pool({
  host: '8.163.73.185',
  port: 5432,
  database: 'qiuzhijian',
  user: 'qzj_user',
  password: 'Wyk4sGkY8jXbRz3T',
  ssl: false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('PostgreSQL connection error:', err);
});

module.exports = pool;

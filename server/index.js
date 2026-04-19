require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const scrapeRoute = require('./routes/scrape');
const matchRoute = require('./routes/matches');
const aiRoute = require('./routes/ai');
const articleRoute = require('./routes/articles');
const configRoute = require('./routes/config');
const historyRoute = require('./routes/history');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 静态文件服务 - 保留供Markdown文件访问（可选）
const dataDir = process.env.DATA_DIR || path.join(require('os').homedir(), 'Desktop', 'AutoMatch');
app.use('/data', express.static(dataDir));

// API路由
app.use('/api/scrape', scrapeRoute);
app.use('/api/matches', matchRoute);
app.use('/api/ai', aiRoute);
app.use('/api/articles', articleRoute);
app.use('/api/config', configRoute);
app.use('/api/history', historyRoute);

// 根路由 - 返回简单状态页
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><title>AutoMatch API</title></head>
    <body style="font-family:system-ui;padding:40px;text-align:center;background:#1a1a2e;color:#fff">
      <h1>AutoMatch API Server</h1>
      <p>Backend is running. Frontend: <a href="http://localhost:5173" style="color:#69b1ff">http://localhost:5173</a></p>
      <p>API Health: <a href="/api/health" style="color:#69b1ff">/api/health</a></p>
    </body></html>
  `);
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 如果是直接运行（node server/index.js），则启动服务器
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 AutoMatch 后端服务已启动: http://localhost:${PORT}`);
    console.log(`📁 数据存储目录: ${dataDir}`);
  });
}

module.exports = app;

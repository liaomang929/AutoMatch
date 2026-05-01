const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;

let mainWindow;
let server;

function migrateConfigs() {
  // 首次启动时，将打包的 ai_configs 复制到用户数据目录
  const resourcesDir = path.join(process.resourcesPath, 'ai_configs');
  const targetDir = process.env.AI_CONFIG_DIR;
  if (!targetDir || !fs.existsSync(resourcesDir)) return;
  if (fs.existsSync(targetDir)) return; // 已有配置，跳过

  try {
    fs.mkdirSync(targetDir, { recursive: true });
    for (const f of fs.readdirSync(resourcesDir)) {
      const src = path.join(resourcesDir, f);
      if (fs.statSync(src).isFile()) {
        fs.copyFileSync(src, path.join(targetDir, f));
        console.log(`Migrated config: ${f}`);
      }
    }
  } catch (e) {
    console.error('Config migration failed:', e.message);
  }
}

function startExpress() {
  return new Promise((resolve, reject) => {
    if (!isDev) {
      process.env.NODE_ENV = 'production';
      process.env.AI_CONFIG_DIR = path.join(app.getPath('userData'), 'ai_configs');
      migrateConfigs();
    }
    if (isDev) {
      require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
    }

    const serverApp = require('../server/index');
    const port = process.env.PORT || 3001;

    const s = serverApp.listen(port, () => {
      console.log(`Express started on port ${port}`);
      resolve(port);
    });

    s.on('error', (err) => {
      reject(err);
    });

    server = s;
  });
}

async function createWindow() {
  if (!isDev) {
    try {
      await startExpress();
    } catch (err) {
      console.error('Failed to start Express:', err);
      dialog.showErrorBox('启动失败', '无法启动后端服务，请确认端口 3001 未被占用。\n\n' + err.message);
      app.quit();
      return;
    }
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'AutoMatch - 足球赛事智能分析助手',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const url = isDev
    ? 'http://localhost:5173'
    : `http://localhost:${process.env.PORT || 3001}`;

  mainWindow.loadURL(url);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

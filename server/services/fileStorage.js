const fs = require('fs');
const path = require('path');

const BASE_DIR = process.env.DATA_DIR || path.join(require('os').homedir(), 'Desktop', 'AutoMatch');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getDateDir(date) {
  return path.join(BASE_DIR, date);
}

async function saveRawMatches(date, matches) {
  const dir = path.join(getDateDir(date), '01_原始数据');
  ensureDir(dir);
  const filePath = path.join(dir, 'matches.json');
  fs.writeFileSync(filePath, JSON.stringify(matches, null, 2), 'utf-8');
  console.log(`💾 原始数据已保存: ${filePath}`);
}

function readRawMatches(date) {
  const filePath = path.join(getDateDir(date), '01_原始数据', 'matches.json');
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

async function saveSelectedMatches(date, selectedMatches) {
  const dir = path.join(getDateDir(date), '02_重点比赛');
  ensureDir(dir);
  const filePath = path.join(dir, 'selected.json');
  fs.writeFileSync(filePath, JSON.stringify(selectedMatches, null, 2), 'utf-8');
  console.log(`💾 重点比赛已保存: ${filePath}`);
}

function readSelectedMatches(date) {
  const filePath = path.join(getDateDir(date), '02_重点比赛', 'selected.json');
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

async function saveAnalysis(date, matchId, analysis) {
  const dir = path.join(getDateDir(date), '03_AI分析');
  ensureDir(dir);
  
  const mdPath = path.join(dir, `match_${matchId}_analysis.md`);
  fs.writeFileSync(mdPath, analysis.content, 'utf-8');
  
  const summaryPath = path.join(dir, 'all_analyses.json');
  let allAnalyses = [];
  if (fs.existsSync(summaryPath)) {
    allAnalyses = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
  }
  const existIdx = allAnalyses.findIndex(a => a.matchId === matchId);
  if (existIdx >= 0) {
    allAnalyses[existIdx] = { matchId, ...analysis };
  } else {
    allAnalyses.push({ matchId, ...analysis });
  }
  fs.writeFileSync(summaryPath, JSON.stringify(allAnalyses, null, 2), 'utf-8');
  
  console.log(`💾 AI分析已保存: ${mdPath}`);
}

function readAnalyses(date) {
  const filePath = path.join(getDateDir(date), '03_AI分析', 'all_analyses.json');
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

async function saveWechatArticle(date, article) {
  const dir = path.join(getDateDir(date), '04_公众号文案');
  ensureDir(dir);
  const mdPath = path.join(dir, 'wechat_article.md');
  const jsonPath = path.join(dir, 'wechat_article.json');
  
  fs.writeFileSync(mdPath, article.content, 'utf-8');
  fs.writeFileSync(jsonPath, JSON.stringify(article, null, 2), 'utf-8');
  
  console.log(`💾 公众号文案已保存: ${mdPath}`);
}

async function saveLiveScript(date, script) {
  const dir = path.join(getDateDir(date), '05_直播文案');
  ensureDir(dir);
  const mdPath = path.join(dir, 'live_script.md');
  const jsonPath = path.join(dir, 'live_script.json');
  
  fs.writeFileSync(mdPath, script.content, 'utf-8');
  fs.writeFileSync(jsonPath, JSON.stringify(script, null, 2), 'utf-8');
  
  console.log(`💾 直播文案已保存: ${mdPath}`);
}

function readWechatArticle(date) {
  const filePath = path.join(getDateDir(date), '04_公众号文案', 'wechat_article.json');
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function readLiveScript(date) {
  const filePath = path.join(getDateDir(date), '05_直播文案', 'live_script.json');
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function getAvailableDates() {
  if (!fs.existsSync(BASE_DIR)) return [];
  return fs.readdirSync(BASE_DIR)
    .filter(name => name.match(/^\d{4}-\d{2}-\d{2}$/))
    .sort()
    .reverse();
}

function readMarkdownFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
}

function getHistoryRecords({ startDate, endDate, page = 1, pageSize = 10 } = {}) {
  const dates = getAvailableDates();
  
  let filteredDates = dates;
  if (startDate) filteredDates = filteredDates.filter(d => d >= startDate);
  if (endDate) filteredDates = filteredDates.filter(d => d <= endDate);
  
  const allRecords = [];
  for (const date of filteredDates) {
    const selected = readSelectedMatches(date) || [];
    const analyses = readAnalyses(date);
    
    for (const match of selected) {
      const analysis = analyses.find(a => a.matchId === match.matchId);
      allRecords.push({
        date,
        matchId: match.matchId,
        league: match.league || '',
        homeTeam: match.homeTeam || '',
        awayTeam: match.awayTeam || '',
        prediction: match.prediction || '',
        confidence: match.confidence || 0,
        analysisNote: match.analysisNote || '',
        isHot: match.isHot || false,
        aiAnalysis: analysis ? analysis.content : '',
        matchTime: match.matchTime || '',
        oddsWin: match.oddsWin || '',
        oddsDraw: match.oddsDraw || '',
        oddsLoss: match.oddsLoss || '',
        actualResult: match.actualResult || '',
      });
    }
  }
  
  const total = allRecords.length;
  const start = (page - 1) * pageSize;
  const list = allRecords.slice(start, start + pageSize);
  
  return { list, total, page, pageSize };
}

// AI配置 - 使用文件存储
const CONFIG_PATH = path.join(__dirname, '..', '..', 'ai_config.json');

const DEFAULT_CONFIG = {
  provider: 'zhipu',
  zhipu: { apiKey: '', model: 'glm-4' },
  openai_compatible: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4' },
  custom: { apiKey: '', baseUrl: '', model: '' },
};

function getAIConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      return {
        ...DEFAULT_CONFIG,
        ...saved,
        zhipu: { ...DEFAULT_CONFIG.zhipu, ...(saved.zhipu || {}) },
        openai_compatible: { ...DEFAULT_CONFIG.openai_compatible, ...(saved.openai_compatible || {}) },
        custom: { ...DEFAULT_CONFIG.custom, ...(saved.custom || {}) },
      };
    }
  } catch (e) {
    console.error('读取AI配置失败:', e.message);
  }
  return { ...DEFAULT_CONFIG };
}

function saveAIConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  console.log('💾 AI配置已保存');
}

function getActiveConfig() {
  const config = getAIConfig();
  const provider = config.provider;
  const providerConfig = config[provider] || {};
  return {
    provider,
    apiKey: providerConfig.apiKey || '',
    baseUrl: providerConfig.baseUrl || '',
    model: providerConfig.model || '',
  };
}

module.exports = {
  BASE_DIR,
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

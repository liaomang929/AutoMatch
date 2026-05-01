const BASE_URL = '/api';

// 自动带上 token
async function request(url, options = {}) {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || '请求失败');
  }
  return data;
}

// ====== Auth 相关 ======
export const authRegister = (phone, password, nickname) =>
  request('/auth/register', { method: 'POST', body: JSON.stringify({ phone, password, nickname }) });

export const authLogin = (phone, password) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) });

export const authStatus = () => request('/auth/status');

export const authActivate = (code) =>
  request('/auth/activate', { method: 'POST', body: JSON.stringify({ code }) });

// ====== 管理员接口 ======
export const adminGenerateCodes = (days, count, note) =>
  request('/auth/admin/codes', { method: 'POST', body: JSON.stringify({ days, count, note }) });

export const adminGetCodes = () => request('/auth/admin/codes');

export const adminGetUsers = () => request('/auth/admin/users');

export const adminDeleteCode = (code) =>
  request(`/auth/admin/codes/${code}`, { method: 'DELETE' });

// ====== 抓取相关 ======
export const scrapeMatches = () => request('/scrape', { method: 'POST' });

// ====== 比赛相关 ======
export const getDates = () => request('/matches/dates');
export const getMatches = (date) => request(`/matches/${date}`);
export const saveSelected = (date, selectedMatches) =>
  request(`/matches/${date}/select`, { method: 'PUT', body: JSON.stringify({ selectedMatches }) });
export const savePrediction = (date, matchId, prediction) =>
  request(`/matches/${date}/predict/${matchId}`, { method: 'PUT', body: JSON.stringify(prediction) });

// ====== AI分析相关 ======
export const generateAnalysis = (date, matchId) =>
  request(`/ai/analyze/${date}/${matchId}`, { method: 'POST' });
export const batchGenerateAnalysis = (date) =>
  request(`/ai/analyze/${date}/batch`, { method: 'POST' });
export const getAnalyses = (date) => request(`/ai/analyses/${date}`);
export const updateAnalysis = (date, matchId, content) =>
  request(`/ai/analyses/${date}/${matchId}`, { method: 'PUT', body: JSON.stringify({ content }) });

// ====== 文案相关 ======
export const generateWechatArticle = (date) =>
  request(`/articles/wechat/${date}`, { method: 'POST' });
export const generateLiveScript = (date) =>
  request(`/articles/live/${date}`, { method: 'POST' });
export const getArticles = (date) => request(`/articles/${date}`);

// ====== 配置相关 ======
export const getAIConfig = () => request('/config/ai');
export const saveAIConfig = (config) =>
  request('/config/ai', { method: 'PUT', body: JSON.stringify(config) });
export const testAIConnection = () => request('/config/ai/test', { method: 'POST' });
export const getAIStatus = () => request('/config/ai/status');

// ====== 精选相关 ======
export const getAllPicks = () => request('/picks/all');
export const updatePickResult = (date, matchNo, actualResult) =>
  request('/picks/result', { method: 'PUT', body: JSON.stringify({ date, matchNo, actualResult }) });
export const getPickHitRate = (days = 7) => request(`/picks/hit-rate?days=${days}`);

// ====== 历史记录相关 ======
export const getHistory = (params) => {
  const query = new URLSearchParams(params).toString();
  return request(`/history?${query}`);
};
export const updateActualResult = (date, matchId, actualResult) =>
  request('/history/actual-result', { method: 'PUT', body: JSON.stringify({ date, matchId, actualResult }) });

const BASE_URL = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || '请求失败');
  }
  return data;
}

// 抓取相关
export const scrapeMatches = () => request('/scrape', { method: 'POST' });

// 比赛相关
export const getDates = () => request('/matches/dates');
export const getMatches = (date) => request(`/matches/${date}`);
export const saveSelected = (date, selectedMatches) => 
  request(`/matches/${date}/select`, { 
    method: 'PUT', 
    body: JSON.stringify({ selectedMatches }) 
  });
export const savePrediction = (date, matchId, prediction) => 
  request(`/matches/${date}/predict/${matchId}`, { 
    method: 'PUT', 
    body: JSON.stringify(prediction) 
  });

// AI分析相关
export const generateAnalysis = (date, matchId) => 
  request(`/ai/analyze/${date}/${matchId}`, { method: 'POST' });
export const batchGenerateAnalysis = (date) => 
  request(`/ai/analyze/${date}/batch`, { method: 'POST' });
export const getAnalyses = (date) => request(`/ai/analyses/${date}`);
export const updateAnalysis = (date, matchId, content) => 
  request(`/ai/analyses/${date}/${matchId}`, { 
    method: 'PUT', 
    body: JSON.stringify({ content }) 
  });

// 文案相关
export const generateWechatArticle = (date) => 
  request(`/articles/wechat/${date}`, { method: 'POST' });
export const generateLiveScript = (date) => 
  request(`/articles/live/${date}`, { method: 'POST' });
export const getArticles = (date) => request(`/articles/${date}`);

// 配置相关
export const getAIConfig = () => request('/config/ai');
export const saveAIConfig = (config) => request('/config/ai', {
  method: 'PUT',
  body: JSON.stringify(config)
});
export const testAIConnection = () => request('/config/ai/test', { method: 'POST' });
export const getAIStatus = () => request('/config/ai/status');

// 历史记录相关
export const getHistory = (params) => {
  const query = new URLSearchParams(params).toString();
  return request(`/history?${query}`);
};
export const updateActualResult = (date, matchId, actualResult) =>
  request('/history/actual-result', {
    method: 'PUT',
    body: JSON.stringify({ date, matchId, actualResult })
  });

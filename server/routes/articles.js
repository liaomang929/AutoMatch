const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const dbService = require('../services/dbStorage');
const { filterBannedWords } = require('../services/bannedWords');
const { authMiddleware } = require('./auth');

function getHeatScore(match) {
  return Number(match?.confidence || 0);
}

function sortByHeat(matches = []) {
  return [...matches].sort((a, b) => {
    const scoreDiff = getHeatScore(b) - getHeatScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return Number(a?.index || 999999) - Number(b?.index || 999999);
  });
}

function attachAnalyses(matches, analyses) {
  return matches.map((match) => {
    const analysis = analyses.find((item) => item.matchId === match.matchId);
    return { ...match, aiAnalysis: analysis ? analysis.content : '' };
  });
}

function pickForWechat(selected) {
  const hotMatches = sortByHeat(selected.filter((match) => match.isHot));
  if (hotMatches.length > 0) {
    return hotMatches[0];
  }
  return null;
}

function pickForLive(selected) {
  const hotMatches = sortByHeat(selected.filter((match) => match.isHot));
  if (hotMatches.length >= 3) {
    return hotMatches.slice(0, 3);
  }

  const chosenIds = new Set(hotMatches.map((match) => match.matchId));
  const fallbackMatches = selected.filter((match) => !chosenIds.has(match.matchId));
  return [...hotMatches, ...fallbackMatches].slice(0, 3);
}

/**
 * POST /api/articles/wechat/:date - 生成公众号推文
 */
router.post('/wechat/:date', authMiddleware, async (req, res) => {
  try {
    const { date } = req.params;
    const selected = await dbService.readSelectedMatches(date) || [];
    const analyses = await dbService.readAnalyses(date) || [];

    const hotMatch = pickForWechat(selected);
    if (!hotMatch) {
      return res.status(400).json({ success: false, error: '没有可选的热门比赛' });
    }

    const [matchWithAnalysis] = attachAnalyses([hotMatch], analyses);
    const otherMatch = matchWithAnalysis;
    
    const article = await aiService.generateWechatArticle(matchWithAnalysis, otherMatch, { userId: req.user.id });
    
    // 违禁词过滤
    const { filtered, found } = filterBannedWords(article.content);
    article.content = filtered;
    article.bannedWordsFound = found;
    
    await dbService.saveWechatArticle(date, article);
    
    res.json({ success: true, data: article });
  } catch (error) {
    console.error('公众号文案生成失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/articles/live/:date - 生成直播文案
 */
router.post('/live/:date', authMiddleware, async (req, res) => {
  try {
    const { date } = req.params;
    const selected = await dbService.readSelectedMatches(date) || [];
    const analyses = await dbService.readAnalyses(date) || [];

    const liveMatches = pickForLive(selected);
    if (liveMatches.length < 1) {
      return res.status(400).json({ success: false, error: '没有可选的热门比赛' });
    }

    const matchesWithAnalysis = attachAnalyses(liveMatches, analyses);

    const script = await aiService.generateLiveScript(matchesWithAnalysis, { userId: req.user.id });
    
    // 违禁词过滤
    const { filtered, found } = filterBannedWords(script.content);
    script.content = filtered;
    script.bannedWordsFound = found;
    
    await dbService.saveLiveScript(date, script);
    
    res.json({ success: true, data: script });
  } catch (error) {
    console.error('直播文案生成失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/articles/:date - 获取指定日期所有文案
 */
router.get('/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const wechat = await dbService.readWechatArticle(date);
    const live = await dbService.readLiveScript(date);
    res.json({
      success: true,
      data: { wechat, live }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/articles/live/:date - 从外部保存直播文案（不上传时使用）
 */
router.put('/live/:date', authMiddleware, async (req, res) => {
  try {
    const { date } = req.params;
    const { content, title } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, error: '缺少 content' });
    }
    const script = { content, title: title || '', createdAt: new Date().toISOString() };
    await dbService.saveLiveScript(date, script);
    res.json({ success: true, data: script });
  } catch (error) {
    console.error('保存直播文案失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

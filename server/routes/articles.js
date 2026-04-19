const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const dbService = require('../services/fileStorage');
const { filterBannedWords } = require('../services/bannedWords');

/**
 * POST /api/articles/wechat/:date - 生成公众号推文
 */
router.post('/wechat/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const selected = dbService.readSelectedMatches(date) || [];
    const analyses = dbService.readAnalyses(date) || [];
    
    // 找出热门比赛（isHot=true）
    let hotMatches = selected.filter(m => m.isHot);
    
    // 如果没有标记热门，则取前2场
    if (hotMatches.length < 2) {
      hotMatches = selected.slice(0, 2);
    }
    
    if (hotMatches.length < 1) {
      return res.status(400).json({ success: false, error: '没有可选的热门比赛' });
    }
    
    // 合并AI分析信息
    hotMatches = hotMatches.map(m => {
      const analysis = analyses.find(a => a.matchId === m.matchId);
      return { ...m, aiAnalysis: analysis ? analysis.content : '' };
    });
    
    const hotMatch = hotMatches[0];
    const otherMatch = hotMatches[1] || hotMatches[0];
    
    const article = await aiService.generateWechatArticle(hotMatch, otherMatch);
    
    // 违禁词过滤
    const { filtered, found } = filterBannedWords(article.content);
    article.content = filtered;
    article.bannedWordsFound = found;
    
    dbService.saveWechatArticle(date, article);
    
    res.json({ success: true, data: article });
  } catch (error) {
    console.error('公众号文案生成失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/articles/live/:date - 生成直播文案
 */
router.post('/live/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const selected = dbService.readSelectedMatches(date) || [];
    const analyses = dbService.readAnalyses(date) || [];
    
    // 找出热门比赛（每天选取3场比赛）
    let hotMatches = selected.filter(m => m.isHot);

    // 如果热门比赛不足3场，用选中的比赛补足到3场
    if (hotMatches.length < 3) {
      hotMatches = selected.slice(0, 3);
    }

    if (hotMatches.length < 1) {
      return res.status(400).json({ success: false, error: '没有可选的热门比赛' });
    }
    
    // 合并AI分析信息
    hotMatches = hotMatches.map(m => {
      const analysis = analyses.find(a => a.matchId === m.matchId);
      return { ...m, aiAnalysis: analysis ? analysis.content : '' };
    });
    
    const script = await aiService.generateLiveScript(hotMatches);
    
    // 违禁词过滤
    const { filtered, found } = filterBannedWords(script.content);
    script.content = filtered;
    script.bannedWordsFound = found;
    
    dbService.saveLiveScript(date, script);
    
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
    const wechat = dbService.readWechatArticle(date);
    const live = dbService.readLiveScript(date);
    res.json({ 
      success: true, 
      data: { wechat, live } 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

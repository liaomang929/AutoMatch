const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const dbService = require('../services/fileStorage');
const { filterBannedWords } = require('../services/bannedWords');

/**
 * POST /api/ai/analyze/:date/batch - 批量生成AI分析
 * 注意：此路由必须放在 /:matchId 路由之前，否则 "batch" 会被当作 matchId 匹配
 */
router.post('/analyze/:date/batch', async (req, res) => {
  try {
    const { date } = req.params;
    const selected = dbService.readSelectedMatches(date) || [];
    
    if (selected.length === 0) {
      return res.status(400).json({ success: false, error: '没有选中比赛' });
    }
    
    const results = [];
    for (const match of selected) {
      try {
        const analysis = await aiService.generateMatchAnalysis(match);
        const { filtered, found } = filterBannedWords(analysis.content);
        analysis.content = filtered;
        analysis.bannedWordsFound = found;
        dbService.saveAnalysis(date, match.matchId, analysis);
        results.push(analysis);
      } catch (err) {
        results.push({ 
          matchId: match.matchId, 
          error: err.message 
        });
      }
    }
    
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai/analyze/:date/:matchId - 生成单场比赛AI分析
 */
router.post('/analyze/:date/:matchId', async (req, res) => {
  try {
    const { date, matchId } = req.params;
    const selected = dbService.readSelectedMatches(date) || [];
    const match = selected.find(m => m.matchId === matchId);
    
    if (!match) {
      return res.status(404).json({ success: false, error: '未找到该比赛' });
    }
    
    const analysis = await aiService.generateMatchAnalysis(match);
    
    // 违禁词过滤
    const { filtered, found } = filterBannedWords(analysis.content);
    analysis.content = filtered;
    analysis.bannedWordsFound = found;
    
    dbService.saveAnalysis(date, matchId, analysis);
    
    res.json({ success: true, data: analysis });
  } catch (error) {
    console.error('AI分析失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ai/analyses/:date - 获取指定日期所有AI分析
 */
router.get('/analyses/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const analyses = dbService.readAnalyses(date);
    res.json({ success: true, data: analyses });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/ai/analyses/:date/:matchId - 更新AI分析内容
 */
router.put('/analyses/:date/:matchId', async (req, res) => {
  try {
    const { date, matchId } = req.params;
    const { content } = req.body;
    
    const analysis = { content, updatedAt: new Date().toISOString() };
    dbService.saveAnalysis(date, matchId, analysis);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

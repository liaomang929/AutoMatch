const express = require('express');
const router = express.Router();
const dbService = require('../services/dbStorage');

/**
 * GET /api/history - 获取历史记录（分页+日期筛选）
 * 查询参数: startDate, endDate, page, pageSize
 */
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, page = 1, pageSize = 10 } = req.query;
    const result = await dbService.getHistoryRecords({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/history/actual-result - 更新实际比赛结果
 */
router.put('/actual-result', async (req, res) => {
  try {
    const { date, matchId, actualResult } = req.body;
    if (!date || !matchId || !actualResult) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    
    const updated = await dbService.updateActualResult(date, matchId, actualResult);
    if (!updated) {
      return res.status(404).json({ success: false, error: '未找到该比赛' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

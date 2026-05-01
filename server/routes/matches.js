const express = require('express');
const router = express.Router();
const dbService = require('../services/dbStorage');

/**
 * GET /api/matches/dates - 获取所有有数据的日期
 */
router.get('/dates', async (req, res) => {
  try {
    const dates = await dbService.getAvailableDates();
    res.json({ success: true, data: dates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/matches/:date - 获取指定日期的比赛数据
 */
router.get('/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const raw = await dbService.readRawMatches(date);
    const selected = await dbService.readSelectedMatches(date);
    res.json({ 
      success: true, 
      data: { 
        raw: raw || [], 
        selected: selected || [] 
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/matches/:date/select - 保存选中的重点比赛
 */
router.put('/:date/select', async (req, res) => {
  try {
    const { date } = req.params;
    const { selectedMatches } = req.body;
    await dbService.saveSelectedMatches(date, selectedMatches);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/matches/:date/predict/:matchId - 保存单场比赛预测
 */
router.put('/:date/predict/:matchId', async (req, res) => {
  try {
    const { date, matchId } = req.params;
    const prediction = req.body;
    
    let selected = await dbService.readSelectedMatches(date) || [];
    const idx = selected.findIndex(m => m.matchId === matchId);
    if (idx >= 0) {
      selected[idx] = { ...selected[idx], ...prediction };
    } else {
      selected.push({ matchId, ...prediction });
    }
    
    await dbService.saveSelectedMatches(date, selected);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

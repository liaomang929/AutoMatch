const express = require('express');
const router = express.Router();
const { scrapeMatches } = require('../services/scraper');

/**
 * POST /api/scrape - 触发抓取500彩票网数据
 */
router.post('/', async (req, res) => {
  try {
    const matches = await scrapeMatches();
    res.json({ 
      success: true, 
      count: matches.length, 
      data: matches 
    });
  } catch (error) {
    console.error('抓取失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const { authMiddleware } = require('./auth');

/**
 * GET /api/config/ai - 获取AI模型配置
 */
router.get('/ai', authMiddleware, async (req, res) => {
  try {
    const config = await aiService.getConfig(req.user.id);
    // 返回配置但隐藏部分API Key
    const masked = JSON.parse(JSON.stringify(config));
    for (const key of ['zhipu', 'openai_compatible', 'custom']) {
      if (masked[key]?.apiKey && masked[key].apiKey.length > 8) {
        const ak = masked[key].apiKey;
        masked[key].apiKey = ak.substring(0, 4) + '****' + ak.substring(ak.length - 4);
      }
    }
    res.json({ success: true, data: masked });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/config/ai - 保存AI模型配置
 */
router.put('/ai', authMiddleware, async (req, res) => {
  try {
    const newConfig = req.body;
    
    // 合并：如果apiKey包含****，说明用户没改，保留原值
    const currentConfig = await aiService.getConfig(req.user.id);
    for (const key of ['zhipu', 'openai_compatible', 'custom']) {
      if (newConfig[key]?.apiKey?.includes('****') && currentConfig[key]?.apiKey) {
        newConfig[key].apiKey = currentConfig[key].apiKey;
      }
    }
    
    await aiService.saveConfig(newConfig, req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/config/ai/test - 测试AI连接
 */
router.post('/ai/test', authMiddleware, async (req, res) => {
  try {
    const content = await aiService.callLLM(
      '你是一个测试助手。',
      '请回复"连接成功"四个字。',
      { temperature: 0, maxTokens: 20, userId: req.user.id }
    );
    res.json({ success: true, data: { message: content } });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

/**
 * GET /api/config/ai/status - 获取AI配置状态
 */
router.get('/ai/status', authMiddleware, async (req, res) => {
  try {
    const active = await aiService.getActiveConfig(req.user.id);
    const configured = !!active.apiKey && active.apiKey.length > 0;
    res.json({ 
      success: true, 
      data: { 
        configured,
        provider: active.provider,
        model: active.model || '未配置'
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

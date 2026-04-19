const { ZhipuAI } = require('zhipuai-sdk-nodejs-v4');
const fs = require('fs');
const path = require('path');

// dbStorage 模块（配置存PG）
const dbStorage = require('./fileStorage');

// 默认配置
const DEFAULT_CONFIG = {
  provider: 'zhipu',       // zhipu | openai_compatible | custom
  zhipu: {
    apiKey: '',
    model: 'glm-4',
  },
  openai_compatible: {
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4',
  },
  custom: {
    apiKey: '',
    baseUrl: '',
    model: '',
  },
};

/**
 * 读取AI配置（从数据库）
 */
async function getConfig() {
  return await dbStorage.getConfig();
}

/**
 * 保存AI配置（到数据库）
 */
async function saveConfig(config) {
  await dbStorage.saveConfig(config);
}

/**
 * 获取当前生效的配置（API Key和模型信息）
 */
async function getActiveConfig() {
  return await dbStorage.getActiveConfig();
}

/**
 * 调用大模型 - 统一接口
 */
async function callLLM(systemPrompt, userPrompt, options = {}) {
  try {
    console.log(`🤖 开始调用大模型，systemPrompt长度: ${systemPrompt.length}, userPrompt长度: ${userPrompt.length}`);

    const { provider, apiKey, baseUrl, model } = await getActiveConfig();
    console.log(`🔧 使用配置: provider=${provider}, model=${model}, apiKey长度=${apiKey ? apiKey.length : 0}`);

    if (!apiKey || apiKey.trim().length === 0) {
      console.error('❌ API Key未配置');
      throw new Error('请先在"模型配置"中配置API Key');
    }

    const temperature = options.temperature || 0.7;
    const maxTokens = options.maxTokens || 500;

    console.log(`🔧 调用参数: temperature=${temperature}, maxTokens=${maxTokens}`);

    let result;
    switch (provider) {
      case 'zhipu':
        console.log('🔧 调用智谱AI');
        result = await callZhipu(apiKey, model, systemPrompt, userPrompt, temperature, maxTokens);
        break;
      case 'openai_compatible':
      case 'custom':
        console.log(`🔧 调用OpenAI兼容接口: ${baseUrl}`);
        result = await callOpenAICompatible(apiKey, baseUrl, model, systemPrompt, userPrompt, temperature, maxTokens);
        break;
      default:
        console.error(`❌ 不支持的模型提供商: ${provider}`);
        throw new Error(`不支持的模型提供商: ${provider}`);
    }

    console.log(`✅ 大模型调用成功，返回长度: ${result ? result.length : 0}`);
    return result;
  } catch (error) {
    console.error('❌ callLLM调用失败:', error.message);
    console.error('❌ 错误堆栈:', error.stack);

    // 重新抛出错误，让上层处理
    throw error;
  }
}

/**
 * 调用智谱AI
 */
async function callZhipu(apiKey, model, systemPrompt, userPrompt, temperature, maxTokens) {
  try {
    console.log(`🔧 调用智谱AI: model=${model || 'glm-4'}, tokens=${maxTokens}`);

    // 验证API Key格式
    if (!apiKey || apiKey.trim().length < 10) {
      throw new Error('无效的API Key格式');
    }

    // 检查API Key格式：智谱API Key通常是 32位key + 点 + 随机字符串
    if (!apiKey.includes('.')) {
      console.warn('⚠️  API Key格式异常，可能不是标准的智谱API Key');
    }

    const client = new ZhipuAI({ apiKey });

    // 设置超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await client.completions.create({
        model: model || 'glm-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature,
        max_tokens: maxTokens
      });

      clearTimeout(timeoutId);

      if (!response || !response.choices || !response.choices[0]) {
        console.error('❌ 智谱API响应格式异常:', JSON.stringify(response).substring(0, 200));
        throw new Error('智谱API返回了异常响应格式');
      }

      return response.choices[0].message.content;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('❌ 智谱AI调用失败:', error.message);

    // 提供更友好的错误信息
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      throw new Error('智谱API请求超时，请检查网络连接');
    }

    if (error.message.includes('Invalid API Key') || error.message.includes('认证失败')) {
      throw new Error('API Key无效，请检查是否正确');
    }

    if (error.message.includes('余额不足') || error.message.includes('quota')) {
      throw new Error('API Key余额不足，请充值');
    }

    // 原始错误信息
    throw new Error(`智谱AI调用失败: ${error.message}`);
  }
}

/**
 * 调用OpenAI兼容接口（支持各类兼容API：DeepSeek、通义千问、Moonshot等）
 */
async function callOpenAICompatible(apiKey, baseUrl, model, systemPrompt, userPrompt, temperature, maxTokens) {
  try {
    console.log(`🔧 调用OpenAI兼容接口: ${baseUrl}, model=${model || 'gpt-4'}`);

    // 验证参数
    if (!apiKey || apiKey.trim().length < 5) {
      throw new Error('无效的API Key格式');
    }
    if (!baseUrl || !baseUrl.startsWith('http')) {
      throw new Error('Base URL必须以http或https开头');
    }

    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    console.log(`🔧 请求URL: ${url}`);

    // 设置超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'AutoMatch/1.0'
        },
        body: JSON.stringify({
          model: model || 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature,
          max_tokens: maxTokens,
          stream: false
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();

      if (!response.ok) {
        console.error(`❌ OpenAI兼容接口失败 (${response.status}):`, responseText.substring(0, 300));

        let errorMsg = `API调用失败 (${response.status})`;
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.error?.message) {
            errorMsg = errorData.error.message;
          } else if (errorData.message) {
            errorMsg = errorData.message;
          }
        } catch (e) {
          // 不是JSON响应
          if (responseText.includes('rate limit')) {
            errorMsg = 'API调用频率限制，请稍后重试';
          } else if (responseText.includes('invalid api key')) {
            errorMsg = 'API Key无效或已过期';
          }
        }
        throw new Error(errorMsg);
      }

      const data = JSON.parse(responseText);

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('❌ OpenAI兼容接口响应格式异常:', responseText.substring(0, 300));
        throw new Error('API返回了异常响应格式');
      }

      return data.choices[0].message.content;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('❌ OpenAI兼容接口调用失败:', error.message);

    // 提供更友好的错误信息
    if (error.name === 'AbortError' || error.message.includes('timeout') || error.message.includes('abort')) {
      throw new Error('API请求超时，请检查网络连接和Base URL');
    }

    if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
      throw new Error('网络连接失败，请检查Base URL和网络设置');
    }

    if (error.message.includes('Unexpected token') || error.message.includes('JSON')) {
      throw new Error('API返回了非JSON响应，请检查Base URL是否正确');
    }

    // 原始错误信息
    throw new Error(`OpenAI兼容接口调用失败: ${error.message}`);
  }
}

// ===== 业务方法 =====

/**
 * 生成单场比赛分析文案
 */
async function generateMatchAnalysis(matchData) {
  const prompt = `你是一位资深足球赛事分析师，请根据以下信息撰写一段约200字的赛事分析：

比赛：${matchData.homeTeam} vs ${matchData.awayTeam}
赛事：${matchData.league || '未知赛事'}
比赛时间：${matchData.matchTime || '待定'}
初盘数据指标：胜${matchData.oddsWin || '未知'} 平${matchData.oddsDraw || '未知'} 负${matchData.oddsLoss || '未知'}
让步：${matchData.handicapLine || '未知'}，胜${matchData.handicapWin || '未知'} 平${matchData.handicapDraw || '未知'} 负${matchData.handicapLoss || '未知'}
分析师预测：${matchData.prediction || '待定'}
信心指数：${matchData.confidence || 3}星
分析师笔记：${matchData.analysisNote || '无'}

要求：
1. 从数据指标和让步数据角度切入分析
2. 逻辑要闭环，结论要明确
3. 语言专业但不晦涩，展现深度洞察力
4. 字数控制在200字左右
5. 不要使用"盘口水位"、"庄家"、"赌博"、"博彩"、"下注"、"投注"等违禁词
6. 用"数据走势"替代"盘口"，用"数据指标"替代"赔率"，用"让步"替代"让球盘口"
7. 文案要有说服力，让人感受到分析师的专业水准`;

  const content = await callLLM(
    '你是一位专业的足球赛事分析师，擅长通过数据分析比赛走势，语言精炼有力，逻辑严密。',
    prompt,
    { temperature: 0.7, maxTokens: 500 }
  );

  return {
    matchId: matchData.matchId,
    homeTeam: matchData.homeTeam,
    awayTeam: matchData.awayTeam,
    prediction: matchData.prediction,
    content,
    createdAt: new Date().toISOString()
  };
}

/**
 * 生成公众号推文
 */
async function generateWechatArticle(hotMatch, otherMatch) {
  const prompt = `# 公众号帖子专用提示词

## 角色设定
你是一位拥有15年经验的资深足球比赛分析师，擅长从数据动态变化中洞察比赛走向，文笔富有感染力，擅长用比喻和意象表达专业观点。

## 比赛信息
今日最热门比赛：${hotMatch.homeTeam} vs ${hotMatch.awayTeam}
赛事：${hotMatch.league || '未知赛事'}
比赛时间：${hotMatch.matchTime || '待定'}
数据指标（胜/平/负）：${hotMatch.oddsWin || '未知'}/${hotMatch.oddsDraw || '未知'}/${hotMatch.oddsLoss || '未知'}
让步：${hotMatch.handicapLine || '未知'}
分析师预测：${hotMatch.prediction}
信心指数：${hotMatch.confidence}星
分析师笔记：${hotMatch.analysisNote || '无'}
AI分析摘要：${hotMatch.aiAnalysis || '无'}

另一场关注比赛：${otherMatch.homeTeam} vs ${otherMatch.awayTeam}
赛事：${otherMatch.league || '未知赛事'}
分析师预测：${otherMatch.prediction}

## 核心规则（必须严格遵守）
1. 完全规避敏感词
文中不得出现以下任何博彩相关术语：
盘口、水位、亚盘、欧赔
半球、平半、球半、让球
诱盘、筹码、上车、梭哈
走水、输半、赢半、打穿
升盘、降盘、退盘、高水、低水
凯利指数、赔付率
主胜暗降、负赔拉升等赔率变动描述

2. 合规替代词汇表
违禁词 → 替代表达
盘口/水位 → 赛前风向、预期优势、支持力度、数字语言
半球/平半 → 半个身位、半步优势、小幅领先预期
升盘/降盘 → 预期上调、预期回落、优势扩大/缩小
高水/低水 → 回报偏高、回报保守、甜头大/小
诱盘 → 甜蜜陷阱、心理博弈、情绪引导
走水 → 空手而归、不赚不亏、握手言和
打穿 → 兑现预期、打出优势
凯利指数 → 风险系数、赔付压力
主胜暗降 → 主队数字悄悄走低、数据在倾斜

## 文采要求
1. 必须运用至少两处比喻或意象
2. 语言有画面感和文学质感
3. 读起来像体育随笔，而非技术分析或投注指南
4. 结尾必须有金句

## 平台适配
1. 适合微信公众号发布
2. 标题要有吸引力但不标题党
3. 正文分段清晰，每段3-5行
4. 避免诱导分享、诱导点击的表述
5. 必须包含风险提示：强调"足球是圆的""享受比赛"

## 字数要求
正文：500-800字
标题：15-25字

## 输出格式
【标题】（15-25字）

【正文】
（分段呈现，每段3-5行）

【最后一句】
（金句收尾）

【风险提示】
足球是圆的，分析仅供参考。享受比赛，理性热爱。

## 分析重点
请围绕最热门比赛（${hotMatch.homeTeam} vs ${hotMatch.awayTeam}）展开分析：

1. 从数据动态变化切入：分析数据指标的变动趋势（如主队数字悄悄走低、风险系数变化等）
2. 运用合规词汇：使用"赛前风向"、"预期优势"、"数字语言"等替代表述
3. 结合球队基本面：考虑近期战绩、状态、伤病、历史交锋
4. 揭示内在逻辑：数据变化背后的市场情绪和潜在意图
5. 融入比喻意象：如"伯纳乌的星光"、"甜蜜陷阱"、"飞蛾扑火"等

## 示例参考
标题：伯纳乌的星光，今晚照向谁家？

兄弟们，今晚聊聊皇马vs拜仁。

先说结论：皇马主场不败，最可能2-1。

第一，赛前风向的转变藏着杀机。
一开始，拜仁被捧得很高，看起来客场要轻松拿下。德甲霸主的招牌挂在伯纳乌上空，闪得人眼晕。
但临近比赛，那个"赢球优势"的预期从"大胜"缩回了"小胜"——姿态软了，回报却甜得发腻。
如果真看好拜仁客场赢球，应该把优势守住、把回报压住。现在又是缩小优势又是给高回报，摆明了是在钓鱼。六成五的目光被高回报吸引涌向客队，像飞蛾扑向火焰。

第二，热度是毒药，数据在说话。
超过六成五的资金被"拜仁占优"和"高回报"吸引，疯狂涌向客队。
但机构一边笑着收筹码，一边偷偷把主队取胜的数字往下调，平局的数字却被拉得高高的。这是在分散大家对平局的注意，为主队悄悄铺路。
客队取胜方向的风险系数已经亮红灯，而主队那边，机构却在暗暗压低回报。

第三，比分藏着剧本。
2-1，这是效率最高的结局。
皇马主场赢球，兑现那个"小胜"的预期。让那些追拜仁的人输一半，追平局的人空手而归，追客胜的人全输。一刀下去，三种方向一起收拾。

第四，伯纳乌的夜晚，从不缺奇迹。
皇马的欧冠基因不是摆设，主场气势加上机构暗中的保护，这场我更相信白色的一方。
当然，足球没有绝对——如果拜仁开场闪击，如果皇马门将送礼，故事就变了。但概率上，今晚我更相信那道在暗处悄悄点亮的星光。

回报越甜，脚下的坑越深。别被招牌晃了眼，要顺着资金的暗流走。

足球是圆的，分析仅供参考。享受比赛，理性热爱。

## 你的任务
基于以上要求、示例和比赛信息，创作一篇符合微信公众号发布标准的足球赛事分析推文。`;

  const content = await callLLM(
    '你是一位拥有15年经验的资深足球比赛分析师，擅长从数据动态变化中洞察比赛走向，文笔富有感染力，擅长用比喻和意象表达专业观点。',
    prompt,
    { temperature: 0.8, maxTokens: 2000 }
  );

  return {
    hotMatch: `${hotMatch.homeTeam} vs ${hotMatch.awayTeam}`,
    content,
    createdAt: new Date().toISOString()
  };
}

/**
 * 生成直播文案（三场比赛版 - 每场200-300字，毒舌导演分析师风格）
 */
async function generateLiveScript(hotMatches) {
  const matchesInfo = hotMatches.map((m, idx) =>
    `第${idx + 1}场：${m.homeTeam} vs ${m.awayTeam}（${m.league || '未知赛事'}）
    数据指标（胜/平/负）：${m.oddsWin || '未知'}/${m.oddsDraw || '未知'}/${m.oddsLoss || '未知'}
    剧情要求（让步）：${m.handicapLine || '未知'}
    分析师预测：${m.prediction}
    信心指数：${m.confidence}星
    分析师笔记：${m.analysisNote || '无'}`
  ).join('\n\n');

  const prompt = `你是一位拥有15年经验的"毒舌赛事导演分析师"。你的任务是按照以下样例风格，为每场足球比赛撰写200-300字的直播脚本。

【样例参考】
多特蒙德 vs 勒沃库森（德甲）
今晚的德甲，我要先说一句——导演组把"坑"挖好了，就等热血观众往下跳。
大家看，主角多特名气够大吧？主场气势也够猛。但你们注意了，导演组给的"开启设定"智力非常低，还配了一个相当可爱的"高热度加成"。
这个"低陷阱＋高热度"的组合，在我们圈子里有一个名字，叫**"甜蜜陷阱"**。
导演组就是要让你觉得主角稳定了，顺手还能多赚一点。但我告诉你真相：配角勒沃库森今晚是拿逆袭脚本。
我的判断：今晚多特不仅赢不下来，甚至可能被逼出一场平局。看懂这套"逆向收割"逻辑的朋友，点个关注，我们一起把这出戏看到底。

【你需要分析的3场比赛】
${matchesInfo}

【核心暗语对照（必须使用）】
赔率/水位 → 热度/温度
让球/盘口 → 设定/剧情要求
下注/博彩 → 跟剧/押注
收割/杀红 → 摘果子/收场
强队/弱队 → 主角/配角

【文案结构要求】
1. 开场白：简短介绍今晚三场比赛，用"导演组设局"钩子留住观众（50-80字）
2. 三场比赛独立分析：每场200-300字，严格按以下结构：
   - 标题：{主队} vs {客队}（{赛事}）
   - 第一句：直接点名"导演组挖坑"或"设局"
   - 分析主角：名气、主场、优势
   - 分析导演组给的"设定"（让球）和"热度"（赔率）是否匹配
   - 判断是否存在"甜蜜陷阱"或"虚火过旺"
   - 揭示导演组意图：让观众觉得主角稳定，实际是套路
   - 明确判断：配角拿什么脚本，主角会怎样
   - 每场结尾：点题"逆向收割"逻辑
3. 结尾呼吁：引导点赞关注，一起看透导演组的戏

【输出格式】
你需要生成一个大的text文本，内容结构化展示，采用"总分总"结构。整个文案必须是一个连贯的text文本，但结构清晰，各部分用明确的标签分隔。

请按照以下完整格式输出，不要有任何额外的说明文字：

【开场白】
（50-80字开场内容，直接写分析文字）

【第一场比赛分析】
（200-300字分析内容，严格按样例风格，分析内容要连贯完整）

【第二场比赛分析】
（200-300字分析内容，严格按样例风格，分析内容要连贯完整）

【第三场比赛分析】
（200-300字分析内容，严格按样例风格，分析内容要连贯完整）

【结尾呼吁】
（50-80字结尾内容，直接写总结文字）

【重要格式要求】
1. 严格按照以上格式输出，包含【开场白】、【第一场比赛分析】、【第二场比赛分析】、【第三场比赛分析】、【结尾呼吁】这五个部分
2. 每个部分的标签（如【开场白】）必须保留，作为结构标识
3. 每个标签后直接跟内容，不要换行后再开始内容
4. 不同部分之间必须有换行（空一行）
5. 整个文案是一个大的text文本，但结构清晰可见
6. 内容要连贯完整，符合直播提词器的阅读习惯

【关键要求】
1. 语气：笃定、毒舌、揭秘感，每句话像匕首一样精准
2. 句式：多用短句，每句不超过15字，适合直播提词器
3. 风格：像资深导演分析师揭穿行业黑幕，让观众觉得"原来如此"
4. 严禁违禁词：必须使用暗语，绝不出现"赔率"、"让球"、"下注"等敏感词
5. 每场必须分析：主角优势、设定与热度匹配度、是否存在甜蜜陷阱、导演组意图、明确判断
6. 必须使用词汇：导演组、主角、配角、设定、热度、甜蜜陷阱、逆袭脚本、逆向收割
7. 字数严格控制：开场白50-80字，每场比赛分析200-300字，结尾50-80字。我会严格检查字数，不足或超出都会要求重写！

【字数检查方法】
- 每场比赛分析必须达到200-300字（中文汉字）
- 你可以这样估算：样例参考部分约150字，你需要写得更详细
- 每场比赛分析应该包含：球队介绍、设定分析、热度分析、陷阱判断、导演意图、最终判断
- 确保内容充实，不要过于简短

【特别提示】
- 分析师预测仅供参考，你要结合数据指标和剧情要求做出独立判断
- 信心指数越高，你的分析应该越笃定
- 分析师笔记是线索，但不是结论，你要用导演视角解读
- **重要**：严格按照样例的详细程度和字数要求写作，不要写得太简短！`;

  const content = await callLLM(
    '你是一位毒舌、犀利的足球赛事导演分析师，拥有15年经验。你善于用电影导演的视角解读比赛，语言简短有力，每句话像匕首一样精准。你的风格是：笃定、毒舌、揭秘感，善于制造悬念，让观众欲罢不能。你特别注重文章结构，擅长使用"总分总"格式，能够将直播文案内容结构化展示在一个大的text文本里面，结构清晰，段落分明。',
    prompt,
    { temperature: 0.8, maxTokens: 1500 }
  );

  return {
    matches: hotMatches.map(m => `${m.homeTeam} vs ${m.awayTeam}`),
    content,
    createdAt: new Date().toISOString()
  };
}

module.exports = {
  generateMatchAnalysis,
  generateWechatArticle,
  generateLiveScript,
  getConfig,
  saveConfig,
  getActiveConfig,
  callLLM,
};

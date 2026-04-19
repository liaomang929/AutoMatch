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
  const { provider, apiKey, baseUrl, model } = await getActiveConfig();

  if (!apiKey) {
    throw new Error('请先在"模型配置"中配置API Key');
  }

  const temperature = options.temperature || 0.7;
  const maxTokens = options.maxTokens || 500;

  switch (provider) {
    case 'zhipu':
      return callZhipu(apiKey, model, systemPrompt, userPrompt, temperature, maxTokens);
    case 'openai_compatible':
    case 'custom':
      return callOpenAICompatible(apiKey, baseUrl, model, systemPrompt, userPrompt, temperature, maxTokens);
    default:
      throw new Error(`不支持的模型提供商: ${provider}`);
  }
}

/**
 * 调用智谱AI
 */
async function callZhipu(apiKey, model, systemPrompt, userPrompt, temperature, maxTokens) {
  const client = new ZhipuAI({ apiKey });
  const response = await client.completions.create({
    model: model || 'glm-4',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature,
    max_tokens: maxTokens
  });
  return response.choices[0].message.content;
}

/**
 * 调用OpenAI兼容接口（支持各类兼容API：DeepSeek、通义千问、Moonshot等）
 */
async function callOpenAICompatible(apiKey, baseUrl, model, systemPrompt, userPrompt, temperature, maxTokens) {
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API调用失败 (${response.status}): ${errText.substring(0, 200)}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
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
  const prompt = `你是一位资深足球分析师，现在需要撰写一篇微信公众号推文，吸引新粉丝关注。

今日最热门比赛：${hotMatch.homeTeam} vs ${hotMatch.awayTeam}
赛事：${hotMatch.league || '未知赛事'}
比赛时间：${hotMatch.matchTime || '待定'}
分析师预测：${hotMatch.prediction}
信心指数：${hotMatch.confidence}星
分析师分析：${hotMatch.analysisNote || '无'}
AI分析摘要：${hotMatch.aiAnalysis || '无'}

另一场热门比赛：${otherMatch.homeTeam} vs ${otherMatch.awayTeam}
赛事：${otherMatch.league || '未知赛事'}
分析师预测：${otherMatch.prediction}

推文要求：
1. 结构清晰，分段落，每段有小标题
2. 标题要吸引眼球，让人忍不住点进来（不要用标题党）
3. 开头制造悬念或抛出犀利观点
4. 重点分析最热门的那场比赛，从球队基本面（近期战绩、状态、伤病、历史交锋）入手
5. 用数据分析的视角解读比赛走势（注意用词）
6. 逻辑层层递进，最终推导出明确结论
7. 结尾要有号召力，吸引读者关注
8. 展现出专业、高深、洞察力的分析师形象
9. 语言流畅有文采，避免俗套和模板化表达
10. 全文约800-1200字

输出格式：
# [标题]

## 引言
[内容]

## 核心赛事分析
### 赛事背景
[内容]

### 球队基本面
[内容]

### 数据走势解读
[内容]

### 预期结果
[内容]

## 其他关注
[内容]

## 结语
[内容]

绝对禁止使用的词汇（违禁词）：
- 盘口水位、盘口、水位 → 用"数据走势"、"数据变化"
- 庄家、庄 → 删除相关表述
- 赌博、赌 → 删除相关表述
- 博彩 → 删除相关表述
- 投注、下注 → 用"关注方向"
- 赔率 → 用"数据指标"
- 赢盘 → 用"数据占优"
- 走水 → 用"数据持平"
- 上盘/下盘 → 用"优势方/弱势方"
- 让球盘 → 用"让步数据"
- 大小球 → 用"进球数预期"
- 串关 → 用"组合关注"`;

  const content = await callLLM(
    '你是一位文笔出众的资深足球分析师，擅长写出让人拍案叫绝的赛事分析文章。你的文字既有数据支撑，又有独到见解，逻辑严密又不失文采。',
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
## 开场白
[50-80字开场]

## {主队1} vs {客队1}（{赛事1}）
[200-300字分析，严格按样例风格，分析内容要紧跟标题，不要有额外换行，直接写分析文字]

## {主队2} vs {客队2}（{赛事2}）
[200-300字分析，严格按样例风格，分析内容要紧跟标题，不要有额外换行，直接写分析文字]

## {主队3} vs {客队3}（{赛事3}）
[200-300字分析，严格按样例风格，分析内容要紧跟标题，不要有额外换行，直接写分析文字]

## 结尾呼吁
[50-80字结尾]

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
    '你是一位毒舌、犀利的足球赛事导演分析师，拥有15年经验。你善于用电影导演的视角解读比赛，语言简短有力，每句话像匕首一样精准。你的风格是：笃定、毒舌、揭秘感，善于制造悬念，让观众欲罢不能。',
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

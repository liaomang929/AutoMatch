/**
 * 违禁词过滤模块
 * 用于微信公众号和视频号直播文案的合规化处理
 */

// 违禁词 -> 替换词 映射
const BANNED_WORDS_MAP = {
  '盘口水位': '数据走势',
  '盘口': '数据走势',
  '水位': '数据变化',
  '庄家': '',
  '庄': '',
  '赌博': '',
  '赌': '',
  '博彩': '',
  '投注': '关注',
  '下注': '关注方向',
  '赔率': '数据指标',
  '赢盘': '数据占优',
  '走水': '数据持平',
  '上盘': '优势方',
  '下盘': '弱势方',
  '临场盘': '临近开场数据',
  '亚盘': '亚洲数据',
  '欧赔': '欧洲数据',
  '大小球': '进球数预期',
  '串关': '组合关注',
  '让球盘': '让步数据',
  '让球': '让步',
  '买球': '关注比赛',
  '卖球': '',
  '操盘': '数据运作',
  '诱盘': '数据诱导',
  '开盘': '数据发布',
  '收盘': '数据收盘',
  '升盘': '数据上调',
  '降盘': '数据下调',
  '升水': '数值上调',
  '降水': '数值下调',
  '高水': '高数值',
  '低水': '低数值',
  '中水': '中数值',
  '走地': '进行中',
  '滚球': '进行中',
  '半全场': '半场全场',
  '竞彩': '赛事分析',
  '足彩': '赛事分析',
  '彩票': '赛事',
  '中奖': '分析正确',
  '盈利': '收获',
  '亏损': '失利',
  '返奖': '回报',
  '出票': '确认方向',
  '打票': '确认方向',
  '倍投': '增加关注',
  '翻倍': '加倍关注',
  '黑单': '未中',
  '红单': '分析正确',
  '连红': '连续正确',
  '上岸': '扭亏为盈',
  '天台': '',
  '梭哈': '',
};

/**
 * 过滤文本中的违禁词
 * @param {string} text - 原始文本
 * @returns {{ filtered: string, found: string[] }} - 过滤后文本和发现的违禁词
 */
function filterBannedWords(text) {
  if (!text) return { filtered: '', found: [] };
  
  let filtered = text;
  const found = [];
  
  // 按词长降序排列，优先匹配长词
  const sortedWords = Object.keys(BANNED_WORDS_MAP).sort((a, b) => b.length - a.length);
  
  for (const banned of sortedWords) {
    if (filtered.includes(banned)) {
      found.push(banned);
      const replacement = BANNED_WORDS_MAP[banned];
      if (replacement) {
        filtered = filtered.split(banned).join(replacement);
      } else {
        // 如果没有替换词，删除违禁词及前后可能的相关字
        filtered = filtered.split(banned).join('');
      }
    }
  }
  
  // 清理多余空格和标点
  filtered = filtered.replace(/\s{2,}/g, ' ').replace(/[，。]{2,}/g, m => m[0]).trim();
  
  return { filtered, found };
}

/**
 * 检查文本中是否包含违禁词
 */
function checkBannedWords(text) {
  if (!text) return { hasBanned: false, found: [] };
  const found = [];
  const sortedWords = Object.keys(BANNED_WORDS_MAP).sort((a, b) => b.length - a.length);
  for (const banned of sortedWords) {
    if (text.includes(banned)) {
      found.push(banned);
    }
  }
  return { hasBanned: found.length > 0, found };
}

module.exports = { filterBannedWords, checkBannedWords, BANNED_WORDS_MAP };

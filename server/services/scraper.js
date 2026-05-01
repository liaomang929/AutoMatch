const path = require('path');
const puppeteer = require('puppeteer-core');
const dbService = require('./dbStorage');

const TARGET_URL = 'https://trade.500.com/jczq/index.php?playid=312&g=2';

/**
 * 获取Chrome可执行路径
 */
function getChromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const fs = require('fs');
  if (process.platform === 'linux') {
    const paths = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  }
  if (process.platform === 'win32') {
    const candidates = [
      path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  }
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  // 兜底：让 puppeteer 自己报错
  return '';
}

/**
 * 从500彩票网抓取竞彩足球比赛数据
 * 
 * 页面结构说明（table.bet-tb.bet-tb-dg）：
 * - 每行比赛 <tr> 的 data 属性包含关键信息
 * - 列顺序：编号(td-no) → 赛事(td-evt) → 开赛时间(td-endtime) → 主队/客队(td-team) → 让球(td-rang) → 胜平负(td-betbtn) → 更多(td-more) → 数据(td-data) → 百家平均(td-pei)
 * - 胜平负区域(td-betbtn)包含两行：
 *   - 第一行 .itm-rangB1：非让球胜平负，data-type="nspf"
 *   - 第二行 .itm-rangB2：让球胜平负，data-type="spf"
 * - 每个 p.betbtn 的 data-value 含义：3=胜, 1=平, 0=负
 * - 赔率值在 data-sp 属性中
 */
async function scrapeMatches() {
  // 在Vercel环境中直接返回错误，因为puppeteer无法正常工作
  if (process.env.VERCEL) {
    const error = new Error('抓取功能在Vercel Serverless环境中不可用。puppeteer需要Chrome浏览器环境，建议在本地运行此功能。');
    error.code = 'VERCEL_UNSUPPORTED';
    throw error;
  }

  let browser = null;
  try {
    console.log('🌐 启动浏览器抓取500彩票网数据...');

    const launchOptions = {
      executablePath: getChromePath(),
      headless: 'new',
      args: []
    };

    // 根据不同环境调整启动参数
    if (process.env.VERCEL) {
      // Vercel serverless环境需要特殊配置
      console.log('🔄 在Vercel环境中使用特殊配置');
      launchOptions.args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote'
      ];
    } else {
      // 本地环境配置
      launchOptions.args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=NetworkService',
        '--proxy-server="direct://"',
        '--proxy-bypass-list=*'
      ];
    }

    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1440, height: 900 });

    console.log('📡 正在访问页面...');
    await page.goto(TARGET_URL, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });

    // 等待比赛数据表格加载
    await page.waitForSelector('table.bet-tb.bet-tb-dg', { timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    console.log('🔍 正在解析页面数据...');

    // 使用精确的data属性和class选择器提取数据
    const matches = await page.evaluate(() => {
      const results = [];
      
      // 数据在第二个 .bet-tb-dg 表格中（第一个是表头）
      const tables = document.querySelectorAll('table.bet-tb.bet-tb-dg');
      const dataTable = tables[1];
      if (!dataTable) return results;
      
      const rows = dataTable.querySelectorAll('tr[data-matchid]');
      
      rows.forEach(row => {
        try {
          // ===== 从 tr 的 data 属性直接提取基本信息 =====
          const matchData = {
            matchId: row.getAttribute('data-matchnum') || '',       // 编号：周四001
            league: row.getAttribute('data-simpleleague') || '',    // 赛事：欧罗巴
            homeTeam: row.getAttribute('data-homesxname') || '',    // 主队：塞尔塔
            awayTeam: row.getAttribute('data-awaysxname') || '',    // 客队：弗赖堡
            matchTime: '',                                          // 开赛时间（需从td提取）
            oddsWin: '',                                            // 非让球胜赔率
            oddsDraw: '',                                           // 非让球平赔率
            oddsLoss: '',                                           // 非让球负赔率
            handicapLine: row.getAttribute('data-rangqiu') || '',  // 让球数：-1
            handicapWin: '',                                        // 让球胜赔率
            handicapDraw: '',                                       // 让球平赔率
            handicapLoss: ''                                        // 让球负赔率
          };

          // ===== 开赛时间：从 td.td-endtime 提取 =====
          const endTimeCell = row.querySelector('td.td-endtime');
          if (endTimeCell) {
            matchData.matchTime = endTimeCell.textContent.trim();
          }

          // ===== 胜平负赔率：从 td.td-betbtn 提取 =====
          // 第一行 .itm-rangB1：非让球（data-type="nspf"）
          const row1 = row.querySelector('.itm-rangB1');
          if (row1) {
            const btns1 = row1.querySelectorAll('p.betbtn');
            btns1.forEach(btn => {
              const val = btn.getAttribute('data-value'); // 3=胜, 1=平, 0=负
              const sp = parseFloat(btn.getAttribute('data-sp'));
              if (val === '3' && !isNaN(sp)) matchData.oddsWin = sp;
              if (val === '1' && !isNaN(sp)) matchData.oddsDraw = sp;
              if (val === '0' && !isNaN(sp)) matchData.oddsLoss = sp;
            });
          }

          // 第二行 .itm-rangB2：让球（data-type="spf"）
          const row2 = row.querySelector('.itm-rangB2');
          if (row2) {
            const btns2 = row2.querySelectorAll('p.betbtn');
            btns2.forEach(btn => {
              const val = btn.getAttribute('data-value'); // 3=胜, 1=平, 0=负
              const sp = parseFloat(btn.getAttribute('data-sp'));
              if (val === '3' && !isNaN(sp)) matchData.handicapWin = sp;
              if (val === '1' && !isNaN(sp)) matchData.handicapDraw = sp;
              if (val === '0' && !isNaN(sp)) matchData.handicapLoss = sp;
            });
          }

          // 如果没有从data属性拿到让球数，尝试从 td.td-rang 提取
          if (!matchData.handicapLine) {
            const rangCell = row.querySelector('td.td-rang');
            if (rangCell) {
              const rangB2 = rangCell.querySelector('.itm-rangA2');
              if (rangB2) {
                matchData.handicapLine = rangB2.textContent.trim();
              }
            }
          }

          // 只添加有效比赛数据
          if (matchData.homeTeam || matchData.awayTeam || matchData.matchId) {
            results.push(matchData);
          }
        } catch (e) {
          // 跳过解析失败的行
        }
      });

      return results;
    });

    // 为每条数据添加序号和时间戳（使用本地日期，与前端DatePicker一致）
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    matches.forEach((m, idx) => {
      if (!m.matchId) m.matchId = `${today}-${String(idx + 1).padStart(3, '0')}`;
      m.scrapedAt = new Date().toISOString();
      m.index = idx + 1;
    });

    console.log(`✅ 成功抓取 ${matches.length} 场比赛数据`);

    // 保存到文件
    await dbService.saveRawMatches(today, matches);

    return matches;
  } catch (error) {
    console.error('❌ 抓取失败:', error.message);

    // 在Vercel环境中提供更友好的错误信息
    if (process.env.VERCEL) {
      const vercelError = new Error(`抓取功能在Vercel环境中受限：${error.message}。建议在本地运行此功能。`);
      vercelError.isVercelError = true;
      throw vercelError;
    }

    throw error;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

module.exports = { scrapeMatches };

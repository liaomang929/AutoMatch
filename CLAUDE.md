# AutoMatch - 足球赛事智能分析工具 项目记忆

> 本文件为项目上下文记忆文件，供AI助手快速拾取项目全貌。最后更新：2026-04-16 (v4)

---

## 1. 项目概述

**产品名称**: AutoMatch - 足球赛事智能分析助手  
**项目路径**: `/Users/liaom/Documents/2026/Qoder/autoMatch`  
**定位**: 面向足球竞彩分析师的本地化工具，集成赛事抓取、智能选场、AI辅助分析、文案生成  
**PRD文档**: 项目根目录 `PRD.md`

---

## 2. 技术栈

| 层级 | 技术 | 版本/说明 |
|------|------|-----------|
| 前端 | React + Vite + Ant Design | Vite v8.0.8, antd v5 |
| 后端 | Node.js + Express | Express v5.2.1 |
| 数据抓取 | puppeteer-core | v24.41.0（用系统Chrome，非内置） |
| AI服务 | 多模型支持 | 智谱GLM-4（默认）/ OpenAI兼容接口 / 自定义接口 |
| AI配置 | ai_config.json | 运行时保存，优先于.env中的ZHIPU_API_KEY |
| 数据存储 | 本地文件系统 | JSON + Markdown格式 |

---

## 3. 项目结构

```
autoMatch/
├── CLAUDE.md                 ← 本文件（项目记忆）
├── PRD.md                    ← 产品需求文档
├── .env                      ← 环境变量（ZHIPU_API_KEY等）
├── .gitignore
├── package.json              ← 后端依赖
├── server/
│   ├── index.js              ← Express入口（端口3001）
│   ├── routes/
│   │   ├── scrape.js         ← POST /api/scrape 抓取触发
│   │   ├── matches.js        ← 比赛数据CRUD
│   │   ├── ai.js             ← AI分析生成/读取
│   │   ├── articles.js       ← 公众号/直播文案生成
│   │   └── config.js         ← AI模型配置API（读取/保存/测试）
│   └── services/
│       ├── scraper.js        ← Puppeteer抓取500彩票网逻辑
│       ├── fileStorage.js    ← 本地文件读写（按日期分类）
│       ├── aiService.js      ← 多模型AI调用封装（智谱/OpenAI兼容/自定义）
│       ├── bannedWords.js    ← 违禁词过滤（50+词库）
│       └── config.js          ← AI模型配置路由（读取/保存/测试连接）
└── client/                   ← Vite + React前端
    ├── vite.config.js        ← 含/api代理到localhost:3001
    ├── package.json
    └── src/
        ├── main.jsx
        ├── index.css
        ├── App.jsx           ← 主布局（Header+Sider+Content）
        ├── api/index.js      ← 前端API调用封装
        └── pages/
            ├── MatchDataPage.jsx    ← 赛事数据表格
            ├── PredictPage.jsx      ← 选场预测录入
            ├── AIAnalysisPage.jsx   ← AI分析展示/编辑
            ├── ArticlePage.jsx      ← 公众号/直播文案生成
            └── ConfigPage.jsx       ← 模型配置（API Key/模型切换/测试连接）
```

---

## 4. 四大功能模块

### 模块1: 赛事数据抓取
- **数据源**: `https://trade.500.com/jczq/index.php?playid=312&g=2`
- **方式**: Puppeteer-core + 系统Chrome（绕过反爬）
- **字段**: 编号、赛事、主客队、比赛时间、胜平负赔率（非让球=第一行）、让球+赔率（让球=第二行）
- **API**: `POST /api/scrape`
- **存储**: `~/Desktop/AutoMatch/{日期}/01_原始数据/matches.json`

### 模块2: 智能选场与预测
- **选场规则**: 5~10场选4场，>10场选6场，<5场全选
- **自动推荐**: 按联赛热度+赔率差异度评分排序
- **预测字段**: prediction(主胜/平/客胜)、confidence(1-5星)、analysisNote、isHot
- **API**: `PUT /api/matches/{date}/select`, `PUT /api/matches/{date}/predict/{matchId}`
- **存储**: `~/Desktop/AutoMatch/{日期}/02_重点比赛/selected.json`

### 模块3: AI辅助分析
- **模型**: 支持多模型切换 — 智谱GLM-4（默认）/ OpenAI兼容接口（DeepSeek/通义千问/Moonshot等）/ 自定义接口
- **配置**: 通过"模型配置"页面在线配置，数据保存在 `ai_config.json`
- **输出**: 每场约200字分析，逻辑闭环，专业但不晦涩
- **违禁词**: 自动过滤"盘口"、"庄家"、"赔率"等（替换为"数据走势"、"数据指标"等）
- **API**: `POST /api/ai/analyze/{date}/{matchId}`, `POST /api/ai/analyze/{date}/batch`
- **配置API**: `GET/PUT /api/config/ai`, `POST /api/config/ai/test`, `GET /api/config/ai/status`
- **存储**: `~/Desktop/AutoMatch/{日期}/03_AI分析/`

### 模块4: 热门文案生成
- **公众号推文**: 选最热1场，约800-1200字，吸引新粉丝，展示专业形象
- **直播文案（三场比赛版）**: 选最热3场，每场200-300字分析，总字数600-900字，毒舌导演分析师风格，严格按样例结构，使用核心暗语对照（赔率→热度/温度、让球→设定/剧情要求等），适合提词器阅读，今晚8:30直播用
- **违禁词**: 双重过滤（AI Prompt内约束 + 后端bannedWords.js替换），直播文案使用独特的"核心暗语对照"
- **API**: `POST /api/articles/wechat/{date}`, `POST /api/articles/live/{date}`
- **存储**: `~/Desktop/AutoMatch/{日期}/04_公众号文案/` 和 `05_直播文案/`

---

## 5. 运行方式

```bash
# 启动后端（端口3001）
cd /Users/liaom/Documents/2026/Qoder/autoMatch
npm run dev

# 启动前端（端口5173，需另开终端）
cd /Users/liaom/Documents/2026/Qoder/autoMatch/client
npm run dev

# 访问
# 前端: http://localhost:5173
# 后端: http://localhost:3001
# API健康检查: http://localhost:3001/api/health
```

---

## 6. 环境配置 (.env)

```env
ZHIPU_API_KEY=your_zhipu_api_key_here   # ← .env中的默认Key，可被ai_config.json覆盖
DATA_DIR=/Users/liaom/Desktop/AutoMatch  # 数据存储目录
CHROME_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
PORT=3001
```

**重要**: AI模型配置现在优先使用 `ai_config.json`（通过"模型配置"页面保存），不再依赖 .env 中的 ZHIPU_API_KEY。如未通过页面配置，AI分析和文案生成功能将不可用。

---

## 7. 已知问题与踩坑记录

### 7.1 antd图标命名（已修复）
- antd icons中没有`Soccer`、`Select`、`Robot`、`FileText`
- **正确写法**: 必须使用`Outlined`后缀 → `TrophyOutlined`、`AimOutlined`、`RobotOutlined`、`FileTextOutlined`
- 错误的图标名会导致React渲染崩溃，页面空白

### 7.2 Puppeteer安装问题（已解决）
- `puppeteer`完整包会下载Chrome，在国内网络环境经常失败
- **解决方案**: 改用`puppeteer-core`，配合系统已安装的Chrome

### 7.3 500彩票网反爬
- 直接fetch会被403拒绝
- **解决方案**: Puppeteer模拟真实浏览器访问，设置User-Agent

### 7.5 Scraper精准重写（已修复）
- 500彩票网页面结构：`table.bet-tb.bet-tb-dg`（index 1为数据表）
- **关键发现**: 每个`<tr>`含丰富data属性，无需解析HTML文本
  - `data-matchnum` = 编号, `data-simpleleague` = 赛事, `data-homesxname` = 主队, `data-awaysxname` = 客队, `data-rangqiu` = 让球数
- **胜平负赔率映射**: 
  - 第一行 `.itm-rangB1` → 非让球 (`data-type="nspf"`, data-value: 3=胜, 1=平, 0=负)
  - 第二行 `.itm-rangB2` → 让球 (`data-type="spf"`, data-value: 3=胜, 1=平, 0=负)
  - 赔率值在 `data-sp` 属性中
- **未开售**: 非让球行可能显示“未开售”（`betbtn-wait`），此时oddsWin/Draw/Loss为空

### 7.6 前端列名对齐（已修复）
- "联赛" → "赛事"（对齐数据源网页"赛事"列）
- "主胜/平局/客胜" → "胜/平/负"
- "让球" → "让步", "让球主胜/让球平/让球客胜" → "让胜/让平/让负"

### 7.7 Express路由匹配顺序问题（已修复）
- Express v5按注册顺序匹配路由，`/analyze/:date/:matchId` 会先于 `/analyze/:date/batch` 匹配
- 导致"batch"被当作matchId，返回"未找到该比赛"
- **解决方案**: 将batch路由注册在:matchId路由之前

### 7.8 selected.json中league字段缺失（已修复）
- 旧scraper抓取的数据league为空，保存到selected.json后不会自动更新
- **解决方案**: 前端加载selected数据时，自动从raw matches补全缺失字段（league、赔率等）
- 同时将"未知联赛"改为"未知赛事"

### 7.9 智谱SDK调用路径错误（已修复）
- 智谱SDK正确调用方式为 `client.completions.create({...})`
- 之前错误使用了OpenAI风格 `client.chat.completions.create({...})`，导致 `Cannot read properties of undefined (reading 'completions')`
- 智谱SDK没有 `chat` 属性

### 7.10 callLLM未导出（已修复）
- `aiService.js` 新增了 `callLLM` 统一调用函数，但忘记在 `module.exports` 中导出
- 导致配置页「测试连接」接口报 `callLLM is not a function`

### 7.11 ConfigPage表单校验问题（已修复）
- antd Form 的 `rules: [{required: true}]` 会校验所有字段，包括隐藏的provider字段
- 切换provider后，隐藏的必填字段校验不通过，导致无法保存
- **解决方案**: 移除所有Form.Item的required规则，改为手动校验当前选中provider的字段

### 7.12 ConfigPage测试连接逻辑（已优化）
- 之前点「测试连接」用的是文件中的旧配置，不是表单中的新值
- **优化**: 测试前先自动保存当前表单配置，再调用测试接口
- 按钮文案改为「保存并测试连接」

### 7.13 ArticlePage/AIAnalysisPage未检查AI配置（已修复）
- AI未配置时，生成按钮仍可点击，报错信息不友好
- **修复**: 两个页面均增加 `aiConfigured` 状态检测，未配置时显示黄色警告+禁用按钮

## 8. 当前状态（2026-04-16）

- [x] PRD文档编写
- [x] 后端全部服务实现（抓取/存储/AI/违禁词/路由）
- [x] 前端5个页面实现（赛事数据/选场预测/AI分析/文案生成/模型配置）
- [x] 图标错误修复
- [x] 后端根路由页面添加
- [x] 服务启动验证通过
- [x] Scraper精准重写（基于实际页面data属性提取，已验证抓取9场数据正确）
- [x] 前端列名对齐（赛事/胜/平/负/让步/让胜/让平/让负）
- [x] Express路由匹配顺序修复（batch路由放在:matchId之前）
- [x] selected.json缺失字段自动补全（从raw matches补全league等）
- [x] AI分析无结果问题修复（API Key未配置→前端展示未配置提示+引导到配置页）
- [x] 多模型支持（智谱GLM-4/OpenAI兼容接口/自定义接口）
- [x] 模型配置页面（在线配置API Key/模型/Base URL/测试连接）
- [x] 智谱SDK调用路径修复（client.completions.create）
- [x] callLLM导出修复
- [x] ConfigPage表单校验修复（移除required规则→手动校验）
- [x] ConfigPage测试连接优化（保存后再测试）
- [x] ArticlePage/AIAnalysisPage AI配置状态检查
- [ ] **待完成**: 用户端到端测试全部流程

---

## 9. 后续优化方向

1. **抓取稳定性**: 500彩票网页面结构可能变化，需要定期维护scraper.js中的CSS选择器
2. **定时任务**: 目前需手动触发抓取，可添加node-cron实现每日定时抓取
3. **数据持久化**: 如数据量增大，可迁移到SQLite
4. **直播文案**: 添加实时互动话术模板
5. **多平台发布**: 支持一键发布到微信公众号API
6. **历史数据**: 添加历史比赛结果回填和命中率统计

---

## 10. 违禁词库摘要

核心替换映射（完整列表见`server/services/bannedWords.js`）：
- 盘口/盘口水位 → 数据走势/数据变化
- 庄家 → (删除)
- 赌博/赌 → (删除)
- 博彩 → (删除)
- 投注/下注 → 关注/关注方向
- 赔率 → 数据指标
- 让球盘 → 让步数据
- 赢盘 → 数据占优
- 大小球 → 进球数预期
- 竞彩/足彩 → 赛事分析

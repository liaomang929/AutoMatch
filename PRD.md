# 足球赛事智能分析工具 - 产品需求文档 (PRD)

## 1. 产品概述

### 1.1 产品名称
**AutoMatch - 足球赛事智能分析助手**

### 1.2 产品定位
一款面向足球竞彩分析师的本地化工具，集成赛事数据抓取、智能选场、AI辅助分析、文案生成等功能，帮助分析师高效完成每日赛事分析、公众号推文和直播文案撰写工作。

### 1.3 核心用户
足球竞彩分析师，需要在每日发布赛事分析内容，运营微信公众号和视频号直播。

### 1.4 技术架构
| 层级 | 技术 | 版本/说明 |
|------|------|-----------|
| 前端 | React + Vite + Ant Design | Vite v8.0.8, antd v5 |
| 后端 | Node.js + Express | Express v5.2.1 |
| 数据抓取 | puppeteer-core | v24.41.0（使用系统Chrome，非内置） |
| AI服务 | 多模型支持 | 智谱GLM-4（默认）/ OpenAI兼容接口 / 自定义接口 |
| AI配置 | ai_config.json | 运行时保存，优先于.env中的ZHIPU_API_KEY |
| 数据存储 | 本地文件系统 | JSON + Markdown格式 |
| 运行环境 | macOS本地运行 | 端口：前端5173，后端3001 |

---

## 2. 五大功能模块

### 2.1 模块一：赛事数据抓取
#### 功能描述
从500彩票网抓取中国体育彩票官方发布的竞彩足球比赛数据，支持手动触发。

#### 数据源与技术
- **URL**: `https://trade.500.com/jczq/index.php?playid=312&g=2`
- **技术**: 使用`puppeteer-core`配合系统Chrome，避免完整包下载失败
- **反爬策略**: 设置User-Agent模拟真实浏览器，绕过500彩票网反爬（403拒绝）
- **页面解析**: 基于实际页面data属性提取，无需解析HTML文本
  - `table.bet-tb.bet-tb-dg` (index 1为数据表)
  - 每个`<tr>`含丰富data属性：`data-matchnum`(编号), `data-simpleleague`(赛事), `data-homesxname`(主队), `data-awaysxname`(客队), `data-rangqiu`(让球数)
  - 胜平负赔率映射：第一行`.itm-rangB1`→非让球，第二行`.itm-rangB2`→让球

#### 抓取字段（前端对齐命名）
| 字段 | 前端列名 | 数据源字段 | 说明 |
|------|---------|-----------|------|
| matchId | 编号 | data-matchnum | 比赛编号 |
| league | 赛事 | data-simpleleague | 联赛名称（前端显示"赛事"） |
| homeTeam | 主队 | data-homesxname | 主队名称 |
| awayTeam | 客队 | data-awaysxname | 客队名称 |
| matchTime | 比赛时间 | 页面表格时间列 | 比赛时间 |
| oddsWin | 胜 | 第一行data-sp (type=nspf, value=3) | 胜赔率 |
| oddsDraw | 平 | 第一行data-sp (type=nspf, value=1) | 平赔率 |
| oddsLoss | 负 | 第一行data-sp (type=nspf, value=0) | 负赔率 |
| handicapLine | 让步 | data-rangqiu | 让球数 |
| handicapWin | 让胜 | 第二行data-sp (type=spf, value=3) | 让球胜赔率 |
| handicapDraw | 让平 | 第二行data-sp (type=spf, value=1) | 让球平赔率 |
| handicapLoss | 让负 | 第二行data-sp (type=spf, value=0) | 让球负赔率 |

**注意**: 非让球行可能显示"未开售"（`betbtn-wait`），此时赔率为空。

#### 前端实现
- **页面**: `MatchDataPage.jsx`
- **功能**: Ant Design表格展示，支持排序，"一键抓取"按钮
- **API**: `POST /api/scrape`
- **存储**: `~/Desktop/AutoMatch/{日期}/01_原始数据/matches.json`

---

### 2.2 模块二：智能选场与预测录入
#### 功能描述
从当日所有比赛中智能筛选重点比赛（4~6场），支持手动调整并录入分析师预测。

#### 选场规则
| 当日总比赛数 | 选取重点场次数 |
|-------------|--------------|
| <5场 | 全选 |
| 5~10场 | 4场 |
| >10场 | 6场 |

#### 自动推荐算法
1. **联赛热度优先**: 五大联赛 > 次级联赛 > 其他
2. **赔率差异度**: 胜负平赔率差距大的比赛更有分析价值
3. **让球特殊性**: 让球数较大或较小的比赛

#### 预测录入字段
| 字段 | 说明 | 前端组件 |
|------|------|---------|
| prediction | 预测结果（主胜/平/客胜） | Select下拉框 |
| confidence | 信心指数（1-5星） | Rate评分组件 |
| analysisNote | 分析师分析笔记 | TextArea输入框 |
| isHot | 是否热门比赛（用于文案筛选） | Switch开关 |

#### 前端实现
- **页面**: `PredictPage.jsx`
- **功能**: 左侧自动推荐，右侧预测表单，自动保存
- **数据补全**: 当`selected.json`中缺失league字段时，自动从raw matches数据补全
- **API**: `PUT /api/matches/{date}/select`, `PUT /api/matches/{date}/predict/{matchId}`
- **存储**: `~/Desktop/AutoMatch/{日期}/02_重点比赛/selected.json`

---

### 2.3 模块三：AI辅助分析
#### 功能描述
调用多模型AI服务，根据分析师预测生成专业、逻辑闭环的赛事分析文案，支持批量生成。

#### AI模型支持
- **智谱GLM-4** (默认): 通过zhipuai-sdk-nodejs-v4调用
- **OpenAI兼容接口**: 支持DeepSeek、通义千问、Moonshot等
- **自定义接口**: 可配置任意HTTP兼容接口

#### 配置管理
- **配置方式**: 通过"模型配置"页面在线配置，优先使用`ai_config.json`
- **优先级**: `ai_config.json` > `.env`中的ZHIPU_API_KEY
- **配置字段**: provider (zhipu/openai/custom), apiKey, model, baseUrl, temperature, maxTokens

#### 输出要求
- 每场比赛约200字分析
- 逻辑闭环，有理有据
- 专业但不晦涩，有洞察力
- **违禁词过滤**: 自动过滤"盘口"、"庄家"、"赔率"等敏感词

#### 技术实现
- **API**: 
  - `POST /api/ai/analyze/{date}/{matchId}` (单场)
  - `POST /api/ai/analyze/{date}/batch` (批量) → **路由顺序**: batch需注册在:matchId之前
- **服务**: `aiService.js`统一封装多模型调用
- **存储**: `~/Desktop/AutoMatch/{日期}/03_AI分析/`

#### 前端实现
- **页面**: `AIAnalysisPage.jsx`
- **功能**: 展示AI分析，支持查看/编辑/复制，"生成AI分析"按钮
- **状态检查**: AI未配置时显示警告+禁用按钮
- **配置依赖**: 需先在"模型配置"页面配置AI参数

---

### 2.4 模块四：热门文案生成
#### 功能描述
从重点比赛中选出最热门的比赛，分别生成公众号推文和直播文案。

#### 热门比赛选择
- **公众号推文**: 选最热1场（isHot标记 + 联赛热度）
- **直播文案**: 选最热2场
- **选择依据**: 分析师标记的isHot + 联赛热度 + 赔率关注度

#### 公众号推文要求
**目标**: 吸引新粉丝关注，展示专业分析能力

**内容结构**:
1. 引人入胜的开头（制造悬念或抛出观点）
2. 球队基本面分析（近期战绩、伤停、历史交锋）
3. 数据指标解读（用"数据视角"替代敏感词）
4. 逻辑推导过程（层层递进，闭环论证）
5. 明确的预期结论
6. 号召关注的结尾

**输出要求**: 800-1200字，专业高深，逻辑闭环

#### 直播文案要求（三场比赛版 - 毒舌导演分析师风格）
**目标**: 今晚8:30直播使用，每天选取3场比赛，每场200-300字分析，严格按样例风格，适合提词器阅读

**角色设定**: 拥有15年经验的"毒舌赛事导演分析师"，用电影导演视角揭穿比赛套路

**核心暗语对照（强制执行）**:
- 赔率/水位 → 热度/温度
- 让球/盘口 → 设定/剧情要求
- 下注/博彩 → 跟剧/押注
- 收割/杀红 → 摘果子/收场
- 强队/弱队 → 主角/配角

**样例参考**:
```
多特蒙德 vs 勒沃库森（德甲）
今晚的德甲，我要先说一句——导演组把"坑"挖好了，就等热血观众往下跳。
大家看，主角多特名气够大吧？主场气势也够猛。但你们注意了，导演组给的"开启设定"智力非常低，还配了一个相当可爱的"高热度加成"。
这个"低陷阱＋高热度"的组合，在我们圈子里有一个名字，叫**"甜蜜陷阱"**。
导演组就是要让你觉得主角稳定了，顺手还能多赚一点。但我告诉你真相：配角勒沃库森今晚是拿逆袭脚本。
我的判断：今晚多特不仅赢不下来，甚至可能被逼出一场平局。看懂这套"逆向收割"逻辑的朋友，点个关注，我们一起把这出戏看到底。
```

**文案结构**:
1. **开场白**: 简短介绍今晚三场比赛，用"导演组设局"钩子留住观众（50-80字）
2. **三场比赛独立分析**: 每场200-300字，严格按以下结构：
   - 标题：{主队} vs {客队}（{赛事}）
   - 第一句：直接点名"导演组挖坑"或"设局"
   - 分析主角：名气、主场、优势
   - 分析导演组给的"设定"（让球）和"热度"（赔率）是否匹配
   - 判断是否存在"甜蜜陷阱"或"虚火过旺"
   - 揭示导演组意图：让观众觉得主角稳定，实际是套路
   - 明确判断：配角拿什么脚本，主角会怎样
   - 每场结尾：点题"逆向收割"逻辑
3. **结尾呼吁**: 引导点赞关注，一起看透导演组的戏（50-80字）

**输出要求**:
- **字数**: 每场比赛200-300字，总字数600-900字
- **排版**: 多用短句（每句不超过15字），适合直播提词器
- **语气**: 笃定、毒舌、揭秘感，每句话像匕首一样精准
- **风格**: 像资深导演分析师揭穿行业黑幕，让观众觉得"原来如此"
- **结构**: 开场 + 三场比赛独立分析（每场带标题） + 结尾
- **必须使用词汇**: 导演组、主角、配角、设定、热度、甜蜜陷阱、逆袭脚本、逆向收割

#### 违禁词处理
- **AI Prompt约束**: 在prompt中明确禁止违禁词，直播文案使用独特的"核心暗语对照"
- **后端双重过滤**: `bannedWords.js`库包含50+词库替换映射
- **直播文案核心暗语对照（强制执行）**:
  - 赔率/水位 → 热度/温度
  - 让球/盘口 → 设定/剧情要求
  - 下注/博彩 → 跟剧/押注
  - 收割/杀红 → 摘果子/收场
  - 强队/弱队 → 主角/配角
- **通用核心映射示例**:
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

#### 技术实现
- **API**: 
  - `POST /api/articles/wechat/{date}` (公众号)
  - `POST /api/articles/live/{date}` (直播)
- **存储**: `~/Desktop/AutoMatch/{日期}/04_公众号文案/` 和 `05_直播文案/`

#### 前端实现
- **页面**: `ArticlePage.jsx`
- **功能**: 公众号和直播文案生成按钮，生成后展示文案，支持查看/复制
- **状态检查**: AI未配置时显示警告+禁用按钮

---

### 2.5 模块五：模型配置管理
#### 功能描述
在线配置AI模型参数，支持多模型切换、API Key管理、连接测试。

#### 配置功能
1. **Provider选择**: zhipu/openai/custom
2. **动态表单**: 根据provider显示对应字段
3. **API Key管理**: 安全输入（Password类型）
4. **连接测试**: 保存配置后立即测试连通性
5. **配置状态**: 实时显示当前AI配置状态

#### 技术实现
- **API**: 
  - `GET/PUT /api/config/ai` (读取/保存配置)
  - `POST /api/config/ai/test` (测试连接)
  - `GET /api/config/ai/status` (配置状态)
- **存储**: `ai_config.json` (项目根目录)

#### 前端实现
- **页面**: `ConfigPage.jsx`
- **组件**: Ant Design Form表单
- **表单校验**: 手动校验当前选中provider的必填字段（避免隐藏字段required冲突）
- **测试连接优化**: 测试前自动保存当前表单配置
- **按钮文案**: "保存并测试连接"

#### 配置优先级
1. `ai_config.json` (通过配置页面保存)
2. `.env`中的`ZHIPU_API_KEY` (后备，仅用于zhipu provider)
3. 未配置时AI功能不可用

---

## 3. 数据存储设计

### 3.1 存储位置
`~/Desktop/AutoMatch/`

### 3.2 目录结构
```
AutoMatch/
├── 2026-04-16/                    # 按日期分目录
│   ├── 01_原始数据/
│   │   └── matches.json           # 抓取的原始比赛数据
│   ├── 02_重点比赛/
│   │   └── selected.json          # 选中的重点比赛+预测
│   ├── 03_AI分析/
│   │   ├── match_001_analysis.md   # 每场比赛AI分析
│   │   ├── match_002_analysis.md
│   │   └── all_analyses.json      # 所有分析汇总
│   ├── 04_公众号文案/
│   │   └── wechat_article.md      # 公众号推文
│   └── 05_直播文案/
│       └── live_script.md         # 直播文案
├── 2026-04-17/
│   └── ...
```

### 3.3 文件格式
- 比赛数据: JSON
- 分析文案: Markdown
- 所有文件同时可在网页工具中查看

---

## 4. 页面设计

### 4.1 整体布局
- 顶部导航栏：Logo + 日期选择
- 左侧菜单：5个功能模块切换（赛事数据、选场预测、AI分析、文案生成、模型配置）
- 主内容区：对应模块的操作界面

### 4.2 页面流程
1. **赛事数据页** (`MatchDataPage.jsx`): 一键抓取 → 展示表格 → 选择重点比赛
2. **选场预测页** (`PredictPage.jsx`): 查看选中比赛 → 录入预测 → 保存
3. **AI分析页** (`AIAnalysisPage.jsx`): 触发AI生成 → 查看/编辑分析 → 保存
4. **文案生成页** (`ArticlePage.jsx`): 选择热门比赛 → 生成公众号文案 → 生成直播文案 → 导出
5. **模型配置页** (`ConfigPage.jsx`): 配置AI模型参数 → 测试连接 → 保存配置（**先决条件**: AI分析和文案生成功能需先配置）

---

## 5. API设计

### 5.1 抓取相关
- `POST /api/scrape` - 触发抓取500彩票网数据
- `GET /api/matches/:date` - 获取指定日期的原始比赛数据

### 5.2 选场相关
- `PUT /api/matches/:date/select` - 保存选中的重点比赛
- `PUT /api/matches/:date/predict/:matchId` - 保存单场比赛预测信息
- `GET /api/matches/:date/selected` - 获取指定日期的重点比赛及预测数据

### 5.3 AI分析相关
- `POST /api/ai/analyze/:date/:matchId` - 生成单场比赛AI分析
- `POST /api/ai/analyze/:date/batch` - 批量生成AI分析（**路由顺序**: batch需注册在:matchId之前）
- `GET /api/ai/analyses/:date` - 获取指定日期所有AI分析
- `GET /api/ai/analysis/:date/:matchId` - 获取单场比赛AI分析

### 5.4 文案相关
- `POST /api/articles/wechat/:date` - 生成公众号推文
- `POST /api/articles/live/:date` - 生成直播文案
- `GET /api/articles/:date/wechat` - 获取公众号文案
- `GET /api/articles/:date/live` - 获取直播文案

### 5.5 配置相关
- `GET /api/config/ai` - 获取当前AI配置
- `PUT /api/config/ai` - 保存AI配置（保存到`ai_config.json`）
- `POST /api/config/ai/test` - 测试AI连接
- `GET /api/config/ai/status` - 获取AI配置状态（是否已配置）
- `GET /api/health` - 服务健康检查

---

## 6. 非功能需求

### 6.1 性能
- 抓取操作控制在30秒内完成
- AI分析单场控制在10秒内

### 6.2 安全
- **AI配置安全**: API Key优先存储在`ai_config.json`中（通过配置页面管理），后备使用`.env`中的`ZHIPU_API_KEY`
- **本地运行**: 仅限本地访问，不暴露到公网
- **违禁词过滤**: 后端`bannedWords.js`库自动过滤敏感词，确保生成内容合规
- **配置隔离**: 不同环境的配置通过文件隔离，避免敏感信息泄露

### 6.3 可维护性
- 代码模块化，各功能解耦
- 清晰的文件存储结构
- 配置项集中管理

---

## 7. 项目状态与已知问题

### 7.1 当前状态（2026-04-19）
- [x] PRD文档编写
- [x] 后端全部服务实现（抓取/存储/AI/违禁词/路由）
- [x] 前端5个页面实现（赛事数据/选场预测/AI分析/文案生成/模型配置）
- [x] 图标错误修复（antd图标必须使用`Outlined`后缀）
- [x] 后端根路由页面添加
- [x] 服务启动验证通过
- [x] Scraper精准重写（基于实际页面data属性提取，已验证抓取正确）
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

### 7.2 已知问题与解决方案
#### 7.2.1 antd图标命名
- **问题**: antd icons中没有`Soccer`、`Select`、`Robot`、`FileText`
- **解决**: 必须使用`Outlined`后缀 → `TrophyOutlined`、`AimOutlined`、`RobotOutlined`、`FileTextOutlined`
- **影响**: 错误的图标名会导致React渲染崩溃，页面空白

#### 7.2.2 Puppeteer安装
- **问题**: `puppeteer`完整包会下载Chrome，在国内网络环境经常失败
- **解决**: 改用`puppeteer-core`，配合系统已安装的Chrome

#### 7.2.3 500彩票网反爬
- **问题**: 直接fetch会被403拒绝
- **解决**: Puppeteer模拟真实浏览器访问，设置User-Agent

#### 7.2.4 Express路由匹配顺序
- **问题**: Express v5按注册顺序匹配路由，`/analyze/:date/:matchId` 会先于 `/analyze/:date/batch` 匹配
- **影响**: "batch"被当作matchId，返回"未找到该比赛"
- **解决**: 将batch路由注册在:matchId路由之前

#### 7.2.5 selected.json中league字段缺失
- **问题**: 旧scraper抓取的数据league为空，保存到selected.json后不会自动更新
- **解决**: 前端加载selected数据时，自动从raw matches补全缺失字段（league、赔率等）
- **注意**: 将"未知联赛"改为"未知赛事"

#### 7.2.6 智谱SDK调用路径
- **问题**: 错误使用了OpenAI风格 `client.chat.completions.create({...})`
- **影响**: 导致 `Cannot read properties of undefined (reading 'completions')`
- **解决**: 智谱SDK正确调用方式为 `client.completions.create({...})`（没有 `chat` 属性）

#### 7.2.7 ConfigPage表单校验
- **问题**: antd Form 的 `rules: [{required: true}]` 会校验所有字段，包括隐藏的provider字段
- **影响**: 切换provider后，隐藏的必填字段校验不通过，导致无法保存
- **解决**: 移除所有Form.Item的required规则，改为手动校验当前选中provider的字段

### 7.3 后续优化方向
1. **抓取稳定性**: 500彩票网页面结构可能变化，需要定期维护scraper.js中的CSS选择器
2. **定时任务**: 目前需手动触发抓取，可添加node-cron实现每日定时抓取
3. **数据持久化**: 如数据量增大，可迁移到SQLite
4. **直播文案**: 添加实时互动话术模板
5. **多平台发布**: 支持一键发布到微信公众号API
6. **历史数据**: 添加历史比赛结果回填和命中率统计

---

## 8. 运行方式

### 8.1 环境准备
1. **Node.js**: 确保已安装Node.js (v18+)
2. **Chrome**: 系统需安装Google Chrome浏览器（puppeteer-core依赖）
3. **API Key**: 准备智谱GLM-4 API Key或其他支持的AI服务API Key

### 8.2 启动步骤
```bash
# 1. 安装后端依赖
cd /Users/liaom/Documents/2026/Qoder/autoMatch
npm install

# 2. 安装前端依赖
cd client
npm install
cd ..

# 3. 启动后端服务（端口3001）
npm run dev

# 4. 另开终端，启动前端服务（端口5173）
cd client
npm run dev
```

### 8.3 访问地址
- **前端界面**: http://localhost:5173
- **后端API**: http://localhost:3001
- **API健康检查**: http://localhost:3001/api/health

### 8.4 首次使用流程
1. 访问 http://localhost:5173
2. 进入"模型配置"页面，配置AI模型参数
3. 测试连接确保AI服务可用
4. 进入"赛事数据"页面，点击"一键抓取"获取比赛数据
5. 按照页面流程：选场预测 → AI分析 → 文案生成

### 8.5 环境配置 (.env)
```env
ZHIPU_API_KEY=your_zhipu_api_key_here   # ← .env中的默认Key，可被ai_config.json覆盖
DATA_DIR=/Users/liaom/Desktop/AutoMatch  # 数据存储目录
CHROME_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
PORT=3001
```

**重要**: AI模型配置优先使用 `ai_config.json`（通过"模型配置"页面保存），不再依赖 .env 中的 ZHIPU_API_KEY。如未通过页面配置，AI分析和文案生成功能将不可用。

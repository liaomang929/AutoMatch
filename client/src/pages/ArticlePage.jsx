import { useState, useEffect } from 'react';
import { message, Tabs, Tag, Card, Button } from 'antd';
import { 
  WechatOutlined, 
  VideoCameraOutlined, 
  CopyOutlined,
  FireOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { getMatches, getAnalyses, getArticles, generateWechatArticle, generateLiveScript, getAIStatus } from '../api';
import ReactMarkdown from 'react-markdown';

const card = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
};

const innerBox = {
  background: 'rgba(0,0,0,0.25)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  padding: 20,
  maxHeight: 600,
  overflowY: 'auto',
};

export default function ArticlePage() {
  const date = new Date().toISOString().split('T')[0];
  const [selected, setSelected] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [wechat, setWechat] = useState(null);
  const [live, setLive] = useState(null);
  const [loadingWechat, setLoadingWechat] = useState(false);
  const [loadingLive, setLoadingLive] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);

  useEffect(() => {
    loadData();
    checkAIStatus();
  }, []);

  const checkAIStatus = async () => {
    try {
      const res = await getAIStatus();
      setAiConfigured(res.data?.configured || false);
    } catch (e) {
      setAiConfigured(false);
    }
  };

  const loadData = async () => {
    try {
      const matchRes = await getMatches(date);
      setSelected(matchRes.data?.selected || []);
      const analysisRes = await getAnalyses(date);
      setAnalyses(analysisRes.data || []);
      const articleRes = await getArticles(date);
      setWechat(articleRes.data?.wechat || null);
      setLive(articleRes.data?.live || null);
    } catch (e) {
      console.error('加载数据失败', e);
    }
  };

  const hotMatches = selected.filter(m => m.isHot);
  const hasHotMatches = hotMatches.length >= 1;
  const hasAnalyses = analyses.length > 0;

  const handleGenerateWechat = async () => {
    if (!aiConfigured) { message.error('请先在「模型配置」中配置AI模型和API Key'); return; }
    if (!hasHotMatches) { message.warning('请先在"选场预测"中标记热门比赛'); return; }
    if (!hasAnalyses) { message.warning('请先生成球之见分析'); return; }
    setLoadingWechat(true);
    try {
      message.loading({ content: '正在生成公众号文案...', key: 'wechat', duration: 0 });
      const res = await generateWechatArticle(date);
      message.success({ content: '公众号文案已生成', key: 'wechat' });
      setWechat(res.data);
    } catch (e) {
      message.error({ content: `生成失败: ${e.message}`, key: 'wechat' });
    } finally {
      setLoadingWechat(false);
    }
  };

  const handleGenerateLive = async () => {
    if (!aiConfigured) { message.error('请先在「模型配置」中配置AI模型和API Key'); return; }
    if (!hasHotMatches) { message.warning('请先在"选场预测"中标记热门比赛'); return; }
    if (!hasAnalyses) { message.warning('请先生成球之见分析'); return; }
    setLoadingLive(true);
    try {
      message.loading({ content: '正在生成直播文案...', key: 'live', duration: 0 });
      const res = await generateLiveScript(date);
      message.success({ content: '直播文案已生成', key: 'live' });
      setLive(res.data);
    } catch (e) {
      message.error({ content: `生成失败: ${e.message}`, key: 'live' });
    } finally {
      setLoadingLive(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const tabItems = [
    {
      key: 'wechat',
      label: <span><WechatOutlined /> 公众号推文</span>,
      children: (
        <div>
          {/* 操作栏 */}
          <div style={{ ...card, padding: '14px 18px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Button
                  type="primary"
                  icon={<WechatOutlined />}
                  onClick={handleGenerateWechat}
                  loading={loadingWechat}
                  disabled={!aiConfigured}
                  size="large"
                  style={{ background: '#818cf8', borderColor: '#818cf8' }}
                >
                  生成公众号推文
                </Button>
                {wechat && (
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(wechat.content)}
                    size="large"
                    style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)' }}
                  >
                    复制文案
                  </Button>
                )}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                最热比赛: {hotMatches[0] ? `${hotMatches[0].homeTeam} VS ${hotMatches[0].awayTeam}` : '未选择'}
              </div>
            </div>
          </div>

          {/* 文案内容 */}
          {wechat ? (
            <div style={card}>
              <div style={{ padding: '18px 20px' }}>
                <div style={innerBox}>
                  <ReactMarkdown
                    components={{
                      h1: ({node, ...props}) => <h1 style={{ fontSize: 20, fontWeight: 500, margin: '16px 0 10px', color: '#a5b4fc' }}>{props.children}</h1>,
                      h2: ({node, ...props}) => <h2 style={{ fontSize: 17, fontWeight: 500, margin: '14px 0 8px', color: 'rgba(255,255,255,0.88)' }}>{props.children}</h2>,
                      h3: ({node, ...props}) => <h3 style={{ fontSize: 15, fontWeight: 500, margin: '10px 0 6px', color: 'rgba(255,255,255,0.82)' }}>{props.children}</h3>,
                      p: ({node, ...props}) => <p style={{ fontSize: 14, lineHeight: 1.85, margin: '8px 0', color: 'rgba(255,255,255,0.82)' }}>{props.children}</p>,
                    }}
                  >
                    {wechat.content}
                  </ReactMarkdown>
                </div>
                {wechat.bannedWordsFound?.length > 0 && (
                  <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8 }}>
                    <div style={{ fontSize: 13, color: '#fbbf24', marginBottom: 4 }}>已过滤违禁词</div>
                    <div style={{ fontSize: 12, color: 'rgba(251,191,36,0.7)' }}>{wechat.bannedWordsFound.join(', ')}</div>
                  </div>
                )}
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                  生成时间: {new Date(wechat.createdAt).toLocaleString('zh-CN')}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ ...card, padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>📄</div>
              <h3 style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', marginBottom: 8 }}>暂无公众号文案</h3>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>请先生成球之见分析后点击"生成公众号推文"</p>
            </div>
          )}
        </div>
      )
    },
    {
      key: 'live',
      label: <span><VideoCameraOutlined /> 直播文案</span>,
      children: (
        <div>
          {/* 操作栏 */}
          <div style={{ ...card, padding: '14px 18px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Button
                  type="primary"
                  icon={<VideoCameraOutlined />}
                  onClick={handleGenerateLive}
                  loading={loadingLive}
                  disabled={!aiConfigured}
                  size="large"
                  style={{ background: '#e11d48', borderColor: '#e11d48' }}
                >
                  生成直播文案
                </Button>
                {live && (
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(live.content)}
                    size="large"
                    style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)' }}
                  >
                    复制文案
                  </Button>
                )}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>直播时间: 今晚 20:30</div>
            </div>
          </div>

          {/* 文案内容 */}
          {live ? (
            <div style={card}>
              <div style={{ padding: '18px 20px' }}>
                <div style={innerBox}>
                  <pre style={{ fontSize: 14, lineHeight: 1.85, color: 'rgba(255,255,255,0.82)', whiteSpace: 'pre-wrap', wordBreak: 'break-words', margin: 0, fontFamily: 'inherit' }}>
                    {live.content}
                  </pre>
                </div>
                {live.bannedWordsFound?.length > 0 && (
                  <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8 }}>
                    <div style={{ fontSize: 13, color: '#fbbf24', marginBottom: 4 }}>已过滤违禁词</div>
                    <div style={{ fontSize: 12, color: 'rgba(251,191,36,0.7)' }}>{live.bannedWordsFound.join(', ')}</div>
                  </div>
                )}
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                  生成时间: {new Date(live.createdAt).toLocaleString('zh-CN')}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ ...card, padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>🎥</div>
              <h3 style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', marginBottom: 8 }}>暂无直播文案</h3>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>请先生成球之见分析后点击"生成直播文案"</p>
            </div>
          )}
        </div>
      )
    }
  ];

  return (
    <div>
      {/* 顶部统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
        <div style={{ background: 'rgba(225,29,72,0.1)', border: '1px solid rgba(225,29,72,0.2)', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            <FireOutlined style={{ color: '#fb7185', marginRight: 8, fontSize: 14 }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>热门比赛</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {hotMatches.length > 0 ? hotMatches.map(m => (
              <Tag key={m.matchId} color="red">{m.homeTeam} VS {m.awayTeam}</Tag>
            )) : <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>未选择</span>}
          </div>
        </div>
        <div style={{ background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ fontSize: 12, color: '#a5b4fc', marginBottom: 8 }}>重点比赛</div>
          <div style={{ fontSize: 30, fontWeight: 500, color: '#c7d2fe' }}>
            {selected.length}<span style={{ fontSize: 14, color: '#a5b4fc', marginLeft: 4 }}>场</span>
          </div>
        </div>
        <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 8 }}>球之见分析</div>
          <div style={{ fontSize: 30, fontWeight: 500, color: '#fde68a' }}>
            {analyses.length}<span style={{ fontSize: 14, color: '#fbbf24', marginLeft: 4 }}>场</span>
          </div>
        </div>
      </div>

      {!aiConfigured && (
        <div style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12, padding: '14px 18px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ padding: '6px 8px', background: 'rgba(251,191,36,0.12)', borderRadius: 8, flexShrink: 0 }}>
              <SettingOutlined style={{ color: '#fbbf24', fontSize: 15 }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#fde68a', marginBottom: 4 }}>AI模型未配置</div>
              <div style={{ fontSize: 13, color: 'rgba(251,191,36,0.65)' }}>请先在左侧菜单「模型配置」中配置AI模型和API Key，才能使用文案生成功能。</div>
            </div>
          </div>
        </div>
      )}

      {!hasAnalyses && (
        <div style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12, padding: '14px 18px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ padding: '6px 8px', background: 'rgba(251,191,36,0.12)', borderRadius: 8, flexShrink: 0 }}>
              <span style={{ color: '#fbbf24', fontSize: 15 }}>⚠️</span>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#fde68a', marginBottom: 4 }}>请先完成球之见分析后再生成文案</div>
              <div style={{ fontSize: 13, color: 'rgba(251,191,36,0.65)' }}>请先在「辅助分析」页面生成球之见分析报告，然后返回此页面生成文案。</div>
            </div>
          </div>
        </div>
      )}

      <Tabs items={tabItems} defaultActiveKey="wechat" />
    </div>
  );
}

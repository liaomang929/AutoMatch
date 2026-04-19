import { useState, useEffect } from 'react';
import { Card, Button, message, Space, Typography, Row, Col, Divider, Tag, Tabs, Spin, Alert } from 'antd';
import { 
  WechatOutlined, 
  VideoCameraOutlined, 
  CopyOutlined,
  FireOutlined,
  ReloadOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { getMatches, getAnalyses, getArticles, generateWechatArticle, generateLiveScript, getAIStatus } from '../api';
import ReactMarkdown from 'react-markdown';

const { Paragraph } = Typography;



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
    if (!aiConfigured) {
      message.error('请先在「模型配置」中配置AI模型和API Key');
      return;
    }
    if (!hasHotMatches) {
      message.warning('请先在"选场预测"中标记热门比赛');
      return;
    }
    if (!hasAnalyses) {
      message.warning('请先生成AI分析');
      return;
    }
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
    if (!aiConfigured) {
      message.error('请先在「模型配置」中配置AI模型和API Key');
      return;
    }
    if (!hasHotMatches) {
      message.warning('请先在"选场预测"中标记热门比赛');
      return;
    }
    if (!hasAnalyses) {
      message.warning('请先生成AI分析');
      return;
    }
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
      label: (
        <span><WechatOutlined /> 公众号推文</span>
      ),
      children: (
        <div>
          <Card style={{ marginBottom: 16 }}>
            <Row gutter={16} align="middle">
              <Col span={12}>
                <Space>
                  <Button 
                    type="primary" 
                    icon={<WechatOutlined />}
                    onClick={handleGenerateWechat}
                    loading={loadingWechat}
                    disabled={!aiConfigured}
                    size="large"
                  >
                    生成公众号推文
                  </Button>
                  {wechat && (
                    <Button 
                      icon={<CopyOutlined />}
                      onClick={() => copyToClipboard(wechat.content)}
                    >
                      复制文案
                    </Button>
                  )}
                </Space>
              </Col>
              <Col span={12}>
                <div style={{ textAlign: 'right', color: '#666' }}>
                  最热比赛: {hotMatches[0] ? `${hotMatches[0].homeTeam} VS ${hotMatches[0].awayTeam}` : '未选择'}
                </div>
              </Col>
            </Row>
          </Card>

          {wechat ? (
            <Card>
              <div className="article-content">
                <ReactMarkdown
                  components={{
                    h1: ({node, ...props}) => <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '20px 0 16px', color: '#1890ff', fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif' }}>{props.children}</h1>,
                    h2: ({node, ...props}) => <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '16px 0 12px', color: '#595959', fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif' }}>{props.children}</h2>,
                    h3: ({node, ...props}) => <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '14px 0 10px', color: '#8c8c8c', fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif' }}>{props.children}</h3>,
                    p: ({node, ...props}) => <p style={{ fontSize: '14px', lineHeight: 1.8, margin: '10px 0', color: '#262626', fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif', whiteSpace: 'normal' }}>{props.children}</p>,
                  }}
                >
                  {wechat.content}
                </ReactMarkdown>
              </div>
              {wechat.bannedWordsFound?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Tag color="orange">已过滤违禁词: {wechat.bannedWordsFound.join(', ')}</Tag>
                </div>
              )}
              <Divider />
              <Paragraph type="secondary">
                生成时间: {new Date(wechat.createdAt).toLocaleString('zh-CN')}
              </Paragraph>
            </Card>
          ) : (
            <Card>
              <Paragraph type="secondary" style={{ textAlign: 'center', padding: 40 }}>
                暂无公众号文案，请先生成AI分析后点击"生成公众号推文"
              </Paragraph>
            </Card>
          )}
        </div>
      )
    },
    {
      key: 'live',
      label: (
        <span><VideoCameraOutlined /> 直播文案</span>
      ),
      children: (
        <div>
          <Card style={{ marginBottom: 16 }}>
            <Row gutter={16} align="middle">
              <Col span={12}>
                <Space>
                  <Button 
                    type="primary" 
                    icon={<VideoCameraOutlined />}
                    onClick={handleGenerateLive}
                    loading={loadingLive}
                    disabled={!aiConfigured}
                    size="large"
                    style={{ background: '#722ed1', borderColor: '#722ed1' }}
                  >
                    生成直播文案
                  </Button>
                  {live && (
                    <Button 
                      icon={<CopyOutlined />}
                      onClick={() => copyToClipboard(live.content)}
                    >
                      复制文案
                    </Button>
                  )}
                </Space>
              </Col>
              <Col span={12}>
                <div style={{ textAlign: 'right', color: '#666' }}>
                  直播时间: 今晚 20:30
                </div>
              </Col>
            </Row>
          </Card>

          {live ? (
            <Card>
              <div className="article-content">
                <ReactMarkdown
                  components={{
                    h1: ({node, ...props}) => <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '20px 0 16px', color: '#1890ff', fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif' }}>{props.children}</h1>,
                    h2: ({node, ...props}) => <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '16px 0 12px', color: '#595959', fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif' }}>{props.children}</h2>,
                    h3: ({node, ...props}) => <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '14px 0 10px', color: '#8c8c8c', fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif' }}>{props.children}</h3>,
                    p: ({node, ...props}) => <p style={{ fontSize: '14px', lineHeight: 1.8, margin: '10px 0', color: '#262626', fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif', whiteSpace: 'normal' }}>{props.children}</p>,
                  }}
                >
                  {live.content}
                </ReactMarkdown>
              </div>
              {live.bannedWordsFound?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Tag color="orange">已过滤违禁词: {live.bannedWordsFound.join(', ')}</Tag>
                </div>
              )}
              <Divider />
              <Paragraph type="secondary">
                生成时间: {new Date(live.createdAt).toLocaleString('zh-CN')}
              </Paragraph>
            </Card>
          ) : (
            <Card>
              <Paragraph type="secondary" style={{ textAlign: 'center', padding: 40 }}>
                暂无直播文案，请先生成AI分析后点击"生成直播文案"
              </Paragraph>
            </Card>
          )}
        </div>
      )
    }
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <div>
              <FireOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
              <strong>热门比赛:</strong>
              {hotMatches.length > 0 ? hotMatches.map(m => (
                <Tag key={m.matchId} color="red" style={{ marginLeft: 4 }}>
                  {m.homeTeam} VS {m.awayTeam}
                </Tag>
              )) : <Tag>未选择</Tag>}
            </div>
          </Col>
          <Col span={8}>
            <div>
              <strong>重点比赛:</strong> {selected.length} 场
            </div>
          </Col>
          <Col span={8}>
            <div>
              <strong>AI分析:</strong> {analyses.length} 场
            </div>
          </Col>
        </Row>
      </Card>

      {!aiConfigured && (
        <Alert 
          message="AI模型未配置" 
          description="请先在左侧菜单「模型配置」中配置AI模型和API Key，才能使用文案生成功能。"
          type="warning" 
          showIcon
          icon={<SettingOutlined />}
          style={{ marginBottom: 16 }}
        />
      )}

      {!hasAnalyses && (
        <Alert 
          message="请先完成AI分析后再生成文案" 
          type="warning" 
          showIcon 
          style={{ marginBottom: 16 }}
        />
      )}

      <Tabs items={tabItems} defaultActiveKey="wechat" />
    </div>
  );
}

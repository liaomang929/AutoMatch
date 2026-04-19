import { useState, useEffect } from 'react';
import { Card, Button, message, Space, List, Tag, Typography, Input, Row, Col, Spin, Divider, Alert } from 'antd';
import { RobotOutlined, ThunderboltOutlined, SaveOutlined, CopyOutlined, SettingOutlined } from '@ant-design/icons';
import { getMatches, getAnalyses, batchGenerateAnalysis, updateAnalysis, getAIStatus } from '../api';

const { TextArea } = Input;
const { Title, Paragraph } = Typography;

export default function AIAnalysisPage() {
  const date = new Date().toISOString().split('T')[0];
  const [selected, setSelected] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [aiConfigured, setAiConfigured] = useState(false);
  const [batchResults, setBatchResults] = useState(null);

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
      const rawMatches = matchRes.data?.raw || [];
      let savedSelected = matchRes.data?.selected || [];
      
      // 用 raw matches 补全 selected 中缺失的字段
      if (savedSelected.length > 0) {
        savedSelected = savedSelected.map(sel => {
          if (sel.league && sel.homeTeam) return sel;
          const rawMatch = rawMatches.find(m => m.matchId === sel.matchId);
          if (rawMatch) {
            return { 
              ...sel, 
              league: rawMatch.league || sel.league || '未知赛事',
              homeTeam: rawMatch.homeTeam || sel.homeTeam || '',
              awayTeam: rawMatch.awayTeam || sel.awayTeam || '',
              oddsWin: rawMatch.oddsWin || sel.oddsWin || '',
              oddsDraw: rawMatch.oddsDraw || sel.oddsDraw || '',
              oddsLoss: rawMatch.oddsLoss || sel.oddsLoss || '',
              handicapLine: rawMatch.handicapLine || sel.handicapLine || '',
            };
          }
          return { ...sel, league: sel.league || '未知赛事' };
        });
      }
      setSelected(savedSelected);
      
      const analysisRes = await getAnalyses(date);
      setAnalyses(analysisRes.data || []);
    } catch (e) {
      console.error('加载数据失败', e);
    }
  };

  const handleBatchGenerate = async () => {
    if (!aiConfigured) {
      message.error('请先在"模型配置"中配置AI模型和API Key');
      return;
    }
    if (selected.length === 0) {
      message.warning('请先在"选场预测"中选择重点比赛');
      return;
    }
    setLoading(true);
    setBatchResults(null);
    try {
      message.loading({ content: '正在批量生成AI分析，请稍候...', key: 'ai', duration: 0 });
      const res = await batchGenerateAnalysis(date);
      const results = res.data || [];
      const successCount = results.filter(r => !r.error).length;
      const failCount = results.filter(r => r.error).length;
      setBatchResults(results);
      if (failCount > 0) {
        message.warning({ content: `完成: ${successCount}场成功, ${failCount}场失败`, key: 'ai' });
      } else {
        message.success({ content: `成功生成 ${successCount} 场分析`, key: 'ai' });
      }
      loadData();
    } catch (e) {
      message.error({ content: `生成失败: ${e.message}`, key: 'ai' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async (matchId) => {
    try {
      await updateAnalysis(date, matchId, editContent);
      message.success('分析已更新');
      setEditingId(null);
      loadData();
    } catch (e) {
      message.error(`保存失败: ${e.message}`);
    }
  };

  const startEdit = (analysis) => {
    setEditingId(analysis.matchId);
    setEditContent(analysis.content);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const getMatchInfo = (matchId) => {
    return selected.find(m => m.matchId === matchId) || {};
  };

  const getAnalysis = (matchId) => {
    return analyses.find(a => a.matchId === matchId) || null;
  };

  const confidenceMap = { 1: '⭐', 2: '⭐⭐', 3: '⭐⭐⭐', 4: '⭐⭐⭐⭐', 5: '⭐⭐⭐⭐⭐' };

  return (
    <div>
      {!aiConfigured && (
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          showIcon
          icon={<SettingOutlined />}
          message="AI模型未配置"
          description="请先在左侧菜单「模型配置」中配置AI模型和API Key，才能使用AI分析功能。"
        />
      )}

      {batchResults && batchResults.some(r => r.error) && (
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          showIcon
          closable
          onClose={() => setBatchResults(null)}
          message="部分比赛AI分析失败"
          description={
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {batchResults.filter(r => r.error).map(r => {
                const match = getMatchInfo(r.matchId);
                return <li key={r.matchId}>{match.homeTeam || r.matchId} VS {match.awayTeam || ''} — {r.error}</li>;
              })}
            </ul>
          }
        />
      )}

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={12}>
            <Space>
              <Button 
                type="primary" 
                icon={<ThunderboltOutlined />} 
                onClick={handleBatchGenerate}
                loading={loading}
                disabled={!aiConfigured}
                size="large"
              >
                一键生成所有分析
              </Button>
            </Space>
          </Col>
          <Col span={12} style={{ textAlign: 'right' }}>
            <span style={{ color: '#666' }}>
              已选 {selected.length} 场 | 已分析 {analyses.length} 场
            </span>
          </Col>
        </Row>
      </Card>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" tip="AI正在分析中..." />
        </div>
      )}

      <List
        grid={{ gutter: 16, column: 1 }}
        dataSource={selected}
        renderItem={(match) => {
          const analysis = getAnalysis(match.matchId);
          return (
            <List.Item>
              <Card 
                title={
                  <Space>
                    <Tag color="orange">{match.league || '未知赛事'}</Tag>
                    <strong>{match.homeTeam} VS {match.awayTeam}</strong>
                    {match.prediction && <Tag color="blue">预测: {match.prediction}</Tag>}
                    {match.confidence && <span>{confidenceMap[match.confidence]}</span>}
                    {match.isHot && <Tag color="red">热门</Tag>}
                  </Space>
                }
                extra={
                  analysis && (
                    <Space>
                      <Button 
                        size="small" 
                        icon={<CopyOutlined />}
                        onClick={() => copyToClipboard(analysis.content)}
                      >
                        复制
                      </Button>
                      <Button 
                        size="small"
                        onClick={() => startEdit(analysis)}
                      >
                        编辑
                      </Button>
                    </Space>
                  )
                }
              >
                {match.analysisNote && (
                  <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                    我的分析: {match.analysisNote}
                  </Paragraph>
                )}
                
                {analysis ? (
                  editingId === match.matchId ? (
                    <div>
                      <TextArea 
                        value={editContent} 
                        onChange={e => setEditContent(e.target.value)}
                        rows={6}
                      />
                      <div style={{ marginTop: 8, textAlign: 'right' }}>
                        <Space>
                          <Button size="small" onClick={() => setEditingId(null)}>取消</Button>
                          <Button 
                            size="small" 
                            type="primary" 
                            icon={<SaveOutlined />}
                            onClick={() => handleSaveEdit(match.matchId)}
                          >
                            保存
                          </Button>
                        </Space>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Paragraph style={{ 
                        whiteSpace: 'pre-wrap', 
                        lineHeight: 1.8,
                        fontSize: '13px',
                        fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif'
                      }}>
                        {analysis.content}
                      </Paragraph>
                      {analysis.bannedWordsFound?.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <Tag color="orange">已过滤违禁词: {analysis.bannedWordsFound.join(', ')}</Tag>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <Paragraph type="secondary">暂无AI分析，请点击"一键生成"按钮</Paragraph>
                )}
              </Card>
            </List.Item>
          );
        }}
      />
    </div>
  );
}

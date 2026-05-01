import { useState, useEffect } from 'react';
import { message, Spin, Tag, Input } from 'antd';
import { RobotOutlined, ThunderboltOutlined, SaveOutlined, CopyOutlined, SettingOutlined } from '@ant-design/icons';
import { getMatches, getAnalyses, batchGenerateAnalysis, updateAnalysis, getAIStatus } from '../api';


export default function AIAnalysisPage() {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
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
    if (!aiConfigured) { message.error('请先在"模型配置"中配置AI模型和API Key'); return; }
    if (selected.length === 0) { message.warning('请先在"选场预测"中选择重点比赛'); return; }
    setLoading(true);
    setBatchResults(null);
    try {
      message.loading({ content: '正在批量生成球之见逻辑分析，请稍候...', key: 'ai', duration: 0 });
      const res = await batchGenerateAnalysis(date);
      const results = res.data || [];
      setBatchResults(results);
      const successCount = results.filter(r => !r.error).length;
      const failCount = results.filter(r => r.error).length;
      if (failCount === 0) {
        message.success({ content: `成功生成 ${successCount} 场分析`, key: 'ai' });
      } else {
        message.warning({ content: `生成完成：${successCount} 场成功，${failCount} 场失败`, key: 'ai' });
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
      message.success('分析已保存');
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

  const getMatchInfo = (matchId) => selected.find(m => m.matchId === matchId) || {};
  const getAnalysis = (matchId) => analyses.find(a => a.matchId === matchId) || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* AI未配置提示 */}
      {!aiConfigured && (
        <div style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ padding: '6px 8px', background: 'rgba(251,191,36,0.12)', borderRadius: 8, flexShrink: 0 }}>
              <SettingOutlined style={{ color: '#fbbf24', fontSize: 15 }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#fde68a', marginBottom: 4 }}>AI模型未配置</div>
              <div style={{ fontSize: 13, color: 'rgba(251,191,36,0.65)' }}>请先在左侧菜单「模型配置」中配置AI模型和API Key，才能使用AI分析功能。</div>
            </div>
          </div>
        </div>
      )}

      {/* 批量生成失败提示 */}
      {batchResults && batchResults.some(r => r.error) && (
        <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ color: '#f87171', fontSize: 16 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#fca5a5', marginBottom: 8 }}>部分比赛AI分析失败</div>
                {batchResults.filter(r => r.error).map(r => {
                  const match = getMatchInfo(r.matchId);
                  return (
                    <div key={r.matchId} style={{ fontSize: 13, color: 'rgba(252,165,165,0.8)', marginBottom: 4 }}>
                      {match.homeTeam || r.matchId} VS {match.awayTeam || ''} — {r.error}
                    </div>
                  );
                })}
              </div>
            </div>
            <button onClick={() => setBatchResults(null)} style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
        </div>
      )}

      {/* 操作卡片 */}
      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '18px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ padding: 10, background: 'rgba(129,140,248,0.2)', borderRadius: 10 }}>
              <RobotOutlined style={{ color: '#a5b4fc', fontSize: 22 }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>球之见逻辑分析</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>基于比赛数据和预测，生成专业分析报告</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: 10, padding: '10px 18px' }}>
              <div style={{ fontSize: 12, color: '#a5b4fc', marginBottom: 4 }}>分析进度</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 24, fontWeight: 500, color: '#c7d2fe' }}>{analyses.length}</span>
                <span style={{ fontSize: 13, color: '#a5b4fc' }}>场</span>
                <span style={{ fontSize: 13, color: 'rgba(165,180,252,0.5)', marginLeft: 4 }}>/ {selected.length} 场</span>
              </div>
            </div>
            <button
              onClick={handleBatchGenerate}
              disabled={loading || !aiConfigured || selected.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, border: 'none', background: loading || !aiConfigured || selected.length === 0 ? 'rgba(129,140,248,0.3)' : '#818cf8', color: '#fff', cursor: loading || !aiConfigured || selected.length === 0 ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 500 }}
            >
              <ThunderboltOutlined />
              <span>{loading ? '分析中...' : '一键生成所有分析'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 加载状态 */}
      {loading && (
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>正在为 {selected.length} 场比赛生成逻辑分析，请稍候...</div>
        </div>
      )}

      {/* 分析卡片列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {selected.length === 0 ? (
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
            <h3 style={{ fontSize: 16, color: 'rgba(255,255,255,0.65)', marginBottom: 8 }}>暂无待分析比赛</h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>请先在「选场预测」页面选择重点比赛并保存</p>
          </div>
        ) : (
          selected.map((match) => {
            const analysis = getAnalysis(match.matchId);
            const hasAnalysis = !!analysis;
            const isEditing = editingId === match.matchId;
            const predictions = match.prediction ? (Array.isArray(match.prediction) ? match.prediction : [match.prediction]) : [];

            return (
              <div
                key={match.matchId}
                style={{
                  background: hasAnalysis ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.05)',
                  border: hasAnalysis ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 14,
                  padding: '18px 22px',
                }}
              >
                {/* 卡片头部 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    {/* 标签行 */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      <span style={{ background: 'rgba(251,146,60,0.2)', color: '#fb923c', fontSize: 12, padding: '2px 10px', borderRadius: 20 }}>{match.league || '未知赛事'}</span>
                      <span style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)', fontSize: 12, padding: '2px 10px', borderRadius: 20 }}>#{match.matchId}</span>
                      {match.isHot && <span style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', fontSize: 12, padding: '2px 10px', borderRadius: 20 }}>🔥 热门</span>}
                      {predictions.map(p => {
                        const styleMap = {
                          '胜':  { background: 'rgba(239,68,68,0.15)',  color: '#f87171' },
                          '平':  { background: 'rgba(168,85,247,0.15)', color: '#c084fc' },
                          '负':  { background: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
                          '让胜':{ background: 'rgba(34,197,94,0.15)',  color: '#4ade80' },
                          '让平':{ background: 'rgba(251,146,60,0.15)', color: '#fb923c' },
                          '让负':{ background: 'rgba(6,182,212,0.15)',  color: '#22d3ee' },
                        };
                        return <span key={p} style={{ fontSize: 12, padding: '2px 10px', borderRadius: 20, ...(styleMap[p] || { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }) }}>预测: {p}</span>;
                      })}
                      {match.confidence && <span style={{ fontSize: 13, color: '#fbbf24' }}>{'★'.repeat(match.confidence)}</span>}
                    </div>
                    {/* 对阵 */}
                    <div style={{ fontSize: 18, fontWeight: 500, color: 'rgba(255,255,255,0.92)' }}>
                      {match.homeTeam} <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 8px', fontSize: 14 }}>VS</span> {match.awayTeam}
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{match.matchTime || '时间待定'}</div>
                  </div>

                  {/* 操作按钮 */}
                  {hasAnalysis && !isEditing && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => copyToClipboard(analysis.content)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 13 }}
                      >
                        <CopyOutlined /> 复制
                      </button>
                      <button
                        onClick={() => startEdit(analysis)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: 'none', background: '#818cf8', color: '#fff', cursor: 'pointer', fontSize: 13 }}
                      >
                        <SaveOutlined /> 编辑
                      </button>
                    </div>
                  )}
                </div>

                {/* 我的分析笔记 */}
                {match.analysisNote && (
                  <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: 10 }}>
                    <div style={{ fontSize: 12, color: '#a5b4fc', marginBottom: 4 }}>我的分析笔记</div>
                    <div style={{ fontSize: 13, color: 'rgba(165,180,252,0.85)', lineHeight: 1.7 }}>{match.analysisNote}</div>
                  </div>
                )}

                {/* AI分析内容 */}
                <div>
                  {hasAnalysis ? (
                    isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <Input.TextArea
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          rows={8}
                          style={{ borderRadius: 10, background: 'rgba(0,0,0,0.25)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.82)', resize: 'vertical' }}
                          placeholder="编辑分析内容..."
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                          <button
                            onClick={() => setEditingId(null)}
                            style={{ padding: '7px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 13 }}
                          >
                            取消
                          </button>
                          <button
                            onClick={() => handleSaveEdit(match.matchId)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 18px', borderRadius: 8, border: 'none', background: '#4ade80', color: '#0a0a0a', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
                          >
                            <SaveOutlined /> 保存修改
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: '16px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <div style={{ padding: 6, background: 'rgba(34,197,94,0.15)', borderRadius: 8 }}>
                              <RobotOutlined style={{ color: '#4ade80', fontSize: 14 }} />
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 500, color: '#4ade80' }}>球之见逻辑分析</span>
                          </div>
                          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.82)', lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>
                            {analysis.content}
                          </div>
                        </div>
                        {analysis.bannedWordsFound?.length > 0 && (
                          <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8 }}>
                            <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 4 }}>已过滤违禁词</div>
                            <div style={{ fontSize: 12, color: 'rgba(251,191,36,0.7)' }}>{analysis.bannedWordsFound.join(', ')}</div>
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    <div style={{ textAlign: 'center', padding: '24px 0', background: 'rgba(0,0,0,0.15)', borderRadius: 10 }}>
                      <div style={{ fontSize: 36, marginBottom: 10 }}>🤔</div>
                      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>暂无分析</div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>点击上方「一键生成所有分析」按钮生成智能分析报告</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

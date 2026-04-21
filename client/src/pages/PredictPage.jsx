import { useState, useEffect } from 'react';
import { message, Modal, Form, Rate, Input, Switch, Checkbox } from 'antd';
import { CheckCircleOutlined, StarOutlined, FireOutlined, PlusOutlined } from '@ant-design/icons';
import { getMatches, saveSelected, savePrediction } from '../api';

const { TextArea } = Input;

export default function PredictPage() {
  const date = new Date().toISOString().split('T')[0];
  const [matches, setMatches] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [predictModal, setPredictModal] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await getMatches(date);
      const rawMatches = res.data?.raw || [];
      
      // 从 selected.json 加载已选比赛，并用 raw matches 补全缺失字段
      let savedSelected = res.data?.selected || [];
      if (savedSelected.length > 0) {
        savedSelected = savedSelected.map(sel => {
          // 如果已有league则保留，否则从 raw 中补全
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
              matchTime: rawMatch.matchTime || sel.matchTime || '',
            };
          }
          return { ...sel, league: sel.league || '未知赛事' };
        });
      }
      setSelected(savedSelected);
    } catch (e) {
      console.error('加载数据失败', e);
    }
  };

  // 自动推荐选场数量
  const getRecommendCount = () => {
    const total = selected.length;
    if (total <= 5) return total;
    if (total <= 10) return 4;
    return 6;
  };

  // 自动推荐重点比赛（需要先从赛事数据页面抓取并选择）
  const handleAutoSelect = () => {
    message.info('请先在「赛事数据」页面抓取比赛并选择重点场次');
  };

  // 保存选中
  const handleSave = async () => {
    setLoading(true);
    try {
      await saveSelected(date, selected);
      message.success('重点比赛已保存');
      loadData();
    } catch (e) {
      message.error(`保存失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 打开预测弹窗
  const openPredict = (match) => {
    setCurrentMatch(match);
    const existing = selected.find(m => m.matchId === match.matchId);
    form.setFieldsValue({
      prediction: existing?.prediction ? (Array.isArray(existing.prediction) ? existing.prediction : [existing.prediction]) : [],
      confidence: existing?.confidence || 3,
      analysisNote: existing?.analysisNote || '',
      isHot: existing?.isHot || false,
    });
    setPredictModal(true);
  };

  // 保存预测
  const handleSavePrediction = async () => {
    try {
      const values = await form.validateFields();
      const updatedSelected = selected.map(m => 
        m.matchId === currentMatch.matchId 
          ? { ...m, ...values } 
          : m
      );
      setSelected(updatedSelected);
      await savePrediction(date, currentMatch.matchId, values);
      message.success('预测已保存');
      setPredictModal(false);
    } catch (e) {
      message.error(`保存失败: ${e.message}`);
    }
  };


  return (
    <div className="space-y-6">
      {/* 统计与操作卡片 */}
      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: 12, padding: '12px 20px' }}>
            <div style={{ fontSize: 12, color: '#a5b4fc', marginBottom: 6 }}>重点比赛选择</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 26, fontWeight: 500, color: '#c7d2fe' }}>{selected.length}</span>
              <span style={{ fontSize: 14, color: '#a5b4fc' }}>场</span>
              <span style={{ fontSize: 13, color: 'rgba(165,180,252,0.6)', marginLeft: 8 }}>
                建议选择 <strong style={{ color: '#a5b4fc' }}>{getRecommendCount()}</strong> 场
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleAutoSelect}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 14 }}
            >
              <StarOutlined />
              <span>智能推荐</span>
            </button>
            <button
              onClick={handleSave}
              disabled={loading || selected.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#818cf8', color: '#fff', cursor: loading || selected.length === 0 ? 'not-allowed' : 'pointer', opacity: loading || selected.length === 0 ? 0.5 : 1, fontSize: 14, fontWeight: 500 }}
            >
              <CheckCircleOutlined />
              <span>{loading ? '保存中...' : '保存选择'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 比赛卡片网格 */}
      {selected.length === 0 ? (
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <h3 style={{ fontSize: 16, color: 'rgba(255,255,255,0.65)', marginBottom: 8 }}>暂无已选比赛</h3>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>请先在「赛事数据」页面选择重点比赛</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {selected.map((match) => {
            const hasPrediction = match.prediction && (Array.isArray(match.prediction) ? match.prediction.length > 0 : match.prediction);
            return (
              <div
                key={match.matchId}
                onClick={() => openPredict(match)}
                style={{
                  borderRadius: 12,
                  border: hasPrediction ? '2px solid rgba(34,197,94,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  background: hasPrediction ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.05)',
                  boxShadow: hasPrediction ? '0 0 0 1px rgba(34,197,94,0.2), inset 0 0 20px rgba(34,197,94,0.04)' : 'none',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.border = hasPrediction ? '2px solid rgba(34,197,94,0.7)' : '1px solid rgba(255,255,255,0.25)';
                  e.currentTarget.style.background = hasPrediction ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.08)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.border = hasPrediction ? '2px solid rgba(34,197,94,0.5)' : '1px solid rgba(255,255,255,0.1)';
                  e.currentTarget.style.background = hasPrediction ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.05)';
                }}
              >
                <div style={{ padding: 18 }}>
                  {/* 头部：编号、赛事、时间、让步 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>#{match.matchId}</span>
                      <span style={{ background: 'rgba(251,146,60,0.2)', color: '#fb923c', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>{match.league || '未知赛事'}</span>
                      {match.matchTime && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{match.matchTime}</span>}
                      {match.handicapLine && <span style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>让步: {match.handicapLine}</span>}
                    </div>
                    {match.isHot && (
                      <span style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', fontSize: 11, padding: '2px 8px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                        <FireOutlined /> 热门
                      </span>
                    )}
                  </div>

                  {/* 核心信息：对阵双方 */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>{match.homeTeam || '主队'}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', padding: '0 8px' }}>VS</div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>{match.awayTeam || '客队'}</div>
                    </div>
                  </div>

                  {/* 数据层：赔率 */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 6 }}>
                      {[['胜', match.oddsWin, '#f87171', 'rgba(239,68,68,0.12)'],
                        ['平', match.oddsDraw, '#c084fc', 'rgba(168,85,247,0.12)'],
                        ['负', match.oddsLoss, '#60a5fa', 'rgba(59,130,246,0.12)']].map(([label, odds, color, bg]) => (
                        <div key={label} style={{ background: bg, borderRadius: 8, padding: '8px 4px', textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: 15, fontWeight: 500, color }}>{odds || '-'}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                      {[['让胜', match.handicapWin, '#4ade80', 'rgba(34,197,94,0.08)'],
                        ['让平', match.handicapDraw, '#fb923c', 'rgba(251,146,60,0.08)'],
                        ['让负', match.handicapLoss, '#22d3ee', 'rgba(6,182,212,0.08)']].map(([label, odds, color, bg]) => (
                        <div key={label} style={{ background: bg, borderRadius: 8, padding: '6px 4px', textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: 13, fontWeight: 500, color }}>{odds || '-'}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 结论层：预测结果 */}
                  <div style={{ paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    {hasPrediction ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>预测结果</div>
                          <span style={{ fontSize: 12, color: '#fbbf24' }}>{'★'.repeat(match.confidence || 3)}</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {(Array.isArray(match.prediction) ? match.prediction : [match.prediction]).map((p) => {
                            const styleMap = {
                              '胜':  { background: 'rgba(239,68,68,0.15)',  color: '#f87171',  border: '1px solid rgba(239,68,68,0.3)' },
                              '平':  { background: 'rgba(168,85,247,0.15)', color: '#c084fc',  border: '1px solid rgba(168,85,247,0.3)' },
                              '负':  { background: 'rgba(59,130,246,0.15)', color: '#60a5fa',  border: '1px solid rgba(59,130,246,0.3)' },
                              '让胜':{ background: 'rgba(34,197,94,0.15)',  color: '#4ade80',  border: '1px solid rgba(34,197,94,0.3)' },
                              '让平':{ background: 'rgba(251,146,60,0.15)', color: '#fb923c',  border: '1px solid rgba(251,146,60,0.3)' },
                              '让负':{ background: 'rgba(6,182,212,0.15)',  color: '#22d3ee',  border: '1px solid rgba(6,182,212,0.3)' },
                            };
                            return (
                              <span
                                key={p}
                                style={{ fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 6, ...(styleMap[p] || { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }) }}
                              >
                                {p}
                              </span>
                            );
                          })}
                        </div>
                        {match.analysisNote && (
                          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginTop: 6 }}>{match.analysisNote}</div>
                        )}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '10px 0' }}>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>尚未录入预测</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>点击卡片录入预测结果</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 预测模态框 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, background: 'rgba(129,140,248,0.2)', borderRadius: 8 }}>
              <StarOutlined style={{ color: '#a5b4fc' }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'rgba(255,255,255,0.92)' }}>比赛预测</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                {currentMatch?.homeTeam} VS {currentMatch?.awayTeam}
              </div>
            </div>
          </div>
        }
        open={predictModal}
        onCancel={() => setPredictModal(false)}
        width={600}
        styles={{
          content: {
            background: 'rgba(12,10,35,0.97)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            backdropFilter: 'blur(24px)',
          },
          header: { background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 14 },
          body: { padding: '20px 0' },
          mask: { backdropFilter: 'blur(4px)' },
        }}
        footer={null}
      >
        <div style={{ padding: '0 24px' }}>
          <Form form={form} layout="vertical">

            {/* 预测选项 - 2行3列 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', marginBottom: 12 }}>预测结果</div>
              <Form.Item name="prediction" rules={[{ required: true, message: '请至少选择一个预测结果' }]} style={{ marginBottom: 0 }}>
                <Checkbox.Group style={{ width: '100%' }}>
                  {/* 第一行：独赢 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 10 }}>
                    {[
                      { value: '胜',  border: 'rgba(239,68,68,0.4)',  bg: 'rgba(239,68,68,0.1)',  text: '#f87171', odds: currentMatch?.oddsWin },
                      { value: '平',  border: 'rgba(168,85,247,0.4)', bg: 'rgba(168,85,247,0.1)', text: '#c084fc', odds: currentMatch?.oddsDraw },
                      { value: '负',  border: 'rgba(59,130,246,0.4)', bg: 'rgba(59,130,246,0.1)', text: '#60a5fa', odds: currentMatch?.oddsLoss },
                    ].map((opt) => (
                      <Checkbox key={opt.value} value={opt.value} style={{ margin: 0 }}>
                        <div style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${opt.border}`, background: opt.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', minWidth: 120 }}>
                          <span style={{ fontWeight: 500, color: opt.text, fontSize: 15 }}>{opt.value}</span>
                          {opt.odds && <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{opt.odds}</span>}
                        </div>
                      </Checkbox>
                    ))}
                  </div>
                  {/* 第二行：让球 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                    {[
                      { value: '让胜', border: 'rgba(34,197,94,0.4)',  bg: 'rgba(34,197,94,0.1)',  text: '#4ade80', odds: currentMatch?.handicapWin },
                      { value: '让平', border: 'rgba(251,146,60,0.4)', bg: 'rgba(251,146,60,0.1)', text: '#fb923c', odds: currentMatch?.handicapDraw },
                      { value: '让负', border: 'rgba(6,182,212,0.4)',  bg: 'rgba(6,182,212,0.1)',  text: '#22d3ee', odds: currentMatch?.handicapLoss },
                    ].map((opt) => (
                      <Checkbox key={opt.value} value={opt.value} style={{ margin: 0 }}>
                        <div style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${opt.border}`, background: opt.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', minWidth: 120 }}>
                          <span style={{ fontWeight: 500, color: opt.text, fontSize: 15 }}>{opt.value}</span>
                          {opt.odds && <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{opt.odds}</span>}
                        </div>
                      </Checkbox>
                    ))}
                  </div>
                </Checkbox.Group>
              </Form.Item>
            </div>

            {/* 信心指数 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', marginBottom: 10 }}>信心指数</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Form.Item name="confidence" style={{ marginBottom: 0 }}>
                  <Rate count={5} style={{ fontSize: 24, color: '#fbbf24' }} />
                </Form.Item>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>1-5星，表示预测信心</span>
              </div>
            </div>

            {/* 热门比赛 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>标记为热门比赛</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>将在文案生成中优先使用</div>
              </div>
              <Form.Item name="isHot" valuePropName="checked" style={{ margin: 0 }}>
                <Switch />
              </Form.Item>
            </div>

            {/* 分析笔记 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', marginBottom: 10 }}>分析笔记</div>
              <Form.Item name="analysisNote" style={{ marginBottom: 0 }}>
                <Input.TextArea
                  rows={3}
                  placeholder="写下你的分析思路，例如：基本面、数据走势、关键球员状态等..."
                  style={{ borderRadius: 10, background: 'rgba(0,0,0,0.25)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.82)', resize: 'vertical' }}
                />
              </Form.Item>
            </div>

            {/* 快捷短语 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', marginBottom: 10 }}>快捷分析短语</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['上盘问题不大', '水位合理', '基本面与盘口相符', '盘口动态变化合理', '数据走势看好正路', '下盘有机会', '初盘与基本面不一致','盘口调整不合理','强队水位太高','弱队状态更佳'].map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() => {
                      const note = form.getFieldValue('analysisNote') || '';
                      form.setFieldValue('analysisNote', note + (note ? '，' : '') + phrase);
                    }}
                    style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', padding: '5px 12px', borderRadius: 8, cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(129,140,248,0.15)'; e.currentTarget.style.color = '#a5b4fc'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; }}
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            </div>

            {/* 底部按钮 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                type="button"
                onClick={() => setPredictModal(false)}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 14 }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSavePrediction}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#818cf8', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
              >
                保存预测
              </button>
            </div>

          </Form>
        </div>
      </Modal>
    </div>
  );
}

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
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex-1">
            <div className="text-sm font-medium text-blue-600 mb-1">重点比赛选择</div>
            <div className="flex items-center">
              <div className="text-2xl font-semibold text-blue-700">{selected.length}<span className="text-lg text-blue-500 ml-1">场</span></div>
              <div className="ml-4 text-sm text-blue-600">
                建议选择 <span className="font-bold">{getRecommendCount()}</span> 场
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleAutoSelect}
              className="secondary-button flex items-center space-x-2"
            >
              <StarOutlined />
              <span>智能推荐</span>
            </button>

            <button
              onClick={handleSave}
              disabled={loading || selected.length === 0}
              className="primary-button flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircleOutlined />
              <span>{loading ? '保存中...' : '保存选择'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 比赛卡片网格 */}
      {selected.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">暂无已选比赛</h3>
          <p className="text-gray-500 mb-6">请先在「赛事数据」页面选择重点比赛</p>
          <button
            onClick={() => window.location.hash = '#1'}
            className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
          >
            <span>前往赛事数据页面</span>
            <span className="ml-1">→</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {selected.map((match) => {
            const hasPrediction = match.prediction && (Array.isArray(match.prediction) ? match.prediction.length > 0 : match.prediction);
            return (
              <div
                key={match.matchId}
                className={`bg-white rounded-xl border-2 transition-all duration-200 hover:shadow-md cursor-pointer ${
                  hasPrediction
                    ? 'border-emerald-500 bg-emerald-50/30'
                    : 'border-gray-100 hover:border-gray-300'
                }`}
                onClick={() => openPredict(match)}
              >
                <div className="p-5">
                  {/* 头部：编号、赛事、时间、让步 */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center flex-wrap gap-1.5">
                      <span className="bg-gray-100 text-gray-700 text-xs font-medium px-2.5 py-1 rounded">
                        #{match.matchId}
                      </span>
                      <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-1 rounded">
                        {match.league || '未知赛事'}
                      </span>
                      {match.matchTime && (
                        <span className="text-gray-400 text-xs px-2 py-1">
                          {match.matchTime}
                        </span>
                      )}
                      {match.handicapLine && (
                        <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 rounded">
                          让步: {match.handicapLine}
                        </span>
                      )}
                    </div>
                    {match.isHot && (
                      <span className="bg-red-100 text-red-700 text-xs font-medium px-2.5 py-1 rounded flex items-center flex-shrink-0">
                        <FireOutlined className="mr-1" />
                        热门
                      </span>
                    )}
                  </div>

                  {/* 核心信息：对阵双方 */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-lg font-semibold text-gray-900">{match.homeTeam || '主队'}</div>
                      <div className="text-xs text-gray-400 px-2">VS</div>
                      <div className="text-lg font-semibold text-gray-900">{match.awayTeam || '客队'}</div>
                    </div>
                  </div>

                  {/* 数据层：赔率 */}
                  <div className="mb-4">
                    {/* 独赢赔率 */}
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div className="bg-red-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-500 mb-1">胜</div>
                        <div className="text-lg font-semibold tabular-nums text-red-600">
                          {match.oddsWin || '-'}
                        </div>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-500 mb-1">平</div>
                        <div className="text-lg font-semibold tabular-nums text-purple-600">
                          {match.oddsDraw || '-'}
                        </div>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-500 mb-1">负</div>
                        <div className="text-lg font-semibold tabular-nums text-blue-600">
                          {match.oddsLoss || '-'}
                        </div>
                      </div>
                    </div>
                    {/* 让球赔率 */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-500 mb-1">让胜</div>
                        <div className="text-lg font-semibold tabular-nums text-green-600">
                          {match.handicapWin || '-'}
                        </div>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-500 mb-1">让平</div>
                        <div className="text-lg font-semibold tabular-nums text-amber-600">
                          {match.handicapDraw || '-'}
                        </div>
                      </div>
                      <div className="bg-cyan-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-500 mb-1">让负</div>
                        <div className="text-lg font-semibold tabular-nums text-cyan-600">
                          {match.handicapLoss || '-'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 结论层：预测结果 */}
                  <div className="pt-4 border-t border-gray-100">
                    {hasPrediction ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium text-gray-700">预测结果</div>
                          <div className="flex items-center">
                            <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-1 rounded">
                              信心指数: {match.confidence || 3}星
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(Array.isArray(match.prediction) ? match.prediction : [match.prediction]).map((p) => {
                            const colorMap = {
                              '胜': 'bg-red-100 text-red-800',
                              '平': 'bg-purple-100 text-purple-800',
                              '负': 'bg-blue-100 text-blue-800',
                              '让胜': 'bg-green-100 text-green-800',
                              '让平': 'bg-orange-100 text-orange-800',
                              '让负': 'bg-cyan-100 text-cyan-800',
                            };
                            return (
                              <span
                                key={p}
                                className={`text-xs font-medium px-2.5 py-1 rounded ${colorMap[p] || 'bg-gray-100 text-gray-800'}`}
                              >
                                {p}
                              </span>
                            );
                          })}
                        </div>
                        {match.analysisNote && (
                          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                            {match.analysisNote}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <div className="text-gray-500 mb-2">尚未录入预测</div>
                        <div className="text-sm text-gray-400">点击卡片录入预测结果</div>
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
                {['盘口水位合理', '基本面符合盘口', '盘口动态变化合理', '上盘可期', '下盘有机会', '数据走势看好正路', '客队状态更佳'].map((phrase) => (
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

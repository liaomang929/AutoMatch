import { useState, useEffect } from 'react';
import { message, Input, Spin, Checkbox } from 'antd';
import {
  FireOutlined, PlusOutlined, DeleteOutlined,
  TrophyOutlined, EditOutlined, CheckOutlined, CloseOutlined, ThunderboltOutlined
} from '@ant-design/icons';

const { TextArea } = Input;

const BASE_URL = '/api';
async function request(url, options = {}) {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...options,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || '请求失败');
  return data;
}

const PRED_OPTS = [
  { value: '胜',   color: '#f87171', bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.35)' },
  { value: '平',   color: '#c084fc', bg: 'rgba(168,85,247,0.15)',  border: 'rgba(168,85,247,0.35)' },
  { value: '负',   color: '#60a5fa', bg: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.35)' },
  { value: '让胜', color: '#4ade80', bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.35)' },
  { value: '让平', color: '#fb923c', bg: 'rgba(251,146,60,0.15)',  border: 'rgba(251,146,60,0.35)' },
  { value: '让负', color: '#22d3ee', bg: 'rgba(6,182,212,0.15)',   border: 'rgba(6,182,212,0.35)' },
];

const getPredStyle = (val) => PRED_OPTS.find(o => o.value === val) || { color: 'rgba(255,255,255,0.6)', bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.15)' };
const card = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14 };
// prediction 现在是数组，odds 是每个选项的赔率数组对应 prediction
// emptyMatch: prediction=[], odds=[]（每个选项一个赔率）, avgOdds=自动计算
const emptyMatch = () => ({ no: '', homeTeam: '', awayTeam: '', predictions: [], oddsMap: {} });
const inputStyle = { background: 'rgba(0,0,0,0.25)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.88)', borderRadius: 8 };

// 计算单场平均赔率：选中项的赔率总和 / 选中数量
const calcMatchAvgOdds = (m) => {
  if (!m.predictions || m.predictions.length === 0) return null;
  const odds = m.predictions.map(p => parseFloat(m.oddsMap?.[p])).filter(o => !isNaN(o) && o > 0);
  if (odds.length === 0) return null;
  const avg = odds.reduce((a, b) => a + b, 0) / odds.length;
  return parseFloat(avg.toFixed(2));
};

// 组合赔率：每场平均赔率相乘
const calcComboOdds = (ms) => {
  const perMatch = ms.map(calcMatchAvgOdds).filter(o => o !== null);
  if (perMatch.length === 0) return null;
  return perMatch.reduce((a, b) => a * b, 1).toFixed(2);
};

// 自动生成观点文本
const genOpinionTemplate = (ms, comboOdds) => {
  const lines = [];
  lines.push(`今日方案赔率[方案赔率: ${comboOdds || '?'}]:`);
  ms.forEach((m, idx) => {
    const no = m.no || String(idx + 1).padStart(3, '0');
    const predStr = (m.predictions || []).join('/');
    lines.push(`${no}  ${m.homeTeam || '主队'} VS  ${m.awayTeam || '客队'}  ${predStr}`);
  });
  lines.push('');
  lines.push('球之见的观点:');
  return lines.join('\n');
};

export default function PicksPage({ user }) {
  const isAdmin = user?.role === 'admin';
  const today = new Date().toISOString().split('T')[0];

  const [pick, setPick] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [matches, setMatches] = useState([emptyMatch()]);
  const [opinion, setOpinion] = useState('');
  const [publishing, setPublishing] = useState(false);

  useEffect(() => { loadPick(); }, []);

  // 每次 matches 变化时，自动更新 opinion 模板（保留用户在模板后面追加的内容）
  useEffect(() => {
    if (!editing) return;
    const combo = calcComboOdds(matches);
    const template = genOpinionTemplate(matches, combo);
    setOpinion(prev => {
      // 找到"球之见的观点:"后面用户自己写的内容，保留
      const marker = '球之见的观点:';
      const markerIdx = prev.indexOf(marker);
      const userContent = markerIdx >= 0 ? prev.slice(markerIdx + marker.length) : '';
      return template + userContent;
    });
  }, [matches, editing]);

  const loadPick = async () => {
    setLoading(true);
    try {
      const res = await request(`/picks?date=${today}`);
      setPick(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handlePublish = async () => {
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      if (!m.homeTeam || !m.awayTeam) return message.error(`第${i + 1}场：请填写主队和客队`);
      if (!m.predictions || m.predictions.length === 0) return message.error(`第${i + 1}场：请至少选择一个预测结果`);
      const hasOdds = m.predictions.every(p => !isNaN(parseFloat(m.oddsMap?.[p])) && parseFloat(m.oddsMap?.[p]) > 0);
      if (!hasOdds) return message.error(`第${i + 1}场：请填写每个预测选项的赔率`);
    }
    if (!opinion.trim()) return message.error('请填写球之见观点');
    setPublishing(true);
    try {
      const combo_odds = calcComboOdds(matches);
      // 转换为存储格式（保持向后兼容）
      const storeMatches = matches.map(m => ({
        ...m,
        prediction: m.predictions.join('/'),
        odds: String(calcMatchAvgOdds(m)),
      }));
      await request('/picks', { method: 'POST', body: JSON.stringify({ date: today, matches: storeMatches, opinion, combo_odds }) });
      message.success('精选已发布！');
      setEditing(false);
      loadPick();
    } catch (e) { message.error(e.message); }
    finally { setPublishing(false); }
  };

  const handleDelete = async () => {
    try {
      await request(`/picks/${today}`, { method: 'DELETE' });
      message.success('已删除');
      setPick(null);
    } catch (e) { message.error(e.message); }
  };

  const startEdit = () => {
    if (pick) {
      // 恢复编辑格式
      const ms = pick.matches.map(m => ({
        no: m.no || '',
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        predictions: m.predictions || (m.prediction ? m.prediction.split('/') : []),
        oddsMap: m.oddsMap || {},
      }));
      setMatches(ms);
      setOpinion(pick.opinion || '');
    } else {
      setMatches([emptyMatch()]);
      setOpinion('');
    }
    setEditing(true);
  };

  const updateMatch = (idx, field, val) =>
    setMatches(prev => prev.map((m, i) => i === idx ? { ...m, [field]: val } : m));

  const togglePrediction = (idx, pred) => {
    setMatches(prev => prev.map((m, i) => {
      if (i !== idx) return m;
      const preds = m.predictions.includes(pred)
        ? m.predictions.filter(p => p !== pred)
        : [...m.predictions, pred];
      return { ...m, predictions: preds };
    }));
  };

  const updateOddsMap = (idx, pred, val) => {
    setMatches(prev => prev.map((m, i) => {
      if (i !== idx) return m;
      return { ...m, oddsMap: { ...m.oddsMap, [pred]: val } };
    }));
  };

  const addMatch = () => {
    if (matches.length >= 3) return message.warning('最多添加3场');
    setMatches(prev => [...prev, emptyMatch()]);
  };

  const removeMatch = (idx) => {
    if (matches.length <= 1) return message.warning('至少保留1场');
    setMatches(prev => prev.filter((_, i) => i !== idx));
  };

  const comboOdds = calcComboOdds(matches);

  // ===== 编辑模式 =====
  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 顶部操作栏 */}
        <div style={{ ...card, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, background: 'rgba(239,68,68,0.2)', borderRadius: 10 }}>
              <FireOutlined style={{ color: '#f87171', fontSize: 20 }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'rgba(255,255,255,0.92)' }}>发布今日精选</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{today} · 选择1-3场，每场可选多个结果</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setEditing(false)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 13 }}>
              <CloseOutlined /> 取消
            </button>
            <button onClick={handlePublish} disabled={publishing} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#818cf8', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
              <CheckOutlined /> {publishing ? '发布中...' : '确认发布'}
            </button>
          </div>
        </div>

        {/* 组合赔率实时预览 */}
        {comboOdds && (
          <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 14, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, color: 'rgba(251,191,36,0.7)', marginBottom: 2 }}>
                {matches.length === 1 ? '本场赔率（平均）' : `${matches.length}场组合赔率（各场平均后相乘）`}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                {matches.map((m, i) => {
                  const avg = calcMatchAvgOdds(m);
                  return avg ? avg : '?';
                }).join(' × ')} = {comboOdds}
              </div>
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, color: '#fde68a' }}>{comboOdds}</div>
          </div>
        )}

        {/* 每场比赛 */}
        {matches.map((m, idx) => (
          <div key={idx} style={{ ...card, padding: '18px 20px' }}>
            {/* 场次标题行 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(129,140,248,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#a5b4fc', fontWeight: 600 }}>{idx + 1}</div>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#a5b4fc' }}>第 {idx + 1} 场</span>
              </div>
              {matches.length > 1 && (
                <button onClick={() => removeMatch(idx)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171', cursor: 'pointer', fontSize: 12 }}>
                  <DeleteOutlined /> 移除
                </button>
              )}
            </div>

            {/* 编号 + 主队 VS 客队（一行） */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Input value={m.no} onChange={e => updateMatch(idx, 'no', e.target.value)} placeholder="编号 如001" style={{ ...inputStyle, width: 100, flexShrink: 0 }} />
              <Input value={m.homeTeam} onChange={e => updateMatch(idx, 'homeTeam', e.target.value)} placeholder="主队名称" style={{ ...inputStyle, flex: 1 }} />
              <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 500, flexShrink: 0 }}>VS</span>
              <Input value={m.awayTeam} onChange={e => updateMatch(idx, 'awayTeam', e.target.value)} placeholder="客队名称" style={{ ...inputStyle, flex: 1 }} />
            </div>

            {/* 预测结果多选 + 对应赔率 */}
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>选择预测结果（可多选），并填写对应赔率：</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {PRED_OPTS.map(opt => {
                const selected = m.predictions.includes(opt.value);
                return (
                  <div key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, border: `1px solid ${selected ? opt.border : 'rgba(255,255,255,0.08)'}`, background: selected ? opt.bg : 'rgba(0,0,0,0.15)', cursor: 'pointer', transition: 'all 0.15s' }}
                    onClick={() => togglePrediction(idx, opt.value)}>
                    <Checkbox checked={selected} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: selected ? 600 : 400, color: selected ? opt.color : 'rgba(255,255,255,0.45)', flex: 1 }}>{opt.value}</span>
                    {selected && (
                      <Input
                        value={m.oddsMap?.[opt.value] || ''}
                        onChange={e => { e.stopPropagation(); updateOddsMap(idx, opt.value, e.target.value); }}
                        onClick={e => e.stopPropagation()}
                        placeholder="赔率"
                        style={{ width: 70, background: 'rgba(0,0,0,0.3)', borderColor: 'rgba(255,255,255,0.12)', color: '#fbbf24', borderRadius: 6, padding: '2px 8px', fontSize: 13 }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* 平均赔率提示 */}
            {m.predictions.length > 1 && calcMatchAvgOdds(m) && (
              <div style={{ marginTop: 10, fontSize: 13, color: 'rgba(251,191,36,0.7)' }}>
                本场平均赔率：({m.predictions.map(p => m.oddsMap?.[p] || '?').join(' + ')}) ÷ {m.predictions.length} = <strong style={{ color: '#fde68a' }}>{calcMatchAvgOdds(m)}</strong>
              </div>
            )}
          </div>
        ))}

        {/* 添加场次 */}
        {matches.length < 3 && (
          <button onClick={addMatch} style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: '1px dashed rgba(129,140,248,0.4)', background: 'rgba(129,140,248,0.05)', color: '#a5b4fc', cursor: 'pointer', fontSize: 14 }}>
            <PlusOutlined /> 添加第 {matches.length + 1} 场
          </button>
        )}

        {/* 观点文本框（自动填充） */}
        <div style={{ ...card, padding: '18px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#a5b4fc', marginBottom: 10 }}>球之见观点 <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>（已自动填入格式，在「球之见的观点:」后继续写）</span></div>
          <TextArea
            value={opinion}
            onChange={e => setOpinion(e.target.value)}
            rows={10}
            style={{ background: 'rgba(0,0,0,0.25)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.82)', borderRadius: 10, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.8 }}
          />
        </div>
      </div>
    );
  }

  // ===== 查看模式 =====
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 顶部标题 */}
      <div style={{ ...card, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ padding: 8, background: 'rgba(239,68,68,0.2)', borderRadius: 10 }}>
            <FireOutlined style={{ color: '#f87171', fontSize: 20 }} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 500, color: 'rgba(255,255,255,0.92)' }}>球之见精选</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{today} · 专业推荐 · 每日20:00前更新</div>
          </div>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={startEdit} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#818cf8', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
              <EditOutlined /> {pick ? '修改精选' : '发布精选'}
            </button>
            {pick && (
              <button onClick={handleDelete} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171', cursor: 'pointer', fontSize: 14 }}>
                <DeleteOutlined />
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}><Spin size="large" /></div>
      ) : !pick ? (
        <div style={{ ...card, padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🎯</div>
          <h3 style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>今日暂无精选推荐</h3>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>{isAdmin ? '点击右上角「发布精选」' : '请等待管理员发布今日精选'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 发布人 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            <TrophyOutlined />
            <span>由 <strong style={{ color: '#a5b4fc' }}>{pick.publisher_name || '管理员'}</strong> 发布 · {new Date(pick.created_at).toLocaleString('zh-CN')}</span>
          </div>

          {/* 组合赔率 */}
          <div style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(251,146,60,0.08) 100%)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 16, padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <ThunderboltOutlined style={{ color: '#fbbf24', fontSize: 16 }} />
                <span style={{ fontSize: 15, fontWeight: 500, color: '#fde68a' }}>
                  {pick.matches.length === 1 ? '本场赔率' : `${pick.matches.length}场组合赔率`}
                </span>
              </div>
              {pick.matches.length > 1 && (
                <div style={{ fontSize: 13, color: 'rgba(251,191,36,0.55)' }}>
                  {pick.matches.map(m => m.odds).join(' × ')} = {pick.combo_odds}
                </div>
              )}
            </div>
            <div style={{ fontSize: 48, fontWeight: 700, color: '#fde68a', letterSpacing: -1 }}>{pick.combo_odds}</div>
          </div>

          {/* 比赛卡片平铺 */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(pick.matches.length, 3)}, 1fr)`, gap: 12 }}>
            {pick.matches.map((m, idx) => {
              const preds = m.predictions || (m.prediction ? m.prediction.split('/') : []);
              return (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '18px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(129,140,248,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#a5b4fc', fontWeight: 600 }}>{idx + 1}</div>
                    {m.no && <span style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>{m.no}</span>}
                  </div>
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.92)' }}>{m.homeTeam}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', margin: '6px 0' }}>VS</div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.92)' }}>{m.awayTeam}</div>
                  </div>
                  {/* 预测标签 */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 10 }}>
                    {preds.map(p => {
                      const s = getPredStyle(p);
                      return <span key={p} style={{ fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 8, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{p}</span>;
                    })}
                  </div>
                  {/* 平均赔率 */}
                  <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, color: '#fde68a' }}>{m.odds}</div>
                  {preds.length > 1 && <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>平均赔率</div>}
                </div>
              );
            })}
          </div>

          {/* 球之见观点 */}
          {pick.opinion && (
            <div style={{ background: 'rgba(129,140,248,0.07)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: 14, padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ padding: '4px 8px', background: 'rgba(129,140,248,0.2)', borderRadius: 6 }}>
                  <FireOutlined style={{ color: '#a5b4fc', fontSize: 13 }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#a5b4fc' }}>球之见观点</span>
              </div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.82)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
                {pick.opinion}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { message } from 'antd';
import { SyncOutlined, DownloadOutlined, CheckCircleOutlined, StarOutlined } from '@ant-design/icons';
import { scrapeMatches, getMatches, saveSelected } from '../api';

export default function MatchDataPage() {
  const date = new Date().toISOString().split('T')[0];
  const [matches, setMatches] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await getMatches(date);
      setMatches(res.data?.raw || []);
      setSelected(res.data?.selected || []);
    } catch (e) {
      console.error('加载数据失败', e);
    }
  };
  
  const handleScrape = async () => {
    setLoading(true);
    // 先清空旧数据
    setMatches([]);
    setSelected([]);
    try {
      message.loading({ content: '正在抓取500彩票网数据，请稍候...', key: 'scrape', duration: 0 });
      const res = await scrapeMatches();
      message.success({ content: `成功抓取 ${res.count} 场比赛`, key: 'scrape' });
      const scrapedMatches = res.data || [];
      setMatches(scrapedMatches);
      // 刷新selected数据
      try {
        const matchRes = await getMatches(date);
        setSelected(matchRes.data?.selected || []);
      } catch (e) {
        // 忽略，selected数据可能还没保存
      }
    } catch (e) {
      message.error({ content: `抓取失败: ${e.message}`, key: 'scrape' });
      // 抓取失败时恢复原数据
      loadData();
    } finally {
      setLoading(false);
    }
  };

  const selectedIds = selected.map(m => m.matchId);

  // 自动推荐选场数量
  const getRecommendCount = () => {
    const total = matches.length;
    if (total <= 5) return total;
    if (total <= 10) return 4;
    return 6;
  };

  // 切换选中状态
  const toggleSelect = (record) => {
    const maxCount = getRecommendCount();
    const exists = selected.find(m => m.matchId === record.matchId);
    if (exists) {
      setSelected(selected.filter(m => m.matchId !== record.matchId));
    } else {
      if (selected.length >= maxCount) {
        message.warning(`最多选择 ${maxCount} 场重点比赛`);
        return;
      }
      setSelected([...selected, {
        ...record,
        prediction: '',
        confidence: 3,
        analysisNote: '',
        isHot: false,
      }]);
    }
  };

  // 智能推荐
  const handleAutoSelect = () => {
    const count = getRecommendCount();
    if (matches.length === 0) {
      message.warning('请先抓取比赛数据');
      return;
    }
    const leagueRank = {
      '英超': 1, '西甲': 2, '意甲': 3, '德甲': 4, '法甲': 5,
      '欧冠': 6, '欧联': 7, '亚冠': 8, '英冠': 9,
      '中超': 10, '日职': 11, '韩职': 12, '葡超': 13, '荷甲': 14,
    };
    const scored = matches.map(m => {
      let score = 0;
      score += (10 - (leagueRank[m.league] || 15)) * 2;
      if (m.oddsWin && m.oddsLoss) {
        score += Math.abs(parseFloat(m.oddsWin) - parseFloat(m.oddsLoss)) * 2;
      }
      return { ...m, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const recommended = scored.slice(0, count).map(m => ({
      ...m,
      prediction: '',
      confidence: 3,
      analysisNote: '',
      isHot: false,
    }));
    setSelected(recommended);
    message.success(`已推荐 ${count} 场重点比赛`);
  };

  // 保存选中
  const handleSave = async () => {
    if (selected.length === 0) {
      message.warning('请先选择重点比赛');
      return;
    }
    setSaving(true);
    try {
      await saveSelected(date, selected);
      message.success('重点比赛已保存');
      loadData();
    } catch (e) {
      message.error(`保存失败: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="space-y-6">
      {/* 统计与操作卡片 */}
      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '20px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>今日比赛总数</div>
            <div style={{ fontSize: 28, fontWeight: 500, color: 'rgba(255,255,255,0.88)' }}>{matches.length}<span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>场</span></div>
          </div>
          <div style={{ background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: 12, color: '#a5b4fc', marginBottom: 6 }}>已选重点比赛</div>
            <div style={{ fontSize: 28, fontWeight: 500, color: '#c7d2fe' }}>{selected.length}<span style={{ fontSize: 14, color: '#a5b4fc', marginLeft: 4 }}>场</span></div>
          </div>
          <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 6 }}>推荐选择</div>
            <div style={{ fontSize: 28, fontWeight: 500, color: '#fde68a' }}>{getRecommendCount()}<span style={{ fontSize: 14, color: '#fbbf24', marginLeft: 4 }}>场</span></div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button
            onClick={handleScrape}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, fontSize: 14 }}
          >
            <DownloadOutlined />
            <span>{loading ? '抓取中...' : '抓取今日比赛数据'}</span>
          </button>
          <button
            onClick={handleAutoSelect}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 14 }}
          >
            <StarOutlined />
            <span>智能推荐</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving || selected.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#818cf8', color: '#fff', cursor: saving || selected.length === 0 ? 'not-allowed' : 'pointer', opacity: saving || selected.length === 0 ? 0.5 : 1, fontSize: 14, fontWeight: 500 }}
          >
            <CheckCircleOutlined />
            <span>{saving ? '保存中...' : '保存选择'}</span>
          </button>
        </div>

        {selected.length > 0 && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#a5b4fc' }}>
              <span>💡</span>
              <span>已选 <strong>{selected.length}</strong> 场（建议选 <strong>{getRecommendCount()}</strong> 场），点击「保存选择」后可在「选场预测」中录入预测</span>
            </div>
          </div>
        )}
      </div>

      {/* 比赛卡片网格 */}
      {matches.length === 0 ? (
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚽</div>
          <h3 style={{ fontSize: 16, color: 'rgba(255,255,255,0.65)', marginBottom: 8 }}>暂无比赛数据</h3>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>点击上方「抓取今日比赛数据」获取最新赛事信息</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {matches.map((match, index) => {
            const isSelected = selectedIds.includes(match.matchId);
            return (
              <div
                key={match.matchId}
                style={{
                  borderRadius: 12,
                  border: isSelected ? '2px solid #818cf8' : '1px solid rgba(255,255,255,0.1)',
                  background: isSelected ? 'rgba(129,140,248,0.18)' : 'rgba(255,255,255,0.05)',
                  boxShadow: isSelected ? '0 0 0 1px rgba(129,140,248,0.3), inset 0 0 20px rgba(129,140,248,0.08)' : 'none',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  if (!isSelected) {
                    e.currentTarget.style.border = '1px solid rgba(255,255,255,0.25)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isSelected) {
                    e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  }
                }}
              >
                <div className="p-5">
                  {/* 头部：编号、赛事、让步、时间 */}
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                    <span style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>
                      #{match.matchId}
                    </span>
                    <span style={{ background: 'rgba(251,146,60,0.2)', color: '#fb923c', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>
                      {match.league || '未知赛事'}
                    </span>
                    {match.handicapLine && (
                      <span style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>
                        让步: {match.handicapLine}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                      {match.matchTime || '时间待定'}
                    </span>
                  </div>

                  {/* 核心信息：对阵双方 */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>{match.homeTeam || '主队'}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', padding: '0 8px' }}>VS</div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>{match.awayTeam || '客队'}</div>
                    </div>
                  </div>

                  {/* 数据层：赔率 */}
                  <div style={{ marginBottom: 14 }}>
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
                    {(match.handicapWin || match.handicapDraw || match.handicapLoss) && (
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
                    )}
                  </div>

                  {/* 操作层 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <div>
                      {isSelected ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500, color: '#a5b4fc', background: 'rgba(129,140,248,0.15)', padding: '4px 10px', borderRadius: 20 }}>
                          <CheckCircleOutlined />
                          已选为重点
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>未选择</span>
                      )}
                    </div>
                    <button
                      onClick={() => toggleSelect(match)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 8,
                        border: isSelected ? '1px solid rgba(129,140,248,0.4)' : '1px solid rgba(255,255,255,0.15)',
                        background: isSelected ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.07)',
                        color: isSelected ? '#a5b4fc' : 'rgba(255,255,255,0.6)',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      {isSelected ? '取消选择' : '选择为重点'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

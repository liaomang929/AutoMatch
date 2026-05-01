import { useState, useEffect } from 'react';
import { Table, Tag, message, Select, Spin } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { getAllPicks, updatePickResult, getPickHitRate } from '../api';

const { Option } = Select;

const card = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
};

const resultColorMap = {
  '胜': '#cf1322', '平': '#722ed1', '负': '#1890ff',
  '让胜': '#16a34a', '让平': '#d97706', '让负': '#0891b2',
};

const RESULT_OPTIONS = ['胜', '平', '负', '让胜', '让平', '让负'];

// 一天一条记录
function transformPicks(picks) {
  return picks.map(pick => ({
    key: pick.date,
    date: pick.date,
    matches: (pick.matches || []).map(m => ({
      no: m.no,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      predictions: m.predictions || (m.prediction ? m.prediction.split('/') : []),
      actualResult: m.actualResult || '',
    })),
  }));
}

export default function DailySelectPage() {
  const [allPicks, setAllPicks] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [hitRate, setHitRate] = useState(null);

  useEffect(() => { loadPicks(); }, []);

  const loadPicks = async () => {
    setLoading(true);
    try {
      const [picksRes, hitRateRes] = await Promise.all([
        getAllPicks(),
        getPickHitRate(7),
      ]);
      const picks = picksRes.data || [];
      setAllPicks(picks);
      setRows(transformPicks(picks));
      setHitRate(hitRateRes.data || null);
    } catch (e) {
      message.error('加载失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveResult = async (date, matchNo, homeTeam, awayTeam, value) => {
    if (!value) return;
    const key = `${date}-${matchNo}`;
    setSavingKey(key);
    try {
      await updatePickResult(date, matchNo, value);
      message.success(`已保存 ${homeTeam} VS ${awayTeam} → ${value}`);
      // 本地更新
      setRows(prev => prev.map(row =>
        row.key === date
          ? { ...row, matches: row.matches.map(m => m.no === matchNo ? { ...m, actualResult: value } : m) }
          : row
      ));
      // 刷新命中率
      const hitRateRes = await getPickHitRate(7);
      setHitRate(hitRateRes.data || null);
    } catch (e) {
      message.error('保存失败: ' + e.message);
    } finally {
      setSavingKey(null);
    }
  };

  const columns = [
    {
      title: '日期',
      dataIndex: 'date',
      width: 110,
      render: (text) => <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>{text}</span>,
    },
    {
      title: '比赛',
      key: 'match',
      render: (_, record) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {record.matches.map((m, idx) => (
            <div key={m.no} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderTop: idx > 0 ? '1px dashed rgba(255,255,255,0.08)' : 'none' }}>
              <span style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: 11, padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>
                {m.no}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 500, fontSize: 14 }}>{m.homeTeam}</span>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, flexShrink: 0 }}>VS</span>
              <span style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 500, fontSize: 14 }}>{m.awayTeam}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: '预测',
      key: 'predictions',
      width: 140,
      render: (_, record) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {record.matches.map((m, idx) => (
            <div key={m.no} style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '4px 0', borderTop: idx > 0 ? '1px dashed rgba(255,255,255,0.08)' : 'none' }}>
              {(!m.predictions || m.predictions.length === 0)
                ? <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>-</span>
                : m.predictions.map(p => <Tag key={p} color="blue" style={{ margin: 0 }}>{p}</Tag>)
              }
            </div>
          ))}
        </div>
      ),
    },
    {
      title: '实际赛果',
      key: 'result',
      width: 200,
      render: (_, record) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {record.matches.map((m, idx) => {
            const key = `${record.date}-${m.no}`;
            const hasResult = !!m.actualResult;
            const isHit = hasResult && m.predictions.includes(m.actualResult);
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderTop: idx > 0 ? '1px dashed rgba(255,255,255,0.08)' : 'none' }}>
                {savingKey === key ? (
                  <Spin size="small" />
                ) : (
                  <>
                    <Select
                      value={hasResult ? m.actualResult : undefined}
                      placeholder="录入"
                      onChange={(val) => handleSaveResult(record.date, m.no, m.homeTeam, m.awayTeam, val)}
                      size="small"
                      style={{ width: 80 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {RESULT_OPTIONS.map(r => (
                        <Option key={r} value={r}>{r}</Option>
                      ))}
                    </Select>
                    {hasResult && (
                      <>
                        <Tag color={resultColorMap[m.actualResult] || '#666'} style={{ margin: 0 }}>{m.actualResult}</Tag>
                        <Tag color={isHit ? 'success' : 'error'} style={{ margin: 0 }}>{isHit ? '命中' : '未中'}</Tag>
                      </>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ),
    },
    {
      title: '当天',
      key: 'dayStatus',
      width: 90,
      render: (_, record) => {
        const allHaveResult = record.matches.length > 0 && record.matches.every(m => m.actualResult);
        if (!allHaveResult) {
          return <Tag style={{ fontSize: 12 }}>待录入</Tag>;
        }
        const allHit = record.matches.every(m => m.actualResult && m.predictions?.includes(m.actualResult));
        return (
          <Tag color={allHit ? 'success' : 'error'} style={{ fontSize: 13, padding: '2px 10px' }}>
            {allHit ? '✓ 命中' : '✗ 未中'}
          </Tag>
        );
      },
    },
  ];

  return (
    <div>
      {/* 标题 */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ padding: 8, background: 'rgba(22,163,74,0.2)', borderRadius: 8 }}>
            <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>每日精选</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
              数据来源：球之见精选 · 共 {allPicks.length} 天
            </div>
          </div>
        </div>

        {/* 近7天命中率 */}
        {hitRate && (() => {
          const { hitDays, totalDays, rate } = hitRate;
          const pct = (rate * 100).toFixed(1);
          const color = rate >= 0.7 ? '#16a34a' : rate >= 0.4 ? '#fbbf24' : '#f87171';
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 20px', background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>近7天命中率</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
                  {hitDays}/{totalDays}天命中
                </div>
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, color, lineHeight: 1 }}>{pct}%</div>
            </div>
          );
        })()}
      </div>

      {/* 表格 */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <Table
          columns={columns}
          dataSource={rows}
          rowKey="key"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `共 ${total} 天`,
          }}
          scroll={{ x: 800 }}
          size="middle"
          style={{ background: 'transparent' }}
        />
      </div>
    </div>
  );
}

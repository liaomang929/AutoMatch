import { useState, useEffect } from 'react';
import { Table, Button, message, Tag, Space, Card, Statistic, Row, Col, Alert } from 'antd';
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
    try {
      message.loading({ content: '正在抓取500彩票网数据，请稍候...', key: 'scrape', duration: 0 });
      const res = await scrapeMatches();
      message.success({ content: `成功抓取 ${res.count} 场比赛`, key: 'scrape' });
      const scrapedMatches = res.data || [];
      setMatches(scrapedMatches);
      // 仅刷新selected数据，不覆盖matches
      try {
        const matchRes = await getMatches(date);
        setSelected(matchRes.data?.selected || []);
      } catch (e) {
        // 忽略，selected数据可能还没保存
      }
    } catch (e) {
      message.error({ content: `抓取失败: ${e.message}`, key: 'scrape' });
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

  const columns = [
    {
      title: '#',
      dataIndex: 'index',
      key: 'index',
      width: 50,
      render: (text) => <span style={{ fontWeight: 600 }}>{text}</span>
    },
    {
      title: '编号',
      dataIndex: 'matchId',
      key: 'matchId',
      width: 100,
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '赛事',
      dataIndex: 'league',
      key: 'league',
      width: 80,
      render: (text) => <Tag color="orange">{text || '-'}</Tag>
    },
    {
      title: '主队',
      dataIndex: 'homeTeam',
      key: 'homeTeam',
      width: 120,
      render: (text) => <span style={{ fontWeight: 500 }}>{text || '-'}</span>
    },
    {
      title: '客队',
      dataIndex: 'awayTeam',
      key: 'awayTeam',
      width: 120,
      render: (text) => <span style={{ fontWeight: 500 }}>{text || '-'}</span>
    },
    {
      title: '比赛时间',
      dataIndex: 'matchTime',
      key: 'matchTime',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: '胜',
      dataIndex: 'oddsWin',
      key: 'oddsWin',
      width: 65,
      render: (text) => <span style={{ color: '#cf1322' }}>{text || '-'}</span>
    },
    {
      title: '平',
      dataIndex: 'oddsDraw',
      key: 'oddsDraw',
      width: 60,
      render: (text) => <span style={{ color: '#722ed1' }}>{text || '-'}</span>
    },
    {
      title: '负',
      dataIndex: 'oddsLoss',
      key: 'oddsLoss',
      width: 65,
      render: (text) => <span style={{ color: '#1890ff' }}>{text || '-'}</span>
    },
    {
      title: '让步',
      dataIndex: 'handicapLine',
      key: 'handicapLine',
      width: 60,
      render: (text) => text ? <Tag color="green">{text}</Tag> : '-'
    },
    {
      title: '让胜',
      dataIndex: 'handicapWin',
      key: 'handicapWin',
      width: 65,
      render: (text) => <span style={{ color: '#cf1322' }}>{text || '-'}</span>
    },
    {
      title: '让平',
      dataIndex: 'handicapDraw',
      key: 'handicapDraw',
      width: 60,
      render: (text) => <span style={{ color: '#722ed1' }}>{text || '-'}</span>
    },
    {
      title: '让负',
      dataIndex: 'handicapLoss',
      key: 'handicapLoss',
      width: 65,
      render: (text) => <span style={{ color: '#1890ff' }}>{text || '-'}</span>
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => {
        const isSelected = selectedIds.includes(record.matchId);
        return (
          <Button
            size="small"
            type={isSelected ? 'primary' : 'default'}
            icon={<CheckCircleOutlined />}
            onClick={() => toggleSelect(record)}
          >
            {isSelected ? '已选' : '选择'}
          </Button>
        );
      }
    },
    {
      title: '状态',
      key: 'status',
      width: 80,
      fixed: 'right',
      render: (_, record) => 
        selectedIds.includes(record.matchId) 
          ? <Tag color="gold">已选</Tag> 
          : <Tag>待选</Tag>
    }
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={6}>
            <Statistic title="今日比赛总数" value={matches.length} suffix="场" />
          </Col>
          <Col span={6}>
            <Statistic title="已选重点比赛" value={selected.length} suffix="场" />
          </Col>
          <Col span={12}>
            <Space>
              <Button 
                type="primary" 
                icon={<DownloadOutlined />} 
                onClick={handleScrape}
                loading={loading}
                size="large"
              >
                抓取今日比赛数据
              </Button>
              <Button
                icon={<StarOutlined />}
                onClick={handleAutoSelect}
              >
                智能推荐
              </Button>
              <Button
                type="primary"
                onClick={handleSave}
                loading={saving}
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
              >
                保存选择
              </Button>
            </Space>
          </Col>
        </Row>
        {selected.length > 0 && (
          <Alert 
            style={{ marginTop: 12 }}
            message={`已选 ${selected.length} 场（建议选 ${getRecommendCount()} 场），点击「保存选择」后可在「选场预测」中录入预测`} 
            type="info" 
            showIcon 
          />
        )}
      </Card>
      
      <Table
        columns={columns}
        dataSource={matches}
        rowKey="matchId"
        pagination={false}
        scroll={{ x: 1400 }}
        rowClassName={(record) => selectedIds.includes(record.matchId) ? 'selected-row' : ''}
        size="middle"
      />

      <style>{`
        .selected-row {
          background-color: #fff7e6 !important;
        }
        .selected-row:hover > td {
          background-color: #ffe7ba !important;
        }
      `}</style>
    </div>
  );
}

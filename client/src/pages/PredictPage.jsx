import { useState, useEffect } from 'react';
import { Table, Button, message, Tag, Space, Card, Modal, Form, Select, Rate, Input, Switch, Row, Col, Alert, Checkbox, Tag as AntTag } from 'antd';
import { CheckCircleOutlined, StarOutlined, FireOutlined, PlusOutlined } from '@ant-design/icons';
import { getMatches, saveSelected, savePrediction } from '../api';

const { TextArea } = Input;
const { Option } = Select;

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

  const columns = [
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
      title: '对阵',
      key: 'matchup',
      width: 200,
      render: (_, r) => (
        <span>
          <strong>{r.homeTeam || '-'}</strong>
          <span style={{ margin: '0 8px', color: '#999' }}>VS</span>
          <strong>{r.awayTeam || '-'}</strong>
        </span>
      )
    },
    {
      title: '比赛时间',
      dataIndex: 'matchTime',
      key: 'matchTime',
      width: 120,
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
      width: 65,
      render: (text) => text ? <Tag color="green">{text}</Tag> : '-'
    },
    {
      title: '预测',
      key: 'predict',
      width: 120,
      render: (_, record) => (
        <Button 
          size="small"
          type={record.prediction ? 'primary' : 'default'}
          onClick={() => openPredict(record)}
          icon={<StarOutlined />}
        >
          {record.prediction ? '已预测' : '录入预测'}
        </Button>
      )
    },
    {
      title: '热门',
      key: 'hot',
      width: 60,
      render: (_, record) => (
        record.isHot ? <FireOutlined style={{ color: '#ff4d4f', fontSize: 18 }} /> : '-'
      )
    }
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Alert 
              message={`建议选择 ${getRecommendCount()} 场重点比赛（当前已选 ${selected.length} 场）`} 
              type="info" 
              showIcon 
            />
          </Col>
          <Col span={16} style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={handleAutoSelect} icon={<StarOutlined />}>
                智能推荐
              </Button>
              <Button type="primary" onClick={handleSave} loading={loading}>
                保存选择
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={selected}
        rowKey="matchId"
        pagination={false}
        scroll={{ x: 1100 }}
        size="middle"
        locale={{ emptyText: '暂无已选比赛，请先在「赛事数据」页面选择重点比赛' }}
      />

      <Modal
        title={`预测 - ${currentMatch?.homeTeam} VS ${currentMatch?.awayTeam}`}
        open={predictModal}
        onOk={handleSavePrediction}
        onCancel={() => setPredictModal(false)}
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="prediction" label="预测结果" rules={[{ required: true, message: '请至少选择一个预测结果' }]}>
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[8, 8]}>
                <Col span={8}>
                  <Checkbox value="胜" style={{ width: '100%' }}>
                    <Space>
                      <AntTag color="red">胜</AntTag>
                      {currentMatch?.oddsWin && <span style={{ color: '#999', fontSize: 12 }}>{currentMatch.oddsWin}</span>}
                    </Space>
                  </Checkbox>
                </Col>
                <Col span={8}>
                  <Checkbox value="平" style={{ width: '100%' }}>
                    <Space>
                      <AntTag color="purple">平</AntTag>
                      {currentMatch?.oddsDraw && <span style={{ color: '#999', fontSize: 12 }}>{currentMatch.oddsDraw}</span>}
                    </Space>
                  </Checkbox>
                </Col>
                <Col span={8}>
                  <Checkbox value="负" style={{ width: '100%' }}>
                    <Space>
                      <AntTag color="blue">负</AntTag>
                      {currentMatch?.oddsLoss && <span style={{ color: '#999', fontSize: 12 }}>{currentMatch.oddsLoss}</span>}
                    </Space>
                  </Checkbox>
                </Col>
                <Col span={8}>
                  <Checkbox value="让胜" style={{ width: '100%' }}>
                    <Space>
                      <AntTag color="green">让胜</AntTag>
                      {currentMatch?.handicapWin && <span style={{ color: '#999', fontSize: 12 }}>{currentMatch.handicapWin}</span>}
                    </Space>
                  </Checkbox>
                </Col>
                <Col span={8}>
                  <Checkbox value="让平" style={{ width: '100%' }}>
                    <Space>
                      <AntTag color="orange">让平</AntTag>
                      {currentMatch?.handicapDraw && <span style={{ color: '#999', fontSize: 12 }}>{currentMatch.handicapDraw}</span>}
                    </Space>
                  </Checkbox>
                </Col>
                <Col span={8}>
                  <Checkbox value="让负" style={{ width: '100%' }}>
                    <Space>
                      <AntTag color="cyan">让负</AntTag>
                      {currentMatch?.handicapLoss && <span style={{ color: '#999', fontSize: 12 }}>{currentMatch.handicapLoss}</span>}
                    </Space>
                  </Checkbox>
                </Col>
              </Row>
            </Checkbox.Group>
          </Form.Item>
          
          <Form.Item name="confidence" label="信心指数">
            <Rate count={5} />
          </Form.Item>
          
          <Form.Item name="isHot" label="热门比赛" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          
          <Form.Item name="analysisNote" label="分析笔记">
            <TextArea rows={3} placeholder="写下你的分析思路..." />
          </Form.Item>
          
          <Form.Item label="快捷填入">
            <Space wrap>
              <Button size="small" onClick={() => {
                const note = form.getFieldValue('analysisNote') || '';
                form.setFieldValue('analysisNote', note + (note ? '，' : '') + '盘口合理');
              }}>盘口合理</Button>
              <Button size="small" onClick={() => {
                const note = form.getFieldValue('analysisNote') || '';
                form.setFieldValue('analysisNote', note + (note ? '，' : '') + '基本面符合盘口');
              }}>基本面符合盘口</Button>
              <Button size="small" onClick={() => {
                const note = form.getFieldValue('analysisNote') || '';
                form.setFieldValue('analysisNote', note + (note ? '，' : '') + '动态盘口变化合理');
              }}>动态盘口变化合理</Button>
              <Button size="small" onClick={() => {
                const note = form.getFieldValue('analysisNote') || '';
                form.setFieldValue('analysisNote', note + (note ? '，' : '') + '上盘可期');
              }}>上盘可期</Button>
              <Button size="small" onClick={() => {
                const note = form.getFieldValue('analysisNote') || '';
                form.setFieldValue('analysisNote', note + (note ? '，' : '') + '下盘有机会');
              }}>下盘有机会</Button>
              <Button size="small" onClick={() => {
                const note = form.getFieldValue('analysisNote') || '';
                form.setFieldValue('analysisNote', note + (note ? '，' : '') + '数据走势看好主队');
              }}>数据走势看好主队</Button>
              <Button size="small" onClick={() => {
                const note = form.getFieldValue('analysisNote') || '';
                form.setFieldValue('analysisNote', note + (note ? '，' : '') + '客队状态更佳');
              }}>客队状态更佳</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>


    </div>
  );
}

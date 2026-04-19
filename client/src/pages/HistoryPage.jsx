import { useState, useEffect } from 'react';
import { Table, Card, DatePicker, Button, Space, Tag, message, Select, Modal, Typography, Row, Col } from 'antd';
import { SearchOutlined, HistoryOutlined, EditOutlined } from '@ant-design/icons';
import { getHistory, updateActualResult } from '../api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Paragraph } = Typography;

export default function HistoryPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [dateRange, setDateRange] = useState(null);
  const [resultModal, setResultModal] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [selectedResult, setSelectedResult] = useState('');

  useEffect(() => {
    loadData(1);
  }, []);

  const loadData = async (page = 1, pageSize = pagination.pageSize) => {
    setLoading(true);
    try {
      const params = { page, pageSize };
      if (dateRange && dateRange[0]) params.startDate = dateRange[0];
      if (dateRange && dateRange[1]) params.endDate = dateRange[1];
      
      const res = await getHistory(params);
      setRecords(res.data?.list || []);
      setPagination({
        current: res.data?.page || 1,
        pageSize: res.data?.pageSize || 10,
        total: res.data?.total || 0,
      });
    } catch (e) {
      console.error('加载历史记录失败', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadData(1);
  };

  const handleReset = () => {
    setDateRange(null);
    loadData(1);
  };

  const handleTableChange = (pag) => {
    loadData(pag.current, pag.pageSize);
  };

  const openResultModal = (record) => {
    setCurrentRecord(record);
    setSelectedResult(record.actualResult || '');
    setResultModal(true);
  };

  const handleSaveResult = async () => {
    if (!selectedResult) {
      message.warning('请选择实际结果');
      return;
    }
    try {
      await updateActualResult(currentRecord.date, currentRecord.matchId, selectedResult);
      message.success('实际结果已保存');
      setResultModal(false);
      loadData(pagination.current);
    } catch (e) {
      message.error(`保存失败: ${e.message}`);
    }
  };

  const predictionMap = { '主胜': '胜', '平局': '平', '客胜': '负' };
  const resultColorMap = { '胜': '#cf1322', '平': '#722ed1', '负': '#1890ff' };

  const columns = [
    {
      title: '选场日期',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (text) => <strong>{text}</strong>
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
          <strong>{r.homeTeam}</strong>
          <span style={{ margin: '0 8px', color: '#999' }}>VS</span>
          <strong>{r.awayTeam}</strong>
        </span>
      )
    },
    {
      title: '预测结果',
      dataIndex: 'prediction',
      key: 'prediction',
      width: 90,
      render: (text) => {
        if (!text) return '-';
        const label = predictionMap[text] || text;
        return <Tag color="blue">{label}</Tag>;
      }
    },
    {
      title: '信心',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 70,
      render: (val) => val ? '⭐'.repeat(Math.min(val, 5)) : '-'
    },
    {
      title: '实际结果',
      dataIndex: 'actualResult',
      key: 'actualResult',
      width: 120,
      render: (text, record) => {
        if (text) {
          const color = resultColorMap[text] || '#666';
          // 与预测对比
          const predLabel = predictionMap[record.prediction] || record.prediction;
          const isCorrect = predLabel === text;
          return (
            <Space>
              <Tag color={color}>{text}</Tag>
              {isCorrect !== undefined && predLabel && (
                <Tag color={isCorrect ? 'success' : 'error'}>
                  {isCorrect ? '命中' : '未中'}
                </Tag>
              )}
            </Space>
          );
        }
        return (
          <Button size="small" icon={<EditOutlined />} onClick={() => openResultModal(record)}>
            录入
          </Button>
        );
      }
    },
    {
      title: '我的分析逻辑',
      dataIndex: 'analysisNote',
      key: 'analysisNote',
      width: 250,
      render: (text) => text ? (
        <Paragraph ellipsis={{ rows: 2, expandable: true, symbol: '展开' }} style={{ marginBottom: 0 }}>
          {text}
        </Paragraph>
      ) : '-'
    },
    {
      title: 'AI分析',
      dataIndex: 'aiAnalysis',
      key: 'aiAnalysis',
      width: 200,
      render: (text) => text ? (
        <Paragraph ellipsis={{ rows: 2, expandable: true, symbol: '展开' }} style={{ marginBottom: 0, color: '#666' }}>
          {text}
        </Paragraph>
      ) : '-'
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Space>
              <span style={{ color: '#666' }}>日期范围:</span>
              <RangePicker 
                value={dateRange ? [dayjs(dateRange[0]), dayjs(dateRange[1])] : null}
                onChange={(dates, dateStrings) => {
                  setDateRange(dates ? dateStrings : null);
                }}
                style={{ width: 260 }}
              />
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                查询
              </Button>
              <Button onClick={handleReset}>
                重置
              </Button>
            </Space>
          </Col>
          <Col flex="auto" style={{ textAlign: 'right' }}>
            <Space>
              <HistoryOutlined style={{ color: '#999' }} />
              <span style={{ color: '#666' }}>共 {pagination.total} 条记录</span>
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={records}
        rowKey={(r) => `${r.date}-${r.matchId}`}
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showQuickJumper: true,
          pageSizeOptions: ['5', '10', '20', '50'],
          showTotal: (total) => `共 ${total} 条`,
        }}
        onChange={handleTableChange}
        scroll={{ x: 1100 }}
        size="middle"
      />

      <Modal
        title={`录入实际结果 - ${currentRecord?.homeTeam} VS ${currentRecord?.awayTeam}`}
        open={resultModal}
        onOk={handleSaveResult}
        onCancel={() => setResultModal(false)}
        width={400}
      >
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: '#666', marginBottom: 12 }}>
            预测: <Tag color="blue">{predictionMap[currentRecord?.prediction] || currentRecord?.prediction || '未预测'}</Tag>
          </p>
          <p style={{ marginBottom: 8 }}>请选择实际比赛结果:</p>
          <Select 
            value={selectedResult} 
            onChange={setSelectedResult}
            style={{ width: '100%' }}
            size="large"
          >
            <Option value="胜"><Tag color="#cf1322">胜</Tag> 主队获胜</Option>
            <Option value="平"><Tag color="#722ed1">平</Tag> 双方打平</Option>
            <Option value="负"><Tag color="#1890ff">负</Tag> 客队获胜</Option>
          </Select>
        </div>
      </Modal>
    </div>
  );
}

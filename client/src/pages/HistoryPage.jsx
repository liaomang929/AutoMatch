import { useState, useEffect } from 'react';
import { Table, DatePicker, Button, Space, Tag, message, Select, Modal, Typography } from 'antd';
import { SearchOutlined, HistoryOutlined, EditOutlined } from '@ant-design/icons';
import { getHistory, updateActualResult } from '../api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Paragraph } = Typography;

const card = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
};

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

  const handleSearch = () => loadData(1);
  const handleReset = () => { setDateRange(null); loadData(1); };
  const handleTableChange = (pag) => loadData(pag.current, pag.pageSize);

  const openResultModal = (record) => {
    setCurrentRecord(record);
    setSelectedResult(record.actualResult || '');
    setResultModal(true);
  };

  const handleSaveResult = async () => {
    if (!selectedResult) { message.warning('请选择实际结果'); return; }
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
  const resultColorMap = { '胜': '#cf1322', '平': '#722ed1', '负': '#1890ff', '让胜': '#16a34a', '让平': '#d97706', '让负': '#0891b2' };

  // 判断预测是否命中：预测可能是数组或字符串，只要包含实际结果即为命中
  const checkHit = (prediction, actualResult) => {
    if (!prediction || !actualResult) return null;
    const preds = Array.isArray(prediction) ? prediction : [prediction];
    // 兼容旧格式映射
    const normalizedPreds = preds.map(p => predictionMap[p] || p);
    return normalizedPreds.includes(actualResult);
  };

  const columns = [
    {
      title: '选场日期',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (text) => <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{text}</span>
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
          <span style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 500 }}>{r.homeTeam}</span>
          <span style={{ margin: '0 8px', color: 'rgba(255,255,255,0.3)' }}>VS</span>
          <span style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 500 }}>{r.awayTeam}</span>
        </span>
      )
    },
    {
      title: '预测结果',
      dataIndex: 'prediction',
      key: 'prediction',
      width: 110,
      render: (text) => {
        if (!text) return <span style={{ color: 'rgba(255,255,255,0.3)' }}>-</span>;
        const preds = Array.isArray(text) ? text : [text];
        return (
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {preds.map(p => <Tag key={p} color="blue">{predictionMap[p] || p}</Tag>)}
          </span>
        );
      }
    },
    {
      title: '信心指数',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 110,
      render: (val) => val ? <span style={{ color: '#fbbf24', letterSpacing: 2 }}>{'★'.repeat(Math.min(val, 5))}</span> : <span style={{ color: 'rgba(255,255,255,0.3)' }}>-</span>
    },
    {
      title: '实际结果',
      dataIndex: 'actualResult',
      key: 'actualResult',
      width: 130,
      render: (text, record) => {
        if (text) {
          const color = resultColorMap[text] || '#666';
          const isCorrect = checkHit(record.prediction, text);
          return (
            <Space>
              <Tag color={color}>{text}</Tag>
              {isCorrect !== null && (
                <Tag color={isCorrect ? 'success' : 'error'}>{isCorrect ? '命中' : '未中'}</Tag>
              )}
            </Space>
          );
        }
        return (
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openResultModal(record)}
            style={{ borderColor: 'rgba(129,140,248,0.5)', color: '#a5b4fc', background: 'rgba(129,140,248,0.1)' }}
          >
            录入
          </Button>
        );
      }
    }
  ];

  return (
    <div>
      {/* 搜索栏 */}
      <div style={{ ...card, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>日期范围:</span>
            <RangePicker
              value={dateRange ? [dayjs(dateRange[0]), dayjs(dateRange[1])] : null}
              onChange={(dates, dateStrings) => setDateRange(dates ? dateStrings : null)}
              style={{ width: 260 }}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleSearch}
              style={{ background: '#818cf8', borderColor: '#818cf8' }}
            >
              查询
            </Button>
            <Button
              onClick={handleReset}
              style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)' }}
            >
              重置
            </Button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
            <HistoryOutlined />
            <span>共 {pagination.total} 条记录</span>
          </div>
        </div>
      </div>

      {/* 表格 */}
      <div style={{ ...card, overflow: 'hidden' }}>
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
          style={{ background: 'transparent' }}
          onRow={() => ({
            style: {
              background: 'transparent',
            }
          })}
        />
      </div>

      {/* 录入结果弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, background: 'rgba(129,140,248,0.2)', borderRadius: 8 }}>
              <EditOutlined style={{ color: '#a5b4fc' }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'rgba(255,255,255,0.92)' }}>录入实际结果</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                {currentRecord?.homeTeam} VS {currentRecord?.awayTeam}
              </div>
            </div>
          </div>
        }
        open={resultModal}
        onOk={handleSaveResult}
        onCancel={() => setResultModal(false)}
        width={420}
        styles={{
          content: {
            background: 'rgba(12,10,35,0.97)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            backdropFilter: 'blur(24px)',
          },
          header: { background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.08)' },
          body: { padding: '20px 0' },
          footer: { display: 'none' },
          mask: { backdropFilter: 'blur(4px)' },
        }}
        footer={null}
      >
        <div style={{ padding: '0 24px' }}>
          <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: 10 }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>预测结果</div>
            <Tag color="blue">
              {predictionMap[currentRecord?.prediction] || currentRecord?.prediction || '未预测'}
            </Tag>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 10 }}>请选择实际比赛结果:</div>
            <Select
              value={selectedResult}
              onChange={setSelectedResult}
              style={{ width: '100%' }}
              size="large"
              placeholder="选择结果"
            >
              <Option value="胜"><Tag color="#cf1322">胜</Tag> 主队获胜</Option>
              <Option value="平"><Tag color="#722ed1">平</Tag> 双方打平</Option>
              <Option value="负"><Tag color="#1890ff">负</Tag> 客队获胜</Option>
              <Option value="让胜"><Tag color="#cf1322">让胜</Tag> 让球胜</Option>
              <Option value="让平"><Tag color="#722ed1">让平</Tag> 让球平</Option>
              <Option value="让负"><Tag color="#1890ff">让负</Tag> 让球负</Option>
            </Select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <Button
              onClick={() => setResultModal(false)}
              style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}
            >
              取消
            </Button>
            <Button
              type="primary"
              onClick={handleSaveResult}
              style={{ background: '#818cf8', borderColor: '#818cf8' }}
            >
              保存结果
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

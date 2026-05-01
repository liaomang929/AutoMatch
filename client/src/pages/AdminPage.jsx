import { useState, useEffect } from 'react';
import { Table, Button, Input, Select, message, Tag, Modal, Form, InputNumber } from 'antd';
import { PlusOutlined, CopyOutlined, DeleteOutlined, UserOutlined, KeyOutlined, ReloadOutlined } from '@ant-design/icons';
import { adminGenerateCodes, adminGetCodes, adminGetUsers, adminDeleteCode } from '../api';

const { Option } = Select;

const card = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
};

export default function AdminPage() {
  const [tab, setTab] = useState('codes');
  const [codes, setCodes] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [genModal, setGenModal] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [newCodes, setNewCodes] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => { loadCodes(); loadUsers(); }, []);

  const loadCodes = async () => {
    setLoadingCodes(true);
    try { const res = await adminGetCodes(); setCodes(res.data); } catch (e) { message.error(e.message); }
    finally { setLoadingCodes(false); }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try { const res = await adminGetUsers(); setUsers(res.data); } catch (e) { message.error(e.message); }
    finally { setLoadingUsers(false); }
  };

  const handleGenerate = async (values) => {
    setGenLoading(true);
    try {
      const res = await adminGenerateCodes(values.days, values.count, values.note);
      setNewCodes(res.data.codes);
      message.success(`成功生成 ${res.data.codes.length} 个授权码`);
      loadCodes();
    } catch (e) {
      message.error(e.message);
    } finally {
      setGenLoading(false);
    }
  };

  const handleDelete = async (code) => {
    try {
      await adminDeleteCode(code);
      message.success('已删除');
      loadCodes();
    } catch (e) {
      message.error(e.message);
    }
  };

  const copyAll = () => {
    navigator.clipboard.writeText(newCodes.join('\n'));
    message.success('已复制所有授权码');
  };

  const getAuthStatus = (user) => {
    const now = new Date();
    const trialExpire = new Date(user.trial_expire_at);
    const licExpire = user.license_expire_at ? new Date(user.license_expire_at) : null;
    if (licExpire && licExpire > now) return { label: '授权中', color: 'success', expire: licExpire };
    if (trialExpire > now) return { label: '试用中', color: 'warning', expire: trialExpire };
    return { label: '已过期', color: 'error', expire: trialExpire };
  };

  const codeColumns = [
    { title: '授权码', dataIndex: 'code', key: 'code', render: (v) => <span style={{ fontFamily: 'monospace', color: '#a5b4fc', fontWeight: 500 }}>{v}</span> },
    { title: '天数', dataIndex: 'days', key: 'days', width: 80, render: (v) => <span style={{ color: '#fbbf24' }}>{v}天</span> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v) => <Tag color={v === 'unused' ? 'blue' : v === 'active' ? 'success' : 'default'}>{v === 'unused' ? '未使用' : v === 'active' ? '已激活' : '已过期'}</Tag> },
    { 
      title: '使用用户', 
      key: 'user', 
      render: (_, r) => {
        const boundUser = users.find(u => (u.id || u._id) === r.user_id);
        if (boundUser) {
          return (
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500 }}>
              {boundUser.phone || boundUser.nickname || '未知用户'}
            </span>
          );
        }
        return r.user_id ? 
          <span style={{ color: 'rgba(255,255,255,0.45)' }}>ID: {r.user_id}</span> : 
          <span style={{ color: 'rgba(255,255,255,0.25)' }}>-</span>;
      } 
    },
    { title: '到期时间', dataIndex: 'expire_at', key: 'expire_at', render: (v) => v ? new Date(v).toLocaleDateString('zh-CN') : '-' },
    { title: '备注', dataIndex: 'note', key: 'note', render: (v) => <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{v || '-'}</span> },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (v) => new Date(v).toLocaleDateString('zh-CN') },
    {
      title: '操作', key: 'action', width: 80,
      render: (_, r) => r.status === 'unused' ? (
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.code)} style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#f87171', background: 'rgba(239,68,68,0.1)' }} />
      ) : null
    },
  ];

  const userColumns = [
    { title: '用户', key: 'user', render: (_, r) => <div><div style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 500 }}>{r.nickname}</div><div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{r.phone || r.email}</div></div> },
    { title: '角色', dataIndex: 'role', key: 'role', width: 90, render: (v) => <Tag color={v === 'admin' ? 'purple' : 'blue'}>{v === 'admin' ? '管理员' : '用户'}</Tag> },
    {
      title: '授权状态', key: 'status', render: (_, r) => {
        const s = getAuthStatus(r);
        return <div><Tag color={s.color}>{s.label}</Tag><div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>到期: {new Date(s.expire).toLocaleDateString('zh-CN')}</div></div>;
      }
    },
    { title: '注册时间', dataIndex: 'created_at', key: 'created_at', render: (v) => new Date(v).toLocaleDateString('zh-CN') },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...card, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'rgba(255,255,255,0.92)' }}>管理后台</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>共 {users.length} 个用户 · {codes.filter(c => c.status === 'unused').length} 个未使用授权码</div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {[{ key: 'codes', label: '授权码管理', icon: <KeyOutlined /> }, { key: 'users', label: '用户列表', icon: <UserOutlined /> }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: tab === t.key ? '1px solid rgba(129,140,248,0.5)' : '1px solid rgba(255,255,255,0.1)', background: tab === t.key ? 'rgba(129,140,248,0.15)' : 'transparent', color: tab === t.key ? '#a5b4fc' : 'rgba(255,255,255,0.55)', cursor: 'pointer', fontSize: 14 }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'codes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setNewCodes([]); form.resetFields(); setGenModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#818cf8', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
              <PlusOutlined /> 生成授权码
            </button>
            <button onClick={loadCodes} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 14 }}>
              <ReloadOutlined /> 刷新
            </button>
          </div>
          <div style={{ ...card, overflow: 'hidden' }}>
            <Table columns={codeColumns} dataSource={codes} rowKey="id" loading={loadingCodes} size="middle" pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }} />
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <Table columns={userColumns} dataSource={users} rowKey="id" loading={loadingUsers} size="middle" pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 个用户` }} />
        </div>
      )}

      <Modal
        title={<span style={{ color: 'rgba(255,255,255,0.92)', fontSize: 16 }}>生成授权码</span>}
        open={genModal}
        onCancel={() => setGenModal(false)}
        footer={null}
        width={480}
        styles={{
          content: { background: 'rgba(12,10,35,0.97)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, backdropFilter: 'blur(24px)' },
          header: { background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.08)' },
          body: { padding: '20px 0' },
          mask: { backdropFilter: 'blur(4px)' },
        }}
      >
        <div style={{ padding: '0 24px' }}>
          {newCodes.length > 0 ? (
            <div>
              <div style={{ fontSize: 14, color: '#4ade80', marginBottom: 12 }}>✅ 生成成功！</div>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                {newCodes.map(c => (
                  <div key={c} style={{ fontFamily: 'monospace', fontSize: 16, color: '#a5b4fc', letterSpacing: 2, marginBottom: 8, fontWeight: 500 }}>{c}</div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={copyAll} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 8, border: 'none', background: '#818cf8', color: '#fff', cursor: 'pointer', fontSize: 14 }}>
                  <CopyOutlined /> 复制全部
                </button>
                <button onClick={() => { setNewCodes([]); form.resetFields(); }} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 14 }}>
                  继续生成
                </button>
              </div>
            </div>
          ) : (
            <Form form={form} layout="vertical" onFinish={handleGenerate}>
              <Form.Item label={<span style={{ color: 'rgba(255,255,255,0.7)' }}>有效天数</span>} name="days" rules={[{ required: true }]}>
                <Select size="large" placeholder="选择有效期" style={{ width: '100%' }}>
                  <Option value={7}>7天 </Option>
                  <Option value={180}>180天（半年卡）</Option>
                  <Option value={365}>365天（年卡）</Option>
                </Select>
              </Form.Item>
              <Form.Item label={<span style={{ color: 'rgba(255,255,255,0.7)' }}>生成数量</span>} name="count" initialValue={1} rules={[{ required: true }]}>
                <InputNumber min={1} max={50} size="large" style={{ width: '100%', background: 'rgba(0,0,0,0.25)', borderColor: 'rgba(255,255,255,0.12)' }} />
              </Form.Item>
              <Form.Item label={<span style={{ color: 'rgba(255,255,255,0.7)' }}>备注（可选）</span>} name="note">
                <Input placeholder="如：张三 月卡" size="large" style={{ background: 'rgba(0,0,0,0.25)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.82)' }} />
              </Form.Item>
              <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
                <button type="button" onClick={() => setGenModal(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 14 }}>取消</button>
                <Button type="primary" htmlType="submit" loading={genLoading} style={{ flex: 1, height: 42, borderRadius: 8, background: '#818cf8', borderColor: '#818cf8', fontSize: 14 }}>生成</Button>
              </div>
            </Form>
          )}
        </div>
      </Modal>
    </div>
  );
}
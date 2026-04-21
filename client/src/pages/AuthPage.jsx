import { useState } from 'react';
import { Form, Input, Button, message, Tabs } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, TrophyOutlined } from '@ant-design/icons';
import { authLogin, authRegister } from '../api';

const bgImage = 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=90';

export default function AuthPage({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('login');
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();

  const handleLogin = async (values) => {
    setLoading(true);
    try {
      const res = await authLogin(values.email, values.password);
      localStorage.setItem('auth_token', res.data.token);
      localStorage.setItem('auth_user', JSON.stringify(res.data.user));
      localStorage.setItem('auth_info', JSON.stringify(res.data.auth));
      message.success('登录成功');
      onLogin(res.data.user, res.data.auth);
    } catch (e) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values) => {
    setLoading(true);
    try {
      const res = await authRegister(values.email, values.password, values.nickname);
      localStorage.setItem('auth_token', res.data.token);
      localStorage.setItem('auth_user', JSON.stringify(res.data.user));
      const auth = { authorized: true, isTrial: true, expireAt: res.data.user.trialExpireAt };
      localStorage.setItem('auth_info', JSON.stringify(auth));
      message.success('注册成功，已获得3天免费试用！');
      onLogin(res.data.user, auth);
    } catch (e) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: 'rgba(0,0,0,0.3)',
    borderColor: 'rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.88)',
    borderRadius: 8,
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundImage: `url(${bgImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: 420,
        background: 'rgba(12,10,35,0.92)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20,
        padding: '40px 36px',
        backdropFilter: 'blur(24px)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, background: 'rgba(129,140,248,0.2)', borderRadius: 16, marginBottom: 16 }}>
            <TrophyOutlined style={{ fontSize: 28, color: '#a5b4fc' }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: 'rgba(255,255,255,0.95)', margin: 0 }}>球之见</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>从购彩新手到逻辑玩家的知识变现之路</p>
        </div>

        <Tabs
          activeKey={tab}
          onChange={setTab}
          centered
          items={[
            {
              key: 'login',
              label: '登录',
              children: (
                <Form form={loginForm} layout="vertical" onFinish={handleLogin} style={{ marginTop: 16 }}>
                  <Form.Item name="email" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
                    <Input
                      prefix={<MailOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
                      placeholder="邮箱"
                      size="large"
                      style={inputStyle}
                    />
                  </Form.Item>
                  <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                    <Input.Password
                      prefix={<LockOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
                      placeholder="密码"
                      size="large"
                      style={inputStyle}
                    />
                  </Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    size="large"
                    block
                    style={{ background: '#818cf8', borderColor: '#818cf8', borderRadius: 8, height: 44, fontSize: 15, fontWeight: 500, marginTop: 8 }}
                  >
                    登录
                  </Button>
                  <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
                    还没有账号？<span style={{ color: '#a5b4fc', cursor: 'pointer' }} onClick={() => setTab('register')}>免费注册</span>
                  </div>
                </Form>
              )
            },
            {
              key: 'register',
              label: '注册',
              children: (
                <Form form={registerForm} layout="vertical" onFinish={handleRegister} style={{ marginTop: 16 }}>
                  <Form.Item name="email" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
                    <Input
                      prefix={<MailOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
                      placeholder="邮箱"
                      size="large"
                      style={inputStyle}
                    />
                  </Form.Item>
                  <Form.Item name="nickname" rules={[{ required: true, message: '请输入昵称' }]}>
                    <Input
                      prefix={<UserOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
                      placeholder="昵称"
                      size="large"
                      style={inputStyle}
                    />
                  </Form.Item>
                  <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少6位' }]}>
                    <Input.Password
                      prefix={<LockOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
                      placeholder="密码（至少6位）"
                      size="large"
                      style={inputStyle}
                    />
                  </Form.Item>
                  <Form.Item name="confirm" dependencies={['password']} rules={[
                    { required: true, message: '请确认密码' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value) return Promise.resolve();
                        return Promise.reject(new Error('两次密码不一致'));
                      }
                    })
                  ]}>
                    <Input.Password
                      prefix={<LockOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
                      placeholder="确认密码"
                      size="large"
                      style={inputStyle}
                    />
                  </Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    size="large"
                    block
                    style={{ background: '#818cf8', borderColor: '#818cf8', borderRadius: 8, height: 44, fontSize: 15, fontWeight: 500, marginTop: 4 }}
                  >
                    注册并获得3天免费试用
                  </Button>
                  <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
                    已有账号？<span style={{ color: '#a5b4fc', cursor: 'pointer' }} onClick={() => setTab('login')}>立即登录</span>
                  </div>
                </Form>
              )
            }
          ]}
        />
      </div>
    </div>
  );
}

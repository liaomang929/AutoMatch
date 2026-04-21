import { useState, useEffect } from 'react';
import { ConfigProvider, theme, message, Modal, Input, Button, Tag } from 'antd';
import {
  TrophyOutlined, AimOutlined, RobotOutlined, FileTextOutlined,
  SettingOutlined, HistoryOutlined, LogoutOutlined, KeyOutlined,
  UserOutlined, CrownOutlined, WarningOutlined, StarOutlined
} from '@ant-design/icons';

import MatchDataPage from './pages/MatchDataPage';
import PredictPage from './pages/PredictPage';
import AIAnalysisPage from './pages/AIAnalysisPage';
import ArticlePage from './pages/ArticlePage';
import ConfigPage from './pages/ConfigPage';
import HistoryPage from './pages/HistoryPage';
import AdminPage from './pages/AdminPage';
import AuthPage from './pages/AuthPage';
import PicksPage from './pages/PicksPage';
import { authStatus, authActivate } from './api';

const bgImage = 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=90';

function App() {
  const [currentPage, setCurrentPage] = useState('1');
  const [user, setUser] = useState(null);
  const [authInfo, setAuthInfo] = useState(null);
  const [checking, setChecking] = useState(true);
  const [activateModal, setActivateModal] = useState(false);
  const [activateCode, setActivateCode] = useState('');
  const [activateLoading, setActivateLoading] = useState(false);

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) { setChecking(false); return; }
    try {
      const res = await authStatus();
      setUser(res.data.user);
      setAuthInfo(res.data.auth);
    } catch {
      localStorage.removeItem('auth_token');
    } finally {
      setChecking(false);
    }
  };

  const handleLogin = (u, auth) => { setUser(u); setAuthInfo(auth); };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_info');
    setUser(null); setAuthInfo(null); setCurrentPage('1');
  };

  const handleActivate = async () => {
    if (!activateCode.trim()) { message.warning('请输入授权码'); return; }
    setActivateLoading(true);
    try {
      const res = await authActivate(activateCode.trim());
      message.success(res.data.message);
      setActivateModal(false); setActivateCode('');
      checkAuth();
    } catch (e) { message.error(e.message); }
    finally { setActivateLoading(false); }
  };

  const menuItems = [
    { key: '1', icon: <TrophyOutlined />, label: '赛事数据' },
    { key: '2', icon: <AimOutlined />, label: '选场预测' },
    { key: '3', icon: <RobotOutlined />, label: '辅助分析' },
    { key: '4', icon: <FileTextOutlined />, label: '文案制作' },
    { key: '5', icon: <HistoryOutlined />, label: '历史记录' },
    { key: '6', icon: <SettingOutlined />, label: '模型配置' },
    { key: '8', icon: <StarOutlined />, label: '球之见精选' },
    ...(user?.role === 'admin' ? [{ key: '7', icon: <CrownOutlined />, label: '管理后台' }] : []),
  ];

  const renderPage = () => {
    if (!authInfo?.authorized) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 500, color: 'rgba(255,255,255,0.88)', marginBottom: 8 }}>账号已过期</h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 24 }}>请联系管理员获取授权码以继续使用</p>
          <button onClick={() => setActivateModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 10, border: 'none', background: '#818cf8', color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 500 }}>
            <KeyOutlined /> 输入授权码
          </button>
        </div>
      );
    }
    try {
      switch (currentPage) {
        case '1': return <MatchDataPage />;
        case '2': return <PredictPage />;
        case '3': return <AIAnalysisPage />;
        case '4': return <ArticlePage />;
        case '5': return <HistoryPage />;
        case '6': return <ConfigPage />;
        case '7': return <AdminPage />;
        case '8': return <PicksPage user={user} />;
        default: return <MatchDataPage />;
      }
    } catch (e) { return <div style={{ padding: 20, color: 'red' }}>页面加载错误: {e.message}</div>; }
  };

  const getDaysLeft = () => {
    if (!authInfo?.expireAt) return 0;
    return Math.max(0, Math.ceil((new Date(authInfo.expireAt) - new Date()) / (1000 * 3600 * 24)));
  };

  if (checking) {
    return <div style={{ minHeight: '100vh', background: '#0c0a23', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: 'rgba(255,255,255,0.4)' }}>加载中...</span></div>;
  }

  if (!user) return <AuthPage onLogin={handleLogin} />;

  const daysLeft = getDaysLeft();
  const expiringSoon = daysLeft <= 3 && authInfo?.authorized;

  return (
    <ConfigProvider theme={{
      algorithm: theme.darkAlgorithm,
      token: { colorPrimary: '#818cf8', colorText: 'rgba(255,255,255,0.88)', colorTextBase: 'rgba(255,255,255,0.88)', colorBgLayout: 'transparent', colorBgContainer: 'rgba(20,18,50,0.75)', colorBorder: 'rgba(255,255,255,0.12)', borderRadius: 8, fontFamily: '"Microsoft YaHei", "微软雅黑", "PingFang SC", "Helvetica Neue", Arial, sans-serif', fontSize: 14 },
      components: { Button: { fontSize: 14, fontWeight: 500, paddingInline: 16, paddingBlock: 6 }, Card: { colorBgContainer: 'rgba(20,18,50,0.7)' }, Table: { colorBgContainer: 'rgba(20,18,50,0.7)' }, Menu: { itemColor: 'rgba(255,255,255,0.6)', itemHoverColor: 'rgba(255,255,255,0.95)', itemSelectedColor: '#a5b4fc', itemSelectedBg: 'rgba(129,140,248,0.15)', itemBg: 'transparent' } }
    }}>
      <div className="min-h-screen font-sans" style={{ backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', backgroundRepeat: 'no-repeat' }}>

        {/* 即将过期提醒条 */}
        {expiringSoon && (
          <div style={{ background: 'rgba(251,146,60,0.15)', borderBottom: '1px solid rgba(251,146,60,0.3)', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <WarningOutlined style={{ color: '#fb923c' }} />
            <span style={{ fontSize: 13, color: '#fb923c' }}>账号将在 <strong>{daysLeft}</strong> 天后到期，请联系管理员续费</span>
            <button onClick={() => setActivateModal(true)} style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(251,146,60,0.4)', background: 'rgba(251,146,60,0.15)', color: '#fb923c', cursor: 'pointer', fontSize: 12 }}>输入授权码</button>
          </div>
        )}

        {/* 顶部导航栏 */}
        <header style={{ position: 'sticky', top: 0, zIndex: 50, borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '12px 24px', background: 'rgba(10,8,30,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(129,140,248,0.25)' }}>
              <TrophyOutlined style={{ fontSize: 20, color: '#a5b4fc' }} />
            </div>
            <span style={{ fontSize: 17, fontWeight: 500, color: 'rgba(255,255,255,0.92)' }}>球之见-让每一场比赛都有逻辑可循</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {authInfo?.isTrial && <Tag color="orange" style={{ fontSize: 12, margin: 0 }}>试用 {daysLeft}天</Tag>}
            {authInfo?.authorized && !authInfo?.isTrial && <Tag color="success" style={{ fontSize: 12, margin: 0 }}>授权 {daysLeft}天</Tag>}
            {!authInfo?.authorized && <Tag color="error" style={{ fontSize: 12, margin: 0 }}>已过期</Tag>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <UserOutlined style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }} />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{user.nickname}</span>
              {user.role === 'admin' && <CrownOutlined style={{ color: '#fbbf24', fontSize: 13 }} />}
            </div>
            <button onClick={() => setActivateModal(true)} title="输入授权码" style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
              <KeyOutlined style={{ fontSize: 14 }} />
            </button>
            <button onClick={handleLogout} title="退出登录" style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
              <LogoutOutlined style={{ fontSize: 14 }} />
            </button>
          </div>
        </header>

        <div style={{ display: 'flex' }}>
          {/* 侧边栏 */}
          <aside style={{ width: 220, borderRight: '1px solid rgba(255,255,255,0.07)', minHeight: 'calc(100vh - 57px)', position: 'sticky', top: 57, background: 'rgba(10,8,30,0.82)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', flexShrink: 0 }}>
            <nav style={{ padding: '12px 10px' }}>
              {menuItems.map((item) => (
                <button key={item.key} onClick={() => setCurrentPage(item.key)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 2, fontSize: 14, transition: 'all 0.15s ease', background: currentPage === item.key ? 'rgba(129,140,248,0.2)' : 'transparent', color: currentPage === item.key ? '#a5b4fc' : 'rgba(255,255,255,0.55)', fontWeight: currentPage === item.key ? 500 : 400, borderLeft: currentPage === item.key ? '2px solid #818cf8' : '2px solid transparent' }}
                  onMouseEnter={e => { if (currentPage !== item.key) { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.88)'; } }}
                  onMouseLeave={e => { if (currentPage !== item.key) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; } }}
                >
                  <span style={{ fontSize: 15 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </aside>

          {/* 主内容 */}
          <main style={{ flex: 1, padding: 20, minWidth: 0 }}>
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
              <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', padding: 24, minHeight: 'calc(100vh - 100px)', background: 'rgba(12,10,35,0.82)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>
                {renderPage()}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* 授权码弹窗 */}
      <Modal
        title={<span style={{ color: 'rgba(255,255,255,0.92)' }}>输入授权码</span>}
        open={activateModal}
        onCancel={() => { setActivateModal(false); setActivateCode(''); }}
        footer={null} width={400}
        styles={{ content: { background: 'rgba(12,10,35,0.97)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, backdropFilter: 'blur(24px)' }, header: { background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.08)' }, body: { padding: '20px 0' }, mask: { backdropFilter: 'blur(4px)' } }}
      >
        <div style={{ padding: '0 24px' }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>请输入管理员给你的授权码（格式：XXXX-XXXX-XXXX）</p>
          <Input value={activateCode} onChange={e => setActivateCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX" size="large" maxLength={14} style={{ fontFamily: 'monospace', fontSize: 16, letterSpacing: 2, background: 'rgba(0,0,0,0.25)', borderColor: 'rgba(255,255,255,0.15)', color: '#a5b4fc', borderRadius: 8, marginBottom: 16 }} onPressEnter={handleActivate} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setActivateModal(false); setActivateCode(''); }} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 14 }}>取消</button>
            <Button type="primary" loading={activateLoading} onClick={handleActivate} style={{ flex: 1, height: 42, borderRadius: 8, background: '#818cf8', borderColor: '#818cf8', fontSize: 14 }}>激活</Button>
          </div>
        </div>
      </Modal>
    </ConfigProvider>
  );
}

export default App;

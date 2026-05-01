import { useState, useEffect } from 'react';
import { ConfigProvider, theme, message, Modal, Input, Button, Tag } from 'antd';
import { TrophyOutlined, AimOutlined, RobotOutlined, FileTextOutlined, SettingOutlined, HistoryOutlined, LogoutOutlined, KeyOutlined, UserOutlined, CrownOutlined, WarningOutlined, StarOutlined, CheckCircleOutlined } from '@ant-design/icons';
import MatchDataPage from './pages/MatchDataPage';
import PredictPage from './pages/PredictPage';
import AIAnalysisPage from './pages/AIAnalysisPage';
import ArticlePage from './pages/ArticlePage';
import ConfigPage from './pages/ConfigPage';
import HistoryPage from './pages/HistoryPage';
import AdminPage from './pages/AdminPage';
import AuthPage from './pages/AuthPage';
import PicksPage from './pages/PicksPage';
import DailySelectPage from './pages/DailySelectPage';
import { authStatus, authActivate } from './api';
import bgImage from './assets/bg.png';
//const bgImage = 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=90';

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
      
      // 核心修复：强制拦截试用状态。如果是试用，authorized 设为 false
      let finalAuth = res.data.auth;
      if (finalAuth.isTrial) {
        finalAuth = { ...finalAuth, authorized: false, isTrial: false };
      }
      setAuthInfo(finalAuth);
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
      // 核心修复：显式传递用户 ID 给后端，确保数据库中授权码能正确绑定到该用户
      const res = await authActivate(activateCode.trim(), user?._id || user?.id);
      message.success(res.data.message);
      setActivateModal(false); setActivateCode('');
      checkAuth(); // 激活后刷新状态
    } catch (e) { message.error(e.message); }
    finally { setActivateLoading(false); }
  };

  const renderPage = () => {
    if (!authInfo?.authorized) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 500, color: 'rgba(255,255,255,0.88)', marginBottom: 8 }}>账号未激活</h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 24 }}>请输入授权码以激活使用权限</p>
          <button onClick={() => setActivateModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 10, border: 'none', background: '#818cf8', color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 500 }}>
            <KeyOutlined /> 输入授权码
          </button>
        </div>
      );
    }
    switch (currentPage) {
      case '1': return <MatchDataPage />;
      case '2': return <PredictPage />;
      case '3': return <AIAnalysisPage />;
      case '4': return <ArticlePage />;
      case '5': return <HistoryPage />;
      case '6': return <ConfigPage />;
      case '7': return <AdminPage />;
      case '8': return <PicksPage user={user} />;
      case '9': return <DailySelectPage />;
      default: return <MatchDataPage />;
    }
  };

  const getDaysLeft = () => {
    if (!authInfo?.expireAt) return 0;
    return Math.max(0, Math.ceil((new Date(authInfo.expireAt) - new Date()) / (1000 * 3600 * 24)));
  };

  if (checking) return <div style={{ minHeight: '100vh', background: '#0c0a23' }} />;
  if (!user) return <AuthPage onLogin={handleLogin} />;

  const daysLeft = getDaysLeft();

  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
      <div style={{ 
        minHeight: '100vh', 
        backgroundImage: `linear-gradient(rgba(15, 12, 46, 0.6), rgba(15, 12, 46, 0.6)), url(${bgImage})`, 
        backgroundSize: 'cover', 
        backgroundPosition: 'center', 
        display: 'flex', 
        flexDirection: 'column' 
      }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 50, padding: '12px 24px', background: 'rgba(10,8,30,0.92)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <TrophyOutlined style={{ fontSize: 20, color: '#a5b4fc' }} />
            <span style={{ fontSize: 17, color: 'rgba(255,255,255,0.92)' }}>球之见-球场迷雾，由此可见！</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {authInfo?.authorized ? <Tag color="success">正式授权 ({daysLeft}天)</Tag> : <Tag color="error">未授权</Tag>}
            <div style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.07)', borderRadius: 8 }}><span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{user.nickname}</span></div>
            <button onClick={() => setActivateModal(true)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.06)', cursor: 'pointer' }}><KeyOutlined style={{ color: 'rgba(255,255,255,0.5)' }} /></button>
            <button onClick={handleLogout} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.06)', cursor: 'pointer' }}><LogoutOutlined style={{ color: 'rgba(255,255,255,0.5)' }} /></button>
          </div>
        </header>
        <div style={{ display: 'flex' }}>
          <aside style={{ width: 220, background: 'rgba(10,8,30,0.82)', backdropFilter: 'blur(24px)', minHeight: 'calc(100vh - 57px)' }}>
            <nav style={{ padding: '12px 10px' }}>
              {[ { key: '1', icon: <TrophyOutlined />, label: '赛事数据' }, { key: '2', icon: <AimOutlined />, label: '选场预测' }, { key: '3', icon: <RobotOutlined />, label: '辅助分析' }, { key: '4', icon: <FileTextOutlined />, label: '文案制作' }, { key: '5', icon: <HistoryOutlined />, label: '历史记录' }, { key: '6', icon: <SettingOutlined />, label: '模型配置' }, { key: '8', icon: <StarOutlined />, label: '球之见精选' }, ...(user?.role === 'admin' ? [{ key: '7', icon: <CrownOutlined />, label: '管理后台' }, { key: '9', icon: <CheckCircleOutlined />, label: '每日精选' }] : []) ].map((item) => (
                <button key={item.key} onClick={() => setCurrentPage(item.key)} style={{ width: '100%', padding: '10px 14px', background: currentPage === item.key ? 'rgba(129,140,248,0.2)' : 'transparent', color: currentPage === item.key ? '#a5b4fc' : 'rgba(255,255,255,0.55)', border: 'none', textAlign: 'left', borderRadius: 8, cursor: 'pointer', marginBottom: 2 }}>{item.icon} <span style={{ marginLeft: 8 }}>{item.label}</span></button>
              ))}
            </nav>
          </aside>
          <main style={{ flex: 1, padding: 20 }}><div style={{ maxWidth: 1200, margin: '0 auto', background: 'rgba(12,10,35,0.82)', borderRadius: 16, padding: 24, minHeight: 'calc(100vh - 100px)' }}>{renderPage()}</div></main>
        </div>
      </div>
      <Modal title="输入授权码" open={activateModal} onCancel={() => setActivateModal(false)} footer={null}>
        <Input value={activateCode} onChange={e => setActivateCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX" size="large" style={{ marginBottom: 16 }} />
        <Button type="primary" block loading={activateLoading} onClick={handleActivate}>激活</Button>
      </Modal>
    </ConfigProvider>
  );
}

export default App;
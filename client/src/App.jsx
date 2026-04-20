import { useState } from 'react';
import { ConfigProvider, theme } from 'antd';
import {
  TrophyOutlined,
  AimOutlined,
  RobotOutlined,
  FileTextOutlined,
  SettingOutlined,
  HistoryOutlined
} from '@ant-design/icons';

import MatchDataPage from './pages/MatchDataPage';
import PredictPage from './pages/PredictPage';
import AIAnalysisPage from './pages/AIAnalysisPage';
import ArticlePage from './pages/ArticlePage';
import ConfigPage from './pages/ConfigPage';
import HistoryPage from './pages/HistoryPage';

const bgImage = 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=90';

function App() {
  const [currentPage, setCurrentPage] = useState('1');

  const menuItems = [
    { key: '1', icon: <TrophyOutlined />, label: '赛事数据' },
    { key: '2', icon: <AimOutlined />, label: '选场预测' },
    { key: '3', icon: <RobotOutlined />, label: '辅助分析' },
    { key: '4', icon: <FileTextOutlined />, label: '文案制作' },
    { key: '5', icon: <HistoryOutlined />, label: '历史记录' },
    { key: '6', icon: <SettingOutlined />, label: '模型配置' },
  ];

  const renderPage = () => {
    try {
      switch (currentPage) {
        case '1': return <MatchDataPage />;
        case '2': return <PredictPage />;
        case '3': return <AIAnalysisPage />;
        case '4': return <ArticlePage />;
        case '5': return <HistoryPage />;
        case '6': return <ConfigPage />;
        default: return <MatchDataPage />;
      }
    } catch (e) {
      return <div style={{padding: 20, color: 'red'}}>页面加载错误: {e.message}</div>;
    }
  };

  return (
    <ConfigProvider theme={{
      algorithm: theme.darkAlgorithm,
      token: {
        colorPrimary: '#818cf8',
        colorText: 'rgba(255,255,255,0.88)',
        colorTextBase: 'rgba(255,255,255,0.88)',
        colorBgLayout: 'transparent',
        colorBgContainer: 'rgba(20,18,50,0.75)',
        colorBorder: 'rgba(255,255,255,0.12)',
        borderRadius: 8,
        fontFamily: '"Microsoft YaHei", "微软雅黑", "PingFang SC", "Helvetica Neue", Arial, sans-serif',
        fontSize: 14,
      },
      components: {
        Button: {
          fontSize: 14,
          fontWeight: 500,
          paddingInline: 16,
          paddingBlock: 6,
        },
        Card: {
          colorBgContainer: 'rgba(20,18,50,0.7)',
        },
        Table: {
          colorBgContainer: 'rgba(20,18,50,0.7)',
        },
        Menu: {
          itemColor: 'rgba(255,255,255,0.6)',
          itemHoverColor: 'rgba(255,255,255,0.95)',
          itemSelectedColor: '#a5b4fc',
          itemSelectedBg: 'rgba(129,140,248,0.15)',
          itemBg: 'transparent',
        }
      }
    }}>
      <div className="min-h-screen font-sans" style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat'
      }}>
        {/* 顶部导航栏 */}
        <header style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          padding: '14px 24px',
          background: 'rgba(10, 8, 30, 0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}>
          <div className="flex items-center space-x-3">
            <div style={{padding: 8, borderRadius: 8, background: 'rgba(129,140,248,0.25)'}}>
              <TrophyOutlined style={{fontSize: 20, color: '#a5b4fc'}} />
            </div>
            <h1 style={{fontSize: 18, fontWeight: 500, color: 'rgba(255,255,255,0.95)', margin: 0, letterSpacing: '0.01em'}}>
              球之见-重塑赛事逻辑，预见胜负先机
            </h1>
          </div>
        </header>

        <div className="flex">
          {/* 侧边栏菜单 */}
          <aside style={{
            width: 220,
            borderRight: '1px solid rgba(255,255,255,0.07)',
            minHeight: 'calc(100vh - 57px)',
            position: 'sticky',
            top: 57,
            background: 'rgba(10, 8, 30, 0.82)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            flexShrink: 0,
          }}>
            <nav style={{padding: '12px 10px'}}>
              {menuItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setCurrentPage(item.key)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    marginBottom: 2,
                    fontSize: 14,
                    transition: 'all 0.15s ease',
                    background: currentPage === item.key ? 'rgba(129,140,248,0.2)' : 'transparent',
                    color: currentPage === item.key ? '#a5b4fc' : 'rgba(255,255,255,0.55)',
                    fontWeight: currentPage === item.key ? 500 : 400,
                    borderLeft: currentPage === item.key ? '2px solid #818cf8' : '2px solid transparent',
                  }}
                  onMouseEnter={e => {
                    if (currentPage !== item.key) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                      e.currentTarget.style.color = 'rgba(255,255,255,0.88)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (currentPage !== item.key) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'rgba(255,255,255,0.55)';
                    }
                  }}
                >
                  <span style={{fontSize: 15}}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </aside>

          {/* 主内容区域 */}
          <main style={{flex: 1, padding: 20, minWidth: 0}}>
            <div style={{maxWidth: 1200, margin: '0 auto'}}>
              <div style={{
                borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.08)',
                padding: 24,
                minHeight: 'calc(100vh - 100px)',
                background: 'rgba(12, 10, 35, 0.82)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
              }}>
                {renderPage()}
              </div>
            </div>
          </main>
        </div>
      </div>
    </ConfigProvider>
  );
}

export default App;

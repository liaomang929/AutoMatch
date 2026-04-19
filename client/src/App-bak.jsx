import { useState } from 'react';
import bgImage from './assets/bg.png';  // 加这行
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
      algorithm: theme.defaultAlgorithm,
      token: {
        colorPrimary: '#3b82f6', // 蓝色主色调，更柔和
        colorText: '#1f2937',
        colorTextBase: '#1f2937',
        colorBgLayout: '#f8f9fa',
        colorBgContainer: '#ffffff',
        colorBorder: '#e5e7eb',
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
        Menu: {
          itemColor: '#6b7280',
          itemHoverColor: '#3b82f6',
          itemSelectedColor: '#3b82f6',
          itemSelectedBg: '#eff6ff',
          itemBg: '#ffffff',
        }
      }
    }}>
      <div className="min-h-screen font-sans" style={{ backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', backgroundRepeat: 'no-repeat' }}>
        {/* 顶部导航栏 */}
        <header className="sticky top-0 z-50 border-b border-white/30 px-6 py-4" style={{background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(12px)'}}>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <TrophyOutlined className="text-xl text-blue-600" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 tracking-tight">
              球之见——从购彩新手到逻辑玩家的知识变现之路
            </h1>
          </div>
        </header>

        <div className="flex">
          {/* 侧边栏菜单 */}
          <aside className="w-64 border-r border-white/30 min-h-[calc(100vh-80px)] sticky top-16" style={{background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(12px)'}}>
            <nav className="p-4 space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setCurrentPage(item.key)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    currentPage === item.key
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </aside>

          {/* 主内容区域 */}
          <main className="flex-1 p-6">
            <div className="max-w-7xl mx-auto">
              <div className="rounded-2xl border border-white/40 p-6 min-h-[calc(100vh-140px)]" style={{background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(16px)'}}>
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

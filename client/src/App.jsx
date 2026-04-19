import { useState } from 'react';
import { Layout, Menu, ConfigProvider, theme } from 'antd';
import { 
  TrophyOutlined, 
  AimOutlined, 
  RobotOutlined, 
  FileTextOutlined,
  SettingOutlined,
  HistoryOutlined
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;

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
        colorPrimary: '#1677ff',
        borderRadius: 8,
      }
    }}>
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ 
          display: 'flex', 
          alignItems: 'center', 
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          padding: '0 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <TrophyOutlined style={{ fontSize: 28, color: '#fff', marginRight: 12 }} />
            <span style={{ color: '#fff', fontSize: 20, fontWeight: 700, letterSpacing: 2 }}>
              AutoMatch 足球赛事智能分析
            </span>
          </div>
        </Header>
        <Layout>
          <Sider width={180} style={{ background: '#fff' }}>
            <Menu
              mode="inline"
              selectedKeys={[currentPage]}
              items={menuItems}
              onClick={({ key }) => setCurrentPage(key)}
              style={{ height: '100%', borderRight: 0, paddingTop: 16 }}
            />
          </Sider>
          <Layout style={{ padding: '16px' }}>
            <Content style={{
              background: '#fff',
              padding: 24,
              borderRadius: 8,
              minHeight: 280,
            }}>
              {renderPage()}
            </Content>
          </Layout>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

export default App;

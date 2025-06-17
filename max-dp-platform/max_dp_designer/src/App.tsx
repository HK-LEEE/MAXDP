import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import koKR from 'antd/locale/ko_KR';
import 'antd/dist/reset.css';

// 컴포넌트 imports
import PrivateRoute from '@/components/PrivateRoute';
import LoginPage from '@/pages/LoginPage';
import WorkspaceDashboardPage from '@/pages/WorkspaceDashboardPage';
import FlowDesignerPage from '@/pages/FlowDesignerPage';
import FlowDataViewerPage from '@/pages/FlowDataViewerPage';
import MonitoringDashboardPage from '@/pages/MonitoringDashboardPage';

// Ant Design 테마 설정
const theme = {
  token: {
    colorPrimary: '#1890ff',
    borderRadius: 6,
  },
  components: {
    Layout: {
      siderBg: '#001529',
      triggerBg: '#002140',
    },
  },
};

const App: React.FC = () => {
  return (
    <ConfigProvider locale={koKR} theme={theme}>
      <Router>
        <Routes>
          {/* 공개 라우트 */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* 보호된 라우트들 */}
          <Route
            path="/workspaces"
            element={
              <PrivateRoute>
                <WorkspaceDashboardPage />
              </PrivateRoute>
            }
          />
          
          <Route
            path="/designer/:flowId"
            element={
              <PrivateRoute>
                <FlowDesignerPage />
              </PrivateRoute>
            }
          />
          
          <Route
            path="/viewer/:flowId"
            element={
              <PrivateRoute>
                <FlowDataViewerPage />
              </PrivateRoute>
            }
          />
          
          <Route
            path="/monitoring"
            element={
              <PrivateRoute>
                <MonitoringDashboardPage />
              </PrivateRoute>
            }
          />
          
          {/* 기본 리디렉션 */}
          <Route path="/" element={<Navigate to="/workspaces" replace />} />
          
          {/* 404 처리 */}
          <Route path="*" element={<Navigate to="/workspaces" replace />} />
        </Routes>
      </Router>
    </ConfigProvider>
  );
};

export default App; 
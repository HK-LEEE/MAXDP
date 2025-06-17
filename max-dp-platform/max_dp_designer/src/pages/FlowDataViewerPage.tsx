import React, { useState, useEffect } from 'react';
import { Layout, Typography, Button, Space, Table, Card, Tabs, Alert, Statistic, Row, Col } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

const FlowDataViewerPage: React.FC = () => {
  const navigate = useNavigate();
  const { flowId } = useParams<{ flowId: string }>();

  const [loading, setLoading] = useState(false);
  const [executionData, setExecutionData] = useState<any>(null);

  const handleBack = () => {
    navigate('/workspaces');
  };

  const refreshData = async () => {
    setLoading(true);
    // 실제로는 API에서 데이터를 가져올 것
    setTimeout(() => {
      setExecutionData({
        status: 'success',
        executionTime: '2.34초',
        processedRows: 1250,
        resultData: [
          { key: '1', name: 'John Doe', age: 32, city: 'New York', salary: 75000 },
          { key: '2', name: 'Jane Smith', age: 28, city: 'London', salary: 68000 },
          { key: '3', name: 'Bob Johnson', age: 35, city: 'Tokyo', salary: 82000 },
          { key: '4', name: 'Alice Brown', age: 30, city: 'Paris', salary: 71000 },
          { key: '5', name: 'Charlie Wilson', age: 27, city: 'Berlin', salary: 69000 },
        ],
        logs: [
          { timestamp: '2024-01-15 10:30:01', level: 'INFO', message: 'Flow 실행 시작' },
          { timestamp: '2024-01-15 10:30:02', level: 'INFO', message: 'Table Reader 노드 처리 중...' },
          { timestamp: '2024-01-15 10:30:03', level: 'INFO', message: '1250개 행 읽기 완료' },
          { timestamp: '2024-01-15 10:30:04', level: 'INFO', message: 'Filter 노드 처리 중...' },
          { timestamp: '2024-01-15 10:30:05', level: 'INFO', message: 'Flow 실행 완료' },
        ]
      });
      setLoading(false);
    }, 1000);
  };

  useEffect(() => {
    refreshData();
  }, [flowId]);

  const resultColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name', sorter: true },
    { title: 'Age', dataIndex: 'age', key: 'age', sorter: true },
    { title: 'City', dataIndex: 'city', key: 'city', filters: [
      { text: 'New York', value: 'New York' },
      { text: 'London', value: 'London' },
      { text: 'Tokyo', value: 'Tokyo' },
      { text: 'Paris', value: 'Paris' },
      { text: 'Berlin', value: 'Berlin' },
    ]},
    { 
      title: 'Salary', 
      dataIndex: 'salary', 
      key: 'salary', 
      sorter: true,
      render: (value: number) => `$${value.toLocaleString()}`
    },
  ];

  const logColumns = [
    { title: 'Time', dataIndex: 'timestamp', key: 'timestamp', width: 200 },
    { 
      title: 'Level', 
      dataIndex: 'level', 
      key: 'level', 
      width: 100,
      render: (level: string) => (
        <span style={{ 
          color: level === 'ERROR' ? '#ff4d4f' : level === 'WARN' ? '#fa8c16' : '#52c41a',
          fontWeight: 'bold'
        }}>
          {level}
        </span>
      )
    },
    { title: 'Message', dataIndex: 'message', key: 'message' },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
              워크스페이스로 돌아가기
            </Button>
            <Title level={4} style={{ margin: 0 }}>
              <EyeOutlined /> Flow 데이터 조회 - {flowId}
            </Title>
          </Space>
          <Space>
            <Button icon={<DownloadOutlined />}>
              CSV 다운로드
            </Button>
            <Button 
              type="primary" 
              icon={<ReloadOutlined />} 
              loading={loading}
              onClick={refreshData}
            >
              새로고침
            </Button>
          </Space>
        </div>
      </Header>
      
      <Content style={{ padding: '24px' }}>
        {executionData && (
          <>
            {/* 실행 통계 */}
            <Card style={{ marginBottom: 24 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic
                    title="실행 상태"
                    value={executionData.status === 'success' ? '성공' : '실패'}
                    valueStyle={{ 
                      color: executionData.status === 'success' ? '#3f8600' : '#cf1322' 
                    }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="실행 시간"
                    value={executionData.executionTime}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="처리된 행 수"
                    value={executionData.processedRows}
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="결과 행 수"
                    value={executionData.resultData.length}
                    valueStyle={{ color: '#fa8c16' }}
                  />
                </Col>
              </Row>
            </Card>

            {/* 탭 컨텐츠 */}
            <Card>
              <Tabs defaultActiveKey="1">
                <TabPane tab="실행 결과" key="1">
                  {executionData.status === 'success' ? (
                    <Table
                      dataSource={executionData.resultData}
                      columns={resultColumns}
                      pagination={{ 
                        pageSize: 10,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total, range) => 
                          `${range[0]}-${range[1]} of ${total} items`
                      }}
                      size="middle"
                      scroll={{ x: 800 }}
                    />
                  ) : (
                    <Alert
                      message="실행 실패"
                      description="Flow 실행 중 오류가 발생했습니다. 로그를 확인하세요."
                      type="error"
                      showIcon
                    />
                  )}
                </TabPane>
                
                <TabPane tab="실행 로그" key="2">
                  <Table
                    dataSource={executionData.logs}
                    columns={logColumns}
                    pagination={false}
                    size="small"
                    style={{ background: '#fafafa' }}
                  />
                </TabPane>
                
                <TabPane tab="Flow 구조" key="3">
                  <div style={{ 
                    background: '#f5f5f5', 
                    padding: '24px', 
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <Text type="secondary">
                      Flow 구조 시각화는 향후 구현될 예정입니다.
                      <br />
                      현재는 Designer에서 Flow 구조를 확인할 수 있습니다.
                    </Text>
                  </div>
                </TabPane>
              </Tabs>
            </Card>
          </>
        )}
      </Content>
    </Layout>
  );
};

export default FlowDataViewerPage; 
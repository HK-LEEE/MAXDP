import React, { useEffect, useState } from 'react';
import {
  Layout,
  Menu,
  Table,
  Button,
  Card,
  Typography,
  Space,
  Modal,
  Form,
  Input,
  message,
  Spin,
  Empty,
  Avatar,
  Tag
} from 'antd';
import {
  FolderOutlined,
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  UserOutlined,
  LogoutOutlined,
  DesktopOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/authStore';
import { useWorkspaces, useFlows } from '@/store/workspaceStore';
import type { Workspace, Flow } from '@/store/workspaceStore';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const WorkspaceDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const {
    workspaces,
    selectedWorkspace,
    isLoading: workspaceLoading,
    error: workspaceError,
    fetchWorkspaces,
    createWorkspace,
    selectWorkspace,
    clearError: clearWorkspaceError
  } = useWorkspaces();

  const {
    flows,
    isLoading: flowLoading,
    error: flowError,
    fetchFlows,
    createFlow,
    clearError: clearFlowError
  } = useFlows();

  const [collapsed, setCollapsed] = useState(false);
  const [workspaceModalVisible, setWorkspaceModalVisible] = useState(false);
  const [flowModalVisible, setFlowModalVisible] = useState(false);
  const [workspaceForm] = Form.useForm();
  const [flowForm] = Form.useForm();

  // 초기 데이터 로드
  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // 워크스페이스 선택 시 Flow 목록 로드
  useEffect(() => {
    if (selectedWorkspace) {
      fetchFlows(selectedWorkspace.id);
    }
  }, [selectedWorkspace, fetchFlows]);

  // 에러 처리
  useEffect(() => {
    if (workspaceError) {
      message.error(workspaceError);
      clearWorkspaceError();
    }
  }, [workspaceError, clearWorkspaceError]);

  useEffect(() => {
    if (flowError) {
      message.error(flowError);
      clearFlowError();
    }
  }, [flowError, clearFlowError]);

  // 워크스페이스 선택 핸들러
  const handleWorkspaceSelect = (workspace: Workspace) => {
    selectWorkspace(workspace);
  };

  // 워크스페이스 생성 핸들러
  const handleCreateWorkspace = async (values: { name: string; description?: string }) => {
    const success = await createWorkspace(values);
    if (success) {
      message.success('워크스페이스가 생성되었습니다.');
      setWorkspaceModalVisible(false);
      workspaceForm.resetFields();
    }
  };

  // Flow 생성 핸들러
  const handleCreateFlow = async (values: { name: string; description?: string }) => {
    if (!selectedWorkspace) {
      message.error('워크스페이스를 먼저 선택해주세요.');
      return;
    }

    const flowData = {
      ...values,
      workspace_id: selectedWorkspace.id,
    };

    const newFlow = await createFlow(flowData);
    if (newFlow) {
      message.success('Flow가 생성되었습니다.');
      setFlowModalVisible(false);
      flowForm.resetFields();
      // Designer로 이동
      navigate(`/designer/${newFlow.id}`);
    }
  };

  // 로그아웃 핸들러
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Flow 테이블 컬럼 정의
  const flowColumns = [
    {
      title: 'Flow 이름',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <FileTextOutlined style={{ color: '#1890ff' }} />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: '설명',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => text || '-',
    },
    {
      title: '생성일',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '수정일',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '상태',
      key: 'status',
      render: (record: Flow) => (
        <Tag color={record.latest_version_id ? 'green' : 'orange'}>
          {record.latest_version_id ? '저장됨' : '초안'}
        </Tag>
      ),
    },
    {
      title: '액션',
      key: 'actions',
      render: (record: Flow) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/designer/${record.id}`)}
          >
            Designer 열기
          </Button>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/viewer/${record.id}`)}
          >
            데이터 조회
          </Button>
        </Space>
      ),
    },
  ];

  // 워크스페이스 메뉴 아이템 생성
  const workspaceMenuItems = workspaces.map((workspace) => ({
    key: workspace.id,
    icon: <FolderOutlined />,
    label: workspace.name,
    onClick: () => handleWorkspaceSelect(workspace),
  }));

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 사이드바 */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={280}
      >
        {/* 사용자 정보 */}
        <div style={{ padding: '16px', borderBottom: '1px solid #434343' }}>
          <Space>
            <Avatar icon={<UserOutlined />} />
            {!collapsed && (
              <div>
                <Text style={{ color: 'white', display: 'block' }}>
                  {user?.username}
                </Text>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  MAX DP Designer
                </Text>
              </div>
            )}
          </Space>
        </div>

        {/* 네비게이션 메뉴 */}
        <Menu
          theme="dark"
          mode="inline"
          style={{ borderRight: 0, marginTop: 16 }}
          items={[
            {
              key: 'workspaces',
              icon: <DesktopOutlined />,
              label: '워크스페이스',
              disabled: true,
            },
            ...workspaceMenuItems,
            { type: 'divider' },
            {
              key: 'monitoring',
              icon: <BarChartOutlined />,
              label: '모니터링',
              onClick: () => navigate('/monitoring'),
            },
            {
              key: 'logout',
              icon: <LogoutOutlined />,
              label: '로그아웃',
              onClick: handleLogout,
            },
          ]}
        />

        {/* 워크스페이스 생성 버튼 */}
        {!collapsed && (
          <div style={{ padding: '16px' }}>
            <Button
              type="dashed"
              block
              icon={<PlusOutlined />}
              onClick={() => setWorkspaceModalVisible(true)}
              loading={workspaceLoading}
            >
              새 워크스페이스
            </Button>
          </div>
        )}
      </Sider>

      {/* 메인 콘텐츠 */}
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={3} style={{ margin: 0 }}>
              {selectedWorkspace ? selectedWorkspace.name : 'MAX DP Designer'}
            </Title>
            {selectedWorkspace && (
              <Text type="secondary">
                {selectedWorkspace.description}
              </Text>
            )}
          </div>
        </Header>

        <Content style={{ padding: '24px' }}>
          {selectedWorkspace ? (
            <Card
              title={
                <Space>
                  <FileTextOutlined />
                  <span>Flow 목록</span>
                </Space>
              }
              extra={
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setFlowModalVisible(true)}
                  loading={flowLoading}
                >
                  새 Flow 생성
                </Button>
              }
            >
              {flowLoading ? (
                <div style={{ textAlign: 'center', padding: '50px' }}>
                  <Spin size="large" />
                </div>
              ) : flows.length > 0 ? (
                <Table
                  dataSource={flows}
                  columns={flowColumns}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              ) : (
                <Empty
                  description="Flow가 없습니다"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setFlowModalVisible(true)}
                  >
                    첫 번째 Flow 생성하기
                  </Button>
                </Empty>
              )}
            </Card>
          ) : (
            <Card>
              <Empty
                description="워크스페이스를 선택해주세요"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Text type="secondary">
                  왼쪽 사이드바에서 워크스페이스를 선택하거나 새로 생성하세요.
                </Text>
              </Empty>
            </Card>
          )}
        </Content>
      </Layout>

      {/* 워크스페이스 생성 모달 */}
      <Modal
        title="새 워크스페이스 생성"
        open={workspaceModalVisible}
        onCancel={() => {
          setWorkspaceModalVisible(false);
          workspaceForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={workspaceForm}
          layout="vertical"
          onFinish={handleCreateWorkspace}
        >
          <Form.Item
            name="name"
            label="워크스페이스 이름"
            rules={[
              { required: true, message: '워크스페이스 이름을 입력해주세요!' },
              { min: 2, message: '이름은 최소 2자 이상이어야 합니다.' },
            ]}
          >
            <Input placeholder="워크스페이스 이름을 입력하세요" />
          </Form.Item>

          <Form.Item
            name="description"
            label="설명 (선택사항)"
          >
            <Input.TextArea
              rows={3}
              placeholder="워크스페이스에 대한 설명을 입력하세요"
            />
          </Form.Item>

          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setWorkspaceModalVisible(false)}>
                취소
              </Button>
              <Button type="primary" htmlType="submit" loading={workspaceLoading}>
                생성
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>

      {/* Flow 생성 모달 */}
      <Modal
        title="새 Flow 생성"
        open={flowModalVisible}
        onCancel={() => {
          setFlowModalVisible(false);
          flowForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={flowForm}
          layout="vertical"
          onFinish={handleCreateFlow}
        >
          <Form.Item
            name="name"
            label="Flow 이름"
            rules={[
              { required: true, message: 'Flow 이름을 입력해주세요!' },
              { min: 2, message: '이름은 최소 2자 이상이어야 합니다.' },
            ]}
          >
            <Input placeholder="Flow 이름을 입력하세요" />
          </Form.Item>

          <Form.Item
            name="description"
            label="설명 (선택사항)"
          >
            <Input.TextArea
              rows={3}
              placeholder="Flow에 대한 설명을 입력하세요"
            />
          </Form.Item>

          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setFlowModalVisible(false)}>
                취소
              </Button>
              <Button type="primary" htmlType="submit" loading={flowLoading}>
                생성 후 Designer 열기
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </Layout>
  );
};

export default WorkspaceDashboardPage; 
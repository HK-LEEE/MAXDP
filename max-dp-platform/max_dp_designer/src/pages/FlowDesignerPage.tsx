import React, { useState, useCallback, useEffect } from 'react';
import { Layout, Typography, Button, Space, Drawer, Card, Form, Input, Select, message, Collapse, Tag } from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  PlusOutlined,
  DatabaseOutlined,
  CodeOutlined,
  ExportOutlined,
  FunctionOutlined,
  BranchesOutlined,
  MergeOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useFlows } from '@/store/workspaceStore';
import { apiService } from '@/services/api';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;
const { Panel: CollapsePanel } = Collapse;

// 커스텀 노드 타입 정의
interface CustomNodeData {
  label: string;
  type: string;
  icon: React.ReactNode;
  color: string;
  config?: any;
}

// 노드 타입 정의
const nodeTypes = {
  // Data Source Nodes
  tableReader: {
    label: 'Table Reader',
    icon: <DatabaseOutlined />,
    color: '#52c41a',
    category: 'Data Sources'
  },
  customSQL: {
    label: 'Custom SQL',
    icon: <CodeOutlined />,
    color: '#1890ff',
    category: 'Data Sources'
  },
  fileInput: {
    label: 'File Input',
    icon: <ExportOutlined />,
    color: '#722ed1',
    category: 'Data Sources'
  },
  
  // Transform Nodes
  selectColumns: {
    label: 'Select Columns',
    icon: <FunctionOutlined />,
    color: '#fa8c16',
    category: 'Transformations'
  },
  filterRows: {
    label: 'Filter Rows',
    icon: <FunctionOutlined />,
    color: '#fa541c',
    category: 'Transformations'
  },
  groupAggregate: {
    label: 'Group & Aggregate',
    icon: <FunctionOutlined />,
    color: '#eb2f96',
    category: 'Transformations'
  },
  
  // Control Flow Nodes
  conditionalBranch: {
    label: 'Conditional Branch',
    icon: <BranchesOutlined />,
    color: '#13c2c2',
    category: 'Control Flow'
  },
  merge: {
    label: 'Merge',
    icon: <MergeOutlined />,
    color: '#2f54eb',
    category: 'Control Flow'
  },
  
  // Output Nodes
  tableWriter: {
    label: 'Table Writer',
    icon: <DatabaseOutlined />,
    color: '#f5222d',
    category: 'Data Sinks'
  }
};

// 초기 노드와 엣지
const initialNodes: Node[] = [
  {
    id: '1',
    type: 'default',
    position: { x: 100, y: 100 },
    data: { 
      label: '시작하려면 왼쪽에서 노드를 드래그하세요',
      type: 'start',
      icon: <PlayCircleOutlined />,
      color: '#1890ff'
    },
    style: {
      background: '#f0f9ff',
      border: '2px dashed #1890ff',
      borderRadius: '8px',
      padding: '10px'
    }
  }
];

const initialEdges: Edge[] = [];

const FlowDesignerPage: React.FC = () => {
  const navigate = useNavigate();
  const { flowId } = useParams<{ flowId: string }>();
  const { getFlow, saveFlowVersion } = useFlows();

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  // Flow 정보 로드
  useEffect(() => {
    if (flowId) {
      loadFlow();
    }
  }, [flowId]);

  const loadFlow = async () => {
    if (!flowId) return;
    
    try {
      const flow = await getFlow(flowId);
      if (flow && flow.flow_json) {
        const flowData = JSON.parse(flow.flow_json);
        if (flowData.nodes) setNodes(flowData.nodes);
        if (flowData.edges) setEdges(flowData.edges);
      }
    } catch (error) {
      console.error('Failed to load flow:', error);
      message.error('Flow 로드에 실패했습니다.');
    }
  };

  const handleBack = () => {
    navigate('/workspaces');
  };

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({
      ...params,
      animated: true,
      style: { stroke: '#1890ff', strokeWidth: 2 }
    }, eds));
  }, [setEdges]);

  // 노드 추가
  const addNode = (nodeType: string) => {
    const nodeConfig = nodeTypes[nodeType as keyof typeof nodeTypes];
    const newNode: Node = {
      id: `${nodeType}-${Date.now()}`,
      type: 'default',
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: {
        label: nodeConfig.label,
        type: nodeType,
        icon: nodeConfig.icon,
        color: nodeConfig.color
      },
      style: {
        background: '#ffffff',
        border: `2px solid ${nodeConfig.color}`,
        borderRadius: '8px',
        padding: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }
    };
    
    setNodes((nds) => [...nds, newNode]);
  };

  // 노드 선택 처리
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setDrawerVisible(true);
    form.setFieldsValue({
      label: node.data.label,
      type: node.data.type
    });
  }, [form]);

  // 노드 설정 저장
  const saveNodeConfig = (values: any) => {
    if (!selectedNode) return;

    setNodes((nds) =>
      nds.map((node) =>
        node.id === selectedNode.id
          ? {
              ...node,
              data: {
                ...node.data,
                label: values.label,
                config: values
              }
            }
          : node
      )
    );
    setDrawerVisible(false);
    message.success('노드 설정이 저장되었습니다.');
  };

  // Flow 저장
  const saveFlow = async () => {
    if (!flowId) return;
    
    setSaving(true);
    try {
      const flowData = {
        nodes: nodes,
        edges: edges,
        viewport: { x: 0, y: 0, zoom: 1 }
      };

      const success = await saveFlowVersion(flowId, flowData);
      if (success) {
        message.success('Flow가 저장되었습니다.');
      }
    } catch (error) {
      message.error('Flow 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // Flow 실행
  const executeFlow = async () => {
    if (!flowId) return;
    
    try {
      message.loading('Flow를 실행 중입니다...', 2);
      // 실제 실행 API 호출
      const response = await apiService.executeFlow('run-flow', {
        flow_id: flowId,
        nodes: nodes,
        edges: edges
      });
      
      if (response.success) {
        message.success('Flow가 성공적으로 실행되었습니다.');
      }
    } catch (error) {
      message.error('Flow 실행에 실패했습니다.');
    }
  };

  // 노드 라이브러리 카테고리별 그룹화
  const nodeCategories = Object.entries(nodeTypes).reduce((acc, [key, value]) => {
    const category = value.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push({ key, ...value });
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 헤더 */}
      <Header style={{ 
        background: '#fff', 
        padding: '0 24px', 
        borderBottom: '1px solid #f0f0f0',
        zIndex: 1000
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
              워크스페이스로 돌아가기
            </Button>
            <Title level={4} style={{ margin: 0 }}>
              Flow Designer - {flowId}
            </Title>
          </Space>
          <Space>
            <Button 
              type="default" 
              icon={<PlayCircleOutlined />} 
              onClick={executeFlow}
            >
              실행
            </Button>
            <Button 
              type="primary" 
              icon={<SaveOutlined />} 
              loading={saving}
              onClick={saveFlow}
            >
              저장
            </Button>
          </Space>
        </div>
      </Header>

      <Layout>
        {/* 노드 라이브러리 사이드바 */}
        <Sider 
          width={280} 
          style={{ 
            background: '#fafafa', 
            borderRight: '1px solid #f0f0f0',
            overflow: 'auto',
            height: 'calc(100vh - 64px)'
          }}
        >
          <div style={{ padding: '16px' }}>
            <Title level={5} style={{ marginBottom: 16 }}>
              <PlusOutlined /> 노드 라이브러리
            </Title>
            
            <Collapse defaultActiveKey={Object.keys(nodeCategories)} ghost>
              {Object.entries(nodeCategories).map(([category, nodes]) => (
                <CollapsePanel header={category} key={category}>
                  <Space direction="vertical" style={{ width: '100%' }} size="small">
                    {nodes.map((node) => (
                      <Card
                        key={node.key}
                        size="small"
                        hoverable
                        onClick={() => addNode(node.key)}
                        style={{ 
                          cursor: 'pointer',
                          border: `1px solid ${node.color}`,
                          borderRadius: '6px'
                        }}
                        bodyStyle={{ padding: '8px 12px' }}
                      >
                        <Space>
                          <span style={{ color: node.color, fontSize: '16px' }}>
                            {node.icon}
                          </span>
                          <Text style={{ fontSize: '12px' }}>{node.label}</Text>
                        </Space>
                      </Card>
                    ))}
                  </Space>
                </CollapsePanel>
              ))}
            </Collapse>
          </div>
        </Sider>

        {/* 메인 Flow Designer */}
        <Content style={{ position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            fitView
            style={{ background: '#f8f9fa' }}
          >
            <Controls position="top-right" />
            <MiniMap 
              position="bottom-right"
              style={{
                background: '#ffffff',
                border: '1px solid #e8e8e8',
                borderRadius: '8px'
              }}
            />
            <Background 
              variant={BackgroundVariant.Dots} 
              gap={20} 
              size={1}
              color="#e8e8e8"
            />
            
            {/* Flow 정보 패널 */}
            <Panel position="top-left">
              <Card 
                size="small" 
                style={{ 
                  minWidth: '200px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              >
                <Space direction="vertical" size="small">
                  <Text strong>Flow 정보</Text>
                  <div>
                    <Text type="secondary">노드: </Text>
                    <Tag color="blue">{nodes.length}</Tag>
                  </div>
                  <div>
                    <Text type="secondary">연결: </Text>
                    <Tag color="green">{edges.length}</Tag>
                  </div>
                </Space>
              </Card>
            </Panel>
          </ReactFlow>
        </Content>
      </Layout>

      {/* 노드 설정 Drawer */}
      <Drawer
        title={
          <Space>
            <SettingOutlined />
            노드 설정
          </Space>
        }
        placement="right"
        width={400}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
      >
        {selectedNode && (
          <Form
            form={form}
            layout="vertical"
            onFinish={saveNodeConfig}
          >
            <Form.Item name="label" label="노드 이름">
              <Input />
            </Form.Item>
            
            <Form.Item name="type" label="노드 타입">
              <Select disabled>
                <Select.Option value={selectedNode.data.type}>
                  {selectedNode.data.label}
                </Select.Option>
              </Select>
            </Form.Item>

            {/* 노드 타입별 추가 설정 필드 */}
            {selectedNode.data.type === 'tableReader' && (
              <>
                <Form.Item name="tableName" label="테이블 이름">
                  <Input placeholder="테이블 이름을 입력하세요" />
                </Form.Item>
                <Form.Item name="schema" label="스키마">
                  <Input placeholder="스키마 이름을 입력하세요" />
                </Form.Item>
              </>
            )}

            {selectedNode.data.type === 'customSQL' && (
              <Form.Item name="sqlQuery" label="SQL 쿼리">
                <Input.TextArea 
                  rows={6}
                  placeholder="SELECT * FROM table_name WHERE..."
                />
              </Form.Item>
            )}

            {selectedNode.data.type === 'filterRows' && (
              <>
                <Form.Item name="filterColumn" label="필터 컬럼">
                  <Input placeholder="컬럼 이름" />
                </Form.Item>
                <Form.Item name="filterOperator" label="연산자">
                  <Select>
                    <Select.Option value="equals">같음 (=)</Select.Option>
                    <Select.Option value="notEquals">같지 않음 (!=)</Select.Option>
                                         <Select.Option value="greater">큼 (&gt;)</Select.Option>
                                         <Select.Option value="less">작음 (&lt;)</Select.Option>
                    <Select.Option value="contains">포함</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item name="filterValue" label="필터 값">
                  <Input placeholder="비교할 값" />
                </Form.Item>
              </>
            )}

            <Form.Item>
              <Button type="primary" htmlType="submit" block>
                설정 저장
              </Button>
            </Form.Item>
          </Form>
        )}
      </Drawer>
    </Layout>
  );
};

export default FlowDesignerPage; 
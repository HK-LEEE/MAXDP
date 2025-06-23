import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Layout, Typography, Button, Space, Drawer, Card, Form, Input, Select, message, Collapse, Tag, Modal, Spin } from 'antd';
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
  MergeOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined
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
  Panel,
  NodeTypes
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '../styles/flow-designer.css';

import { useFlows } from '../store/workspaceStore';
import { apiService } from '../services/api';
import NodeConfigManager from '../components/NodeConfig/NodeConfigManager';
import CustomNode from '../components/FlowNodes/CustomNode';
import SelectColumnsNode from '../components/FlowNodes/SelectColumnsNode';
import { getNodePorts } from '../utils/nodePortUtils';

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

// 노드 카테고리 정의
const nodeCategories = {
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
  apiQuery: {
    label: 'API Query',
    icon: <CodeOutlined />,
    color: '#13c2c2',
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
  renameColumns: {
    label: 'Rename Columns',
    icon: <FunctionOutlined />,
    color: '#eb2f96',
    category: 'Transformations'
  },
  joinData: {
    label: 'Join Data',
    icon: <MergeOutlined />,
    color: '#722ed1',
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
  },
  fileWriter: {
    label: 'File Writer',
    icon: <ExportOutlined />,
    color: '#d46b08',
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
  const { getFlow, getFlowDefinition, saveFlowVersion, saveDraftFlowVersion, getDraftFlowVersion } = useFlows();

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nodeValidationStates, setNodeValidationStates] = useState<Record<string, { isValid: boolean; errorCount: number }>>({});
  const [form] = Form.useForm();


  // Custom node types
  const nodeTypes: NodeTypes = useMemo(() => ({
    custom: CustomNode,
    selectColumns: SelectColumnsNode,
  }), []);

  // 선택된 노드 가져오기
  const getSelectedNode = useCallback(() => {
    if (!selectedNodeId) return null;
    return nodes.find(n => n.id === selectedNodeId) || null;
  }, [selectedNodeId, nodes]);

  // Flow 정보 로드
  useEffect(() => {
    if (flowId) {
      loadFlow();
    }
  }, [flowId]);

  // 세션 스토리지에서 임시 저장된 노드 설정 로드
  useEffect(() => {
    const loadConfigs = () => {
      if (!flowId) return;
      
      try {
        const storageKey = `temp_node_configs_${flowId}`;
        const tempData = sessionStorage.getItem(storageKey);
        
        if (tempData) {
          const { configs, timestamp } = JSON.parse(tempData);
          
          // 1시간 이내의 데이터만 사용
          if (Date.now() - timestamp < 3600000) {
            setNodes((currentNodes) => 
              currentNodes.map((node) => {
                if (configs[node.id]) {
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      config: configs[node.id]
                    }
                  };
                }
                return node;
              })
            );
            
            console.log('Temporary node configs loaded from session storage');
            message.info('임시 저장된 노드 설정을 복원했습니다.');
          } else {
            // 오래된 데이터 삭제
            sessionStorage.removeItem(storageKey);
          }
        }
      } catch (error) {
        console.error('Failed to load temp configs:', error);
      }
    };

    if (flowId && nodes.length > 0) {
      loadConfigs();
    }
  }, [flowId, nodes.length, setNodes]);

  // 간단한 임시 저장 (백업용)
  useEffect(() => {
    if (!flowId || nodes.length === 0) return;
    
    const saveConfigs = () => {
      try {
        const nodeConfigs = nodes.reduce((acc, node) => {
          if (node.data.config) {
            acc[node.id] = node.data.config;
          }
          return acc;
        }, {} as Record<string, any>);
        
        const storageKey = `temp_node_configs_${flowId}`;
        sessionStorage.setItem(storageKey, JSON.stringify({
          configs: nodeConfigs,
          timestamp: Date.now()
        }));
        
        console.log('Node configs backed up to session storage');
      } catch (error) {
        console.error('Failed to backup configs:', error);
      }
    };

    // 1초 후 백업 (성능상 이유로 debounce)
    const timeoutId = setTimeout(saveConfigs, 1000);
    return () => clearTimeout(timeoutId);
  }, [nodes, flowId]);




  // nodeclick 이벤트 리스너 추가 (노드 미리보기에서 노드 클릭 시)
  useEffect(() => {
    const handleNodeClick = (event: CustomEvent) => {
      const nodeId = event.detail.nodeId;
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        // config가 없으면 빈 객체로 초기화
        if (!node.data.config) {
          setNodes((currentNodes) => 
            currentNodes.map((n) => {
              if (n.id === nodeId) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    config: {}
                  }
                };
              }
              return n;
            })
          );
        }
        setSelectedNodeId(nodeId);
        setDrawerVisible(true);
      }
    };

    document.addEventListener('nodeclick', handleNodeClick as EventListener);
    return () => {
      document.removeEventListener('nodeclick', handleNodeClick as EventListener);
    };
  }, [nodes, setNodes]);

  const loadFlow = async () => {
    if (!flowId) return;
    
    try {
      // 먼저 임시 저장된 버전이 있는지 확인
      const draftData = await getDraftFlowVersion(flowId);
      
      // 플로우 정의 불러오기 (저장된 노드와 엣지 포함)
      const flowDefinition = await getFlowDefinition(flowId);
      
      if (draftData && draftData.flow_definition) {
        // 임시 저장 버전이 있는 경우 사용자에게 선택권 제공
        Modal.confirm({
          title: '임시 저장된 버전 발견',
          content: (
            <div>
              <p>이 Flow에 임시 저장된 작업이 있습니다.</p>
              <p style={{ color: '#666', fontSize: '14px' }}>
                임시 저장 시간: {new Date(draftData.saved_at).toLocaleString()}
              </p>
              <p>어느 버전을 불러올까요?</p>
            </div>
          ),
          okText: '임시 저장 버전 사용',
          cancelText: '정식 저장 버전 사용',
          onOk: () => {
            loadFlowData(draftData.flow_definition);
            message.info('임시 저장된 버전을 복원했습니다.');
          },
          onCancel: () => {
            if (flowDefinition && flowDefinition.flow_definition) {
              loadFlowData(flowDefinition.flow_definition);
              message.success('정식 저장된 Flow가 로드되었습니다.');
            }
          }
        });
      } else if (flowDefinition && flowDefinition.flow_definition) {
        // 임시 저장 버전이 없으면 정식 버전 로드
        loadFlowData(flowDefinition.flow_definition);
        message.success('Flow가 성공적으로 로드되었습니다.');
      } else {
        // 플로우 정의가 없으면 초기 상태 유지
        console.log('No flow definition found, using initial state');
      }
    } catch (error) {
      console.error('Failed to load flow:', error);
      message.error('Flow 로드에 실패했습니다.');
    }
  };

  // Flow 데이터 로드 헬퍼 함수
  const loadFlowData = (flowData: any) => {
    if (flowData.nodes && flowData.nodes.length > 0) {
      setNodes(flowData.nodes);
    }
    if (flowData.edges && flowData.edges.length > 0) {
      setEdges(flowData.edges);
    }
  };

  // 세션 스토리지 정리
  const clearTempNodeConfigs = useCallback(() => {
    if (!flowId) return;
    
    const storageKey = `temp_node_configs_${flowId}`;
    sessionStorage.removeItem(storageKey);
    console.log('Temporary node configs cleared');
  }, [flowId]);

  const handleBack = () => {
    navigate('/workspaces');
  };

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({
      ...params,
      animated: true,
      style: { 
        stroke: '#1a1a1a', 
        strokeWidth: 2,
        strokeDasharray: '5 5'
      },
      markerEnd: {
        type: 'arrowclosed',
        color: '#1a1a1a',
        width: 20,
        height: 20
      }
    }, eds));
  }, [setEdges]);

  // 노드 추가
  const addNode = (nodeType: string) => {
    const nodeConfigType = nodeCategories[nodeType as keyof typeof nodeCategories];
    const portConfig = getNodePorts(nodeType, {});
    
    const newNode: Node = {
      id: `${nodeType}-${Date.now()}`,
      type: nodeType === 'selectColumns' ? 'selectColumns' : 'custom',
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: {
        label: nodeConfigType.label,
        type: nodeType,
        icon: nodeConfigType.icon,
        color: nodeConfigType.color,
        config: {}, // 빈 객체로 초기화
        ...portConfig
      }
    };
    
    setNodes((nds) => [...nds, newNode]);
  };

  // 노드 선택 처리
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    console.log('=== NODE CLICK ===');
    console.log('Clicked node:', node.id, node.data.type);
    console.log('Node config:', node.data.config);
    
    // config가 없으면 빈 객체로 초기화
    if (!node.data.config) {
      setNodes((currentNodes) => 
        currentNodes.map((n) => {
          if (n.id === node.id) {
            return {
              ...n,
              data: {
                ...n.data,
                config: {}
              }
            };
          }
          return n;
        })
      );
    }
    
    setSelectedNodeId(node.id);
    setDrawerVisible(true);
    form.setFieldsValue({
      label: node.data.label,
      type: node.data.type
    });
  }, [form, setNodes]);

  // 노드 삭제 (키보드 Delete/Backspace)
  const onNodesDelete = useCallback(
    (nodesToDelete: Node[]) => {
      const nodeIds = nodesToDelete.map(node => node.id);
      
      // 관련된 엣지도 함께 삭제
      setEdges((eds) => 
        eds.filter((edge) => 
          !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)
        )
      );
      
      // 선택된 노드가 삭제되는 경우 drawer 닫기
      if (selectedNodeId && nodeIds.includes(selectedNodeId)) {
        setSelectedNodeId(null);
        setDrawerVisible(false);
      }
      
      message.info(`${nodesToDelete.length}개 노드가 삭제되었습니다.`);
    },
    [setEdges, selectedNodeId]
  );

  // 단일 노드 삭제 함수
  const deleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) return;
    
    // 관련된 엣지 삭제
    setEdges((eds) => 
      eds.filter((edge) => 
        edge.source !== selectedNodeId && edge.target !== selectedNodeId
      )
    );
    
    // 노드 삭제
    setNodes((nds) => nds.filter((node) => node.id !== selectedNodeId));
    
    // Drawer 닫기
    setSelectedNodeId(null);
    setDrawerVisible(false);
    
    message.success('노드가 삭제되었습니다.');
  }, [selectedNodeId, setEdges, setNodes]);

  // 삭제 확인 모달
  const confirmDeleteNode = useCallback(() => {
    const selectedNode = getSelectedNode();
    if (!selectedNode) return;
    
    Modal.confirm({
      title: '노드 삭제',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p><strong>"{selectedNode.data.label}"</strong> 노드를 삭제하시겠습니까?</p>
          <p style={{ color: '#666', fontSize: '14px' }}>
            이 작업은 되돌릴 수 없으며, 연결된 모든 링크도 함께 삭제됩니다.
          </p>
        </div>
      ),
      okText: '삭제',
      okType: 'danger',
      cancelText: '취소',
      onOk: deleteSelectedNode,
    });
  }, [getSelectedNode, deleteSelectedNode]);

  // 노드 설정 변경 처리
  const handleNodeConfigChange = useCallback((config: any) => {
    if (!selectedNodeId) {
      console.warn('No selected node ID for config change');
      return;
    }

    console.log('=== CONFIG CHANGE ===');
    console.log('Node ID:', selectedNodeId);
    console.log('New config:', config);

    // nodes 배열에서 직접 업데이트
    setNodes((currentNodes) => {
      return currentNodes.map((node) => {
        if (node.id === selectedNodeId) {
          const portConfig = getNodePorts(node.data.type, config);
          
          console.log('Current node config:', node.data.config);
          console.log('Updating to:', config);
          
          return {
            ...node,
            data: {
              ...node.data,
              label: config.label || node.data.label,
              config: config ? { ...config } : {}, // 새로운 config 객체 생성
              ...portConfig
            }
          };
        }
        return node;
      });
    });
    
    console.log('=== CONFIG CHANGE COMPLETED ===');
  }, [selectedNodeId, setNodes]);

  // 노드 설정 검증 처리
  const handleNodeConfigValidate = useCallback((isValid: boolean, errors?: Record<string, string>) => {
    if (!selectedNodeId) return;

    const errorCount = errors ? Object.keys(errors).length : 0;
    
    // 노드별 검증 상태 업데이트
    setNodeValidationStates(prev => ({
      ...prev,
      [selectedNodeId]: { isValid, errorCount }
    }));

    // Custom 노드는 스타일을 직접 관리하지 않음
  }, [selectedNodeId]);

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
        // 성공적으로 저장되면 임시 저장 데이터 정리
        clearTempNodeConfigs();
        message.success('Flow가 저장되었습니다.');
      }
    } catch (error) {
      message.error('Flow 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // Flow 실행 전 검증
  const validateBeforeExecution = () => {
    const invalidNodes = Object.entries(nodeValidationStates)
      .filter(([_, state]) => !state.isValid)
      .map(([nodeId, _]) => {
        const node = nodes.find(n => n.id === nodeId);
        return node?.data.label || nodeId;
      });

    if (invalidNodes.length > 0) {
      message.error(`다음 노드들의 설정을 확인하세요: ${invalidNodes.join(', ')}`);
      return false;
    }

    return true;
  };

  // Flow 실행
  const executeFlow = async () => {
    if (!flowId) return;
    
    // 실행 전 검증
    if (!validateBeforeExecution()) {
      return;
    }
    
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
  const nodeCategoriesGrouped = Object.entries(nodeCategories).reduce((acc, [key, value]) => {
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
            background: 'linear-gradient(180deg, #ffffff 0%, #fafafa 100%)', 
            borderRight: '1px solid #e8e8e8',
            overflow: 'auto',
            height: 'calc(100vh - 64px)',
            boxShadow: '4px 0 12px rgba(0, 0, 0, 0.02)'
          }}
        >
          <div style={{ padding: '16px' }}>
            <Title level={5} style={{ marginBottom: 16 }}>
              <PlusOutlined /> 노드 라이브러리
            </Title>
            
            <Collapse defaultActiveKey={Object.keys(nodeCategoriesGrouped)} ghost>
              {Object.entries(nodeCategoriesGrouped).map(([category, nodes]) => (
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
                          border: '1px solid #f0f0f0',
                          borderRadius: '8px',
                          transition: 'all 0.2s ease',
                          background: '#ffffff'
                        }}
                        bodyStyle={{ padding: '8px 12px' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.border = `2px solid ${node.color}`;
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.border = '1px solid #f0f0f0';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <Space>
                          <span style={{ color: node.color, fontSize: '16px' }}>
                            {React.isValidElement(node.icon) ? node.icon : <span>{String(node.icon)}</span>}
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
            nodeTypes={nodeTypes}
            fitView
            panOnDrag={true}
            selectionOnDrag={true}
            multiSelectionKeyCode="Control"
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
              gap={40} 
              size={1}
              color="#f0f0f0"
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
            {getSelectedNode() && (
              <span style={{ color: '#1890ff', fontSize: '14px' }}>
                - {getSelectedNode()?.data.label}
              </span>
            )}
          </Space>
        }
        placement="right"
        width={700}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        destroyOnClose={false}
        extra={
          <Space>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={confirmDeleteNode}
              type="text"
            >
              삭제
            </Button>
          </Space>
        }
      >
        {selectedNodeId && (
          <div key={selectedNodeId}>
            <NodeConfigManager
              nodeId={selectedNodeId}
              nodeType={getSelectedNode()?.data.type || ''}
              config={getSelectedNode()?.data.config || {}}
              onConfigChange={handleNodeConfigChange}
              onValidate={handleNodeConfigValidate}
              nodes={nodes}
              edges={edges}
            />
          </div>
        )}
      </Drawer>
    </Layout>
  );
};

export default FlowDesignerPage; 
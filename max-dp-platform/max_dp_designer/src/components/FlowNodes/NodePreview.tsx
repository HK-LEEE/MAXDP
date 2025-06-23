import React, { useState } from 'react';
import { Button, Drawer, Table, message, Spin, Alert, Space, Typography, Tag, Card, Divider } from 'antd';
import { EyeOutlined, PlayCircleOutlined, CloseOutlined, NodeIndexOutlined } from '@ant-design/icons';
import { apiService } from '../../services/api';

const { Text, Title } = Typography;

interface NodePreviewProps {
  nodeId: string;
  nodeType: string;
  nodeConfig: any;
  visible: boolean;
  onClose: () => void;
  onExecute: (nodeId: string) => Promise<any>;
  onNodeClick?: (nodeId: string) => void;
  flowId?: string;
  nodes?: any[];
  edges?: any[];
}

interface PreviewData {
  columns: Array<{ name: string; type: string }>;
  rows: Record<string, any>[];
  totalRows: number;
  executionTime: number;
  metadata?: {
    sourceNodes: string[];
    executionPath: string[];
  };
}

const NodePreview: React.FC<NodePreviewProps> = ({
  nodeId,
  nodeType,
  nodeConfig,
  visible,
  onClose,
  onExecute,
  onNodeClick,
  flowId,
  nodes = [],
  edges = []
}) => {
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 실행 경로 계산
  const getExecutionPath = () => {
    const path: Array<{ nodeId: string; label: string }> = [];
    const visited = new Set<string>();
    
    const findPath = (currentNodeId: string) => {
      if (visited.has(currentNodeId)) return;
      visited.add(currentNodeId);
      
      // 현재 노드로 들어오는 엣지 찾기
      const incomingEdges = edges.filter(edge => edge.target === currentNodeId);
      
      // 재귀적으로 이전 노드들 탐색
      incomingEdges.forEach(edge => {
        findPath(edge.source);
      });
      
      // 현재 노드 정보 추가
      const node = nodes.find(n => n.id === currentNodeId);
      if (node) {
        path.push({ nodeId: currentNodeId, label: node.data.label || node.data.type });
      }
    };
    
    findPath(nodeId);
    return path;
  };

  const executePreview = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Table Reader 노드의 경우 실제 데이터 미리보기
      if (nodeType === 'tableReader' && nodeConfig.connectionId && nodeConfig.tableName) {
        const whereClause = nodeConfig.whereClause || '';
        const limit = nodeConfig.limit || 10;
        
        const response = await apiService.previewTableData(nodeConfig.connectionId, {
          schema: nodeConfig.schema || 'public',
          tableName: nodeConfig.tableName,
          limit: limit,
          whereClause: whereClause
        });
        
        if (response.success && response.data) {
          const data = response.data;
          
          // 컬럼 정보 변환
          const columns = data.columns?.map((col: any) => ({
            name: col.column_name || col.name,
            type: col.data_type || col.type || 'unknown'
          })) || [];
          
          const previewResult: PreviewData = {
            columns: columns,
            rows: data.data || data.rows || [],
            totalRows: data.metadata?.total_rows || data.data?.length || 0,
            executionTime: Date.now() - startTime,
            metadata: {
              sourceNodes: getExecutionPath().map(p => p.nodeId),
              executionPath: getExecutionPath().map(p => p.label)
            }
          };
          
          setPreviewData(previewResult);
          message.success('미리보기 실행이 완료되었습니다.');
        } else {
          throw new Error(response.error || '데이터를 불러올 수 없습니다.');
        }
      } else {
        // 다른 노드 타입들은 백엔드 API 호출
        const result = await onExecute(nodeId);
        
        if (result && result.data) {
          const previewResult: PreviewData = {
            columns: result.data.columns || [],
            rows: result.data.rows || [],
            totalRows: result.data.totalRows || 0,
            executionTime: result.data.executionTime || 0,
            metadata: {
              sourceNodes: getExecutionPath().map(p => p.nodeId),
              executionPath: getExecutionPath().map(p => p.label)
            }
          };
          
          setPreviewData(previewResult);
          message.success('미리보기 실행이 완료되었습니다.');
        } else {
          throw new Error('미리보기 결과가 없습니다.');
        }
      }
    } catch (err: any) {
      setError(err.message || '미리보기 실행 중 오류가 발생했습니다.');
      message.error('미리보기 실행에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  const startTime = Date.now();

  const tableColumns = previewData?.columns.map(col => ({
    title: (
      <Space>
        <Text strong>{col.name}</Text>
        <Tag color="blue" style={{ fontSize: '10px' }}>{col.type}</Tag>
      </Space>
    ),
    dataIndex: col.name,
    key: col.name,
    render: (value: any) => {
      if (value === null || value === undefined) {
        return <Text type="secondary" italic>null</Text>;
      }
      if (typeof value === 'string' && value.length > 50) {
        return <Text title={value}>{value.substring(0, 47)}...</Text>;
      }
      return <Text>{String(value)}</Text>;
    }
  })) || [];

  const getNodeTypeLabel = (type: string) => {
    const typeLabels: Record<string, string> = {
      'tableReader': 'Table Reader',
      'customSQL': 'Custom SQL',
      'fileInput': 'File Input',
      'apiQuery': 'API Query',
      'selectColumns': 'Select Columns',
      'filterRows': 'Filter Rows',
      'renameColumns': 'Rename Columns',
      'tableWriter': 'Table Writer',
      'fileWriter': 'File Writer'
    };
    return typeLabels[type] || type;
  };

  return (
    <Drawer
      title={
        <Space>
          <EyeOutlined />
          <span>노드 미리보기</span>
          <Tag color="processing">{getNodeTypeLabel(nodeType)}</Tag>
        </Space>
      }
      placement="bottom"
      height="70vh"
      onClose={onClose}
      open={visible}
      extra={
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={loading}
          onClick={executePreview}
        >
          미리보기 실행
        </Button>
      }
    >
      <div style={{ padding: '0 24px' }}>
        {/* 실행 경로 표시 */}
        {previewData?.metadata?.executionPath && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
              <NodeIndexOutlined /> 실행 경로
            </Title>
            <Space wrap>
              {previewData.metadata.executionPath.map((step, index) => {
                const nodeId = previewData.metadata!.sourceNodes[index];
                const isCurrentNode = nodeId === nodeId;
                
                return (
                  <React.Fragment key={index}>
                    <Tag 
                      color={index === previewData.metadata!.executionPath.length - 1 ? 'processing' : 'default'}
                      style={{ 
                        cursor: onNodeClick ? 'pointer' : 'default',
                        transition: 'all 0.2s ease'
                      }}
                      onClick={() => {
                        if (onNodeClick && nodeId && !isCurrentNode) {
                          onClose(); // 현재 미리보기 닫기
                          onNodeClick(nodeId); // 클릭한 노드의 설정 열기
                        }
                      }}
                      onMouseEnter={(e) => {
                        if (onNodeClick && !isCurrentNode) {
                          e.currentTarget.style.transform = 'scale(1.05)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {step}
                    </Tag>
                    {index < previewData.metadata!.executionPath.length - 1 && (
                      <span style={{ color: '#ccc' }}>→</span>
                    )}
                  </React.Fragment>
                );
              })}
            </Space>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                노드를 클릭하면 해당 노드의 설정을 볼 수 있습니다.
              </Text>
            </div>
          </Card>
        )}

        {/* 에러 표시 */}
        {error && (
          <Alert
            message="실행 오류"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* 로딩 스피너 */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">데이터 파이프라인을 실행하고 있습니다...</Text>
            </div>
          </div>
        )}

        {/* 미리보기 데이터 */}
        {previewData && !loading && (
          <div>
            {/* 메타데이터 정보 */}
            <Card size="small" style={{ marginBottom: 16 }}>
              <Space size="large">
                <div>
                  <Text type="secondary">총 행 수</Text>
                  <br />
                  <Text strong style={{ fontSize: '18px' }}>
                    {previewData.totalRows.toLocaleString()}
                  </Text>
                </div>
                <Divider type="vertical" style={{ height: '40px' }} />
                <div>
                  <Text type="secondary">실행 시간</Text>
                  <br />
                  <Text strong style={{ fontSize: '18px' }}>
                    {previewData.executionTime}ms
                  </Text>
                </div>
                <Divider type="vertical" style={{ height: '40px' }} />
                <div>
                  <Text type="secondary">컬럼 수</Text>
                  <br />
                  <Text strong style={{ fontSize: '18px' }}>
                    {previewData.columns.length}
                  </Text>
                </div>
                <Divider type="vertical" style={{ height: '40px' }} />
                <div>
                  <Text type="secondary">미리보기 행</Text>
                  <br />
                  <Text strong style={{ fontSize: '18px' }}>
                    {previewData.rows.length}
                  </Text>
                </div>
              </Space>
            </Card>

            {/* 데이터 테이블 */}
            <Card
              title={
                <Space>
                  <Text strong>데이터 미리보기</Text>
                  <Tag color="blue">상위 {previewData.rows.length}개 행</Tag>
                </Space>
              }
              size="small"
            >
              <Table
                columns={tableColumns}
                dataSource={previewData.rows}
                rowKey="id"
                pagination={false}
                scroll={{ x: true, y: 400 }}
                size="small"
                bordered
                style={{
                  background: '#fafafa',
                  border: '1px solid #f0f0f0',
                  borderRadius: '6px'
                }}
              />
            </Card>
          </div>
        )}

        {/* 초기 상태 메시지 */}
        {!previewData && !loading && !error && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <EyeOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: 16 }} />
            <div>
              <Title level={4} type="secondary">노드 미리보기</Title>
              <Text type="secondary">
                '미리보기 실행' 버튼을 클릭하여 현재 노드까지의 데이터 처리 결과를 확인하세요.
                <br />
                이전 노드부터 연결된 모든 데이터 변환이 순차적으로 실행됩니다.
              </Text>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
};

export default NodePreview;
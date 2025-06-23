import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps, useNodes, useEdges } from '@xyflow/react';
import { Typography, Badge, Space, Button } from 'antd';
import { DatabaseOutlined, EyeOutlined } from '@ant-design/icons';
import NodePreview from './NodePreview';

const { Text } = Typography;

export interface Port {
  id: string;
  name: string;
  type: 'input' | 'output';
}

interface CustomNodeData {
  label: string;
  type: string;
  icon: React.ReactNode;
  color: string;
  config?: any;
  inputs?: Port[];
  outputs?: Port[];
  connectionSettings?: {
    database?: string;
    table?: string;
    query?: string;
  };
  extraSettings?: Record<string, any>;
}

const CustomNode: React.FC<NodeProps> = ({ data, selected, id }) => {
  const nodes = useNodes();
  const edges = useEdges();
  
  const { 
    label, 
    icon, 
    config,
    inputs = [], 
    outputs = [],
    connectionSettings,
    extraSettings,
    type
  } = data as unknown as CustomNodeData;

  const [previewVisible, setPreviewVisible] = useState(false);

  // 미리보기 실행 함수
  const handlePreviewExecute = async () => {
    // 실제로는 백엔드 API 호출
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true });
      }, 1000);
    });
  };

  // 포트 스타일
  const portStyle = {
    width: '12px',
    height: '12px',
    border: '2px solid #1a1a1a',
    background: '#ffffff',
    cursor: 'crosshair',
  };

  const inputPortStyle = {
    ...portStyle,
    left: '-6px',
  };

  const outputPortStyle = {
    ...portStyle,
    right: '-6px',
  };

  return (
    <div
      style={{
        background: selected ? '#fafafa' : '#ffffff',
        border: `2px solid ${selected ? '#1a1a1a' : '#e0e0e0'}`,
        borderRadius: '12px',
        minWidth: '280px',
        boxShadow: selected 
          ? '0 8px 24px rgba(0, 0, 0, 0.12)' 
          : '0 2px 8px rgba(0, 0, 0, 0.06)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* 1단: 헤더 - 컴포넌트명 + Input/Output 수량 */}
      <div
        style={{
          borderBottom: '1px solid #f0f0f0',
          padding: '12px 16px',
          background: '#fafafa',
          borderRadius: '12px 12px 0 0',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <span style={{ fontSize: '16px', color: '#1a1a1a' }}>
              {React.isValidElement(icon) ? icon : <span>{String(icon)}</span>}
            </span>
            <Text strong style={{ fontSize: '14px', color: '#1a1a1a' }}>{label}</Text>
          </Space>
          <Space size="small">
            {inputs.length > 0 && (
              <Badge 
                count={`IN: ${inputs.length}`} 
                style={{ 
                  backgroundColor: '#f5f5f5', 
                  color: '#666',
                  fontSize: '11px',
                  fontWeight: 500,
                  boxShadow: 'none'
                }} 
              />
            )}
            {outputs.length > 0 && (
              <Badge 
                count={`OUT: ${outputs.length}`} 
                style={{ 
                  backgroundColor: '#1a1a1a', 
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 500,
                  boxShadow: 'none'
                }} 
              />
            )}
          </Space>
        </div>
      </div>

      {/* 2단: Input 포트 섹션 */}
      {inputs.length > 0 && (
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #f0f0f0',
            background: '#fafafa',
          }}
        >
          <Text type="secondary" style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px' }}>
            INPUTS
          </Text>
          <div style={{ marginTop: '8px', position: 'relative' }}>
            {inputs.map((input: Port) => (
              <div
                key={input.id}
                style={{
                  position: 'relative',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  minHeight: '24px',
                }}
              >
                <Handle
                  type="target"
                  position={Position.Left}
                  id={input.id}
                  style={{
                    ...inputPortStyle,
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                />
                <Text style={{ 
                  marginLeft: '16px', 
                  fontSize: '13px',
                  color: '#1a1a1a',
                  fontWeight: 500,
                }}>
                  {input.name}
                </Text>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3단: 데이터베이스 설정 및 기타 조건 */}
      {(connectionSettings || config) && (
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #f0f0f0',
            background: '#ffffff',
          }}
        >
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            {connectionSettings?.database && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DatabaseOutlined style={{ color: '#666', fontSize: '12px' }} />
                <Text style={{ fontSize: '12px', color: '#666' }}>
                  {connectionSettings.database}
                  {connectionSettings.table && ` / ${connectionSettings.table}`}
                </Text>
              </div>
            )}
            {connectionSettings?.query && (
              <div style={{ 
                background: '#f5f5f5', 
                padding: '8px', 
                borderRadius: '6px',
                border: '1px solid #e0e0e0',
              }}>
                <Text style={{ 
                  fontSize: '11px', 
                  fontFamily: 'monospace',
                  color: '#1a1a1a',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {connectionSettings.query.substring(0, 100)}
                  {connectionSettings.query.length > 100 && '...'}
                </Text>
              </div>
            )}
          </Space>
        </div>
      )}

      {/* 4단: Output 포트 섹션 */}
      {outputs.length > 0 && (
        <div
          style={{
            padding: '12px 16px',
            borderBottom: extraSettings ? '1px solid #f0f0f0' : 'none',
            background: '#fafafa',
            borderRadius: extraSettings ? '0' : '0 0 12px 12px',
          }}
        >
          <Text type="secondary" style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px' }}>
            OUTPUTS
          </Text>
          <div style={{ marginTop: '8px', position: 'relative' }}>
            {outputs.map((output: Port) => (
              <div
                key={output.id}
                style={{
                  position: 'relative',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  minHeight: '24px',
                }}
              >
                <Text style={{ 
                  marginRight: '16px', 
                  fontSize: '13px',
                  color: '#1a1a1a',
                  fontWeight: 500,
                }}>
                  {output.name}
                </Text>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={output.id}
                  style={{
                    ...outputPortStyle,
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5단: 그 외 노드 설정 값 */}
      {extraSettings && Object.keys(extraSettings).length > 0 && (
        <div
          style={{
            padding: '12px 16px',
            background: '#ffffff',
            borderRadius: '0 0 12px 12px',
          }}
        >
          <Space size="small" wrap>
            {Object.entries(extraSettings).map(([key, value]) => (
              <div
                key={key}
                style={{
                  background: '#f5f5f5',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid #e0e0e0',
                }}
              >
                <Text style={{ fontSize: '11px', color: '#666' }}>
                  {key}: <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{String(value)}</span>
                </Text>
              </div>
            ))}
          </Space>
        </div>
      )}

      {/* 설정 상태 인디케이터 */}
      {config && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: config ? '#52c41a' : '#d9d9d9',
            border: '2px solid #fff',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        />
      )}

      {/* 미리보기 버튼 (hover 시 표시) */}
      {selected && config && (
        <div
          style={{
            position: 'absolute',
            top: '-40px',
            right: '0px',
            zIndex: 1000,
          }}
        >
          <Button
            type="primary"
            size="small"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              setPreviewVisible(true);
            }}
            style={{
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            미리보기
          </Button>
        </div>
      )}

      {/* 노드 미리보기 컴포넌트 */}
      <NodePreview
        nodeId={id}
        nodeType={type}
        nodeConfig={config}
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        onExecute={handlePreviewExecute}
        nodes={nodes}
        edges={edges}
        onNodeClick={(nodeId: string) => {
          // 노드 클릭 시 해당 노드 선택 및 설정 열기
          const node = nodes.find(n => n.id === nodeId);
          if (node) {
            // React Flow에서 노드 선택 이벤트 발생시키기
            const event = new CustomEvent('nodeclick', { detail: { nodeId } });
            document.dispatchEvent(event);
          }
        }}
      />
    </div>
  );
};

export default memo(CustomNode);
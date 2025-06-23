import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { UnorderedListOutlined, EyeOutlined } from '@ant-design/icons';
import { Tag, Tooltip, Badge, Button } from 'antd';
import NodePreview from './NodePreview';

interface SelectColumnsNodeData {
  label: string;
  type: string;
  icon: React.ReactNode;
  color: string;
  config?: {
    selectedColumns?: string[];
    [key: string]: any;
  };
  inputs?: Array<{ id: string; name: string; type: string }>;
  outputs?: Array<{ id: string; name: string; type: string }>;
}

const SelectColumnsNode: React.FC<NodeProps<SelectColumnsNodeData>> = ({ data, selected, id }) => {
  const [previewVisible, setPreviewVisible] = useState(false);
  const selectedColumns = data.config?.selectedColumns || [];
  const displayColumns = selectedColumns.slice(0, 3);
  const hasMore = selectedColumns.length > 3;

  const handlePreviewExecute = async (nodeId: string) => {
    console.log('Executing preview for node:', nodeId);
  };

  return (
    <>
      <div
        style={{
          padding: '12px 16px',
          borderRadius: '8px',
          border: selected ? '2px solid #1890ff' : '2px solid #e8e8e8',
          background: '#ffffff',
          minWidth: '200px',
          boxShadow: selected ? '0 0 0 2px rgba(24, 144, 255, 0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: data.color || '#52c41a', fontSize: '16px' }}>
              {data.icon || <UnorderedListOutlined />}
            </span>
            <span style={{ fontWeight: 600, fontSize: '14px' }}>
              {data.label}
            </span>
          </div>
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => setPreviewVisible(true)}
            style={{ padding: '0 4px' }}
          />
        </div>

        {/* Node Type Badge */}
        <Badge 
          color="#52c41a" 
          text="Select Columns" 
          style={{ 
            fontSize: '10px',
            marginBottom: '8px',
            display: 'block'
          }} 
        />

        {/* Selected Columns Display */}
        {selectedColumns.length > 0 && (
          <div style={{ 
            marginTop: '8px', 
            paddingTop: '8px', 
            borderTop: '1px solid #e8e8e8',
            fontSize: '11px'
          }}>
            <div style={{ marginBottom: '4px', color: '#666', fontWeight: 500 }}>
              선택된 컬럼 ({selectedColumns.length}개)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {displayColumns.map((column, index) => (
                <Tag 
                  key={index} 
                  color="green" 
                  style={{ 
                    fontSize: '10px', 
                    padding: '0 4px',
                    margin: 0,
                    maxWidth: '100px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {column}
                </Tag>
              ))}
              {hasMore && (
                <Tooltip title={`전체 컬럼: ${selectedColumns.join(', ')}`}>
                  <Tag 
                    color="default" 
                    style={{ 
                      fontSize: '10px', 
                      padding: '0 4px',
                      margin: 0,
                      cursor: 'pointer'
                    }}
                  >
                    +{selectedColumns.length - 3}개
                  </Tag>
                </Tooltip>
              )}
            </div>
          </div>
        )}
        
        {selectedColumns.length === 0 && (
          <div style={{ 
            marginTop: '8px', 
            fontSize: '11px',
            color: '#999',
            fontStyle: 'italic'
          }}>
            컬럼을 선택하세요
          </div>
        )}

        {/* Handles */}
        <Handle 
          type="target" 
          position={Position.Left} 
          style={{
            background: '#1890ff',
            width: '8px',
            height: '8px',
            border: '2px solid #fff',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        />
        <Handle 
          type="source" 
          position={Position.Right}
          style={{
            background: '#52c41a',
            width: '8px',
            height: '8px',
            border: '2px solid #fff',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        />
      </div>

      {/* Preview Modal */}
      {previewVisible && (
        <NodePreview
          nodeId={id}
          nodeType={data.type}
          visible={previewVisible}
          onClose={() => setPreviewVisible(false)}
          onExecute={handlePreviewExecute}
        />
      )}
    </>
  );
};

export default memo(SelectColumnsNode);
/**
 * ❌ OLD FILE - 이 파일이 보이면 캐시 문제입니다! ❌
 * Select Columns 노드 설정 컴포넌트
 * CLAUDE.local.md 가이드라인에 따른 컬럼 선택 노드 설정
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Button, 
  Select, 
  Space, 
  message, 
  Typography, 
  Card,
  Checkbox,
  Input,
  Divider,
  Tag,
  List,
  Empty,
  Spin,
  Alert,
} from 'antd';
import { 
  RightOutlined,
  LeftOutlined,
  DoubleRightOutlined,
  DoubleLeftOutlined,
  SwapOutlined,
  UpOutlined,
  DownOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import BaseNodeConfig from '../BaseNodeConfig';
import { 
  NodeConfigProps, 
  SelectColumnsConfig as SelectColumnsConfigType,
} from '../types';
import { selectColumnsSchema } from '../schemas';
import { getInputSchema, ColumnInfo } from '../../../utils/schemaUtils';

const { Text } = Typography;
const { Search } = Input;

interface SelectColumnsConfigProps extends NodeConfigProps<SelectColumnsConfigType> {
  nodes?: any[];
  edges?: any[];
}

/**
 * Select Columns 노드 전용 설정 컴포넌트
 */
const SelectColumnsConfig: React.FC<SelectColumnsConfigProps> = (props) => {
  const { nodes = [], edges = [] } = props;
  
  const [availableColumns, setAvailableColumns] = useState<ColumnInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [leftSelectedKeys, setLeftSelectedKeys] = useState<string[]>([]);
  const [rightSelectedKeys, setRightSelectedKeys] = useState<string[]>([]);

  // 이전 노드로부터 스키마 정보 로드 (RenameColumns와 동일한 패턴)
  useEffect(() => {
    if (nodes.length > 0 && edges.length > 0) {
      loadInputSchema();
    }
  }, [props.nodeId, nodes, edges]);

  const loadInputSchema = async () => {
    setLoading(true);
    setSchemaError(null);
    
    try {
      console.log('Loading input schema for Select Columns node:', props.nodeId);
      const schemaInfo = await getInputSchema(props.nodeId, nodes, edges);
      
      if (schemaInfo && schemaInfo.columns.length > 0) {
        console.log('Schema loaded successfully:', schemaInfo);
        setAvailableColumns(schemaInfo.columns);
        message.success(`${schemaInfo.sourceNodeType} 노드로부터 ${schemaInfo.columns.length}개 컬럼 정보를 가져왔습니다.`);
      } else {
        console.log('No schema found, using empty columns');
        setAvailableColumns([]);
        setSchemaError('이전 노드로부터 컬럼 정보를 가져올 수 없습니다. 이전 노드를 먼저 설정해주세요.');
      }
    } catch (error) {
      console.error('Error loading input schema:', error);
      setAvailableColumns([]);
      setSchemaError('스키마 정보 로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 현재 선택된 컬럼들
  const selectedColumns = props.config.selectedColumns || [];

  // 사용 가능한 컬럼들 (선택되지 않은 것들)
  const availableColumnsList = useMemo(() => {
    return availableColumns.filter(col => !selectedColumns.includes(col.name));
  }, [availableColumns, selectedColumns]);

  // 선택된 컬럼들 정보
  const selectedColumnsList = useMemo(() => {
    return selectedColumns.map(colName => 
      availableColumns.find(col => col.name === colName)
    ).filter(Boolean) as ColumnInfo[];
  }, [selectedColumns, availableColumns]);

  // 오른쪽으로 이동 (선택)
  const moveToRight = () => {
    if (leftSelectedKeys.length === 0) return;
    
    const newSelectedColumns = [...selectedColumns, ...leftSelectedKeys];
    props.onConfigChange({
      ...props.config,
      selectedColumns: newSelectedColumns,
    });
    
    setLeftSelectedKeys([]);
    message.success(`${leftSelectedKeys.length}개 컬럼이 선택되었습니다.`);
  };

  // 왼쪽으로 이동 (선택 해제)
  const moveToLeft = () => {
    if (rightSelectedKeys.length === 0) return;
    
    const newSelectedColumns = selectedColumns.filter(col => !rightSelectedKeys.includes(col));
    props.onConfigChange({
      ...props.config,
      selectedColumns: newSelectedColumns,
    });
    
    setRightSelectedKeys([]);
    message.success(`${rightSelectedKeys.length}개 컬럼 선택이 해제되었습니다.`);
  };

  // 모든 컬럼 선택
  const moveAllToRight = () => {
    const allColumnNames = availableColumnsList.map(col => col.name);
    if (allColumnNames.length === 0) return;
    
    const newSelectedColumns = [...selectedColumns, ...allColumnNames];
    props.onConfigChange({
      ...props.config,
      selectedColumns: newSelectedColumns,
    });
    
    message.success(`${allColumnNames.length}개 컬럼이 모두 선택되었습니다.`);
  };

  // 모든 컬럼 선택 해제
  const moveAllToLeft = () => {
    if (selectedColumns.length === 0) return;
    
    props.onConfigChange({
      ...props.config,
      selectedColumns: [],
    });
    
    setRightSelectedKeys([]);
    message.success('모든 컬럼 선택이 해제되었습니다.');
  };

  // 컬럼 순서 변경
  const moveColumn = (columnName: string, direction: 'up' | 'down') => {
    const currentIndex = selectedColumns.indexOf(columnName);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= selectedColumns.length) return;

    const newSelectedColumns = [...selectedColumns];
    [newSelectedColumns[currentIndex], newSelectedColumns[newIndex]] = 
    [newSelectedColumns[newIndex], newSelectedColumns[currentIndex]];

    props.onConfigChange({
      ...props.config,
      selectedColumns: newSelectedColumns,
    });
  };

  // 컬럼 타입별 색상
  const getColumnTypeColor = (type: string) => {
    const typeColors: Record<string, string> = {
      'integer': 'blue',
      'varchar': 'green',
      'text': 'green',
      'timestamp': 'purple',
      'date': 'purple',
      'boolean': 'orange',
      'decimal': 'cyan',
      'float': 'cyan',
    };
    return typeColors[type.toLowerCase()] || 'default';
  };

  // 스키마 업데이트 (컬럼 선택 UI 추가)
  const enhancedSchema = {
    ...selectColumnsSchema,
    sections: selectColumnsSchema.sections.map(section => {
      if (section.title === '컬럼 선택') {
        return {
          ...section,
          fields: section.fields.map(field => {
            if (field.key === 'selectedColumns') {
              return {
                ...field,
                customComponent: (
                  <div>
                    {/* 컨트롤 버튼 */}
                    <Card size="small" style={{ marginBottom: '12px' }}>
                      <Space>
                        <Button
                          size="small"
                          icon={<ReloadOutlined />}
                          onClick={loadInputSchema}
                          loading={loading}
                          title="스키마 다시 로드"
                        />
                        
                        <Divider type="vertical" />
                        <Text type="secondary">
                          🔄 Transfer UI - 사용 가능: {availableColumnsList.length}개 | 선택됨: {selectedColumns.length}개
                        </Text>
                      </Space>
                    </Card>

                    {/* 스키마 에러 표시 */}
                    {schemaError && (
                      <Alert
                        message="스키마 로드 오류"
                        description={schemaError}
                        type="warning"
                        showIcon
                        style={{ marginBottom: '12px' }}
                        action={
                          <Button 
                            size="small" 
                            onClick={loadInputSchema}
                            loading={loading}
                          >
                            다시 시도
                          </Button>
                        }
                      />
                    )}

                    {/* 로딩 상태 */}
                    {loading && (
                      <Card size="small" style={{ marginBottom: '12px' }}>
                        <div style={{ textAlign: 'center', padding: '20px' }}>
                          <Spin />
                          <div style={{ marginTop: '8px' }}>
                            <Text type="secondary">이전 노드로부터 컬럼 정보를 가져오는 중...</Text>
                          </div>
                        </div>
                      </Card>
                    )}

                    {/* Transfer 스타일 UI */}
                    {!loading && (
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                        {/* 왼쪽: 사용 가능한 컬럼 */}
                        <Card 
                          title={`사용 가능한 컬럼 (${availableColumnsList.length}개)`}
                          size="small"
                          style={{ flex: 1, minHeight: '400px' }}
                        >
                          <div style={{ height: '300px', overflowY: 'auto' }}>
                            <List
                              size="small"
                              dataSource={availableColumnsList}
                              renderItem={(column) => (
                                <List.Item
                                  onClick={() => {
                                    const newKeys = leftSelectedKeys.includes(column.name)
                                      ? leftSelectedKeys.filter(key => key !== column.name)
                                      : [...leftSelectedKeys, column.name];
                                    setLeftSelectedKeys(newKeys);
                                  }}
                                  style={{
                                    cursor: 'pointer',
                                    backgroundColor: leftSelectedKeys.includes(column.name) 
                                      ? '#e6f7ff' : 'transparent',
                                    padding: '8px',
                                  }}
                                >
                                  <List.Item.Meta
                                    avatar={
                                      <Checkbox 
                                        checked={leftSelectedKeys.includes(column.name)}
                                        onChange={() => {}}
                                      />
                                    }
                                    title={
                                      <Space>
                                        <Text>{column.name}</Text>
                                        <Tag color={getColumnTypeColor(column.type)} size="small">
                                          {column.type}
                                        </Tag>
                                        {!column.nullable && (
                                          <Tag color="red" size="small">NOT NULL</Tag>
                                        )}
                                      </Space>
                                    }
                                    description={column.description}
                                  />
                                </List.Item>
                              )}
                            />
                          </div>
                        </Card>

                        {/* 가운데: 이동 버튼 */}
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '8px',
                          justifyContent: 'center',
                          alignItems: 'center',
                          minWidth: '80px',
                          marginTop: '60px'
                        }}>
                          <Button
                            icon={<DoubleRightOutlined />}
                            onClick={moveAllToRight}
                            disabled={availableColumnsList.length === 0}
                            title="모든 컬럼 선택"
                          />
                          <Button
                            type="primary"
                            icon={<RightOutlined />}
                            onClick={moveToRight}
                            disabled={leftSelectedKeys.length === 0}
                            title="선택된 컬럼 이동"
                          />
                          <Button
                            icon={<LeftOutlined />}
                            onClick={moveToLeft}
                            disabled={rightSelectedKeys.length === 0}
                            title="선택된 컬럼 제거"
                          />
                          <Button
                            icon={<DoubleLeftOutlined />}
                            onClick={moveAllToLeft}
                            disabled={selectedColumns.length === 0}
                            title="모든 컬럼 제거"
                          />
                        </div>

                        {/* 오른쪽: 선택된 컬럼 */}
                        <Card 
                          title={`출력할 컬럼 (${selectedColumns.length}개)`}
                          size="small"
                          style={{ flex: 1, minHeight: '400px' }}
                          extra={
                            <Space>
                              <Text type="secondary" style={{ fontSize: '12px' }}>
                                순서 변경 가능
                              </Text>
                            </Space>
                          }
                        >
                          <div style={{ height: '300px', overflowY: 'auto' }}>
                            {selectedColumnsList.length > 0 ? (
                              <List
                                size="small"
                                dataSource={selectedColumnsList.map((column, index) => ({
                                  ...column,
                                  index
                                }))}
                                renderItem={(column) => (
                                  <List.Item
                                    onClick={() => {
                                      const newKeys = rightSelectedKeys.includes(column.name)
                                        ? rightSelectedKeys.filter(key => key !== column.name)
                                        : [...rightSelectedKeys, column.name];
                                      setRightSelectedKeys(newKeys);
                                    }}
                                    style={{
                                      cursor: 'pointer',
                                      backgroundColor: rightSelectedKeys.includes(column.name) 
                                        ? '#fff2e8' : 'transparent',
                                      padding: '8px',
                                    }}
                                    actions={[
                                      <Button
                                        type="text"
                                        size="small"
                                        icon={<UpOutlined />}
                                        disabled={column.index === 0}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          moveColumn(column.name, 'up');
                                        }}
                                      />,
                                      <Button
                                        type="text"
                                        size="small"
                                        icon={<DownOutlined />}
                                        disabled={column.index === selectedColumnsList.length - 1}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          moveColumn(column.name, 'down');
                                        }}
                                      />
                                    ]}
                                  >
                                    <List.Item.Meta
                                      avatar={
                                        <Checkbox 
                                          checked={rightSelectedKeys.includes(column.name)}
                                          onChange={() => {}}
                                        />
                                      }
                                      title={
                                        <Space>
                                          <Text strong>{column.index + 1}.</Text>
                                          <Text>{column.name}</Text>
                                          <Tag color={getColumnTypeColor(column.type)} size="small">
                                            {column.type}
                                          </Tag>
                                          {!column.nullable && (
                                            <Tag color="red" size="small">NOT NULL</Tag>
                                          )}
                                        </Space>
                                      }
                                      description={column.description}
                                    />
                                  </List.Item>
                                )}
                              />
                            ) : (
                              <Empty 
                                description="선택된 컬럼이 없습니다"
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                              />
                            )}
                          </div>
                        </Card>
                      </div>
                    )}
                  </div>
                ),
              };
            }
            return field;
          }),
        };
      }

      return section;
    }),
  };

  return (
    <BaseNodeConfig
      {...props}
      schema={enhancedSchema}
      onPreview={() => {
        if (selectedColumns.length === 0) {
          message.warning('선택된 컬럼이 없습니다.');
          return;
        }
        message.info(`${selectedColumns.length}개 컬럼 선택 미리보기 기능을 구현중입니다.`);
      }}
    />
  );
};

export default SelectColumnsConfig;
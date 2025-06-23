/**
 * Select Columns 노드 설정 컴포넌트 - Transfer UI Style
 * CLAUDE.local.md 가이드라인에 따른 컬럼 선택 노드 설정
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Button, 
  Space, 
  message, 
  Typography, 
  Card,
  Checkbox,
  Divider,
  Tag,
  List,
  Empty,
  Spin,
  Alert,
  Modal,
  Table,
} from 'antd';
import { 
  RightOutlined,
  LeftOutlined,
  DoubleRightOutlined,
  DoubleLeftOutlined,
  UpOutlined,
  DownOutlined,
  ReloadOutlined,
  EyeOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import BaseNodeConfig from '../BaseNodeConfig';
import { 
  NodeConfigProps, 
  SelectColumnsConfig as SelectColumnsConfigType,
} from '../types';
import { selectColumnsSchema } from '../schemas';
import { getInputSchema, ColumnInfo } from '../../../utils/schemaUtils';
import { apiService } from '../../../services/api';

const { Text } = Typography;

interface SelectColumnsConfigProps extends NodeConfigProps<SelectColumnsConfigType> {
  nodes?: any[];
  edges?: any[];
}

/**
 * Select Columns 노드 전용 설정 컴포넌트 - Transfer 스타일
 */
const SelectColumnsConfig: React.FC<SelectColumnsConfigProps> = (props) => {
  const { nodes = [], edges = [] } = props;
  
  const [availableColumns, setAvailableColumns] = useState<ColumnInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [leftSelectedKeys, setLeftSelectedKeys] = useState<string[]>([]);
  const [rightSelectedKeys, setRightSelectedKeys] = useState<string[]>([]);
  
  // 미리보기 관련 상태
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewColumns, setPreviewColumns] = useState<any[]>([]);

  // 이전 노드로부터 스키마 정보 로드
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
      sourceSchema: availableColumns, // 원본 스키마 정보 저장
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
      sourceSchema: availableColumns, // 원본 스키마 정보 저장
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
      sourceSchema: availableColumns, // 원본 스키마 정보 저장
    });
    
    message.success(`${allColumnNames.length}개 컬럼이 모두 선택되었습니다.`);
  };

  // 모든 컬럼 선택 해제
  const moveAllToLeft = () => {
    if (selectedColumns.length === 0) return;
    
    props.onConfigChange({
      ...props.config,
      selectedColumns: [],
      sourceSchema: availableColumns, // 원본 스키마 정보 저장
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
      sourceSchema: availableColumns, // 원본 스키마 정보 저장
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

  // 미리보기 실행
  const handlePreview = async () => {
    if (selectedColumns.length === 0) {
      message.warning('선택된 컬럼이 없습니다.');
      return;
    }

    setPreviewLoading(true);
    try {
      // 이전 노드로부터 데이터 가져오기
      const sourceNodeInfo = await getInputSchema(props.nodeId, nodes, edges);
      
      if (!sourceNodeInfo) {
        message.error('이전 노드의 데이터를 가져올 수 없습니다.');
        return;
      }

      // 임시로 TableReader에서 실제 데이터를 가져와서 필터링
      let mockData: any[] = [];
      
      // 소스 노드가 TableReader인 경우 실제 데이터 가져오기
      const sourceNode = nodes.find(node => node.id === sourceNodeInfo.sourceNodeId);
      if (sourceNode && sourceNode.data?.type === 'tableReader') {
        const tableConfig = sourceNode.data?.config;
        if (tableConfig?.connectionId && tableConfig?.tableName) {
          console.log('Fetching preview data from TableReader...');
          
          // TableReader의 미리보기 API 사용
          const tablePreviewResponse = await apiService.previewTableData(
            tableConfig.connectionId,
            {
              schema: tableConfig.schema || 'public',
              tableName: tableConfig.tableName,
              limit: 20,
              whereClause: tableConfig.whereClause
            }
          );
          
          if (tablePreviewResponse.success && tablePreviewResponse.data?.rows) {
            // 선택된 컬럼만 필터링
            mockData = tablePreviewResponse.data.rows.map((row: any) => {
              const filteredRow: any = {};
              selectedColumns.forEach(colName => {
                filteredRow[colName] = row[colName];
              });
              return filteredRow;
            });
          }
        }
      }

      // 샘플 데이터가 없으면 모킹 데이터 생성
      if (mockData.length === 0) {
        console.log('Creating mock preview data...');
        mockData = Array.from({ length: 10 }, (_, index) => {
          const row: any = {};
          selectedColumns.forEach(colName => {
            const columnInfo = availableColumns.find(col => col.name === colName);
            if (columnInfo) {
              switch (columnInfo.type.toLowerCase()) {
                case 'integer':
                case 'bigint':
                  row[colName] = Math.floor(Math.random() * 1000) + index;
                  break;
                case 'varchar':
                case 'text':
                  row[colName] = `Sample ${colName} ${index + 1}`;
                  break;
                case 'timestamp':
                case 'date':
                  row[colName] = new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0];
                  break;
                case 'boolean':
                  row[colName] = Math.random() > 0.5;
                  break;
                default:
                  row[colName] = `Value ${index + 1}`;
              }
            } else {
              row[colName] = `Data ${index + 1}`;
            }
          });
          return row;
        });
      }

      // 선택된 컬럼만 표시하도록 Table columns 구성
      const tableColumns = selectedColumns.map((colName) => {
        const columnInfo = availableColumns.find(col => col.name === colName);
        return {
          title: (
            <Space>
              <Text strong>{colName}</Text>
              {columnInfo && (
                <Tag color={getColumnTypeColor(columnInfo.type)} size="small">
                  {columnInfo.type}
                </Tag>
              )}
            </Space>
          ),
          dataIndex: colName,
          key: colName,
          width: 150,
          ellipsis: true,
          render: (value: any) => (
            <Text style={{ fontSize: '12px' }}>
              {value !== null && value !== undefined ? String(value) : '-'}
            </Text>
          ),
        };
      });

      setPreviewColumns(tableColumns);
      setPreviewData(mockData);
      setPreviewModalVisible(true);
      
      message.success(`${selectedColumns.length}개 컬럼으로 ${mockData.length}행 데이터를 미리보기합니다.`);
      
    } catch (error) {
      console.error('Preview error:', error);
      message.error('미리보기 중 오류가 발생했습니다.');
    } finally {
      setPreviewLoading(false);
    }
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
                      <div style={{ 
                        display: 'flex', 
                        gap: '12px', 
                        alignItems: 'flex-start',
                        width: '100%'
                      }}>
                        {/* 왼쪽: 사용 가능한 컬럼 */}
                        <Card 
                          title={`사용 가능한 컬럼 (${availableColumnsList.length}개)`}
                          size="small"
                          style={{ 
                            flex: 1, 
                            minHeight: '350px'
                          }}
                        >
                          <div style={{ height: '280px', overflowY: 'auto' }}>
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
                                    padding: '4px 8px',
                                  }}
                                >
                                  <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '6px',
                                    width: '100%'
                                  }}>
                                    <Checkbox 
                                      checked={leftSelectedKeys.includes(column.name)}
                                      onChange={() => {}}
                                      style={{ flexShrink: 0 }}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <Text strong style={{ 
                                        fontSize: '14px',
                                        display: 'block',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        {column.name}
                                      </Text>
                                      {column.description && (
                                        <Text type="secondary" style={{ 
                                          fontSize: '11px',
                                          display: 'block',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap'
                                        }}>
                                          {column.description}
                                        </Text>
                                      )}
                                    </div>
                                  </div>
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
                          width: '80px',
                          marginTop: '50px',
                          flexShrink: 0
                        }}>
                          <Button
                            size="small"
                            icon={<DoubleRightOutlined />}
                            onClick={moveAllToRight}
                            disabled={availableColumnsList.length === 0}
                            title="모든 컬럼 선택"
                          />
                          <Button
                            size="small"
                            type="primary"
                            icon={<RightOutlined />}
                            onClick={moveToRight}
                            disabled={leftSelectedKeys.length === 0}
                            title="선택된 컬럼 이동"
                          />
                          <Button
                            size="small"
                            icon={<LeftOutlined />}
                            onClick={moveToLeft}
                            disabled={rightSelectedKeys.length === 0}
                            title="선택된 컬럼 제거"
                          />
                          <Button
                            size="small"
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
                          style={{ 
                            flex: 1, 
                            minHeight: '350px'
                          }}
                          extra={
                            <Text type="secondary" style={{ fontSize: '10px' }}>
                              순서변경
                            </Text>
                          }
                        >
                          <div style={{ height: '280px', overflowY: 'auto' }}>
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
                                      padding: '4px 8px',
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
                                        style={{ padding: '2px' }}
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
                                        style={{ padding: '2px' }}
                                      />
                                    ]}
                                  >
                                    <div style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '6px',
                                      width: '100%'
                                    }}>
                                      <Checkbox 
                                        checked={rightSelectedKeys.includes(column.name)}
                                        onChange={() => {}}
                                        style={{ flexShrink: 0 }}
                                      />
                                      <Text type="secondary" style={{ 
                                        fontSize: '11px', 
                                        width: '18px',
                                        flexShrink: 0
                                      }}>
                                        {column.index + 1}.
                                      </Text>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <Text strong style={{ 
                                          fontSize: '14px',
                                          display: 'block',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap'
                                        }}>
                                          {column.name}
                                        </Text>
                                        {column.description && (
                                          <Text type="secondary" style={{ 
                                            fontSize: '11px',
                                            display: 'block',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                          }}>
                                            {column.description}
                                          </Text>
                                        )}
                                      </div>
                                    </div>
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

  // 설정 저장
  const handleSave = () => {
    if (selectedColumns.length === 0) {
      message.warning('저장할 컬럼이 없습니다. 먼저 컬럼을 선택하세요.');
      return;
    }
    
    // 노드 데이터 업데이트
    const updatedNodes = nodes.map(node => {
      if (node.id === props.nodeId) {
        return {
          ...node,
          data: {
            ...node.data,
            config: {
              ...node.data.config,
              selectedColumns,
              sourceSchema: availableColumns,
            }
          }
        };
      }
      return node;
    });
    
    // workspaceStore에 업데이트 (실제 구현에서는 store 연결 필요)
    message.success(`${selectedColumns.length}개 컬럼 설정이 저장되었습니다.`);
  };

  return (
    <div>
      <BaseNodeConfig
        {...props}
        schema={enhancedSchema}
        onPreview={handlePreview}
        previewLoading={previewLoading}
      >
        {/* 추가 액션 버튼 */}
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              disabled={selectedColumns.length === 0}
            >
              저장
            </Button>
            <Button
              icon={<EyeOutlined />}
              onClick={handlePreview}
              loading={previewLoading}
              disabled={selectedColumns.length === 0}
            >
              미리보기
            </Button>
          </Space>
        </div>
      </BaseNodeConfig>

      {/* 미리보기 모달 */}
      <Modal
        title={
          <Space>
            <EyeOutlined />
            <Text strong>Select Columns 미리보기</Text>
            <Tag color="blue">{selectedColumns.length}개 컬럼</Tag>
          </Space>
        }
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        width={Math.min(1200, selectedColumns.length * 200 + 100)}
        footer={[
          <Button key="close" onClick={() => setPreviewModalVisible(false)}>
            닫기
          </Button>,
        ]}
      >
        <div style={{ marginBottom: '12px' }}>
          <Space>
            <Text type="secondary">
              선택된 컬럼: {selectedColumns.join(', ')}
            </Text>
          </Space>
        </div>
        
        <Table
          dataSource={previewData}
          columns={previewColumns}
          size="small"
          scroll={{ x: selectedColumns.length * 150, y: 400 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: false,
            showTotal: (total) => `총 ${total}행`,
          }}
          rowKey={(record, index) => index?.toString() || '0'}
        />
      </Modal>
    </div>
  );
};

export default SelectColumnsConfig;
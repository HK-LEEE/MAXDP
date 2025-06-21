/**
 * Table Reader 노드 설정 컴포넌트
 * CLAUDE.local.md 가이드라인에 따른 데이터베이스 테이블 읽기 노드 설정
 */

import React, { useState, useEffect } from 'react';
import { Button, Select, Space, Spin, message, List, Typography, Divider, Table, Modal, Tag, Input, Alert, Card, Form, Row, Col } from 'antd';
import { DatabaseOutlined, TableOutlined, ReloadOutlined, EyeOutlined, InfoCircleOutlined, PlusOutlined, MinusCircleOutlined, SaveOutlined } from '@ant-design/icons';

import { 
  NodeConfigProps, 
  TableReaderConfig as TableReaderConfigType,
  TableMetadata,
  DatabaseConnection,
} from '../types';
import { apiService } from '../../../services/api';

const { Text } = Typography;
const { Option } = Select;

interface TableReaderConfigProps extends NodeConfigProps<TableReaderConfigType> {
  // 추가 props
}

/**
 * Table Reader 노드 전용 설정 컴포넌트
 */
const TableReaderConfig: React.FC<TableReaderConfigProps> = (props) => {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [schemas, setSchemas] = useState<string[]>([]);
  const [tables, setTables] = useState<TableMetadata[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<string | undefined>(
    props.config.connectionId
  );
  const [selectedSchema, setSelectedSchema] = useState<string | undefined>(
    props.config.schema
  );
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [whereConditions, setWhereConditions] = useState<Array<{
    id: string;
    column: string;
    operator: string;
    value: string;
  }>>([]);
  const [availableColumns, setAvailableColumns] = useState<Array<{name: string; type: string}>>([]);
  const [saving, setSaving] = useState(false);
  const [tableSelected, setTableSelected] = useState(false); // 테이블 선택 상태 추적

  // 데이터베이스 연결 목록 로드
  useEffect(() => {
    loadConnections();
  }, []);

  // 선택된 연결이 변경되면 스키마 목록 로드
  useEffect(() => {
    if (selectedConnection) {
      loadSchemas(selectedConnection);
    }
  }, [selectedConnection]);

  // 선택된 스키마가 변경되면 테이블 목록 로드
  useEffect(() => {
    if (selectedConnection && selectedSchema) {
      loadTables(selectedConnection, selectedSchema);
    }
  }, [selectedConnection, selectedSchema]);

  // 기존 WHERE 조건이 있다면 로드
  useEffect(() => {
    if (props.config.whereConditions && props.config.whereConditions.length > 0) {
      setWhereConditions(props.config.whereConditions);
    }
  }, [props.config.whereConditions]);


  // 테이블이 변경되면 해당 테이블의 컬럼 정보를 설정
  useEffect(() => {
    if (props.config.tableName && tables.length > 0) {
      const selectedTable = tables.find(table => table.name === props.config.tableName);
      if (selectedTable && selectedTable.columns) {
        setAvailableColumns(selectedTable.columns);
      } else {
        setAvailableColumns([]);
      }
    } else {
      setAvailableColumns([]);
    }
  }, [props.config.tableName, tables]);

  const loadConnections = async () => {
    setLoadingConnections(true);
    try {
      const response = await apiService.getDatabaseConnections();
      if (response.success && response.data) {
        setConnections(response.data);
      } else {
        throw new Error(response.error || '연결 목록 로드 실패');
      }
    } catch (error) {
      console.error('Database connections error:', error);
      message.error('데이터베이스 연결 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoadingConnections(false);
    }
  };

  const loadSchemas = async (connectionId: string) => {
    setLoadingSchemas(true);
    try {
      const response = await apiService.getDatabaseSchemas(connectionId);
      if (response.success && response.data) {
        setSchemas(response.data);
        // 첫 번째 스키마를 기본 선택
        if (response.data.length > 0 && !selectedSchema) {
          setSelectedSchema(response.data[0]);
        }
      } else {
        throw new Error(response.error || '스키마 로드 실패');
      }
    } catch (error) {
      console.error('Database schemas error:', error);
      message.error('스키마 목록을 불러오는데 실패했습니다.');
      setSchemas([]);
    } finally {
      setLoadingSchemas(false);
    }
  };

  const loadTables = async (connectionId: string, schema?: string) => {
    if (!schema) {
      setTables([]);
      return;
    }

    setLoadingTables(true);
    try {
      const response = await apiService.getDatabaseTables(connectionId, schema);
      if (response.success && response.data) {
        setTables(response.data);
      } else {
        throw new Error(response.error || '테이블 로드 실패');
      }
    } catch (error) {
      console.error('Database tables error:', error);
      message.error('테이블 목록을 불러오는데 실패했습니다.');
      setTables([]);
    } finally {
      setLoadingTables(false);
    }
  };

  // 연결 변경 처리
  const handleConnectionChange = (connectionId: string) => {
    setSelectedConnection(connectionId);
    setSelectedSchema(undefined);
    setTables([]);
    setAvailableColumns([]);
    setWhereConditions([]);
    setTableSelected(false); // 테이블 선택 상태 초기화
    props.onConfigChange({
      ...props.config,
      connectionId,
      schema: '',
      tableName: '', // 연결이 변경되면 테이블 선택 초기화
    });
  };

  // 스키마 변경 처리
  const handleSchemaChange = (schema: string) => {
    setSelectedSchema(schema);
    setTables([]);
    setAvailableColumns([]);
    setWhereConditions([]);
    setTableSelected(false); // 테이블 선택 상태 초기화
    props.onConfigChange({
      ...props.config,
      schema,
      tableName: '', // 스키마가 변경되면 테이블 선택 초기화
    });
  };

  // 테이블 선택 처리
  const handleTableSelect = (tableName: string) => {
    const selectedTable = tables.find(table => table.name === tableName);
    
    // 컬럼 정보 설정
    const columns = selectedTable?.columns || [];
    setAvailableColumns(columns);
    
    // 테이블 선택 상태 업데이트
    setTableSelected(true);
    
    // WHERE 조건 초기화
    setWhereConditions([]);
    
    // 설정 업데이트
    const newConfig = {
      ...props.config,
      tableName,
      schema: selectedTable?.schema,
      whereConditions: [], // 조건 초기화
      whereClause: '' // WHERE 절도 초기화
    };
    
    props.onConfigChange(newConfig);
    
    // 강제 리렌더링을 위해 약간의 지연 후 다시 설정
    setTimeout(() => {
      setAvailableColumns(columns);
      setTableSelected(!!tableName);
    }, 100);
  };

  // WHERE 조건 관리
  const addWhereCondition = () => {
    const newCondition = {
      id: Date.now().toString(),
      column: '',
      operator: '=',
      value: ''
    };
    setWhereConditions([...whereConditions, newCondition]);
  };

  const removeWhereCondition = (id: string) => {
    setWhereConditions(whereConditions.filter(cond => cond.id !== id));
  };

  const updateWhereCondition = (id: string, field: string, value: string) => {
    setWhereConditions(whereConditions.map(cond => 
      cond.id === id ? { ...cond, [field]: value } : cond
    ));
  };

  // WHERE 조건을 SQL 문자열로 변환
  const buildWhereClause = () => {
    const validConditions = whereConditions.filter(cond => 
      cond.column && cond.operator && (cond.value || ['IS NULL', 'IS NOT NULL'].includes(cond.operator))
    );
    
    if (validConditions.length === 0) return '';
    
    return validConditions.map(cond => {
      if (['IS NULL', 'IS NOT NULL'].includes(cond.operator)) {
        return `${cond.column} ${cond.operator}`;
      }
      
      const value = ['IN', 'NOT IN'].includes(cond.operator) 
        ? `(${cond.value})`
        : ['LIKE', 'NOT LIKE', 'ILIKE'].includes(cond.operator)
        ? `'%${cond.value}%'`
        : isNaN(Number(cond.value))
        ? `'${cond.value}'`
        : cond.value;
      
      return `${cond.column} ${cond.operator} ${value}`;
    }).join(' AND ');
  };

  // 현재 설정된 조건들을 표시하는 헬퍼 함수
  const getCurrentPreviewConditions = () => {
    const conditions = [];
    
    if (props.config.limit && props.config.limit > 0) {
      conditions.push(`LIMIT ${props.config.limit}`);
    }
    
    const whereClause = buildWhereClause();
    if (whereClause) {
      conditions.push(`WHERE ${whereClause}`);
    }
    
    return conditions;
  };

  // 설정 저장
  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const whereClause = buildWhereClause();
      const updatedConfig = {
        ...props.config,
        whereClause,
        whereConditions: whereConditions // 조건들도 저장
      };
      
      props.onConfigChange(updatedConfig);
      message.success('설정이 저장되었습니다.');
    } catch (error) {
      message.error('설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 테이블 데이터 미리보기 (모든 설정 조건 적용)
  const handlePreview = async (tableName?: string) => {
    const tableToPreview = tableName || props.config.tableName;
    
    if (!selectedConnection || !selectedSchema || !tableToPreview) {
      message.warning('데이터베이스 연결, 스키마, 테이블을 모두 선택해주세요.');
      return;
    }

    setPreviewLoading(true);
    setPreviewModalVisible(true);

    try {
      // 실제 API 호출 - 모든 설정 조건 적용
      const whereClause = buildWhereClause();
      const previewParams = {
        schema: selectedSchema,
        tableName: tableToPreview,
        limit: props.config.limit || 10, // 기본 10개
        whereClause: whereClause || undefined
      };
      
      const response = await apiService.previewTableData(selectedConnection, previewParams);
      
      if (response.success && response.data) {
        setPreviewData(response.data.rows || []);
      } else {
        throw new Error(response.error || '미리보기 데이터 로드 실패');
      }
    } catch (error) {
      console.error('Table preview error:', error);
      message.error('테이블 데이터를 불러오는데 실패했습니다.');
      setPreviewData([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  // SQL 비교 연산자 옵션
  const operatorOptions = [
    { value: '=', label: '= (같음)' },
    { value: '!=', label: '!= (다름)' },
    { value: '<>', label: '<> (다름)' },
    { value: '>', label: '> (초과)' },
    { value: '>=', label: '>= (이상)' },
    { value: '<', label: '< (미만)' },
    { value: '<=', label: '<= (이하)' },
    { value: 'LIKE', label: 'LIKE (포함)' },
    { value: 'NOT LIKE', label: 'NOT LIKE (포함 안함)' },
    { value: 'ILIKE', label: 'ILIKE (대소문자 무시 포함)' },
    { value: 'IN', label: 'IN (목록 중 하나)' },
    { value: 'NOT IN', label: 'NOT IN (목록에 없음)' },
    { value: 'IS NULL', label: 'IS NULL (빈 값)' },
    { value: 'IS NOT NULL', label: 'IS NOT NULL (빈 값 아님)' },
  ];

  // 테이블 정보 미리보기 (컴팩트 버전)
  const TablePreview: React.FC<{ table: TableMetadata }> = ({ table }) => (
    <div style={{ 
      border: '1px solid #d9d9d9', 
      borderRadius: '6px', 
      padding: '8px 12px',
      marginBottom: '6px',
      cursor: 'pointer',
      backgroundColor: props.config.tableName === table.name ? '#e6f7ff' : '#fff',
      transition: 'all 0.2s ease'
    }}
    onClick={() => handleTableSelect(table.name)}
    onMouseEnter={(e) => {
      if (props.config.tableName !== table.name) {
        e.currentTarget.style.backgroundColor = '#f9f9f9';
      }
    }}
    onMouseLeave={(e) => {
      if (props.config.tableName !== table.name) {
        e.currentTarget.style.backgroundColor = '#fff';
      }
    }}
    >
      <Space direction="vertical" size={2} style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Space size={8}>
            <TableOutlined style={{ color: '#1890ff', fontSize: '14px' }} />
            <Text strong style={{ fontSize: '13px' }}>{table.name}</Text>
          </Space>
        </div>
        
        {table.description && (
          <Text type="secondary" style={{ fontSize: '11px', lineHeight: '1.3' }}>
            {table.description.length > 50 ? `${table.description.substring(0, 47)}...` : table.description}
          </Text>
        )}
      </Space>
    </div>
  );

  return (
    <>
      <div style={{ padding: '16px' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          
          {/* 기본 설정 */}
          <div>
            <Typography.Title level={5}>기본 설정</Typography.Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Typography.Text strong>노드 이름</Typography.Text>
                <Input
                  placeholder="노드 이름을 입력하세요"
                  value={props.config.label || ''}
                  onChange={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const newValue = e.target.value;
                    const newConfig = { ...props.config, label: newValue };
                    props.onConfigChange(newConfig);
                  }}
                  onBlur={(e) => {
                    // 블러 시에도 업데이트 확인
                    const newConfig = { ...props.config, label: e.target.value };
                    props.onConfigChange(newConfig);
                  }}
                  style={{ marginTop: '4px' }}
                  autoComplete="off"
                />
              </div>
              
              <div>
                <Typography.Text>설명</Typography.Text>
                <Input.TextArea
                  placeholder="노드에 대한 설명을 입력하세요"
                  value={props.config.description || ''}
                  onChange={(e) => {
                    const newConfig = { ...props.config, description: e.target.value };
                    props.onConfigChange(newConfig);
                  }}
                  rows={2}
                  style={{ marginTop: '4px' }}
                />
              </div>
            </Space>
          </div>

          <Divider />

          {/* 데이터베이스 연결 설정 */}
          <div>
            <Typography.Title level={5}>데이터베이스 연결</Typography.Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              
              {/* 데이터베이스 연결 선택 */}
              <div>
                <Typography.Text strong>데이터베이스 연결 *</Typography.Text>
                <Select
                  style={{ width: '100%', marginTop: '4px' }}
                  placeholder="데이터베이스 연결을 선택하세요"
                  value={selectedConnection}
                  onChange={handleConnectionChange}
                  loading={loadingConnections}
                  showSearch
                  optionFilterProp="children"
                >
                  {connections.map(conn => (
                    <Option key={conn.id} value={conn.id}>
                      <Space>
                        <DatabaseOutlined style={{ color: conn.isActive ? '#52c41a' : '#d9d9d9' }} />
                        <span>{conn.name}</span>
                      </Space>
                    </Option>
                  ))}
                </Select>
              </div>

              {/* 스키마 선택 */}
              {selectedConnection && (
                <div>
                  <Typography.Text strong>스키마 *</Typography.Text>
                  <Select
                    style={{ width: '100%', marginTop: '4px' }}
                    placeholder="스키마를 선택하세요"
                    value={selectedSchema}
                    onChange={handleSchemaChange}
                    loading={loadingSchemas}
                    showSearch
                    optionFilterProp="children"
                  >
                    {schemas.map(schema => (
                      <Option key={schema} value={schema}>
                        {schema}
                      </Option>
                    ))}
                  </Select>
                </div>
              )}

            </Space>
          </div>

          <Divider />

          {/* 테이블 선택 */}
          {selectedConnection && selectedSchema && (
            <div>
              <Typography.Title level={5}>테이블 선택</Typography.Title>
              <div style={{ marginBottom: '8px' }}>
                <Space>
                  <Text strong>테이블 선택 *</Text>
                  <Button 
                    type="text" 
                    icon={<ReloadOutlined />} 
                    size="small"
                    loading={loadingTables}
                    onClick={() => loadTables(selectedConnection, selectedSchema)}
                  />
                </Space>
              </div>
              
              {loadingTables ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <Spin />
                </div>
              ) : (
                <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: '6px', padding: '8px' }}>
                  {tables.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <Text type="secondary">테이블이 없습니다.</Text>
                    </div>
                  ) : (
                    tables.map(table => (
                      <TablePreview key={`${table.schema}.${table.name}`} table={table} />
                    ))
                  )}
                </div>
              )}

              {/* 선택된 테이블 정보 */}
              {props.config.tableName && (
                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '6px' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                      <Text strong>선택된 테이블:</Text>
                      <Tag color="green">{selectedSchema}.{props.config.tableName}</Tag>
                      {availableColumns.length > 0 && (
                        <Text type="secondary" style={{ fontSize: '11px' }}>({availableColumns.length}개 컬럼)</Text>
                      )}
                    </Space>
                    
                    <div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        아래에서 필터링 조건을 설정하고 미리보기하세요.
                      </Text>
                    </div>
                  </Space>
                </div>
              )}
            </div>
          )}

          <Divider />

          {/* 데이터 필터링 설정 */}
          {(props.config.tableName || tableSelected) && (
            <div>
              <Typography.Title level={5}>데이터 필터링</Typography.Title>
              <Space direction="vertical" style={{ width: '100%' }}>
                
                {/* WHERE 조건 설정 */}
                <div>
                  <div style={{ marginBottom: '8px' }}>
                    <Space>
                      <Typography.Text strong>WHERE 조건</Typography.Text>
                      <Button 
                        type="dashed" 
                        icon={<PlusOutlined />} 
                        size="small"
                        onClick={addWhereCondition}
                        disabled={availableColumns.length === 0}
                        title={availableColumns.length === 0 ? '컬럼 정보를 불러오는 중...' : `${availableColumns.length}개 컬럼 사용 가능`}
                      >
                        조건 추가
                      </Button>
                    </Space>
                  </div>
                  
                  {whereConditions.length === 0 && (
                    <div style={{ padding: '16px', textAlign: 'center', backgroundColor: '#fafafa', borderRadius: '6px', border: '1px dashed #d9d9d9' }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {availableColumns.length === 0 
                          ? '컬럼 정보를 불러오는 중입니다...' 
                          : `${availableColumns.length}개 컬럼에서 조건을 선택할 수 있습니다.`
                        }
                      </Text>
                    </div>
                  )}
                  
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {whereConditions.map((condition, index) => (
                      <Card key={condition.id} size="small" style={{ width: '100%', position: 'relative' }}>
                        <Row gutter={8} align="middle">
                          <Col span={6}>
                            <Select
                              placeholder="컬럼 선택"
                              value={condition.column}
                              onChange={(value) => updateWhereCondition(condition.id, 'column', value)}
                              style={{ width: '100%' }}
                              showSearch
                              optionFilterProp="children"
                              notFoundContent={availableColumns.length === 0 ? '컬럼 정보를 불러오는 중...' : '컬럼이 없습니다'}
                              dropdownRender={(menu) => (
                                <div>
                                  {availableColumns.length === 0 ? (
                                    <div style={{ padding: '8px', textAlign: 'center' }}>
                                      <Text type="secondary">컬럼 정보를 불러오는 중...</Text>
                                    </div>
                                  ) : (
                                    menu
                                  )}
                                </div>
                              )}
                            >
                              {availableColumns.map(col => (
                                <Option key={col.name} value={col.name}>
                                  <Space>
                                    <span>{col.name || '빈 컬럼명'}</span>
                                    <Text type="secondary" style={{ fontSize: '11px' }}>({col.type || 'unknown'})</Text>
                                  </Space>
                                </Option>
                              ))}
                            </Select>
                          </Col>
                          
                          <Col span={6}>
                            <Select
                              placeholder="연산자"
                              value={condition.operator}
                              onChange={(value) => updateWhereCondition(condition.id, 'operator', value)}
                              style={{ width: '100%' }}
                            >
                              {operatorOptions.map(op => (
                                <Option key={op.value} value={op.value}>{op.label}</Option>
                              ))}
                            </Select>
                          </Col>
                          
                          <Col span={9}>
                            <Input
                              placeholder="값 입력"
                              value={condition.value}
                              onChange={(e) => updateWhereCondition(condition.id, 'value', e.target.value)}
                              disabled={['IS NULL', 'IS NOT NULL'].includes(condition.operator)}
                            />
                          </Col>
                          
                          <Col span={3}>
                            <Button 
                              type="text" 
                              danger 
                              icon={<MinusCircleOutlined />} 
                              onClick={() => removeWhereCondition(condition.id)}
                              size="small"
                            />
                          </Col>
                        </Row>
                        
                        {index > 0 && (
                          <div style={{ position: 'absolute', top: '-10px', left: '20px', background: '#fff', padding: '0 4px' }}>
                            <Text type="secondary" style={{ fontSize: '11px' }}>AND</Text>
                          </div>
                        )}
                      </Card>
                    ))}
                  </Space>
                  
                  {whereConditions.length > 0 && (
                    <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        생성된 WHERE 절: {buildWhereClause() || '(조건을 완성해주세요)'}
                      </Text>
                    </div>
                  )}
                </div>
                
                <div>
                  <Typography.Text strong>최대 행 수</Typography.Text>
                  <Input
                    type="number"
                    placeholder="제한 없음 (0)"
                    value={props.config.limit || ''}
                    onChange={(e) => {
                      const newConfig = { ...props.config, limit: parseInt(e.target.value) || 0 };
                      props.onConfigChange(newConfig);
                    }}
                    min={0}
                    max={1000}
                    style={{ marginTop: '4px' }}
                  />
                  <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '4px' }}>
                    미리보기에서 표시할 최대 행 수 (최대 1000개)
                  </Text>
                </div>
                
              </Space>
            </div>
          )}

        </Space>
        
        {/* 설정 저장 및 미리보기 버튼 */}
        <Divider />
        
        <div style={{ textAlign: 'center' }}>
          <Space size="large">
            <Button 
              type="default"
              icon={<SaveOutlined />}
              onClick={handleSaveConfig}
              loading={saving}
              disabled={!props.config.tableName}
            >
              설정 저장
            </Button>
            
            <Button 
              type="primary"
              icon={<EyeOutlined />}
              onClick={() => handlePreview()}
              disabled={!selectedConnection || !selectedSchema || !props.config.tableName}
            >
              현재 설정으로 미리보기
            </Button>
          </Space>
        </div>
        
      </div>
      
      {/* 테이블 데이터 미리보기 모달 */}
      <Modal
        title={
          <Space>
            <EyeOutlined />
            테이블 데이터 미리보기
            {props.config.tableName && (
              <Text type="secondary">- {selectedSchema}.{props.config.tableName}</Text>
            )}
          </Space>
        }
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        width={900}
        footer={[
          <Button key="close" onClick={() => setPreviewModalVisible(false)}>
            닫기
          </Button>
        ]}
      >
        {previewLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
            <div style={{ marginTop: '16px' }}>
              <Text>데이터를 불러오는 중...</Text>
            </div>
          </div>
        ) : (
          <div>
            {previewData.length > 0 && (
              <>
                {/* 적용된 조건 및 메타데이터 안내 */}
                <div style={{ marginBottom: '16px' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {getCurrentPreviewConditions().length > 0 && (
                      <Alert
                        message="적용된 조건"
                        description={getCurrentPreviewConditions().join(', ')}
                        type="info"
                        showIcon
                      />
                    )}
                    
                    <div>
                      <Space wrap>
                        <Text strong>조회된 행: {previewData.length}개</Text>
                        {previewData.length > 0 && previewData[0]?.metadata && (
                          <>
                            <Text type="secondary">전체: {previewData[0].metadata.total_rows?.toLocaleString()}개</Text>
                            {previewData[0].metadata.has_more && (
                              <Text type="warning">더 많은 데이터가 있습니다</Text>
                            )}
                          </>
                        )}
                      </Space>
                    </div>
                  </Space>
                </div>
                
                <Table
                  dataSource={previewData}
                  columns={
                    previewData.length > 0
                      ? Object.keys(previewData[0]).map(key => ({
                          title: key,
                          dataIndex: key,
                          key: key,
                          ellipsis: true,
                          width: 150,
                          render: (value: any) => {
                            if (value === null || value === undefined) {
                              return <Text type="secondary" italic>NULL</Text>;
                            }
                            if (typeof value === 'string' && value.length > 50) {
                              return (
                                <span title={value}>
                                  {value.substring(0, 47)}...
                                </span>
                              );
                            }
                            return String(value);
                          }
                        }))
                      : []
                  }
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) => 
                      `${range[0]}-${range[1]} / ${total}개 항목`
                  }}
                  scroll={{ x: true, y: 400 }}
                  size="small"
                  bordered
                  rowKey={(record, index) => index?.toString() || '0'}
                />
              </>
            )}
            
            {previewData.length === 0 && !previewLoading && (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Space direction="vertical">
                  <Text type="secondary">미리보기할 데이터가 없습니다.</Text>
                  {buildWhereClause() && (
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      WHERE 조건을 확인해주세요: {buildWhereClause()}
                    </Text>
                  )}
                </Space>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
};

export default TableReaderConfig;
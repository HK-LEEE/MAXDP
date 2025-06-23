/**
 * Custom SQL 노드 설정 컴포넌트
 * CLAUDE.local.md 가이드라인에 따른 사용자 정의 SQL 쿼리 노드 설정
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button, Select, Space, message, Typography, Card, Divider, Modal, Table, Tag, Alert } from 'antd';
import { 
  PlayCircleOutlined, 
  DatabaseOutlined, 
  CodeOutlined,
  FormatPainterOutlined,
  HistoryOutlined,
  EyeOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { Input } from 'antd';
import { apiService } from '../../../services/api';

import BaseNodeConfig from '../BaseNodeConfig';
import { 
  NodeConfigProps, 
  CustomSQLConfig as CustomSQLConfigType,
  DatabaseConnection,
} from '../types';
import { customSQLSchema } from '../schemas';

const { TextArea } = Input;
const { Text } = Typography;
const { Option } = Select;

interface CustomSQLConfigProps extends NodeConfigProps<CustomSQLConfigType> {
  // 추가 props
}

/**
 * Custom SQL 노드 전용 설정 컴포넌트
 */
const CustomSQLConfig: React.FC<CustomSQLConfigProps> = (props) => {
  console.log('=== CustomSQLConfig RENDER ===');
  console.log('Node ID:', props.nodeId);
  console.log('Props config:', props.config);
  console.log('SQL Query:', props.config?.sqlQuery);
  console.log('Connection ID:', props.config?.connectionId);
  console.log('Label:', props.config?.label);
  console.log('Timestamp:', new Date().toISOString());
  const [connections, setConnections] = useState<DatabaseConnection[]>([
    {
      id: 'platform_db',
      name: 'Platform Database',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'platform_integration',
      schema: 'public',
      isActive: true,
    },
  ]);

  const [sqlHistory, setSqlHistory] = useState<string[]>([
    'SELECT * FROM users WHERE created_at > \'2023-01-01\'',
    'SELECT u.name, COUNT(o.id) as order_count FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.id, u.name',
    'SELECT * FROM products WHERE price BETWEEN 10 AND 100 ORDER BY price DESC',
  ]);

  const textAreaRef = useRef<any>(null);
  
  // 미리보기 관련 상태
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewColumns, setPreviewColumns] = useState<any[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // UI 표시용 로컬 상태 (props와 동기화)
  const [displaySQLQuery, setDisplaySQLQuery] = useState(() => {
    console.log('=== INITIALIZING DISPLAY SQL STATE ===');
    console.log('Initial SQL from props:', props.config?.sqlQuery);
    return props.config?.sqlQuery || '';
  });
  
  // debounce를 짧게 설정하여 즉시 반응하도록 함
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);


  // props 변경 시 displaySQLQuery 동기화
  useEffect(() => {
    console.log('=== Props SQL Update ===');
    console.log('Node ID:', props.nodeId);
    console.log('Props SQL:', props.config?.sqlQuery);
    console.log('Display SQL:', displaySQLQuery);
    
    // props에서 온 SQL이 현재 표시 중인 SQL과 다르고, 사용자가 편집 중이 아닐 때만 동기화
    if (props.config?.sqlQuery !== displaySQLQuery && !debounceTimeoutRef.current) {
      console.log('Syncing props to display state');
      setDisplaySQLQuery(props.config?.sqlQuery || '');
    }
  }, [props.nodeId, props.config?.sqlQuery, displaySQLQuery]);

  // 컴포넌트 언마운트 시 debounce 정리
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // SQL 쿼리 변경 처리 (즉시 UI 업데이트 + debounced 저장)
  const handleSQLChange = useCallback((sql: string) => {
    // UI 즉시 업데이트
    setDisplaySQLQuery(sql);
    
    // 기존 타이머 취소
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // 짧은 debounce (100ms)로 타이핑 성능 유지하면서 저장
    debounceTimeoutRef.current = setTimeout(() => {
      console.log('=== DEBOUNCED CONFIG UPDATE ===');
      console.log('Updating SQL from:', props.config?.sqlQuery);
      console.log('Updating SQL to:', sql);
      
      const updatedConfig = {
        ...(props.config || {}),
        sqlQuery: sql,
      };
      props.onConfigChange(updatedConfig);
      
      // 타이머 참조 클리어
      debounceTimeoutRef.current = null;
    }, 100);
  }, [props.config, props.onConfigChange]);

  // SQL 포맷팅
  const formatSQL = () => {
    const sql = displaySQLQuery || '';
    if (!sql.trim()) {
      message.warning('포맷팅할 SQL 쿼리를 입력하세요.');
      return;
    }

    // 간단한 SQL 포맷팅 로직
    const formatted = sql
      .replace(/\s+/g, ' ')
      .replace(/,\s*/g, ',\n    ')
      .replace(/\bSELECT\b/gi, 'SELECT')
      .replace(/\bFROM\b/gi, '\nFROM')
      .replace(/\bWHERE\b/gi, '\nWHERE')
      .replace(/\bJOIN\b/gi, '\nJOIN')
      .replace(/\bLEFT\s+JOIN\b/gi, '\nLEFT JOIN')
      .replace(/\bRIGHT\s+JOIN\b/gi, '\nRIGHT JOIN')
      .replace(/\bINNER\s+JOIN\b/gi, '\nINNER JOIN')
      .replace(/\bGROUP\s+BY\b/gi, '\nGROUP BY')
      .replace(/\bORDER\s+BY\b/gi, '\nORDER BY')
      .replace(/\bHAVING\b/gi, '\nHAVING');

    handleSQLChange(formatted);
    message.success('SQL이 포맷팅되었습니다.');
  };

  // SQL 쿼리 검증
  const validateSQL = () => {
    const sql = displaySQLQuery || '';
    
    if (!sql.trim()) {
      message.error('SQL 쿼리를 입력하세요.');
      return false;
    }

    // SELECT 쿼리만 허용
    if (!sql.trim().toLowerCase().startsWith('select')) {
      message.error('SELECT 쿼리만 허용됩니다.');
      return false;
    }

    // 위험한 키워드 체크
    const dangerousKeywords = ['drop', 'delete', 'insert', 'update', 'alter', 'create', 'truncate'];
    const sqlLower = sql.toLowerCase();
    
    for (const keyword of dangerousKeywords) {
      if (sqlLower.includes(keyword)) {
        message.error(`'${keyword.toUpperCase()}' 명령어는 허용되지 않습니다.`);
        return false;
      }
    }

    return true;
  };

  // SQL 히스토리에서 선택
  const selectFromHistory = (sql: string) => {
    handleSQLChange(sql);
    message.success('히스토리에서 SQL을 불러왔습니다.');
  };

  // 커서 위치에 텍스트 삽입
  const insertAtCursor = (text: string) => {
    const textArea = textAreaRef.current?.resizableTextArea?.textArea;
    if (!textArea) return;

    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    const currentValue = displaySQLQuery || '';
    const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
    
    handleSQLChange(newValue);
    
    // 커서 위치 복원
    setTimeout(() => {
      textArea.focus();
      textArea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  // 일반적인 SQL 템플릿
  const sqlTemplates = [
    {
      name: '기본 SELECT',
      sql: 'SELECT column1, column2\nFROM table_name\nWHERE condition;'
    },
    {
      name: 'JOIN 쿼리',
      sql: 'SELECT a.*, b.*\nFROM table_a a\nJOIN table_b b ON a.id = b.table_a_id\nWHERE condition;'
    },
    {
      name: 'GROUP BY 집계',
      sql: 'SELECT column1, COUNT(*) as count\nFROM table_name\nGROUP BY column1\nORDER BY count DESC;'
    },
    {
      name: '날짜 필터',
      sql: 'SELECT *\nFROM table_name\nWHERE date_column >= \'2023-01-01\'\n  AND date_column < \'2024-01-01\';'
    },
  ];

  // 미리보기 실행
  const handlePreview = useCallback(async () => {
    if (!validateSQL()) return;
    
    const connectionId = props.config?.connectionId;
    if (!connectionId) {
      message.error('먼저 데이터베이스 연결을 선택하세요.');
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);
    
    try {
      console.log('Executing SQL preview:', displaySQLQuery);
      
      // 현재 편집중인 SQL 사용 (미리보기는 실제 저장된 데이터가 아닌 현재 화면의 내용 사용)
      const sqlToExecute = displaySQLQuery || props.config?.sqlQuery || '';
      
      // 실제 API 호출
      const response = await apiService.executeCustomSQL({
        connectionId: connectionId,
        sqlQuery: sqlToExecute,
        schema: props.config?.schema || 'public',
        limit: 100 // 미리보기는 최대 100행으로 제한
      });
      
      if (response.success && response.data) {
        const { columns, rows } = response.data;
        
        // Table columns 구성 - backend의 column_name을 name으로 매핑
        const tableColumns = columns.map((col: any) => {
          const columnName = col.column_name || col.name || 'unknown';
          const columnType = col.data_type || col.type || 'unknown';
          
          return {
            title: (
              <Space>
                <Text strong>{columnName}</Text>
                <Tag color={getColumnTypeColor(columnType)} size="small">
                  {columnType}
                </Tag>
              </Space>
            ),
            dataIndex: columnName,
            key: columnName,
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
        setPreviewData(rows.map((row: any, index: number) => ({ ...row, key: index })));
        setPreviewModalVisible(true);
        
        // SQL 히스토리에 추가
        if (!sqlHistory.includes(sqlToExecute)) {
          setSqlHistory([sqlToExecute, ...sqlHistory.slice(0, 9)]);
        }
        
        message.success({
          content: `SQL 쿼리가 성공적으로 실행되었습니다. (${rows.length}행 반환)`,
          duration: 3,
        });
      } else {
        throw new Error(response.error || 'SQL 실행 실패');
      }
    } catch (error: any) {
      console.error('SQL preview error:', error);
      const errorMessage = error.response?.data?.detail || error.message || '쿼리 실행 중 오류가 발생했습니다.';
      setPreviewError(errorMessage);
      
      // API 실패 시 모킹 데이터로 폴백
      console.log('API failed, using mock data for preview...');
      const mockColumns = [
        { column_name: 'id', data_type: 'integer' },
        { column_name: 'name', data_type: 'varchar' },
        { column_name: 'email', data_type: 'varchar' },
        { column_name: 'created_at', data_type: 'timestamp' },
        { column_name: 'status', data_type: 'varchar' },
      ];
      
      const mockData = Array.from({ length: 10 }, (_, index) => ({
        key: index,
        id: index + 1,
        name: `User ${index + 1}`,
        email: `user${index + 1}@example.com`,
        created_at: new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0],
        status: ['active', 'inactive', 'pending'][Math.floor(Math.random() * 3)],
      }));
      
      const tableColumns = mockColumns.map(col => {
        const columnName = col.column_name;
        const columnType = col.data_type;
        
        return {
          title: (
            <Space>
              <Text strong>{columnName}</Text>
              <Tag color={getColumnTypeColor(columnType)} size="small">
                {columnType}
              </Tag>
            </Space>
          ),
          dataIndex: columnName,
          key: columnName,
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
      
      message.warning(`API 연결 실패로 모킹 데이터를 표시합니다: ${errorMessage}`);
    } finally {
      setPreviewLoading(false);
    }
  }, [props.config?.connectionId, props.config?.sqlQuery, props.config?.schema, sqlHistory, validateSQL]);

  // 컬럼 타입별 색상
  const getColumnTypeColor = (type: string) => {
    const typeColors: Record<string, string> = {
      'integer': 'blue',
      'bigint': 'blue',
      'varchar': 'green',
      'text': 'green',
      'timestamp': 'purple',
      'date': 'purple',
      'boolean': 'orange',
      'decimal': 'cyan',
      'float': 'cyan',
      'numeric': 'cyan',
    };
    return typeColors[type?.toLowerCase()] || 'default';
  };

  // 설정 저장 (즉시 저장)
  const handleSave = useCallback(() => {
    if (!validateSQL()) return;
    
    if (!props.config?.connectionId) {
      message.error('데이터베이스 연결을 선택하세요.');
      return;
    }

    const currentSQL = displaySQLQuery || '';
    if (!currentSQL.trim()) {
      message.error('SQL 쿼리를 입력하세요.');
      return;
    }
    
    try {
      // 진행 중인 debounce 타이머가 있으면 즉시 실행
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      
      // 현재 편집중인 SQL을 즉시 저장
      const configToSave = {
        ...(props.config || {}),
        sqlQuery: currentSQL.trim(),
        connectionId: props.config?.connectionId,
        schema: props.config?.schema || 'public',
        lastModified: new Date().toISOString(),
        validated: true,
        isReadyForExecution: true,
      };

      console.log('=== MANUAL SAVE CUSTOM SQL CONFIGURATION ===');
      console.log('Current config:', props.config);
      console.log('Config to save:', configToSave);
      
      // 즉시 저장 호출
      props.onConfigChange(configToSave);
      
      // 노드 검증 상태 업데이트
      if (props.onValidate) {
        props.onValidate(true, configToSave);
      }
      
      message.success('Custom SQL 설정이 저장되었습니다.');
      
      console.log('=== MANUAL SAVE COMPLETED ===');
      
    } catch (error: any) {
      console.error('=== MANUAL SAVE ERROR ===', error);
      message.error('설정 저장 중 오류가 발생했습니다.');
    }
  }, [props.config, props.onConfigChange, props.onValidate, validateSQL, displaySQLQuery]);


  // 연결 ID 변경 핸들러
  const handleConnectionChange = useCallback((value: string) => {
    if (props.config?.connectionId === value) return;
    const updatedConfig = {
      ...(props.config || {}),
      connectionId: value,
    };
    props.onConfigChange(updatedConfig);
  }, [props.config?.connectionId, props.onConfigChange]);

  // 스키마 변경 핸들러
  const handleSchemaChange = useCallback((value: string) => {
    if (props.config?.schema === value) return;
    const updatedConfig = {
      ...(props.config || {}),
      schema: value,
    };
    props.onConfigChange(updatedConfig);
  }, [props.config?.schema, props.onConfigChange]);

  // 스키마 업데이트 (SQL 에디터 추가)
  const enhancedSchema = {
    ...customSQLSchema,
    sections: customSQLSchema.sections.map(section => {
      if (section.title === 'SQL 쿼리') {
        return {
          ...section,
          fields: section.fields.map(field => {
            if (field.key === 'sqlQuery') {
              return {
                ...field,
                customComponent: (
                  <div>
                    {/* SQL 도구 모음 */}
                    <Card size="small" style={{ marginBottom: '8px' }}>
                      <Space wrap>
                        <Button 
                          size="small" 
                          icon={<FormatPainterOutlined />}
                          onClick={formatSQL}
                        >
                          포맷팅
                        </Button>
                        <Button 
                          size="small" 
                          icon={<PlayCircleOutlined />}
                          type="primary"
                          onClick={() => {
                            if (validateSQL()) {
                              message.info('SQL 검증이 완료되었습니다.');
                            }
                          }}
                        >
                          검증
                        </Button>
                        <Divider type="vertical" />
                        <Text style={{ fontSize: '12px' }}>템플릿:</Text>
                        {sqlTemplates.map((template, index) => (
                          <Button 
                            key={index}
                            size="small" 
                            type="text"
                            onClick={() => insertAtCursor(template.sql)}
                          >
                            {template.name}
                          </Button>
                        ))}
                      </Space>
                    </Card>

                    {/* SQL 에디터 */}
                    <TextArea
                      ref={textAreaRef}
                      value={displaySQLQuery}
                      onChange={(e) => handleSQLChange(e.target.value)}
                      placeholder="SELECT * FROM table_name WHERE condition"
                      rows={8}
                      style={{ 
                        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                        fontSize: '13px',
                        lineHeight: '1.4',
                      }}
                      showCount
                    />

                    {/* SQL 히스토리 */}
                    {sqlHistory.length > 0 && (
                      <>
                        <Divider />
                        <div style={{ marginTop: '8px' }}>
                          <Text strong style={{ fontSize: '12px' }}>
                            <HistoryOutlined /> 최근 사용한 쿼리:
                          </Text>
                          <div style={{ 
                            maxHeight: '150px', 
                            overflowY: 'auto',
                            marginTop: '4px',
                          }}>
                            {sqlHistory.map((sql, index) => (
                              <Card 
                                key={index}
                                size="small" 
                                hoverable
                                style={{ 
                                  marginBottom: '4px',
                                  cursor: 'pointer',
                                }}
                                onClick={() => selectFromHistory(sql)}
                              >
                                <Text 
                                  style={{ 
                                    fontSize: '11px',
                                    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                                  }}
                                  ellipsis={{ tooltip: sql }}
                                >
                                  {sql}
                                </Text>
                              </Card>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ),
              };
            }
            return field;
          }),
        };
      }

      if (section.title === '데이터베이스 연결') {
        return {
          ...section,
          fields: section.fields.map(field => {
            if (field.key === 'connectionId') {
              return {
                ...field,
                customComponent: (
                  <div>
                    <div style={{ marginBottom: '8px' }}>
                      <Text strong>데이터베이스 연결 *</Text>
                    </div>
                    <Select
                      value={props.config?.connectionId}
                      onChange={handleConnectionChange}
                      style={{ width: '100%' }}
                      placeholder="데이터베이스 연결을 선택하세요"
                      size="large"
                      optionLabelProp="label"
                      dropdownStyle={{ minWidth: '400px' }}
                    >
                      {connections.map(conn => (
                        <Option 
                          key={conn.id} 
                          value={conn.id}
                          label={
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              <DatabaseOutlined style={{ color: '#52c41a', flexShrink: 0 }} />
                              <span style={{ 
                                fontWeight: 500,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {conn.name}
                              </span>
                            </div>
                          }
                        >
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column',
                            gap: '4px',
                            padding: '4px 0',
                            minWidth: 0,
                            width: '100%'
                          }}>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px',
                              minWidth: 0,
                              width: '100%'
                            }}>
                              <DatabaseOutlined style={{ color: '#52c41a', flexShrink: 0 }} />
                              <div style={{ 
                                fontWeight: 500,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1,
                                minWidth: 0
                              }}>
                                {conn.name}
                              </div>
                            </div>
                            <div style={{ 
                              paddingLeft: '24px',
                              minWidth: 0,
                              width: '100%'
                            }}>
                              <Text type="secondary" style={{ 
                                fontSize: '12px',
                                display: 'block',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {conn.type} - {conn.host}:{conn.port}/{conn.database}
                              </Text>
                            </div>
                          </div>
                        </Option>
                      ))}
                    </Select>
                    
                    {/* 스키마 선택 (이미지에서 보인 부분) */}
                    {props.config?.connectionId && (
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ marginBottom: '8px' }}>
                          <Text strong>스키마 *</Text>
                        </div>
                        <Select
                          value={props.config?.schema || 'public'}
                          onChange={handleSchemaChange}
                          style={{ width: '100%' }}
                          placeholder="스키마를 선택하세요"
                          size="large"
                          optionLabelProp="label"
                          dropdownStyle={{ minWidth: '300px' }}
                        >
                          <Option 
                            value="public"
                            label={
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                <span style={{ color: '#1890ff', flexShrink: 0 }}>📁</span>
                                <span style={{ 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis', 
                                  whiteSpace: 'nowrap' 
                                }}>
                                  public
                                </span>
                              </div>
                            }
                          >
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px', 
                              width: '100%',
                              minWidth: 0
                            }}>
                              <span style={{ color: '#1890ff', flexShrink: 0 }}>📁</span>
                              <Text style={{ 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis', 
                                whiteSpace: 'nowrap',
                                flex: 1,
                                minWidth: 0
                              }}>
                                public
                              </Text>
                            </div>
                          </Option>
                          <Option 
                            value="staging"
                            label={
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                <span style={{ color: '#fa8c16', flexShrink: 0 }}>📁</span>
                                <span style={{ 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis', 
                                  whiteSpace: 'nowrap' 
                                }}>
                                  staging
                                </span>
                              </div>
                            }
                          >
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px', 
                              width: '100%',
                              minWidth: 0
                            }}>
                              <span style={{ color: '#fa8c16', flexShrink: 0 }}>📁</span>
                              <Text style={{ 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis', 
                                whiteSpace: 'nowrap',
                                flex: 1,
                                minWidth: 0
                              }}>
                                staging
                              </Text>
                            </div>
                          </Option>
                          <Option 
                            value="analytics"
                            label={
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                <span style={{ color: '#722ed1', flexShrink: 0 }}>📁</span>
                                <span style={{ 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis', 
                                  whiteSpace: 'nowrap' 
                                }}>
                                  analytics
                                </span>
                              </div>
                            }
                          >
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px', 
                              width: '100%',
                              minWidth: 0
                            }}>
                              <span style={{ color: '#722ed1', flexShrink: 0 }}>📁</span>
                              <Text style={{ 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis', 
                                whiteSpace: 'nowrap',
                                flex: 1,
                                minWidth: 0
                              }}>
                                analytics
                              </Text>
                            </div>
                          </Option>
                        </Select>
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
    <div>
      <BaseNodeConfig
        {...props}
        schema={enhancedSchema}
        onPreview={undefined}
        previewLoading={false}
      />

      {/* Custom SQL 전용 액션 버튼들 */}
      <div style={{ 
        marginTop: '24px', 
        padding: '16px', 
        backgroundColor: '#fafafa', 
        borderRadius: '8px',
        border: '1px solid #f0f0f0'
      }}>
        <div style={{ marginBottom: '12px' }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            미리보기에서 표시할 최대 행 수 (최대 1000개)
          </Text>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <Button
            icon={<SaveOutlined />}
            onClick={handleSave}
            disabled={
              !displaySQLQuery?.trim() || 
              !props.config?.connectionId ||
              previewLoading
            }
            style={{ 
              minWidth: '120px',
              height: '40px',
              fontSize: '14px',
              fontWeight: 500
            }}
          >
            설정 저장
          </Button>
          <Button
            type="primary"
            icon={previewLoading ? undefined : <EyeOutlined />}
            onClick={handlePreview}
            loading={previewLoading}
            disabled={
              !displaySQLQuery?.trim() || 
              !props.config?.connectionId ||
              previewLoading
            }
            style={{ 
              minWidth: '180px',
              height: '40px',
              fontSize: '14px',
              fontWeight: 500
            }}
          >
            {previewLoading ? '미리보기 실행 중...' : '현재 설정으로 미리보기'}
          </Button>
        </div>
      </div>

      {/* SQL 미리보기 모달 */}
      <Modal
        title={
          <Space>
            <CodeOutlined />
            <Text strong>Custom SQL 쿼리 결과</Text>
          </Space>
        }
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        width={1200}
        footer={[
          <Button key="close" onClick={() => setPreviewModalVisible(false)}>
            닫기
          </Button>,
        ]}
      >
        <div style={{ marginBottom: '12px' }}>
          <Card size="small">
            <div style={{ fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
              {displaySQLQuery || props.config?.sqlQuery || ''}
            </div>
          </Card>
        </div>
        
        {previewError ? (
          <Alert
            type="error"
            showIcon
            message="SQL 실행 오류"
            description={previewError}
            style={{ marginBottom: '16px' }}
          />
        ) : (
          <Table
            dataSource={previewData}
            columns={previewColumns}
            size="small"
            scroll={{ x: previewColumns.length * 150, y: 400 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: false,
              showTotal: (total) => `총 ${total}행`,
            }}
            rowKey={(record, index) => index?.toString() || '0'}
          />
        )}
      </Modal>
    </div>
  );
};

CustomSQLConfig.displayName = 'CustomSQLConfig';

export default CustomSQLConfig;
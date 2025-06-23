/**
 * Filter Rows 노드 설정 컴포넌트
 * CLAUDE.local.md 가이드라인에 따른 행 필터링 노드 설정
 */

import React, { useState, useEffect } from 'react';
import { 
  Button, 
  Select, 
  Space, 
  message, 
  Typography, 
  Card,
  Input,
  Divider,
  Tag,
  List,
  Switch,
  InputNumber,
  DatePicker,
  Empty,
  Tooltip,
  Spin,
  Alert,
} from 'antd';
import { 
  PlusOutlined,
  DeleteOutlined,
  FilterOutlined,
  CodeOutlined,
  FunctionOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import BaseNodeConfig from '../BaseNodeConfig';
import { 
  NodeConfigProps, 
  FilterRowsConfig as FilterRowsConfigType,
  FilterCondition,
} from '../types';
import { filterRowsSchema } from '../schemas';
import { getInputSchema, ColumnInfo } from '../../../utils/schemaUtils';

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface FilterRowsConfigProps extends NodeConfigProps<FilterRowsConfigType> {
  nodes?: any[];
  edges?: any[];
}

interface ExtendedColumnInfo extends ColumnInfo {
  sampleValues?: string[];
}

/**
 * Filter Rows 노드 전용 설정 컴포넌트
 */
const FilterRowsConfig: React.FC<FilterRowsConfigProps> = (props) => {
  const { nodes = [], edges = [] } = props;
  
  const [availableColumns, setAvailableColumns] = useState<ExtendedColumnInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

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
      console.log('Loading input schema for Filter Rows node:', props.nodeId);
      const schemaInfo = await getInputSchema(props.nodeId, nodes, edges);
      
      if (schemaInfo && schemaInfo.columns.length > 0) {
        console.log('Schema loaded successfully:', schemaInfo);
        // 컬럼 정보에 샘플 값 추가 (실제로는 API에서 가져와야 함)
        const columnsWithSamples: ExtendedColumnInfo[] = schemaInfo.columns.map(col => ({
          ...col,
          sampleValues: generateSampleValues(col.type)
        }));
        setAvailableColumns(columnsWithSamples);
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

  // 컬럼 타입에 따른 샘플 값 생성
  const generateSampleValues = (type: string): string[] => {
    const typeUpper = type.toUpperCase();
    
    if (typeUpper.includes('INT') || typeUpper.includes('NUMBER')) {
      return ['1', '2', '3', '100', '500'];
    } else if (typeUpper.includes('VARCHAR') || typeUpper.includes('TEXT') || typeUpper.includes('STRING')) {
      return ['Sample Text', 'Example Value', 'Test Data'];
    } else if (typeUpper.includes('BOOL')) {
      return ['true', 'false'];
    } else if (typeUpper.includes('DATE') || typeUpper.includes('TIME')) {
      return ['2023-01-01', '2024-01-01', '2024-06-15'];
    } else if (typeUpper.includes('DECIMAL') || typeUpper.includes('FLOAT')) {
      return ['10.5', '25.75', '100.00'];
    }
    
    return ['Sample', 'Example', 'Test'];
  };

  // 현재 필터 조건들
  const filterConditions = props.config.filters || [];

  // 필터 조건 추가
  const addFilterCondition = () => {
    const newCondition: FilterCondition = {
      id: `condition_${Date.now()}`,
      column: '',
      operator: 'equals',
      value: '',
      logicalOperator: filterConditions.length > 0 ? 'AND' : undefined,
    };

    props.onConfigChange({
      ...props.config,
      filters: [...filterConditions, newCondition],
    });
  };

  // 필터 조건 제거
  const removeFilterCondition = (conditionId: string) => {
    const newConditions = filterConditions.filter(condition => condition.id !== conditionId);
    props.onConfigChange({
      ...props.config,
      filters: newConditions,
    });
  };

  // 필터 조건 업데이트
  const updateFilterCondition = (conditionId: string, updates: Partial<FilterCondition>) => {
    const newConditions = filterConditions.map(condition =>
      condition.id === conditionId ? { ...condition, ...updates } : condition
    );

    props.onConfigChange({
      ...props.config,
      filters: newConditions,
    });
  };

  // 연산자 옵션 (컬럼 타입별)
  const getOperatorOptions = (columnType: string) => {
    const baseOperators = [
      { value: 'equals', label: '같음 (=)', example: 'value = "John"' },
      { value: 'not_equals', label: '같지 않음 (≠)', example: 'value ≠ "John"' },
      { value: 'is_null', label: '비어있음 (IS NULL)', example: 'value IS NULL' },
      { value: 'is_not_null', label: '비어있지 않음 (IS NOT NULL)', example: 'value IS NOT NULL' },
    ];

    if (columnType === 'varchar' || columnType === 'text') {
      return [
        ...baseOperators,
        { value: 'contains', label: '포함 (LIKE)', example: 'value LIKE "%John%"' },
        { value: 'starts_with', label: '시작 (LIKE)', example: 'value LIKE "John%"' },
        { value: 'ends_with', label: '끝남 (LIKE)', example: 'value LIKE "%John"' },
        { value: 'in', label: '목록에 포함 (IN)', example: 'value IN ("A", "B", "C")' },
      ];
    }

    if (columnType === 'integer' || columnType === 'decimal' || columnType === 'float') {
      return [
        ...baseOperators,
        { value: 'greater_than', label: '큼 (>)', example: 'value > 100' },
        { value: 'greater_equal', label: '크거나 같음 (≥)', example: 'value ≥ 100' },
        { value: 'less_than', label: '작음 (<)', example: 'value < 100' },
        { value: 'less_equal', label: '작거나 같음 (≤)', example: 'value ≤ 100' },
        { value: 'between', label: '범위 (BETWEEN)', example: 'value BETWEEN 10 AND 100' },
      ];
    }

    if (columnType === 'timestamp' || columnType === 'date') {
      return [
        ...baseOperators,
        { value: 'greater_than', label: '이후 (>)', example: 'date > "2023-01-01"' },
        { value: 'less_than', label: '이전 (<)', example: 'date < "2023-12-31"' },
        { value: 'between', label: '기간 (BETWEEN)', example: 'date BETWEEN "2023-01-01" AND "2023-12-31"' },
      ];
    }

    if (columnType === 'boolean') {
      return [
        { value: 'equals', label: '같음 (=)', example: 'value = true' },
        { value: 'not_equals', label: '같지 않음 (≠)', example: 'value ≠ true' },
      ];
    }

    return baseOperators;
  };

  // 값 입력 컴포넌트 렌더링
  const renderValueInput = (condition: FilterCondition) => {
    const column = availableColumns.find(col => col.name === condition.column);
    if (!column) return <Input placeholder="값 입력" />;

    // NULL 체크 연산자는 값 입력 불필요
    if (condition.operator === 'is_null' || condition.operator === 'is_not_null') {
      return <Text type="secondary">값 입력 불필요</Text>;
    }

    // BETWEEN 연산자
    if (condition.operator === 'between') {
      const values = Array.isArray(condition.value) ? condition.value : ['', ''];
      return (
        <Space>
          <Input
            placeholder="시작값"
            value={values[0] || ''}
            onChange={(e) => updateFilterCondition(condition.id, {
              value: [e.target.value, values[1] || '']
            })}
            style={{ width: '120px' }}
          />
          <Text>~</Text>
          <Input
            placeholder="끝값"
            value={values[1] || ''}
            onChange={(e) => updateFilterCondition(condition.id, {
              value: [values[0] || '', e.target.value]
            })}
            style={{ width: '120px' }}
          />
        </Space>
      );
    }

    // IN 연산자 (다중 값)
    if (condition.operator === 'in') {
      return (
        <TextArea
          placeholder="값들을 쉼표로 구분하여 입력&#10;예: A, B, C"
          value={Array.isArray(condition.value) ? condition.value.join(', ') : condition.value}
          onChange={(e) => updateFilterCondition(condition.id, {
            value: e.target.value.split(',').map(v => v.trim())
          })}
          rows={2}
        />
      );
    }

    // 불린 타입
    if (column.type === 'boolean') {
      return (
        <Select
          value={condition.value}
          onChange={(value) => updateFilterCondition(condition.id, { value })}
          style={{ width: '120px' }}
        >
          <Option value="true">True</Option>
          <Option value="false">False</Option>
        </Select>
      );
    }

    // 숫자 타입
    if (column.type === 'integer' || column.type === 'decimal' || column.type === 'float') {
      return (
        <Space>
          <InputNumber
            value={parseFloat(condition.value as string) || undefined}
            onChange={(value) => updateFilterCondition(condition.id, { value: value?.toString() || '' })}
            placeholder="숫자 입력"
            style={{ width: '150px' }}
          />
          {column.sampleValues && (
            <Text type="secondary" style={{ fontSize: '11px' }}>
              예: {column.sampleValues.slice(0, 3).join(', ')}
            </Text>
          )}
        </Space>
      );
    }

    // 날짜 타입
    if (column.type === 'timestamp' || column.type === 'date') {
      return (
        <Space>
          <DatePicker
            value={condition.value ? dayjs(condition.value as string) : undefined}
            onChange={(date) => updateFilterCondition(condition.id, { 
              value: date ? date.format('YYYY-MM-DD') : '' 
            })}
            style={{ width: '150px' }}
          />
        </Space>
      );
    }

    // 기본 텍스트 입력
    return (
      <Space>
        <Input
          value={condition.value as string}
          onChange={(e) => updateFilterCondition(condition.id, { value: e.target.value })}
          placeholder="값 입력"
          style={{ width: '150px' }}
        />
        {column.sampleValues && (
          <Select
            placeholder="샘플 선택"
            value={undefined}
            onChange={(value) => updateFilterCondition(condition.id, { value })}
            style={{ width: '120px' }}
            size="small"
          >
            {column.sampleValues.map((sample, idx) => (
              <Option key={idx} value={sample}>{sample}</Option>
            ))}
          </Select>
        )}
      </Space>
    );
  };

  // SQL 미리보기 생성
  const generateSQLPreview = () => {
    if (filterConditions.length === 0) return '';

    const conditions = filterConditions.map(condition => {
      const column = condition.column;
      const operator = condition.operator;
      const value = condition.value;

      let sqlCondition = '';

      switch (operator) {
        case 'equals':
          sqlCondition = `${column} = '${value}'`;
          break;
        case 'not_equals':
          sqlCondition = `${column} != '${value}'`;
          break;
        case 'contains':
          sqlCondition = `${column} LIKE '%${value}%'`;
          break;
        case 'starts_with':
          sqlCondition = `${column} LIKE '${value}%'`;
          break;
        case 'ends_with':
          sqlCondition = `${column} LIKE '%${value}'`;
          break;
        case 'greater_than':
          sqlCondition = `${column} > ${value}`;
          break;
        case 'less_than':
          sqlCondition = `${column} < ${value}`;
          break;
        case 'is_null':
          sqlCondition = `${column} IS NULL`;
          break;
        case 'is_not_null':
          sqlCondition = `${column} IS NOT NULL`;
          break;
        case 'between':
          const values = Array.isArray(value) ? value : ['', ''];
          sqlCondition = `${column} BETWEEN ${values[0]} AND ${values[1]}`;
          break;
        case 'in':
          const inValues = Array.isArray(value) ? value : [value];
          sqlCondition = `${column} IN (${inValues.map(v => `'${v}'`).join(', ')})`;
          break;
        default:
          sqlCondition = `${column} = '${value}'`;
      }

      return {
        condition: sqlCondition,
        logical: condition.logicalOperator
      };
    });

    let sql = 'WHERE ';
    conditions.forEach((cond, index) => {
      if (index > 0 && cond.logical) {
        sql += ` ${cond.logical} `;
      }
      sql += cond.condition;
    });

    return sql;
  };

  // 스키마 업데이트 (필터 조건 UI 추가)
  const enhancedSchema = {
    ...filterRowsSchema,
    sections: filterRowsSchema.sections.map(section => {
      if (section.title === '필터 조건') {
        return {
          ...section,
          fields: section.fields.map(field => {
            if (field.key === 'filters') {
              return {
                ...field,
                customComponent: (
                  <div>
                    {/* 필터 조건 관리 */}
                    <Card size="small" style={{ marginBottom: '12px' }}>
                      <Space>
                        <Button 
                          type="primary" 
                          icon={<PlusOutlined />}
                          onClick={addFilterCondition}
                          disabled={loading || availableColumns.length === 0}
                        >
                          조건 추가
                        </Button>
                        
                        <Button
                          size="small"
                          icon={<ReloadOutlined />}
                          onClick={loadInputSchema}
                          loading={loading}
                          title="스키마 다시 로드"
                        />
                        
                        <Divider type="vertical" />
                        <Text type="secondary">
                          총 {filterConditions.length}개 조건
                        </Text>
                        {filterConditions.length > 0 && (
                          <Tooltip title="복합 조건은 AND/OR로 연결됩니다">
                            <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                          </Tooltip>
                        )}
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

                    {/* 필터 조건 목록 */}
                    {filterConditions.length > 0 ? (
                      <div style={{ marginBottom: '12px' }}>
                        {filterConditions.map((condition, index) => (
                          <Card 
                            key={condition.id}
                            size="small" 
                            style={{ marginBottom: '8px' }}
                            title={
                              <Space>
                                <FilterOutlined />
                                조건 {index + 1}
                                {index > 0 && (
                                  <Select
                                    value={condition.logicalOperator}
                                    onChange={(value) => updateFilterCondition(condition.id, { 
                                      logicalOperator: value as 'AND' | 'OR' 
                                    })}
                                    size="small"
                                    style={{ width: '70px' }}
                                  >
                                    <Option value="AND">AND</Option>
                                    <Option value="OR">OR</Option>
                                  </Select>
                                )}
                              </Space>
                            }
                            extra={
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={() => removeFilterCondition(condition.id)}
                              />
                            }
                          >
                            <Space direction="vertical" style={{ width: '100%' }}>
                              {/* 컬럼 선택 */}
                              <div>
                                <Text strong style={{ display: 'block', marginBottom: '4px' }}>
                                  컬럼:
                                </Text>
                                <Select
                                  value={condition.column}
                                  onChange={(value) => updateFilterCondition(condition.id, { column: value })}
                                  placeholder="컬럼 선택"
                                  style={{ width: '100%' }}
                                >
                                  {availableColumns.map(column => (
                                    <Option key={column.name} value={column.name}>
                                      <Space>
                                        <Text>{column.name}</Text>
                                        <Tag size="small" color="blue">{column.type}</Tag>
                                      </Space>
                                    </Option>
                                  ))}
                                </Select>
                              </div>

                              {/* 연산자 선택 */}
                              {condition.column && (
                                <div>
                                  <Text strong style={{ display: 'block', marginBottom: '4px' }}>
                                    연산자:
                                  </Text>
                                  <Select
                                    value={condition.operator}
                                    onChange={(value) => updateFilterCondition(condition.id, { operator: value })}
                                    style={{ width: '100%' }}
                                  >
                                    {getOperatorOptions(
                                      availableColumns.find(col => col.name === condition.column)?.type || ''
                                    ).map(op => (
                                      <Option key={op.value} value={op.value}>
                                        <Tooltip title={op.example}>
                                          {op.label}
                                        </Tooltip>
                                      </Option>
                                    ))}
                                  </Select>
                                </div>
                              )}

                              {/* 값 입력 */}
                              {condition.column && condition.operator && (
                                <div>
                                  <Text strong style={{ display: 'block', marginBottom: '4px' }}>
                                    값:
                                  </Text>
                                  {renderValueInput(condition)}
                                </div>
                              )}
                            </Space>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Empty 
                        description="필터 조건을 추가하세요"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    )}

                    {/* SQL 미리보기 */}
                    {filterConditions.length > 0 && (
                      <Card 
                        title={
                          <Space>
                            <CodeOutlined />
                            SQL 미리보기
                          </Space>
                        }
                        size="small"
                      >
                        <div style={{ 
                          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                          fontSize: '12px',
                          background: '#f5f5f5',
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid #d9d9d9',
                        }}>
                          {generateSQLPreview()}
                        </div>
                      </Card>
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
        if (filterConditions.length === 0) {
          message.warning('필터 조건을 설정하세요.');
          return;
        }
        // TODO: 필터 조건 미리보기 구현
        message.info(`${filterConditions.length}개 필터 조건 미리보기 기능을 구현중입니다.`);
      }}
    />
  );
};

export default FilterRowsConfig;
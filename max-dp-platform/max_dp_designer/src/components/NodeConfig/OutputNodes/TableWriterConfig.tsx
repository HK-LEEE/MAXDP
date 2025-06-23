/**
 * Table Writer 노드 설정 컴포넌트
 * CLAUDE.local.md 가이드라인에 따른 테이블 쓰기 노드 설정
 */

import React, { useState } from 'react';
import { 
  Button, 
  Select, 
  Space, 
  message, 
  Typography, 
  Card,
  Input,
  Switch,
  Tag,
  List,
  Radio,
  Alert,
  Descriptions,
  Tooltip,
} from 'antd';
import { 
  DatabaseOutlined,
  SaveOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  TableOutlined,
  SettingOutlined,
} from '@ant-design/icons';

import BaseNodeConfig from '../BaseNodeConfig';
import { 
  NodeConfigProps, 
  TableWriterConfig as TableWriterConfigType,
  DatabaseConnection,
} from '../types';
import { tableWriterSchema } from '../schemas';

const { Text } = Typography;
const { Option } = Select;

interface TableWriterConfigProps extends NodeConfigProps<TableWriterConfigType> {
  // 추가 props
}

interface TableInfo {
  name: string;
  schema: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    isPrimaryKey: boolean;
  }>;
  rowCount?: number;
}

/**
 * Table Writer 노드 전용 설정 컴포넌트
 */
const TableWriterConfig: React.FC<TableWriterConfigProps> = (props) => {
  const [connections, setConnections] = useState<DatabaseConnection[]>([
    {
      id: 'default',
      name: '기본 PostgreSQL',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'platform_integration',
      isActive: true,
    },
    {
      id: 'mysql_main',
      name: 'MySQL 메인 DB',
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      database: 'maindb',
      isActive: true,
    },
  ]);

  const [availableTables, setAvailableTables] = useState<TableInfo[]>([
    {
      name: 'users',
      schema: 'public',
      columns: [
        { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true },
        { name: 'name', type: 'varchar', nullable: false, isPrimaryKey: false },
        { name: 'email', type: 'varchar', nullable: true, isPrimaryKey: false },
        { name: 'created_at', type: 'timestamp', nullable: false, isPrimaryKey: false },
      ],
      rowCount: 1250,
    },
    {
      name: 'orders',
      schema: 'public',
      columns: [
        { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true },
        { name: 'user_id', type: 'integer', nullable: false, isPrimaryKey: false },
        { name: 'total', type: 'decimal', nullable: false, isPrimaryKey: false },
        { name: 'status', type: 'varchar', nullable: false, isPrimaryKey: false },
        { name: 'created_at', type: 'timestamp', nullable: false, isPrimaryKey: false },
      ],
      rowCount: 5420,
    },
    {
      name: 'products',
      schema: 'public',
      columns: [
        { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true },
        { name: 'name', type: 'varchar', nullable: false, isPrimaryKey: false },
        { name: 'price', type: 'decimal', nullable: false, isPrimaryKey: false },
        { name: 'category', type: 'varchar', nullable: true, isPrimaryKey: false },
      ],
      rowCount: 342,
    },
  ]);

  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);

  // 테이블 선택 처리
  const handleTableSelect = (tableName: string) => {
    const table = availableTables.find(t => t.name === tableName);
    setSelectedTable(table || null);
    
    props.onConfigChange({
      ...props.config,
      tableName: tableName,
    });
  };

  // 쓰기 모드별 설명
  const getWriteModeDescription = (mode: string) => {
    const descriptions: Record<string, { description: string; warning?: string; icon: React.ReactNode }> = {
      insert: {
        description: '새 레코드만 추가합니다. 기존 데이터는 변경되지 않습니다.',
        icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      },
      upsert: {
        description: '기존 레코드가 있으면 업데이트하고, 없으면 새로 추가합니다.',
        warning: '기본키나 유니크 키가 필요합니다.',
        icon: <InfoCircleOutlined style={{ color: '#1890ff' }} />,
      },
      replace: {
        description: '테이블의 모든 기존 데이터를 삭제하고 새 데이터로 교체합니다.',
        warning: '기존 데이터가 모두 삭제됩니다. 주의하세요!',
        icon: <WarningOutlined style={{ color: '#fa8c16' }} />,
      },
      truncate_insert: {
        description: '테이블을 비운 후 새 데이터를 추가합니다.',
        warning: '기존 데이터가 모두 삭제됩니다. 주의하세요!',
        icon: <WarningOutlined style={{ color: '#f5222d' }} />,
      },
    };
    return descriptions[mode];
  };

  // 배치 크기 권장값
  const getBatchSizeRecommendation = (tableSize?: number) => {
    if (!tableSize) return 1000;
    if (tableSize < 10000) return 500;
    if (tableSize < 100000) return 1000;
    if (tableSize < 1000000) return 2000;
    return 5000;
  };

  // 스키마 업데이트 (테이블 쓰기 설정 UI 추가)
  const enhancedSchema = {
    ...tableWriterSchema,
    sections: tableWriterSchema.sections.map(section => {
      if (section.title === '데이터베이스 연결') {
        return {
          ...section,
          fields: section.fields.map(field => {
            if (field.key === 'connectionId') {
              return {
                ...field,
                options: connections.map(conn => ({
                  value: conn.id,
                  label: conn.name,
                  description: `${conn.type} - ${conn.host}:${conn.port}/${conn.database}`,
                })),
              };
            }
            return field;
          }),
        };
      }

      if (section.title === '테이블 설정') {
        return {
          ...section,
          fields: section.fields.map(field => {
            if (field.key === 'tableName') {
              return {
                ...field,
                customComponent: (
                  <div>
                    <Select
                      value={props.config.tableName}
                      onChange={handleTableSelect}
                      placeholder="저장할 테이블을 선택하세요"
                      style={{ width: '100%', marginBottom: '12px' }}
                      showSearch
                      filterOption={(input, option) =>
                        option?.children?.toString().toLowerCase().includes(input.toLowerCase()) ?? false
                      }
                    >
                      {availableTables.map(table => (
                        <Option key={table.name} value={table.name}>
                          <Space>
                            <TableOutlined />
                            <Text>{table.schema}.{table.name}</Text>
                            <Text type="secondary">({table.rowCount?.toLocaleString()} rows)</Text>
                          </Space>
                        </Option>
                      ))}
                    </Select>

                    {/* 선택된 테이블 정보 */}
                    {selectedTable && (
                      <Card size="small" title="선택된 테이블 정보">
                        <Descriptions size="small" column={1}>
                          <Descriptions.Item label="테이블명">
                            {selectedTable.schema}.{selectedTable.name}
                          </Descriptions.Item>
                          <Descriptions.Item label="레코드 수">
                            {selectedTable.rowCount?.toLocaleString()} 개
                          </Descriptions.Item>
                          <Descriptions.Item label="컬럼 수">
                            {selectedTable.columns.length} 개
                          </Descriptions.Item>
                        </Descriptions>

                        <div style={{ marginTop: '12px' }}>
                          <Text strong style={{ display: 'block', marginBottom: '8px' }}>
                            컬럼 구조:
                          </Text>
                          <List
                            size="small"
                            dataSource={selectedTable.columns}
                            renderItem={(column) => (
                              <List.Item style={{ padding: '4px 0' }}>
                                <Space>
                                  <Text strong>{column.name}</Text>
                                  <Tag color="blue">{column.type}</Tag>
                                  {column.isPrimaryKey && (
                                    <Tag color="gold">PK</Tag>
                                  )}
                                  {!column.nullable && (
                                    <Tag color="red">NOT NULL</Tag>
                                  )}
                                </Space>
                              </List.Item>
                            )}
                          />
                        </div>
                      </Card>
                    )}
                  </div>
                ),
              };
            }

            if (field.key === 'writeMode') {
              return {
                ...field,
                customComponent: (
                  <div>
                    <Radio.Group
                      value={props.config.writeMode}
                      onChange={(e) => props.onConfigChange({
                        ...props.config,
                        writeMode: e.target.value,
                      })}
                    >
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {field.options?.map(option => {
                          const modeInfo = getWriteModeDescription(option.value);
                          return (
                            <Card
                              key={option.value}
                              size="small"
                              style={{ 
                                cursor: 'pointer',
                                border: props.config.writeMode === option.value 
                                  ? '2px solid #1890ff' 
                                  : '1px solid #d9d9d9',
                              }}
                              onClick={() => props.onConfigChange({
                                ...props.config,
                                writeMode: option.value,
                              })}
                            >
                              <Radio value={option.value}>
                                <Space>
                                  {modeInfo?.icon}
                                  <Text strong>{option.label}</Text>
                                </Space>
                              </Radio>
                              <div style={{ marginLeft: '24px', marginTop: '4px' }}>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                  {modeInfo?.description}
                                </Text>
                                {modeInfo?.warning && (
                                  <Alert
                                    type="warning"
                                    showIcon
                                    message={modeInfo.warning}
                                    style={{ marginTop: '4px' }}
                                    size="small"
                                  />
                                )}
                              </div>
                            </Card>
                          );
                        })}
                      </Space>
                    </Radio.Group>
                  </div>
                ),
              };
            }

            if (field.key === 'batchSize') {
              const recommendedSize = getBatchSizeRecommendation(selectedTable?.rowCount);
              return {
                ...field,
                customComponent: (
                  <div>
                    <Space>
                      <Input
                        type="number"
                        value={props.config.batchSize || recommendedSize}
                        onChange={(e) => props.onConfigChange({
                          ...props.config,
                          batchSize: parseInt(e.target.value) || recommendedSize,
                        })}
                        style={{ width: '150px' }}
                        min={1}
                        max={10000}
                      />
                      <Text type="secondary">개 단위로 처리</Text>
                      <Tooltip title={`테이블 크기에 따른 권장값: ${recommendedSize}`}>
                        <Button 
                          size="small" 
                          type="link"
                          onClick={() => props.onConfigChange({
                            ...props.config,
                            batchSize: recommendedSize,
                          })}
                        >
                          권장값 사용
                        </Button>
                      </Tooltip>
                    </Space>
                    
                    <div style={{ marginTop: '8px' }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        • 작은 값: 메모리 사용량 적음, 속도 느림<br/>
                        • 큰 값: 메모리 사용량 많음, 속도 빠름<br/>
                        • 권장: 1,000 ~ 5,000 (테이블 크기에 따라)
                      </Text>
                    </div>
                  </div>
                ),
              };
            }

            return field;
          }),
        };
      }

      if (section.title === '고급 설정') {
        return {
          ...section,
          fields: section.fields.map(field => {
            if (field.key === 'createTableIfNotExists') {
              return {
                ...field,
                customComponent: (
                  <div>
                    <Space>
                      <Switch
                        checked={props.config.createTableIfNotExists}
                        onChange={(checked) => props.onConfigChange({
                          ...props.config,
                          createTableIfNotExists: checked,
                        })}
                      />
                      <Text>테이블이 존재하지 않으면 자동 생성</Text>
                      <Tooltip title="입력 데이터의 스키마를 기반으로 테이블을 자동으로 생성합니다">
                        <InfoCircleOutlined style={{ color: '#1890ff' }} />
                      </Tooltip>
                    </Space>
                  </div>
                ),
              };
            }

            if (field.key === 'validateSchema') {
              return {
                ...field,
                customComponent: (
                  <div>
                    <Space>
                      <Switch
                        checked={props.config.validateSchema}
                        onChange={(checked) => props.onConfigChange({
                          ...props.config,
                          validateSchema: checked,
                        })}
                      />
                      <Text>스키마 검증 수행</Text>
                      <Tooltip title="데이터 타입과 제약조건을 미리 검증합니다">
                        <InfoCircleOutlined style={{ color: '#1890ff' }} />
                      </Tooltip>
                    </Space>
                  </div>
                ),
              };
            }

            if (field.key === 'onError') {
              return {
                ...field,
                customComponent: (
                  <div>
                    <Select
                      value={props.config.onError}
                      onChange={(value) => props.onConfigChange({
                        ...props.config,
                        onError: value,
                      })}
                      style={{ width: '200px' }}
                    >
                      <Option value="stop">중단 (Stop)</Option>
                      <Option value="skip">건너뛰기 (Skip)</Option>
                      <Option value="log">로그만 기록 (Log Only)</Option>
                    </Select>
                    <div style={{ marginTop: '4px' }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        오류 발생 시 처리 방식을 선택하세요
                      </Text>
                    </div>
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
      {/* 쓰기 모드 경고 */}
      {(props.config.writeMode === 'replace' || props.config.writeMode === 'truncate_insert') && (
        <Alert
          type="error"
          showIcon
          message="데이터 손실 위험"
          description={`${props.config.writeMode === 'replace' ? 'REPLACE' : 'TRUNCATE + INSERT'} 모드는 기존 데이터를 모두 삭제합니다. 신중하게 사용하세요.`}
          style={{ marginBottom: 16 }}
        />
      )}

      <BaseNodeConfig
        {...props}
        schema={enhancedSchema}
        onPreview={() => {
          if (!props.config.tableName) {
            message.error('저장할 테이블을 선택하세요.');
            return;
          }
          if (!props.config.connectionId) {
            message.error('데이터베이스 연결을 선택하세요.');
            return;
          }
          // TODO: 테이블 쓰기 미리보기 구현
          message.info('테이블 쓰기 미리보기 기능을 구현중입니다.');
        }}
      />
    </div>
  );
};

export default TableWriterConfig;
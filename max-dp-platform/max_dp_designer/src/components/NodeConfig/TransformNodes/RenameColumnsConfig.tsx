/**
 * Rename Columns 노드 설정 컴포넌트
 * CLAUDE.local.md 가이드라인에 따른 컬럼 이름 변경 노드 설정
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
  Empty,
  Tooltip,
  Modal,
  Form,
  Spin,
  Alert,
  Table,
} from 'antd';
import { 
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  SwapOutlined,
  InfoCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  ImportOutlined,
  ExportOutlined,
  ReloadOutlined,
  EyeOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import BaseNodeConfig from '../BaseNodeConfig';
import { 
  NodeConfigProps, 
  RenameColumnsConfig as RenameColumnsConfigType,
  ColumnRename,
} from '../types';
import { renameColumnsSchema } from '../schemas';
import { getInputSchema, ColumnInfo } from '../../../utils/schemaUtils';

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface RenameColumnsConfigProps extends NodeConfigProps<RenameColumnsConfigType> {
  nodes?: any[];
  edges?: any[];
}

/**
 * Rename Columns 노드 전용 설정 컴포넌트
 */
const RenameColumnsConfig: React.FC<RenameColumnsConfigProps> = (props) => {
  const { nodes = [], edges = [] } = props;
  
  const [availableColumns, setAvailableColumns] = useState<ColumnInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRename, setEditingRename] = useState<ColumnRename | null>(null);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [form] = Form.useForm();
  
  // 미리보기 관련 상태
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

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
      console.log('Loading input schema for Rename Columns node:', props.nodeId);
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

  // 현재 컬럼 이름 변경 목록
  const columnRenames = props.config.renames || [];

  // 컬럼 이름 변경 추가/수정
  const saveColumnRename = (rename: ColumnRename) => {
    const existingIndex = columnRenames.findIndex(r => r.id === rename.id);
    let newRenames;

    if (existingIndex >= 0) {
      // 기존 항목 수정
      newRenames = columnRenames.map((r, index) => 
        index === existingIndex ? rename : r
      );
    } else {
      // 새 항목 추가
      newRenames = [...columnRenames, { ...rename, id: `rename_${Date.now()}` }];
    }

    props.onConfigChange({
      ...props.config,
      renames: newRenames,
    });
  };

  // 컬럼 이름 변경 제거
  const removeColumnRename = (renameId: string) => {
    const newRenames = columnRenames.filter(rename => rename.id !== renameId);
    props.onConfigChange({
      ...props.config,
      renames: newRenames,
    });
  };

  // 모달 열기 (추가/수정)
  const openModal = (rename?: ColumnRename) => {
    setEditingRename(rename || null);
    if (rename) {
      form.setFieldsValue(rename);
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  // 모달에서 저장
  const handleModalSave = async () => {
    try {
      const values = await form.validateFields();
      const rename: ColumnRename = {
        id: editingRename?.id || `rename_${Date.now()}`,
        originalName: values.originalName,
        newName: values.newName,
        description: values.description,
      };

      saveColumnRename(rename);
      setModalVisible(false);
      message.success(editingRename ? '컬럼 이름 변경이 수정되었습니다.' : '컬럼 이름 변경이 추가되었습니다.');
    } catch (error) {
      // 검증 실패
    }
  };

  // 일괄 이름 변경 처리
  const handleBatchRename = async () => {
    try {
      const values = await form.validateFields();
      const { pattern, replacement, applyToAll } = values;

      let columnsToProcess = applyToAll 
        ? availableColumns.map(col => col.name)
        : availableColumns
            .filter(col => !columnRenames.some(rename => rename.originalName === col.name))
            .map(col => col.name);

      const newRenames: ColumnRename[] = [];
      let processedCount = 0;

      columnsToProcess.forEach(columnName => {
        let newName = columnName;

        if (pattern === 'snake_to_camel') {
          // snake_case to camelCase
          newName = columnName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        } else if (pattern === 'camel_to_snake') {
          // camelCase to snake_case
          newName = columnName.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        } else if (pattern === 'remove_prefix') {
          // 접두사 제거
          if (replacement && columnName.startsWith(replacement)) {
            newName = columnName.substring(replacement.length);
            if (newName.startsWith('_')) newName = newName.substring(1);
          }
        } else if (pattern === 'add_prefix') {
          // 접두사 추가
          newName = replacement ? `${replacement}_${columnName}` : columnName;
        } else if (pattern === 'remove_suffix') {
          // 접미사 제거
          if (replacement && columnName.endsWith(replacement)) {
            newName = columnName.substring(0, columnName.length - replacement.length);
            if (newName.endsWith('_')) newName = newName.substring(0, newName.length - 1);
          }
        } else if (pattern === 'add_suffix') {
          // 접미사 추가
          newName = replacement ? `${columnName}_${replacement}` : columnName;
        } else if (pattern === 'replace_text') {
          // 텍스트 교체
          const [searchText, replaceText] = (replacement || '').split('->').map(s => s.trim());
          if (searchText && replaceText !== undefined) {
            newName = columnName.replace(new RegExp(searchText, 'g'), replaceText);
          }
        }

        if (newName !== columnName) {
          newRenames.push({
            id: `batch_rename_${Date.now()}_${processedCount}`,
            originalName: columnName,
            newName,
            description: `일괄 변경: ${pattern}`,
          });
          processedCount++;
        }
      });

      if (newRenames.length > 0) {
        const allRenames = [...columnRenames, ...newRenames];
        props.onConfigChange({
          ...props.config,
          renames: allRenames,
        });
        message.success(`${newRenames.length}개 컬럼의 이름이 일괄 변경되었습니다.`);
      } else {
        message.info('변경할 컬럼이 없습니다.');
      }

      setBatchModalVisible(false);
    } catch (error) {
      // 검증 실패
    }
  };

  // 이름 변경 규칙 검증
  const validateColumnName = (newName: string) => {
    // SQL 예약어 체크
    const reservedWords = [
      'select', 'from', 'where', 'insert', 'update', 'delete', 'drop', 'create',
      'alter', 'table', 'index', 'view', 'grant', 'revoke', 'commit', 'rollback'
    ];
    
    if (reservedWords.includes(newName.toLowerCase())) {
      return 'SQL 예약어는 사용할 수 없습니다.';
    }

    // 특수문자 체크 (밑줄과 알파벳, 숫자만 허용)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newName)) {
      return '컬럼명은 영문자, 숫자, 밑줄(_)만 사용 가능하며 숫자로 시작할 수 없습니다.';
    }

    // 중복 체크
    const duplicateRename = columnRenames.find(rename => 
      rename.newName === newName && rename.id !== editingRename?.id
    );
    if (duplicateRename) {
      return '이미 사용중인 컬럼명입니다.';
    }

    return null;
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
    if (columnRenames.length === 0) {
      message.warning('컬럼 이름 변경을 설정하세요.');
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

      // 소스 노드에서 실제 데이터 가져오기 (모킹)
      let mockData: any[] = Array.from({ length: 10 }, (_, index) => {
        const row: any = {};
        
        // 모든 원본 컬럼에 대해 데이터 생성
        availableColumns.forEach(column => {
          const rename = columnRenames.find(r => r.originalName === column.name);
          const columnName = rename ? rename.newName : column.name;
          
          switch (column.type.toLowerCase()) {
            case 'integer':
            case 'bigint':
              row[columnName] = Math.floor(Math.random() * 1000) + index;
              break;
            case 'varchar':
            case 'text':
              row[columnName] = `Sample ${columnName} ${index + 1}`;
              break;
            case 'timestamp':
            case 'date':
              row[columnName] = new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0];
              break;
            case 'boolean':
              row[columnName] = Math.random() > 0.5;
              break;
            default:
              row[columnName] = `Value ${index + 1}`;
          }
        });
        
        return row;
      });

      setPreviewData(mockData);
      setPreviewModalVisible(true);
      message.success(`${columnRenames.length}개 컬럼 이름 변경 미리보기`);
      
    } catch (error) {
      console.error('Preview error:', error);
      message.error('미리보기 중 오류가 발생했습니다.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // 설정 저장
  const handleSave = () => {
    if (columnRenames.length === 0) {
      message.warning('저장할 이름 변경이 없습니다.');
      return;
    }
    
    // 노드 데이터 업데이트
    const updatedConfig = {
      ...props.config,
      renames: columnRenames,
      sourceSchema: availableColumns,
    };
    
    props.onConfigChange(updatedConfig);
    message.success(`${columnRenames.length}개 컬럼 이름 변경이 저장되었습니다.`);
  };

  // 스키마 업데이트 (컬럼 이름 변경 UI 추가)
  const enhancedSchema = {
    ...renameColumnsSchema,
    sections: renameColumnsSchema.sections.map(section => {
      if (section.title === '컬럼 이름 변경') {
        return {
          ...section,
          fields: section.fields.map(field => {
            if (field.key === 'renames') {
              return {
                ...field,
                customComponent: (
                  <div>
                    {/* 컬럼 이름 변경 관리 */}
                    <Card size="small" style={{ marginBottom: '12px' }}>
                      <Space>
                        <Button 
                          type="primary" 
                          icon={<PlusOutlined />}
                          onClick={() => openModal()}
                          disabled={loading || availableColumns.length === 0}
                        >
                          이름 변경 추가
                        </Button>
                        <Button 
                          icon={<ImportOutlined />}
                          onClick={() => {
                            form.resetFields();
                            setBatchModalVisible(true);
                          }}
                          disabled={loading || availableColumns.length === 0}
                        >
                          일괄 변경
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
                          총 {columnRenames.length}개 변경
                        </Text>
                        <Tooltip title="컬럼명은 영문자, 숫자, 밑줄(_)만 사용 가능합니다">
                          <InfoCircleOutlined style={{ color: '#1890ff' }} />
                        </Tooltip>
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

                    {/* 이름 변경 목록 */}
                    {columnRenames.length > 0 ? (
                      <List
                        size="small"
                        dataSource={columnRenames}
                        renderItem={(rename) => {
                          const originalColumn = availableColumns.find(col => col.name === rename.originalName);
                          return (
                            <List.Item
                              actions={[
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<EditOutlined />}
                                  onClick={() => openModal(rename)}
                                />,
                                <Button
                                  type="text"
                                  size="small"
                                  danger
                                  icon={<DeleteOutlined />}
                                  onClick={() => removeColumnRename(rename.id)}
                                />
                              ]}
                            >
                              <List.Item.Meta
                                title={
                                  <Space>
                                    <Text delete>{rename.originalName}</Text>
                                    <SwapOutlined style={{ color: '#1890ff' }} />
                                    <Text strong style={{ color: '#52c41a' }}>{rename.newName}</Text>
                                    {originalColumn && (
                                      <Tag color={getColumnTypeColor(originalColumn.type)} size="small">
                                        {originalColumn.type}
                                      </Tag>
                                    )}
                                  </Space>
                                }
                                description={rename.description || originalColumn?.description}
                              />
                            </List.Item>
                          );
                        }}
                      />
                    ) : (
                      <Empty 
                        description="컬럼 이름 변경을 추가하세요"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    )}

                    {/* 사용 가능한 컬럼 목록 */}
                    <Card 
                      title="사용 가능한 컬럼" 
                      size="small"
                      style={{ marginTop: '12px' }}
                    >
                      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        <List
                          size="small"
                          dataSource={availableColumns}
                          renderItem={(column) => {
                            const isRenamed = columnRenames.some(rename => rename.originalName === column.name);
                            return (
                              <List.Item
                                style={{ 
                                  opacity: isRenamed ? 0.6 : 1,
                                  backgroundColor: isRenamed ? '#f0f0f0' : 'transparent',
                                }}
                              >
                                <List.Item.Meta
                                  title={
                                    <Space>
                                      <Text>{column.name}</Text>
                                      <Tag color={getColumnTypeColor(column.type)} size="small">
                                        {column.type}
                                      </Tag>
                                      {!column.nullable && (
                                        <Tag color="red" size="small">NOT NULL</Tag>
                                      )}
                                      {isRenamed && (
                                        <Tag color="blue" size="small">이름변경됨</Tag>
                                      )}
                                    </Space>
                                  }
                                  description={column.description}
                                />
                                {!isRenamed && (
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={() => {
                                      const newRename: ColumnRename = {
                                        id: '',
                                        originalName: column.name,
                                        newName: '',
                                        description: '',
                                      };
                                      openModal(newRename);
                                    }}
                                  />
                                )}
                              </List.Item>
                            );
                          }}
                        />
                      </div>
                    </Card>
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
              disabled={columnRenames.length === 0}
            >
              저장
            </Button>
            <Button
              icon={<EyeOutlined />}
              onClick={handlePreview}
              loading={previewLoading}
              disabled={columnRenames.length === 0}
            >
              미리보기
            </Button>
          </Space>
        </div>
      </BaseNodeConfig>

      {/* 컬럼 이름 변경 추가/수정 모달 */}
      <Modal
        title={editingRename?.id ? '컬럼 이름 변경 수정' : '컬럼 이름 변경 추가'}
        open={modalVisible}
        onOk={handleModalSave}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="originalName"
            label="원본 컬럼명"
            rules={[{ required: true, message: '원본 컬럼명을 선택하세요' }]}
          >
            <Select placeholder="변경할 컬럼을 선택하세요">
              {availableColumns
                .filter(col => !columnRenames.some(rename => 
                  rename.originalName === col.name && rename.id !== editingRename?.id
                ))
                .map(column => (
                  <Option key={column.name} value={column.name}>
                    <Space>
                      <Text>{column.name}</Text>
                      <Tag color={getColumnTypeColor(column.type)} size="small">
                        {column.type}
                      </Tag>
                    </Space>
                  </Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="newName"
            label="새 컬럼명"
            rules={[
              { required: true, message: '새 컬럼명을 입력하세요' },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  const error = validateColumnName(value);
                  return error ? Promise.reject(error) : Promise.resolve();
                }
              }
            ]}
          >
            <Input placeholder="새로운 컬럼명 입력" />
          </Form.Item>

          <Form.Item
            name="description"
            label="설명 (선택사항)"
          >
            <TextArea 
              placeholder="변경 사유나 설명을 입력하세요"
              rows={2}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 일괄 이름 변경 모달 */}
      <Modal
        title="일괄 컬럼 이름 변경"
        open={batchModalVisible}
        onOk={handleBatchRename}
        onCancel={() => setBatchModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="pattern"
            label="변경 패턴"
            rules={[{ required: true, message: '변경 패턴을 선택하세요' }]}
          >
            <Select placeholder="변경 패턴을 선택하세요">
              <Option value="snake_to_camel">snake_case → camelCase (user_name → userName)</Option>
              <Option value="camel_to_snake">camelCase → snake_case (userName → user_name)</Option>
              <Option value="remove_prefix">접두사 제거 (user_name → name)</Option>
              <Option value="add_prefix">접두사 추가 (name → user_name)</Option>
              <Option value="remove_suffix">접미사 제거 (name_col → name)</Option>
              <Option value="add_suffix">접미사 추가 (name → name_col)</Option>
              <Option value="replace_text">텍스트 교체 (old_text → new_text)</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="replacement"
            label="교체 텍스트"
            tooltip="접두사/접미사 추가/제거 시 사용할 텍스트, 텍스트 교체 시 '원본텍스트->새텍스트' 형식"
          >
            <Input placeholder="예: user_ 또는 old_text->new_text" />
          </Form.Item>

          <Form.Item
            name="applyToAll"
            valuePropName="checked"
          >
            <Switch />
            <Text style={{ marginLeft: '8px' }}>
              이미 이름이 변경된 컬럼에도 적용
            </Text>
          </Form.Item>
        </Form>
      </Modal>

      {/* 미리보기 모달 */}
      <Modal
        title={
          <Space>
            <EyeOutlined />
            <Text strong>Rename Columns 미리보기</Text>
            <Tag color="orange">{columnRenames.length}개 이름 변경</Tag>
          </Space>
        }
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        width={1000}
        footer={[
          <Button key="close" onClick={() => setPreviewModalVisible(false)}>
            닫기
          </Button>,
        ]}
      >
        <div style={{ marginBottom: '12px' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text type="secondary">
              이름 변경 내역:
            </Text>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {columnRenames.map((rename, index) => (
                <Tag key={index} color="blue">
                  {rename.originalName} → {rename.newName}
                </Tag>
              ))}
            </div>
          </Space>
        </div>
        
        <Table
          dataSource={previewData}
          columns={availableColumns.map(column => {
            const rename = columnRenames.find(r => r.originalName === column.name);
            const columnName = rename ? rename.newName : column.name;
            const isRenamed = !!rename;
            
            return {
              title: (
                <Space>
                  <Text strong style={{ color: isRenamed ? '#1890ff' : undefined }}>
                    {columnName}
                  </Text>
                  {isRenamed && (
                    <Tag color="blue" size="small">변경됨</Tag>
                  )}
                  <Tag color={getColumnTypeColor(column.type)} size="small">
                    {column.type}
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
          })}
          size="small"
          scroll={{ x: availableColumns.length * 150, y: 400 }}
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

export default RenameColumnsConfig;
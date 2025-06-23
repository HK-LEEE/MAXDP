/**
 * Join Data 노드 설정 컴포넌트
 * CLAUDE.local.md 가이드라인에 따른 데이터 조인 노드 설정
 */

import React, { useState, useEffect } from 'react';
import { 
  Button, 
  Select, 
  Space, 
  message, 
  Typography, 
  Card,
  Form,
  Radio,
  Tag,
  List,
  Empty,
  Spin,
  Alert,
  Table,
  Modal,
} from 'antd';
import { 
  MergeOutlined,
  SwapOutlined,
  SettingOutlined,
  ReloadOutlined,
  EyeOutlined,
  SaveOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import BaseNodeConfig from '../BaseNodeConfig';
import { 
  NodeConfigProps, 
  JoinDataConfig as JoinDataConfigType,
} from '../types';
import { joinDataSchema } from '../schemas';
import { getInputSchema, ColumnInfo } from '../../../utils/schemaUtils';

const { Text } = Typography;
const { Option } = Select;

interface JoinDataConfigProps extends NodeConfigProps<JoinDataConfigType> {
  nodes?: any[];
  edges?: any[];
}

interface JoinCondition {
  id: string;
  leftColumn: string;
  rightColumn: string;
  operator: '=' | '!=' | '<' | '>' | '<=' | '>=';
}

/**
 * Join Data 노드 전용 설정 컴포넌트
 */
const JoinDataConfig: React.FC<JoinDataConfigProps> = (props) => {
  const { nodes = [], edges = [] } = props;
  
  const [leftTableColumns, setLeftTableColumns] = useState<ColumnInfo[]>([]);
  const [rightTableColumns, setRightTableColumns] = useState<ColumnInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  
  // 미리보기 관련 상태
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

  // Join 설정
  const joinType = props.config.joinType || 'inner';
  const joinConditions = props.config.joinConditions || [];

  // 이전 노드들로부터 스키마 정보 로드
  useEffect(() => {
    if (nodes.length > 0 && edges.length > 0) {
      loadInputSchemas();
    }
  }, [props.nodeId, nodes, edges]);

  const loadInputSchemas = async () => {
    setLoading(true);
    setSchemaError(null);
    
    try {
      console.log('Loading input schemas for Join node:', props.nodeId);
      
      // 현재 노드로 들어오는 엣지들 찾기
      const incomingEdges = edges.filter(edge => edge.target === props.nodeId);
      console.log('Incoming edges for Join node:', incomingEdges);
      
      if (incomingEdges.length < 2) {
        setSchemaError('Join 노드는 2개의 데이터 소스가 필요합니다.');
        return;
      }
      
      if (incomingEdges.length > 2) {
        setSchemaError('Join 노드는 최대 2개의 데이터 소스만 지원합니다.');
        return;
      }

      // 첫 번째 데이터 소스 (Left Table)
      const leftSourceNode = nodes.find(node => node.id === incomingEdges[0].source);
      const leftSchema = await getInputSchema(leftSourceNode?.id, nodes, edges);
      
      // 두 번째 데이터 소스 (Right Table)
      const rightSourceNode = nodes.find(node => node.id === incomingEdges[1].source);
      const rightSchema = await getInputSchema(rightSourceNode?.id, nodes, edges);
      
      if (leftSchema && leftSchema.columns.length > 0) {
        setLeftTableColumns(leftSchema.columns);
        console.log('Left table columns loaded:', leftSchema.columns);
      }
      
      if (rightSchema && rightSchema.columns.length > 0) {
        setRightTableColumns(rightSchema.columns);
        console.log('Right table columns loaded:', rightSchema.columns);
      }
      
      if (leftSchema && rightSchema) {
        message.success(`Join 데이터 소스 로드 완료: Left(${leftSchema.columns.length}개), Right(${rightSchema.columns.length}개) 컬럼`);
      }
      
    } catch (error) {
      console.error('Error loading join schemas:', error);
      setSchemaError('스키마 정보 로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Join 조건 추가
  const addJoinCondition = () => {
    const newCondition: JoinCondition = {
      id: `condition_${Date.now()}`,
      leftColumn: '',
      rightColumn: '',
      operator: '='
    };
    
    props.onConfigChange({
      ...props.config,
      joinConditions: [...joinConditions, newCondition],
    });
  };

  // Join 조건 제거
  const removeJoinCondition = (conditionId: string) => {
    props.onConfigChange({
      ...props.config,
      joinConditions: joinConditions.filter(c => c.id !== conditionId),
    });
  };

  // Join 조건 수정
  const updateJoinCondition = (conditionId: string, field: keyof JoinCondition, value: any) => {
    const updatedConditions = joinConditions.map(condition => 
      condition.id === conditionId 
        ? { ...condition, [field]: value }
        : condition
    );
    
    props.onConfigChange({
      ...props.config,
      joinConditions: updatedConditions,
    });
  };

  // Join 타입 변경
  const handleJoinTypeChange = (type: string) => {
    props.onConfigChange({
      ...props.config,
      joinType: type,
    });
  };

  // 미리보기 실행
  const handlePreview = async () => {
    if (joinConditions.length === 0) {
      message.warning('Join 조건을 설정하세요.');
      return;
    }

    setPreviewLoading(true);
    try {
      // 모킹 데이터 생성
      const mockData = Array.from({ length: 8 }, (_, index) => {
        const row: any = {};
        
        // Left table columns
        leftTableColumns.forEach(col => {
          row[`left_${col.name}`] = `L${index + 1}_${col.name}`;
        });
        
        // Right table columns
        rightTableColumns.forEach(col => {
          row[`right_${col.name}`] = `R${index + 1}_${col.name}`;
        });
        
        return row;
      });

      setPreviewData(mockData);
      setPreviewModalVisible(true);
      message.success(`${joinType.toUpperCase()} Join 미리보기`);
      
    } catch (error) {
      console.error('Join preview error:', error);
      message.error('미리보기 중 오류가 발생했습니다.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // 설정 저장
  const handleSave = () => {
    if (joinConditions.length === 0) {
      message.warning('Join 조건을 설정하세요.');
      return;
    }

    props.onConfigChange({
      ...props.config,
      joinType,
      joinConditions,
      leftSchema: leftTableColumns,
      rightSchema: rightTableColumns,
    });
    
    message.success('Join 설정이 저장되었습니다.');
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

  // 스키마 업데이트 (Join 설정 UI 추가)
  const enhancedSchema = {
    ...joinDataSchema,
    sections: joinDataSchema.sections.map(section => {
      if (section.title === 'Join 설정') {
        return {
          ...section,
          fields: section.fields.map(field => {
            if (field.key === 'joinConfig') {
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
                          onClick={loadInputSchemas}
                          loading={loading}
                          title="스키마 다시 로드"
                        />
                        <Text type="secondary">
                          Left: {leftTableColumns.length}개 | Right: {rightTableColumns.length}개
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
                      />
                    )}

                    {/* 로딩 상태 */}
                    {loading && (
                      <Card size="small" style={{ marginBottom: '12px' }}>
                        <div style={{ textAlign: 'center', padding: '20px' }}>
                          <Spin />
                          <div style={{ marginTop: '8px' }}>
                            <Text type="secondary">데이터 소스 스키마를 가져오는 중...</Text>
                          </div>
                        </div>
                      </Card>
                    )}

                    {/* Join 타입 선택 */}
                    {!loading && leftTableColumns.length > 0 && rightTableColumns.length > 0 && (
                      <div>
                        <Card size="small" title="Join 타입" style={{ marginBottom: '12px' }}>
                          <Radio.Group
                            value={joinType}
                            onChange={(e) => handleJoinTypeChange(e.target.value)}
                          >
                            <Radio value="inner">INNER JOIN</Radio>
                            <Radio value="left">LEFT JOIN</Radio>
                            <Radio value="right">RIGHT JOIN</Radio>
                            <Radio value="full">FULL OUTER JOIN</Radio>
                          </Radio.Group>
                        </Card>

                        {/* Join 조건 설정 */}
                        <Card size="small" title="Join 조건" style={{ marginBottom: '12px' }}>
                          <Space direction="vertical" style={{ width: '100%' }}>
                            <Button
                              type="dashed"
                              onClick={addJoinCondition}
                              style={{ width: '100%' }}
                            >
                              + Join 조건 추가
                            </Button>
                            
                            {joinConditions.map((condition, index) => (
                              <Card key={condition.id} size="small" style={{ backgroundColor: '#f9f9f9' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <Select
                                    placeholder="Left Column"
                                    value={condition.leftColumn}
                                    onChange={(value) => updateJoinCondition(condition.id, 'leftColumn', value)}
                                    style={{ minWidth: '120px' }}
                                  >
                                    {leftTableColumns.map(col => (
                                      <Option key={col.name} value={col.name}>
                                        <Space>
                                          <Text>{col.name}</Text>
                                          <Tag color={getColumnTypeColor(col.type)} size="small">
                                            {col.type}
                                          </Tag>
                                        </Space>
                                      </Option>
                                    ))}
                                  </Select>
                                  
                                  <Select
                                    value={condition.operator}
                                    onChange={(value) => updateJoinCondition(condition.id, 'operator', value)}
                                    style={{ width: '60px' }}
                                  >
                                    <Option value="=">=</Option>
                                    <Option value="!=">!=</Option>
                                    <Option value="<">&lt;</Option>
                                    <Option value=">">&gt;</Option>
                                    <Option value="<=">&lt;=</Option>
                                    <Option value=">=">&gt;=</Option>
                                  </Select>
                                  
                                  <Select
                                    placeholder="Right Column"
                                    value={condition.rightColumn}
                                    onChange={(value) => updateJoinCondition(condition.id, 'rightColumn', value)}
                                    style={{ minWidth: '120px' }}
                                  >
                                    {rightTableColumns.map(col => (
                                      <Option key={col.name} value={col.name}>
                                        <Space>
                                          <Text>{col.name}</Text>
                                          <Tag color={getColumnTypeColor(col.type)} size="small">
                                            {col.type}
                                          </Tag>
                                        </Space>
                                      </Option>
                                    ))}
                                  </Select>
                                  
                                  <Button
                                    type="text"
                                    danger
                                    onClick={() => removeJoinCondition(condition.id)}
                                    size="small"
                                  >
                                    삭제
                                  </Button>
                                </div>
                              </Card>
                            ))}
                          </Space>
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
              disabled={joinConditions.length === 0}
            >
              저장
            </Button>
            <Button
              icon={<EyeOutlined />}
              onClick={handlePreview}
              loading={previewLoading}
              disabled={joinConditions.length === 0}
            >
              미리보기
            </Button>
          </Space>
        </div>
      </BaseNodeConfig>

      {/* Join 미리보기 모달 */}
      <Modal
        title={
          <Space>
            <MergeOutlined />
            <Text strong>{joinType.toUpperCase()} Join 결과</Text>
            <Tag color="purple">{joinConditions.length}개 조건</Tag>
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
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text type="secondary">
              Join 조건: {joinConditions.map(c => `${c.leftColumn} ${c.operator} ${c.rightColumn}`).join(' AND ')}
            </Text>
          </Space>
        </div>
        
        <Table
          dataSource={previewData}
          columns={[
            ...leftTableColumns.map(col => ({
              title: `Left.${col.name}`,
              dataIndex: `left_${col.name}`,
              key: `left_${col.name}`,
              width: 120,
            })),
            ...rightTableColumns.map(col => ({
              title: `Right.${col.name}`,
              dataIndex: `right_${col.name}`,
              key: `right_${col.name}`,
              width: 120,
            })),
          ]}
          size="small"
          scroll={{ x: (leftTableColumns.length + rightTableColumns.length) * 120, y: 400 }}
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

export default JoinDataConfig;
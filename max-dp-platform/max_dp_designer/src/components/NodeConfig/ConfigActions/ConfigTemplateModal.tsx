/**
 * 설정 템플릿 관리 모달
 * CLAUDE.local.md 가이드라인에 따른 설정 템플릿 저장/불러오기
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  Button,
  List,
  Card,
  Typography,
  Divider,
  message,
  Spin,
  Empty,
  Popconfirm,
  Badge,
  Tooltip,
} from 'antd';
import {
  SaveOutlined,
  FolderOpenOutlined,
  DeleteOutlined,
  TagsOutlined,
  ClockCircleOutlined,
  UserOutlined,
  GlobalOutlined,
  LockOutlined,
  StarOutlined,
  StarFilled,
} from '@ant-design/icons';

import { NodeType, NodeConfig } from '../types';
import { nodeConfigService, NodeConfigTemplate } from '@/services/nodeConfigService';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface ConfigTemplateModalProps {
  visible: boolean;
  mode: 'save' | 'load';
  nodeType: NodeType;
  currentConfig?: NodeConfig;
  onClose: () => void;
  onSave?: (template: NodeConfigTemplate) => void;
  onLoad?: (config: NodeConfig) => void;
}

const ConfigTemplateModal: React.FC<ConfigTemplateModalProps> = ({
  visible,
  mode,
  nodeType,
  currentConfig,
  onClose,
  onSave,
  onLoad,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<NodeConfigTemplate[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // 템플릿 목록 불러오기
  useEffect(() => {
    if (visible && mode === 'load') {
      loadTemplates();
    }
  }, [visible, mode, nodeType]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await nodeConfigService.getConfigTemplates(nodeType);
      setTemplates(data);
      
      // 즐겨찾기 불러오기
      const storedFavorites = localStorage.getItem('maxdp_favorite_templates');
      if (storedFavorites) {
        setFavorites(new Set(JSON.parse(storedFavorites)));
      }
    } catch (error) {
      message.error('템플릿 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 템플릿 저장
  const handleSaveTemplate = async (values: any) => {
    if (!currentConfig) return;

    setLoading(true);
    try {
      const template = await nodeConfigService.saveConfigTemplate({
        name: values.name,
        description: values.description,
        nodeType,
        config: currentConfig,
        isPublic: values.isPublic || false,
        createdBy: 'current_user', // TODO: 실제 사용자 정보로 교체
        tags: values.tags || [],
      });

      message.success('템플릿이 저장되었습니다.');
      onSave?.(template);
      form.resetFields();
      onClose();
    } catch (error) {
      message.error('템플릿 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 템플릿 불러오기
  const handleLoadTemplate = (template: NodeConfigTemplate) => {
    onLoad?.(template.config);
    message.success(`'${template.name}' 템플릿을 불러왔습니다.`);
    onClose();
  };

  // 템플릿 삭제
  const handleDeleteTemplate = async (templateId: string) => {
    setLoading(true);
    try {
      await nodeConfigService.deleteConfigTemplate(templateId);
      message.success('템플릿이 삭제되었습니다.');
      loadTemplates();
    } catch (error) {
      message.error('템플릿 삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 즐겨찾기 토글
  const toggleFavorite = (templateId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(templateId)) {
      newFavorites.delete(templateId);
    } else {
      newFavorites.add(templateId);
    }
    setFavorites(newFavorites);
    localStorage.setItem('maxdp_favorite_templates', JSON.stringify([...newFavorites]));
  };

  // 템플릿 필터링
  const filteredTemplates = templates.filter(template => {
    if (selectedTags.length === 0) return true;
    return selectedTags.some(tag => template.tags?.includes(tag));
  });

  // 모든 태그 수집
  const allTags = Array.from(
    new Set(templates.flatMap(t => t.tags || []))
  );

  // 노드 타입 라벨
  const getNodeTypeLabel = (type: NodeType) => {
    const labels: Record<NodeType, string> = {
      [NodeType.TABLE_READER]: '테이블 읽기',
      [NodeType.CUSTOM_SQL]: '사용자 정의 SQL',
      [NodeType.FILE_INPUT]: '파일 입력',
      [NodeType.SELECT_COLUMNS]: '컬럼 선택',
      [NodeType.FILTER_ROWS]: '행 필터링',
      [NodeType.RENAME_COLUMNS]: '컬럼 이름 변경',
      [NodeType.TABLE_WRITER]: '테이블 쓰기',
      [NodeType.FILE_WRITER]: '파일 쓰기',
    };
    return labels[type] || type;
  };

  return (
    <Modal
      title={
        <Space>
          {mode === 'save' ? <SaveOutlined /> : <FolderOpenOutlined />}
          {mode === 'save' ? '설정 템플릿 저장' : '설정 템플릿 불러오기'}
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={mode === 'save' ? 600 : 800}
      footer={
        mode === 'save' ? [
          <Button key="cancel" onClick={onClose}>
            취소
          </Button>,
          <Button
            key="save"
            type="primary"
            icon={<SaveOutlined />}
            loading={loading}
            onClick={() => form.submit()}
          >
            저장
          </Button>,
        ] : [
          <Button key="close" onClick={onClose}>
            닫기
          </Button>,
        ]
      }
    >
      {mode === 'save' ? (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveTemplate}
        >
          <Form.Item
            name="name"
            label="템플릿 이름"
            rules={[
              { required: true, message: '템플릿 이름을 입력하세요.' },
              { max: 100, message: '최대 100자까지 입력 가능합니다.' },
            ]}
          >
            <Input
              placeholder="예: 기본 테이블 읽기 설정"
              prefix={<SaveOutlined />}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="설명"
            rules={[
              { max: 500, message: '최대 500자까지 입력 가능합니다.' },
            ]}
          >
            <TextArea
              rows={3}
              placeholder="이 템플릿의 용도나 특징을 설명하세요."
            />
          </Form.Item>

          <Form.Item
            name="tags"
            label="태그"
            tooltip="태그를 추가하여 템플릿을 쉽게 찾을 수 있습니다."
          >
            <Select
              mode="tags"
              placeholder="태그 입력 (Enter로 추가)"
              style={{ width: '100%' }}
              tokenSeparators={[',']}
            >
              <Option value="기본">기본</Option>
              <Option value="고급">고급</Option>
              <Option value="성능최적화">성능최적화</Option>
              <Option value="대용량">대용량</Option>
              <Option value="실시간">실시간</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="isPublic"
            valuePropName="checked"
            initialValue={false}
          >
            <Space>
              <Select
                value={form.getFieldValue('isPublic')}
                onChange={(value) => form.setFieldsValue({ isPublic: value })}
                style={{ width: 200 }}
              >
                <Option value={false}>
                  <Space>
                    <LockOutlined />
                    비공개 템플릿
                  </Space>
                </Option>
                <Option value={true}>
                  <Space>
                    <GlobalOutlined />
                    공개 템플릿
                  </Space>
                </Option>
              </Select>
              <Text type="secondary">
                {form.getFieldValue('isPublic')
                  ? '다른 사용자도 이 템플릿을 사용할 수 있습니다.'
                  : '본인만 이 템플릿을 사용할 수 있습니다.'}
              </Text>
            </Space>
          </Form.Item>

          <Divider />

          <Card size="small" title="현재 설정 미리보기">
            <pre style={{ 
              fontSize: '12px', 
              maxHeight: '200px', 
              overflow: 'auto',
              background: '#f5f5f5',
              padding: '8px',
              borderRadius: '4px',
            }}>
              {JSON.stringify(currentConfig, null, 2)}
            </pre>
          </Card>
        </Form>
      ) : (
        <div>
          {/* 필터 */}
          <Space style={{ marginBottom: 16, width: '100%' }} direction="vertical">
            <div>
              <Text strong>노드 타입: </Text>
              <Tag color="blue">{getNodeTypeLabel(nodeType)}</Tag>
            </div>
            
            {allTags.length > 0 && (
              <div>
                <Text strong style={{ marginRight: 8 }}>태그 필터:</Text>
                <Space wrap>
                  {allTags.map(tag => (
                    <Tag
                      key={tag}
                      color={selectedTags.includes(tag) ? 'blue' : 'default'}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        if (selectedTags.includes(tag)) {
                          setSelectedTags(selectedTags.filter(t => t !== tag));
                        } else {
                          setSelectedTags([...selectedTags, tag]);
                        }
                      }}
                    >
                      <TagsOutlined /> {tag}
                    </Tag>
                  ))}
                </Space>
              </div>
            )}
          </Space>

          <Divider />

          {/* 템플릿 목록 */}
          <Spin spinning={loading}>
            {filteredTemplates.length > 0 ? (
              <List
                dataSource={filteredTemplates}
                renderItem={(template) => (
                  <List.Item
                    key={template.id}
                    actions={[
                      <Tooltip title={favorites.has(template.id) ? '즐겨찾기 해제' : '즐겨찾기'}>
                        <Button
                          type="text"
                          icon={favorites.has(template.id) ? <StarFilled /> : <StarOutlined />}
                          onClick={() => toggleFavorite(template.id)}
                          style={{ 
                            color: favorites.has(template.id) ? '#faad14' : undefined 
                          }}
                        />
                      </Tooltip>,
                      <Button
                        type="primary"
                        size="small"
                        onClick={() => handleLoadTemplate(template)}
                      >
                        불러오기
                      </Button>,
                      <Popconfirm
                        title="이 템플릿을 삭제하시겠습니까?"
                        onConfirm={() => handleDeleteTemplate(template.id)}
                        okText="삭제"
                        cancelText="취소"
                      >
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                        />
                      </Popconfirm>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          {favorites.has(template.id) && (
                            <StarFilled style={{ color: '#faad14' }} />
                          )}
                          <Text strong>{template.name}</Text>
                          {template.isPublic ? (
                            <Tag color="green" icon={<GlobalOutlined />}>
                              공개
                            </Tag>
                          ) : (
                            <Tag icon={<LockOutlined />}>비공개</Tag>
                          )}
                        </Space>
                      }
                      description={
                        <div>
                          {template.description && (
                            <Paragraph 
                              ellipsis={{ rows: 2 }} 
                              style={{ marginBottom: 8 }}
                            >
                              {template.description}
                            </Paragraph>
                          )}
                          <Space size="small" wrap>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              <UserOutlined /> {template.createdBy}
                            </Text>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              <ClockCircleOutlined /> {new Date(template.createdAt).toLocaleDateString()}
                            </Text>
                            {template.tags?.map(tag => (
                              <Tag key={tag} size="small">{tag}</Tag>
                            ))}
                          </Space>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty
                description={
                  selectedTags.length > 0
                    ? '선택한 태그에 해당하는 템플릿이 없습니다.'
                    : '저장된 템플릿이 없습니다.'
                }
              />
            )}
          </Spin>
        </div>
      )}
    </Modal>
  );
};

export default ConfigTemplateModal;
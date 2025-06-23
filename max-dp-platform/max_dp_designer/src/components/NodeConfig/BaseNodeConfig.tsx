/**
 * 기본 노드 설정 컴포넌트
 * CLAUDE.local.md 가이드라인에 따른 재사용 가능한 컴포넌트 설계
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Form,
  Input,
  Select,
  Switch,
  InputNumber,
  Collapse,
  Card,
  Space,
  Typography,
  Tooltip,
  Alert,
  Button,
  Divider,
  Badge,
  Spin,
} from 'antd';
import {
  InfoCircleOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  LoadingOutlined,
  EyeOutlined,
  SaveOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  CloudDownloadOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';

import {
  NodeConfigProps,
  FormFieldMeta,
  NodeConfigSchema,
  ValidationResult,
  NodeConfig,
} from './types';
import { useNodeValidation, useFormValidation } from './validation/hooks';
import ConfigTemplateModal from './ConfigActions/ConfigTemplateModal';
import ConfigVersionHistory from './ConfigActions/ConfigVersionHistory';
import ConfigImportExport from './ConfigActions/ConfigImportExport';
import { nodeConfigService } from '@/services/nodeConfigService';

const { Text, Title } = Typography;
const { Panel } = Collapse;
const { Option } = Select;

interface BaseNodeConfigProps<T extends NodeConfig = NodeConfig> extends NodeConfigProps<T> {
  schema: NodeConfigSchema;
  onPreview?: () => void;
  previewLoading?: boolean;
}

/**
 * 기본 노드 설정 컴포넌트
 * 모든 노드 타입의 설정 UI에서 재사용되는 공통 컴포넌트
 */
const BaseNodeConfig = <T extends NodeConfig = NodeConfig>({
  nodeId,
  nodeType,
  config,
  schema,
  onConfigChange,
  onValidate,
  onPreview,
  previewLoading = false,
  readOnly = false,
}: BaseNodeConfigProps<T>) => {
  const [form] = Form.useForm();
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  
  // 모달 상태
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [templateModalMode, setTemplateModalMode] = useState<'save' | 'load'>('save');
  const [versionHistoryVisible, setVersionHistoryVisible] = useState(false);

  // 검증 훅 사용
  const validation = useNodeValidation(nodeType, config);
  const formValidation = useFormValidation();

  // 폼 초기값 설정 및 저장된 설정 불러오기
  useEffect(() => {
    // 기존 설정이 비어있다면 저장된 설정 불러오기 시도
    if (Object.keys(config).length === 0) {
      const savedConfig = nodeConfigService.loadNodeConfig(nodeId);
      if (savedConfig && savedConfig.nodeType === nodeType) {
        onConfigChange(savedConfig.config);
        form.setFieldsValue(savedConfig.config);
        return;
      }
    }
    
    form.setFieldsValue(config);
  }, [nodeId, nodeType]); // onConfigChange와 config 의존성 제거

  // config 변경시 폼 값 업데이트 (별도 useEffect)
  useEffect(() => {
    console.log('BaseNodeConfig: Setting form values with config:', config);
    form.setFieldsValue(config);
  }, [config, form]);

  // 검증 결과를 부모 컴포넌트에 전달
  useEffect(() => {
    onValidate?.(validation.isValid, validation.result.errors);
  }, [validation.isValid, validation.result.errors, onValidate]);

  // 폼 값 변경 처리 (useCallback으로 최적화)
  const handleFieldChange = useCallback((field: string, value: any) => {
    const newConfig = { ...config, [field]: value };
    setTouched(prev => ({ ...prev, [field]: true }));
    onConfigChange(newConfig);
    
    // 자동 저장 (로컬 스토리지)
    nodeConfigService.saveNodeConfig(nodeId, nodeType, newConfig);
  }, [config, onConfigChange, nodeId, nodeType]);

  // 설정 불러오기 처리
  const handleConfigLoad = (loadedConfig: NodeConfig) => {
    onConfigChange(loadedConfig);
    form.setFieldsValue(loadedConfig);
    
    // 버전 저장
    nodeConfigService.saveConfigVersion(nodeId, loadedConfig, '템플릿에서 불러옴');
  };

  // 설정 복원 처리
  const handleConfigRestore = (restoredConfig: NodeConfig) => {
    onConfigChange(restoredConfig);
    form.setFieldsValue(restoredConfig);
  };

  // 스키마에서 필드 메타데이터 찾기
  const findFieldMeta = (fieldKey: string): FormFieldMeta | undefined => {
    for (const section of schema.sections) {
      const field = section.fields.find(f => f.key === fieldKey);
      if (field) return field;
    }
    return undefined;
  };

  // 필드 의존성 확인
  const isFieldVisible = (field: FormFieldMeta): boolean => {
    if (!field.dependency) return true;
    
    const dependencyValue = config[field.dependency.field as keyof T];
    return field.dependency.condition(dependencyValue);
  };

  // 폼 필드 렌더링
  const renderField = (field: FormFieldMeta) => {
    if (!isFieldVisible(field)) return null;

    const fieldValidation = validation.getFieldValidation(field.key);
    const isTouched = touched[field.key];

    const commonProps = {
      placeholder: field.placeholder,
      disabled: readOnly,
      status: fieldValidation.error && isTouched ? 'error' : undefined,
      onChange: (value: any) => {
        const actualValue = value?.target ? value.target.value : value;
        handleFieldChange(field.key, actualValue);
      },
    };

    let fieldComponent;

    switch (field.type) {
      case 'input':
        fieldComponent = <Input {...commonProps} />;
        break;

      case 'textarea':
        fieldComponent = (
          <Input.TextArea 
            {...commonProps} 
            rows={4}
            showCount
          />
        );
        break;

      case 'select':
        fieldComponent = (
          <Select 
            {...commonProps}
            showSearch
            optionFilterProp="children"
            onChange={(value) => handleFieldChange(field.key, value)}
          >
            {field.options?.map((option) => (
              <Option key={option.value} value={option.value}>
                <div>
                  <div>{option.label}</div>
                  {option.description && (
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {option.description}
                    </Text>
                  )}
                </div>
              </Option>
            ))}
          </Select>
        );
        break;

      case 'multiSelect':
        fieldComponent = (
          <Select 
            {...commonProps}
            mode="multiple"
            showSearch
            optionFilterProp="children"
            onChange={(value) => handleFieldChange(field.key, value)}
          >
            {field.options?.map((option) => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
        );
        break;

      case 'number':
        fieldComponent = (
          <InputNumber 
            {...commonProps}
            style={{ width: '100%' }}
            min={field.validation?.min}
            max={field.validation?.max}
            onChange={(value) => handleFieldChange(field.key, value)}
          />
        );
        break;

      case 'switch':
        fieldComponent = (
          <Switch 
            checked={config[field.key as keyof T] as boolean}
            disabled={readOnly}
            onChange={(checked) => handleFieldChange(field.key, checked)}
          />
        );
        break;

      case 'custom':
        fieldComponent = field.customComponent;
        break;

      default:
        fieldComponent = <Input {...commonProps} />;
    }

    return (
      <Form.Item
        key={field.key}
        label={
          <Space>
            <span>{field.label}</span>
            {field.required && <Text type="danger">*</Text>}
            {field.tooltip && (
              <Tooltip title={field.tooltip}>
                <InfoCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            )}
            {/* 실시간 검증 상태 표시 */}
            {validation.isValidating && (
              <Spin 
                size="small" 
                indicator={<LoadingOutlined style={{ fontSize: 12 }} />} 
              />
            )}
            {fieldValidation.warning && (
              <Tooltip title={fieldValidation.warning}>
                <WarningOutlined style={{ color: '#fa8c16' }} />
              </Tooltip>
            )}
          </Space>
        }
        validateStatus={
          fieldValidation.error && isTouched 
            ? 'error' 
            : fieldValidation.warning && isTouched 
              ? 'warning' 
              : ''
        }
        help={
          isTouched 
            ? fieldValidation.error || fieldValidation.warning
            : undefined
        }
        style={{ marginBottom: 16 }}
      >
        {fieldComponent}
      </Form.Item>
    );
  };

  // 검증 상태 아이콘 및 배지
  const validationIcon = useMemo(() => {
    if (validation.isValidating) {
      return (
        <Spin 
          size="small" 
          indicator={<LoadingOutlined style={{ fontSize: 16 }} />} 
        />
      );
    }

    if (validation.hasErrors) {
      return (
        <Badge count={validation.errorCount} size="small">
          <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
        </Badge>
      );
    }

    if (validation.hasWarnings) {
      return (
        <Badge count={validation.warningCount} size="small" color="orange">
          <WarningOutlined style={{ color: '#fa8c16', fontSize: 16 }} />
        </Badge>
      );
    }

    return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />;
  }, [validation]);

  return (
    <div className="base-node-config">
      {/* 헤더 */}
      <div style={{ marginBottom: 16 }}>
        <Space align="start">
          <SettingOutlined style={{ fontSize: '18px', color: '#1890ff' }} />
          <div>
            <Title level={5} style={{ margin: 0 }}>
              {schema.title}
            </Title>
            {schema.description && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {schema.description}
              </Text>
            )}
          </div>
          {validationIcon}
        </Space>
      </div>

      {/* 검증 결과 요약 */}
      {validation.hasErrors && (
        <Alert
          type="error"
          showIcon
          message={`설정에 ${validation.errorCount}개의 오류가 있습니다`}
          description={
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {Object.entries(validation.result.errors).map(([field, error]) => (
                <li key={field}>{error}</li>
              ))}
            </ul>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {validation.hasWarnings && !validation.hasErrors && (
        <Alert
          type="warning"
          showIcon
          message={`${validation.warningCount}개의 주의사항이 있습니다`}
          description={
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {Object.entries(validation.result.warnings).map(([field, warning]) => (
                <li key={field}>{warning}</li>
              ))}
            </ul>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 설정 폼 */}
      <Form
        form={form}
        layout="vertical"
        disabled={readOnly}
        size="small"
      >
        <Collapse
          defaultActiveKey={schema.sections
            .filter(section => !section.defaultCollapsed)
            .map((_, index) => index.toString())
          }
          ghost
        >
          {schema.sections.map((section, sectionIndex) => (
            <Panel
              key={sectionIndex.toString()}
              header={
                <Space>
                  <Text strong>{section.title}</Text>
                  <Text type="secondary">
                    ({section.fields.filter(isFieldVisible).length}개 설정)
                  </Text>
                </Space>
              }
            >
              <div style={{ padding: '0 8px' }}>
                {section.fields.map(renderField)}
              </div>
            </Panel>
          ))}
        </Collapse>
      </Form>

      {/* 액션 버튼 */}
      {!readOnly && (
        <>
          <Divider />
          
          {/* 설정 관리 버튼들 */}
          <Card size="small" title="설정 관리" style={{ marginBottom: 16 }}>
            <Space wrap>
              <Button
                icon={<SaveOutlined />}
                size="small"
                onClick={() => {
                  setTemplateModalMode('save');
                  setTemplateModalVisible(true);
                }}
              >
                템플릿 저장
              </Button>
              
              <Button
                icon={<FolderOpenOutlined />}
                size="small"
                onClick={() => {
                  setTemplateModalMode('load');
                  setTemplateModalVisible(true);
                }}
              >
                템플릿 불러오기
              </Button>
              
              <Button
                icon={<HistoryOutlined />}
                size="small"
                onClick={() => setVersionHistoryVisible(true)}
              >
                버전 이력
              </Button>
              
              <ConfigImportExport
                nodeId={nodeId}
                nodeType={nodeType}
                config={config}
                onImport={handleConfigLoad}
              />
            </Space>
          </Card>

          {/* 미리보기 버튼 */}
          {onPreview && (
            <Space style={{ width: '100%', justifyContent: 'center' }}>
              <Button
                type="primary"
                icon={<EyeOutlined />}
                loading={previewLoading}
                disabled={validation.hasErrors || validation.isValidating}
                onClick={onPreview}
              >
                미리보기
              </Button>
              {validation.hasWarnings && !validation.hasErrors && (
                <Button
                  type="dashed"
                  onClick={() => validation.validateNow()}
                  disabled={validation.isValidating}
                >
                  재검증
                </Button>
              )}
            </Space>
          )}
        </>
      )}

      {/* 설정 템플릿 모달 */}
      <ConfigTemplateModal
        visible={templateModalVisible}
        mode={templateModalMode}
        nodeType={nodeType}
        currentConfig={config}
        onClose={() => setTemplateModalVisible(false)}
        onLoad={handleConfigLoad}
      />

      {/* 버전 이력 드로어 */}
      <ConfigVersionHistory
        visible={versionHistoryVisible}
        nodeId={nodeId}
        currentConfig={config}
        onClose={() => setVersionHistoryVisible(false)}
        onRestore={handleConfigRestore}
      />
    </div>
  );
};

export default BaseNodeConfig;
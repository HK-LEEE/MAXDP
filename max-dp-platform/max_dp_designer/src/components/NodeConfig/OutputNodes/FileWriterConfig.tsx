/**
 * File Writer 노드 설정 컴포넌트
 * CLAUDE.local.md 가이드라인에 따른 파일 쓰기 노드 설정
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
  Radio,
  Alert,
  Descriptions,
  Tooltip,
  Divider,
  Tag,
} from 'antd';
import { 
  FileTextOutlined,
  FolderOpenOutlined,
  SaveOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  SettingOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  FileAddOutlined,
} from '@ant-design/icons';

import BaseNodeConfig from '../BaseNodeConfig';
import { 
  NodeConfigProps, 
  FileWriterConfig as FileWriterConfigType,
} from '../types';
import { fileWriterSchema } from '../schemas';

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface FileWriterConfigProps extends NodeConfigProps<FileWriterConfigType> {
  // 추가 props
}

/**
 * File Writer 노드 전용 설정 컴포넌트
 */
const FileWriterConfig: React.FC<FileWriterConfigProps> = (props) => {
  const [pathSuggestions, setPathSuggestions] = useState<string[]>([
    'C:\\data\\output\\',
    'C:\\exports\\',
    '/data/output/',
    '/exports/',
    './output/',
    '../results/',
  ]);

  // 파일 타입별 아이콘 및 정보
  const getFileTypeInfo = (fileType: string) => {
    const typeInfo: Record<string, { icon: React.ReactNode; description: string; extensions: string[]; features: string[] }> = {
      csv: {
        icon: <FileTextOutlined style={{ color: '#52c41a' }} />,
        description: '쉼표로 구분된 텍스트 파일',
        extensions: ['.csv'],
        features: ['구분자 설정', '인코딩 선택', '헤더 포함/제외'],
      },
      json: {
        icon: <FileTextOutlined style={{ color: '#1890ff' }} />,
        description: 'JavaScript Object Notation 파일',
        extensions: ['.json'],
        features: ['들여쓰기 설정', '배열/객체 형태', '인코딩 선택'],
      },
      excel: {
        icon: <FileExcelOutlined style={{ color: '#fa8c16' }} />,
        description: 'Microsoft Excel 파일',
        extensions: ['.xlsx', '.xls'],
        features: ['시트명 설정', '헤더 포함/제외', '셀 서식 설정'],
      },
      parquet: {
        icon: <FilePdfOutlined style={{ color: '#722ed1' }} />,
        description: '컬럼형 저장 파일 (빅데이터 최적화)',
        extensions: ['.parquet'],
        features: ['압축 설정', '스키마 보존', '메타데이터 포함'],
      },
    };
    return typeInfo[fileType] || typeInfo.csv;
  };

  // 덮어쓰기 모드별 설명
  const getOverwriteModeDescription = (mode: string) => {
    const descriptions: Record<string, { description: string; warning?: string; icon: React.ReactNode }> = {
      overwrite: {
        description: '기존 파일을 삭제하고 새 파일을 생성합니다.',
        warning: '기존 파일이 삭제됩니다.',
        icon: <WarningOutlined style={{ color: '#fa8c16' }} />,
      },
      append: {
        description: '기존 파일 끝에 새 데이터를 추가합니다.',
        icon: <FileAddOutlined style={{ color: '#52c41a' }} />,
      },
      error: {
        description: '파일이 이미 존재하면 오류를 발생시킵니다.',
        icon: <InfoCircleOutlined style={{ color: '#1890ff' }} />,
      },
      skip: {
        description: '파일이 이미 존재하면 작업을 건너뜁니다.',
        icon: <InfoCircleOutlined style={{ color: '#722ed1' }} />,
      },
    };
    return descriptions[mode];
  };

  // 파일 경로 검증
  const validateFilePath = (path: string) => {
    if (!path.trim()) {
      return '파일 경로를 입력하세요.';
    }

    // Windows/Linux 경로 패턴 체크
    const windowsPath = /^[a-zA-Z]:\\/.test(path);
    const unixPath = /^\//.test(path) || /^\.\.?\//.test(path);
    
    if (!windowsPath && !unixPath) {
      return '올바른 절대 경로 또는 상대 경로를 입력하세요.';
    }

    // 파일 확장자 체크
    const fileType = props.config.fileType;
    if (fileType) {
      const typeInfo = getFileTypeInfo(fileType);
      const hasValidExtension = typeInfo.extensions.some(ext => 
        path.toLowerCase().endsWith(ext)
      );
      
      if (!hasValidExtension) {
        return `${fileType.toUpperCase()} 파일의 확장자는 ${typeInfo.extensions.join(', ')} 중 하나여야 합니다.`;
      }
    }

    return null;
  };

  // 파일 경로 자동 완성
  const generateFilePath = () => {
    const fileType = props.config.fileType || 'csv';
    const typeInfo = getFileTypeInfo(fileType);
    const extension = typeInfo.extensions[0];
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
    
    // Windows 환경 기본 경로
    const defaultPath = `C:\\data\\output\\export_${timestamp}${extension}`;
    
    props.onConfigChange({
      ...props.config,
      filePath: defaultPath,
    });
  };

  // 스키마 업데이트 (파일 쓰기 설정 UI 추가)
  const enhancedSchema = {
    ...fileWriterSchema,
    sections: fileWriterSchema.sections.map(section => {
      if (section.title === '파일 설정') {
        return {
          ...section,
          fields: section.fields.map(field => {
            if (field.key === 'fileType') {
              return {
                ...field,
                customComponent: (
                  <div>
                    <Select
                      value={props.config.fileType}
                      onChange={(value) => props.onConfigChange({
                        ...props.config,
                        fileType: value,
                      })}
                      style={{ width: '100%', marginBottom: '12px' }}
                      placeholder="출력 파일 형식을 선택하세요"
                    >
                      {field.options?.map(option => {
                        const typeInfo = getFileTypeInfo(option.value);
                        return (
                          <Option key={option.value} value={option.value}>
                            <Space>
                              {typeInfo.icon}
                              <div>
                                <div>{option.label}</div>
                                <Text type="secondary" style={{ fontSize: '11px' }}>
                                  {typeInfo.description}
                                </Text>
                              </div>
                            </Space>
                          </Option>
                        );
                      })}
                    </Select>

                    {/* 선택된 파일 타입 정보 */}
                    {props.config.fileType && (
                      <Card size="small">
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <div>
                            <Text strong>지원 기능:</Text>
                            <div style={{ marginTop: '4px' }}>
                              {getFileTypeInfo(props.config.fileType).features.map((feature, index) => (
                                <Tag key={index} size="small" style={{ margin: '2px' }}>
                                  {feature}
                                </Tag>
                              ))}
                            </div>
                          </div>
                          <div>
                            <Text strong>파일 확장자:</Text>
                            <Text style={{ marginLeft: '8px' }}>
                              {getFileTypeInfo(props.config.fileType).extensions.join(', ')}
                            </Text>
                          </div>
                        </Space>
                      </Card>
                    )}
                  </div>
                ),
              };
            }

            if (field.key === 'filePath') {
              const pathError = validateFilePath(props.config.filePath || '');
              return {
                ...field,
                customComponent: (
                  <div>
                    <Space style={{ width: '100%', marginBottom: '8px' }}>
                      <Input
                        value={props.config.filePath || ''}
                        onChange={(e) => props.onConfigChange({
                          ...props.config,
                          filePath: e.target.value,
                        })}
                        placeholder="C:\data\output\export.csv 또는 /data/output/export.csv"
                        style={{ flex: 1 }}
                        status={pathError ? 'error' : undefined}
                      />
                      <Button 
                        icon={<FolderOpenOutlined />}
                        onClick={generateFilePath}
                        title="자동 경로 생성"
                      >
                        자동생성
                      </Button>
                    </Space>

                    {pathError && (
                      <Alert
                        type="error"
                        message={pathError}
                        style={{ marginBottom: '8px' }}
                        size="small"
                        showIcon
                      />
                    )}

                    {/* 경로 제안 */}
                    <div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        경로 제안:
                      </Text>
                      <Space wrap style={{ marginTop: '4px' }}>
                        {pathSuggestions.map((suggestion, index) => (
                          <Button
                            key={index}
                            size="small"
                            type="text"
                            onClick={() => {
                              const fileType = props.config.fileType || 'csv';
                              const extension = getFileTypeInfo(fileType).extensions[0];
                              const fileName = `export_${Date.now()}${extension}`;
                              props.onConfigChange({
                                ...props.config,
                                filePath: `${suggestion}${fileName}`,
                              });
                            }}
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </Space>
                    </div>
                  </div>
                ),
              };
            }

            if (field.key === 'overwriteMode') {
              return {
                ...field,
                customComponent: (
                  <div>
                    <Radio.Group
                      value={props.config.overwriteMode}
                      onChange={(e) => props.onConfigChange({
                        ...props.config,
                        overwriteMode: e.target.value,
                      })}
                    >
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {field.options?.map(option => {
                          const modeInfo = getOverwriteModeDescription(option.value);
                          return (
                            <Card
                              key={option.value}
                              size="small"
                              style={{ 
                                cursor: 'pointer',
                                border: props.config.overwriteMode === option.value 
                                  ? '2px solid #1890ff' 
                                  : '1px solid #d9d9d9',
                              }}
                              onClick={() => props.onConfigChange({
                                ...props.config,
                                overwriteMode: option.value,
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

            return field;
          }),
        };
      }

      if (section.title === '형식 설정') {
        return {
          ...section,
          fields: section.fields.map(field => {
            // CSV 전용 설정
            if (field.key === 'delimiter' && props.config.fileType === 'csv') {
              return {
                ...field,
                customComponent: (
                  <div>
                    <Select
                      value={props.config.delimiter || ','}
                      onChange={(value) => props.onConfigChange({
                        ...props.config,
                        delimiter: value,
                      })}
                      style={{ width: '150px' }}
                    >
                      <Option value=",">,   (쉼표)</Option>
                      <Option value=";">    ; (세미콜론)</Option>
                      <Option value="\t">   \t (탭)</Option>
                      <Option value="|">    | (파이프)</Option>
                    </Select>
                    <Text type="secondary" style={{ marginLeft: '8px', fontSize: '12px' }}>
                      CSV 구분자
                    </Text>
                  </div>
                ),
              };
            }

            if (field.key === 'encoding') {
              return {
                ...field,
                customComponent: (
                  <div>
                    <Select
                      value={props.config.encoding || 'utf-8'}
                      onChange={(value) => props.onConfigChange({
                        ...props.config,
                        encoding: value,
                      })}
                      style={{ width: '150px' }}
                    >
                      <Option value="utf-8">UTF-8 (권장)</Option>
                      <Option value="utf-16">UTF-16</Option>
                      <Option value="cp949">CP949 (한글 Windows)</Option>
                      <Option value="euc-kr">EUC-KR</Option>
                      <Option value="ascii">ASCII</Option>
                    </Select>
                    <Text type="secondary" style={{ marginLeft: '8px', fontSize: '12px' }}>
                      텍스트 인코딩
                    </Text>
                  </div>
                ),
              };
            }

            if (field.key === 'includeHeader') {
              return {
                ...field,
                customComponent: (
                  <div>
                    <Space>
                      <Switch
                        checked={props.config.includeHeader}
                        onChange={(checked) => props.onConfigChange({
                          ...props.config,
                          includeHeader: checked,
                        })}
                      />
                      <Text>첫 번째 행에 컬럼명 포함</Text>
                      <Tooltip title="헤더가 포함되면 데이터 가져오기가 쉬워집니다">
                        <InfoCircleOutlined style={{ color: '#1890ff' }} />
                      </Tooltip>
                    </Space>
                  </div>
                ),
              };
            }

            // JSON 전용 설정
            if (field.key === 'jsonFormat' && props.config.fileType === 'json') {
              return {
                ...field,
                customComponent: (
                  <div>
                    <Radio.Group
                      value={props.config.jsonFormat || 'array'}
                      onChange={(e) => props.onConfigChange({
                        ...props.config,
                        jsonFormat: e.target.value,
                      })}
                    >
                      <Space direction="vertical">
                        <Radio value="array">
                          배열 형태 <Text type="secondary">[{"{...}"}, {"{...}"}]</Text>
                        </Radio>
                        <Radio value="lines">
                          라인별 객체 <Text type="secondary">{"{...}"}<br/>{"{...}"}</Text>
                        </Radio>
                      </Space>
                    </Radio.Group>
                  </div>
                ),
              };
            }

            // Excel 전용 설정
            if (field.key === 'sheetName' && props.config.fileType === 'excel') {
              return {
                ...field,
                customComponent: (
                  <div>
                    <Input
                      value={props.config.sheetName || 'Sheet1'}
                      onChange={(e) => props.onConfigChange({
                        ...props.config,
                        sheetName: e.target.value,
                      })}
                      placeholder="Sheet1"
                      style={{ width: '200px' }}
                    />
                    <Text type="secondary" style={{ marginLeft: '8px', fontSize: '12px' }}>
                      워크시트 이름
                    </Text>
                  </div>
                ),
              };
            }

            return field;
          }).filter(field => {
            // 파일 타입에 따라 관련 설정만 표시
            const fileType = props.config.fileType;
            if (field.key === 'delimiter' && fileType !== 'csv') return false;
            if (field.key === 'jsonFormat' && fileType !== 'json') return false;
            if (field.key === 'sheetName' && fileType !== 'excel') return false;
            return true;
          }),
        };
      }

      return section;
    }),
  };

  return (
    <div>
      {/* 파일 덮어쓰기 경고 */}
      {props.config.overwriteMode === 'overwrite' && props.config.filePath && (
        <Alert
          type="warning"
          showIcon
          message="파일 덮어쓰기 주의"
          description={`기존 파일 "${props.config.filePath}"이 삭제되고 새 파일로 교체됩니다.`}
          style={{ marginBottom: 16 }}
        />
      )}

      <BaseNodeConfig
        {...props}
        schema={enhancedSchema}
        onPreview={() => {
          const pathError = validateFilePath(props.config.filePath || '');
          if (pathError) {
            message.error(pathError);
            return;
          }
          if (!props.config.fileType) {
            message.error('파일 형식을 선택하세요.');
            return;
          }
          // TODO: 파일 쓰기 미리보기 구현
          message.info('파일 쓰기 미리보기 기능을 구현중입니다.');
        }}
      />
    </div>
  );
};

export default FileWriterConfig;
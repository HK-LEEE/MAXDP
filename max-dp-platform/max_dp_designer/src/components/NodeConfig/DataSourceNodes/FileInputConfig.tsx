/**
 * File Input 노드 설정 컴포넌트
 * CLAUDE.local.md 가이드라인에 따른 파일 입력 노드 설정
 */

import React, { useState } from 'react';
import { 
  Button, 
  Select, 
  Space, 
  message, 
  Typography, 
  Upload, 
  Card,
  Alert,
  Descriptions,
  Tag,
  Modal,
  Table,
} from 'antd';
import { 
  UploadOutlined, 
  FileTextOutlined, 
  FolderOpenOutlined,
  InfoCircleOutlined,
  EyeOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';

import BaseNodeConfig from '../BaseNodeConfig';
import { 
  NodeConfigProps, 
  FileInputConfig as FileInputConfigType,
} from '../types';
import { fileInputSchema } from '../schemas';

const { Text } = Typography;
const { Option } = Select;

interface FileInputConfigProps extends NodeConfigProps<FileInputConfigType> {
  // 추가 props
}

/**
 * File Input 노드 전용 설정 컴포넌트
 */
const FileInputConfig: React.FC<FileInputConfigProps> = (props) => {
  const [fileInfo, setFileInfo] = useState<any>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewColumns, setPreviewColumns] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // 파일 타입별 아이콘
  const getFileTypeIcon = (fileType: string) => {
    const icons: Record<string, React.ReactNode> = {
      csv: <FileTextOutlined style={{ color: '#52c41a' }} />,
      json: <FileTextOutlined style={{ color: '#1890ff' }} />,
      excel: <FileTextOutlined style={{ color: '#fa8c16' }} />,
      parquet: <FileTextOutlined style={{ color: '#722ed1' }} />,
    };
    return icons[fileType] || <FileTextOutlined />;
  };

  // 파일 타입별 설명
  const getFileTypeDescription = (fileType: string) => {
    const descriptions: Record<string, string> = {
      csv: '쉼표로 구분된 텍스트 파일 (가장 일반적)',
      json: 'JavaScript Object Notation 파일',
      excel: 'Microsoft Excel 파일 (.xlsx, .xls)',
      parquet: '컬럼형 저장 파일 (빅데이터 처리에 최적화)',
    };
    return descriptions[fileType] || '';
  };

  // 파일 선택 처리
  const handleFileSelect = (file: File) => {
    setFileInfo({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    });

    // 파일 확장자에 따른 파일 타입 자동 설정
    const extension = file.name.split('.').pop()?.toLowerCase();
    let detectedType: string;
    
    switch (extension) {
      case 'csv':
        detectedType = 'csv';
        break;
      case 'json':
        detectedType = 'json';
        break;
      case 'xlsx':
      case 'xls':
        detectedType = 'excel';
        break;
      case 'parquet':
        detectedType = 'parquet';
        break;
      default:
        detectedType = 'csv';
    }

    props.onConfigChange({
      ...props.config,
      filePath: file.name,
      fileType: detectedType as any,
    });

    // 파일 미리보기 (CSV만)
    if (detectedType === 'csv' && file.size < 1024 * 1024) { // 1MB 미만
      previewCSVFile(file);
    }

    return false; // 자동 업로드 방지
  };

  // CSV 파일 미리보기
  const previewCSVFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').slice(0, 5); // 처음 5줄만
      const delimiter = props.config.delimiter || ',';
      
      const rows = lines.map(line => line.split(delimiter));
      setPreviewData(rows);
    };
    reader.readAsText(file, props.config.encoding || 'utf-8');
  };

  // 파일 경로 직접 입력 처리
  const handlePathChange = (path: string) => {
    props.onConfigChange({
      ...props.config,
      filePath: path,
    });
    
    // 확장자에 따른 파일 타입 자동 설정
    const extension = path.split('.').pop()?.toLowerCase();
    if (extension && ['csv', 'json', 'xlsx', 'xls', 'parquet'].includes(extension)) {
      const detectedType = extension === 'xlsx' || extension === 'xls' ? 'excel' : extension;
      props.onConfigChange({
        ...props.config,
        filePath: path,
        fileType: detectedType as any,
      });
    }
  };

  // 전체 미리보기 실행
  const handlePreview = async () => {
    if (!props.config.filePath) {
      message.error('파일을 선택하세요.');
      return;
    }

    setPreviewLoading(true);
    try {
      // Mock 데이터 생성 (실제로는 파일 읽기 API 호출)
      const mockData = Array.from({ length: 10 }, (_, index) => ({
        key: index,
        column1: `Data ${index + 1}`,
        column2: `Value ${index + 1}`,
        column3: Math.floor(Math.random() * 1000),
        column4: new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0],
        column5: ['Active', 'Inactive', 'Pending'][Math.floor(Math.random() * 3)],
      }));

      const columns = [
        { title: 'Column 1', dataIndex: 'column1', key: 'column1' },
        { title: 'Column 2', dataIndex: 'column2', key: 'column2' },
        { title: 'Column 3', dataIndex: 'column3', key: 'column3' },
        { title: 'Column 4', dataIndex: 'column4', key: 'column4' },
        { title: 'Column 5', dataIndex: 'column5', key: 'column5' },
      ];

      setPreviewData(mockData);
      setPreviewColumns(columns);
      setPreviewModalVisible(true);
      message.success('파일 미리보기가 완료되었습니다.');
    } catch (error) {
      console.error('Preview error:', error);
      message.error('미리보기 중 오류가 발생했습니다.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // 설정 저장
  const handleSave = () => {
    if (!props.config.filePath) {
      message.error('파일을 선택하세요.');
      return;
    }
    
    if (!props.config.fileType) {
      message.error('파일 형식을 선택하세요.');
      return;
    }

    props.onConfigChange({
      ...props.config,
      filePath: props.config.filePath,
      fileType: props.config.fileType,
    });
    
    message.success('File Input 설정이 저장되었습니다.');
  };

  // 업로드 설정
  const uploadProps: UploadProps = {
    accept: '.csv,.json,.xlsx,.xls',
    showUploadList: false,
    beforeUpload: handleFileSelect,
  };

  // 스키마 업데이트 (파일 선택 UI 추가)
  const enhancedSchema = {
    ...fileInputSchema,
    sections: fileInputSchema.sections.map(section => {
      if (section.title === '파일 설정') {
        return {
          ...section,
          fields: section.fields.map(field => {
            if (field.key === 'filePath') {
              return {
                ...field,
                customComponent: (
                  <div>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {/* 파일 업로드 */}
                      <Upload {...uploadProps}>
                        <Button icon={<UploadOutlined />} block>
                          파일 선택 (브라우저에서)
                        </Button>
                      </Upload>

                      {/* 또는 경로 직접 입력 */}
                      <div>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          또는 파일 경로 직접 입력:
                        </Text>
                        <input
                          type="text"
                          placeholder="C:\data\input.csv 또는 /data/input.csv"
                          value={props.config.filePath || ''}
                          onChange={(e) => handlePathChange(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '4px 8px',
                            border: '1px solid #d9d9d9',
                            borderRadius: '4px',
                            marginTop: '4px',
                          }}
                        />
                      </div>

                      {/* 파일 정보 표시 */}
                      {fileInfo && (
                        <Card size="small" title="선택된 파일 정보">
                          <Descriptions size="small" column={1}>
                            <Descriptions.Item label="파일명">
                              <Space>
                                <FolderOpenOutlined />
                                {fileInfo.name}
                              </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="크기">
                              {(fileInfo.size / 1024).toFixed(1)} KB
                            </Descriptions.Item>
                            <Descriptions.Item label="수정일">
                              {new Date(fileInfo.lastModified).toLocaleString()}
                            </Descriptions.Item>
                          </Descriptions>
                        </Card>
                      )}

                      {/* CSV 미리보기 */}
                      {previewData.length > 0 && props.config.fileType === 'csv' && (
                        <Card 
                          size="small" 
                          title={
                            <Space>
                              <EyeOutlined />
                              데이터 미리보기 (처음 5행)
                            </Space>
                          }
                        >
                          <div style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                            {previewData.map((row, rowIndex) => (
                              <div key={rowIndex} style={{ marginBottom: '2px' }}>
                                {row.map((cell, cellIndex) => (
                                  <span 
                                    key={cellIndex}
                                    style={{ 
                                      display: 'inline-block',
                                      width: '80px',
                                      marginRight: '8px',
                                      padding: '2px 4px',
                                      backgroundColor: rowIndex === 0 ? '#f0f0f0' : 'transparent',
                                      fontWeight: rowIndex === 0 ? 'bold' : 'normal',
                                      border: '1px solid #f0f0f0',
                                    }}
                                    title={cell}
                                  >
                                    {cell?.length > 10 ? `${cell.substring(0, 10)}...` : cell}
                                  </span>
                                ))}
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}
                    </Space>
                  </div>
                ),
              };
            }

            if (field.key === 'fileType') {
              return {
                ...field,
                customComponent: (
                  <Select
                    value={props.config.fileType}
                    onChange={(value) => props.onConfigChange({
                      ...props.config,
                      fileType: value,
                    })}
                    style={{ width: '100%' }}
                    placeholder="파일 형식을 선택하세요"
                  >
                    {field.options?.map(option => (
                      <Option key={option.value} value={option.value}>
                        <Space>
                          {getFileTypeIcon(option.value)}
                          <div>
                            <div>{option.label}</div>
                            <Text type="secondary" style={{ fontSize: '11px' }}>
                              {getFileTypeDescription(option.value)}
                            </Text>
                          </div>
                        </Space>
                      </Option>
                    ))}
                  </Select>
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
      {/* 파일 타입별 추가 안내 */}
      {props.config.fileType && (
        <Alert
          type="info"
          showIcon
          message={`${props.config.fileType?.toUpperCase()} 파일 설정`}
          description={getFileTypeDescription(props.config.fileType)}
          style={{ marginBottom: 16 }}
        />
      )}

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
              disabled={!props.config.filePath || !props.config.fileType}
            >
              저장
            </Button>
            <Button
              icon={<EyeOutlined />}
              onClick={handlePreview}
              loading={previewLoading}
              disabled={!props.config.filePath}
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
            <FileTextOutlined />
            <Text strong>File Input 미리보기</Text>
            <Tag color="blue">{props.config.fileType?.toUpperCase()}</Tag>
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
              파일: {props.config.filePath}
            </Text>
            {fileInfo && (
              <Text type="secondary">
                크기: {(fileInfo.size / 1024).toFixed(1)} KB | 형식: {props.config.fileType?.toUpperCase()}
              </Text>
            )}
          </Space>
        </div>
        
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
        />
      </Modal>
    </div>
  );
};

export default FileInputConfig;
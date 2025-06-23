/**
 * 설정 가져오기/내보내기 컴포넌트
 * CLAUDE.local.md 가이드라인에 따른 설정 파일 관리
 */

import React, { useState } from 'react';
import {
  Button,
  Upload,
  Space,
  message,
  Tooltip,
  Modal,
  Typography,
  Card,
  Descriptions,
  Tag,
  Alert,
} from 'antd';
import {
  ExportOutlined,
  ImportOutlined,
  FileTextOutlined,
  DownloadOutlined,
  CloudDownloadOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';

import { NodeType, NodeConfig } from '../types';
import { nodeConfigService } from '@/services/nodeConfigService';

const { Text, Title } = Typography;

interface ConfigImportExportProps {
  nodeId: string;
  nodeType: NodeType;
  config: NodeConfig;
  onImport: (config: NodeConfig) => void;
}

const ConfigImportExport: React.FC<ConfigImportExportProps> = ({
  nodeId,
  nodeType,
  config,
  onImport,
}) => {
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importedData, setImportedData] = useState<{
    nodeId: string;
    nodeType: NodeType;
    config: NodeConfig;
  } | null>(null);

  // 설정 내보내기
  const handleExport = () => {
    try {
      nodeConfigService.exportConfig(nodeId, nodeType, config);
      message.success('설정 파일이 다운로드되었습니다.');
    } catch (error) {
      message.error('설정 내보내기에 실패했습니다.');
    }
  };

  // 파일 업로드 전 검증
  const beforeUpload: UploadProps['beforeUpload'] = async (file) => {
    const isJson = file.type === 'application/json' || file.name.endsWith('.json');
    if (!isJson) {
      message.error('JSON 파일만 업로드 가능합니다.');
      return false;
    }

    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error('파일 크기는 5MB 이하여야 합니다.');
      return false;
    }

    try {
      const data = await nodeConfigService.importConfig(file);
      
      // 노드 타입 호환성 확인
      if (data.nodeType !== nodeType) {
        message.warning(`다른 노드 타입(${data.nodeType})의 설정 파일입니다.`);
        Modal.confirm({
          title: '노드 타입 불일치',
          content: (
            <div>
              <p>가져온 설정 파일의 노드 타입이 현재 노드와 다릅니다.</p>
              <p>
                <Text strong>현재 노드: </Text>{getNodeTypeLabel(nodeType)}<br/>
                <Text strong>파일의 노드: </Text>{getNodeTypeLabel(data.nodeType)}
              </p>
              <p>그래도 가져오시겠습니까?</p>
            </div>
          ),
          onOk: () => {
            setImportedData(data);
            setImportModalVisible(true);
          },
        });
      } else {
        setImportedData(data);
        setImportModalVisible(true);
      }
    } catch (error) {
      message.error('파일을 읽는데 실패했습니다.');
    }

    return false; // 자동 업로드 방지
  };

  // 설정 가져오기 확인
  const handleImportConfirm = () => {
    if (importedData) {
      onImport(importedData.config);
      message.success('설정을 가져왔습니다.');
      setImportModalVisible(false);
      setImportedData(null);
    }
  };

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
    <>
      <Space>
        <Tooltip title="현재 설정을 JSON 파일로 내보내기">
          <Button
            icon={<ExportOutlined />}
            onClick={handleExport}
          >
            내보내기
          </Button>
        </Tooltip>

        <Upload
          beforeUpload={beforeUpload}
          showUploadList={false}
          accept=".json"
        >
          <Tooltip title="JSON 파일에서 설정 가져오기">
            <Button icon={<ImportOutlined />}>
              가져오기
            </Button>
          </Tooltip>
        </Upload>
      </Space>

      {/* 가져오기 확인 모달 */}
      <Modal
        title={
          <Space>
            <ImportOutlined />
            설정 가져오기 확인
          </Space>
        }
        open={importModalVisible}
        onOk={handleImportConfirm}
        onCancel={() => {
          setImportModalVisible(false);
          setImportedData(null);
        }}
        width={700}
        okText="가져오기"
        cancelText="취소"
      >
        {importedData && (
          <div>
            <Alert
              type="info"
              showIcon
              message="가져온 설정으로 현재 설정이 완전히 교체됩니다."
              style={{ marginBottom: 16 }}
            />

            <Card size="small" title="파일 정보">
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="노드 ID">
                  {importedData.nodeId}
                </Descriptions.Item>
                <Descriptions.Item label="노드 타입">
                  <Tag color={importedData.nodeType === nodeType ? 'green' : 'orange'}>
                    {getNodeTypeLabel(importedData.nodeType)}
                  </Tag>
                  {importedData.nodeType !== nodeType && (
                    <Text type="warning" style={{ marginLeft: 8 }}>
                      (현재 노드와 다름)
                    </Text>
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card 
              size="small" 
              title="가져올 설정 미리보기"
              style={{ marginTop: 16 }}
            >
              <pre style={{
                fontSize: '12px',
                maxHeight: '300px',
                overflow: 'auto',
                background: '#f5f5f5',
                padding: '8px',
                borderRadius: '4px',
              }}>
                {JSON.stringify(importedData.config, null, 2)}
              </pre>
            </Card>
          </div>
        )}
      </Modal>
    </>
  );
};

export default ConfigImportExport;
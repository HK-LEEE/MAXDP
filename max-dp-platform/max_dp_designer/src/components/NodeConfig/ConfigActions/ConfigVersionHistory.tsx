/**
 * 설정 버전 이력 컴포넌트
 * CLAUDE.local.md 가이드라인에 따른 설정 버전 관리
 */

import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Timeline,
  Button,
  Space,
  Typography,
  Tag,
  Divider,
  Empty,
  message,
  Popconfirm,
  Input,
  Modal,
  Tooltip,
  Badge,
  Card,
} from 'antd';
import {
  HistoryOutlined,
  RollbackOutlined,
  SaveOutlined,
  ClockCircleOutlined,
  UserOutlined,
  MessageOutlined,
  DiffOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

import { NodeConfig } from '../types';
import { nodeConfigService, NodeConfigVersion } from '@/services/nodeConfigService';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

interface ConfigVersionHistoryProps {
  visible: boolean;
  nodeId: string;
  currentConfig: NodeConfig;
  onClose: () => void;
  onRestore: (config: NodeConfig) => void;
}

const ConfigVersionHistory: React.FC<ConfigVersionHistoryProps> = ({
  visible,
  nodeId,
  currentConfig,
  onClose,
  onRestore,
}) => {
  const [versions, setVersions] = useState<NodeConfigVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [saveComment, setSaveComment] = useState('');
  const [selectedVersion, setSelectedVersion] = useState<NodeConfigVersion | null>(null);
  const [diffModalVisible, setDiffModalVisible] = useState(false);

  // 버전 목록 불러오기
  useEffect(() => {
    if (visible) {
      loadVersions();
    }
  }, [visible, nodeId]);

  const loadVersions = () => {
    const versionList = nodeConfigService.getConfigVersions(nodeId);
    setVersions(versionList);
  };

  // 현재 설정을 새 버전으로 저장
  const handleSaveVersion = () => {
    try {
      nodeConfigService.saveConfigVersion(nodeId, currentConfig, saveComment);
      message.success('새 버전이 저장되었습니다.');
      setSaveModalVisible(false);
      setSaveComment('');
      loadVersions();
    } catch (error) {
      message.error('버전 저장에 실패했습니다.');
    }
  };

  // 특정 버전으로 복원
  const handleRestoreVersion = (version: NodeConfigVersion) => {
    const config = nodeConfigService.restoreConfigVersion(nodeId, version.id);
    if (config) {
      onRestore(config);
      message.success(`버전 ${version.version}으로 복원되었습니다.`);
      onClose();
    } else {
      message.error('버전 복원에 실패했습니다.');
    }
  };

  // 설정 차이점 계산 (간단한 구현)
  const calculateDiff = (oldConfig: NodeConfig, newConfig: NodeConfig) => {
    const changes: string[] = [];
    
    const compareObjects = (old: any, new_: any, path: string = '') => {
      for (const key in new_) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (!(key in old)) {
          changes.push(`+ ${currentPath}: ${JSON.stringify(new_[key])}`);
        } else if (typeof new_[key] === 'object' && new_[key] !== null) {
          compareObjects(old[key], new_[key], currentPath);
        } else if (old[key] !== new_[key]) {
          changes.push(`~ ${currentPath}: ${JSON.stringify(old[key])} → ${JSON.stringify(new_[key])}`);
        }
      }
      
      for (const key in old) {
        if (!(key in new_)) {
          const currentPath = path ? `${path}.${key}` : key;
          changes.push(`- ${currentPath}: ${JSON.stringify(old[key])}`);
        }
      }
    };
    
    compareObjects(oldConfig, newConfig);
    return changes;
  };

  // 버전 간 차이점 표시
  const showDiff = (version: NodeConfigVersion) => {
    setSelectedVersion(version);
    setDiffModalVisible(true);
  };

  // 시간 포맷팅
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return `${minutes}분 전`;
      }
      return `${hours}시간 전`;
    }
    
    if (days < 7) {
      return `${days}일 전`;
    }
    
    return date.toLocaleDateString();
  };

  return (
    <>
      <Drawer
        title={
          <Space>
            <HistoryOutlined />
            설정 버전 이력
            <Badge count={versions.length} style={{ backgroundColor: '#52c41a' }} />
          </Space>
        }
        placement="right"
        width={500}
        open={visible}
        onClose={onClose}
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            size="small"
            onClick={() => setSaveModalVisible(true)}
          >
            현재 버전 저장
          </Button>
        }
      >
        {versions.length > 0 ? (
          <Timeline mode="left">
            {/* 현재 상태 (미저장) */}
            <Timeline.Item
              color="blue"
              dot={<CheckCircleOutlined />}
              label={
                <Space direction="vertical" size={0}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    현재
                  </Text>
                </Space>
              }
            >
              <Card size="small" style={{ backgroundColor: '#e6f7ff' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text strong>현재 설정 (미저장)</Text>
                  <Button
                    size="small"
                    icon={<SaveOutlined />}
                    onClick={() => setSaveModalVisible(true)}
                  >
                    버전으로 저장
                  </Button>
                </Space>
              </Card>
            </Timeline.Item>

            {/* 저장된 버전들 */}
            {versions.map((version, index) => (
              <Timeline.Item
                key={version.id}
                color={index === 0 ? 'green' : 'gray'}
                label={
                  <Space direction="vertical" size={0}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {formatTime(version.createdAt)}
                    </Text>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      {new Date(version.createdAt).toLocaleTimeString()}
                    </Text>
                  </Space>
                }
              >
                <Card 
                  size="small"
                  hoverable
                  actions={[
                    <Tooltip title="이 버전으로 복원">
                      <Button
                        type="text"
                        size="small"
                        icon={<RollbackOutlined />}
                        onClick={() => handleRestoreVersion(version)}
                      >
                        복원
                      </Button>
                    </Tooltip>,
                    <Tooltip title="변경사항 보기">
                      <Button
                        type="text"
                        size="small"
                        icon={<DiffOutlined />}
                        onClick={() => showDiff(version)}
                      >
                        차이점
                      </Button>
                    </Tooltip>,
                  ]}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <Text strong>버전 {version.version}</Text>
                      {index === 0 && (
                        <Tag color="green" style={{ marginLeft: 8 }}>
                          최신
                        </Tag>
                      )}
                    </div>
                    
                    {version.comment && (
                      <div>
                        <MessageOutlined style={{ marginRight: 4 }} />
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {version.comment}
                        </Text>
                      </div>
                    )}
                    
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      <UserOutlined /> {version.createdBy}
                    </Text>
                  </Space>
                </Card>
              </Timeline.Item>
            ))}
          </Timeline>
        ) : (
          <Empty
            description="저장된 버전이 없습니다"
            style={{ marginTop: 50 }}
          >
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => setSaveModalVisible(true)}
            >
              첫 버전 저장하기
            </Button>
          </Empty>
        )}
      </Drawer>

      {/* 버전 저장 모달 */}
      <Modal
        title="새 버전 저장"
        open={saveModalVisible}
        onOk={handleSaveVersion}
        onCancel={() => setSaveModalVisible(false)}
        okText="저장"
        cancelText="취소"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>버전 {versions.length + 1}</Text>
            <Text type="secondary" style={{ marginLeft: 8 }}>
              {new Date().toLocaleString()}
            </Text>
          </div>
          
          <div>
            <Text>변경사항 설명 (선택사항):</Text>
            <TextArea
              rows={3}
              value={saveComment}
              onChange={(e) => setSaveComment(e.target.value)}
              placeholder="이 버전의 주요 변경사항을 설명하세요..."
              maxLength={200}
              showCount
            />
          </div>
        </Space>
      </Modal>

      {/* 차이점 표시 모달 */}
      <Modal
        title={
          <Space>
            <DiffOutlined />
            버전 {selectedVersion?.version} 변경사항
          </Space>
        }
        open={diffModalVisible}
        onCancel={() => setDiffModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDiffModalVisible(false)}>
            닫기
          </Button>,
        ]}
        width={700}
      >
        {selectedVersion && (
          <div>
            {selectedVersion.comment && (
              <Card size="small" style={{ marginBottom: 16 }}>
                <Space>
                  <MessageOutlined />
                  <Text>{selectedVersion.comment}</Text>
                </Space>
              </Card>
            )}
            
            <div style={{
              background: '#f5f5f5',
              padding: '12px',
              borderRadius: '4px',
              maxHeight: '400px',
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: '12px',
            }}>
              {versions.indexOf(selectedVersion) < versions.length - 1 ? (
                calculateDiff(
                  versions[versions.indexOf(selectedVersion) + 1].config,
                  selectedVersion.config
                ).map((change, index) => (
                  <div
                    key={index}
                    style={{
                      color: change.startsWith('+') ? '#52c41a' 
                        : change.startsWith('-') ? '#ff4d4f'
                        : '#1890ff',
                      marginBottom: '4px',
                    }}
                  >
                    {change}
                  </div>
                ))
              ) : (
                <Text type="secondary">첫 버전입니다.</Text>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default ConfigVersionHistory;
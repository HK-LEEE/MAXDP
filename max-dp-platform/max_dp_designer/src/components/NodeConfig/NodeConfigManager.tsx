/**
 * 노드 설정 관리자 컴포넌트
 * CLAUDE.local.md 가이드라인에 따른 노드 타입별 설정 컴포넌트 라우팅
 */

import React, { useState, useCallback } from 'react';
import { Alert, message } from 'antd';

import { NodeType, NodeConfigProps, NodeConfig } from './types';
import BaseNodeConfig from './BaseNodeConfig';
import { nodeConfigSchemas } from './schemas';

// 데이터 소스 노드 컴포넌트들
import TableReaderConfig from './DataSourceNodes/TableReaderConfig';
import CustomSQLConfig from './DataSourceNodes/CustomSQLConfig';
import FileInputConfig from './DataSourceNodes/FileInputConfig';
import ApiQueryConfig from './DataSourceNodes/ApiQueryConfig';

// 데이터 변환 노드 컴포넌트들
import SelectColumnsConfig from './TransformNodes/SelectColumnsConfig_NEW';
import FilterRowsConfig from './TransformNodes/FilterRowsConfig';
import RenameColumnsConfig from './TransformNodes/RenameColumnsConfig';
import JoinDataConfig from './TransformNodes/JoinDataConfig';

// 데이터 출력 노드 컴포넌트들
import TableWriterConfig from './OutputNodes/TableWriterConfig';
import FileWriterConfig from './OutputNodes/FileWriterConfig';

interface NodeConfigManagerProps extends Omit<NodeConfigProps, 'nodeType'> {
  nodeType: string; // string으로 받아서 내부에서 NodeType으로 변환
  nodes?: any[];
  edges?: any[];
}

/**
 * 노드 타입에 따라 적절한 설정 컴포넌트를 렌더링하는 관리자 컴포넌트
 */
const NodeConfigManager: React.FC<NodeConfigManagerProps> = (props) => {
  const { nodeType: nodeTypeString, nodes, edges, ...restProps } = props;
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isValid, setIsValid] = useState(true);

  // 검증 결과 처리
  const handleValidation = useCallback((valid: boolean, errors: Record<string, string>) => {
    setIsValid(valid);
    setValidationErrors(errors);
    
    // 부모 컴포넌트에 검증 결과 전달
    restProps.onValidate?.(valid, errors);
  }, [restProps]);

  // 문자열을 NodeType enum으로 변환
  const getNodeType = (typeString: string): NodeType | null => {
    const typeMap: Record<string, NodeType> = {
      'tableReader': NodeType.TABLE_READER,
      'customSQL': NodeType.CUSTOM_SQL,
      'fileInput': NodeType.FILE_INPUT,
      'apiQuery': NodeType.API_QUERY,
      'selectColumns': NodeType.SELECT_COLUMNS,
      'filterRows': NodeType.FILTER_ROWS,
      'renameColumns': NodeType.RENAME_COLUMNS,
      'joinData': NodeType.JOIN_DATA,
      'tableWriter': NodeType.TABLE_WRITER,
      'fileWriter': NodeType.FILE_WRITER,
    };

    return typeMap[typeString] || null;
  };

  const nodeType = getNodeType(nodeTypeString);

  // 지원되지 않는 노드 타입 처리
  if (!nodeType) {
    return (
      <Alert
        type="warning"
        showIcon
        message="지원되지 않는 노드 타입"
        description={`'${nodeTypeString}' 노드 타입의 설정 UI가 아직 구현되지 않았습니다.`}
        style={{ margin: 16 }}
      />
    );
  }

  // 노드 타입별 설정 컴포넌트 렌더링
  const renderNodeConfig = () => {
    const commonProps = {
      ...restProps,
      nodeType,
      onValidate: handleValidation,
    };

    switch (nodeType) {
      case NodeType.TABLE_READER:
        return <TableReaderConfig {...commonProps} />;

      case NodeType.CUSTOM_SQL:
        console.log('=== NodeConfigManager: Rendering CustomSQLConfig ===');
        console.log('CommonProps:', commonProps);
        console.log('Config passed to CustomSQLConfig:', commonProps.config);
        return <CustomSQLConfig {...commonProps} />;

      case NodeType.FILE_INPUT:
        return <FileInputConfig {...commonProps} />;

      case NodeType.API_QUERY:
        return <ApiQueryConfig {...commonProps} />;

      case NodeType.SELECT_COLUMNS:
        return <SelectColumnsConfig {...commonProps} nodes={nodes} edges={edges} />;

      case NodeType.FILTER_ROWS:
        return <FilterRowsConfig {...commonProps} nodes={nodes} edges={edges} />;

      case NodeType.RENAME_COLUMNS:
        return <RenameColumnsConfig {...commonProps} nodes={nodes} edges={edges} />;

      case NodeType.JOIN_DATA:
        return <JoinDataConfig {...commonProps} nodes={nodes} edges={edges} />;

      case NodeType.TABLE_WRITER:
        return <TableWriterConfig {...commonProps} />;

      case NodeType.FILE_WRITER:
        return <FileWriterConfig {...commonProps} />;

      default:
        return (
          <Alert
            type="info"
            showIcon
            message="기본 설정 UI"
            description="이 노드 타입은 기본 설정 UI를 사용합니다."
            style={{ margin: 16 }}
          />
        );
    }
  };

  return (
    <div className="node-config-manager">
      {renderNodeConfig()}
    </div>
  );
};

export default NodeConfigManager;
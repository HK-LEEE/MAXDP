/**
 * 노드 설정 UI의 공통 타입 정의
 * CLAUDE.local.md 가이드라인에 따른 TypeScript 타입 안전성 확보
 */

import { ReactNode } from 'react';

// 기본 노드 설정 인터페이스
export interface BaseNodeConfig {
  label: string;
  description?: string;
  enabled?: boolean;
}

// WHERE 조건 인터페이스
export interface WhereCondition {
  id: string;
  column: string;
  operator: string;
  value: string;
}

// 노드 타입별 설정 인터페이스들
export interface TableReaderConfig extends BaseNodeConfig {
  tableName: string;
  schema?: string;
  connectionId?: string;
  limit?: number;
  whereClause?: string;
  whereConditions?: WhereCondition[];
}

export interface CustomSQLConfig extends BaseNodeConfig {
  sqlQuery: string;
  connectionId?: string;
  parameters?: Record<string, any>;
}

export interface FileInputConfig extends BaseNodeConfig {
  filePath: string;
  fileType: 'csv' | 'json' | 'excel' | 'parquet';
  encoding?: string;
  delimiter?: string;
  hasHeader?: boolean;
  sheetName?: string; // for Excel files
}

export interface ApiQueryConfig extends BaseNodeConfig {
  apiUrl: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  parameters?: Record<string, string>;
  body?: string;
  responseType: 'json' | 'text' | 'xml';
  timeout: number;
  retryCount: number;
  authentication?: {
    type: 'none' | 'bearer' | 'basic' | 'apikey';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    headerName?: string;
  };
}

export interface SelectColumnsConfig extends BaseNodeConfig {
  selectedColumns: string[];
  columnMappings?: Record<string, string>;
}

export interface FilterRowsConfig extends BaseNodeConfig {
  filters: FilterCondition[];
  logicalOperator: 'AND' | 'OR';
}

export interface FilterCondition {
  id?: string;
  column: string;
  operator: 'equals' | 'notEquals' | 'greater' | 'less' | 'greaterEqual' | 'lessEqual' | 'contains' | 'startsWith' | 'endsWith' | 'isNull' | 'isNotNull';
  value?: any;
  valueType?: 'static' | 'parameter' | 'column';
  logicalOperator?: 'AND' | 'OR';
}

export interface RenameColumnsConfig extends BaseNodeConfig {
  columnMappings: Record<string, string>;
}

export interface TableWriterConfig extends BaseNodeConfig {
  tableName: string;
  schema?: string;
  connectionId?: string;
  writeMode: 'insert' | 'upsert' | 'replace' | 'append';
  primaryKeys?: string[];
}

export interface FileWriterConfig extends BaseNodeConfig {
  filePath: string;
  fileType: 'csv' | 'json' | 'excel' | 'parquet';
  encoding?: string;
  delimiter?: string;
  includeHeader?: boolean;
}

// 노드 설정 유니온 타입
export type NodeConfig = 
  | TableReaderConfig
  | CustomSQLConfig
  | FileInputConfig
  | ApiQueryConfig
  | SelectColumnsConfig
  | FilterRowsConfig
  | RenameColumnsConfig
  | TableWriterConfig
  | FileWriterConfig;

// 노드 타입 열거형
export enum NodeType {
  TABLE_READER = 'tableReader',
  CUSTOM_SQL = 'customSQL',
  FILE_INPUT = 'fileInput',
  API_QUERY = 'apiQuery',
  SELECT_COLUMNS = 'selectColumns',
  FILTER_ROWS = 'filterRows',
  RENAME_COLUMNS = 'renameColumns',
  TABLE_WRITER = 'tableWriter',
  FILE_WRITER = 'fileWriter',
}

// 노드 설정 컴포넌트 Props
export interface NodeConfigProps<T extends NodeConfig = NodeConfig> {
  nodeId: string;
  nodeType: NodeType;
  config: Partial<T>;
  onConfigChange: (config: Partial<T>) => void;
  onValidate?: (isValid: boolean, errors?: Record<string, string>) => void;
  readOnly?: boolean;
}

// 폼 필드 메타데이터
export interface FormFieldMeta {
  key: string;
  label: string;
  type: 'input' | 'textarea' | 'select' | 'switch' | 'number' | 'multiSelect' | 'fileUpload' | 'custom';
  required?: boolean;
  placeholder?: string;
  tooltip?: string;
  options?: Array<{ value: any; label: string; description?: string }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    message?: string;
  };
  dependency?: {
    field: string;
    condition: (value: any) => boolean;
  };
  customComponent?: ReactNode;
}

// 노드 설정 스키마
export interface NodeConfigSchema {
  title: string;
  description?: string;
  sections: Array<{
    title: string;
    fields: FormFieldMeta[];
    collapsible?: boolean;
    defaultCollapsed?: boolean;
  }>;
}

// 데이터베이스 연결 정보
export interface DatabaseConnection {
  id: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'mssql' | 'oracle' | 'sqlite';
  host?: string;
  port?: number;
  database?: string;
  schema?: string;
  username?: string;
  isActive: boolean;
}

// 컬럼 메타데이터
export interface ColumnMetadata {
  name: string;
  type: string;
  nullable: boolean;
  description?: string;
  defaultValue?: any;
}

// 테이블 메타데이터
export interface TableMetadata {
  name: string;
  schema?: string;
  columns: ColumnMetadata[];
  rowCount?: number;
  description?: string;
}

// 노드 실행 결과 미리보기
export interface NodePreviewData {
  columns: ColumnMetadata[];
  rows: Record<string, any>[];
  totalRows: number;
  executionTime: number;
  error?: string;
}

// 노드 설정 검증 결과
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings?: Record<string, string>;
}

// 설정 변경 이벤트
export interface ConfigChangeEvent<T extends NodeConfig = NodeConfig> {
  nodeId: string;
  field: keyof T;
  value: any;
  config: Partial<T>;
}
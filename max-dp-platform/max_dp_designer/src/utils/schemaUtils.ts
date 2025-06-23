/**
 * 스키마 정보 유틸리티
 * 이전 노드들로부터 컬럼 정보를 추출하는 기능 제공
 */

import { apiService } from '../services/api';

export interface ColumnInfo {
  name: string;
  type: string;
  nullable?: boolean;
  description?: string;
}

export interface SchemaInfo {
  columns: ColumnInfo[];
  sourceNodeId: string;
  sourceNodeType: string;
}

/**
 * 노드의 입력 스키마 정보를 가져옵니다
 * @param nodeId 현재 노드 ID
 * @param nodes 모든 노드 배열
 * @param edges 모든 엣지 배열
 * @returns 입력 스키마 정보
 */
export async function getInputSchema(
  nodeId: string, 
  nodes: any[], 
  edges: any[]
): Promise<SchemaInfo | null> {
  try {
    console.log('getInputSchema called with:', { nodeId, nodeCount: nodes.length, edgeCount: edges.length });
    
    // 현재 노드로 들어오는 엣지 찾기
    const incomingEdges = edges.filter(edge => edge.target === nodeId);
    console.log('Incoming edges for node', nodeId, ':', incomingEdges);
    
    if (incomingEdges.length === 0) {
      console.log('No incoming edges found for node:', nodeId);
      return null;
    }

    // 첫 번째 입력 노드를 기준으로 스키마 정보 가져오기
    const sourceEdge = incomingEdges[0];
    const sourceNode = nodes.find(node => node.id === sourceEdge.source);
    
    console.log('Source edge:', sourceEdge);
    console.log('Source node found:', sourceNode);
    
    if (!sourceNode) {
      console.log('Source node not found for ID:', sourceEdge.source);
      return null;
    }

    console.log('Getting schema from source node:', {
      id: sourceNode.id,
      type: sourceNode.data?.type,
      config: sourceNode.data?.config
    });

    const columns = await extractColumnsFromNode(sourceNode);
    console.log('Extracted columns:', columns);
    
    if (columns.length === 0) {
      console.log('No columns extracted from source node');
      return null;
    }

    const result = {
      columns,
      sourceNodeId: sourceNode.id,
      sourceNodeType: sourceNode.data?.type || 'unknown'
    };
    
    console.log('Returning schema info:', result);
    return result;

  } catch (error) {
    console.error('Error getting input schema:', error);
    return null;
  }
}

/**
 * 노드에서 컬럼 정보를 추출합니다
 * @param node 소스 노드
 * @returns 컬럼 정보 배열
 */
async function extractColumnsFromNode(node: any): Promise<ColumnInfo[]> {
  const nodeType = node.data?.type;
  const config = node.data?.config || {};

  console.log('Extracting columns from node:', {
    nodeId: node.id,
    nodeType,
    config: config,
    hasConfig: !!config,
    configKeys: Object.keys(config)
  });

  switch (nodeType) {
    case 'tableReader':
      console.log('Processing tableReader node...');
      return await extractFromTableReader(config);
    
    case 'customSQL':
      console.log('Processing customSQL node...');
      return await extractFromCustomSQL(config);
    
    case 'fileInput':
      console.log('Processing fileInput node...');
      return extractFromFileInput(config);
    
    case 'apiQuery':
      console.log('Processing apiQuery node...');
      return extractFromApiQuery(config);
    
    case 'selectColumns':
      console.log('Processing selectColumns node...');
      return extractFromSelectColumns(config);
    
    case 'filterRows':
      console.log('Processing filterRows node...');
      return extractFromFilterRows(config);
    
    case 'renameColumns':
      console.log('Processing renameColumns node...');
      return extractFromRenameColumns(config);
    
    default:
      console.log('Unknown node type for schema extraction:', nodeType);
      return [];
  }
}

/**
 * Table Reader 노드에서 컬럼 정보 추출
 */
async function extractFromTableReader(config: any): Promise<ColumnInfo[]> {
  try {
    console.log('extractFromTableReader called with config:', config);
    
    if (!config.connectionId || !config.tableName) {
      console.log('Table Reader config incomplete - missing:', {
        connectionId: !config.connectionId,
        tableName: !config.tableName
      });
      return [];
    }

    console.log('Calling getDatabaseTables with:', {
      connectionId: config.connectionId,
      schema: config.schema || 'public'
    });

    const response = await apiService.getDatabaseTables(config.connectionId, config.schema || 'public');
    
    if (response.success && response.data) {
      console.log('Looking for table:', config.tableName, 'in tables:', response.data.map(t => t.name));
      
      const table = response.data.find(t => t.name === config.tableName);
      console.log('Found table:', table);
      
      if (table && table.columns) {
        const mappedColumns = table.columns.map((col: any) => ({
          name: col.name || col.column_name,
          type: col.type || col.data_type || 'unknown',
          nullable: col.nullable !== undefined ? col.nullable : col.is_nullable,
          description: col.description || col.comment
        }));
        
        console.log('Mapped columns:', mappedColumns);
        return mappedColumns;
      } else {
        console.log('Table not found or has no columns');
      }
    } else {
      console.log('API response failed:', response);
    }

    return [];
  } catch (error) {
    console.error('Error extracting from Table Reader:', error);
    return [];
  }
}

/**
 * Custom SQL 노드에서 컬럼 정보 추출
 */
async function extractFromCustomSQL(config: any): Promise<ColumnInfo[]> {
  try {
    // SQL 쿼리를 분석하여 컬럼 정보 추출
    // 실제로는 백엔드에 EXPLAIN 쿼리를 보내거나 샘플 실행으로 스키마 확인
    if (!config.sqlQuery) {
      return [];
    }

    // 임시로 SELECT 문에서 컬럼 추출 (간단한 파싱)
    const sqlUpper = config.sqlQuery.toUpperCase();
    const selectMatch = sqlUpper.match(/SELECT\s+(.+?)\s+FROM/);
    
    if (selectMatch) {
      const columnsPart = selectMatch[1];
      if (columnsPart.includes('*')) {
        // SELECT * 인 경우 - 실제로는 FROM 절의 테이블에서 컬럼 정보를 가져와야 함
        return [
          { name: 'column1', type: 'unknown' },
          { name: 'column2', type: 'unknown' }
        ];
      } else {
        // 명시적 컬럼 선택
        const columns = columnsPart.split(',').map(col => {
          const cleanCol = col.trim().split(' ')[0]; // alias 제거
          return {
            name: cleanCol,
            type: 'unknown'
          };
        });
        return columns;
      }
    }

    return [];
  } catch (error) {
    console.error('Error extracting from Custom SQL:', error);
    return [];
  }
}

/**
 * File Input 노드에서 컬럼 정보 추출
 */
function extractFromFileInput(config: any): ColumnInfo[] {
  // 파일에서 스키마 정보를 읽어오는 로직
  // 실제로는 파일을 샘플링하여 컬럼 정보 추출
  
  if (!config.filePath) {
    return [];
  }

  const fileType = config.fileType;
  
  // 임시 예시 데이터
  const sampleColumns: ColumnInfo[] = [
    { name: 'id', type: 'integer' },
    { name: 'name', type: 'string' },
    { name: 'email', type: 'string' },
    { name: 'created_at', type: 'datetime' }
  ];

  return sampleColumns;
}

/**
 * API Query 노드에서 컬럼 정보 추출
 */
function extractFromApiQuery(config: any): ColumnInfo[] {
  // API 응답 스키마 분석
  // 실제로는 API를 호출하여 응답 구조 분석
  
  if (!config.apiUrl) {
    return [];
  }

  // 임시 예시 데이터
  const sampleColumns: ColumnInfo[] = [
    { name: 'response_id', type: 'string' },
    { name: 'data', type: 'json' },
    { name: 'status', type: 'string' },
    { name: 'timestamp', type: 'datetime' }
  ];

  return sampleColumns;
}

/**
 * Select Columns 노드에서 컬럼 정보 추출
 */
async function extractFromSelectColumns(config: any): Promise<ColumnInfo[]> {
  console.log('extractFromSelectColumns called with config:', config);
  
  // 선택된 컬럼들만 반환
  if (!config.selectedColumns || config.selectedColumns.length === 0) {
    console.log('No selected columns found in config');
    return [];
  }

  // 원본 스키마 정보가 저장되어 있다면 사용
  if (config.sourceSchema && Array.isArray(config.sourceSchema)) {
    console.log('Using stored source schema for selected columns');
    return config.selectedColumns
      .map((colName: string) => {
        const originalColumn = config.sourceSchema.find((col: ColumnInfo) => col.name === colName);
        return originalColumn ? {
          name: colName,
          type: originalColumn.type,
          nullable: originalColumn.nullable,
          description: originalColumn.description
        } : {
          name: colName,
          type: 'unknown',
          nullable: true,
          description: `Selected column: ${colName}`
        };
      });
  }

  // 기본적으로 선택된 컬럼명만 반환 (타입 정보 없음)
  console.log('No source schema available, returning basic column info');
  return config.selectedColumns.map((colName: string) => ({
    name: colName,
    type: 'unknown',
    nullable: true,
    description: `Selected column: ${colName}`
  }));
}

/**
 * Filter Rows 노드에서 컬럼 정보 추출
 */
function extractFromFilterRows(config: any): ColumnInfo[] {
  // Filter Rows는 컬럼 구조를 변경하지 않으므로 원본 스키마 그대로 반환
  // 실제로는 이전 노드의 스키마를 재귀적으로 가져와야 함
  return [];
}

/**
 * Rename Columns 노드에서 컬럼 정보 추출
 */
function extractFromRenameColumns(config: any): ColumnInfo[] {
  // 컬럼명 변경 적용
  if (!config.columnMappings) {
    return [];
  }

  return Object.entries(config.columnMappings).map(([oldName, newName]) => ({
    name: newName as string,
    type: 'unknown' // 실제로는 원본 스키마에서 타입 정보 가져와야 함
  }));
}

/**
 * 여러 노드의 스키마를 병합합니다 (UNION 등의 경우)
 */
export function mergeSchemas(schemas: SchemaInfo[]): ColumnInfo[] {
  if (schemas.length === 0) return [];
  if (schemas.length === 1) return schemas[0].columns;

  // 첫 번째 스키마를 기준으로 공통 컬럼만 선택
  const baseColumns = schemas[0].columns;
  const commonColumns: ColumnInfo[] = [];

  baseColumns.forEach(baseCol => {
    const isCommon = schemas.every(schema => 
      schema.columns.some(col => col.name === baseCol.name)
    );
    
    if (isCommon) {
      commonColumns.push(baseCol);
    }
  });

  return commonColumns;
}
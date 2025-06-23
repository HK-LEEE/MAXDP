interface Port {
  id: string;
  name: string;
  type: 'input' | 'output';
}

interface NodePortConfig {
  inputs?: Port[];
  outputs?: Port[];
  connectionSettings?: {
    database?: string;
    table?: string;
    query?: string;
  };
  extraSettings?: Record<string, any>;
}

// 노드 타입별 포트 설정 가져오기
export const getNodePorts = (nodeType: string, config: any): NodePortConfig => {
  switch (nodeType) {
    case 'tableReader':
      return {
        outputs: [
          { id: 'data', name: 'Data Output', type: 'output' }
        ],
        connectionSettings: {
          database: config?.connectionId || 'Not configured',
          table: config?.tableName || 'Not selected',
        },
        extraSettings: {
          ...(config?.limit && { limit: config.limit }),
          ...(config?.sampling && { sampling: `${config.samplingRatio}%` }),
        }
      };

    case 'customSQL':
      return {
        outputs: [
          { id: 'result', name: 'Query Result', type: 'output' }
        ],
        connectionSettings: {
          database: config?.connectionId || 'Not configured',
          query: config?.query || 'No query defined',
        },
        extraSettings: {
          ...(config?.parameters && { params: Object.keys(config.parameters).length }),
        }
      };

    case 'fileInput':
      return {
        outputs: [
          { id: 'data', name: 'File Data', type: 'output' }
        ],
        extraSettings: {
          ...(config?.fileType && { type: config.fileType }),
          ...(config?.encoding && { encoding: config.encoding }),
          ...(config?.hasHeader !== undefined && { header: config.hasHeader ? 'Yes' : 'No' }),
        }
      };

    case 'apiQuery':
      return {
        outputs: [
          { id: 'response', name: 'API Response', type: 'output' }
        ],
        connectionSettings: {
          database: 'External API',
          query: config?.apiUrl || 'No URL configured',
        },
        extraSettings: {
          ...(config?.method && { method: config.method }),
          ...(config?.responseType && { format: config.responseType }),
          ...(config?.timeout && { timeout: `${config.timeout}ms` }),
          ...(config?.authentication?.type && config.authentication.type !== 'none' && { auth: config.authentication.type }),
        }
      };

    case 'selectColumns':
      return {
        inputs: [
          { id: 'input', name: 'Input Data', type: 'input' }
        ],
        outputs: [
          { id: 'output', name: 'Selected Data', type: 'output' }
        ],
        extraSettings: {
          ...(config?.columns && { columns: config.columns.length }),
          ...(config?.keepOriginalOrder !== undefined && { ordered: config.keepOriginalOrder ? 'Yes' : 'No' }),
        }
      };

    case 'filterRows':
      return {
        inputs: [
          { id: 'input', name: 'Input Data', type: 'input' }
        ],
        outputs: [
          { id: 'filtered', name: 'Filtered Data', type: 'output' },
          ...(config?.outputRejected ? [{ id: 'rejected', name: 'Rejected Data', type: 'output' as const }] : [])
        ],
        extraSettings: {
          ...(config?.conditions && { conditions: config.conditions.length }),
          ...(config?.logic && { logic: config.logic }),
        }
      };

    case 'renameColumns':
      return {
        inputs: [
          { id: 'input', name: 'Input Data', type: 'input' }
        ],
        outputs: [
          { id: 'output', name: 'Renamed Data', type: 'output' }
        ],
        extraSettings: {
          ...(config?.columnMappings && { mappings: Object.keys(config.columnMappings).length }),
        }
      };

    case 'joinData':
      return {
        inputs: [
          { id: 'left', name: 'Left Table', type: 'input' },
          { id: 'right', name: 'Right Table', type: 'input' }
        ],
        outputs: [
          { id: 'output', name: 'Joined Data', type: 'output' }
        ],
        extraSettings: {
          ...(config?.joinType && { type: config.joinType.toUpperCase() }),
          ...(config?.joinConditions && { conditions: config.joinConditions.length }),
        }
      };

    case 'conditionalBranch':
      return {
        inputs: [
          { id: 'input', name: 'Input Data', type: 'input' }
        ],
        outputs: [
          { id: 'true', name: 'True Branch', type: 'output' },
          { id: 'false', name: 'False Branch', type: 'output' }
        ],
        extraSettings: {
          ...(config?.condition && { condition: 'Configured' }),
        }
      };

    case 'merge':
      const mergeInputs = [];
      const inputCount = config?.inputCount || 2;
      for (let i = 1; i <= inputCount; i++) {
        mergeInputs.push({ id: `input${i}`, name: `Input ${i}`, type: 'input' as const });
      }
      return {
        inputs: mergeInputs,
        outputs: [
          { id: 'merged', name: 'Merged Data', type: 'output' }
        ],
        extraSettings: {
          ...(config?.mergeType && { type: config.mergeType }),
          ...(config?.mergeKeys && { keys: config.mergeKeys.length }),
        }
      };

    case 'tableWriter':
      return {
        inputs: [
          { id: 'input', name: 'Input Data', type: 'input' }
        ],
        connectionSettings: {
          database: config?.connectionId || 'Not configured',
          table: config?.tableName || 'Not selected',
        },
        extraSettings: {
          ...(config?.writeMode && { mode: config.writeMode }),
          ...(config?.batchSize && { batch: config.batchSize }),
        }
      };

    case 'fileWriter':
      return {
        inputs: [
          { id: 'input', name: 'Input Data', type: 'input' }
        ],
        extraSettings: {
          ...(config?.fileType && { type: config.fileType }),
          ...(config?.encoding && { encoding: config.encoding }),
          ...(config?.compression && { compression: config.compression }),
        }
      };

    default:
      return {};
  }
};
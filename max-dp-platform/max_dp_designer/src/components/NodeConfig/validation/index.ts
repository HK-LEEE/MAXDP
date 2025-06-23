/**
 * 노드 설정 검증 유틸리티
 * CLAUDE.local.md 가이드라인에 따른 타입 안전 검증 시스템
 */

import { NodeType, NodeConfig } from '../types';

// 검증 결과 인터페이스
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

// 검증 규칙 인터페이스
export interface ValidationRule<T = any> {
  field: keyof T;
  required?: boolean;
  validator?: (value: any, config: T) => string | null;
  warning?: (value: any, config: T) => string | null;
}

// 공통 검증 함수들
export const validators = {
  // 필수 값 검증
  required: (value: any): string | null => {
    if (value === undefined || value === null || value === '') {
      return '필수 입력 항목입니다.';
    }
    return null;
  },

  // 문자열 길이 검증
  minLength: (min: number) => (value: string): string | null => {
    if (typeof value === 'string' && value.length < min) {
      return `최소 ${min}자 이상 입력해야 합니다.`;
    }
    return null;
  },

  maxLength: (max: number) => (value: string): string | null => {
    if (typeof value === 'string' && value.length > max) {
      return `최대 ${max}자까지 입력 가능합니다.`;
    }
    return null;
  },

  // 숫자 범위 검증
  minValue: (min: number) => (value: number): string | null => {
    if (typeof value === 'number' && value < min) {
      return `최소값은 ${min}입니다.`;
    }
    return null;
  },

  maxValue: (max: number) => (value: number): string | null => {
    if (typeof value === 'number' && value > max) {
      return `최대값은 ${max}입니다.`;
    }
    return null;
  },

  // 정규식 패턴 검증
  pattern: (regex: RegExp, message: string) => (value: string): string | null => {
    if (typeof value === 'string' && !regex.test(value)) {
      return message;
    }
    return null;
  },

  // 파일 경로 검증
  filePath: (value: string): string | null => {
    if (!value?.trim()) {
      return '파일 경로를 입력하세요.';
    }

    // Windows/Linux 경로 패턴 체크
    const windowsPath = /^[a-zA-Z]:\\/.test(value);
    const unixPath = /^\//.test(value) || /^\.\.?\//.test(value);
    
    if (!windowsPath && !unixPath) {
      return '올바른 절대 경로 또는 상대 경로를 입력하세요.';
    }

    // 위험한 경로 패턴 체크
    const dangerousPatterns = [
      /\.\./,  // 디렉토리 순회
      /[<>:"|?*]/,  // Windows 금지 문자
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(value)) {
        return '안전하지 않은 경로입니다.';
      }
    }

    return null;
  },

  // SQL 쿼리 검증
  sqlQuery: (value: string): string | null => {
    if (!value?.trim()) {
      return 'SQL 쿼리를 입력하세요.';
    }

    const trimmed = value.trim().toLowerCase();
    
    // SELECT 쿼리만 허용
    if (!trimmed.startsWith('select')) {
      return 'SELECT 쿼리만 허용됩니다.';
    }

    // 위험한 키워드 체크
    const dangerousKeywords = [
      'drop', 'delete', 'insert', 'update', 'alter', 
      'create', 'truncate', 'exec', 'execute'
    ];
    
    for (const keyword of dangerousKeywords) {
      if (trimmed.includes(keyword)) {
        return `'${keyword.toUpperCase()}' 명령어는 허용되지 않습니다.`;
      }
    }

    // 기본적인 SQL 구문 검증
    if (!trimmed.includes('from') && !trimmed.includes('dual')) {
      return 'FROM 절이 필요합니다.';
    }

    return null;
  },

  // 컬럼명 검증
  columnName: (value: string): string | null => {
    if (!value?.trim()) {
      return '컬럼명을 입력하세요.';
    }

    // SQL 예약어 체크
    const reservedWords = [
      'select', 'from', 'where', 'insert', 'update', 'delete', 'drop', 'create',
      'alter', 'table', 'index', 'view', 'grant', 'revoke', 'commit', 'rollback',
      'and', 'or', 'not', 'null', 'true', 'false', 'case', 'when', 'then', 'else'
    ];
    
    if (reservedWords.includes(value.toLowerCase())) {
      return 'SQL 예약어는 사용할 수 없습니다.';
    }

    // 컬럼명 패턴 검증 (영문자, 숫자, 밑줄만 허용)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
      return '컬럼명은 영문자, 숫자, 밑줄(_)만 사용 가능하며 숫자로 시작할 수 없습니다.';
    }

    return null;
  },

  // 배열 검증
  arrayNotEmpty: (value: any[]): string | null => {
    if (!Array.isArray(value) || value.length === 0) {
      return '최소 1개 이상 선택해야 합니다.';
    }
    return null;
  },

  // 파일 확장자 검증
  fileExtension: (allowedExtensions: string[]) => (value: string): string | null => {
    if (!value?.trim()) {
      return null; // 빈 값은 다른 검증에서 처리
    }

    const extension = value.toLowerCase().split('.').pop();
    if (!extension || !allowedExtensions.includes(`.${extension}`)) {
      return `허용된 확장자: ${allowedExtensions.join(', ')}`;
    }

    return null;
  },
};

// 경고 생성기들
export const warnings = {
  // 성능 경고
  largeFileSize: (value: string): string | null => {
    // 파일 경로에서 대용량 파일 패턴 감지
    if (value?.toLowerCase().includes('large') || value?.toLowerCase().includes('big')) {
      return '대용량 파일 처리 시 메모리 사용량이 높을 수 있습니다.';
    }
    return null;
  },

  // 보안 경고
  systemPath: (value: string): string | null => {
    const systemPaths = ['system32', 'windows', 'program files', '/etc', '/usr', '/var'];
    const lowerValue = value?.toLowerCase() || '';
    
    for (const path of systemPaths) {
      if (lowerValue.includes(path)) {
        return '시스템 디렉토리에 접근하고 있습니다. 권한을 확인하세요.';
      }
    }
    return null;
  },

  // 데이터 타입 호환성 경고
  typeCompatibility: (sourceType: string, targetType: string): string | null => {
    const incompatiblePairs = [
      ['varchar', 'integer'],
      ['text', 'decimal'],
      ['boolean', 'timestamp'],
    ];

    for (const [source, target] of incompatiblePairs) {
      if (sourceType === source && targetType === target) {
        return `${sourceType}에서 ${targetType}로의 변환 시 데이터 손실이 발생할 수 있습니다.`;
      }
    }
    return null;
  },
};

// 기본 검증 실행 함수
export function validateField<T>(
  value: any,
  rules: ValidationRule<T>[],
  config: T
): { error?: string; warning?: string } {
  let error: string | undefined;
  let warning: string | undefined;

  for (const rule of rules) {
    // 필수 검증
    if (rule.required && !error) {
      error = validators.required(value);
    }

    // 커스텀 검증
    if (rule.validator && !error) {
      error = rule.validator(value, config);
    }

    // 경고 검증
    if (rule.warning && !warning) {
      warning = rule.warning(value, config);
    }

    // 첫 번째 오류에서 중단
    if (error) break;
  }

  return { error, warning };
}

// 전체 설정 검증 함수
export function validateNodeConfig(
  nodeType: NodeType,
  config: NodeConfig
): ValidationResult {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  // 노드 타입별 검증 규칙 적용
  const validationRules = getValidationRules(nodeType);
  
  for (const rule of validationRules) {
    const fieldName = rule.field as string;
    const fieldValue = (config as any)[fieldName];
    
    const result = validateField(fieldValue, [rule], config);
    
    if (result.error) {
      errors[fieldName] = result.error;
    }
    
    if (result.warning) {
      warnings[fieldName] = result.warning;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
}

// 노드 타입별 검증 규칙 정의
function getValidationRules(nodeType: NodeType): ValidationRule[] {
  switch (nodeType) {
    case NodeType.TABLE_READER:
      return [
        {
          field: 'connectionId',
          required: true,
        },
        {
          field: 'tableName',
          required: true,
          validator: validators.minLength(1),
        },
        {
          field: 'queryLimit',
          validator: (value) => {
            if (value !== undefined && value !== null) {
              return validators.minValue(1)(value);
            }
            return null;
          },
          warning: (value) => {
            if (value > 10000) {
              return '대량 데이터 조회 시 성능에 영향을 줄 수 있습니다.';
            }
            return null;
          },
        },
      ];

    case NodeType.CUSTOM_SQL:
      return [
        {
          field: 'connectionId',
          required: true,
        },
        {
          field: 'sqlQuery',
          required: true,
          validator: validators.sqlQuery,
        },
      ];

    case NodeType.FILE_INPUT:
      return [
        {
          field: 'filePath',
          required: true,
          validator: validators.filePath,
          warning: warnings.systemPath,
        },
        {
          field: 'fileType',
          required: true,
        },
      ];

    case NodeType.SELECT_COLUMNS:
      return [
        {
          field: 'selectedColumns',
          required: true,
          validator: validators.arrayNotEmpty,
        },
      ];

    case NodeType.FILTER_ROWS:
      return [
        {
          field: 'conditions',
          required: true,
          validator: validators.arrayNotEmpty,
        },
      ];

    case NodeType.RENAME_COLUMNS:
      return [
        {
          field: 'renames',
          required: true,
          validator: validators.arrayNotEmpty,
        },
      ];

    case NodeType.TABLE_WRITER:
      return [
        {
          field: 'connectionId',
          required: true,
        },
        {
          field: 'tableName',
          required: true,
          validator: validators.minLength(1),
        },
        {
          field: 'writeMode',
          required: true,
        },
        {
          field: 'batchSize',
          validator: (value) => {
            if (value !== undefined && value !== null) {
              const minError = validators.minValue(1)(value);
              if (minError) return minError;
              return validators.maxValue(10000)(value);
            }
            return null;
          },
          warning: (value) => {
            if (value > 5000) {
              return '큰 배치 크기는 메모리 사용량을 증가시킬 수 있습니다.';
            }
            return null;
          },
        },
      ];

    case NodeType.FILE_WRITER:
      return [
        {
          field: 'filePath',
          required: true,
          validator: validators.filePath,
          warning: warnings.systemPath,
        },
        {
          field: 'fileType',
          required: true,
        },
        {
          field: 'overwriteMode',
          required: true,
        },
      ];

    default:
      return [];
  }
}

// 실시간 검증을 위한 디바운스 함수
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
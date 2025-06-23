/**
 * 노드 설정 검증을 위한 React 훅
 * CLAUDE.local.md 가이드라인에 따른 실시간 검증 시스템
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { NodeType, NodeConfig } from '../types';
import { validateNodeConfig, ValidationResult, debounce } from './index';

// 검증 상태 인터페이스
export interface ValidationState {
  isValidating: boolean;
  result: ValidationResult;
  hasErrors: boolean;
  hasWarnings: boolean;
  errorCount: number;
  warningCount: number;
}

// 필드별 검증 상태
export interface FieldValidationState {
  error?: string;
  warning?: string;
  isValid: boolean;
}

/**
 * 노드 설정 검증 훅
 */
export function useNodeValidation(nodeType: NodeType, config: NodeConfig) {
  const [validationState, setValidationState] = useState<ValidationState>({
    isValidating: false,
    result: { isValid: true, errors: {}, warnings: {} },
    hasErrors: false,
    hasWarnings: false,
    errorCount: 0,
    warningCount: 0,
  });

  // 디바운스된 검증 함수
  const debouncedValidate = useCallback(
    debounce((type: NodeType, cfg: NodeConfig) => {
      setValidationState(prev => ({ ...prev, isValidating: true }));
      
      // 비동기적으로 검증 수행 (UI 블로킹 방지)
      setTimeout(() => {
        const result = validateNodeConfig(type, cfg);
        
        setValidationState({
          isValidating: false,
          result,
          hasErrors: !result.isValid,
          hasWarnings: Object.keys(result.warnings).length > 0,
          errorCount: Object.keys(result.errors).length,
          warningCount: Object.keys(result.warnings).length,
        });
      }, 100);
    }, 300),
    []
  );

  // 설정 변경 시 검증 실행
  useEffect(() => {
    debouncedValidate(nodeType, config);
  }, [nodeType, config, debouncedValidate]);

  // 즉시 검증 함수
  const validateNow = useCallback(() => {
    const result = validateNodeConfig(nodeType, config);
    setValidationState({
      isValidating: false,
      result,
      hasErrors: !result.isValid,
      hasWarnings: Object.keys(result.warnings).length > 0,
      errorCount: Object.keys(result.errors).length,
      warningCount: Object.keys(result.warnings).length,
    });
    return result;
  }, [nodeType, config]);

  // 특정 필드 검증 상태 가져오기
  const getFieldValidation = useCallback((fieldName: string): FieldValidationState => {
    const error = validationState.result.errors[fieldName];
    const warning = validationState.result.warnings[fieldName];
    
    return {
      error,
      warning,
      isValid: !error,
    };
  }, [validationState.result]);

  return {
    ...validationState,
    validateNow,
    getFieldValidation,
  };
}

/**
 * 실시간 필드 검증 훅
 */
export function useFieldValidation<T>(
  value: T,
  validator: (value: T) => string | null,
  options: {
    debounceMs?: number;
    immediate?: boolean;
  } = {}
) {
  const { debounceMs = 300, immediate = false } = options;
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const debouncedValidate = useCallback(
    debounce((val: T) => {
      setIsValidating(true);
      const result = validator(val);
      setError(result);
      setIsValidating(false);
    }, debounceMs),
    [validator, debounceMs]
  );

  const validateNow = useCallback(() => {
    const result = validator(value);
    setError(result);
    return result === null;
  }, [validator, value]);

  useEffect(() => {
    if (immediate) {
      validateNow();
    } else {
      debouncedValidate(value);
    }
  }, [value, debouncedValidate, immediate, validateNow]);

  return {
    error,
    isValid: error === null,
    isValidating,
    validateNow,
  };
}

/**
 * 폼 전체 검증 상태 관리 훅
 */
export function useFormValidation() {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fieldWarnings, setFieldWarnings] = useState<Record<string, string>>({});

  // 필드 오류 설정
  const setFieldError = useCallback((fieldName: string, error: string | null) => {
    setFieldErrors(prev => {
      if (error === null) {
        const { [fieldName]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [fieldName]: error };
    });
  }, []);

  // 필드 경고 설정
  const setFieldWarning = useCallback((fieldName: string, warning: string | null) => {
    setFieldWarnings(prev => {
      if (warning === null) {
        const { [fieldName]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [fieldName]: warning };
    });
  }, []);

  // 모든 오류 지우기
  const clearErrors = useCallback(() => {
    setFieldErrors({});
  }, []);

  // 모든 경고 지우기
  const clearWarnings = useCallback(() => {
    setFieldWarnings({});
  }, []);

  // 전체 초기화
  const clearAll = useCallback(() => {
    setFieldErrors({});
    setFieldWarnings({});
  }, []);

  // 계산된 상태
  const isValid = useMemo(() => Object.keys(fieldErrors).length === 0, [fieldErrors]);
  const hasWarnings = useMemo(() => Object.keys(fieldWarnings).length > 0, [fieldWarnings]);
  const errorCount = useMemo(() => Object.keys(fieldErrors).length, [fieldErrors]);
  const warningCount = useMemo(() => Object.keys(fieldWarnings).length, [fieldWarnings]);

  return {
    fieldErrors,
    fieldWarnings,
    isValid,
    hasWarnings,
    errorCount,
    warningCount,
    setFieldError,
    setFieldWarning,
    clearErrors,
    clearWarnings,
    clearAll,
  };
}

/**
 * 종속성 검증 훅 (필드 간 의존성 체크)
 */
export function useDependentValidation<T extends Record<string, any>>(
  config: T,
  dependencies: Array<{
    fields: (keyof T)[];
    validator: (values: Partial<T>) => string | null;
    message?: string;
  }>
) {
  const [dependencyErrors, setDependencyErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const errors: Record<string, string> = {};

    dependencies.forEach((dep, index) => {
      const dependentValues: Partial<T> = {};
      let hasAllValues = true;

      // 종속 필드들의 값 수집
      dep.fields.forEach(field => {
        const value = config[field];
        if (value === undefined || value === null || value === '') {
          hasAllValues = false;
        }
        dependentValues[field] = value;
      });

      // 모든 값이 있을 때만 검증 수행
      if (hasAllValues) {
        const error = dep.validator(dependentValues);
        if (error) {
          errors[`dependency_${index}`] = dep.message || error;
        }
      }
    });

    setDependencyErrors(errors);
  }, [config, dependencies]);

  return {
    dependencyErrors,
    hasDependencyErrors: Object.keys(dependencyErrors).length > 0,
    dependencyErrorCount: Object.keys(dependencyErrors).length,
  };
}

/**
 * 비동기 검증 훅 (서버 검증 등)
 */
export function useAsyncValidation<T>(
  value: T,
  asyncValidator: (value: T) => Promise<string | null>,
  options: {
    debounceMs?: number;
    dependencies?: any[];
  } = {}
) {
  const { debounceMs = 500, dependencies = [] } = options;
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const debouncedValidate = useCallback(
    debounce(async (val: T) => {
      setIsValidating(true);
      try {
        const result = await asyncValidator(val);
        setError(result);
      } catch (err) {
        setError('검증 중 오류가 발생했습니다.');
      } finally {
        setIsValidating(false);
      }
    }, debounceMs),
    [asyncValidator, debounceMs, ...dependencies]
  );

  useEffect(() => {
    if (value !== undefined && value !== null && value !== '') {
      debouncedValidate(value);
    } else {
      setError(null);
      setIsValidating(false);
    }
  }, [value, debouncedValidate]);

  return {
    error,
    isValid: error === null,
    isValidating,
  };
}
"""
MAX DP 로직 및 제어 흐름 노드들

플로우의 실행 경로를 제어하고 조건부 분기, 예외 처리, 병합 등을 담당하는 노드들을 구현합니다.
"""

import logging
from typing import Dict, Any, Optional, List, Union
import pandas as pd
from langchain_core.runnables import RunnableConfig

from .maxdp_base_node import MaxDPNode

logger = logging.getLogger(__name__)

class ConditionalBranchNode(MaxDPNode):
    """
    조건부 분기를 수행하는 노드
    
    주어진 조건을 평가하여 Boolean 값을 반환합니다.
    FlowExecutor가 이 값을 보고 실행 경로를 분기시킵니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> bool:
        """조건부 분기 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame 가져오기 (선택적)
            df = self._get_input_dataframe_optional(input)
            
            # 조건 설정
            condition_type = self.node_config.get('condition_type', 'expression')  # 'expression', 'row_count', 'column_exists'
            condition_value = self.node_config.get('condition_value')
            
            # 조건 타입별 평가
            if condition_type == 'expression':
                result = self._evaluate_expression(df, condition_value, input)
            elif condition_type == 'row_count':
                result = self._evaluate_row_count(df, condition_value)
            elif condition_type == 'column_exists':
                result = self._evaluate_column_exists(df, condition_value)
            elif condition_type == 'data_quality':
                result = self._evaluate_data_quality(df, condition_value)
            else:
                raise ValueError(f"Unknown condition type: {condition_type}")
            
            logger.info(f"Conditional branch evaluated to: {result}")
            
            self._log_execution_end(result)
            return result
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def _evaluate_expression(self, df: Optional[pd.DataFrame], expression: str, input_data: Dict[str, Any]) -> bool:
        """표현식 조건 평가"""
        if not expression:
            raise ValueError("Expression condition requires condition_value")
        
        # 안전한 표현식 평가를 위한 컨텍스트 생성
        eval_context = {
            'df': df,
            'input': input_data,
            'len': len,
            'sum': sum,
            'min': min,
            'max': max,
            'any': any,
            'all': all
        }
        
        # DataFrame 관련 변수 추가
        if df is not None:
            eval_context.update({
                'row_count': len(df),
                'column_count': len(df.columns),
                'columns': list(df.columns)
            })
        
        try:
            result = eval(expression, {"__builtins__": {}}, eval_context)
            return bool(result)
        except Exception as e:
            logger.error(f"Failed to evaluate expression '{expression}': {e}")
            return False
    
    def _evaluate_row_count(self, df: Optional[pd.DataFrame], condition: Dict[str, Any]) -> bool:
        """행 수 조건 평가"""
        if df is None:
            return False
        
        operator = condition.get('operator', 'gt')  # 'gt', 'lt', 'eq', 'gte', 'lte'
        threshold = condition.get('threshold', 0)
        
        row_count = len(df)
        
        if operator == 'gt':
            return row_count > threshold
        elif operator == 'lt':
            return row_count < threshold
        elif operator == 'eq':
            return row_count == threshold
        elif operator == 'gte':
            return row_count >= threshold
        elif operator == 'lte':
            return row_count <= threshold
        else:
            raise ValueError(f"Unknown operator: {operator}")
    
    def _evaluate_column_exists(self, df: Optional[pd.DataFrame], condition: Union[str, List[str]]) -> bool:
        """열 존재 조건 평가"""
        if df is None:
            return False
        
        if isinstance(condition, str):
            required_columns = [condition]
        else:
            required_columns = condition
        
        return all(col in df.columns for col in required_columns)
    
    def _evaluate_data_quality(self, df: Optional[pd.DataFrame], condition: Dict[str, Any]) -> bool:
        """데이터 품질 조건 평가"""
        if df is None:
            return False
        
        quality_check = condition.get('check', 'completeness')  # 'completeness', 'uniqueness', 'validity'
        threshold = condition.get('threshold', 0.95)
        columns = condition.get('columns', None)
        
        if quality_check == 'completeness':
            # 완전성 검사 (결측치 비율)
            if columns:
                completeness = df[columns].notna().all(axis=1).mean()
            else:
                completeness = df.notna().all(axis=1).mean()
            return completeness >= threshold
            
        elif quality_check == 'uniqueness':
            # 유일성 검사 (중복 비율)
            if columns:
                unique_ratio = (~df[columns].duplicated()).mean()
            else:
                unique_ratio = (~df.duplicated()).mean()
            return unique_ratio >= threshold
            
        elif quality_check == 'validity':
            # 유효성 검사 (사용자 정의 규칙)
            validation_rule = condition.get('rule', '')
            if validation_rule:
                try:
                    valid_rows = df.eval(validation_rule)
                    validity_ratio = valid_rows.mean()
                    return validity_ratio >= threshold
                except Exception as e:
                    logger.error(f"Invalid validation rule: {e}")
                    return False
            return True
            
        else:
            raise ValueError(f"Unknown quality check: {quality_check}")
    
    def _get_input_dataframe_optional(self, input_data: Dict[str, Any]) -> Optional[pd.DataFrame]:
        """입력에서 DataFrame 추출 (선택적)"""
        for key, value in input_data.items():
            if isinstance(value, pd.DataFrame):
                return value
        return None

class TryCatchNode(MaxDPNode):
    """
    예외 처리를 위한 노드
    
    실제 실행 로직은 없으며, FlowExecutor가 이 노드를 만나면 
    예외 처리 모드로 진입하여 후속 노드들의 오류를 캐치합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """예외 처리 노드 실행 (패스스루)"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame 가져오기
            df = self._get_input_dataframe(input)
            
            # 예외 처리 설정
            fallback_strategy = self.node_config.get('fallback_strategy', 'return_empty')  # 'return_empty', 'return_input', 'custom'
            log_errors = self.node_config.get('log_errors', True)
            
            # 예외 처리 모드 플래그 설정 (실제로는 FlowExecutor가 처리)
            logger.info(f"TryCatch node configured with strategy: {fallback_strategy}")
            
            if log_errors:
                logger.info("Error logging enabled for subsequent nodes")
            
            # 입력을 그대로 통과시킴
            self._log_execution_end(df)
            return df
            
        except Exception as e:
            # TryCatch 노드 자체에서는 예외를 그대로 전파
            self._handle_execution_error(e)
    
    def handle_exception(self, exception: Exception, input_data: Dict[str, Any]) -> pd.DataFrame:
        """
        예외 발생 시 대체 동작 수행
        
        이 메서드는 FlowExecutor에서 호출됩니다.
        """
        try:
            fallback_strategy = self.node_config.get('fallback_strategy', 'return_empty')
            
            logger.error(f"Exception caught by TryCatch node: {exception}")
            
            if fallback_strategy == 'return_empty':
                # 빈 DataFrame 반환
                return pd.DataFrame()
                
            elif fallback_strategy == 'return_input':
                # 입력 DataFrame 그대로 반환
                df = self._get_input_dataframe_optional(input_data)
                return df if df is not None else pd.DataFrame()
                
            elif fallback_strategy == 'custom':
                # 사용자 정의 대체 데이터
                custom_data = self.node_config.get('custom_fallback_data', [])
                return pd.DataFrame(custom_data)
                
            else:
                raise ValueError(f"Unknown fallback strategy: {fallback_strategy}")
                
        except Exception as fallback_error:
            logger.error(f"Fallback strategy failed: {fallback_error}")
            return pd.DataFrame()
    
    def _get_input_dataframe(self, input_data: Dict[str, Any]) -> pd.DataFrame:
        """입력에서 DataFrame 추출"""
        for key, value in input_data.items():
            if isinstance(value, pd.DataFrame):
                return value
        raise ValueError("No DataFrame found in input data")
    
    def _get_input_dataframe_optional(self, input_data: Dict[str, Any]) -> Optional[pd.DataFrame]:
        """입력에서 DataFrame 추출 (선택적)"""
        for key, value in input_data.items():
            if isinstance(value, pd.DataFrame):
                return value
        return None

class MergeNode(MaxDPNode):
    """
    여러 입력을 병합하는 노드
    
    여러 입력 중 데이터가 들어온 첫 번째 핸들의 DataFrame을 반환하거나,
    설정에 따라 여러 DataFrame을 결합합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """입력 병합 실행"""
        self._log_execution_start(input)
        
        try:
            # 병합 전략 설정
            merge_strategy = self.node_config.get('merge_strategy', 'first_available')  # 'first_available', 'concat', 'union', 'custom'
            
            # 입력 DataFrame들 추출
            input_dataframes = self._extract_input_dataframes(input)
            
            if not input_dataframes:
                logger.warning("No input DataFrames found, returning empty DataFrame")
                return pd.DataFrame()
            
            # 병합 전략별 처리
            if merge_strategy == 'first_available':
                result_df = self._merge_first_available(input_dataframes)
            elif merge_strategy == 'concat':
                result_df = self._merge_concat(input_dataframes)
            elif merge_strategy == 'union':
                result_df = self._merge_union(input_dataframes)
            elif merge_strategy == 'custom':
                result_df = self._merge_custom(input_dataframes)
            else:
                raise ValueError(f"Unknown merge strategy: {merge_strategy}")
            
            logger.info(f"Merged {len(input_dataframes)} inputs using strategy: {merge_strategy}")
            
            self._log_execution_end(result_df)
            return result_df
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def _extract_input_dataframes(self, input_data: Dict[str, Any]) -> List[pd.DataFrame]:
        """입력에서 모든 DataFrame 추출"""
        dataframes = []
        
        for key, value in input_data.items():
            if isinstance(value, pd.DataFrame) and not value.empty:
                dataframes.append(value)
        
        return dataframes
    
    def _merge_first_available(self, dataframes: List[pd.DataFrame]) -> pd.DataFrame:
        """첫 번째 사용 가능한 DataFrame 반환"""
        if dataframes:
            return dataframes[0]
        return pd.DataFrame()
    
    def _merge_concat(self, dataframes: List[pd.DataFrame]) -> pd.DataFrame:
        """DataFrame들을 세로로 연결"""
        if not dataframes:
            return pd.DataFrame()
        
        concat_options = self.node_config.get('concat_options', {})
        default_options = {
            'ignore_index': True,
            'join': 'outer',
            'sort': False
        }
        default_options.update(concat_options)
        
        return pd.concat(dataframes, **default_options)
    
    def _merge_union(self, dataframes: List[pd.DataFrame]) -> pd.DataFrame:
        """DataFrame들을 합집합으로 결합 (중복 제거)"""
        if not dataframes:
            return pd.DataFrame()
        
        # 먼저 concat으로 결합
        combined = self._merge_concat(dataframes)
        
        # 중복 제거
        drop_duplicates_options = self.node_config.get('drop_duplicates_options', {})
        default_options = {
            'keep': 'first'
        }
        default_options.update(drop_duplicates_options)
        
        return combined.drop_duplicates(**default_options)
    
    def _merge_custom(self, dataframes: List[pd.DataFrame]) -> pd.DataFrame:
        """사용자 정의 병합 로직"""
        custom_logic = self.node_config.get('custom_logic', 'first')
        
        if custom_logic == 'largest':
            # 가장 큰 DataFrame 반환
            if dataframes:
                return max(dataframes, key=len)
            return pd.DataFrame()
            
        elif custom_logic == 'smallest':
            # 가장 작은 DataFrame 반환
            if dataframes:
                return min(dataframes, key=len)
            return pd.DataFrame()
            
        elif custom_logic == 'average':
            # 평균 크기에 가장 가까운 DataFrame 반환
            if dataframes:
                avg_size = sum(len(df) for df in dataframes) / len(dataframes)
                return min(dataframes, key=lambda df: abs(len(df) - avg_size))
            return pd.DataFrame()
            
        elif custom_logic == 'weighted_concat':
            # 가중치를 적용한 연결
            weights = self.node_config.get('weights', [])
            if len(weights) == len(dataframes):
                weighted_dfs = []
                for df, weight in zip(dataframes, weights):
                    # 가중치만큼 복제하여 추가
                    for _ in range(int(weight)):
                        weighted_dfs.append(df)
                return self._merge_concat(weighted_dfs)
            else:
                logger.warning("Weights length mismatch, falling back to simple concat")
                return self._merge_concat(dataframes)
                
        else:
            # 기본값: 첫 번째 DataFrame
            return self._merge_first_available(dataframes) 
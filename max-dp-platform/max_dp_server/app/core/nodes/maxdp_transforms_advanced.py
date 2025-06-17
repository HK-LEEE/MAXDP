"""
MAX DP 고급 데이터 변환 노드들

데이터 정제, 집계, 결합 등 고급 변환 기능을 수행하는 노드들을 구현합니다.
"""

import logging
from typing import Dict, Any, Optional, List, Union, Callable
import pandas as pd
import numpy as np
from RestrictedPython import compile_restricted, safe_globals
from langchain_core.runnables import RunnableConfig

from .maxdp_base_node import MaxDPNode

logger = logging.getLogger(__name__)

# =============================================================================
# 데이터 정제/변환 노드들
# =============================================================================

class HandleMissingValuesNode(MaxDPNode):
    """
    결측치를 처리하는 노드
    
    df.dropna(), df.fillna()를 사용합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """결측치 처리 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame 가져오기
            df = self._get_input_dataframe(input)
            
            # 처리 방법 설정
            method = self.node_config.get('method', 'drop')  # 'drop', 'fill', 'forward_fill', 'backward_fill'
            columns = self.node_config.get('columns', None)  # 특정 열만 처리
            fill_value = self.node_config.get('fill_value', None)
            
            if method == 'drop':
                # 결측치 행 제거
                if columns:
                    result_df = df.dropna(subset=columns)
                else:
                    result_df = df.dropna()
                    
            elif method == 'fill':
                # 지정값으로 채우기
                if columns:
                    result_df = df.copy()
                    result_df[columns] = result_df[columns].fillna(fill_value)
                else:
                    result_df = df.fillna(fill_value)
                    
            elif method == 'forward_fill':
                # 앞의 값으로 채우기
                if columns:
                    result_df = df.copy()
                    result_df[columns] = result_df[columns].fillna(method='ffill')
                else:
                    result_df = df.fillna(method='ffill')
                    
            elif method == 'backward_fill':
                # 뒤의 값으로 채우기
                if columns:
                    result_df = df.copy()
                    result_df[columns] = result_df[columns].fillna(method='bfill')
                else:
                    result_df = df.fillna(method='bfill')
                    
            else:
                raise ValueError(f"Invalid method: {method}")
            
            logger.info(f"Handled missing values using method: {method}")
            
            self._log_execution_end(result_df)
            return result_df
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def _get_input_dataframe(self, input_data: Dict[str, Any]) -> pd.DataFrame:
        """입력에서 DataFrame 추출"""
        for key, value in input_data.items():
            if isinstance(value, pd.DataFrame):
                return value
        raise ValueError("No DataFrame found in input data")

class DeduplicateNode(MaxDPNode):
    """
    중복 행을 제거하는 노드
    
    df.drop_duplicates()를 사용합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """중복 제거 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame 가져오기
            df = self._get_input_dataframe(input)
            
            # 중복 제거 설정
            columns = self.node_config.get('columns', None)  # 특정 열 기준
            keep = self.node_config.get('keep', 'first')  # 'first', 'last', False
            
            # 중복 제거
            result_df = df.drop_duplicates(subset=columns, keep=keep)
            
            removed_count = len(df) - len(result_df)
            logger.info(f"Removed {removed_count} duplicate rows")
            
            self._log_execution_end(result_df)
            return result_df
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def _get_input_dataframe(self, input_data: Dict[str, Any]) -> pd.DataFrame:
        """입력에서 DataFrame 추출"""
        for key, value in input_data.items():
            if isinstance(value, pd.DataFrame):
                return value
        raise ValueError("No DataFrame found in input data")

class SortDataNode(MaxDPNode):
    """
    데이터를 정렬하는 노드
    
    df.sort_values()를 사용합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """데이터 정렬 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame 가져오기
            df = self._get_input_dataframe(input)
            
            # 정렬 설정
            sort_by = self.node_config.get('sort_by', [])
            ascending = self.node_config.get('ascending', True)
            
            if not sort_by:
                logger.warning("No sort columns specified, returning original DataFrame")
                return df
            
            # 정렬 실행
            result_df = df.sort_values(by=sort_by, ascending=ascending)
            
            logger.info(f"Sorted data by columns: {sort_by}")
            
            self._log_execution_end(result_df)
            return result_df
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def _get_input_dataframe(self, input_data: Dict[str, Any]) -> pd.DataFrame:
        """입력에서 DataFrame 추출"""
        for key, value in input_data.items():
            if isinstance(value, pd.DataFrame):
                return value
        raise ValueError("No DataFrame found in input data")

class PivotTableNode(MaxDPNode):
    """
    피벗 테이블을 생성하는 노드
    
    pd.pivot_table()을 사용합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """피벗 테이블 생성 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame 가져오기
            df = self._get_input_dataframe(input)
            
            # 피벗 설정
            values = self.node_config.get('values')
            index = self.node_config.get('index')
            columns = self.node_config.get('columns')
            aggfunc = self.node_config.get('aggfunc', 'mean')
            fill_value = self.node_config.get('fill_value', None)
            
            # 피벗 테이블 생성
            result_df = pd.pivot_table(
                df, 
                values=values, 
                index=index, 
                columns=columns, 
                aggfunc=aggfunc,
                fill_value=fill_value
            )
            
            # 인덱스를 열로 변환 (필요시)
            if self.node_config.get('reset_index', True):
                result_df = result_df.reset_index()
            
            logger.info(f"Created pivot table with index: {index}, columns: {columns}")
            
            self._log_execution_end(result_df)
            return result_df
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def _get_input_dataframe(self, input_data: Dict[str, Any]) -> pd.DataFrame:
        """입력에서 DataFrame 추출"""
        for key, value in input_data.items():
            if isinstance(value, pd.DataFrame):
                return value
        raise ValueError("No DataFrame found in input data")

class MeltNode(MaxDPNode):
    """
    와이드 형식을 롱 형식으로 변환하는 노드
    
    pd.melt()를 사용합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """데이터 멜트 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame 가져오기
            df = self._get_input_dataframe(input)
            
            # 멜트 설정
            id_vars = self.node_config.get('id_vars', None)
            value_vars = self.node_config.get('value_vars', None)
            var_name = self.node_config.get('var_name', 'variable')
            value_name = self.node_config.get('value_name', 'value')
            
            # 멜트 실행
            result_df = pd.melt(
                df,
                id_vars=id_vars,
                value_vars=value_vars,
                var_name=var_name,
                value_name=value_name
            )
            
            logger.info(f"Melted DataFrame from {df.shape} to {result_df.shape}")
            
            self._log_execution_end(result_df)
            return result_df
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def _get_input_dataframe(self, input_data: Dict[str, Any]) -> pd.DataFrame:
        """입력에서 DataFrame 추출"""
        for key, value in input_data.items():
            if isinstance(value, pd.DataFrame):
                return value
        raise ValueError("No DataFrame found in input data")

# =============================================================================
# 그룹화/집계 노드들
# =============================================================================

class GroupAggregateNode(MaxDPNode):
    """
    그룹화 후 집계를 수행하는 노드
    
    df.groupby().agg()를 사용합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """그룹 집계 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame 가져오기
            df = self._get_input_dataframe(input)
            
            # 그룹화 설정
            group_by = self.node_config.get('group_by', [])
            aggregations = self.node_config.get('aggregations', {})
            
            if not group_by:
                raise ValueError("group_by columns must be specified")
            
            if not aggregations:
                raise ValueError("aggregations must be specified")
            
            # 그룹화 및 집계
            grouped = df.groupby(group_by)
            result_df = grouped.agg(aggregations)
            
            # 컬럼명 평탄화 (MultiIndex인 경우)
            if isinstance(result_df.columns, pd.MultiIndex):
                result_df.columns = ['_'.join(col).strip() for col in result_df.columns.values]
            
            # 인덱스 리셋
            if self.node_config.get('reset_index', True):
                result_df = result_df.reset_index()
            
            logger.info(f"Grouped by {group_by} and applied {len(aggregations)} aggregations")
            
            self._log_execution_end(result_df)
            return result_df
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def _get_input_dataframe(self, input_data: Dict[str, Any]) -> pd.DataFrame:
        """입력에서 DataFrame 추출"""
        for key, value in input_data.items():
            if isinstance(value, pd.DataFrame):
                return value
        raise ValueError("No DataFrame found in input data")

class WindowFunctionsNode(MaxDPNode):
    """
    윈도우 함수를 적용하는 노드
    
    df.groupby().transform() 또는 df.rolling()을 사용합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """윈도우 함수 적용 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame 가져오기
            df = self._get_input_dataframe(input)
            
            # 윈도우 함수 설정
            window_type = self.node_config.get('window_type', 'rolling')  # 'rolling', 'expanding', 'groupby'
            
            if window_type == 'rolling':
                result_df = self._apply_rolling_window(df)
            elif window_type == 'expanding':
                result_df = self._apply_expanding_window(df)
            elif window_type == 'groupby':
                result_df = self._apply_groupby_transform(df)
            else:
                raise ValueError(f"Invalid window_type: {window_type}")
            
            logger.info(f"Applied {window_type} window functions")
            
            self._log_execution_end(result_df)
            return result_df
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def _apply_rolling_window(self, df: pd.DataFrame) -> pd.DataFrame:
        """롤링 윈도우 적용"""
        window_size = self.node_config.get('window_size', 3)
        columns = self.node_config.get('columns', [])
        functions = self.node_config.get('functions', ['mean'])
        
        result_df = df.copy()
        
        for column in columns:
            if column in df.columns:
                rolling = df[column].rolling(window=window_size)
                
                for func in functions:
                    new_col_name = f"{column}_{func}_{window_size}"
                    result_df[new_col_name] = getattr(rolling, func)()
        
        return result_df
    
    def _apply_expanding_window(self, df: pd.DataFrame) -> pd.DataFrame:
        """확장 윈도우 적용"""
        columns = self.node_config.get('columns', [])
        functions = self.node_config.get('functions', ['mean'])
        
        result_df = df.copy()
        
        for column in columns:
            if column in df.columns:
                expanding = df[column].expanding()
                
                for func in functions:
                    new_col_name = f"{column}_{func}_expanding"
                    result_df[new_col_name] = getattr(expanding, func)()
        
        return result_df
    
    def _apply_groupby_transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """그룹별 변환 적용"""
        group_by = self.node_config.get('group_by', [])
        transforms = self.node_config.get('transforms', {})
        
        if not group_by:
            raise ValueError("group_by must be specified for groupby transform")
        
        result_df = df.copy()
        grouped = df.groupby(group_by)
        
        for column, transform_func in transforms.items():
            if column in df.columns:
                new_col_name = f"{column}_{transform_func}_by_{'_'.join(group_by)}"
                result_df[new_col_name] = grouped[column].transform(transform_func)
        
        return result_df
    
    def _get_input_dataframe(self, input_data: Dict[str, Any]) -> pd.DataFrame:
        """입력에서 DataFrame 추출"""
        for key, value in input_data.items():
            if isinstance(value, pd.DataFrame):
                return value
        raise ValueError("No DataFrame found in input data")

# =============================================================================
# 결합 노드들
# =============================================================================

class JoinMergeNode(MaxDPNode):
    """
    두 DataFrame을 조인/병합하는 노드
    
    pd.merge()를 사용합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """데이터 조인 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame들 가져오기
            dataframes = self._get_input_dataframes(input)
            
            if len(dataframes) < 2:
                raise ValueError("At least 2 DataFrames required for join operation")
            
            left_df = dataframes[0]
            right_df = dataframes[1]
            
            # 조인 설정
            join_type = self.node_config.get('join_type', 'inner')  # 'inner', 'outer', 'left', 'right'
            left_on = self.node_config.get('left_on', [])
            right_on = self.node_config.get('right_on', [])
            on = self.node_config.get('on', None)  # 공통 컬럼명인 경우
            
            # 조인 실행
            if on:
                result_df = pd.merge(left_df, right_df, on=on, how=join_type)
            else:
                result_df = pd.merge(left_df, right_df, left_on=left_on, right_on=right_on, how=join_type)
            
            logger.info(f"Joined DataFrames: {left_df.shape} + {right_df.shape} = {result_df.shape}")
            
            self._log_execution_end(result_df)
            return result_df
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def _get_input_dataframes(self, input_data: Dict[str, Any]) -> List[pd.DataFrame]:
        """입력에서 모든 DataFrame 추출"""
        dataframes = []
        for key, value in input_data.items():
            if isinstance(value, pd.DataFrame):
                dataframes.append(value)
        return dataframes

class UnionConcatenateNode(MaxDPNode):
    """
    DataFrame들을 연결하는 노드
    
    pd.concat()을 사용합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """데이터 연결 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame들 가져오기
            dataframes = self._get_input_dataframes(input)
            
            if len(dataframes) < 2:
                raise ValueError("At least 2 DataFrames required for concatenation")
            
            # 연결 설정
            axis = self.node_config.get('axis', 0)  # 0: 행 방향, 1: 열 방향
            ignore_index = self.node_config.get('ignore_index', True)
            join = self.node_config.get('join', 'outer')  # 'outer', 'inner'
            
            # 연결 실행
            result_df = pd.concat(dataframes, axis=axis, ignore_index=ignore_index, join=join)
            
            total_rows = sum(df.shape[0] for df in dataframes)
            logger.info(f"Concatenated {len(dataframes)} DataFrames: {total_rows} total rows")
            
            self._log_execution_end(result_df)
            return result_df
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def _get_input_dataframes(self, input_data: Dict[str, Any]) -> List[pd.DataFrame]:
        """입력에서 모든 DataFrame 추출"""
        dataframes = []
        for key, value in input_data.items():
            if isinstance(value, pd.DataFrame):
                dataframes.append(value)
        return dataframes

# =============================================================================
# 고급 변환 노드들
# =============================================================================

class RunPythonScriptNode(MaxDPNode):
    """
    사용자 정의 Python 스크립트를 실행하는 노드
    
    RestrictedPython을 사용하여 안전한 코드 실행을 제공합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """Python 스크립트 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame 가져오기
            df = self._get_input_dataframe(input)
            
            # 스크립트 설정
            script_code = self.node_config.get('script_code', '')
            
            if not script_code:
                raise ValueError("No script code provided")
            
            # RestrictedPython을 사용한 안전한 실행
            restricted_globals = safe_globals.copy()
            restricted_globals.update({
                'df': df,
                'pd': pd,
                'np': np
            })
            
            # 스크립트 컴파일
            compiled_code = compile_restricted(script_code, '<string>', 'exec')
            
            # 실행
            local_vars = {}
            exec(compiled_code, restricted_globals, local_vars)
            
            # 결과 추출 (result 변수 또는 수정된 df)
            if 'result' in local_vars:
                result_df = local_vars['result']
            else:
                result_df = restricted_globals['df']
            
            if not isinstance(result_df, pd.DataFrame):
                raise ValueError("Script must return a pandas DataFrame")
            
            logger.info("Python script executed successfully")
            
            self._log_execution_end(result_df)
            return result_df
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def _get_input_dataframe(self, input_data: Dict[str, Any]) -> pd.DataFrame:
        """입력에서 DataFrame 추출"""
        for key, value in input_data.items():
            if isinstance(value, pd.DataFrame):
                return value
        raise ValueError("No DataFrame found in input data")

class ApplyFunctionNode(MaxDPNode):
    """
    DataFrame에 함수를 적용하는 노드
    
    df.apply()를 사용합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """함수 적용 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame 가져오기
            df = self._get_input_dataframe(input)
            
            # 함수 적용 설정
            function_type = self.node_config.get('function_type', 'lambda')  # 'lambda', 'builtin'
            function_code = self.node_config.get('function_code', '')
            axis = self.node_config.get('axis', 0)  # 0: 행별, 1: 열별
            target_columns = self.node_config.get('target_columns', None)
            
            if function_type == 'lambda':
                # 람다 함수 생성
                if not function_code:
                    raise ValueError("Lambda function code not provided")
                
                func = eval(f"lambda x: {function_code}")
                
            elif function_type == 'builtin':
                # 내장 함수 사용
                builtin_functions = {
                    'sum': np.sum,
                    'mean': np.mean,
                    'std': np.std,
                    'min': np.min,
                    'max': np.max,
                    'count': len
                }
                
                if function_code not in builtin_functions:
                    raise ValueError(f"Unknown builtin function: {function_code}")
                
                func = builtin_functions[function_code]
                
            else:
                raise ValueError(f"Invalid function_type: {function_type}")
            
            # 함수 적용
            if target_columns:
                # 특정 열에만 적용
                result_df = df.copy()
                for col in target_columns:
                    if col in df.columns:
                        result_df[f"{col}_applied"] = df[col].apply(func)
            else:
                # 전체 DataFrame에 적용
                result_df = df.apply(func, axis=axis)
                
                # 결과가 Series인 경우 DataFrame으로 변환
                if isinstance(result_df, pd.Series):
                    result_df = result_df.to_frame().T
            
            logger.info(f"Applied function to DataFrame")
            
            self._log_execution_end(result_df)
            return result_df
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def _get_input_dataframe(self, input_data: Dict[str, Any]) -> pd.DataFrame:
        """입력에서 DataFrame 추출"""
        for key, value in input_data.items():
            if isinstance(value, pd.DataFrame):
                return value
        raise ValueError("No DataFrame found in input data") 
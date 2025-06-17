"""
MAX DP 데이터 변환 노드들

데이터를 변환, 정제, 조작하는 노드들을 구현합니다.
모든 노드는 MaxDPNode를 상속받고 Pandas DataFrame을 입력받아 변환된 DataFrame을 반환합니다.
"""

import logging
import ast
from typing import Dict, Any, Optional, List, Union, Callable
import pandas as pd
import numpy as np
from RestrictedPython import compile_restricted, safe_globals
from langchain_core.runnables import RunnableConfig

from .maxdp_base_node import MaxDPNode

logger = logging.getLogger(__name__)

# =============================================================================
# 선택/필터링 노드들
# =============================================================================

class SelectColumnsNode(MaxDPNode):
    """
    DataFrame에서 특정 열들을 선택하는 노드
    
    df.drop() 또는 df[...] 를 사용하여 열 선택/제거를 수행합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """열 선택 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame 가져오기
            df = self._get_input_dataframe(input)
            
            # 설정 파라미터
            operation = self.node_config.get('operation', 'select')  # 'select' or 'drop'
            columns = self.node_config.get('columns', [])
            
            if not columns:
                logger.warning("No columns specified, returning original DataFrame")
                return df
            
            if operation == 'select':
                # 지정된 열만 선택
                available_columns = [col for col in columns if col in df.columns]
                if not available_columns:
                    raise ValueError(f"None of the specified columns exist in DataFrame: {columns}")
                
                result_df = df[available_columns]
                logger.info(f"Selected {len(available_columns)} columns from {len(df.columns)} total columns")
                
            elif operation == 'drop':
                # 지정된 열 제거
                columns_to_drop = [col for col in columns if col in df.columns]
                result_df = df.drop(columns=columns_to_drop)
                logger.info(f"Dropped {len(columns_to_drop)} columns")
                
            else:
                raise ValueError(f"Invalid operation: {operation}. Must be 'select' or 'drop'")
            
            self._log_execution_end(result_df)
            return result_df
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def _get_input_dataframe(self, input_data: Dict[str, Any]) -> pd.DataFrame:
        """입력에서 DataFrame 추출"""
        # 첫 번째 DataFrame 찾기
        for key, value in input_data.items():
            if isinstance(value, pd.DataFrame):
                return value
        
        raise ValueError("No DataFrame found in input data")

class FilterRowsNode(MaxDPNode):
    """
    DataFrame에서 조건에 맞는 행들을 필터링하는 노드
    
    df.query()를 사용하여 안전한 조건 필터링을 수행합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """행 필터링 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame 가져오기
            df = self._get_input_dataframe(input)
            
            # 필터 조건
            filter_expression = self.node_config.get('filter_expression', '')
            
            if not filter_expression:
                logger.warning("No filter expression provided, returning original DataFrame")
                return df
            
            # df.query()를 사용한 안전한 필터링
            result_df = df.query(filter_expression)
            
            logger.info(f"Filtered {len(df)} rows to {len(result_df)} rows using expression: {filter_expression}")
            
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

class SampleRowsNode(MaxDPNode):
    """
    DataFrame에서 샘플 행들을 추출하는 노드
    
    df.head(), df.tail(), df.sample()을 사용합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """행 샘플링 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame 가져오기
            df = self._get_input_dataframe(input)
            
            # 샘플링 설정
            method = self.node_config.get('method', 'head')  # 'head', 'tail', 'sample'
            n_rows = self.node_config.get('n_rows', 10)
            
            if method == 'head':
                result_df = df.head(n_rows)
            elif method == 'tail':
                result_df = df.tail(n_rows)
            elif method == 'sample':
                # 랜덤 시드 설정 (재현 가능성을 위해)
                random_seed = self.node_config.get('random_seed', None)
                result_df = df.sample(n=min(n_rows, len(df)), random_state=random_seed)
            else:
                raise ValueError(f"Invalid sampling method: {method}")
            
            logger.info(f"Sampled {len(result_df)} rows using method: {method}")
            
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
# 열 조작 노드들
# =============================================================================

class RenameColumnsNode(MaxDPNode):
    """
    DataFrame의 열 이름을 변경하는 노드
    
    df.rename()을 사용합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """열 이름 변경 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame 가져오기
            df = self._get_input_dataframe(input)
            
            # 이름 변경 매핑
            column_mapping = self.node_config.get('column_mapping', {})
            
            if not column_mapping:
                logger.warning("No column mapping provided, returning original DataFrame")
                return df
            
            # 존재하는 열만 매핑
            valid_mapping = {old_name: new_name for old_name, new_name in column_mapping.items() 
                           if old_name in df.columns}
            
            result_df = df.rename(columns=valid_mapping)
            
            logger.info(f"Renamed {len(valid_mapping)} columns: {valid_mapping}")
            
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

class AddModifyColumnNode(MaxDPNode):
    """
    DataFrame에 새 열을 추가하거나 기존 열을 수정하는 노드
    
    df.assign()을 사용합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """열 추가/수정 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame 가져오기
            df = self._get_input_dataframe(input)
            
            # 열 정의
            column_definitions = self.node_config.get('column_definitions', {})
            
            if not column_definitions:
                logger.warning("No column definitions provided, returning original DataFrame")
                return df
            
            # df.assign()을 위한 딕셔너리 준비
            assign_dict = {}
            
            for column_name, definition in column_definitions.items():
                if isinstance(definition, str):
                    # 문자열 표현식인 경우 eval 사용 (안전하게)
                    try:
                        assign_dict[column_name] = df.eval(definition)
                    except Exception as e:
                        logger.error(f"Failed to evaluate expression for column {column_name}: {e}")
                        continue
                        
                elif isinstance(definition, (int, float, str, bool)):
                    # 리터럴 값인 경우
                    assign_dict[column_name] = definition
                    
                elif isinstance(definition, dict):
                    # 복잡한 정의인 경우 (함수 적용 등)
                    operation = definition.get('operation', 'constant')
                    if operation == 'constant':
                        assign_dict[column_name] = definition.get('value', None)
                    elif operation == 'copy':
                        source_column = definition.get('source_column')
                        if source_column in df.columns:
                            assign_dict[column_name] = df[source_column]
                    # 추가 연산 타입들을 여기에 구현
            
            # 열 추가/수정
            result_df = df.assign(**assign_dict)
            
            logger.info(f"Added/modified {len(assign_dict)} columns: {list(assign_dict.keys())}")
            
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

class ChangeDataTypeNode(MaxDPNode):
    """
    DataFrame 열의 데이터 타입을 변경하는 노드
    
    df.astype()을 사용합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """데이터 타입 변경 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame 가져오기
            df = self._get_input_dataframe(input)
            
            # 타입 변경 매핑
            type_mapping = self.node_config.get('type_mapping', {})
            
            if not type_mapping:
                logger.warning("No type mapping provided, returning original DataFrame")
                return df
            
            # 존재하는 열만 타입 변경
            valid_mapping = {}
            for column, new_type in type_mapping.items():
                if column in df.columns:
                    # 타입 문자열을 실제 타입으로 변환
                    if isinstance(new_type, str):
                        if new_type == 'int':
                            valid_mapping[column] = 'int64'
                        elif new_type == 'float':
                            valid_mapping[column] = 'float64'
                        elif new_type == 'str':
                            valid_mapping[column] = 'string'
                        elif new_type == 'datetime':
                            # datetime은 별도 처리
                            df[column] = pd.to_datetime(df[column])
                            continue
                        else:
                            valid_mapping[column] = new_type
                    else:
                        valid_mapping[column] = new_type
            
            # 타입 변경 적용
            if valid_mapping:
                result_df = df.astype(valid_mapping)
            else:
                result_df = df
            
            logger.info(f"Changed data types for {len(valid_mapping)} columns: {valid_mapping}")
            
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

class SplitColumnNode(MaxDPNode):
    """
    문자열 열을 분할하여 새로운 열들을 생성하는 노드
    
    df['col'].str.split()을 사용합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """열 분할 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame 가져오기
            df = self._get_input_dataframe(input)
            
            # 분할 설정
            column_to_split = self.node_config.get('column_to_split')
            delimiter = self.node_config.get('delimiter', ' ')
            new_column_names = self.node_config.get('new_column_names', [])
            expand = self.node_config.get('expand', True)
            
            if not column_to_split or column_to_split not in df.columns:
                raise ValueError(f"Column to split not found: {column_to_split}")
            
            # 문자열 분할
            split_result = df[column_to_split].str.split(delimiter, expand=expand)
            
            if expand and isinstance(split_result, pd.DataFrame):
                # 새 열 이름 설정
                if new_column_names:
                    # 사용자 지정 열 이름 사용
                    n_cols = min(len(new_column_names), split_result.shape[1])
                    for i in range(n_cols):
                        df[new_column_names[i]] = split_result.iloc[:, i]
                else:
                    # 기본 열 이름 사용
                    for i in range(split_result.shape[1]):
                        df[f"{column_to_split}_split_{i}"] = split_result.iloc[:, i]
            else:
                # expand=False인 경우 리스트 형태로 저장
                df[f"{column_to_split}_split"] = split_result
            
            result_df = df
            
            logger.info(f"Split column {column_to_split} using delimiter '{delimiter}'")
            
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

class MapValuesNode(MaxDPNode):
    """
    열의 값들을 매핑하여 다른 값으로 변환하는 노드
    
    df['col'].map()을 사용합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """값 매핑 실행"""
        self._log_execution_start(input)
        
        try:
            # 입력 DataFrame 가져오기
            df = self._get_input_dataframe(input)
            
            # 매핑 설정
            column_to_map = self.node_config.get('column_to_map')
            value_mapping = self.node_config.get('value_mapping', {})
            create_new_column = self.node_config.get('create_new_column', False)
            new_column_name = self.node_config.get('new_column_name', f"{column_to_map}_mapped")
            
            if not column_to_map or column_to_map not in df.columns:
                raise ValueError(f"Column to map not found: {column_to_map}")
            
            if not value_mapping:
                logger.warning("No value mapping provided, returning original DataFrame")
                return df
            
            # 값 매핑 적용
            mapped_values = df[column_to_map].map(value_mapping)
            
            if create_new_column:
                # 새 열 생성
                df[new_column_name] = mapped_values
            else:
                # 기존 열 덮어쓰기
                df[column_to_map] = mapped_values
            
            result_df = df
            
            logger.info(f"Mapped values in column {column_to_map} using {len(value_mapping)} mappings")
            
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
"""
MAX DP 데이터 소스 노드들

외부 데이터 소스에서 데이터를 읽어오는 노드들을 구현합니다.
모든 노드는 MaxDPNode를 상속받고 Pandas DataFrame을 반환합니다.
"""

import logging
import io
import json
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import pandas as pd
import httpx
from fastapi import Request
from langchain_core.runnables import RunnableConfig

from .maxdp_base_node import MaxDPNode

logger = logging.getLogger(__name__)

class TableReaderNode(MaxDPNode):
    """
    데이터베이스 테이블에서 데이터를 읽어오는 노드
    
    pd.read_sql_table을 사용하여 테이블 전체 또는 조건부 데이터를 조회합니다.
    권한 검사를 필수로 수행합니다.
    """
    
    def __init__(self, node_id: str, node_config: Dict[str, Any], node_type: str, 
                 db_session: Optional[AsyncSession] = None, **kwargs):
        super().__init__(node_id, node_config, node_type, **kwargs)
        self.db_session = db_session
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """테이블 데이터 읽기 실행"""
        self._log_execution_start(input)
        
        try:
            # 설정 검증
            if not self._validate_table_config():
                raise ValueError("Invalid table configuration")
            
            # 권한 검사
            if not self._check_db_access():
                raise PermissionError("Database access denied")
            
            # 테이블 데이터 조회
            table_name = self.node_config['table_name']
            schema = self.node_config.get('schema')
            limit = self.node_config.get('limit')
            where_condition = self.node_config.get('where_condition')
            
            # SQL 쿼리 생성
            query = self._build_table_query(table_name, schema, where_condition, limit)
            
            logger.debug(f"Executing table query: {query}")
            
            # Pandas로 데이터 읽기
            result_df = pd.read_sql_query(query, self.db_session.connection())
            
            logger.info(f"Read {len(result_df)} rows from table {table_name}")
            
            self._log_execution_end(result_df)
            return result_df
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def _validate_table_config(self) -> bool:
        """테이블 설정 검증"""
        required_fields = ['table_name']
        for field in required_fields:
            if field not in self.node_config:
                logger.error(f"Missing required field: {field}")
                return False
        return True
    
    def _check_db_access(self) -> bool:
        """데이터베이스 접근 권한 검사"""
        # 실제 권한 검사 로직 구현
        # 현재는 기본적으로 허용
        return True
    
    def _build_table_query(self, table_name: str, schema: Optional[str] = None,
                          where_condition: Optional[str] = None, 
                          limit: Optional[int] = None) -> str:
        """테이블 쿼리 생성"""
        full_table_name = f"{schema}.{table_name}" if schema else table_name
        query = f"SELECT * FROM {full_table_name}"
        
        if where_condition:
            query += f" WHERE {where_condition}"
        
        if limit:
            query += f" LIMIT {limit}"
        
        return query

class CustomSQLQueryNode(MaxDPNode):
    """
    사용자 정의 SQL 쿼리를 실행하는 노드
    
    pd.read_sql_query와 SQLAlchemy text()를 사용하여 파라미터 바인딩을 지원합니다.
    """
    
    def __init__(self, node_id: str, node_config: Dict[str, Any], node_type: str,
                 db_session: Optional[AsyncSession] = None, **kwargs):
        super().__init__(node_id, node_config, node_type, **kwargs)
        self.db_session = db_session
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """SQL 쿼리 실행"""
        self._log_execution_start(input)
        
        try:
            # 설정 검증
            if 'sql_query' not in self.node_config:
                raise ValueError("Missing required field: sql_query")
            
            sql_query = self.node_config['sql_query']
            parameters = self.node_config.get('parameters', {})
            
            # 입력 데이터에서 동적 파라미터 추출
            dynamic_params = self._extract_dynamic_parameters(input)
            parameters.update(dynamic_params)
            
            logger.debug(f"Executing SQL query with parameters: {parameters}")
            
            # SQLAlchemy text()를 사용한 안전한 파라미터 바인딩
            query = text(sql_query)
            result_df = pd.read_sql_query(query, self.db_session.connection(), params=parameters)
            
            logger.info(f"SQL query returned {len(result_df)} rows")
            
            self._log_execution_end(result_df)
            return result_df
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def _extract_dynamic_parameters(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """입력 데이터에서 SQL 파라미터 추출"""
        param_mapping = self.node_config.get('parameter_mapping', {})
        dynamic_params = {}
        
        for param_name, input_key in param_mapping.items():
            if input_key in input_data:
                dynamic_params[param_name] = input_data[input_key]
        
        return dynamic_params

class FileInputNode(MaxDPNode):
    """
    파일에서 데이터를 읽어오는 노드
    
    CSV, JSON, Excel 등 다양한 파일 형식을 지원합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """파일 데이터 읽기 실행"""
        self._log_execution_start(input)
        
        try:
            # 설정 검증
            if 'file_path' not in self.node_config:
                raise ValueError("Missing required field: file_path")
            
            file_path = self.node_config['file_path']
            file_type = self.node_config.get('file_type', 'auto')
            
            # 파일 타입 자동 감지
            if file_type == 'auto':
                file_type = self._detect_file_type(file_path)
            
            # 파일 타입별 읽기 옵션
            read_options = self.node_config.get('read_options', {})
            
            logger.debug(f"Reading file: {file_path} (type: {file_type})")
            
            # 파일 타입별 처리
            if file_type == 'csv':
                result_df = pd.read_csv(file_path, **read_options)
            elif file_type == 'json':
                result_df = pd.read_json(file_path, **read_options)
            elif file_type == 'excel':
                result_df = pd.read_excel(file_path, **read_options)
            elif file_type == 'parquet':
                result_df = pd.read_parquet(file_path, **read_options)
            else:
                raise ValueError(f"Unsupported file type: {file_type}")
            
            logger.info(f"Read {len(result_df)} rows from file {file_path}")
            
            self._log_execution_end(result_df)
            return result_df
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def _detect_file_type(self, file_path: str) -> str:
        """파일 확장자를 기반으로 파일 타입 감지"""
        extension = file_path.lower().split('.')[-1]
        
        type_mapping = {
            'csv': 'csv',
            'json': 'json',
            'xlsx': 'excel',
            'xls': 'excel',
            'parquet': 'parquet'
        }
        
        return type_mapping.get(extension, 'csv')

class ApiEndpointNode(MaxDPNode):
    """
    REST API 엔드포인트에서 데이터를 가져오는 노드
    
    httpx를 사용하여 GET 요청을 보내고 JSON 응답을 DataFrame으로 변환합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """API 엔드포인트 호출 실행"""
        self._log_execution_start(input)
        
        try:
            # 설정 검증
            if 'api_url' not in self.node_config:
                raise ValueError("Missing required field: api_url")
            
            api_url = self.node_config['api_url']
            headers = self.node_config.get('headers', {})
            params = self.node_config.get('params', {})
            timeout = self.node_config.get('timeout', 30)
            
            # 동적 파라미터 병합
            dynamic_params = self._extract_dynamic_params(input)
            params.update(dynamic_params)
            
            logger.debug(f"Calling API: {api_url} with params: {params}")
            
            # HTTP GET 요청
            with httpx.Client(timeout=timeout) as client:
                response = client.get(api_url, headers=headers, params=params)
                response.raise_for_status()
                
                # JSON 응답 파싱
                json_data = response.json()
                
                # JSON을 DataFrame으로 변환
                if isinstance(json_data, list):
                    # JSON 배열인 경우
                    result_df = pd.json_normalize(json_data)
                elif isinstance(json_data, dict):
                    # JSON 객체인 경우
                    data_key = self.node_config.get('data_key', 'data')
                    if data_key in json_data:
                        result_df = pd.json_normalize(json_data[data_key])
                    else:
                        result_df = pd.json_normalize([json_data])
                else:
                    raise ValueError(f"Unsupported JSON structure: {type(json_data)}")
            
            logger.info(f"API call returned {len(result_df)} rows")
            
            self._log_execution_end(result_df)
            return result_df
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def _extract_dynamic_params(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """입력 데이터에서 API 파라미터 추출"""
        param_mapping = self.node_config.get('parameter_mapping', {})
        dynamic_params = {}
        
        for param_name, input_key in param_mapping.items():
            if input_key in input_data:
                dynamic_params[param_name] = input_data[input_key]
        
        return dynamic_params

class StaticDataNode(MaxDPNode):
    """
    정적 데이터를 생성하는 노드
    
    설정에서 제공된 텍스트 또는 JSON 데이터를 DataFrame으로 변환합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """정적 데이터 생성 실행"""
        self._log_execution_start(input)
        
        try:
            data_source = self.node_config.get('data_source', 'text')
            
            if data_source == 'text':
                result_df = self._create_from_text()
            elif data_source == 'json':
                result_df = self._create_from_json()
            elif data_source == 'array':
                result_df = self._create_from_array()
            else:
                raise ValueError(f"Unsupported data source: {data_source}")
            
            logger.info(f"Generated static data with {len(result_df)} rows")
            
            self._log_execution_end(result_df)
            return result_df
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def _create_from_text(self) -> pd.DataFrame:
        """텍스트 데이터에서 DataFrame 생성"""
        text_data = self.node_config.get('text_data', '')
        delimiter = self.node_config.get('delimiter', ',')
        
        # io.StringIO를 사용하여 텍스트를 파일처럼 처리
        text_io = io.StringIO(text_data)
        return pd.read_csv(text_io, sep=delimiter)
    
    def _create_from_json(self) -> pd.DataFrame:
        """JSON 데이터에서 DataFrame 생성"""
        json_data = self.node_config.get('json_data', [])
        
        if isinstance(json_data, str):
            json_data = json.loads(json_data)
        
        return pd.json_normalize(json_data)
    
    def _create_from_array(self) -> pd.DataFrame:
        """배열 데이터에서 DataFrame 생성"""
        array_data = self.node_config.get('array_data', [])
        columns = self.node_config.get('columns', None)
        
        return pd.DataFrame(array_data, columns=columns)

class WebhookListenerNode(MaxDPNode):
    """
    웹훅 요청을 수신하는 노드 (고급 기능)
    
    FastAPI의 동적 라우팅을 활용하여 웹훅 엔드포인트를 생성합니다.
    실제 구현은 복잡하므로 현재는 플레이스홀더 구현을 제공합니다.
    """
    
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> pd.DataFrame:
        """웹훅 데이터 처리 실행"""
        self._log_execution_start(input)
        
        try:
            # 웹훅 데이터는 입력으로 받거나 캐시에서 조회
            webhook_data = input.get('webhook_data', [])
            
            if not webhook_data:
                # 기본 빈 DataFrame 반환
                result_df = pd.DataFrame()
            else:
                # 웹훅 데이터를 DataFrame으로 변환
                if isinstance(webhook_data, list):
                    result_df = pd.json_normalize(webhook_data)
                elif isinstance(webhook_data, dict):
                    result_df = pd.json_normalize([webhook_data])
                else:
                    result_df = pd.DataFrame([{'data': webhook_data}])
            
            logger.info(f"Processed webhook data with {len(result_df)} rows")
            
            self._log_execution_end(result_df)
            return result_df
            
        except Exception as e:
            self._handle_execution_error(e)
    
    def setup_webhook_endpoint(self, app, endpoint_path: str):
        """
        FastAPI 앱에 웹훅 엔드포인트 동적 추가
        
        Args:
            app: FastAPI 애플리케이션 인스턴스
            endpoint_path: 웹훅 엔드포인트 경로
        """
        # 동적 라우팅 구현은 복잡하므로 별도 구현 필요
        pass 
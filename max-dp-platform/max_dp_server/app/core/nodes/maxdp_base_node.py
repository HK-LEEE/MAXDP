"""
MAX DP 베이스 노드 추상 클래스

모든 데이터 처리 노드의 기본 구조를 정의하는 추상 클래스입니다.
LangChain의 RunnableSerializable을 상속받아 Runnable 프로토콜을 따릅니다.
"""

import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Type, Union
from langchain_core.runnables import RunnableSerializable, RunnableConfig
from langchain_core.runnables.utils import Input, Output
import pandas as pd
from pydantic import BaseModel, Field

# Logger 설정 (SYS_G_04 지침 준수)
logger = logging.getLogger(__name__)

class NodeExecutionContext(BaseModel):
    """노드 실행 컨텍스트"""
    user_id: Optional[str] = None
    workspace_id: Optional[str] = None
    execution_id: Optional[str] = None
    global_variables: Dict[str, Any] = Field(default_factory=dict)
    
class MaxDPNode(RunnableSerializable, ABC):
    """
    MAX DP 모든 노드의 베이스 추상 클래스
    
    LangChain의 RunnableSerializable을 상속받아 표준 Runnable 인터페이스를 제공합니다.
    모든 구체적인 노드 클래스는 이 클래스를 상속받아 invoke 메서드를 구현해야 합니다.
    
    Attributes:
        node_id (str): 노드의 고유 식별자
        node_config (Dict[str, Any]): 사용자 설정 및 노드 구성 정보
        node_type (str): 노드 타입 식별자
    """
    
    # Pydantic 모델로 정의된 필드들
    node_id: str = Field(..., description="노드의 고유 식별자")
    node_config: Dict[str, Any] = Field(default_factory=dict, description="노드 구성 정보")
    node_type: str = Field(..., description="노드 타입 식별자")
    
    def __init__(self, node_id: str, node_config: Dict[str, Any], node_type: str, **kwargs):
        """
        MaxDPNode 초기화
        
        Args:
            node_id: 노드의 고유 식별자
            node_config: 노드 구성 정보
            node_type: 노드 타입 식별자
        """
        super().__init__(
            node_id=node_id,
            node_config=node_config,
            node_type=node_type,
            **kwargs
        )
        logger.info(f"Node {self.node_id} ({self.node_type}) initialized")
    
    @abstractmethod
    def invoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> Output:
        """
        노드의 핵심 실행 로직
        
        Args:
            input: 이전 노드들의 출력이 담긴 딕셔너리
                  예: {'handle_a': pd.DataFrame, 'handle_b': pd.DataFrame}
            config: Runnable 실행 설정
            
        Returns:
            Output: 노드 실행 결과 (주로 pd.DataFrame)
            
        Raises:
            NotImplementedError: 하위 클래스에서 반드시 구현해야 함
        """
        raise NotImplementedError(f"Node {self.node_type} must implement invoke method")
    
    async def ainvoke(self, input: Dict[str, Any], config: Optional[RunnableConfig] = None) -> Output:
        """
        비동기 버전의 invoke 메서드
        
        기본적으로는 동기 invoke를 호출하지만, 필요시 하위 클래스에서 오버라이드 가능
        """
        return self.invoke(input, config)
    
    def get_input_schema(self, config: Optional[RunnableConfig] = None) -> Type[BaseModel]:
        """입력 스키마 반환"""
        class InputSchema(BaseModel):
            data: Dict[str, Any] = Field(..., description="Input data from previous nodes")
        return InputSchema
    
    def get_output_schema(self, config: Optional[RunnableConfig] = None) -> Type[BaseModel]:
        """출력 스키마 반환"""
        class OutputSchema(BaseModel):
            result: Any = Field(..., description="Node execution result")
        return OutputSchema
    
    def validate_input(self, input_data: Dict[str, Any]) -> bool:
        """
        입력 데이터 유효성 검사
        
        Args:
            input_data: 검사할 입력 데이터
            
        Returns:
            bool: 유효성 검사 통과 여부
        """
        try:
            # 기본 유효성 검사 로직
            if not isinstance(input_data, dict):
                logger.error(f"Node {self.node_id}: Input must be a dictionary")
                return False
            
            # 추가 유효성 검사는 하위 클래스에서 구현
            return self._custom_validate_input(input_data)
            
        except Exception as e:
            logger.error(f"Node {self.node_id}: Input validation error: {e}")
            return False
    
    def _custom_validate_input(self, input_data: Dict[str, Any]) -> bool:
        """
        커스텀 입력 검증 로직 (하위 클래스에서 오버라이드)
        
        Args:
            input_data: 검사할 입력 데이터
            
        Returns:
            bool: 검증 통과 여부
        """
        return True
    
    def get_required_handles(self) -> list[str]:
        """
        노드가 요구하는 입력 핸들 목록 반환
        
        Returns:
            list[str]: 필수 입력 핸들 목록
        """
        # 기본적으로는 node_config에서 inputs를 읽어옴
        return self.node_config.get('inputs', [])
    
    def get_output_handles(self) -> list[str]:
        """
        노드가 제공하는 출력 핸들 목록 반환
        
        Returns:
            list[str]: 출력 핸들 목록
        """
        # 기본적으로는 node_config에서 outputs를 읽어옴
        return self.node_config.get('outputs', ['result'])
    
    def _log_execution_start(self, input_data: Dict[str, Any]) -> None:
        """실행 시작 로그"""
        logger.info(f"Node {self.node_id} ({self.node_type}) execution started")
        logger.debug(f"Node {self.node_id} input handles: {list(input_data.keys())}")
    
    def _log_execution_end(self, result: Any) -> None:
        """실행 완료 로그"""
        logger.info(f"Node {self.node_id} ({self.node_type}) execution completed")
        if isinstance(result, pd.DataFrame):
            logger.debug(f"Node {self.node_id} output DataFrame shape: {result.shape}")
    
    def _handle_execution_error(self, error: Exception) -> None:
        """실행 오류 처리"""
        logger.error(f"Node {self.node_id} ({self.node_type}) execution failed: {error}", exc_info=True)
        raise error
    
    @property 
    def InputType(self) -> type:
        """Runnable 인터페이스 호환을 위한 타입 정의"""
        return Dict[str, Any]
    
    @property
    def OutputType(self) -> type:
        """Runnable 인터페이스 호환을 위한 타입 정의"""
        return Any 
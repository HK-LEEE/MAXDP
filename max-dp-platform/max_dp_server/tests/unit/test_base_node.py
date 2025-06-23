"""
베이스 노드 단위 테스트
CLAUDE.local.md 가이드라인에 따른 노드 시스템 테스트
"""

import pytest
from unittest.mock import Mock, AsyncMock
from typing import Dict, Any
import pandas as pd

from app.core.nodes.maxdp_base_node import MaxDPNode, NodeExecutionContext

# 테스트용 구체 노드 클래스
class TestNode(MaxDPNode):
    """테스트용 노드 구현"""
    
    def invoke(self, input: Dict[str, Any], config=None):
        self._log_execution_start(input)
        
        # 간단한 처리 로직
        if "data" in input:
            result = input["data"]
            if isinstance(result, pd.DataFrame):
                result = result.copy()
                result["processed"] = True
            else:
                result = {"processed": True, "input": result}
        else:
            result = {"processed": True, "empty_input": True}
        
        self._log_execution_end(result)
        return result

class FailingTestNode(MaxDPNode):
    """실패하는 테스트 노드"""
    
    def invoke(self, input: Dict[str, Any], config=None):
        self._log_execution_start(input)
        error = Exception("Simulated node failure")
        self._handle_execution_error(error)

@pytest.mark.unit
class TestMaxDPBaseNode:
    """베이스 노드 단위 테스트"""
    
    @pytest.fixture
    def test_node(self):
        """테스트 노드 인스턴스"""
        return TestNode(
            node_id="test_node_001",
            node_config={
                "inputs": ["input_data"],
                "outputs": ["result"],
                "parameters": {"param1": "value1"}
            },
            node_type="test_node"
        )
    
    @pytest.fixture
    def failing_node(self):
        """실패하는 노드 인스턴스"""
        return FailingTestNode(
            node_id="failing_node_001",
            node_config={"inputs": ["input_data"]},
            node_type="failing_node"
        )
    
    def test_node_initialization(self, test_node):
        """노드 초기화 테스트"""
        assert test_node.node_id == "test_node_001"
        assert test_node.node_type == "test_node"
        assert test_node.node_config["parameters"]["param1"] == "value1"
    
    def test_node_input_validation_success(self, test_node):
        """입력 검증 성공 테스트"""
        valid_input = {
            "input_data": pd.DataFrame({"col1": [1, 2, 3]})
        }
        
        result = test_node.validate_input(valid_input)
        assert result is True
    
    def test_node_input_validation_failure(self, test_node):
        """입력 검증 실패 테스트"""
        # 딕셔너리가 아닌 입력
        invalid_input = "not a dictionary"
        
        result = test_node.validate_input(invalid_input)
        assert result is False
    
    def test_node_invoke_with_dataframe(self, test_node):
        """데이터프레임 입력으로 노드 실행 테스트"""
        input_df = pd.DataFrame({
            "col1": [1, 2, 3],
            "col2": ["a", "b", "c"]
        })
        
        input_data = {"data": input_df}
        result = test_node.invoke(input_data)
        
        assert isinstance(result, pd.DataFrame)
        assert "processed" in result.columns
        assert result["processed"].all()
        assert len(result) == 3
    
    def test_node_invoke_with_dict(self, test_node):
        """딕셔너리 입력으로 노드 실행 테스트"""
        input_data = {"data": {"key": "value", "number": 42}}
        result = test_node.invoke(input_data)
        
        assert isinstance(result, dict)
        assert result["processed"] is True
        assert result["input"]["key"] == "value"
        assert result["input"]["number"] == 42
    
    def test_node_invoke_empty_input(self, test_node):
        """빈 입력으로 노드 실행 테스트"""
        input_data = {}
        result = test_node.invoke(input_data)
        
        assert isinstance(result, dict)
        assert result["processed"] is True
        assert result["empty_input"] is True
    
    async def test_node_ainvoke(self, test_node):
        """비동기 노드 실행 테스트"""
        input_data = {"data": {"async": True}}
        result = await test_node.ainvoke(input_data)
        
        assert isinstance(result, dict)
        assert result["processed"] is True
    
    def test_node_required_handles(self, test_node):
        """필수 입력 핸들 테스트"""
        required_handles = test_node.get_required_handles()
        assert required_handles == ["input_data"]
    
    def test_node_output_handles(self, test_node):
        """출력 핸들 테스트"""
        output_handles = test_node.get_output_handles()
        assert output_handles == ["result"]
    
    def test_node_output_handles_default(self):
        """기본 출력 핸들 테스트"""
        node = TestNode(
            node_id="default_node",
            node_config={},  # outputs 설정 없음
            node_type="test"
        )
        
        output_handles = node.get_output_handles()
        assert output_handles == ["result"]  # 기본값
    
    def test_node_input_output_schema(self, test_node):
        """입출력 스키마 테스트"""
        input_schema = test_node.get_input_schema()
        output_schema = test_node.get_output_schema()
        
        assert input_schema is not None
        assert output_schema is not None
        
        # 스키마 인스턴스 생성 테스트
        input_instance = input_schema(data={"test": "data"})
        output_instance = output_schema(result="test_result")
        
        assert input_instance.data == {"test": "data"}
        assert output_instance.result == "test_result"
    
    def test_node_error_handling(self, failing_node):
        """노드 에러 처리 테스트"""
        input_data = {"data": "test"}
        
        with pytest.raises(Exception) as exc_info:
            failing_node.invoke(input_data)
        
        assert "Simulated node failure" in str(exc_info.value)
    
    def test_node_custom_validation_override(self):
        """커스텀 검증 오버라이드 테스트"""
        
        class StrictValidationNode(MaxDPNode):
            def invoke(self, input, config=None):
                return {"result": "ok"}
            
            def _custom_validate_input(self, input_data):
                # 특정 키가 있어야만 유효
                return "required_key" in input_data
        
        node = StrictValidationNode(
            node_id="strict_node",
            node_config={},
            node_type="strict"
        )
        
        # 유효한 입력
        valid_input = {"required_key": "value"}
        assert node.validate_input(valid_input) is True
        
        # 무효한 입력
        invalid_input = {"other_key": "value"}
        assert node.validate_input(invalid_input) is False
    
    def test_node_type_properties(self, test_node):
        """노드 타입 속성 테스트"""
        assert test_node.InputType == Dict[str, Any]
        assert test_node.OutputType == Any

@pytest.mark.unit
class TestNodeExecutionContext:
    """노드 실행 컨텍스트 테스트"""
    
    def test_context_creation(self):
        """컨텍스트 생성 테스트"""
        context = NodeExecutionContext(
            user_id="user_123",
            workspace_id="workspace_456",
            execution_id="exec_789",
            global_variables={"var1": "value1"}
        )
        
        assert context.user_id == "user_123"
        assert context.workspace_id == "workspace_456"
        assert context.execution_id == "exec_789"
        assert context.global_variables == {"var1": "value1"}
    
    def test_context_default_values(self):
        """컨텍스트 기본값 테스트"""
        context = NodeExecutionContext()
        
        assert context.user_id is None
        assert context.workspace_id is None
        assert context.execution_id is None
        assert context.global_variables == {}
    
    def test_context_serialization(self):
        """컨텍스트 직렬화 테스트"""
        context = NodeExecutionContext(
            user_id="user_123",
            global_variables={"key": "value"}
        )
        
        # Pydantic 직렬화
        data = context.model_dump()
        assert data["user_id"] == "user_123"
        assert data["global_variables"] == {"key": "value"}
        
        # 역직렬화
        new_context = NodeExecutionContext.model_validate(data)
        assert new_context.user_id == "user_123"
        assert new_context.global_variables == {"key": "value"}
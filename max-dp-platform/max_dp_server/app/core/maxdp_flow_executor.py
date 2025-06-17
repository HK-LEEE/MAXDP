"""
MAX DP Flow Executor

flow_json을 해석하여 실행 순서를 결정하고, 각 노드를 실행 가능한 객체로 변환하여
순차적으로 실행하는 FlowExecutor 클래스를 구현합니다.
"""

import logging
import asyncio
from typing import Dict, Any, Optional, List, Union
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from ..utils.maxdp_dag_util import topological_sort, validate_dag_structure, DAGCycleError, DAGValidationError
from .nodes.maxdp_base_node import MaxDPNode, NodeExecutionContext
from .nodes.maxdp_node_factory import create_node_instance, NodeCreationError

# Logger 설정 (SYS_G_04 지침 준수)
logger = logging.getLogger(__name__)

class FlowExecutionError(Exception):
    """Flow 실행 중 발생하는 예외"""
    pass

class FlowValidationError(Exception):
    """Flow 유효성 검사 실패 시 발생하는 예외"""
    pass

class FlowExecutionContext:
    """Flow 실행 컨텍스트"""
    
    def __init__(self, 
                 flow_id: str,
                 execution_id: str,
                 user_context: Dict[str, Any],
                 global_variables: Optional[Dict[str, Any]] = None):
        self.flow_id = flow_id
        self.execution_id = execution_id
        self.user_context = user_context
        self.global_variables = global_variables or {}
        self.execution_start_time = datetime.utcnow()
        self.node_outputs: Dict[str, Any] = {}
        self.execution_log: List[Dict[str, Any]] = []
    
    def add_node_output(self, node_id: str, output: Any, execution_time: float) -> None:
        """노드 실행 결과 저장"""
        self.node_outputs[node_id] = output
        self.execution_log.append({
            'node_id': node_id,
            'output_type': type(output).__name__,
            'execution_time': execution_time,
            'timestamp': datetime.utcnow().isoformat()
        })
    
    def get_node_output(self, node_id: str) -> Any:
        """노드 출력 조회"""
        return self.node_outputs.get(node_id)

class FlowExecutor:
    """
    MAX DP Flow 실행기
    
    flow_json을 분석하여 DAG 구조를 파악하고, 위상 정렬된 순서대로
    노드들을 실행하는 클래스입니다.
    """
    
    def __init__(self, 
                 flow_json: Dict[str, Any], 
                 db_session: AsyncSession, 
                 user_context: Dict[str, Any]):
        """
        FlowExecutor 초기화
        
        Args:
            flow_json: 실행할 플로우의 JSON 정의
            db_session: 데이터베이스 세션
            user_context: 사용자 컨텍스트 정보
            
        Raises:
            FlowValidationError: flow_json 유효성 검사 실패 시
        """
        self.flow_json = flow_json
        self.db_session = db_session
        self.user_context = user_context
        
        # 기본 구조 검증
        self._validate_flow_json()
        
        # 노드와 엣지 추출
        self.nodes = flow_json.get('nodes', [])
        self.edges = flow_json.get('edges', [])
        
        # DAG 유효성 검사 및 위상 정렬
        is_valid, error_message = validate_dag_structure(self.nodes, self.edges)
        if not is_valid:
            raise FlowValidationError(f"Invalid DAG structure: {error_message}")
        
        try:
            self.execution_order = topological_sort(self.nodes, self.edges)
            logger.info(f"Flow execution order determined: {self.execution_order}")
        except (DAGCycleError, DAGValidationError) as e:
            raise FlowValidationError(f"Failed to determine execution order: {e}")
        
        # 노드 맵 생성 (빠른 조회를 위해)
        self.node_map = {node['id']: node for node in self.nodes}
        
        # 엣지 맵 생성 (입력-출력 관계 파악용)
        self.edge_map = self._build_edge_map()
        
        logger.info(f"FlowExecutor initialized with {len(self.nodes)} nodes and {len(self.edges)} edges")
    
    def _validate_flow_json(self) -> None:
        """flow_json 기본 구조 유효성 검사"""
        if not isinstance(self.flow_json, dict):
            raise FlowValidationError("flow_json must be a dictionary")
        
        required_fields = ['nodes', 'edges']
        for field in required_fields:
            if field not in self.flow_json:
                raise FlowValidationError(f"Missing required field: {field}")
        
        if not isinstance(self.flow_json['nodes'], list):
            raise FlowValidationError("'nodes' must be a list")
        
        if not isinstance(self.flow_json['edges'], list):
            raise FlowValidationError("'edges' must be a list")
    
    def _build_edge_map(self) -> Dict[str, Dict[str, List[str]]]:
        """
        엣지 맵 구축
        
        Returns:
            Dict: {
                'inputs': {node_id: [source_nodes...]},
                'outputs': {node_id: [target_nodes...]}
            }
        """
        edge_map = {
            'inputs': {},
            'outputs': {}
        }
        
        # 초기화
        for node in self.nodes:
            node_id = node['id']
            edge_map['inputs'][node_id] = []
            edge_map['outputs'][node_id] = []
        
        # 엣지 정보 구축
        for edge in self.edges:
            source_id = edge['source']
            target_id = edge['target']
            
            edge_map['outputs'][source_id].append(target_id)
            edge_map['inputs'][target_id].append(source_id)
        
        return edge_map
    
    async def execute(self, 
                     input_data: Optional[Dict[str, Any]] = None,
                     execution_id: Optional[str] = None) -> Any:
        """
        Flow 실행
        
        Args:
            input_data: 초기 입력 데이터
            execution_id: 실행 ID (없으면 자동 생성)
            
        Returns:
            Any: 최종 출력 노드의 결과
            
        Raises:
            FlowExecutionError: 실행 중 오류 발생 시
        """
        if execution_id is None:
            execution_id = f"exec_{datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')}"
        
        # 실행 컨텍스트 생성
        flow_id = self.flow_json.get('id', 'unknown')
        execution_context = FlowExecutionContext(
            flow_id=flow_id,
            execution_id=execution_id,
            user_context=self.user_context,
            global_variables=input_data or {}
        )
        
        logger.info(f"Starting flow execution: {execution_id}")
        
        try:
            # 글로벌 변수 및 매개변수 노드 처리
            await self._process_global_nodes(execution_context)
            
            # 노드 순차 실행
            for node_id in self.execution_order:
                await self._execute_node(node_id, execution_context)
            
            # 최종 결과 결정
            final_result = self._determine_final_result(execution_context)
            
            execution_time = (datetime.utcnow() - execution_context.execution_start_time).total_seconds()
            logger.info(f"Flow execution completed: {execution_id} in {execution_time:.2f}s")
            
            return final_result
            
        except Exception as e:
            logger.error(f"Flow execution failed: {execution_id} - {e}", exc_info=True)
            raise FlowExecutionError(f"Flow execution failed: {e}")
    
    async def _process_global_nodes(self, execution_context: FlowExecutionContext) -> None:
        """
        글로벌 노드들(TriggerNode, FlowParameterNode, SetGetVariableNode) 처리
        
        이 노드들은 실제 실행보다는 실행 컨텍스트 설정에 사용됩니다.
        """
        for node in self.nodes:
            node_type = node.get('type', '')
            node_config = node.get('config', {})
            
            if node_type == 'maxdp_trigger':
                # 트리거 노드: 실행 시작 조건 설정
                trigger_data = node_config.get('trigger_data', {})
                execution_context.global_variables.update(trigger_data)
                
            elif node_type == 'maxdp_flow_parameter':
                # 플로우 매개변수: 글로벌 변수에 추가
                param_name = node_config.get('parameter_name')
                param_value = node_config.get('default_value')
                if param_name:
                    execution_context.global_variables.setdefault(param_name, param_value)
                    
            elif node_type == 'maxdp_set_get_variable':
                # 변수 설정: 글로벌 변수에 추가
                var_name = node_config.get('variable_name')
                var_value = node_config.get('variable_value')
                if var_name and var_value is not None:
                    execution_context.global_variables[var_name] = var_value
    
    async def _execute_node(self, node_id: str, execution_context: FlowExecutionContext) -> None:
        """
        개별 노드 실행
        
        Args:
            node_id: 실행할 노드 ID
            execution_context: 실행 컨텍스트
        """
        start_time = datetime.utcnow()
        
        try:
            node_config = self.node_map[node_id]
            node_type = node_config.get('type', '')
            
            logger.debug(f"Executing node: {node_id} ({node_type})")
            
            # 유틸리티/제어 노드들은 스킵 (이미 처리됨)
            skip_types = ['maxdp_trigger', 'maxdp_flow_parameter', 'maxdp_set_get_variable', 'maxdp_comment']
            if node_type in skip_types:
                logger.debug(f"Skipping utility node: {node_id}")
                return
            
            # 노드 인스턴스 생성
            try:
                node_instance = create_node_instance(node_config, self.db_session, execution_context)
            except NodeCreationError as e:
                raise FlowExecutionError(f"Failed to create node instance for {node_id}: {e}")
            
            # 입력 데이터 준비
            input_data = self._prepare_node_input(node_id, execution_context)
            
            # 노드 실행
            if isinstance(node_instance, MaxDPNode):
                result = await node_instance.ainvoke(input_data)
            else:
                # 일반 함수나 객체인 경우
                result = await self._invoke_generic_node(node_instance, input_data)
            
            # 실행 결과 저장
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            execution_context.add_node_output(node_id, result, execution_time)
            
            logger.debug(f"Node {node_id} executed successfully in {execution_time:.3f}s")
            
        except Exception as e:
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            logger.error(f"Node {node_id} execution failed after {execution_time:.3f}s: {e}")
            raise FlowExecutionError(f"Node {node_id} execution failed: {e}")
    
    def _prepare_node_input(self, node_id: str, execution_context: FlowExecutionContext) -> Dict[str, Any]:
        """
        노드 입력 데이터 준비
        
        Args:
            node_id: 대상 노드 ID
            execution_context: 실행 컨텍스트
            
        Returns:
            Dict[str, Any]: 노드 입력 데이터
        """
        input_data = {}
        
        # 이전 노드들의 출력 수집
        input_node_ids = self.edge_map['inputs'].get(node_id, [])
        
        for input_node_id in input_node_ids:
            output = execution_context.get_node_output(input_node_id)
            if output is not None:
                # 핸들 정보가 있다면 사용, 없다면 노드 ID 사용
                handle_name = self._get_output_handle_name(input_node_id, node_id)
                input_data[handle_name] = output
        
        # 글로벌 변수 병합
        input_data.update(execution_context.global_variables)
        
        return input_data
    
    def _get_output_handle_name(self, source_node_id: str, target_node_id: str) -> str:
        """
        엣지의 출력 핸들 이름 결정
        
        Args:
            source_node_id: 소스 노드 ID
            target_node_id: 타겟 노드 ID
            
        Returns:
            str: 핸들 이름
        """
        # 엣지에서 핸들 정보 찾기
        for edge in self.edges:
            if edge['source'] == source_node_id and edge['target'] == target_node_id:
                # sourceHandle 또는 targetHandle 정보 사용
                handle_name = edge.get('sourceHandle', edge.get('targetHandle', source_node_id))
                return handle_name
        
        # 기본값: 소스 노드 ID
        return source_node_id
    
    async def _invoke_generic_node(self, node_instance: Any, input_data: Dict[str, Any]) -> Any:
        """
        일반 노드 객체 실행
        
        Args:
            node_instance: 노드 인스턴스
            input_data: 입력 데이터
            
        Returns:
            Any: 실행 결과
        """
        if hasattr(node_instance, 'ainvoke'):
            return await node_instance.ainvoke(input_data)
        elif hasattr(node_instance, 'invoke'):
            return node_instance.invoke(input_data)
        elif callable(node_instance):
            return node_instance(input_data)
        else:
            raise FlowExecutionError(f"Node instance is not callable: {type(node_instance)}")
    
    def _determine_final_result(self, execution_context: FlowExecutionContext) -> Any:
        """
        최종 실행 결과 결정
        
        Args:
            execution_context: 실행 컨텍스트
            
        Returns:
            Any: 최종 결과
        """
        # 출력 노드 찾기 (나가는 엣지가 없는 노드들)
        output_nodes = []
        for node_id in self.execution_order:
            if not self.edge_map['outputs'].get(node_id, []):
                output_nodes.append(node_id)
        
        if len(output_nodes) == 1:
            # 단일 출력 노드
            return execution_context.get_node_output(output_nodes[0])
        elif len(output_nodes) > 1:
            # 다중 출력 노드
            results = {}
            for node_id in output_nodes:
                results[node_id] = execution_context.get_node_output(node_id)
            return results
        else:
            # DisplayResults 노드 찾기
            display_nodes = [
                node_id for node_id in self.execution_order
                if self.node_map[node_id].get('type') == 'maxdp_display_results'
            ]
            
            if display_nodes:
                return execution_context.get_node_output(display_nodes[-1])  # 마지막 display 노드
            
            # 마지막 실행된 노드의 결과
            if self.execution_order:
                return execution_context.get_node_output(self.execution_order[-1])
            
            return None
    
    def get_flow_info(self) -> Dict[str, Any]:
        """
        Flow 정보 반환
        
        Returns:
            Dict[str, Any]: Flow 메타데이터
        """
        return {
            'flow_id': self.flow_json.get('id', 'unknown'),
            'node_count': len(self.nodes),
            'edge_count': len(self.edges),
            'execution_order': self.execution_order,
            'input_nodes': [
                node_id for node_id in self.execution_order
                if not self.edge_map['inputs'].get(node_id, [])
            ],
            'output_nodes': [
                node_id for node_id in self.execution_order
                if not self.edge_map['outputs'].get(node_id, [])
            ]
        } 
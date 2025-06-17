"""
MAX DP Node Factory

노드 타입 문자열을 기반으로 실제 노드 클래스 인스턴스를 생성하는 팩토리 패턴을 구현합니다.
모든 노드 클래스들을 중앙에서 관리하고 동적으로 인스턴스를 생성합니다.
"""

import logging
from typing import Dict, Any, Type, Optional, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession

from .maxdp_base_node import MaxDPNode

logger = logging.getLogger(__name__)

class NodeCreationError(Exception):
    """노드 생성 실패 시 발생하는 예외"""
    pass

# 노드 타입별 클래스 매핑 (지연 로딩을 위해 함수로 구현)
def _get_node_class_registry() -> Dict[str, Type[MaxDPNode]]:
    """노드 클래스 레지스트리 반환"""
    from .maxdp_sources import (
        TableReaderNode, CustomSQLQueryNode, FileInputNode, ApiEndpointNode,
        StaticDataNode, WebhookListenerNode
    )
    from .maxdp_transforms import (
        SelectColumnsNode, FilterRowsNode, SampleRowsNode, RenameColumnsNode,
        AddModifyColumnNode, ChangeDataTypeNode, SplitColumnNode, MapValuesNode
    )
    from .maxdp_transforms_advanced import (
        HandleMissingValuesNode, DeduplicateNode, SortDataNode, PivotTableNode,
        MeltNode, GroupAggregateNode, WindowFunctionsNode, JoinMergeNode,
        UnionConcatenateNode, RunPythonScriptNode, ApplyFunctionNode
    )
    from .maxdp_sinks import (
        TableWriterNode, FileWriterNode, APIRequestNode, DisplayResultsNode,
        SendNotificationNode
    )
    from .maxdp_control import (
        ConditionalBranchNode, TryCatchNode, MergeNode
    )
    
    return {
        # 데이터 소스 노드들
        'maxdp_table_reader': TableReaderNode,
        'maxdp_custom_sql_query': CustomSQLQueryNode,
        'maxdp_file_input': FileInputNode,
        'maxdp_api_endpoint': ApiEndpointNode,
        'maxdp_static_data': StaticDataNode,
        'maxdp_webhook_listener': WebhookListenerNode,
        
        # 데이터 변환 노드들
        'maxdp_select_columns': SelectColumnsNode,
        'maxdp_filter_rows': FilterRowsNode,
        'maxdp_sample_rows': SampleRowsNode,
        'maxdp_rename_columns': RenameColumnsNode,
        'maxdp_add_modify_column': AddModifyColumnNode,
        'maxdp_change_data_type': ChangeDataTypeNode,
        'maxdp_split_column': SplitColumnNode,
        'maxdp_map_values': MapValuesNode,
        'maxdp_handle_missing_values': HandleMissingValuesNode,
        'maxdp_deduplicate': DeduplicateNode,
        'maxdp_sort_data': SortDataNode,
        'maxdp_pivot_table': PivotTableNode,
        'maxdp_melt': MeltNode,
        'maxdp_group_aggregate': GroupAggregateNode,
        'maxdp_window_functions': WindowFunctionsNode,
        'maxdp_join_merge': JoinMergeNode,
        'maxdp_union_concatenate': UnionConcatenateNode,
        'maxdp_run_python_script': RunPythonScriptNode,
        'maxdp_apply_function': ApplyFunctionNode,
        
        # 데이터 목적지 노드들
        'maxdp_table_writer': TableWriterNode,
        'maxdp_file_writer': FileWriterNode,
        'maxdp_api_request': APIRequestNode,
        'maxdp_display_results': DisplayResultsNode,
        'maxdp_send_notification': SendNotificationNode,
        
        # 로직 및 제어 흐름 노드들
        'maxdp_conditional_branch': ConditionalBranchNode,
        'maxdp_try_catch': TryCatchNode,
        'maxdp_merge': MergeNode,
    }

# 전역 레지스트리 캐시
_registry_cache: Optional[Dict[str, Type[MaxDPNode]]] = None

def get_node_class_registry() -> Dict[str, Type[MaxDPNode]]:
    """노드 클래스 레지스트리 반환 (캐시 포함)"""
    global _registry_cache
    if _registry_cache is None:
        _registry_cache = _get_node_class_registry()
    return _registry_cache

def create_node_instance(node_config: Dict[str, Any], 
                        db_session: Optional[AsyncSession] = None,
                        execution_context: Optional[Any] = None) -> MaxDPNode:
    """
    노드 설정을 기반으로 노드 인스턴스를 생성
    
    Args:
        node_config: 노드 설정 정보 (id, type, config 포함)
        db_session: 데이터베이스 세션 (선택적)
        execution_context: 실행 컨텍스트 (선택적)
        
    Returns:
        MaxDPNode: 생성된 노드 인스턴스
        
    Raises:
        NodeCreationError: 노드 생성 실패 시
    """
    try:
        # 필수 필드 검증
        if 'id' not in node_config:
            raise NodeCreationError("Node config missing 'id' field")
        
        if 'type' not in node_config:
            raise NodeCreationError("Node config missing 'type' field")
        
        node_id = node_config['id']
        node_type = node_config['type']
        node_specific_config = node_config.get('config', {})
        
        # 노드 클래스 레지스트리에서 클래스 조회
        registry = get_node_class_registry()
        
        if node_type not in registry:
            # 알려지지 않은 노드 타입에 대한 상세 오류 메시지
            available_types = list(registry.keys())
            logger.error(f"Unknown node type: {node_type}. Available types: {available_types[:10]}...")
            raise NodeCreationError(f"Unknown node type: {node_type}")
        
        node_class = registry[node_type]
        
        # 노드 인스턴스 생성
        logger.debug(f"Creating node instance: {node_id} ({node_type})")
        
        # 생성자 매개변수 준비
        init_kwargs = {
            'node_id': node_id,
            'node_config': node_specific_config,
            'node_type': node_type
        }
        
        # 선택적 매개변수 추가
        if db_session is not None:
            init_kwargs['db_session'] = db_session
            
        if execution_context is not None:
            init_kwargs['execution_context'] = execution_context
        
        # 노드 인스턴스 생성
        node_instance = node_class(**init_kwargs)
        
        logger.debug(f"Node instance created successfully: {node_id}")
        return node_instance
        
    except Exception as e:
        error_msg = f"Failed to create node instance for {node_config.get('id', 'unknown')}: {e}"
        logger.error(error_msg)
        raise NodeCreationError(error_msg) from e

def register_node_class(node_type: str, node_class: Type[MaxDPNode]) -> None:
    """
    새로운 노드 클래스를 레지스트리에 등록
    
    Args:
        node_type: 노드 타입 문자열
        node_class: 노드 클래스
    """
    global _registry_cache
    
    if not issubclass(node_class, MaxDPNode):
        raise ValueError(f"Node class must inherit from MaxDPNode: {node_class}")
    
    # 캐시 무효화 및 새 클래스 등록
    if _registry_cache is None:
        _registry_cache = _get_node_class_registry()
    
    _registry_cache[node_type] = node_class
    logger.info(f"Registered new node class: {node_type} -> {node_class.__name__}")

def get_available_node_types() -> List[str]:
    """
    사용 가능한 모든 노드 타입 목록 반환
    
    Returns:
        List[str]: 노드 타입 문자열 목록
    """
    registry = get_node_class_registry()
    return sorted(registry.keys())

def get_node_type_info(node_type: str) -> Dict[str, Any]:
    """
    특정 노드 타입의 상세 정보 반환
    
    Args:
        node_type: 조회할 노드 타입
        
    Returns:
        Dict[str, Any]: 노드 타입 정보
        
    Raises:
        NodeCreationError: 알려지지 않은 노드 타입인 경우
    """
    registry = get_node_class_registry()
    
    if node_type not in registry:
        raise NodeCreationError(f"Unknown node type: {node_type}")
    
    node_class = registry[node_type]
    
    return {
        'type': node_type,
        'class_name': node_class.__name__,
        'module': node_class.__module__,
        'doc': node_class.__doc__ or "No documentation available",
        'base_classes': [base.__name__ for base in node_class.__bases__]
    }

def validate_node_config(node_config: Dict[str, Any]) -> Tuple[bool, str]:
    """
    노드 설정의 유효성 검사
    
    Args:
        node_config: 검증할 노드 설정
        
    Returns:
        Tuple[bool, str]: (유효성 여부, 오류 메시지)
    """
    try:
        # 기본 필드 검사
        if not isinstance(node_config, dict):
            return False, "Node config must be a dictionary"
        
        if 'id' not in node_config:
            return False, "Missing required field: 'id'"
        
        if 'type' not in node_config:
            return False, "Missing required field: 'type'"
        
        node_type = node_config['type']
        
        # 노드 타입 존재 여부 확인
        registry = get_node_class_registry()
        if node_type not in registry:
            available_types = list(registry.keys())
            return False, f"Unknown node type: {node_type}. Available: {available_types[:5]}..."
        
        # 추가 검증은 각 노드 클래스에서 수행
        return True, "Valid node configuration"
        
    except Exception as e:
        return False, f"Validation error: {e}"

# 레지스트리 초기화를 위한 헬퍼 함수
def initialize_node_registry() -> None:
    """노드 레지스트리 초기화 (애플리케이션 시작 시 호출)"""
    try:
        registry = get_node_class_registry()
        logger.info(f"Node registry initialized with {len(registry)} node types")
        
        # 각 카테고리별 노드 수 로깅
        categories = {
            'sources': len([t for t in registry.keys() if any(src in t for src in ['table_reader', 'sql_query', 'file_input', 'api_endpoint', 'static_data', 'webhook'])]),
            'transforms': len([t for t in registry.keys() if any(trans in t for trans in ['select', 'filter', 'rename', 'add_modify', 'change_data', 'split', 'map', 'handle_missing', 'deduplicate', 'sort', 'pivot', 'melt', 'group', 'window', 'join', 'union', 'python_script', 'apply'])]),
            'sinks': len([t for t in registry.keys() if any(sink in t for sink in ['table_writer', 'file_writer', 'api_request', 'display_results', 'send_notification'])]),
            'control': len([t for t in registry.keys() if any(ctrl in t for ctrl in ['conditional', 'try_catch', 'merge'])])
        }
        
        logger.info(f"Node categories: {categories}")
        
    except Exception as e:
        logger.error(f"Failed to initialize node registry: {e}")
        raise 
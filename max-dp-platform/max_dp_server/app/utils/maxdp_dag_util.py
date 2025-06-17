"""
MAX DP DAG(Directed Acyclic Graph) 유틸리티

flow_json의 nodes와 edges를 분석하여 실행 순서를 결정하는 위상 정렬 알고리즘을 제공합니다.
Kahn's Algorithm을 사용하여 순환 그래프를 감지하고 올바른 실행 순서를 생성합니다.
"""

import logging
from typing import Dict, List, Any, Set, Tuple
from collections import defaultdict, deque

# Logger 설정 (SYS_G_04 지침 준수)
logger = logging.getLogger(__name__)

class DAGCycleError(Exception):
    """DAG에서 순환 그래프가 감지된 경우 발생하는 예외"""
    pass

class DAGValidationError(Exception):
    """DAG 유효성 검사 실패 시 발생하는 예외"""
    pass

def topological_sort(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> List[str]:
    """
    Kahn's Algorithm을 사용한 위상 정렬
    
    Args:
        nodes: flow_json의 nodes 리스트
        edges: flow_json의 edges 리스트
        
    Returns:
        List[str]: 위상 정렬된 노드 ID 리스트
        
    Raises:
        DAGCycleError: 순환 그래프가 감지된 경우
        DAGValidationError: DAG 유효성 검사 실패 시
    """
    try:
        logger.debug(f"Starting topological sort with {len(nodes)} nodes and {len(edges)} edges")
        
        # 노드 ID 추출 및 검증
        node_ids = set()
        node_map = {}
        
        for node in nodes:
            if 'id' not in node:
                raise DAGValidationError("Node missing required 'id' field")
            
            node_id = node['id']
            if node_id in node_map:
                raise DAGValidationError(f"Duplicate node ID: {node_id}")
                
            node_ids.add(node_id)
            node_map[node_id] = node
        
        # 그래프 구조 생성
        graph = defaultdict(list)  # 인접 리스트: source -> [targets]
        in_degree = defaultdict(int)  # 진입 차수
        
        # 모든 노드의 진입 차수를 0으로 초기화
        for node_id in node_ids:
            in_degree[node_id] = 0
        
        # 엣지 처리
        for edge in edges:
            # 엣지 유효성 검사
            if not _validate_edge(edge):
                raise DAGValidationError(f"Invalid edge format: {edge}")
            
            source_id = edge['source']
            target_id = edge['target']
            
            # 노드 존재 여부 확인
            if source_id not in node_ids:
                raise DAGValidationError(f"Edge references non-existent source node: {source_id}")
            if target_id not in node_ids:
                raise DAGValidationError(f"Edge references non-existent target node: {target_id}")
            
            # 그래프에 엣지 추가
            graph[source_id].append(target_id)
            in_degree[target_id] += 1
        
        # Kahn's Algorithm 실행
        result = []
        queue = deque()
        
        # 진입 차수가 0인 노드들을 큐에 추가
        for node_id in node_ids:
            if in_degree[node_id] == 0:
                queue.append(node_id)
        
        logger.debug(f"Starting nodes (in-degree 0): {list(queue)}")
        
        # 위상 정렬 실행
        while queue:
            current_node = queue.popleft()
            result.append(current_node)
            
            # 현재 노드에서 나가는 엣지들 처리
            for neighbor in graph[current_node]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)
        
        # 순환 그래프 검사
        if len(result) != len(node_ids):
            remaining_nodes = node_ids - set(result)
            logger.error(f"Cycle detected. Remaining nodes: {remaining_nodes}")
            
            # 순환에 포함된 노드들을 찾아서 상세 정보 제공
            cycle_info = _find_cycle(graph, remaining_nodes)
            raise DAGCycleError(f"Cycle detected in flow graph. Cycle: {cycle_info}")
        
        logger.info(f"Topological sort completed. Execution order: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Topological sort failed: {e}")
        raise

def _validate_edge(edge: Dict[str, Any]) -> bool:
    """
    엣지 유효성 검사
    
    Args:
        edge: 엣지 정보
        
    Returns:
        bool: 유효한 엣지인지 여부
    """
    required_fields = ['source', 'target']
    return all(field in edge for field in required_fields)

def _find_cycle(graph: Dict[str, List[str]], remaining_nodes: Set[str]) -> List[str]:
    """
    순환 그래프에서 하나의 순환을 찾아 반환
    
    Args:
        graph: 그래프 인접 리스트
        remaining_nodes: 아직 방문되지 않은 노드들
        
    Returns:
        List[str]: 순환에 포함된 노드들의 경로
    """
    def dfs(node: str, path: List[str], visited: Set[str], rec_stack: Set[str]) -> List[str]:
        """DFS를 사용하여 순환 찾기"""
        if node in rec_stack:
            # 순환 발견
            cycle_start = path.index(node)
            return path[cycle_start:] + [node]
        
        if node in visited:
            return []
        
        visited.add(node)
        rec_stack.add(node)
        path.append(node)
        
        for neighbor in graph.get(node, []):
            if neighbor in remaining_nodes:
                cycle = dfs(neighbor, path, visited, rec_stack)
                if cycle:
                    return cycle
        
        path.pop()
        rec_stack.remove(node)
        return []
    
    visited = set()
    
    for node in remaining_nodes:
        if node not in visited:
            cycle = dfs(node, [], visited, set())
            if cycle:
                return cycle
    
    return list(remaining_nodes)  # 순환을 찾지 못한 경우 남은 노드들 반환

def validate_dag_structure(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> Tuple[bool, str]:
    """
    DAG 구조 유효성 검사
    
    Args:
        nodes: 노드 리스트
        edges: 엣지 리스트
        
    Returns:
        Tuple[bool, str]: (유효성 여부, 오류 메시지)
    """
    try:
        # 기본 유효성 검사
        if not nodes:
            return False, "No nodes provided"
        
        # 노드 ID 중복 검사
        node_ids = []
        for node in nodes:
            if 'id' not in node:
                return False, "Node missing 'id' field"
            node_ids.append(node['id'])
        
        if len(node_ids) != len(set(node_ids)):
            return False, "Duplicate node IDs found"
        
        # 엣지 유효성 검사
        node_id_set = set(node_ids)
        for edge in edges:
            if not _validate_edge(edge):
                return False, f"Invalid edge format: {edge}"
            
            if edge['source'] not in node_id_set:
                return False, f"Edge references non-existent source node: {edge['source']}"
            
            if edge['target'] not in node_id_set:
                return False, f"Edge references non-existent target node: {edge['target']}"
        
        # 위상 정렬을 통한 순환 검사
        topological_sort(nodes, edges)
        
        return True, "DAG structure is valid"
        
    except Exception as e:
        return False, str(e)

def get_node_dependencies(node_id: str, edges: List[Dict[str, Any]]) -> List[str]:
    """
    특정 노드의 의존성(입력) 노드들을 반환
    
    Args:
        node_id: 대상 노드 ID
        edges: 엣지 리스트
        
    Returns:
        List[str]: 의존성 노드 ID 리스트
    """
    dependencies = []
    for edge in edges:
        if edge['target'] == node_id:
            dependencies.append(edge['source'])
    
    return dependencies

def get_node_dependents(node_id: str, edges: List[Dict[str, Any]]) -> List[str]:
    """
    특정 노드에 의존하는(출력을 받는) 노드들을 반환
    
    Args:
        node_id: 대상 노드 ID
        edges: 엣지 리스트
        
    Returns:
        List[str]: 의존하는 노드 ID 리스트
    """
    dependents = []
    for edge in edges:
        if edge['source'] == node_id:
            dependents.append(edge['target'])
    
    return dependents

def find_execution_groups(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> List[List[str]]:
    """
    병렬 실행 가능한 노드 그룹들을 찾아 반환
    
    Args:
        nodes: 노드 리스트
        edges: 엣지 리스트
        
    Returns:
        List[List[str]]: 각 레벨별 병렬 실행 가능한 노드 그룹들
    """
    try:
        node_ids = {node['id'] for node in nodes}
        in_degree = defaultdict(int)
        graph = defaultdict(list)
        
        # 그래프 구조 생성
        for node_id in node_ids:
            in_degree[node_id] = 0
            
        for edge in edges:
            source_id = edge['source']
            target_id = edge['target']
            graph[source_id].append(target_id)
            in_degree[target_id] += 1
        
        # 레벨별 그룹 생성
        execution_groups = []
        remaining_nodes = set(node_ids)
        
        while remaining_nodes:
            # 현재 레벨에서 실행 가능한 노드들 (진입 차수가 0)
            current_level = []
            for node_id in remaining_nodes:
                if in_degree[node_id] == 0:
                    current_level.append(node_id)
            
            if not current_level:
                # 더 이상 실행할 수 있는 노드가 없으면 순환 그래프
                raise DAGCycleError("Cycle detected while finding execution groups")
            
            execution_groups.append(current_level)
            
            # 현재 레벨 노드들을 제거하고 진입 차수 업데이트
            for node_id in current_level:
                remaining_nodes.remove(node_id)
                for neighbor in graph[node_id]:
                    in_degree[neighbor] -= 1
        
        logger.debug(f"Found {len(execution_groups)} execution groups: {execution_groups}")
        return execution_groups
        
    except Exception as e:
        logger.error(f"Failed to find execution groups: {e}")
        raise 
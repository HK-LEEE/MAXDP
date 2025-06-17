"""
MAX DP Models 통합 모듈
모든 SQLAlchemy 모델을 한 곳에서 관리합니다.
"""

# 기본 베이스 클래스
from ..db.maxdp_session import Base

# 사용자 관련 모델
from .maxdp_user_model import (
    User,
    Group,
    Role,
    RefreshToken,
    generate_user_id
)

# 워크스페이스 관련 모델
from .maxdp_workspace_model import (
    MaxDPWorkspace,
    MaxDPWorkspacePermission,
    MaxDPWorkspaceActivity,
    OwnerType
)

# Flow 관련 모델
from .maxdp_flow_model import (
    MaxDPFlow,
    MaxDPFlowVersion,
    MaxDPFlowExecution,
    FlowStatus,
    ExecutionStatus
)

# 모든 모델 클래스 리스트 (마이그레이션에서 사용)
__all__ = [
    # Base
    "Base",
    
    # User Models
    "User",
    "Group", 
    "Role",
    "RefreshToken",
    "generate_user_id",
    
    # Workspace Models
    "MaxDPWorkspace",
    "MaxDPWorkspacePermission", 
    "MaxDPWorkspaceActivity",
    "OwnerType",
    
    # Flow Models
    "MaxDPFlow",
    "MaxDPFlowVersion",
    "MaxDPFlowExecution",
    "FlowStatus",
    "ExecutionStatus",
]

# 모델 메타데이터 정보
MODEL_METADATA = {
    "user_models": ["User", "Group", "Role", "RefreshToken"],
    "workspace_models": ["MaxDPWorkspace", "MaxDPWorkspacePermission", "MaxDPWorkspaceActivity"],
    "flow_models": ["MaxDPFlow", "MaxDPFlowVersion", "MaxDPFlowExecution"],
    "enum_types": ["OwnerType", "FlowStatus", "ExecutionStatus"]
} 
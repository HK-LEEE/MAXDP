"""
MAX DP Flow 관리 모델
데이터 파이프라인 Flow와 버전 관리를 위한 모델입니다.
"""
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID as PostgreSQL_UUID
from enum import Enum

from ..db.maxdp_session import Base
from .maxdp_workspace_model import OwnerType

class FlowStatus(str, Enum):
    """Flow 상태 열거형"""
    DRAFT = "draft"
    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"

class ExecutionStatus(str, Enum):
    """실행 상태 열거형"""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"

class MaxDPFlow(Base):
    """MAX DP Flow 테이블 (새로 생성)"""
    __tablename__ = "maxdp_flows"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Flow 기본 정보
    name = Column(String(255), nullable=False, comment="Flow 이름")
    description = Column(Text, nullable=True, comment="Flow 설명")
    
    # 워크스페이스 연관
    workspace_id = Column(Integer, ForeignKey('maxdp_workspaces.id'), nullable=False, comment="소속 워크스페이스 ID")
    
    # 소유자 정보 (사용자 또는 그룹)
    owner_type = Column(SQLEnum(OwnerType), nullable=False, comment="소유자 타입: user 또는 group")
    owner_user_id = Column(PostgreSQL_UUID(as_uuid=True), ForeignKey('users.id'), nullable=True, comment="사용자 소유자 ID")
    owner_group_id = Column(Integer, ForeignKey('groups.id'), nullable=True, comment="그룹 소유자 ID")
    
    # Flow 설정
    status = Column(String(20), default="draft", comment="Flow 상태")
    is_public = Column(Boolean, default=False, comment="공개 Flow 여부")
    tags = Column(JSON, nullable=True, comment="Flow 태그 (JSON 배열)")
    
    # 현재 버전 정보
    current_version = Column(Integer, default=1, comment="현재 활성 버전")
    latest_version = Column(Integer, default=1, comment="최신 버전 번호")
    
    # 실행 설정
    is_scheduled = Column(Boolean, default=False, comment="스케줄 실행 여부")
    schedule_config = Column(JSON, nullable=True, comment="스케줄 설정 (JSON)")
    
    # 시스템 정보
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    created_by = Column(PostgreSQL_UUID(as_uuid=True), ForeignKey('users.id'), nullable=False, comment="생성자 ID")
    
    # 관계 정의
    workspace = relationship("MaxDPWorkspace", back_populates="flows")
    owner = relationship("User", foreign_keys=[owner_user_id], back_populates="flows")
    group_owner = relationship("Group", foreign_keys=[owner_group_id], back_populates="flows")
    creator = relationship("User", foreign_keys=[created_by])
    
    # 버전과의 관계
    versions = relationship("MaxDPFlowVersion", back_populates="flow", cascade="all, delete-orphan")
    executions = relationship("MaxDPFlowExecution", back_populates="flow", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<MaxDPFlow(id={self.id}, name='{self.name}', version={self.current_version})>"
    
    @property
    def owner_id(self):
        """소유자 ID를 반환 (타입에 따라)"""
        if self.owner_type == OwnerType.USER:
            return self.owner_user_id
        elif self.owner_type == OwnerType.GROUP:
            return self.owner_group_id
        return None
    
    @property
    def owner_name(self):
        """소유자 이름을 반환"""
        if self.owner_type == OwnerType.USER and self.owner:
            return self.owner.display_name or self.owner.real_name
        elif self.owner_type == OwnerType.GROUP and self.group_owner:
            return self.group_owner.name
        return None
    
    def is_owned_by_user(self, user_id: str) -> bool:
        """특정 사용자가 이 Flow의 소유자인지 확인"""
        if self.owner_type == OwnerType.USER:
            return str(self.owner_user_id) == str(user_id)
        elif self.owner_type == OwnerType.GROUP and self.group_owner:
            # 그룹 멤버 확인
            return any(str(member.id) == str(user_id) for member in self.group_owner.members)
        return False
    
    def get_current_version_data(self):
        """현재 활성 버전의 데이터를 반환"""
        current_ver = next((v for v in self.versions if v.version_number == self.current_version), None)
        return current_ver

# 발행된 API 목록을 위한 임시 테이블 (실제 구현에서는 별도 모델로 분리)
DPA_PUBLISHED_APIS = {}

class MaxDPFlowVersion(Base):
    """MAX DP Flow 버전 테이블 (새로 생성)"""
    __tablename__ = "maxdp_flow_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # 버전 정보
    flow_id = Column(Integer, ForeignKey('maxdp_flows.id'), nullable=False, comment="Flow ID")
    version_number = Column(Integer, nullable=False, comment="버전 번호")
    version_name = Column(String(100), nullable=True, comment="버전 이름")
    
    # 버전 메타데이터
    description = Column(Text, nullable=True, comment="버전 설명")
    changelog = Column(Text, nullable=True, comment="변경사항")
    
    # Flow 정의 (JSON 형태로 저장)
    flow_definition = Column(JSON, nullable=False, comment="Flow 정의 (JSON)")
    components = Column(JSON, nullable=True, comment="사용된 컴포넌트 목록 (JSON)")
    
    # 버전 설정
    is_active = Column(Boolean, default=False, comment="활성 버전 여부")
    is_published = Column(Boolean, default=False, comment="발행된 버전 여부")
    
    # 시스템 정보
    created_at = Column(DateTime, default=func.now())
    created_by = Column(PostgreSQL_UUID(as_uuid=True), ForeignKey('users.id'), nullable=False, comment="생성자 ID")
    
    # 관계 정의
    flow = relationship("MaxDPFlow", back_populates="versions")
    creator = relationship("User")
    executions = relationship("MaxDPFlowExecution", back_populates="version")
    
    def __repr__(self):
        return f"<MaxDPFlowVersion(flow_id={self.flow_id}, version={self.version_number})>"

class MaxDPFlowExecution(Base):
    """MAX DP Flow 실행 테이블"""
    __tablename__ = "maxdp_flow_executions"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # 실행 정보
    flow_id = Column(Integer, ForeignKey('maxdp_flows.id'), nullable=False, comment="Flow ID")
    version_id = Column(Integer, ForeignKey('maxdp_flow_versions.id'), nullable=True, comment="버전 ID")
    
    # 실행 상태
    status = Column(String(20), default="PENDING", comment="실행 상태")
    execution_id = Column(String(100), unique=True, nullable=False, comment="실행 고유 ID")
    
    # 실행 설정
    trigger_type = Column(String(50), nullable=False, comment="실행 트리거 타입 (manual, schedule, api)")
    trigger_user_id = Column(PostgreSQL_UUID(as_uuid=True), ForeignKey('users.id'), nullable=True, comment="실행 트리거 사용자 ID")
    
    # 실행 결과
    start_time = Column(DateTime, nullable=True, comment="실행 시작 시간")
    end_time = Column(DateTime, nullable=True, comment="실행 종료 시간")
    duration_seconds = Column(Integer, nullable=True, comment="실행 시간 (초)")
    
    # 실행 로그 및 결과
    logs = Column(Text, nullable=True, comment="실행 로그")
    error_message = Column(Text, nullable=True, comment="에러 메시지")
    result_data = Column(JSON, nullable=True, comment="실행 결과 데이터 (JSON)")
    
    # 시스템 정보
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 관계 정의
    flow = relationship("MaxDPFlow", back_populates="executions")
    version = relationship("MaxDPFlowVersion", back_populates="executions")
    trigger_user = relationship("User")
    
    def __repr__(self):
        return f"<MaxDPFlowExecution(id={self.id}, flow_id={self.flow_id}, status={self.status})>"
    
    @property
    def is_running(self) -> bool:
        """실행 중인지 확인"""
        return self.status in [ExecutionStatus.PENDING, ExecutionStatus.RUNNING]
    
    @property
    def is_completed(self) -> bool:
        """완료되었는지 확인"""
        return self.status in [ExecutionStatus.SUCCESS, ExecutionStatus.FAILED, ExecutionStatus.CANCELLED]
    
    def get_duration_string(self) -> str:
        """실행 시간을 문자열로 반환"""
        if self.duration_seconds is None:
            return "N/A"
        
        hours = self.duration_seconds // 3600
        minutes = (self.duration_seconds % 3600) // 60
        seconds = self.duration_seconds % 60
        
        if hours > 0:
            return f"{hours}h {minutes}m {seconds}s"
        elif minutes > 0:
            return f"{minutes}m {seconds}s"
        else:
            return f"{seconds}s" 
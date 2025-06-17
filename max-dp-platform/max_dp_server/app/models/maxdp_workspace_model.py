"""
MAX DP 워크스페이스 관리 모델
사용자/그룹별 워크스페이스를 관리하는 모델입니다.
"""
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID as PostgreSQL_UUID
from enum import Enum

from ..db.maxdp_session import Base

class OwnerType(str, Enum):
    """소유자 타입 열거형"""
    USER = "user"
    GROUP = "group"

class MaxDPWorkspace(Base):
    """MAX DP 워크스페이스 테이블 (새로 생성)"""
    __tablename__ = "maxdp_workspaces"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # 워크스페이스 기본 정보
    name = Column(String(255), nullable=False, comment="워크스페이스 이름")
    description = Column(Text, nullable=True, comment="워크스페이스 설명")
    
    # 소유자 정보 (사용자 또는 그룹)
    owner_type = Column(SQLEnum(OwnerType), nullable=False, comment="소유자 타입: user 또는 group")
    owner_user_id = Column(PostgreSQL_UUID(as_uuid=True), ForeignKey('users.id'), nullable=True, comment="사용자 소유자 ID")
    owner_group_id = Column(Integer, ForeignKey('groups.id'), nullable=True, comment="그룹 소유자 ID")
    
    # 워크스페이스 상태
    is_active = Column(Boolean, default=True, comment="워크스페이스 활성화 상태")
    is_public = Column(Boolean, default=False, comment="공개 워크스페이스 여부")
    
    # 설정 정보
    settings = Column(Text, nullable=True, comment="워크스페이스 설정 (JSON)")
    
    # 시스템 정보
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    created_by = Column(PostgreSQL_UUID(as_uuid=True), ForeignKey('users.id'), nullable=False, comment="생성자 ID")
    
    # 관계 정의
    owner = relationship("User", foreign_keys=[owner_user_id], back_populates="workspaces")
    group_owner = relationship("Group", foreign_keys=[owner_group_id], back_populates="workspaces")
    creator = relationship("User", foreign_keys=[created_by])
    
    # Flow와의 관계
    flows = relationship("MaxDPFlow", back_populates="workspace", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<MaxDPWorkspace(id={self.id}, name='{self.name}', owner_type='{self.owner_type}')>"
    
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
        """특정 사용자가 이 워크스페이스의 소유자인지 확인"""
        if self.owner_type == OwnerType.USER:
            return str(self.owner_user_id) == str(user_id)
        elif self.owner_type == OwnerType.GROUP and self.group_owner:
            # 그룹 멤버 확인
            return any(str(member.id) == str(user_id) for member in self.group_owner.members)
        return False
    
    def can_access(self, user_id: str) -> bool:
        """사용자가 이 워크스페이스에 접근할 수 있는지 확인"""
        # 공개 워크스페이스는 모든 사용자가 접근 가능
        if self.is_public:
            return True
        
        # 소유자 확인
        return self.is_owned_by_user(user_id)

class MaxDPWorkspacePermission(Base):
    """워크스페이스 권한 관리 테이블 (새로 생성)"""
    __tablename__ = "maxdp_workspace_permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # 워크스페이스와 사용자
    workspace_id = Column(Integer, ForeignKey('maxdp_workspaces.id'), nullable=False)
    user_id = Column(PostgreSQL_UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    
    # 권한 설정
    can_read = Column(Boolean, default=True, comment="읽기 권한")
    can_write = Column(Boolean, default=False, comment="쓰기 권한")
    can_execute = Column(Boolean, default=False, comment="실행 권한")
    can_admin = Column(Boolean, default=False, comment="관리 권한")
    
    # 시스템 정보
    created_at = Column(DateTime, default=func.now())
    created_by = Column(PostgreSQL_UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    
    # 관계 정의
    workspace = relationship("MaxDPWorkspace")
    user = relationship("User", foreign_keys=[user_id])
    creator = relationship("User", foreign_keys=[created_by])
    
    def __repr__(self):
        return f"<MaxDPWorkspacePermission(workspace_id={self.workspace_id}, user_id={self.user_id})>"

class MaxDPWorkspaceActivity(Base):
    """워크스페이스 활동 로그 테이블 (새로 생성)"""
    __tablename__ = "maxdp_workspace_activities"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # 활동 정보
    workspace_id = Column(Integer, ForeignKey('maxdp_workspaces.id'), nullable=False)
    user_id = Column(PostgreSQL_UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    
    action = Column(String(100), nullable=False, comment="수행된 작업")
    description = Column(Text, nullable=True, comment="작업 설명")
    activity_metadata = Column(Text, nullable=True, comment="추가 메타데이터 (JSON)")
    
    # 시스템 정보
    created_at = Column(DateTime, default=func.now())
    
    # 관계 정의
    workspace = relationship("MaxDPWorkspace")
    user = relationship("User", foreign_keys=[user_id])
    
    def __repr__(self):
        return f"<MaxDPWorkspaceActivity(id={self.id}, action='{self.action}')>" 
"""
MAX DP 사용자 관리 모델
기존 platform_integration 데이터베이스의 users, groups 테이블을 사용합니다.
"""
import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID as PostgreSQL_UUID

from ..db.maxdp_session import Base

def generate_user_id():
    """사용자 고유 ID 생성 (UUID 기반)"""
    return uuid.uuid4()

class User(Base):
    """사용자 테이블 - 기존 users 테이블 사용"""
    __tablename__ = "users"
    
    # PostgreSQL 네이티브 UUID 타입 사용
    id = Column(PostgreSQL_UUID(as_uuid=True), primary_key=True, default=generate_user_id, index=True)
    
    # 실제 사용자 정보
    real_name = Column(String(100), nullable=False, comment="실제 사용자 이름")
    display_name = Column(String(50), nullable=True, comment="표시될 이름 (닉네임)")
    
    # 로그인 정보
    email = Column(String(100), unique=True, index=True, nullable=False, comment="로그인 이메일")
    phone_number = Column(String(20), nullable=True, comment="휴대폰 번호")
    hashed_password = Column(String(255), nullable=False)
    
    # 계정 상태
    is_active = Column(Boolean, default=True, comment="계정 활성화 상태")
    is_admin = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False, comment="이메일 인증 여부")
    approval_status = Column(String(20), default='pending', comment="승인 상태: pending, approved, rejected")
    approval_note = Column(Text, nullable=True, comment="승인/거부 사유")
    approved_by = Column(PostgreSQL_UUID(as_uuid=True), ForeignKey('users.id'), nullable=True, comment="승인한 관리자")
    approved_at = Column(DateTime, nullable=True, comment="승인 일시")
    
    # 역할 및 그룹 (직접 참조)
    role_id = Column(Integer, ForeignKey('roles.id'), nullable=True, comment="사용자 역할 ID")
    group_id = Column(Integer, ForeignKey('groups.id'), nullable=True, comment="사용자 그룹 ID")
    
    # 추가 정보
    department = Column(String(100), nullable=True, comment="부서")
    position = Column(String(100), nullable=True, comment="직책")
    bio = Column(Text, nullable=True, comment="자기소개")
    
    # 시스템 정보
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    last_login_at = Column(DateTime, nullable=True)
    login_count = Column(Integer, default=0, comment="로그인 횟수")
    
    # 관계 정의
    role = relationship("Role", foreign_keys=[role_id], back_populates="users")
    group = relationship("Group", foreign_keys=[group_id], back_populates="members")
    approver = relationship("User", foreign_keys=[approved_by], remote_side=[id])
    
    # MAX DP 관련 관계
    workspaces = relationship("MaxDPWorkspace", foreign_keys="MaxDPWorkspace.owner_user_id", back_populates="owner")
    flows = relationship("MaxDPFlow", foreign_keys="MaxDPFlow.owner_user_id", back_populates="owner")

class Group(Base):
    """그룹 테이블 - 기존 groups 테이블 사용"""
    __tablename__ = "groups"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    created_by = Column(PostgreSQL_UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    
    # 관계 정의
    members = relationship("User", foreign_keys='User.group_id', back_populates="group")
    creator = relationship("User", foreign_keys=[created_by])
    
    # MAX DP 관련 관계
    workspaces = relationship("MaxDPWorkspace", back_populates="group_owner")
    flows = relationship("MaxDPFlow", back_populates="group_owner")

class Role(Base):
    """역할 테이블 - 기존 roles 테이블 사용"""
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    
    # 관계 정의
    users = relationship("User", foreign_keys='User.role_id', back_populates="role")

class RefreshToken(Base):
    """리프레시 토큰 테이블"""
    __tablename__ = "refresh_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(500), nullable=False, index=True)
    user_id = Column(PostgreSQL_UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=func.now())
    last_used_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    is_revoked = Column(Boolean, default=False)
    device_info = Column(String(500), nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    
    # 관계 정의
    user = relationship("User", back_populates="refresh_tokens")
    
    def is_valid(self) -> bool:
        """토큰 유효성 검사"""
        return (
            self.is_active and 
            not self.is_revoked and 
            self.expires_at > datetime.utcnow()
        )
    
    def use(self):
        """토큰 사용 기록"""
        self.last_used_at = datetime.utcnow()
    
    def revoke(self):
        """토큰 무효화"""
        self.is_revoked = True
        self.is_active = False
        self.revoked_at = datetime.utcnow()

# User 모델에 refresh_tokens 관계 추가
User.refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan") 
"""
MAX DP 인증 의존성
FastAPI 의존성으로 사용되는 인증 관련 함수들을 제공합니다.
"""
import logging
import uuid
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr

from ..db.maxdp_session import get_db
from ..models.maxdp_user_model import User
from ..utils.maxdp_auth import verify_token
from ..maxdp_config import settings

logger = logging.getLogger(__name__)

# OAuth2 스키마 설정
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
    auto_error=True
)

class UserContext(BaseModel):
    """현재 사용자 컨텍스트 모델"""
    user_id: str
    email: EmailStr
    real_name: str
    display_name: Optional[str] = None
    is_admin: bool = False
    is_active: bool = True
    groups: list[int] = []
    role_id: Optional[int] = None
    
    class Config:
        from_attributes = True

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> UserContext:
    """JWT 토큰을 검증하고 현재 사용자 정보를 반환하는 의존성 함수"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # 먼저 로컬 JWT 토큰 검증 시도
        payload = verify_token(token, "access")
        user_id_str = None
        
        if payload is None:
            # 로컬 검증 실패 시 8000번 포트 인증 서버에 검증 요청
            logger.info("Local token verification failed, trying auth server verification")
            try:
                import httpx
                from ..maxdp_config import settings
                
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        f"{settings.auth_server_url}/api/auth/me",
                        headers={"Authorization": f"Bearer {token}"},
                        timeout=5.0
                    )
                    
                    if response.status_code == 200:
                        user_data = response.json()
                        user_id_str = user_data.get("id")
                        logger.info(f"Token verified via auth server for user: {user_id_str}")
                    else:
                        logger.warning(f"Auth server token verification failed: {response.status_code}")
                        raise credentials_exception
                        
            except Exception as e:
                logger.error(f"Auth server verification error: {e}")
                raise credentials_exception
        else:
            # 로컬 검증 성공
            user_id_str = payload.get("sub")
        
        if user_id_str is None:
            logger.warning("Token missing user ID")
            raise credentials_exception
        
        # UUID 형식 검증
        try:
            user_uuid = uuid.UUID(user_id_str)
        except ValueError:
            logger.warning(f"Invalid UUID format: {user_id_str}")
            raise credentials_exception
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token validation error: {e}")
        raise credentials_exception
    
    # 데이터베이스에서 사용자 조회
    try:
        stmt = select(User).where(User.id == user_uuid)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if user is None:
            logger.warning(f"User not found: {user_id_str}")
            raise credentials_exception
        
        if not user.is_active:
            logger.warning(f"Inactive user attempted access: {user_id_str}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Inactive user account"
            )
        
        # 그룹 정보 수집
        groups = []
        if user.group_id:
            groups = [user.group_id]
        
        # UserContext 생성
        user_context = UserContext(
            user_id=str(user.id),
            email=user.email,
            real_name=user.real_name,
            display_name=user.display_name,
            is_admin=user.is_admin,
            is_active=user.is_active,
            groups=groups,
            role_id=user.role_id
        )
        
        logger.debug(f"User authenticated: {user.email}")
        return user_context
        
    except Exception as e:
        logger.error(f"Database error during user authentication: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error"
        )

async def get_current_admin_user(
    current_user: UserContext = Depends(get_current_user)
) -> UserContext:
    """
    관리자 권한을 가진 현재 사용자를 반환하는 의존성 함수
    
    Args:
        current_user: 현재 사용자 컨텍스트
        
    Returns:
        UserContext: 관리자 사용자 컨텍스트
        
    Raises:
        HTTPException: 관리자 권한이 없는 경우
    """
    if not current_user.is_admin:
        logger.warning(f"Non-admin user attempted admin access: {current_user.email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다."
        )
    
    return current_user

async def get_current_active_user(
    current_user: UserContext = Depends(get_current_user)
) -> UserContext:
    """
    활성 사용자를 반환하는 의존성 함수 (추가 검증)
    
    Args:
        current_user: 현재 사용자 컨텍스트
        
    Returns:
        UserContext: 활성 사용자 컨텍스트
        
    Raises:
        HTTPException: 사용자가 비활성 상태인 경우
    """
    if not current_user.is_active:
        logger.warning(f"Inactive user attempted access: {current_user.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="비활성 사용자 계정입니다."
        )
    
    return current_user

async def get_user_by_id(
    user_id: str,
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """
    사용자 ID로 사용자를 조회하는 헬퍼 함수
    
    Args:
        user_id: 사용자 ID (UUID 문자열)
        db: 데이터베이스 세션
        
    Returns:
        User: 사용자 객체 또는 None
    """
    try:
        user_uuid = uuid.UUID(user_id)
        stmt = select(User).where(User.id == user_uuid)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    except (ValueError, Exception) as e:
        logger.error(f"Error fetching user {user_id}: {e}")
        return None

# 옵셔널 인증 의존성 (토큰이 없어도 허용)
oauth2_optional_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
    auto_error=False
)

async def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_optional_scheme),
    db: AsyncSession = Depends(get_db)
) -> Optional[UserContext]:
    """
    선택적 인증 의존성 - 토큰이 있으면 사용자 정보를 반환, 없으면 None 반환
    
    Args:
        token: JWT 액세스 토큰 (선택적)
        db: 데이터베이스 세션
        
    Returns:
        UserContext: 현재 사용자 컨텍스트 또는 None
    """
    if not token:
        return None
    
    try:
        return await get_current_user(token, db)
    except HTTPException:
        # 토큰이 유효하지 않으면 None 반환 (에러 발생시키지 않음)
        return None

class RequirePermissions:
    """권한 체크를 위한 의존성 클래스"""
    
    def __init__(self, *required_permissions: str):
        self.required_permissions = required_permissions
    
    def __call__(self, current_user: UserContext = Depends(get_current_user)):
        # 관리자는 모든 권한을 가진 것으로 간주
        if current_user.is_admin:
            return current_user
        
        # TODO: 실제 권한 시스템 구현 시 권한 확인 로직 추가
        # 현재는 기본적으로 허용
        return current_user

# 자주 사용되는 권한 의존성들
require_read_permission = RequirePermissions("read")
require_write_permission = RequirePermissions("write")
require_admin_permission = RequirePermissions("admin") 
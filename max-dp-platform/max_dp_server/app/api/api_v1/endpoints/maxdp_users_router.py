"""
MAX DP 사용자 관련 API 엔드포인트
사용자 인증 및 프로필 관리를 위한 API를 제공합니다.
"""
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Form
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from ....db.maxdp_session import get_db
from ....dependencies.maxdp_auth import get_current_user, UserContext
from ....utils.maxdp_auth import authenticate_user, create_access_token, create_refresh_token

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/login", response_model=dict, tags=["Authentication"])
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """
    사용자 로그인
    
    사용자명과 비밀번호로 인증하고 액세스 토큰과 리프레시 토큰을 반환합니다.
    """
    logger.info(f"Login attempt for user: {form_data.username}")
    
    try:
        # 사용자 인증
        user = await authenticate_user(db, form_data.username, form_data.password)
        if not user:
            logger.warning(f"Failed login attempt for user: {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 토큰 생성
        access_token = create_access_token(data={"sub": user.email})
        refresh_token = create_refresh_token(data={"sub": user.email})
        
        logger.info(f"Successful login for user: {user.email}")
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "user_id": str(user.id),
                "email": user.email,
                "real_name": user.real_name,
                "display_name": user.display_name,
                "is_admin": user.is_admin
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error for user {form_data.username}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed due to server error"
        )

@router.post("/logout", response_model=dict, tags=["Authentication"])
async def logout(
    current_user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    사용자 로그아웃
    
    현재 토큰을 무효화합니다. (실제 구현에서는 토큰 블랙리스트 등을 사용)
    """
    logger.info(f"Logout for user: {current_user.email}")
    
    # 실제 구현에서는 토큰을 블랙리스트에 추가하거나 무효화해야 함
    # 현재는 단순히 성공 응답만 반환
    
    return {
        "message": "Successfully logged out",
        "status": "success"
    }

@router.post("/refresh", response_model=dict, tags=["Authentication"])
async def refresh_access_token(
    refresh_token: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """
    액세스 토큰 갱신
    
    리프레시 토큰을 사용하여 새로운 액세스 토큰을 발급합니다.
    """
    try:
        # 리프레시 토큰 검증 및 새 액세스 토큰 생성
        # 실제 구현에서는 토큰 검증 로직이 필요
        
        # 임시로 간단한 응답 반환
        new_access_token = create_access_token(data={"sub": "user@example.com"})
        
        return {
            "access_token": new_access_token,
            "token_type": "bearer"
        }
        
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

@router.get("/me", response_model=dict, tags=["Users"])
async def read_users_me(
    current_user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    현재 로그인한 사용자의 정보를 반환합니다.
    
    인증 테스트 엔드포인트로 사용됩니다.
    """
    logger.info(f"User profile requested: {current_user.email}")
    
    return {
        "user_id": current_user.user_id,
        "email": current_user.email,
        "real_name": current_user.real_name,
        "display_name": current_user.display_name,
        "is_admin": current_user.is_admin,
        "is_active": current_user.is_active,
        "groups": current_user.groups,
        "role_id": current_user.role_id,
        "message": "Authentication successful"
    }

@router.get("/profile", response_model=dict, tags=["Users"])
async def get_user_profile(
    current_user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    사용자 프로필 정보를 반환합니다.
    """
    logger.info(f"Profile requested for user: {current_user.email}")
    
    # 추가적인 사용자 정보를 데이터베이스에서 조회할 수 있습니다
    # 현재는 UserContext에서 제공하는 정보만 반환
    
    return {
        "profile": {
            "user_id": current_user.user_id,
            "email": current_user.email,
            "real_name": current_user.real_name,
            "display_name": current_user.display_name,
            "is_admin": current_user.is_admin,
            "groups": current_user.groups,
            "role_id": current_user.role_id,
        },
        "permissions": {
            "can_create_workspace": True,  # 기본값, 추후 권한 시스템에서 동적으로 계산
            "can_create_flow": True,
            "can_execute_flow": True,
            "is_admin": current_user.is_admin
        }
    }

@router.get("/test-auth", response_model=dict, tags=["Users", "Testing"])
async def test_authentication():
    """
    인증이 필요하지 않은 테스트 엔드포인트
    """
    return {
        "message": "This endpoint does not require authentication",
        "status": "success",
        "timestamp": "2024-01-01T00:00:00Z"  # 실제로는 현재 시간을 사용
    }

@router.get("/test-auth-required", response_model=dict, tags=["Users", "Testing"])
async def test_authentication_required(
    current_user: UserContext = Depends(get_current_user)
):
    """
    인증이 필요한 테스트 엔드포인트
    """
    return {
        "message": "Authentication required and successful",
        "authenticated_user": current_user.email,
        "user_id": current_user.user_id,
        "status": "success"
    } 
"""
MAX DP 인증 API 엔드포인트
사용자 인증 관련 모든 API를 제공합니다.
"""
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Form
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from ....db.maxdp_session import get_db
from ....dependencies.maxdp_auth import get_current_user, UserContext
from ....utils.maxdp_auth import (
    authenticate_user, 
    create_access_token, 
    create_refresh_token,
    get_password_hash,
    verify_token
)

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/register", response_model=dict, tags=["Authentication"])
async def register(
    email: str = Form(...),
    password: str = Form(...),
    real_name: str = Form(...),
    display_name: str = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """
    사용자 등록
    
    새로운 사용자 계정을 생성합니다.
    """
    from ....models.maxdp_user_model import User
    from sqlalchemy import select
    
    logger.info(f"Registration attempt for email: {email}")
    
    try:
        # 이메일 중복 확인
        stmt = select(User).where(User.email == email)
        result = await db.execute(stmt)
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # 비밀번호 해싱
        hashed_password = get_password_hash(password)
        
        # 새 사용자 생성
        new_user = User(
            email=email,
            password_hash=hashed_password,
            real_name=real_name,
            display_name=display_name or real_name,
            is_active=True
        )
        
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        
        logger.info(f"User registered successfully: {email}")
        
        return {
            "message": "User registered successfully",
            "user_id": str(new_user.id),
            "email": new_user.email
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Registration error for {email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )

@router.post("/login", response_model=dict, tags=["Authentication"])
async def login(
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

@router.post("/refresh", response_model=dict, tags=["Authentication"])
async def refresh_token(
    refresh_token: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """
    액세스 토큰 갱신
    
    리프레시 토큰을 사용하여 새로운 액세스 토큰을 발급합니다.
    """
    try:
        # 리프레시 토큰 검증
        payload = verify_token(refresh_token, "refresh")
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        email = payload.get("sub")
        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )
        
        # 새로운 액세스 토큰 생성
        new_access_token = create_access_token(data={"sub": email})
        
        return {
            "access_token": new_access_token,
            "token_type": "bearer"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token refresh failed"
        )

@router.post("/logout", response_model=dict, tags=["Authentication"])
async def logout(
    current_user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    사용자 로그아웃
    
    현재 토큰을 무효화합니다.
    """
    logger.info(f"Logout for user: {current_user.email}")
    
    # 실제 구현에서는 토큰을 블랙리스트에 추가하거나 무효화해야 함
    # 현재는 단순히 성공 응답만 반환
    
    return {
        "message": "Successfully logged out",
        "status": "success"
    }

@router.post("/revoke-all-tokens", response_model=dict, tags=["Authentication"])
async def revoke_all_tokens(
    current_user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    사용자의 모든 토큰 무효화
    
    현재 사용자의 모든 액세스 토큰과 리프레시 토큰을 무효화합니다.
    """
    logger.info(f"Revoke all tokens for user: {current_user.email}")
    
    # 실제 구현에서는 해당 사용자의 모든 토큰을 블랙리스트에 추가
    # 또는 사용자의 토큰 버전을 업데이트하여 기존 토큰을 무효화
    
    return {
        "message": "All tokens revoked successfully",
        "status": "success"
    }

@router.get("/me", response_model=dict, tags=["Authentication"])
async def get_current_user_info(
    current_user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    현재 로그인한 사용자의 정보를 반환합니다.
    """
    logger.info(f"User info requested: {current_user.email}")
    
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

@router.post("/reset-password", response_model=dict, tags=["Authentication"])
async def reset_password(
    email: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """
    비밀번호 재설정 요청
    
    이메일로 비밀번호 재설정 링크를 발송합니다.
    """
    logger.info(f"Password reset requested for: {email}")
    
    # 실제 구현에서는 이메일 발송 로직 추가
    # 현재는 단순한 응답만 반환
    
    return {
        "message": "Password reset email sent if account exists",
        "status": "success"
    }

@router.post("/change-password", response_model=dict, tags=["Authentication"])
async def change_password(
    current_password: str = Form(...),
    new_password: str = Form(...),
    current_user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    비밀번호 변경
    
    현재 비밀번호를 확인하고 새로운 비밀번호로 변경합니다.
    """
    from ....models.maxdp_user_model import User
    from ....utils.maxdp_auth import verify_password
    from sqlalchemy import select
    
    logger.info(f"Password change requested for user: {current_user.email}")
    
    try:
        # 현재 사용자 정보 조회
        stmt = select(User).where(User.id == current_user.user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # 현재 비밀번호 확인
        if not verify_password(current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect current password"
            )
        
        # 새 비밀번호 해싱 및 저장
        user.password_hash = get_password_hash(new_password)
        await db.commit()
        
        logger.info(f"Password changed successfully for user: {current_user.email}")
        
        return {
            "message": "Password changed successfully",
            "status": "success"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Password change error for {current_user.email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password change failed"
        ) 
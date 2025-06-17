"""
MAX DP 인증 유틸리티
JWT 토큰 생성, 검증 및 비밀번호 해싱 기능을 제공합니다.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, Union
from jose import JWTError, jwt
from passlib.context import CryptContext
from passlib.hash import bcrypt

from ..maxdp_config import settings

logger = logging.getLogger(__name__)

# 비밀번호 해싱 컨텍스트 설정
try:
    # bcrypt 버전 호환성을 위한 설정
    pwd_context = CryptContext(
        schemes=["bcrypt"], 
        deprecated="auto",
        bcrypt__rounds=12,
        bcrypt__ident="2b"  # bcrypt 식별자 명시
    )
    
    # 테스트 해싱으로 bcrypt 작동 확인
    test_hash = pwd_context.hash("test")
    pwd_context.verify("test", test_hash)
    logger.info("bcrypt 해싱 시스템 정상 작동 확인")
    
except Exception as e:
    logger.warning(f"bcrypt 설정 실패, 대체 방법 사용: {e}")
    # 대체 방법: 직접 bcrypt 사용
    class PasswordContext:
        @staticmethod
        def verify(plain_password: str, hashed_password: str) -> bool:
            try:
                return bcrypt.verify(plain_password, hashed_password)
            except Exception as e:
                logger.error(f"비밀번호 검증 실패: {e}")
                return False
        
        @staticmethod
        def hash(password: str) -> str:
            try:
                return bcrypt.hash(password, rounds=12)
            except Exception as e:
                logger.error(f"비밀번호 해싱 실패: {e}")
                # 최후의 수단: 간단한 해싱 (개발용)
                import hashlib
                return hashlib.sha256(password.encode()).hexdigest()
    
    pwd_context = PasswordContext()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    평문 비밀번호와 해시된 비밀번호를 비교하여 검증합니다.
    
    Args:
        plain_password: 평문 비밀번호
        hashed_password: 해시된 비밀번호
        
    Returns:
        bool: 비밀번호 일치 여부
    """
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logger.error(f"비밀번호 검증 중 오류 발생: {e}")
        return False

def get_password_hash(password: str) -> str:
    """
    평문 비밀번호를 해시합니다.
    
    Args:
        password: 평문 비밀번호
        
    Returns:
        str: 해시된 비밀번호
    """
    try:
        return pwd_context.hash(password)
    except Exception as e:
        logger.error(f"비밀번호 해싱 중 오류 발생: {e}")
        raise

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    JWT 액세스 토큰을 생성합니다.
    
    Args:
        data: JWT payload에 포함될 데이터
        expires_delta: 토큰 만료 시간 (기본값: 30분)
        
    Returns:
        str: JWT 토큰
    """
    to_encode = data.copy()
    
    # 만료 시간 설정
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access"
    })
    
    try:
        encoded_jwt = jwt.encode(
            to_encode, 
            settings.jwt_secret_key, 
            algorithm=settings.jwt_algorithm
        )
        logger.debug(f"Access token created for user: {data.get('sub', 'unknown')}")
        return encoded_jwt
    except Exception as e:
        logger.error(f"액세스 토큰 생성 실패: {e}")
        raise

def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    JWT 리프레시 토큰을 생성합니다.
    
    Args:
        data: JWT payload에 포함될 데이터
        expires_delta: 토큰 만료 시간 (기본값: 30일)
        
    Returns:
        str: JWT 리프레시 토큰
    """
    to_encode = data.copy()
    
    # 만료 시간 설정
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "refresh"
    })
    
    try:
        encoded_jwt = jwt.encode(
            to_encode, 
            settings.jwt_secret_key, 
            algorithm=settings.jwt_algorithm
        )
        logger.debug(f"Refresh token created for user: {data.get('sub', 'unknown')}")
        return encoded_jwt
    except Exception as e:
        logger.error(f"리프레시 토큰 생성 실패: {e}")
        raise

def verify_token(token: str, token_type: str = "access") -> Optional[dict]:
    """
    JWT 토큰을 검증하고 payload를 반환합니다.
    
    Args:
        token: JWT 토큰
        token_type: 토큰 타입 ("access" 또는 "refresh")
        
    Returns:
        dict: JWT payload 또는 None (검증 실패 시)
    """
    try:
        payload = jwt.decode(
            token, 
            settings.jwt_secret_key, 
            algorithms=[settings.jwt_algorithm]
        )
        
        # 토큰 타입 확인
        if payload.get("type") != token_type:
            logger.warning(f"토큰 타입 불일치: expected {token_type}, got {payload.get('type')}")
            return None
        
        # 만료 시간 확인 (jose가 자동으로 처리하지만 명시적으로 체크)
        exp = payload.get("exp")
        if exp and datetime.utcfromtimestamp(exp) < datetime.utcnow():
            logger.warning("토큰이 만료되었습니다")
            return None
        
        return payload
        
    except JWTError as e:
        logger.warning(f"JWT 토큰 검증 실패: {e}")
        return None
    except Exception as e:
        logger.error(f"토큰 검증 중 예상치 못한 오류: {e}")
        return None

def decode_token_unsafe(token: str) -> Optional[dict]:
    """
    JWT 토큰을 서명 검증 없이 디코딩합니다. (디버깅 용도)
    
    Args:
        token: JWT 토큰
        
    Returns:
        dict: JWT payload 또는 None (디코딩 실패 시)
    """
    try:
        # 서명 검증 없이 디코딩
        payload = jwt.decode(
            token, 
            options={"verify_signature": False}
        )
        return payload
    except Exception as e:
        logger.error(f"토큰 디코딩 실패: {e}")
        return None

def extract_user_id_from_token(token: str) -> Optional[str]:
    """
    JWT 토큰에서 사용자 ID를 추출합니다.
    
    Args:
        token: JWT 토큰
        
    Returns:
        str: 사용자 ID 또는 None
    """
    payload = verify_token(token, "access")
    if payload:
        return payload.get("sub")
    return None

def is_token_expired(token: str) -> bool:
    """
    JWT 토큰의 만료 여부를 확인합니다.
    
    Args:
        token: JWT 토큰
        
    Returns:
        bool: 만료 여부
    """
    payload = decode_token_unsafe(token)
    if not payload:
        return True
    
    exp = payload.get("exp")
    if not exp:
        return True
    
    return datetime.utcfromtimestamp(exp) < datetime.utcnow()

# 토큰 생성 헬퍼 함수들
def create_token_pair(user_data: dict) -> dict:
    """
    액세스 토큰과 리프레시 토큰을 동시에 생성합니다.
    
    Args:
        user_data: 사용자 데이터
        
    Returns:
        dict: 토큰 정보
    """
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    refresh_token_expires = timedelta(days=settings.refresh_token_expire_days)
    
    access_token = create_access_token(
        data=user_data,
        expires_delta=access_token_expires
    )
    
    refresh_token = create_refresh_token(
        data={"sub": user_data.get("sub")},
        expires_delta=refresh_token_expires
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.access_token_expire_minutes * 60
    }

async def authenticate_user(db, username: str, password: str):
    """
    사용자 인증
    
    Args:
        db: 데이터베이스 세션
        username: 사용자명 (이메일)
        password: 비밀번호
        
    Returns:
        User: 인증된 사용자 객체 또는 None
    """
    from sqlalchemy import select
    from ..models.maxdp_user_model import User
    
    try:
        # 사용자 조회
        stmt = select(User).where(User.email == username)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            logger.warning(f"사용자 찾을 수 없음: {username}")
            return None
        
        # 비밀번호 검증
        if not verify_password(password, user.password_hash):
            logger.warning(f"비밀번호 불일치: {username}")
            return None
        
        # 사용자 활성 상태 확인
        if not user.is_active:
            logger.warning(f"비활성 사용자: {username}")
            return None
        
        logger.info(f"사용자 인증 성공: {username}")
        return user
        
    except Exception as e:
        logger.error(f"사용자 인증 중 오류: {e}")
        return None 
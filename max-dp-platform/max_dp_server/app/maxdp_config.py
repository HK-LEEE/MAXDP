"""
MAX DP Server 설정 관리 모듈
Pydantic BaseSettings를 사용하여 환경 변수를 관리합니다.
"""
import os
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache
import logging

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    """애플리케이션 설정 관리 클래스"""
    
    # 데이터베이스 설정
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:password@localhost:5432/platform_integration",
        env="DATABASE_URL",
        description="PostgreSQL 데이터베이스 연결 URL"
    )
    
    # 서버 설정
    max_dp_server_port: int = Field(
        default=8001,
        env="MAX_DP_SERVER_PORT",
        description="MAX DP 서버 포트"
    )
    
    # 외부 서비스 설정
    auth_server_url: str = Field(
        default="http://localhost:8000",
        env="AUTH_SERVER_URL",
        description="인증 서버 URL"
    )
    
    token_url_path: str = Field(
        default="/api/v1/auth/login",
        env="TOKEN_URL_PATH",
        description="토큰 발급 URL 경로"
    )
    
    max_platform_login_url: str = Field(
        default="http://localhost:3000/login",
        env="MAX_PLATFORM_LOGIN_URL",
        description="플랫폼 로그인 URL"
    )
    
    # JWT 설정
    jwt_algorithm: str = Field(
        default="HS256",
        env="JWT_ALGORITHM",
        description="JWT 알고리즘"
    )
    
    jwt_secret_key: str = Field(
        default="your-secret-key-here-change-this-in-production",
        env="JWT_SECRET_KEY",
        description="JWT 서명 키"
    )
    
    access_token_expire_minutes: int = Field(
        default=30,
        env="ACCESS_TOKEN_EXPIRE_MINUTES",
        description="액세스 토큰 만료 시간 (분)"
    )
    
    refresh_token_expire_days: int = Field(
        default=30,
        env="REFRESH_TOKEN_EXPIRE_DAYS",
        description="리프레시 토큰 만료 시간 (일)"
    )
    
    # 기타 설정
    debug: bool = Field(
        default=False,
        env="DEBUG",
        description="디버그 모드"
    )
    
    log_level: str = Field(
        default="INFO",
        env="LOG_LEVEL",
        description="로그 레벨"
    )
    
    # Redis 큐 시스템 설정 (CLAUDE.local.md 준수)
    redis_url: str = Field(
        default="redis://localhost:6379/0",
        env="REDIS_URL",
        description="Redis 서버 연결 URL"
    )
    
    redis_queue_max_workers: int = Field(
        default=4,
        env="REDIS_QUEUE_MAX_WORKERS",
        description="Redis 큐 워커 최대 수"
    )
    
    redis_queue_timeout: int = Field(
        default=30,
        env="REDIS_QUEUE_TIMEOUT",
        description="Redis 큐 작업 타임아웃 (초)"
    )
    
    redis_max_retries: int = Field(
        default=3,
        env="REDIS_MAX_RETRIES",
        description="Redis 큐 작업 최대 재시도 횟수"
    )

    # Worker Manager 설정
    max_active_apis: int = Field(
        default=50,
        env="MAX_ACTIVE_APIS",
        description="최대 활성 API Worker 수"
    )
    
    api_inactive_ttl_hours: int = Field(
        default=2,
        env="API_INACTIVE_TTL_HOURS",
        description="비활성 API Worker TTL (시간)"
    )
    
    worker_cleanup_interval_minutes: int = Field(
        default=30,
        env="WORKER_CLEANUP_INTERVAL_MINUTES",
        description="Worker 정리 작업 간격 (분)"
    )
    
    worker_stats_interval_minutes: int = Field(
        default=60,
        env="WORKER_STATS_INTERVAL_MINUTES",
        description="Worker 통계 로깅 간격 (분)"
    )
    
    # 프로젝트 정보
    project_name: str = "MAX DP Server"
    version: str = "0.1.0"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._setup_logging()
    
    def _setup_logging(self):
        """로깅 설정"""
        log_level = getattr(logging, self.log_level.upper(), logging.INFO)
        logging.basicConfig(
            level=log_level,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        if self.debug:
            logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)
            logging.getLogger("sqlalchemy.pool").setLevel(logging.INFO)

@lru_cache()
def get_settings() -> Settings:
    """설정 인스턴스를 반환하는 캐시된 함수"""
    logger.info("Loading application settings...")
    return Settings()

# 전역 설정 인스턴스
settings = get_settings()

# 편의를 위한 별칭들
DATABASE_URL = settings.database_url
SECRET_KEY = settings.jwt_secret_key
ALGORITHM = settings.jwt_algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes
REFRESH_TOKEN_EXPIRE_DAYS = settings.refresh_token_expire_days
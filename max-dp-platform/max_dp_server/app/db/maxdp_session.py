"""
MAX DP 데이터베이스 세션 관리 모듈
비동기 SQLAlchemy를 사용하여 PostgreSQL 데이터베이스 연결을 관리합니다.
"""
import logging
from typing import AsyncGenerator, Optional
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import MetaData, inspect, text
from contextlib import asynccontextmanager

from ..maxdp_config import settings

logger = logging.getLogger(__name__)

# 메타데이터와 베이스 클래스 정의
metadata = MetaData()
Base = declarative_base(metadata=metadata)

class DatabaseManager:
    """데이터베이스 연결 관리 클래스"""
    
    def __init__(self):
        self.engine = None
        self.async_session_factory = None
        self._is_initialized = False
        
    async def initialize(self):
        """데이터베이스 연결 초기화"""
        if self._is_initialized:
            logger.warning("Database already initialized")
            return
            
        try:
            logger.info(f"Initializing database connection to: {settings.database_url}")
            
            # 비동기 엔진 생성
            self.engine = create_async_engine(
                settings.database_url,
                echo=settings.debug,  # SQL 쿼리 로깅
                future=True,
                pool_size=10,
                max_overflow=20,
                pool_pre_ping=True,  # 연결 상태 확인
                pool_recycle=3600,   # 1시간마다 연결 재활용
            )
            
            # 비동기 세션 팩토리 생성
            self.async_session_factory = async_sessionmaker(
                bind=self.engine,
                class_=AsyncSession,
                expire_on_commit=False,
                autoflush=True,
                autocommit=False
            )
            
            # 연결 테스트
            await self._test_connection()
            
            self._is_initialized = True
            logger.info("Database connection initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize database connection: {e}")
            raise
    
    async def _test_connection(self):
        """데이터베이스 연결 테스트"""
        try:
            async with self.engine.begin() as conn:
                result = await conn.execute(text("SELECT 1"))
                row = result.fetchone()
                if row and row[0] == 1:
                    logger.info("Database connection test successful")
                else:
                    raise Exception("Connection test failed: unexpected result")
        except Exception as e:
            logger.error(f"Database connection test failed: {e}")
            raise
    
    async def close(self):
        """데이터베이스 연결 종료"""
        if self.engine:
            await self.engine.dispose()
            logger.info("Database connection closed")
    
    def get_session_factory(self):
        """세션 팩토리 반환"""
        if not self._is_initialized:
            raise RuntimeError("Database not initialized. Call initialize() first.")
        return self.async_session_factory
    
    @asynccontextmanager
    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """컨텍스트 매니저로 세션 생성"""
        if not self._is_initialized:
            await self.initialize()
            
        session = self.async_session_factory()
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Session error, rolled back: {e}")
            raise
        finally:
            await session.close()

# 전역 데이터베이스 매니저 인스턴스
db_manager = DatabaseManager()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI 의존성으로 사용할 데이터베이스 세션 생성 함수
    """
    if not db_manager._is_initialized:
        await db_manager.initialize()
    
    session = db_manager.async_session_factory()
    try:
        yield session
        await session.commit()
    except Exception as e:
        await session.rollback()
        logger.error(f"Database session error: {e}")
        raise
    finally:
        await session.close()

async def init_db():
    """애플리케이션 시작 시 데이터베이스 초기화"""
    await db_manager.initialize()

async def close_db():
    """애플리케이션 종료 시 데이터베이스 연결 종료"""
    await db_manager.close()

# 데이터베이스 헬퍼 함수들
async def check_database_connection() -> bool:
    """데이터베이스 연결 상태 확인"""
    try:
        async with db_manager.get_session() as session:
            result = await session.execute(text("SELECT 1"))
            return result.fetchone() is not None
    except Exception as e:
        logger.error(f"Database connection check failed: {e}")
        return False

async def get_database_info() -> dict:
    """데이터베이스 정보 조회"""
    try:
        async with db_manager.get_session() as session:
            # PostgreSQL 버전 확인
            result = await session.execute(text("SELECT version()"))
            version = result.fetchone()[0]
            
            # 현재 데이터베이스명 확인
            result = await session.execute(text("SELECT current_database()"))
            database_name = result.fetchone()[0]
            
            # 현재 사용자 확인
            result = await session.execute(text("SELECT current_user"))
            current_user = result.fetchone()[0]
            
            return {
                "version": version,
                "database_name": database_name,
                "current_user": current_user,
                "connection_url": settings.database_url.split('@')[1] if '@' in settings.database_url else "N/A"
            }
    except Exception as e:
        logger.error(f"Failed to get database info: {e}")
        return {"error": str(e)} 
"""
MAX DP Server 메인 애플리케이션
FastAPI 기반의 MAX DP 데이터 파이프라인 플랫폼 서버입니다.
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import uvicorn

# 프로젝트 내 모듈 import
from .maxdp_config import settings
from .db.maxdp_session import init_db, close_db, check_database_connection, get_database_info
from .api.api_v1.maxdp_api import api_router
from .api.api_v1.endpoints.maxdp_execute_router import router as execute_router
from .api.api_v1.endpoints.maxdp_auth_router import router as auth_router
from .core.maxdp_worker_manager import initialize_worker_manager, shutdown_worker_manager
from .core.nodes.maxdp_node_factory import initialize_node_registry

# 로거 설정
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    애플리케이션 생명주기 관리
    시작 시 데이터베이스 초기화, 종료 시 리소스 정리
    """
    # 시작 시 초기화
    logger.info("Starting MAX DP Server...")
    
    try:
        # 데이터베이스 연결 초기화
        await init_db()
        logger.info("Database connection initialized")
        
        # 데이터베이스 연결 테스트
        if await check_database_connection():
            db_info = await get_database_info()
            logger.info(f"Database connected successfully: {db_info.get('database_name', 'N/A')}")
        else:
            logger.error("Database connection test failed")
        
        # 노드 레지스트리 초기화
        initialize_node_registry()
        logger.info("Node registry initialized")
        
        # Worker Manager 초기화
        await initialize_worker_manager()
        logger.info("Worker Manager initialized")
            
    except Exception as e:
        logger.error(f"Failed to initialize application: {e}")
        raise
    
    yield
    
    # 종료 시 정리
    logger.info("Shutting down MAX DP Server...")
    try:
        # Worker Manager 종료
        await shutdown_worker_manager()
        logger.info("Worker Manager shutdown completed")
        
        # 데이터베이스 연결 종료
        await close_db()
        logger.info("Database connections closed")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")

def create_application() -> FastAPI:
    """FastAPI 애플리케이션 인스턴스를 생성하고 설정합니다."""
    
    app = FastAPI(
        title=settings.project_name,
        version=settings.version,
        description="MAX DP - 데이터 파이프라인 관리 플랫폼",
        debug=settings.debug,
        lifespan=lifespan,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
    )
    
    # CORS 설정
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.debug else [
            "http://localhost:3000",
            "http://localhost:8000",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:8000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Trusted Host 미들웨어 (프로덕션 환경에서)
    if not settings.debug:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=["localhost", "127.0.0.1", "*.maxdp.com"]
        )
    
    # 라우터 등록
    app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
    app.include_router(api_router, prefix="/api/v1/maxdp")
    
    # 공개 실행 엔드포인트 등록 (prefix 없음 - 루트에서 직접 접근)
    app.include_router(execute_router, prefix="/execute", tags=["execution"])
    
    return app

# FastAPI 애플리케이션 인스턴스 생성
app = create_application()

# 전역 예외 처리기
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """HTTP 예외 처리기"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "message": exc.detail,
                "status_code": exc.status_code,
                "path": str(request.url.path)
            }
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """일반 예외 처리기"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "message": "Internal server error" if not settings.debug else str(exc),
                "status_code": 500,
                "path": str(request.url.path)
            }
        }
    )

# 기본 라우트들
@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {
        "message": "MAX DP Server",
        "version": settings.version,
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """헬스체크 엔드포인트"""
    try:
        db_status = await check_database_connection()
        return {
            "status": "healthy" if db_status else "unhealthy",
            "database": "connected" if db_status else "disconnected",
            "version": settings.version
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "database": "error",
            "version": settings.version,
            "error": str(e) if settings.debug else "Health check failed"
        }

@app.get("/info")
async def server_info():
    """서버 정보 엔드포인트"""
    try:
        db_info = await get_database_info()
        return {
            "server": {
                "name": settings.project_name,
                "version": settings.version,
                "debug": settings.debug,
                "port": settings.max_dp_server_port
            },
            "database": db_info if db_info else {"status": "error"}
        }
    except Exception as e:
        logger.error(f"Info endpoint failed: {e}")
        return {
            "server": {
                "name": settings.project_name,
                "version": settings.version,
                "debug": settings.debug,
                "port": settings.max_dp_server_port
            },
            "database": {"status": "error", "message": str(e) if settings.debug else "Database error"}
        }

def main():
    """메인 실행 함수"""
    logger.info("Starting MAX DP Server...")
    
    uvicorn.run(
        "app.maxdp_main:app",
        host="0.0.0.0",
        port=settings.max_dp_server_port,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
        access_log=settings.debug,
    )

if __name__ == "__main__":
    main() 
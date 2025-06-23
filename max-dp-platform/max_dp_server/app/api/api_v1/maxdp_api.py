"""
MAX DP API v1 메인 라우터
모든 API 엔드포인트를 통합하는 메인 라우터입니다.
"""
from fastapi import APIRouter

# 개별 라우터들 import (아직 생성하지 않은 것들은 주석 처리)
# from .endpoints.maxdp_auth_router import router as auth_router
from .endpoints.maxdp_users_router import router as users_router
from .endpoints.maxdp_workspaces_router import router as workspaces_router
from .endpoints.maxdp_flows_router import router as flows_router
from .endpoints.maxdp_database_router import router as database_router

# 메인 API 라우터 생성
api_router = APIRouter()

# 기본 API 정보 엔드포인트
@api_router.get("/")
async def api_info():
    """API 정보를 반환합니다."""
    return {
        "name": "MAX DP API",
        "version": "v1",
        "description": "MAX DP 데이터 파이프라인 관리 플랫폼 API",
        "endpoints": {
            "auth": "/auth",
            "users": "/users", 
            "workspaces": "/workspaces",
            "flows": "/flows",
            "database": "/database"
        }
    }

@api_router.get("/status")
async def api_status():
    """API 상태를 반환합니다."""
    return {
        "status": "operational",
        "version": "v1",
        "services": {
            "authentication": "available",
            "workspace_management": "available", 
            "flow_management": "available",
            "database_management": "available"
        }
    }

# 라우터 등록 (개별 라우터가 생성되면 주석 해제)
# api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users_router, prefix="/users", tags=["Users"])
api_router.include_router(workspaces_router, prefix="/workspaces", tags=["Workspaces"])
api_router.include_router(flows_router, prefix="/flows", tags=["Flows"])
api_router.include_router(database_router, prefix="/database", tags=["Database"]) 
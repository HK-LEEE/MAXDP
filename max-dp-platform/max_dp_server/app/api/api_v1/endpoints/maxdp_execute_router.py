"""
MAX DP 공개 실행 엔드포인트

발행된 API들을 실행하는 공개 엔드포인트를 제공합니다.
Worker-Manager 패턴을 사용하여 효율적인 자원 관리를 수행합니다.
"""

import logging
import json
import time
from typing import Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, Request, Response, BackgroundTasks, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ....db.maxdp_session import get_db
from ....models.maxdp_flow_model import DPA_PUBLISHED_APIS
from ....core.maxdp_worker_manager import WorkerManager
from ....core.maxdp_flow_executor import FlowExecutionError
from ....dependencies.maxdp_auth import get_current_user_optional
from ....maxdp_config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()

class ExecutionLogger:
    """실행 로그를 관리하는 클래스"""
    
    @staticmethod
    async def log_execution_start(api_endpoint: str, request_data: Dict[str, Any], 
                                db_session: AsyncSession, user_id: Optional[str] = None):
        """실행 시작 로그"""
        log_data = {
            'api_endpoint': api_endpoint,
            'user_id': user_id,
            'start_time': datetime.utcnow().isoformat(),
            'request_size': len(json.dumps(request_data)),
            'ip_address': request_data.get('_client_ip', 'unknown')
        }
        
        logger.info(f"API execution started: {api_endpoint}", extra=log_data)
        
        # 실제 DB 로깅 로직은 여기에 구현
        # 예: DPA_EXECUTION_LOGS 테이블에 기록
    
    @staticmethod
    async def log_execution_end(api_endpoint: str, execution_time: float, 
                              result_size: int, success: bool, 
                              error_message: Optional[str] = None,
                              db_session: Optional[AsyncSession] = None):
        """실행 완료 로그"""
        log_data = {
            'api_endpoint': api_endpoint,
            'execution_time': execution_time,
            'result_size': result_size,
            'success': success,
            'error_message': error_message,
            'end_time': datetime.utcnow().isoformat()
        }
        
        if success:
            logger.info(f"API execution completed: {api_endpoint}", extra=log_data)
        else:
            logger.error(f"API execution failed: {api_endpoint}", extra=log_data)

@router.get("/health")
async def health_check():
    """실행 엔드포인트 헬스체크"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@router.get("/worker-stats")
async def get_worker_stats(current_user: Optional[Any] = Depends(get_current_user_optional)):
    """Worker 통계 정보 조회 (관리자용)"""
    # 관리자 권한 확인
    if not current_user or not getattr(current_user, 'is_admin', False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    manager = WorkerManager.get_instance()
    stats = manager.get_manager_stats()
    workers_info = manager.get_all_workers_info()
    
    return {
        "manager_stats": stats,
        "workers": workers_info,
        "timestamp": datetime.utcnow().isoformat()
    }

@router.post("/worker/{api_id}/reload")
async def reload_worker(api_id: str, 
                       current_user: Optional[Any] = Depends(get_current_user_optional),
                       db_session: AsyncSession = Depends(get_db)):
    """특정 Worker 재로드 (관리자용)"""
    if not current_user or not getattr(current_user, 'is_admin', False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    manager = WorkerManager.get_instance()
    
    # 기존 Worker 제거
    removed = await manager.force_remove_worker(api_id)
    
    if removed:
        logger.info(f"Worker {api_id} reloaded by admin {current_user.id}")
        return {"message": f"Worker {api_id} reloaded successfully"}
    else:
        return {"message": f"Worker {api_id} was not active"}

@router.api_route("/{api_endpoint:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def run_published_api(
    api_endpoint: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db_session: AsyncSession = Depends(get_db),
    current_user: Optional[Any] = Depends(get_current_user_optional)
):
    """
    발행된 API 실행
    
    Args:
        api_endpoint: API 엔드포인트 경로
        request: HTTP 요청 객체
        background_tasks: 백그라운드 작업
        db_session: 데이터베이스 세션
        current_user: 현재 사용자 (선택적)
    
    Returns:
        JSONResponse: API 실행 결과
    """
    start_time = time.time()
    execution_id = f"exec_{int(start_time * 1000000)}"
    
    try:
        # API 정보 조회
        published_api = await _get_published_api(api_endpoint, db_session)
        
        if not published_api:
            raise HTTPException(status_code=404, detail=f"API endpoint not found: {api_endpoint}")
        
        # API 활성화 상태 확인
        if not published_api.is_active:
            raise HTTPException(status_code=403, detail="API is currently inactive")
        
        # 요청 데이터 파싱
        request_data = await _parse_request_data(request)
        
        # 사용자 컨텍스트 구성
        user_context = _build_user_context(current_user, request)
        
        # 백그라운드에서 실행 시작 로그 기록
        background_tasks.add_task(
            ExecutionLogger.log_execution_start,
            api_endpoint, request_data, db_session, 
            getattr(current_user, 'id', None) if current_user else None
        )
        
        # Worker Manager에서 실행기 가져오기
        manager = WorkerManager.get_instance()
        executor = await manager.get_or_create_worker(published_api, db_session, user_context)
        
        # API 실행
        try:
            result = await executor.execute(
                input_data=request_data,
                execution_id=execution_id
            )
            
            # 결과 처리 및 변환
            response_data = _format_execution_result(result, published_api)
            execution_time = time.time() - start_time
            
            # 백그라운드에서 성공 로그 기록
            background_tasks.add_task(
                ExecutionLogger.log_execution_end,
                api_endpoint, execution_time, len(json.dumps(response_data)), True
            )
            
            # 응답 헤더 설정
            headers = {
                "X-Execution-ID": execution_id,
                "X-Execution-Time": f"{execution_time:.3f}",
                "X-API-Version": str(published_api.version),
                "Content-Type": "application/json"
            }
            
            logger.info(f"API {api_endpoint} executed successfully in {execution_time:.3f}s")
            
            return JSONResponse(content=response_data, headers=headers)
            
        except FlowExecutionError as e:
            execution_time = time.time() - start_time
            error_message = str(e)
            
            # 백그라운드에서 실패 로그 기록
            background_tasks.add_task(
                ExecutionLogger.log_execution_end,
                api_endpoint, execution_time, 0, False, error_message
            )
            
            logger.error(f"Flow execution failed for {api_endpoint}: {error_message}")
            
            raise HTTPException(
                status_code=500, 
                detail={
                    "error": "Flow execution failed",
                    "message": error_message,
                    "execution_id": execution_id,
                    "execution_time": execution_time
                }
            )
            
    except HTTPException:
        # FastAPI HTTPException은 그대로 재발생
        raise
        
    except Exception as e:
        execution_time = time.time() - start_time
        error_message = str(e)
        
        # 백그라운드에서 실패 로그 기록
        background_tasks.add_task(
            ExecutionLogger.log_execution_end,
            api_endpoint, execution_time, 0, False, error_message
        )
        
        logger.error(f"Unexpected error in API {api_endpoint}: {error_message}", exc_info=True)
        
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal server error",
                "message": "An unexpected error occurred",
                "execution_id": execution_id,
                "execution_time": execution_time
            }
        )

async def _get_published_api(api_endpoint: str, db_session: AsyncSession) -> Optional[Any]:
    """발행된 API 정보 조회"""
    try:
        # API 엔드포인트로 DPA_PUBLISHED_APIS 테이블에서 조회
        stmt = select(DPA_PUBLISHED_APIS).where(
            DPA_PUBLISHED_APIS.api_endpoint == api_endpoint
        )
        result = await db_session.execute(stmt)
        published_api = result.scalar_one_or_none()
        
        return published_api
        
    except Exception as e:
        logger.error(f"Error querying published API {api_endpoint}: {e}")
        return None

async def _parse_request_data(request: Request) -> Dict[str, Any]:
    """HTTP 요청에서 데이터 파싱"""
    try:
        request_data = {}
        
        # Query parameters 추가
        request_data.update(dict(request.query_params))
        
        # Path parameters 추가 (FastAPI에서 자동 처리됨)
        if hasattr(request, 'path_params'):
            request_data.update(request.path_params)
        
        # Request body 파싱
        if request.method in ["POST", "PUT", "PATCH"]:
            content_type = request.headers.get("content-type", "")
            
            if "application/json" in content_type:
                try:
                    body_data = await request.json()
                    if isinstance(body_data, dict):
                        request_data.update(body_data)
                    else:
                        request_data['body'] = body_data
                except Exception as e:
                    logger.warning(f"Failed to parse JSON body: {e}")
                    
            elif "application/x-www-form-urlencoded" in content_type:
                form_data = await request.form()
                request_data.update(dict(form_data))
                
            elif "multipart/form-data" in content_type:
                form_data = await request.form()
                # 파일 업로드 처리 등 추가 구현 필요
                request_data.update(dict(form_data))
        
        # 메타데이터 추가
        request_data['_metadata'] = {
            'method': request.method,
            'client_ip': request.client.host if request.client else 'unknown',
            'user_agent': request.headers.get('user-agent', 'unknown'),
            'timestamp': datetime.utcnow().isoformat()
        }
        
        return request_data
        
    except Exception as e:
        logger.error(f"Error parsing request data: {e}")
        return {}

def _build_user_context(current_user: Optional[Any], request: Request) -> Dict[str, Any]:
    """사용자 컨텍스트 구성"""
    context = {
        'request_id': f"req_{int(time.time() * 1000000)}",
        'timestamp': datetime.utcnow().isoformat(),
        'client_ip': request.client.host if request.client else 'unknown',
        'user_agent': request.headers.get('user-agent', 'unknown')
    }
    
    if current_user:
        context.update({
            'user_id': getattr(current_user, 'id', None),
            'username': getattr(current_user, 'username', None),
            'workspace_id': getattr(current_user, 'workspace_id', None),
            'is_authenticated': True
        })
    else:
        context['is_authenticated'] = False
    
    return context

def _format_execution_result(result: Any, published_api: Any) -> Dict[str, Any]:
    """실행 결과 포맷팅"""
    try:
        # DataFrame을 JSON으로 변환
        if hasattr(result, 'to_dict'):  # pandas DataFrame
            formatted_result = {
                'data': result.to_dict(orient='records'),
                'shape': result.shape,
                'columns': list(result.columns),
                'dtypes': result.dtypes.astype(str).to_dict()
            }
        elif isinstance(result, dict):
            formatted_result = result
        elif isinstance(result, list):
            formatted_result = {'data': result}
        else:
            formatted_result = {'result': str(result)}
        
        # API 메타데이터 추가
        response = {
            'success': True,
            'api_info': {
                'endpoint': published_api.api_endpoint,
                'version': published_api.version,
                'name': published_api.api_name
            },
            'execution_timestamp': datetime.utcnow().isoformat(),
            'result': formatted_result
        }
        
        return response
        
    except Exception as e:
        logger.error(f"Error formatting execution result: {e}")
        return {
            'success': False,
            'error': 'Result formatting failed',
            'message': str(e)
        } 
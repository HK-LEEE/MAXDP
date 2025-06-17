"""
MAX DP Worker Manager

API 요청 시 동적으로 실행 환경(Worker)을 활성화/비활성화하여 
시스템 자원을 효율적으로 관리하는 Worker-Manager 패턴을 구현합니다.
"""

import logging
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from threading import Lock
from sqlalchemy.ext.asyncio import AsyncSession
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from .maxdp_flow_executor import FlowExecutor, FlowExecutionError
from ..maxdp_config import get_settings

logger = logging.getLogger(__name__)

class WorkerInfo:
    """Worker 정보를 담는 클래스"""
    
    def __init__(self, executor: FlowExecutor, created_at: datetime):
        self.executor = executor
        self.created_at = created_at
        self.last_used = created_at
        self.execution_count = 0
        self.total_execution_time = 0.0
    
    def update_usage(self, execution_time: float = 0.0):
        """사용 정보 업데이트"""
        self.last_used = datetime.utcnow()
        self.execution_count += 1
        self.total_execution_time += execution_time
    
    def get_stats(self) -> Dict[str, Any]:
        """Worker 통계 정보 반환"""
        return {
            'created_at': self.created_at.isoformat(),
            'last_used': self.last_used.isoformat(),
            'execution_count': self.execution_count,
            'total_execution_time': self.total_execution_time,
            'avg_execution_time': self.total_execution_time / max(self.execution_count, 1)
        }

class WorkerManager:
    """
    Worker 생명주기를 관리하는 싱글턴 매니저 클래스
    
    API별로 FlowExecutor 인스턴스를 캐시하고, 사용 빈도에 따라
    자동으로 생성/제거하여 메모리를 효율적으로 관리합니다.
    """
    
    _instance: Optional['WorkerManager'] = None
    _lock = Lock()
    
    def __init__(self):
        if WorkerManager._instance is not None:
            raise RuntimeError("WorkerManager is a singleton. Use get_instance() instead.")
        
        self.active_workers: Dict[str, WorkerInfo] = {}
        self.worker_lock = Lock()
        self.scheduler: Optional[AsyncIOScheduler] = None
        self.settings = get_settings()
        
        logger.info("WorkerManager initialized")
    
    @classmethod
    def get_instance(cls) -> 'WorkerManager':
        """싱글턴 인스턴스 반환"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance
    
    async def start_scheduler(self):
        """백그라운드 스케줄러 시작"""
        if self.scheduler is None:
            self.scheduler = AsyncIOScheduler()
            
            # 주기적 정리 작업 등록
            cleanup_interval = getattr(self.settings, 'WORKER_CLEANUP_INTERVAL_MINUTES', 30)
            self.scheduler.add_job(
                self.cleanup_inactive_workers,
                trigger=IntervalTrigger(minutes=cleanup_interval),
                id='cleanup_workers',
                max_instances=1,
                replace_existing=True
            )
            
            # 통계 로깅 작업 등록
            stats_interval = getattr(self.settings, 'WORKER_STATS_INTERVAL_MINUTES', 60)
            self.scheduler.add_job(
                self.log_worker_stats,
                trigger=IntervalTrigger(minutes=stats_interval),
                id='log_stats',
                max_instances=1,
                replace_existing=True
            )
            
            self.scheduler.start()
            logger.info("Worker cleanup scheduler started")
    
    async def stop_scheduler(self):
        """스케줄러 중지"""
        if self.scheduler:
            self.scheduler.shutdown()
            self.scheduler = None
            logger.info("Worker cleanup scheduler stopped")
    
    async def get_or_create_worker(self, 
                                  published_api: Any,  # DPA_PUBLISHED_APIS 모델
                                  db_session: AsyncSession, 
                                  user_context: Dict[str, Any]) -> FlowExecutor:
        """
        Worker 조회 또는 생성
        
        Args:
            published_api: 발행된 API 정보
            db_session: 데이터베이스 세션
            user_context: 사용자 컨텍스트
            
        Returns:
            FlowExecutor: 활성화된 Flow 실행기
        """
        api_id = str(published_api.id)
        
        with self.worker_lock:
            # 기존 Worker 확인
            if api_id in self.active_workers:
                worker_info = self.active_workers[api_id]
                worker_info.update_usage()
                
                logger.debug(f"Reusing existing worker for API {api_id}")
                return worker_info.executor
            
            # 새 Worker 생성 전 용량 확인
            await self._ensure_capacity()
            
            # 새 Worker 생성
            worker_info = await self._create_new_worker(published_api, db_session, user_context)
            self.active_workers[api_id] = worker_info
            
            logger.info(f"Created new worker for API {api_id}")
            return worker_info.executor
    
    async def _ensure_capacity(self):
        """Worker 용량 확보"""
        max_workers = getattr(self.settings, 'MAX_ACTIVE_APIS', 50)
        
        if len(self.active_workers) >= max_workers:
            # 가장 오래된 Worker 제거
            oldest_api_id = min(
                self.active_workers.keys(),
                key=lambda api_id: self.active_workers[api_id].last_used
            )
            
            removed_worker = self.active_workers.pop(oldest_api_id)
            logger.info(f"Removed oldest worker for API {oldest_api_id} to ensure capacity")
            logger.debug(f"Removed worker stats: {removed_worker.get_stats()}")
    
    async def _create_new_worker(self, 
                                published_api: Any, 
                                db_session: AsyncSession, 
                                user_context: Dict[str, Any]) -> WorkerInfo:
        """새 Worker 생성"""
        try:
            # Flow JSON 조회
            flow_json = published_api.flow_definition
            
            if not flow_json:
                raise FlowExecutionError(f"No flow definition found for API {published_api.id}")
            
            # FlowExecutor 생성
            executor = FlowExecutor(
                flow_json=flow_json,
                db_session=db_session,
                user_context=user_context
            )
            
            # Worker 정보 생성
            worker_info = WorkerInfo(executor, datetime.utcnow())
            
            return worker_info
            
        except Exception as e:
            logger.error(f"Failed to create worker for API {published_api.id}: {e}")
            raise
    
    async def cleanup_inactive_workers(self):
        """비활성 Worker 정리"""
        try:
            current_time = datetime.utcnow()
            ttl_hours = getattr(self.settings, 'API_INACTIVE_TTL_HOURS', 2)
            ttl_delta = timedelta(hours=ttl_hours)
            
            workers_to_remove = []
            
            with self.worker_lock:
                for api_id, worker_info in self.active_workers.items():
                    if current_time - worker_info.last_used > ttl_delta:
                        workers_to_remove.append(api_id)
                
                # 비활성 Worker들 제거
                for api_id in workers_to_remove:
                    removed_worker = self.active_workers.pop(api_id)
                    logger.info(f"Cleaned up inactive worker for API {api_id}")
                    logger.debug(f"Cleaned worker stats: {removed_worker.get_stats()}")
            
            if workers_to_remove:
                logger.info(f"Cleanup completed: removed {len(workers_to_remove)} inactive workers")
            else:
                logger.debug("Cleanup completed: no inactive workers found")
                
        except Exception as e:
            logger.error(f"Error during worker cleanup: {e}")
    
    async def log_worker_stats(self):
        """Worker 통계 로깅"""
        try:
            with self.worker_lock:
                total_workers = len(self.active_workers)
                
                if total_workers == 0:
                    logger.info("Worker stats: No active workers")
                    return
                
                total_executions = sum(w.execution_count for w in self.active_workers.values())
                total_execution_time = sum(w.total_execution_time for w in self.active_workers.values())
                avg_execution_time = total_execution_time / max(total_executions, 1)
                
                current_time = datetime.utcnow()
                recent_workers = sum(
                    1 for w in self.active_workers.values()
                    if current_time - w.last_used < timedelta(hours=1)
                )
                
                logger.info(
                    f"Worker stats: {total_workers} active workers, "
                    f"{recent_workers} used in last hour, "
                    f"{total_executions} total executions, "
                    f"{avg_execution_time:.3f}s avg execution time"
                )
                
        except Exception as e:
            logger.error(f"Error logging worker stats: {e}")
    
    def get_worker_info(self, api_id: str) -> Optional[Dict[str, Any]]:
        """특정 API의 Worker 정보 반환"""
        with self.worker_lock:
            if api_id in self.active_workers:
                worker_info = self.active_workers[api_id]
                return {
                    'api_id': api_id,
                    'stats': worker_info.get_stats(),
                    'flow_info': worker_info.executor.get_flow_info()
                }
        return None
    
    def get_all_workers_info(self) -> Dict[str, Dict[str, Any]]:
        """모든 활성 Worker 정보 반환"""
        with self.worker_lock:
            return {
                api_id: {
                    'stats': worker_info.get_stats(),
                    'flow_info': worker_info.executor.get_flow_info()
                }
                for api_id, worker_info in self.active_workers.items()
            }
    
    async def force_remove_worker(self, api_id: str) -> bool:
        """특정 Worker 강제 제거"""
        with self.worker_lock:
            if api_id in self.active_workers:
                removed_worker = self.active_workers.pop(api_id)
                logger.info(f"Force removed worker for API {api_id}")
                logger.debug(f"Removed worker stats: {removed_worker.get_stats()}")
                return True
        return False
    
    async def clear_all_workers(self):
        """모든 Worker 제거"""
        with self.worker_lock:
            count = len(self.active_workers)
            self.active_workers.clear()
            logger.info(f"Cleared all {count} workers")
    
    def get_manager_stats(self) -> Dict[str, Any]:
        """Manager 전체 통계 반환"""
        with self.worker_lock:
            current_time = datetime.utcnow()
            
            stats = {
                'total_workers': len(self.active_workers),
                'active_in_last_hour': sum(
                    1 for w in self.active_workers.values()
                    if current_time - w.last_used < timedelta(hours=1)
                ),
                'total_executions': sum(w.execution_count for w in self.active_workers.values()),
                'total_execution_time': sum(w.total_execution_time for w in self.active_workers.values()),
                'memory_usage_estimate': len(self.active_workers) * 50,  # MB 추정치
                'oldest_worker_age': None,
                'newest_worker_age': None
            }
            
            if self.active_workers:
                oldest_time = min(w.created_at for w in self.active_workers.values())
                newest_time = max(w.created_at for w in self.active_workers.values())
                
                stats['oldest_worker_age'] = (current_time - oldest_time).total_seconds()
                stats['newest_worker_age'] = (current_time - newest_time).total_seconds()
            
            return stats

# 전역 편의 함수들
async def get_worker_manager() -> WorkerManager:
    """Worker Manager 인스턴스 반환"""
    return WorkerManager.get_instance()

async def initialize_worker_manager():
    """Worker Manager 초기화"""
    manager = WorkerManager.get_instance()
    await manager.start_scheduler()
    logger.info("Worker Manager initialized and scheduler started")

async def shutdown_worker_manager():
    """Worker Manager 종료"""
    manager = WorkerManager.get_instance()
    await manager.stop_scheduler()
    await manager.clear_all_workers()
    logger.info("Worker Manager shutdown completed") 
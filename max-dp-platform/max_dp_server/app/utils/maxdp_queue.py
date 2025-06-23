"""
MAX DP Redis 기반 큐 시스템
Windows 환경에서 Redis를 활용한 비동기 작업 처리를 제공합니다.
"""

import json
import logging
import asyncio
from typing import Dict, Any, Optional, Callable, List
from datetime import datetime, timedelta
import redis.asyncio as redis
from pydantic import BaseModel, Field

from ..maxdp_config import settings

logger = logging.getLogger(__name__)

class QueueTask(BaseModel):
    """큐 작업 모델"""
    task_id: str = Field(..., description="작업 고유 ID")
    task_type: str = Field(..., description="작업 타입")
    payload: Dict[str, Any] = Field(default_factory=dict, description="작업 데이터")
    priority: int = Field(default=0, description="우선순위 (높을수록 먼저 처리)")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    retry_count: int = Field(default=0, description="재시도 횟수")
    max_retries: int = Field(default=3, description="최대 재시도 횟수")
    
class MaxDPQueueManager:
    """
    Redis 기반 큐 매니저
    
    CLAUDE.local.md 가이드라인에 따라 Redis + Python queue 모듈을 활용한
    간단한 메시지 큐 시스템을 구현합니다.
    """
    
    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        """
        큐 매니저 초기화
        
        Args:
            redis_url: Redis 연결 URL
        """
        self.redis_url = redis_url
        self.redis_client: Optional[redis.Redis] = None
        self.task_handlers: Dict[str, Callable] = {}
        self.is_running = False
        
        # 큐 이름 설정
        self.default_queue = "maxdp:default"
        self.priority_queue = "maxdp:priority"
        self.failed_queue = "maxdp:failed"
        self.processing_queue = "maxdp:processing"
        
    async def initialize(self) -> bool:
        """
        Redis 연결 초기화
        
        Returns:
            bool: 초기화 성공 여부
        """
        try:
            self.redis_client = redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            
            # 연결 테스트
            await self.redis_client.ping()
            logger.info("Redis queue manager initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize Redis queue manager: {e}")
            return False
    
    async def close(self):
        """Redis 연결 종료"""
        if self.redis_client:
            await self.redis_client.close()
            logger.info("Redis queue manager closed")
    
    def register_handler(self, task_type: str, handler: Callable):
        """
        작업 타입별 핸들러 등록
        
        Args:
            task_type: 작업 타입
            handler: 처리 함수
        """
        self.task_handlers[task_type] = handler
        logger.info(f"Handler registered for task type: {task_type}")
    
    async def enqueue(self, task: QueueTask, use_priority: bool = False) -> bool:
        """
        작업을 큐에 추가
        
        Args:
            task: 큐 작업
            use_priority: 우선순위 큐 사용 여부
            
        Returns:
            bool: 큐 추가 성공 여부
        """
        if not self.redis_client:
            logger.error("Redis client not initialized")
            return False
        
        try:
            queue_name = self.priority_queue if use_priority else self.default_queue
            task_data = task.model_dump_json()
            
            if use_priority:
                # 우선순위 큐는 sorted set 사용
                await self.redis_client.zadd(queue_name, {task_data: task.priority})
            else:
                # 일반 큐는 list 사용
                await self.redis_client.lpush(queue_name, task_data)
            
            logger.info(f"Task {task.task_id} enqueued to {queue_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to enqueue task {task.task_id}: {e}")
            return False
    
    async def dequeue(self, timeout: int = 10) -> Optional[QueueTask]:
        """
        큐에서 작업 가져오기
        
        Args:
            timeout: 대기 시간 (초)
            
        Returns:
            QueueTask: 가져온 작업 또는 None
        """
        if not self.redis_client:
            logger.error("Redis client not initialized")
            return None
        
        try:
            # 우선순위 큐를 먼저 확인
            priority_task = await self.redis_client.zrevrange(
                self.priority_queue, 0, 0, withscores=True
            )
            
            if priority_task:
                task_data, score = priority_task[0]
                await self.redis_client.zrem(self.priority_queue, task_data)
                return QueueTask.model_validate_json(task_data)
            
            # 일반 큐에서 블로킹 방식으로 가져오기
            result = await self.redis_client.brpop(self.default_queue, timeout=timeout)
            if result:
                _, task_data = result
                return QueueTask.model_validate_json(task_data)
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to dequeue task: {e}")
            return None
    
    async def process_task(self, task: QueueTask) -> bool:
        """
        작업 처리
        
        Args:
            task: 처리할 작업
            
        Returns:
            bool: 처리 성공 여부
        """
        if task.task_type not in self.task_handlers:
            logger.error(f"No handler found for task type: {task.task_type}")
            await self._move_to_failed_queue(task, "No handler found")
            return False
        
        try:
            # 처리 중 큐로 이동
            await self._add_to_processing_queue(task)
            
            # 핸들러 실행
            handler = self.task_handlers[task.task_type]
            result = await handler(task)
            
            # 처리 완료 시 처리 중 큐에서 제거
            await self._remove_from_processing_queue(task)
            
            logger.info(f"Task {task.task_id} processed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to process task {task.task_id}: {e}")
            
            # 재시도 로직
            if task.retry_count < task.max_retries:
                task.retry_count += 1
                await self.enqueue(task)
                logger.info(f"Task {task.task_id} requeued for retry ({task.retry_count}/{task.max_retries})")
            else:
                await self._move_to_failed_queue(task, str(e))
                logger.error(f"Task {task.task_id} failed after {task.max_retries} retries")
            
            await self._remove_from_processing_queue(task)
            return False
    
    async def start_worker(self):
        """워커 시작"""
        if self.is_running:
            logger.warning("Worker is already running")
            return
        
        self.is_running = True
        logger.info("Queue worker started")
        
        while self.is_running:
            try:
                task = await self.dequeue(timeout=5)
                if task:
                    await self.process_task(task)
            except asyncio.CancelledError:
                logger.info("Worker cancelled")
                break
            except Exception as e:
                logger.error(f"Worker error: {e}")
                await asyncio.sleep(1)
    
    async def stop_worker(self):
        """워커 중지"""
        self.is_running = False
        logger.info("Queue worker stopped")
    
    async def get_queue_stats(self) -> Dict[str, int]:
        """큐 통계 조회"""
        if not self.redis_client:
            return {}
        
        try:
            stats = {
                "default_queue": await self.redis_client.llen(self.default_queue),
                "priority_queue": await self.redis_client.zcard(self.priority_queue),
                "failed_queue": await self.redis_client.llen(self.failed_queue),
                "processing_queue": await self.redis_client.llen(self.processing_queue),
            }
            return stats
        except Exception as e:
            logger.error(f"Failed to get queue stats: {e}")
            return {}
    
    async def _add_to_processing_queue(self, task: QueueTask):
        """처리 중 큐에 추가"""
        if self.redis_client:
            task_data = task.model_dump_json()
            await self.redis_client.lpush(self.processing_queue, task_data)
    
    async def _remove_from_processing_queue(self, task: QueueTask):
        """처리 중 큐에서 제거"""
        if self.redis_client:
            task_data = task.model_dump_json()
            await self.redis_client.lrem(self.processing_queue, 1, task_data)
    
    async def _move_to_failed_queue(self, task: QueueTask, error_message: str):
        """실패 큐로 이동"""
        if self.redis_client:
            failed_task = task.model_copy()
            failed_task.payload["error"] = error_message
            failed_task.payload["failed_at"] = datetime.utcnow().isoformat()
            
            task_data = failed_task.model_dump_json()
            await self.redis_client.lpush(self.failed_queue, task_data)

# 전역 큐 매니저 인스턴스
queue_manager = MaxDPQueueManager()

async def get_queue_manager() -> MaxDPQueueManager:
    """큐 매니저 인스턴스 반환"""
    return queue_manager
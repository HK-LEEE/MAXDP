"""
큐 시스템 단위 테스트
CLAUDE.local.md 가이드라인에 따른 Redis 큐 시스템 테스트
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from datetime import datetime

from app.utils.maxdp_queue import MaxDPQueueManager, QueueTask

@pytest.mark.unit
class TestMaxDPQueueManager:
    """큐 매니저 단위 테스트"""
    
    @pytest.fixture
    async def queue_manager(self):
        """테스트용 큐 매니저"""
        manager = MaxDPQueueManager("redis://localhost:6379/15")  # 테스트 DB 사용
        await manager.initialize()
        yield manager
        await manager.close()
    
    @pytest.fixture
    def sample_task(self):
        """샘플 테스트 태스크"""
        return QueueTask(
            task_id="test_task_001",
            task_type="data_processing",
            payload={"file_path": "test.csv", "operation": "transform"},
            priority=1
        )
    
    async def test_queue_manager_initialization(self):
        """큐 매니저 초기화 테스트"""
        manager = MaxDPQueueManager("redis://localhost:6379/15")
        
        # 초기화 성공
        result = await manager.initialize()
        assert result is True
        assert manager.redis_client is not None
        
        await manager.close()
    
    async def test_enqueue_task(self, queue_manager: MaxDPQueueManager, sample_task: QueueTask):
        """작업 큐 추가 테스트"""
        # 일반 큐에 추가
        result = await queue_manager.enqueue(sample_task, use_priority=False)
        assert result is True
        
        # 우선순위 큐에 추가
        result = await queue_manager.enqueue(sample_task, use_priority=True)
        assert result is True
    
    async def test_dequeue_task(self, queue_manager: MaxDPQueueManager, sample_task: QueueTask):
        """작업 큐에서 가져오기 테스트"""
        # 작업 추가
        await queue_manager.enqueue(sample_task)
        
        # 작업 가져오기
        dequeued_task = await queue_manager.dequeue(timeout=1)
        assert dequeued_task is not None
        assert dequeued_task.task_id == sample_task.task_id
        assert dequeued_task.task_type == sample_task.task_type
    
    async def test_priority_queue_ordering(self, queue_manager: MaxDPQueueManager):
        """우선순위 큐 순서 테스트"""
        # 다양한 우선순위의 작업들 추가
        low_priority_task = QueueTask(
            task_id="low_priority",
            task_type="test",
            priority=1
        )
        
        high_priority_task = QueueTask(
            task_id="high_priority", 
            task_type="test",
            priority=10
        )
        
        medium_priority_task = QueueTask(
            task_id="medium_priority",
            task_type="test",
            priority=5
        )
        
        # 순서대로 추가 (낮은 우선순위부터)
        await queue_manager.enqueue(low_priority_task, use_priority=True)
        await queue_manager.enqueue(high_priority_task, use_priority=True)
        await queue_manager.enqueue(medium_priority_task, use_priority=True)
        
        # 높은 우선순위부터 가져와지는지 확인
        first_task = await queue_manager.dequeue(timeout=1)
        assert first_task.task_id == "high_priority"
        
        second_task = await queue_manager.dequeue(timeout=1)
        assert second_task.task_id == "medium_priority"
        
        third_task = await queue_manager.dequeue(timeout=1)
        assert third_task.task_id == "low_priority"
    
    async def test_task_handler_registration(self, queue_manager: MaxDPQueueManager):
        """작업 핸들러 등록 테스트"""
        async def test_handler(task: QueueTask):
            return f"Processed: {task.task_id}"
        
        # 핸들러 등록
        queue_manager.register_handler("test_type", test_handler)
        
        # 핸들러가 등록되었는지 확인
        assert "test_type" in queue_manager.task_handlers
        assert queue_manager.task_handlers["test_type"] == test_handler
    
    async def test_task_processing_success(self, queue_manager: MaxDPQueueManager):
        """작업 처리 성공 테스트"""
        processed_tasks = []
        
        async def success_handler(task: QueueTask):
            processed_tasks.append(task.task_id)
            return "success"
        
        # 핸들러 등록
        queue_manager.register_handler("success_test", success_handler)
        
        # 테스트 작업 생성
        task = QueueTask(
            task_id="success_task",
            task_type="success_test",
            payload={"data": "test"}
        )
        
        # 작업 처리
        result = await queue_manager.process_task(task)
        assert result is True
        assert "success_task" in processed_tasks
    
    async def test_task_processing_failure_with_retry(self, queue_manager: MaxDPQueueManager):
        """작업 처리 실패 및 재시도 테스트"""
        attempt_count = 0
        
        async def failing_handler(task: QueueTask):
            nonlocal attempt_count
            attempt_count += 1
            if attempt_count <= 2:  # 처음 2번 실패
                raise Exception("Simulated failure")
            return "success after retry"
        
        # 핸들러 등록
        queue_manager.register_handler("retry_test", failing_handler)
        
        # 최대 재시도 횟수가 적은 작업 생성
        task = QueueTask(
            task_id="retry_task",
            task_type="retry_test",
            max_retries=3
        )
        
        # 첫 번째 처리 (실패 예상)
        result = await queue_manager.process_task(task)
        assert result is False
        assert task.retry_count == 1
        
        # 재시도된 작업 가져오기 및 처리
        retry_task = await queue_manager.dequeue(timeout=1)
        assert retry_task is not None
        assert retry_task.retry_count == 1
        
        # 두 번째 처리 (실패 예상)
        result = await queue_manager.process_task(retry_task)
        assert result is False
        
        # 최종 재시도
        final_retry_task = await queue_manager.dequeue(timeout=1)
        result = await queue_manager.process_task(final_retry_task)
        assert result is True  # 3번째에 성공
    
    async def test_queue_stats(self, queue_manager: MaxDPQueueManager):
        """큐 통계 테스트"""
        # 초기 상태 확인
        stats = await queue_manager.get_queue_stats()
        assert "default_queue" in stats
        assert "priority_queue" in stats
        assert "failed_queue" in stats
        assert "processing_queue" in stats
        
        # 작업 추가 후 통계 확인
        task1 = QueueTask(task_id="stats_test_1", task_type="test")
        task2 = QueueTask(task_id="stats_test_2", task_type="test", priority=5)
        
        await queue_manager.enqueue(task1, use_priority=False)
        await queue_manager.enqueue(task2, use_priority=True)
        
        updated_stats = await queue_manager.get_queue_stats()
        assert updated_stats["default_queue"] >= 1
        assert updated_stats["priority_queue"] >= 1
    
    async def test_worker_lifecycle(self, queue_manager: MaxDPQueueManager):
        """워커 생명주기 테스트"""
        processed_tasks = []
        
        async def worker_handler(task: QueueTask):
            processed_tasks.append(task.task_id)
            return "processed"
        
        # 핸들러 등록
        queue_manager.register_handler("worker_test", worker_handler)
        
        # 테스트 작업 추가
        task = QueueTask(
            task_id="worker_task",
            task_type="worker_test"
        )
        await queue_manager.enqueue(task)
        
        # 워커 시작 (짧은 시간 동안만)
        worker_task = asyncio.create_task(queue_manager.start_worker())
        
        # 잠시 대기 (작업 처리를 위해)
        await asyncio.sleep(0.1)
        
        # 워커 중지
        await queue_manager.stop_worker()
        worker_task.cancel()
        
        try:
            await worker_task
        except asyncio.CancelledError:
            pass
        
        # 작업이 처리되었는지 확인
        assert "worker_task" in processed_tasks

@pytest.mark.unit
class TestQueueTask:
    """큐 작업 모델 테스트"""
    
    def test_queue_task_creation(self):
        """큐 작업 생성 테스트"""
        task = QueueTask(
            task_id="test_001",
            task_type="data_processing",
            payload={"key": "value"},
            priority=5,
            max_retries=3
        )
        
        assert task.task_id == "test_001"
        assert task.task_type == "data_processing"
        assert task.payload == {"key": "value"}
        assert task.priority == 5
        assert task.retry_count == 0
        assert task.max_retries == 3
        assert isinstance(task.created_at, datetime)
    
    def test_queue_task_serialization(self):
        """큐 작업 직렬화 테스트"""
        task = QueueTask(
            task_id="serialize_test",
            task_type="test_type",
            payload={"data": [1, 2, 3]}
        )
        
        # JSON 직렬화
        json_str = task.model_dump_json()
        assert isinstance(json_str, str)
        
        # 역직렬화
        deserialized_task = QueueTask.model_validate_json(json_str)
        assert deserialized_task.task_id == task.task_id
        assert deserialized_task.task_type == task.task_type
        assert deserialized_task.payload == task.payload
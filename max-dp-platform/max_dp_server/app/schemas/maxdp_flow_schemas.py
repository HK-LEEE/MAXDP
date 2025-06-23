"""
MAX DP 플로우 관련 Pydantic 스키마
플로우, 플로우 버전, 플로우 실행에 대한 요청/응답 스키마를 정의합니다.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum

# Enum 정의
class FlowStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"

class ExecutionStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"

class OwnerType(str, Enum):
    USER = "USER"
    GROUP = "GROUP"
    
    @classmethod
    def from_db_value(cls, value: str):
        """데이터베이스 값을 enum으로 변환"""
        if value.lower() == "user":
            return cls.USER
        elif value.lower() == "group":
            return cls.GROUP
        return value

# 기본 스키마들
class FlowBase(BaseModel):
    """플로우 기본 스키마"""
    name: str = Field(..., min_length=1, max_length=255, description="플로우 이름")
    description: Optional[str] = Field(None, description="플로우 설명")
    tags: Optional[Dict[str, Any]] = Field(default_factory=dict, description="플로우 태그")
    is_public: Optional[bool] = Field(False, description="공개 플로우 여부")

class FlowCreate(FlowBase):
    """플로우 생성 요청 스키마"""
    workspace_id: int = Field(..., description="소속 워크스페이스 ID")
    initial_definition: Optional[Dict[str, Any]] = Field(default_factory=dict, description="초기 플로우 정의")

class FlowUpdate(BaseModel):
    """플로우 업데이트 요청 스키마"""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="플로우 이름")
    description: Optional[str] = Field(None, description="플로우 설명")
    status: Optional[FlowStatus] = Field(None, description="플로우 상태")
    tags: Optional[Dict[str, Any]] = Field(None, description="플로우 태그")
    is_public: Optional[bool] = Field(None, description="공개 플로우 여부")

class FlowResponse(FlowBase):
    """플로우 응답 스키마"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int = Field(..., description="플로우 ID")
    workspace_id: int = Field(..., description="소속 워크스페이스 ID")
    owner_type: OwnerType = Field(..., description="소유자 타입")
    owner_user_id: Optional[str] = Field(None, description="사용자 소유자 ID")
    owner_group_id: Optional[int] = Field(None, description="그룹 소유자 ID")
    status: FlowStatus = Field(..., description="플로우 상태")
    current_version: int = Field(..., description="현재 활성 버전")
    latest_version: int = Field(..., description="최신 버전 번호")
    is_scheduled: bool = Field(..., description="스케줄 실행 여부")
    schedule_config: Optional[Dict[str, Any]] = Field(None, description="스케줄 설정")
    created_at: datetime = Field(..., description="생성 시간")
    updated_at: datetime = Field(..., description="수정 시간")
    created_by: str = Field(..., description="생성자 ID")
    
    @classmethod
    def model_validate(cls, obj, **kwargs):
        """모델 검증 시 데이터 변환"""
        if hasattr(obj, '__dict__'):
            data = obj.__dict__.copy()
            
            # owner_type 값 변환 (소문자 -> 대문자)
            if 'owner_type' in data and isinstance(data['owner_type'], str):
                data['owner_type'] = data['owner_type'].upper()
            
            # UUID를 문자열로 변환
            for field in ['owner_user_id', 'created_by']:
                if field in data and data[field] is not None:
                    data[field] = str(data[field])
            
            return super().model_validate(data, **kwargs)
        
        return super().model_validate(obj, **kwargs)

class FlowListResponse(BaseModel):
    """플로우 목록 응답 스키마"""
    flows: List[FlowResponse] = Field(..., description="플로우 목록")
    total: int = Field(..., description="전체 플로우 수")
    skip: int = Field(..., description="건너뛴 항목 수")
    limit: int = Field(..., description="조회된 최대 항목 수")

# 플로우 버전 스키마들
class FlowVersionBase(BaseModel):
    """플로우 버전 기본 스키마"""
    version_name: Optional[str] = Field(None, max_length=100, description="버전 이름")
    description: Optional[str] = Field(None, description="버전 설명")
    changelog: Optional[str] = Field(None, description="변경사항")

class FlowVersionCreate(FlowVersionBase):
    """플로우 버전 생성 요청 스키마"""
    flow_definition: Dict[str, Any] = Field(..., description="플로우 정의 (JSON)")
    components: Optional[Dict[str, Any]] = Field(default_factory=dict, description="사용된 컴포넌트 목록")

class FlowVersionUpdate(BaseModel):
    """플로우 버전 업데이트 요청 스키마"""
    version_name: Optional[str] = Field(None, max_length=100, description="버전 이름")
    description: Optional[str] = Field(None, description="버전 설명")
    is_active: Optional[bool] = Field(None, description="활성 버전 여부")
    is_published: Optional[bool] = Field(None, description="발행된 버전 여부")

class FlowVersionResponse(FlowVersionBase):
    """플로우 버전 응답 스키마"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int = Field(..., description="버전 ID")
    flow_id: int = Field(..., description="플로우 ID")
    version_number: int = Field(..., description="버전 번호")
    flow_definition: Dict[str, Any] = Field(..., description="플로우 정의 (JSON)")
    components: Optional[Dict[str, Any]] = Field(None, description="사용된 컴포넌트 목록")
    is_active: bool = Field(..., description="활성 버전 여부")
    is_published: bool = Field(..., description="발행된 버전 여부")
    created_at: datetime = Field(..., description="생성 시간")
    created_by: str = Field(..., description="생성자 ID")

class FlowVersionListResponse(BaseModel):
    """플로우 버전 목록 응답 스키마"""
    versions: List[FlowVersionResponse] = Field(..., description="버전 목록")
    total: int = Field(..., description="전체 버전 수")
    skip: int = Field(..., description="건너뛴 항목 수")
    limit: int = Field(..., description="조회된 최대 항목 수")

# 플로우 실행 스키마들
class FlowExecutionBase(BaseModel):
    """플로우 실행 기본 스키마"""
    trigger_type: str = Field(..., max_length=50, description="실행 트리거 타입 (manual, schedule, api)")

class FlowExecutionCreate(FlowExecutionBase):
    """플로우 실행 생성 요청 스키마"""
    flow_id: int = Field(..., description="실행할 플로우 ID")
    version_id: Optional[int] = Field(None, description="실행할 버전 ID (없으면 현재 활성 버전)")

class FlowExecutionResponse(FlowExecutionBase):
    """플로우 실행 응답 스키마"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int = Field(..., description="실행 ID")
    flow_id: int = Field(..., description="플로우 ID")
    version_id: Optional[int] = Field(None, description="버전 ID")
    status: ExecutionStatus = Field(..., description="실행 상태")
    execution_id: str = Field(..., description="실행 고유 ID")
    trigger_user_id: Optional[str] = Field(None, description="실행 트리거 사용자 ID")
    start_time: Optional[datetime] = Field(None, description="실행 시작 시간")
    end_time: Optional[datetime] = Field(None, description="실행 종료 시간")
    duration_seconds: Optional[int] = Field(None, description="실행 시간 (초)")
    logs: Optional[str] = Field(None, description="실행 로그")
    error_message: Optional[str] = Field(None, description="에러 메시지")
    result_data: Optional[Dict[str, Any]] = Field(None, description="실행 결과 데이터")
    created_at: datetime = Field(..., description="생성 시간")
    updated_at: datetime = Field(..., description="수정 시간")

class FlowExecutionListResponse(BaseModel):
    """플로우 실행 목록 응답 스키마"""
    executions: List[FlowExecutionResponse] = Field(..., description="실행 목록")
    total: int = Field(..., description="전체 실행 수")
    skip: int = Field(..., description="건너뛴 항목 수")
    limit: int = Field(..., description="조회된 최대 항목 수")

# 플로우 복사 스키마
class FlowCopyRequest(BaseModel):
    """플로우 복사 요청 스키마"""
    new_name: str = Field(..., min_length=1, max_length=255, description="새 플로우 이름")
    new_description: Optional[str] = Field(None, description="새 플로우 설명")
    target_workspace_id: Optional[int] = Field(None, description="대상 워크스페이스 ID (없으면 현재 워크스페이스)")
    copy_versions: bool = Field(False, description="모든 버전 복사 여부")

# 플로우 내보내기/가져오기 스키마
class FlowExportResponse(BaseModel):
    """플로우 내보내기 응답 스키마"""
    flow_data: FlowResponse = Field(..., description="플로우 정보")
    versions: List[FlowVersionResponse] = Field(..., description="플로우 버전들")
    export_timestamp: datetime = Field(..., description="내보내기 시간")
    export_user: str = Field(..., description="내보내기 사용자")

class FlowImportRequest(BaseModel):
    """플로우 가져오기 요청 스키마"""
    flow_data: Dict[str, Any] = Field(..., description="가져올 플로우 데이터")
    target_workspace_id: int = Field(..., description="대상 워크스페이스 ID")
    new_name: Optional[str] = Field(None, description="새 플로우 이름 (없으면 원본 이름 사용)")
    import_versions: bool = Field(True, description="버전들도 함께 가져오기 여부")

# 플로우 통계 스키마
class FlowStatsResponse(BaseModel):
    """플로우 통계 응답 스키마"""
    flow_id: int = Field(..., description="플로우 ID")
    total_executions: int = Field(..., description="총 실행 횟수")
    successful_executions: int = Field(..., description="성공한 실행 횟수")
    failed_executions: int = Field(..., description="실패한 실행 횟수")
    avg_execution_time: Optional[float] = Field(None, description="평균 실행 시간 (초)")
    last_execution_time: Optional[datetime] = Field(None, description="마지막 실행 시간")
    success_rate: float = Field(..., description="성공률 (0.0-1.0)")

# 플로우 템플릿 스키마
class FlowTemplateResponse(BaseModel):
    """플로우 템플릿 응답 스키마"""
    id: str = Field(..., description="템플릿 ID")
    name: str = Field(..., description="템플릿 이름")
    description: str = Field(..., description="템플릿 설명")
    category: str = Field(..., description="템플릿 카테고리")
    tags: List[str] = Field(..., description="템플릿 태그")
    template_data: Dict[str, Any] = Field(..., description="템플릿 데이터")
    preview_image: Optional[str] = Field(None, description="미리보기 이미지 URL")
    created_at: datetime = Field(..., description="생성 시간")
    updated_at: datetime = Field(..., description="수정 시간")

class FlowTemplateListResponse(BaseModel):
    """플로우 템플릿 목록 응답 스키마"""
    templates: List[FlowTemplateResponse] = Field(..., description="템플릿 목록")
    total: int = Field(..., description="전체 템플릿 수")
    categories: List[str] = Field(..., description="사용 가능한 카테고리 목록")
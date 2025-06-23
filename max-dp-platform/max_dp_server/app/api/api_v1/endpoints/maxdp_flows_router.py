"""
MAX DP 플로우 관리 API 라우터
플로우의 생성, 조회, 수정, 삭제 및 버전 관리를 제공합니다.
"""
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc
from sqlalchemy.orm import selectinload

from ....db.maxdp_session import get_db
from ....dependencies.maxdp_auth import get_current_user, UserContext
from ....models.maxdp_flow_model import MaxDPFlow, MaxDPFlowVersion, MaxDPFlowExecution
from ....models.maxdp_workspace_model import MaxDPWorkspace
from ....schemas.maxdp_flow_schemas import (
    FlowCreate, FlowUpdate, FlowResponse, FlowListResponse,
    FlowVersionCreate, FlowVersionResponse, FlowVersionListResponse,
    FlowExecutionResponse, FlowExecutionListResponse
)

logger = logging.getLogger(__name__)

router = APIRouter()

# 플로우 관리 엔드포인트
@router.get("/", response_model=FlowListResponse)
async def get_flows(
    workspace_id: int = Query(..., description="워크스페이스 ID"),
    skip: int = Query(0, ge=0, description="건너뛸 항목 수"),
    limit: int = Query(100, ge=1, le=1000, description="가져올 최대 항목 수"),
    status: Optional[str] = Query(None, description="플로우 상태 필터"),
    search: Optional[str] = Query(None, description="플로우 이름 검색"),
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(get_current_user)
):
    """워크스페이스의 플로우 목록을 조회합니다."""
    logger.info(f"Fetching flows for workspace {workspace_id}, user: {current_user.email}")
    
    try:
        # 워크스페이스 존재 및 접근 권한 확인
        workspace_query = select(MaxDPWorkspace).where(
            and_(
                MaxDPWorkspace.id == workspace_id,
                MaxDPWorkspace.is_active == True,
                or_(
                    MaxDPWorkspace.owner_user_id == current_user.user_id,
                    MaxDPWorkspace.is_public == True
                )
            )
        )
        workspace_result = await db.execute(workspace_query)
        workspace = workspace_result.scalar_one_or_none()
        
        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="워크스페이스를 찾을 수 없거나 접근 권한이 없습니다."
            )
        
        # 플로우 쿼리 구성
        query = select(MaxDPFlow).where(MaxDPFlow.workspace_id == workspace_id)
        
        # 상태 필터
        if status:
            query = query.where(MaxDPFlow.status == status)
        
        # 이름 검색
        if search:
            query = query.where(MaxDPFlow.name.ilike(f"%{search}%"))
        
        # 접근 권한 필터
        query = query.where(
            or_(
                MaxDPFlow.owner_user_id == current_user.user_id,
                MaxDPFlow.is_public == True
            )
        )
        
        # 정렬 및 페이징
        query = query.order_by(desc(MaxDPFlow.updated_at)).offset(skip).limit(limit)
        
        # 실행 및 결과 반환
        result = await db.execute(query)
        flows = result.scalars().all()
        
        # 총 개수 조회
        count_query = select(MaxDPFlow).where(
            and_(
                MaxDPFlow.workspace_id == workspace_id,
                or_(
                    MaxDPFlow.owner_user_id == current_user.user_id,
                    MaxDPFlow.is_public == True
                )
            )
        )
        if status:
            count_query = count_query.where(MaxDPFlow.status == status)
        if search:
            count_query = count_query.where(MaxDPFlow.name.ilike(f"%{search}%"))
        
        count_result = await db.execute(count_query)
        total = len(count_result.scalars().all())
        
        logger.info(f"Found {len(flows)} flows for workspace {workspace_id}, user: {current_user.email}")
        
        # 플로우 데이터 변환
        flow_responses = []
        for flow in flows:
            flow_data = {
                'id': flow.id,
                'name': flow.name,
                'description': flow.description,
                'workspace_id': flow.workspace_id,
                'owner_type': flow.owner_type.upper() if isinstance(flow.owner_type, str) else str(flow.owner_type).upper(),
                'owner_user_id': str(flow.owner_user_id) if flow.owner_user_id else None,
                'owner_group_id': flow.owner_group_id,
                'status': flow.status,
                'is_public': flow.is_public,
                'tags': flow.tags or {},
                'current_version': flow.current_version,
                'latest_version': flow.latest_version,
                'is_scheduled': flow.is_scheduled,
                'schedule_config': flow.schedule_config or {},
                'created_at': flow.created_at,
                'updated_at': flow.updated_at,
                'created_by': str(flow.created_by)
            }
            flow_responses.append(FlowResponse.model_validate(flow_data))
        
        return FlowListResponse(
            flows=flow_responses,
            total=total,
            skip=skip,
            limit=limit
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching flows for workspace {workspace_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="플로우 목록 조회 중 오류가 발생했습니다."
        )

@router.post("/", response_model=FlowResponse, status_code=status.HTTP_201_CREATED)
async def create_flow(
    flow_data: FlowCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(get_current_user)
):
    """새 플로우를 생성합니다."""
    logger.info(f"Creating flow: {flow_data.name} for user: {current_user.email}")
    
    try:
        # 워크스페이스 존재 및 접근 권한 확인
        workspace_query = select(MaxDPWorkspace).where(
            and_(
                MaxDPWorkspace.id == flow_data.workspace_id,
                MaxDPWorkspace.is_active == True,
                or_(
                    MaxDPWorkspace.owner_user_id == current_user.user_id,
                    MaxDPWorkspace.is_public == True
                )
            )
        )
        workspace_result = await db.execute(workspace_query)
        workspace = workspace_result.scalar_one_or_none()
        
        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="워크스페이스를 찾을 수 없거나 접근 권한이 없습니다."
            )
        
        # 같은 이름의 플로우가 이미 있는지 확인
        existing_query = select(MaxDPFlow).where(
            and_(
                MaxDPFlow.workspace_id == flow_data.workspace_id,
                MaxDPFlow.name == flow_data.name
            )
        )
        existing_result = await db.execute(existing_query)
        existing_flow = existing_result.scalar_one_or_none()
        
        if existing_flow:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="같은 이름의 플로우가 이미 존재합니다."
            )
        
        # 새 플로우 생성
        new_flow = MaxDPFlow(
            name=flow_data.name,
            description=flow_data.description,
            workspace_id=flow_data.workspace_id,
            owner_type="USER",  # enum 값에 맞게 대문자 사용
            owner_user_id=current_user.user_id,
            created_by=current_user.user_id,
            status="draft",  # flowstatus enum은 소문자 사용
            is_public=False,  # 기본값
            tags=flow_data.tags or {},
            current_version=1,
            latest_version=1,
            is_scheduled=False,
            schedule_config={}
        )
        
        db.add(new_flow)
        await db.flush()  # ID 생성을 위해 flush
        
        # 초기 버전 생성
        initial_version = MaxDPFlowVersion(
            flow_id=new_flow.id,
            version_number=1,
            version_name="v1.0.0",
            description="초기 버전",
            changelog="프로젝트 생성",
            flow_definition=flow_data.initial_definition or {},
            components={},
            is_active=True,
            is_published=False,
            created_by=current_user.user_id
        )
        
        db.add(initial_version)
        await db.commit()
        await db.refresh(new_flow)
        
        logger.info(f"Flow created successfully: {new_flow.id} for user: {current_user.email}")
        
        # 생성된 플로우 데이터 변환
        flow_data = {
            'id': new_flow.id,
            'name': new_flow.name,
            'description': new_flow.description,
            'workspace_id': new_flow.workspace_id,
            'owner_type': new_flow.owner_type.upper() if isinstance(new_flow.owner_type, str) else str(new_flow.owner_type).upper(),
            'owner_user_id': str(new_flow.owner_user_id) if new_flow.owner_user_id else None,
            'owner_group_id': new_flow.owner_group_id,
            'status': new_flow.status,
            'is_public': new_flow.is_public,
            'tags': new_flow.tags or {},
            'current_version': new_flow.current_version,
            'latest_version': new_flow.latest_version,
            'is_scheduled': new_flow.is_scheduled,
            'schedule_config': new_flow.schedule_config or {},
            'created_at': new_flow.created_at,
            'updated_at': new_flow.updated_at,
            'created_by': str(new_flow.created_by)
        }
        
        return FlowResponse.model_validate(flow_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating flow: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="플로우 생성 중 오류가 발생했습니다."
        )

@router.get("/{flow_id}", response_model=FlowResponse)
async def get_flow(
    flow_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(get_current_user)
):
    """특정 플로우의 상세 정보를 조회합니다."""
    logger.info(f"Fetching flow {flow_id} for user: {current_user.email}")
    
    try:
        # 플로우 조회 (접근 권한 확인 포함)
        query = select(MaxDPFlow).where(
            and_(
                MaxDPFlow.id == flow_id,
                or_(
                    MaxDPFlow.owner_user_id == current_user.user_id,
                    MaxDPFlow.is_public == True
                )
            )
        )
        result = await db.execute(query)
        flow = result.scalar_one_or_none()
        
        if not flow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="플로우를 찾을 수 없거나 접근 권한이 없습니다."
            )
        
        # 플로우 데이터 변환
        flow_data = {
            'id': flow.id,
            'name': flow.name,
            'description': flow.description,
            'workspace_id': flow.workspace_id,
            'owner_type': flow.owner_type.upper() if isinstance(flow.owner_type, str) else str(flow.owner_type).upper(),
            'owner_user_id': str(flow.owner_user_id) if flow.owner_user_id else None,
            'owner_group_id': flow.owner_group_id,
            'status': flow.status,
            'is_public': flow.is_public,
            'tags': flow.tags or {},
            'current_version': flow.current_version,
            'latest_version': flow.latest_version,
            'is_scheduled': flow.is_scheduled,
            'schedule_config': flow.schedule_config or {},
            'created_at': flow.created_at,
            'updated_at': flow.updated_at,
            'created_by': str(flow.created_by)
        }
        
        return FlowResponse.model_validate(flow_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching flow {flow_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="플로우 조회 중 오류가 발생했습니다."
        )

@router.get("/{flow_id}/definition", response_model=dict)
async def get_flow_definition(
    flow_id: int,
    version: Optional[int] = Query(None, description="버전 번호 (없으면 현재 활성 버전)"),
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(get_current_user)
):
    """플로우의 정의(노드와 엣지)를 조회합니다."""
    logger.info(f"Fetching flow definition for flow {flow_id}, version: {version}, user: {current_user.email}")
    
    try:
        # 플로우 접근 권한 확인
        flow_query = select(MaxDPFlow).where(
            and_(
                MaxDPFlow.id == flow_id,
                or_(
                    MaxDPFlow.owner_user_id == current_user.user_id,
                    MaxDPFlow.is_public == True
                )
            )
        )
        flow_result = await db.execute(flow_query)
        flow = flow_result.scalar_one_or_none()
        
        if not flow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="플로우를 찾을 수 없거나 접근 권한이 없습니다."
            )
        
        # 버전 조회 (지정된 버전이 없으면 최신 버전 사용)
        if version is None:
            # 최신 버전 조회
            latest_version_query = select(MaxDPFlowVersion).where(
                MaxDPFlowVersion.flow_id == flow_id
            ).order_by(desc(MaxDPFlowVersion.version_number)).limit(1)
            
            latest_result = await db.execute(latest_version_query)
            latest_version = latest_result.scalar_one_or_none()
            
            if not latest_version:
                return {
                    "flow_id": flow_id,
                    "version_number": 1,
                    "flow_definition": {},
                    "components": {}
                }
            
            version = latest_version.version_number
        
        version_query = select(MaxDPFlowVersion).where(
            and_(
                MaxDPFlowVersion.flow_id == flow_id,
                MaxDPFlowVersion.version_number == version
            )
        )
        version_result = await db.execute(version_query)
        flow_version = version_result.scalar_one_or_none()
        
        if not flow_version:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"버전 {version}을 찾을 수 없습니다."
            )
        
        logger.info(f"Found flow definition for flow {flow_id}, version {version}")
        
        return {
            "flow_id": flow_id,
            "version_number": flow_version.version_number,
            "flow_definition": flow_version.flow_definition or {},
            "components": flow_version.components or {}
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching flow definition {flow_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="플로우 정의 조회 중 오류가 발생했습니다."
        )

@router.put("/{flow_id}", response_model=FlowResponse)
async def update_flow(
    flow_id: int,
    flow_data: FlowUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(get_current_user)
):
    """플로우 정보를 업데이트합니다."""
    logger.info(f"Updating flow {flow_id} for user: {current_user.email}")
    
    try:
        # 플로우 조회 (소유자 권한 확인)
        query = select(MaxDPFlow).where(
            and_(
                MaxDPFlow.id == flow_id,
                MaxDPFlow.owner_user_id == current_user.user_id
            )
        )
        result = await db.execute(query)
        flow = result.scalar_one_or_none()
        
        if not flow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="플로우를 찾을 수 없거나 수정 권한이 없습니다."
            )
        
        # 업데이트 가능한 필드들 업데이트
        if flow_data.name is not None:
            flow.name = flow_data.name
        if flow_data.description is not None:
            flow.description = flow_data.description
        if flow_data.status is not None:
            flow.status = flow_data.status
        if flow_data.tags is not None:
            flow.tags = flow_data.tags
        if flow_data.is_public is not None:
            flow.is_public = flow_data.is_public
        
        await db.commit()
        await db.refresh(flow)
        
        logger.info(f"Flow {flow_id} updated successfully for user: {current_user.email}")
        
        # 업데이트된 플로우 데이터 변환
        flow_data = {
            'id': flow.id,
            'name': flow.name,
            'description': flow.description,
            'workspace_id': flow.workspace_id,
            'owner_type': flow.owner_type.upper() if isinstance(flow.owner_type, str) else str(flow.owner_type).upper(),
            'owner_user_id': str(flow.owner_user_id) if flow.owner_user_id else None,
            'owner_group_id': flow.owner_group_id,
            'status': flow.status,
            'is_public': flow.is_public,
            'tags': flow.tags or {},
            'current_version': flow.current_version,
            'latest_version': flow.latest_version,
            'is_scheduled': flow.is_scheduled,
            'schedule_config': flow.schedule_config or {},
            'created_at': flow.created_at,
            'updated_at': flow.updated_at,
            'created_by': str(flow.created_by)
        }
        
        return FlowResponse.model_validate(flow_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating flow {flow_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="플로우 업데이트 중 오류가 발생했습니다."
        )

@router.delete("/{flow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_flow(
    flow_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(get_current_user)
):
    """플로우를 삭제합니다 (소프트 삭제)."""
    logger.info(f"Deleting flow {flow_id} for user: {current_user.email}")
    
    try:
        # 플로우 조회 (소유자 권한 확인)
        query = select(MaxDPFlow).where(
            and_(
                MaxDPFlow.id == flow_id,
                MaxDPFlow.owner_user_id == current_user.user_id
            )
        )
        result = await db.execute(query)
        flow = result.scalar_one_or_none()
        
        if not flow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="플로우를 찾을 수 없거나 삭제 권한이 없습니다."
            )
        
        # 상태를 archived로 변경 (소프트 삭제)
        flow.status = "archived"
        
        await db.commit()
        
        logger.info(f"Flow {flow_id} deleted successfully for user: {current_user.email}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting flow {flow_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="플로우 삭제 중 오류가 발생했습니다."
        )

# 플로우 버전 관리 엔드포인트
@router.get("/{flow_id}/versions", response_model=FlowVersionListResponse)
async def get_flow_versions(
    flow_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(get_current_user)
):
    """플로우의 버전 목록을 조회합니다."""
    logger.info(f"Fetching versions for flow {flow_id}, user: {current_user.email}")
    
    try:
        # 플로우 접근 권한 확인
        flow_query = select(MaxDPFlow).where(
            and_(
                MaxDPFlow.id == flow_id,
                or_(
                    MaxDPFlow.owner_user_id == current_user.user_id,
                    MaxDPFlow.is_public == True
                )
            )
        )
        flow_result = await db.execute(flow_query)
        flow = flow_result.scalar_one_or_none()
        
        if not flow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="플로우를 찾을 수 없거나 접근 권한이 없습니다."
            )
        
        # 버전 목록 조회
        query = select(MaxDPFlowVersion).where(
            MaxDPFlowVersion.flow_id == flow_id
        ).order_by(desc(MaxDPFlowVersion.version_number)).offset(skip).limit(limit)
        
        result = await db.execute(query)
        versions = result.scalars().all()
        
        # 총 개수 조회
        count_query = select(MaxDPFlowVersion).where(MaxDPFlowVersion.flow_id == flow_id)
        count_result = await db.execute(count_query)
        total = len(count_result.scalars().all())
        
        logger.info(f"Found {len(versions)} versions for flow {flow_id}")
        
        # 버전 데이터 변환
        version_responses = []
        for version in versions:
            version_data = {
                'id': version.id,
                'flow_id': version.flow_id,
                'version_number': version.version_number,
                'version_name': version.version_name,
                'description': version.description,
                'changelog': version.changelog,
                'flow_definition': version.flow_definition,
                'components': version.components or {},
                'is_active': version.is_active,
                'is_published': version.is_published,
                'created_at': version.created_at,
                'created_by': str(version.created_by)
            }
            version_responses.append(FlowVersionResponse.model_validate(version_data))
        
        return FlowVersionListResponse(
            versions=version_responses,
            total=total,
            skip=skip,
            limit=limit
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching versions for flow {flow_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="플로우 버전 목록 조회 중 오류가 발생했습니다."
        )

@router.post("/{flow_id}/versions", response_model=FlowVersionResponse, status_code=status.HTTP_201_CREATED)
async def create_flow_version(
    flow_id: int,
    version_data: FlowVersionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(get_current_user)
):
    """플로우의 새 버전을 생성합니다."""
    logger.info(f"Creating new version for flow {flow_id}, user: {current_user.email}")
    
    try:
        # 플로우 소유자 권한 확인
        flow_query = select(MaxDPFlow).where(
            and_(
                MaxDPFlow.id == flow_id,
                MaxDPFlow.owner_user_id == current_user.user_id
            )
        )
        flow_result = await db.execute(flow_query)
        flow = flow_result.scalar_one_or_none()
        
        if not flow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="플로우를 찾을 수 없거나 수정 권한이 없습니다."
            )
        
        # 다음 버전 번호 계산
        next_version = flow.latest_version + 1
        
        # 새 버전 생성
        new_version = MaxDPFlowVersion(
            flow_id=flow_id,
            version_number=next_version,
            version_name=version_data.version_name or f"v{next_version}.0.0",
            description=version_data.description,
            changelog=version_data.changelog,
            flow_definition=version_data.flow_definition,
            components=version_data.components or {},
            is_active=False,  # 새 버전은 기본적으로 비활성
            is_published=False,
            created_by=current_user.user_id
        )
        
        db.add(new_version)
        
        # 플로우의 latest_version 업데이트
        flow.latest_version = next_version
        
        await db.commit()
        await db.refresh(new_version)
        
        logger.info(f"Flow version {next_version} created for flow {flow_id}")
        
        # 버전 데이터 변환
        version_data = {
            'id': new_version.id,
            'flow_id': new_version.flow_id,
            'version_number': new_version.version_number,
            'version_name': new_version.version_name,
            'description': new_version.description,
            'changelog': new_version.changelog,
            'flow_definition': new_version.flow_definition,
            'components': new_version.components or {},
            'is_active': new_version.is_active,
            'is_published': new_version.is_published,
            'created_at': new_version.created_at,
            'created_by': str(new_version.created_by)
        }
        
        return FlowVersionResponse.model_validate(version_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating version for flow {flow_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="플로우 버전 생성 중 오류가 발생했습니다."
        )
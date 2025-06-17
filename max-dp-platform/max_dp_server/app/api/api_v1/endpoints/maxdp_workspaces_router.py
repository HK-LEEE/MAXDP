"""
MAX DP 워크스페이스 관리 API 엔드포인트
워크스페이스 생성, 조회, 수정, 삭제 등의 기능을 제공합니다.
"""
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel

from ....db.maxdp_session import get_db
from ....dependencies.maxdp_auth import get_current_user, UserContext
from ....models.maxdp_workspace_model import MaxDPWorkspace, OwnerType

logger = logging.getLogger(__name__)
router = APIRouter()

# Pydantic 모델들
class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_public: bool = False

class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None
    is_active: Optional[bool] = None

class WorkspaceResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    owner_type: str
    owner_user_id: Optional[str]
    is_active: bool
    is_public: bool
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

@router.get("/", response_model=List[WorkspaceResponse], tags=["Workspaces"])
async def get_workspaces(
    current_user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    사용자의 워크스페이스 목록 조회
    
    현재 사용자가 소유하거나 접근 가능한 워크스페이스들을 반환합니다.
    """
    logger.info(f"Fetching workspaces for user: {current_user.email}")
    
    try:
        # 사용자가 소유한 워크스페이스 또는 공개 워크스페이스 조회
        stmt = select(MaxDPWorkspace).where(
            and_(
                MaxDPWorkspace.is_active == True,
                (
                    (MaxDPWorkspace.owner_user_id == current_user.user_id) |
                    (MaxDPWorkspace.is_public == True)
                )
            )
        ).order_by(MaxDPWorkspace.created_at.desc())
        
        result = await db.execute(stmt)
        workspaces = result.scalars().all()
        
        logger.info(f"Found {len(workspaces)} workspaces for user: {current_user.email}")
        
        return [
            WorkspaceResponse(
                id=ws.id,
                name=ws.name,
                description=ws.description,
                owner_type=ws.owner_type.value,
                owner_user_id=str(ws.owner_user_id) if ws.owner_user_id else None,
                is_active=ws.is_active,
                is_public=ws.is_public,
                created_at=ws.created_at.isoformat(),
                updated_at=ws.updated_at.isoformat()
            )
            for ws in workspaces
        ]
        
    except Exception as e:
        logger.error(f"Error fetching workspaces for user {current_user.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch workspaces"
        )

@router.post("/", response_model=WorkspaceResponse, tags=["Workspaces"])
async def create_workspace(
    workspace_data: WorkspaceCreate,
    current_user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    새 워크스페이스 생성
    
    현재 사용자 소유의 새 워크스페이스를 생성합니다.
    """
    logger.info(f"Creating workspace '{workspace_data.name}' for user: {current_user.email}")
    
    try:
        # 워크스페이스 이름 중복 확인 (같은 사용자 내에서)
        stmt = select(MaxDPWorkspace).where(
            and_(
                MaxDPWorkspace.owner_user_id == current_user.user_id,
                MaxDPWorkspace.name == workspace_data.name,
                MaxDPWorkspace.is_active == True
            )
        )
        result = await db.execute(stmt)
        existing_workspace = result.scalar_one_or_none()
        
        if existing_workspace:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Workspace with name '{workspace_data.name}' already exists"
            )
        
        # 새 워크스페이스 생성
        new_workspace = MaxDPWorkspace(
            name=workspace_data.name,
            description=workspace_data.description,
            owner_type=OwnerType.USER,
            owner_user_id=current_user.user_id,
            is_public=workspace_data.is_public,
            is_active=True,
            created_by=current_user.user_id
        )
        
        db.add(new_workspace)
        await db.commit()
        await db.refresh(new_workspace)
        
        logger.info(f"Workspace '{workspace_data.name}' created successfully with ID: {new_workspace.id}")
        
        return WorkspaceResponse(
            id=new_workspace.id,
            name=new_workspace.name,
            description=new_workspace.description,
            owner_type=new_workspace.owner_type.value,
            owner_user_id=str(new_workspace.owner_user_id) if new_workspace.owner_user_id else None,
            is_active=new_workspace.is_active,
            is_public=new_workspace.is_public,
            created_at=new_workspace.created_at.isoformat(),
            updated_at=new_workspace.updated_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating workspace for user {current_user.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create workspace"
        )

@router.get("/{workspace_id}", response_model=WorkspaceResponse, tags=["Workspaces"])
async def get_workspace(
    workspace_id: int,
    current_user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    특정 워크스페이스 조회
    
    ID로 특정 워크스페이스의 상세 정보를 조회합니다.
    """
    logger.info(f"Fetching workspace {workspace_id} for user: {current_user.email}")
    
    try:
        stmt = select(MaxDPWorkspace).where(MaxDPWorkspace.id == workspace_id)
        result = await db.execute(stmt)
        workspace = result.scalar_one_or_none()
        
        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )
        
        # 접근 권한 확인
        if not workspace.can_access(current_user.user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this workspace"
            )
        
        return WorkspaceResponse(
            id=workspace.id,
            name=workspace.name,
            description=workspace.description,
            owner_type=workspace.owner_type.value,
            owner_user_id=str(workspace.owner_user_id) if workspace.owner_user_id else None,
            is_active=workspace.is_active,
            is_public=workspace.is_public,
            created_at=workspace.created_at.isoformat(),
            updated_at=workspace.updated_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching workspace {workspace_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch workspace"
        )

@router.put("/{workspace_id}", response_model=WorkspaceResponse, tags=["Workspaces"])
async def update_workspace(
    workspace_id: int,
    workspace_data: WorkspaceUpdate,
    current_user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    워크스페이스 수정
    
    워크스페이스의 정보를 수정합니다. 소유자만 수정 가능합니다.
    """
    logger.info(f"Updating workspace {workspace_id} for user: {current_user.email}")
    
    try:
        stmt = select(MaxDPWorkspace).where(MaxDPWorkspace.id == workspace_id)
        result = await db.execute(stmt)
        workspace = result.scalar_one_or_none()
        
        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )
        
        # 소유자 확인
        if not workspace.is_owned_by_user(current_user.user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only workspace owner can modify this workspace"
            )
        
        # 업데이트할 필드들 적용
        if workspace_data.name is not None:
            workspace.name = workspace_data.name
        if workspace_data.description is not None:
            workspace.description = workspace_data.description
        if workspace_data.is_public is not None:
            workspace.is_public = workspace_data.is_public
        if workspace_data.is_active is not None:
            workspace.is_active = workspace_data.is_active
        
        await db.commit()
        await db.refresh(workspace)
        
        logger.info(f"Workspace {workspace_id} updated successfully")
        
        return WorkspaceResponse(
            id=workspace.id,
            name=workspace.name,
            description=workspace.description,
            owner_type=workspace.owner_type.value,
            owner_user_id=str(workspace.owner_user_id) if workspace.owner_user_id else None,
            is_active=workspace.is_active,
            is_public=workspace.is_public,
            created_at=workspace.created_at.isoformat(),
            updated_at=workspace.updated_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating workspace {workspace_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update workspace"
        )

@router.delete("/{workspace_id}", tags=["Workspaces"])
async def delete_workspace(
    workspace_id: int,
    current_user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    워크스페이스 삭제
    
    워크스페이스를 비활성화합니다. 소유자만 삭제 가능합니다.
    """
    logger.info(f"Deleting workspace {workspace_id} for user: {current_user.email}")
    
    try:
        stmt = select(MaxDPWorkspace).where(MaxDPWorkspace.id == workspace_id)
        result = await db.execute(stmt)
        workspace = result.scalar_one_or_none()
        
        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )
        
        # 소유자 확인
        if not workspace.is_owned_by_user(current_user.user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only workspace owner can delete this workspace"
            )
        
        # 소프트 삭제 (is_active를 False로 설정)
        workspace.is_active = False
        
        await db.commit()
        
        logger.info(f"Workspace {workspace_id} deleted successfully")
        
        return {"message": "Workspace deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting workspace {workspace_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete workspace"
        )
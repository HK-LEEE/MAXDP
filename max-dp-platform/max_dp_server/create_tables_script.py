#!/usr/bin/env python3
"""
MAXDP 테이블 생성 스크립트
PostgreSQL 데이터베이스에 필요한 테이블들을 생성합니다.
"""

import asyncio
import asyncpg
from sqlalchemy.ext.asyncio import create_async_engine
from app.models.maxdp_workspace_model import MaxDPWorkspace, MaxDPWorkspacePermission, MaxDPWorkspaceActivity
from app.models.maxdp_flow_model import MaxDPFlow, MaxDPFlowVersion, MaxDPFlowExecution
from app.db.maxdp_session import Base

# 데이터베이스 URL (환경에 맞게 수정하세요)
DATABASE_URL = "postgresql+asyncpg://postgres:your_db_password@localhost:5432/platform_integration"

async def create_tables():
    """테이블 생성"""
    try:
        # SQLAlchemy 엔진 생성
        engine = create_async_engine(DATABASE_URL, echo=True)
        
        # 모든 테이블 생성
        async with engine.begin() as conn:
            # enum 타입 먼저 생성
            await conn.execute(text("""
                CREATE TYPE IF NOT EXISTS ownertype AS ENUM ('user', 'group');
                CREATE TYPE IF NOT EXISTS flowstatus AS ENUM ('draft', 'active', 'inactive', 'archived');
                CREATE TYPE IF NOT EXISTS executionstatus AS ENUM ('pending', 'running', 'success', 'failed', 'cancelled');
            """))
            
            # 테이블 생성
            await conn.run_sync(Base.metadata.create_all)
            
        print("✅ 모든 테이블이 성공적으로 생성되었습니다.")
        
        # 샘플 데이터 삽입
        await insert_sample_data(engine)
        
        await engine.dispose()
        
    except Exception as e:
        print(f"❌ 테이블 생성 중 오류 발생: {e}")
        raise

async def insert_sample_data(engine):
    """샘플 데이터 삽입"""
    try:
        async with engine.begin() as conn:
            # 관리자 사용자 확인
            result = await conn.execute(text("""
                SELECT id FROM users WHERE email = 'admin@test.com' LIMIT 1
            """))
            admin_user = result.fetchone()
            
            if not admin_user:
                print("⚠️  admin@test.com 사용자를 찾을 수 없습니다. 샘플 데이터 생성을 건너뜁니다.")
                return
            
            admin_id = admin_user[0]
            
            # 샘플 워크스페이스 생성
            await conn.execute(text("""
                INSERT INTO maxdp_workspaces (name, description, owner_type, owner_user_id, created_by)
                VALUES (:name, :description, :owner_type, :owner_user_id, :created_by)
                ON CONFLICT DO NOTHING
            """), {
                'name': '기본 워크스페이스',
                'description': 'MAXDP 기본 워크스페이스입니다.',
                'owner_type': 'user',
                'owner_user_id': admin_id,
                'created_by': admin_id
            })
            
            # 워크스페이스 ID 가져오기
            result = await conn.execute(text("""
                SELECT id FROM maxdp_workspaces WHERE name = '기본 워크스페이스' LIMIT 1
            """))
            workspace = result.fetchone()
            
            if workspace:
                workspace_id = workspace[0]
                
                # 샘플 플로우 생성
                await conn.execute(text("""
                    INSERT INTO maxdp_flows (name, description, workspace_id, owner_type, owner_user_id, created_by, status)
                    VALUES (:name, :description, :workspace_id, :owner_type, :owner_user_id, :created_by, :status)
                    ON CONFLICT DO NOTHING
                """), {
                    'name': '샘플 데이터 플로우',
                    'description': '데이터 처리를 위한 샘플 플로우입니다.',
                    'workspace_id': workspace_id,
                    'owner_type': 'user',
                    'owner_user_id': admin_id,
                    'created_by': admin_id,
                    'status': 'draft'
                })
                
        print("✅ 샘플 데이터가 성공적으로 생성되었습니다.")
        
    except Exception as e:
        print(f"⚠️  샘플 데이터 생성 중 오류 발생: {e}")

async def main():
    """메인 함수"""
    print("🚀 MAXDP 테이블 생성을 시작합니다...")
    await create_tables()
    print("🎉 테이블 생성이 완료되었습니다!")

if __name__ == "__main__":
    # SQLAlchemy text import 추가
    from sqlalchemy import text
    
    # 실행
    asyncio.run(main())
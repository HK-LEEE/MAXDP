#!/usr/bin/env python3
"""
간단한 테이블 생성 스크립트 - SQLAlchemy 사용
"""
import asyncio
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.db.maxdp_session import db_manager
from app.models.maxdp_workspace_model import Base

async def create_tables():
    """테이블 생성"""
    try:
        print("🚀 MAXDP 테이블 생성을 시작합니다...")
        
        # 데이터베이스 초기화
        await db_manager.initialize()
        print("✅ 데이터베이스에 연결되었습니다.")
        
        # enum 타입들을 각각 별도 트랜잭션으로 생성
        for enum_name, enum_values in [
            ("ownertype", "('user', 'group')"),
            ("flowstatus", "('draft', 'active', 'inactive', 'archived')"),
            ("executionstatus", "('pending', 'running', 'success', 'failed', 'cancelled')")
        ]:
            try:
                async with db_manager.get_session() as session:
                    await session.execute(text(f"CREATE TYPE {enum_name} AS ENUM {enum_values};"))
                    print(f"✅ {enum_name} enum이 생성되었습니다.")
            except Exception as e:
                if "already exists" in str(e):
                    print(f"ℹ️  {enum_name} enum이 이미 존재합니다.")
                else:
                    print(f"⚠️  {enum_name} enum 생성 중 오류: {e}")
        
        # 세션 가져오기
        async with db_manager.get_session() as session:
            
            # maxdp_workspaces 테이블 생성
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS maxdp_workspaces (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    owner_type ownertype NOT NULL,
                    owner_user_id UUID,
                    owner_group_id INTEGER,
                    is_active BOOLEAN DEFAULT TRUE,
                    is_public BOOLEAN DEFAULT FALSE,
                    settings TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by UUID NOT NULL
                );
            """))
            print("✅ maxdp_workspaces 테이블이 생성되었습니다.")
            
            # maxdp_flows 테이블 생성
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS maxdp_flows (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    workspace_id INTEGER NOT NULL REFERENCES maxdp_workspaces(id),
                    owner_type ownertype NOT NULL,
                    owner_user_id UUID,
                    owner_group_id INTEGER,
                    status flowstatus DEFAULT 'draft',
                    is_public BOOLEAN DEFAULT FALSE,
                    tags JSONB,
                    current_version INTEGER DEFAULT 1,
                    latest_version INTEGER DEFAULT 1,
                    is_scheduled BOOLEAN DEFAULT FALSE,
                    schedule_config JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by UUID NOT NULL
                );
            """))
            print("✅ maxdp_flows 테이블이 생성되었습니다.")
            
            # maxdp_flow_versions 테이블 생성
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS maxdp_flow_versions (
                    id SERIAL PRIMARY KEY,
                    flow_id INTEGER NOT NULL REFERENCES maxdp_flows(id),
                    version_number INTEGER NOT NULL,
                    version_name VARCHAR(100),
                    description TEXT,
                    changelog TEXT,
                    flow_definition JSONB NOT NULL DEFAULT '{}',
                    components JSONB,
                    is_active BOOLEAN DEFAULT FALSE,
                    is_published BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by UUID NOT NULL
                );
            """))
            print("✅ maxdp_flow_versions 테이블이 생성되었습니다.")
            
            # maxdp_flow_executions 테이블 생성
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS maxdp_flow_executions (
                    id SERIAL PRIMARY KEY,
                    flow_id INTEGER NOT NULL REFERENCES maxdp_flows(id),
                    version_id INTEGER REFERENCES maxdp_flow_versions(id),
                    status executionstatus DEFAULT 'PENDING',
                    execution_id VARCHAR(100) UNIQUE NOT NULL,
                    trigger_type VARCHAR(50) NOT NULL,
                    trigger_user_id UUID,
                    start_time TIMESTAMP,
                    end_time TIMESTAMP,
                    duration_seconds INTEGER,
                    logs TEXT,
                    error_message TEXT,
                    result_data JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            print("✅ maxdp_flow_executions 테이블이 생성되었습니다.")
            
            # 인덱스 생성
            await session.execute(text("CREATE INDEX IF NOT EXISTS ix_maxdp_workspaces_id ON maxdp_workspaces(id);"))
            await session.execute(text("CREATE INDEX IF NOT EXISTS ix_maxdp_flows_id ON maxdp_flows(id);"))
            await session.execute(text("CREATE INDEX IF NOT EXISTS ix_maxdp_flow_versions_id ON maxdp_flow_versions(id);"))
            await session.execute(text("CREATE INDEX IF NOT EXISTS ix_maxdp_flow_executions_id ON maxdp_flow_executions(id);"))
            
            # 사용자 테이블이 있는지 확인
            result = await session.execute(text("SELECT to_regclass('users') IS NOT NULL as exists;"))
            users_exists = result.fetchone()[0]
            
            if users_exists:
                # 샘플 워크스페이스 생성 (admin 사용자가 있다면)
                result = await session.execute(text("SELECT id FROM users WHERE email = 'admin@test.com' LIMIT 1;"))
                admin_user = result.fetchone()
                
                if admin_user:
                    admin_id = admin_user[0]
                    
                    # 기본 워크스페이스가 없다면 생성
                    result = await session.execute(text("SELECT COUNT(*) FROM maxdp_workspaces WHERE name = '기본 워크스페이스';"))
                    workspace_count = result.fetchone()[0]
                    
                    if workspace_count == 0:
                        await session.execute(text("""
                            INSERT INTO maxdp_workspaces (name, description, owner_type, owner_user_id, created_by)
                            VALUES (:name, :description, :owner_type, :owner_user_id, :created_by)
                        """), {
                            'name': '기본 워크스페이스',
                            'description': 'MAXDP 기본 워크스페이스입니다.',
                            'owner_type': 'USER',
                            'owner_user_id': admin_id,
                            'created_by': admin_id
                        })
                        print("✅ 기본 워크스페이스가 생성되었습니다.")
                    else:
                        print("ℹ️  기본 워크스페이스가 이미 존재합니다.")
                else:
                    print("⚠️  admin@test.com 사용자를 찾을 수 없습니다.")
            else:
                print("⚠️  users 테이블이 존재하지 않습니다. 샘플 데이터 생성을 건너뜁니다.")
            
            await session.commit()
            
        await db_manager.close()
        print("🎉 모든 테이블이 성공적으로 생성되었습니다!")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        await db_manager.close()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(create_tables())
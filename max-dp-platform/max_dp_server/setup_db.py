#!/usr/bin/env python3
"""
간단한 데이터베이스 테이블 생성 스크립트
"""

import asyncio
import asyncpg
import sys

async def create_tables():
    """테이블 생성"""
    try:
        # 데이터베이스 연결 (패스워드 없이 시도)
        try:
            conn = await asyncpg.connect(
                host='localhost',
                port=5432,
                user='postgres',
                database='platform_integration'
            )
        except:
            # 패스워드 있는 경우 시도
            conn = await asyncpg.connect(
                host='localhost',
                port=5432,
                user='postgres',
                password='password',
                database='platform_integration'
            )
        
        print("✅ 데이터베이스에 연결되었습니다.")
        
        # enum 타입 생성
        await conn.execute("""
            CREATE TYPE IF NOT EXISTS ownertype AS ENUM ('user', 'group');
        """)
        print("✅ ownertype enum이 생성되었습니다.")
        
        await conn.execute("""
            CREATE TYPE IF NOT EXISTS flowstatus AS ENUM ('draft', 'active', 'inactive', 'archived');
        """)
        print("✅ flowstatus enum이 생성되었습니다.")
        
        await conn.execute("""
            CREATE TYPE IF NOT EXISTS executionstatus AS ENUM ('pending', 'running', 'success', 'failed', 'cancelled');
        """)
        print("✅ executionstatus enum이 생성되었습니다.")
        
        # maxdp_workspaces 테이블 생성
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS maxdp_workspaces (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                owner_type ownertype NOT NULL,
                owner_user_id UUID REFERENCES users(id),
                owner_group_id INTEGER,
                is_active BOOLEAN DEFAULT TRUE,
                is_public BOOLEAN DEFAULT FALSE,
                settings TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by UUID NOT NULL REFERENCES users(id)
            );
        """)
        print("✅ maxdp_workspaces 테이블이 생성되었습니다.")
        
        # maxdp_flows 테이블 생성
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS maxdp_flows (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                workspace_id INTEGER NOT NULL REFERENCES maxdp_workspaces(id),
                owner_type ownertype NOT NULL,
                owner_user_id UUID REFERENCES users(id),
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
                created_by UUID NOT NULL REFERENCES users(id)
            );
        """)
        print("✅ maxdp_flows 테이블이 생성되었습니다.")
        
        # maxdp_flow_versions 테이블 생성
        await conn.execute("""
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
                created_by UUID NOT NULL REFERENCES users(id)
            );
        """)
        print("✅ maxdp_flow_versions 테이블이 생성되었습니다.")
        
        # maxdp_flow_executions 테이블 생성
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS maxdp_flow_executions (
                id SERIAL PRIMARY KEY,
                flow_id INTEGER NOT NULL REFERENCES maxdp_flows(id),
                version_id INTEGER REFERENCES maxdp_flow_versions(id),
                status executionstatus DEFAULT 'pending',
                execution_id VARCHAR(100) UNIQUE NOT NULL,
                trigger_type VARCHAR(50) NOT NULL,
                trigger_user_id UUID REFERENCES users(id),
                start_time TIMESTAMP,
                end_time TIMESTAMP,
                duration_seconds INTEGER,
                logs TEXT,
                error_message TEXT,
                result_data JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        print("✅ maxdp_flow_executions 테이블이 생성되었습니다.")
        
        # 샘플 데이터 삽입
        admin_users = await conn.fetch("SELECT id FROM users WHERE email = 'admin@test.com' LIMIT 1")
        if admin_users:
            admin_id = admin_users[0]['id']
            
            # 샘플 워크스페이스 생성
            await conn.execute("""
                INSERT INTO maxdp_workspaces (name, description, owner_type, owner_user_id, created_by)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT DO NOTHING
            """, '기본 워크스페이스', 'MAXDP 기본 워크스페이스입니다.', 'user', admin_id, admin_id)
            
            # 워크스페이스 ID 가져오기
            workspaces = await conn.fetch("SELECT id FROM maxdp_workspaces WHERE name = '기본 워크스페이스' LIMIT 1")
            if workspaces:
                workspace_id = workspaces[0]['id']
                
                # 샘플 플로우 생성
                await conn.execute("""
                    INSERT INTO maxdp_flows (name, description, workspace_id, owner_type, owner_user_id, created_by, status)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT DO NOTHING
                """, '샘플 데이터 플로우', '데이터 처리를 위한 샘플 플로우입니다.', workspace_id, 'user', admin_id, admin_id, 'draft')
                
            print("✅ 샘플 데이터가 생성되었습니다.")
        else:
            print("⚠️  admin@test.com 사용자를 찾을 수 없습니다. 샘플 데이터 생성을 건너뜁니다.")
        
        await conn.close()
        print("🎉 모든 테이블이 성공적으로 생성되었습니다!")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print("🚀 MAXDP 테이블 생성을 시작합니다...")
    asyncio.run(create_tables())
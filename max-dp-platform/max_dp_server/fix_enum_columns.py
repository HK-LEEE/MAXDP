#!/usr/bin/env python3
"""
Enum 컬럼 타입 수정 스크립트
flowstatus, executionstatus enum 컬럼을 VARCHAR로 변경합니다.
"""
import asyncio
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.db.maxdp_session import db_manager

async def fix_enum_columns():
    """enum 컬럼 타입을 VARCHAR로 변경"""
    try:
        await db_manager.initialize()
        print("✅ 데이터베이스에 연결되었습니다.")
        
        async with db_manager.get_session() as session:
            # maxdp_flows 테이블의 status 컬럼을 VARCHAR로 변경
            await session.execute(text("""
                ALTER TABLE maxdp_flows 
                ALTER COLUMN status TYPE VARCHAR(20) 
                USING status::text;
            """))
            print("✅ maxdp_flows.status 컬럼이 VARCHAR(20)로 변경되었습니다.")
            
            # maxdp_flow_executions 테이블의 status 컬럼을 VARCHAR로 변경
            await session.execute(text("""
                ALTER TABLE maxdp_flow_executions 
                ALTER COLUMN status TYPE VARCHAR(20) 
                USING status::text;
            """))
            print("✅ maxdp_flow_executions.status 컬럼이 VARCHAR(20)로 변경되었습니다.")
            
            await session.commit()
            
        await db_manager.close()
        print("🎉 모든 enum 컬럼이 성공적으로 VARCHAR로 변경되었습니다!")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        await db_manager.close()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(fix_enum_columns())
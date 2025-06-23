#!/usr/bin/env python3
"""
컬럼 타입 확인 스크립트
"""
import asyncio
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.db.maxdp_session import db_manager

async def check_column_types():
    """컬럼 타입 확인"""
    try:
        await db_manager.initialize()
        print("✅ 데이터베이스에 연결되었습니다.")
        
        async with db_manager.get_session() as session:
            # 테이블 컬럼 정보 조회
            result = await session.execute(text("""
                SELECT table_name, column_name, data_type, udt_name
                FROM information_schema.columns 
                WHERE table_name IN ('maxdp_flows', 'maxdp_flow_executions') 
                AND column_name = 'status'
                ORDER BY table_name, column_name;
            """))
            
            columns = result.fetchall()
            
            print("\n현재 status 컬럼 타입들:")
            for table_name, column_name, data_type, udt_name in columns:
                print(f"  {table_name}.{column_name}: {data_type} ({udt_name})")
            
        await db_manager.close()
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        await db_manager.close()

if __name__ == "__main__":
    asyncio.run(check_column_types())
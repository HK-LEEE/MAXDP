#!/usr/bin/env python3
"""
Enum 확인 스크립트
"""
import asyncio
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.db.maxdp_session import db_manager

async def check_enums():
    """enum 타입 확인"""
    try:
        await db_manager.initialize()
        print("✅ 데이터베이스에 연결되었습니다.")
        
        async with db_manager.get_session() as session:
            # 현재 존재하는 enum 타입들 확인
            result = await session.execute(text("""
                SELECT t.typname, e.enumlabel 
                FROM pg_type t 
                JOIN pg_enum e ON t.oid = e.enumtypid  
                WHERE t.typname IN ('ownertype', 'flowstatus', 'executionstatus')
                ORDER BY t.typname, e.enumsortorder;
            """))
            
            enums = result.fetchall()
            
            print("\n현재 데이터베이스의 enum 타입들:")
            current_enum = None
            for enum_name, enum_value in enums:
                if current_enum != enum_name:
                    print(f"\n{enum_name}:")
                    current_enum = enum_name
                print(f"  - {enum_value}")
            
            # 기존 테이블 확인
            result = await session.execute(text("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name LIKE 'maxdp_%'
                ORDER BY table_name;
            """))
            
            tables = [row[0] for row in result.fetchall()]
            print(f"\n현재 존재하는 MAXDP 테이블들: {tables}")
            
        await db_manager.close()
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        await db_manager.close()

if __name__ == "__main__":
    asyncio.run(check_enums())
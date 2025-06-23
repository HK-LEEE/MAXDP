#!/usr/bin/env python3
"""
현재 존재하는 플로우 확인 스크립트
"""
import asyncio
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.db.maxdp_session import db_manager

async def check_flows():
    """현재 존재하는 플로우들 확인"""
    try:
        await db_manager.initialize()
        print("✅ 데이터베이스에 연결되었습니다.")
        
        async with db_manager.get_session() as session:
            # 현재 존재하는 플로우들 조회
            result = await session.execute(text("""
                SELECT f.id, f.name, f.workspace_id, f.owner_type, f.status, f.created_at
                FROM maxdp_flows f
                ORDER BY f.created_at DESC;
            """))
            
            flows = result.fetchall()
            
            print(f"\n현재 존재하는 플로우들 ({len(flows)}개):")
            if flows:
                print("ID | 이름 | 워크스페이스 | 소유자타입 | 상태 | 생성시간")
                print("-" * 80)
                for flow_id, name, workspace_id, owner_type, status, created_at in flows:
                    print(f"{flow_id:2} | {name:10} | {workspace_id:8} | {owner_type:8} | {status:6} | {created_at}")
            else:
                print("  (플로우가 없습니다)")
            
        await db_manager.close()
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        await db_manager.close()

if __name__ == "__main__":
    asyncio.run(check_flows())
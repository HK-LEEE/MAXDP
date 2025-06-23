#!/usr/bin/env python3
"""
테스트 플로우 삭제 스크립트
"""
import asyncio
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.db.maxdp_session import db_manager

async def clear_test_flows():
    """테스트 플로우들 삭제"""
    try:
        await db_manager.initialize()
        print("✅ 데이터베이스에 연결되었습니다.")
        
        async with db_manager.get_session() as session:
            # 현재 플로우들 조회
            result = await session.execute(text("""
                SELECT f.id, f.name, f.workspace_id
                FROM maxdp_flows f
                ORDER BY f.created_at DESC;
            """))
            
            flows = result.fetchall()
            print(f"\n삭제 전 플로우들 ({len(flows)}개):")
            for flow_id, name, workspace_id in flows:
                print(f"  {flow_id}: {name} (workspace: {workspace_id})")
            
            if flows:
                # 플로우 버전들 먼저 삭제
                await session.execute(text("""
                    DELETE FROM maxdp_flow_versions 
                    WHERE flow_id IN (SELECT id FROM maxdp_flows);
                """))
                print("✅ 플로우 버전들이 삭제되었습니다.")
                
                # 플로우 실행 기록 삭제
                await session.execute(text("""
                    DELETE FROM maxdp_flow_executions 
                    WHERE flow_id IN (SELECT id FROM maxdp_flows);
                """))
                print("✅ 플로우 실행 기록들이 삭제되었습니다.")
                
                # 플로우들 삭제
                await session.execute(text("""
                    DELETE FROM maxdp_flows;
                """))
                print("✅ 모든 플로우들이 삭제되었습니다.")
                
                await session.commit()
                
                # 삭제 후 확인
                result = await session.execute(text("SELECT COUNT(*) FROM maxdp_flows;"))
                count = result.fetchone()[0]
                print(f"\n삭제 후 플로우 수: {count}개")
            else:
                print("삭제할 플로우가 없습니다.")
            
        await db_manager.close()
        print("🎉 테스트 플로우 정리가 완료되었습니다!")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        await db_manager.close()

if __name__ == "__main__":
    asyncio.run(clear_test_flows())
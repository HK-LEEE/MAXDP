#!/usr/bin/env python3
"""
플로우 버전 확인 스크립트
"""
import asyncio
import sys
import os
import json

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.db.maxdp_session import db_manager

async def check_flow_versions():
    """플로우 버전들 확인"""
    try:
        await db_manager.initialize()
        print("✅ 데이터베이스에 연결되었습니다.")
        
        async with db_manager.get_session() as session:
            # 최근 플로우 버전들 조회
            result = await session.execute(text("""
                SELECT fv.id, fv.flow_id, fv.version_number, fv.version_name, 
                       fv.description, fv.changelog, fv.flow_definition,
                       f.name as flow_name, fv.created_at
                FROM maxdp_flow_versions fv
                JOIN maxdp_flows f ON fv.flow_id = f.id
                ORDER BY fv.created_at DESC
                LIMIT 10;
            """))
            
            versions = result.fetchall()
            
            print(f"\n최근 플로우 버전들 ({len(versions)}개):")
            print("ID | 플로우ID | 버전 | 플로우명 | 설명 | 생성시간")
            print("-" * 100)
            
            for version_id, flow_id, version_number, version_name, description, changelog, flow_definition, flow_name, created_at in versions:
                print(f"{version_id:2} | {flow_id:6} | {version_number:4} | {flow_name:10} | {description:15} | {created_at}")
                
                # flow_definition 내용 확인
                if flow_definition:
                    print(f"    플로우 정의 길이: {len(str(flow_definition))} 문자")
                    if isinstance(flow_definition, dict):
                        nodes = flow_definition.get('nodes', [])
                        edges = flow_definition.get('edges', [])
                        print(f"    노드 수: {len(nodes)}, 엣지 수: {len(edges)}")
                        
                        # 첫 번째 노드 정보 출력
                        if nodes:
                            first_node = nodes[0]
                            print(f"    첫 번째 노드: ID={first_node.get('id')}, 타입={first_node.get('type')}, 라벨={first_node.get('data', {}).get('label')}")
                    else:
                        print(f"    플로우 정의 타입: {type(flow_definition)}")
                        print(f"    플로우 정의 내용 (처음 200자): {str(flow_definition)[:200]}")
                else:
                    print("    플로우 정의: 비어있음")
                print()
            
        await db_manager.close()
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        await db_manager.close()

if __name__ == "__main__":
    asyncio.run(check_flow_versions())
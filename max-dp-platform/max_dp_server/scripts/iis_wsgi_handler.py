"""
IIS 연동을 위한 WSGI 핸들러
CLAUDE.local.md 가이드라인에 따른 IIS + Waitress 연동 설정

IIS에서 FastAPI 애플리케이션을 호스팅하기 위한 WSGI 어댑터입니다.
"""

import sys
import os
from pathlib import Path

# 프로젝트 경로 설정
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# 환경 변수 설정 (IIS 환경용)
os.environ.setdefault("PYTHONPATH", str(project_root))
os.environ.setdefault("MAX_DP_SERVER_PORT", "8001")
os.environ.setdefault("DEBUG", "false")

# FastAPI 앱 import
from app.maxdp_main import app
from waitress import serve

def get_wsgi_application():
    """
    IIS용 WSGI 애플리케이션 반환
    wfastcgi 모듈과 함께 사용됩니다.
    """
    return app

def run_waitress_server():
    """
    Waitress WSGI 서버로 직접 실행
    IIS 없이 테스트할 때 사용합니다.
    """
    from app.maxdp_config import settings
    
    print(f"Starting Waitress server on http://0.0.0.0:{settings.max_dp_server_port}")
    print("Press Ctrl+C to stop the server")
    
    serve(
        app,
        host="0.0.0.0",
        port=settings.max_dp_server_port,
        threads=4,  # 스레드 수
        backlog=1024,  # 백로그 크기
        max_request_header_size=16384,  # 최대 헤더 크기
        max_request_body_size=1073741824,  # 최대 요청 바디 크기 (1GB)
        channel_timeout=120,  # 채널 타임아웃
        cleanup_interval=30,  # 정리 간격
        # Windows 환경 최적화
        send_bytes=18000,  # 전송 바이트 수
    )

# WSGI 애플리케이션 (IIS에서 참조)
application = get_wsgi_application()

if __name__ == "__main__":
    # 직접 실행 시 Waitress 서버로 실행
    run_waitress_server()
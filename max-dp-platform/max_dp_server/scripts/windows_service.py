"""
MAX DP Server Windows 서비스 관리
Windows 환경에서 MAX DP 서버를 Windows 서비스로 등록 및 관리합니다.

CLAUDE.local.md 가이드라인에 따라 Windows 서비스로 백엔드 프로세스를 등록합니다.
"""

import sys
import os
import time
import logging
import multiprocessing
from pathlib import Path

try:
    import win32serviceutil
    import win32service
    import win32event
    import servicemanager
    import socket
except ImportError:
    print("pywin32 패키지가 설치되지 않았습니다. Windows에서만 사용 가능합니다.")
    sys.exit(1)

# 프로젝트 루트 경로를 sys.path에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from app.maxdp_main import app
from app.maxdp_config import settings
import uvicorn

class MaxDPService(win32serviceutil.ServiceFramework):
    """MAX DP Windows 서비스 클래스"""
    
    _svc_name_ = "MaxDPServer"
    _svc_display_name_ = "MAX DP Server Service"
    _svc_description_ = "MAX DP 데이터 파이프라인 플랫폼 서버"
    
    def __init__(self, args):
        win32serviceutil.ServiceFramework.__init__(self, args)
        self.hWaitStop = win32event.CreateEvent(None, 0, 0, None)
        self.server_process = None
        socket.setdefaulttimeout(60)
        
        # 로깅 설정
        self.setup_logging()
    
    def setup_logging(self):
        """서비스 로깅 설정"""
        log_dir = Path(project_root) / "logs"
        log_dir.mkdir(exist_ok=True)
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_dir / "maxdp_service.log"),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger("MaxDPService")
    
    def SvcStop(self):
        """서비스 중지"""
        self.logger.info("MAX DP Service stopping...")
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        
        if self.server_process and self.server_process.is_alive():
            self.server_process.terminate()
            self.server_process.join(timeout=10)
            
            if self.server_process.is_alive():
                self.logger.warning("Force killing server process")
                self.server_process.kill()
        
        win32event.SetEvent(self.hWaitStop)
        self.logger.info("MAX DP Service stopped")
    
    def SvcDoRun(self):
        """서비스 실행"""
        servicemanager.LogMsg(
            servicemanager.EVENTLOG_INFORMATION_TYPE,
            servicemanager.PYS_SERVICE_STARTED,
            (self._svc_name_, '')
        )
        
        self.logger.info("MAX DP Service starting...")
        self.main()
    
    def main(self):
        """메인 서비스 로직"""
        try:
            # 서버 프로세스 시작
            self.server_process = multiprocessing.Process(
                target=self.run_server,
                daemon=True
            )
            self.server_process.start()
            self.logger.info(f"MAX DP Server started on port {settings.max_dp_server_port}")
            
            # 서비스 상태를 실행 중으로 설정
            self.ReportServiceStatus(win32service.SERVICE_RUNNING)
            
            # 중지 신호를 기다림
            win32event.WaitForSingleObject(self.hWaitStop, win32event.INFINITE)
            
        except Exception as e:
            self.logger.error(f"Service error: {e}")
            servicemanager.LogErrorMsg(f"MAX DP Service error: {e}")
    
    def run_server(self):
        """Uvicorn 서버 실행"""
        try:
            uvicorn.run(
                app,
                host="0.0.0.0",
                port=settings.max_dp_server_port,
                log_level=settings.log_level.lower(),
                access_log=False,  # 서비스에서는 액세스 로그 비활성화
            )
        except Exception as e:
            self.logger.error(f"Server error: {e}")

def install_service():
    """서비스 설치"""
    try:
        win32serviceutil.InstallService(
            MaxDPService,
            MaxDPService._svc_name_,
            MaxDPService._svc_display_name_,
            description=MaxDPService._svc_description_
        )
        print(f"✅ {MaxDPService._svc_display_name_} 서비스가 설치되었습니다.")
    except Exception as e:
        print(f"❌ 서비스 설치 실패: {e}")

def remove_service():
    """서비스 제거"""
    try:
        win32serviceutil.RemoveService(MaxDPService._svc_name_)
        print(f"✅ {MaxDPService._svc_display_name_} 서비스가 제거되었습니다.")
    except Exception as e:
        print(f"❌ 서비스 제거 실패: {e}")

def start_service():
    """서비스 시작"""
    try:
        win32serviceutil.StartService(MaxDPService._svc_name_)
        print(f"✅ {MaxDPService._svc_display_name_} 서비스가 시작되었습니다.")
    except Exception as e:
        print(f"❌ 서비스 시작 실패: {e}")

def stop_service():
    """서비스 중지"""
    try:
        win32serviceutil.StopService(MaxDPService._svc_name_)
        print(f"✅ {MaxDPService._svc_display_name_} 서비스가 중지되었습니다.")
    except Exception as e:
        print(f"❌ 서비스 중지 실패: {e}")

def restart_service():
    """서비스 재시작"""
    try:
        win32serviceutil.RestartService(MaxDPService._svc_name_)
        print(f"✅ {MaxDPService._svc_display_name_} 서비스가 재시작되었습니다.")
    except Exception as e:
        print(f"❌ 서비스 재시작 실패: {e}")

def service_status():
    """서비스 상태 확인"""
    try:
        status = win32serviceutil.QueryServiceStatus(MaxDPService._svc_name_)
        status_map = {
            win32service.SERVICE_STOPPED: "중지됨",
            win32service.SERVICE_START_PENDING: "시작 중",
            win32service.SERVICE_STOP_PENDING: "중지 중",
            win32service.SERVICE_RUNNING: "실행 중",
            win32service.SERVICE_CONTINUE_PENDING: "계속 중",
            win32service.SERVICE_PAUSE_PENDING: "일시정지 중",
            win32service.SERVICE_PAUSED: "일시정지"
        }
        
        current_status = status_map.get(status[1], "알 수 없음")
        print(f"📊 {MaxDPService._svc_display_name_} 상태: {current_status}")
        
    except Exception as e:
        print(f"❌ 서비스 상태 확인 실패: {e}")

def main():
    """메인 명령어 처리"""
    if len(sys.argv) == 1:
        # GUI 모드로 서비스 실행
        servicemanager.Initialize()
        servicemanager.PrepareToHostSingle(MaxDPService)
        servicemanager.StartServiceCtrlDispatcher()
    else:
        command = sys.argv[1].lower()
        
        if command == 'install':
            install_service()
        elif command == 'remove':
            remove_service()
        elif command == 'start':
            start_service()
        elif command == 'stop':
            stop_service()
        elif command == 'restart':
            restart_service()
        elif command == 'status':
            service_status()
        elif command == 'debug':
            # 디버그 모드로 직접 실행
            service = MaxDPService([])
            service.main()
        else:
            print("""
MAX DP Windows 서비스 관리 도구

사용법:
    python windows_service.py install    - 서비스 설치
    python windows_service.py remove     - 서비스 제거
    python windows_service.py start      - 서비스 시작
    python windows_service.py stop       - 서비스 중지
    python windows_service.py restart    - 서비스 재시작
    python windows_service.py status     - 서비스 상태 확인
    python windows_service.py debug      - 디버그 모드로 실행
    
관리자 권한이 필요합니다.
            """)

if __name__ == '__main__':
    main()
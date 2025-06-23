@echo off
REM MAX DP Server Windows 서비스 설치 스크립트
REM CLAUDE.local.md 가이드라인에 따른 Windows 서비스 배포

echo ================================================
echo MAX DP Server Windows 서비스 설치
echo ================================================

REM 관리자 권한 확인
net session >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ 관리자 권한으로 실행 중...
) else (
    echo ❌ 관리자 권한이 필요합니다.
    echo 우클릭 후 "관리자 권한으로 실행"을 선택해주세요.
    pause
    exit /b 1
)

REM 현재 디렉토리를 스크립트 디렉토리로 변경
cd /d "%~dp0"
cd ..

echo 📁 현재 작업 디렉토리: %CD%

REM Python 가상환경 활성화
if exist "venv\Scripts\activate.bat" (
    echo 🐍 Python 가상환경 활성화...
    call venv\Scripts\activate.bat
) else (
    echo ⚠️ Python 가상환경을 찾을 수 없습니다.
    echo venv 디렉토리에 가상환경을 생성해주세요.
    pause
    exit /b 1
)

REM 의존성 설치
echo 📦 Windows 전용 의존성 설치...
pip install -r requirements-windows.txt

REM 서비스 설치
echo 🔧 Windows 서비스 설치 중...
python scripts\windows_service.py install

if %errorLevel% == 0 (
    echo ✅ MAX DP Server 서비스가 성공적으로 설치되었습니다.
    echo.
    echo 다음 명령어로 서비스를 관리할 수 있습니다:
    echo   서비스 시작: python scripts\windows_service.py start
    echo   서비스 중지: python scripts\windows_service.py stop
    echo   서비스 상태: python scripts\windows_service.py status
    echo.
    echo Windows 서비스 관리자에서도 확인할 수 있습니다.
) else (
    echo ❌ 서비스 설치에 실패했습니다.
)

pause
@echo off
REM MAX DP Server Windows 환경 설정 스크립트
REM CLAUDE.local.md 가이드라인에 따른 Windows 개발 환경 구성

echo ================================================
echo MAX DP Server Windows 환경 설정
echo ================================================

REM 현재 디렉토리를 스크립트 디렉토리로 변경
cd /d "%~dp0"
cd ..

echo 📁 현재 작업 디렉토리: %CD%

REM Python 설치 확인
python --version >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ Python이 설치되어 있습니다.
    python --version
) else (
    echo ❌ Python이 설치되지 않았습니다.
    echo Python 3.8 이상을 설치해주세요.
    pause
    exit /b 1
)

REM pip 업그레이드
echo 📦 pip 업그레이드...
python -m pip install --upgrade pip

REM 가상환경 생성
if not exist "venv" (
    echo 🐍 Python 가상환경 생성...
    python -m venv venv
) else (
    echo ✅ 가상환경이 이미 존재합니다.
)

REM 가상환경 활성화
echo 🐍 가상환경 활성화...
call venv\Scripts\activate.bat

REM 기본 의존성 설치
echo 📦 기본 의존성 설치...
pip install -r requirements.txt

REM 개발 의존성 설치 (선택사항)
set /p install_dev="개발 도구를 설치하시겠습니까? (y/N): "
if /i "%install_dev%"=="y" (
    echo 📦 개발 의존성 설치...
    pip install -r requirements-dev.txt
)

REM Windows 전용 의존성 설치
set /p install_windows="Windows 서비스 도구를 설치하시겠습니까? (y/N): "
if /i "%install_windows%"=="y" (
    echo 📦 Windows 전용 의존성 설치...
    pip install -r requirements-windows.txt
)

REM 환경 설정 파일 생성
if not exist ".env" (
    echo 📝 환경 설정 파일 생성...
    copy .env.example .env
    echo ⚠️ .env 파일을 편집하여 설정을 완료해주세요.
) else (
    echo ✅ 환경 설정 파일이 이미 존재합니다.
)

REM 로그 디렉토리 생성
if not exist "logs" (
    echo 📁 로그 디렉토리 생성...
    mkdir logs
)

REM PostgreSQL 설치 확인
echo.
echo 📋 PostgreSQL 설치 확인...
psql --version >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ PostgreSQL이 설치되어 있습니다.
    psql --version
) else (
    echo ⚠️ PostgreSQL이 설치되지 않았습니다.
    echo PostgreSQL을 설치하고 데이터베이스를 생성해주세요.
)

REM Redis 설치 확인
echo.
echo 📋 Redis 설치 확인...
redis-cli --version >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ Redis가 설치되어 있습니다.
    redis-cli --version
) else (
    echo ⚠️ Redis가 설치되지 않았습니다.
    echo Windows용 Redis를 설치해주세요.
    echo 다운로드: https://github.com/microsoftarchive/redis/releases
)

echo.
echo ================================================
echo ✅ Windows 환경 설정이 완료되었습니다!
echo ================================================
echo.
echo 다음 단계:
echo 1. .env 파일을 편집하여 데이터베이스 연결 정보를 입력하세요
echo 2. PostgreSQL 데이터베이스를 생성하세요
echo 3. 데이터베이스 마이그레이션을 실행하세요: alembic upgrade head
echo 4. 서버를 시작하세요: python -m app.maxdp_main
echo.
echo Windows 서비스로 설치하려면:
echo   scripts\install_windows_service.bat
echo.

pause
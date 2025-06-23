@echo off
REM MAX DP Server 테스트 실행 스크립트
REM CLAUDE.local.md 가이드라인에 따른 포괄적 테스트 실행

echo ================================================
echo MAX DP Server 테스트 실행
echo ================================================

REM 현재 디렉토리를 스크립트 디렉토리로 변경
cd /d "%~dp0"
cd ..

echo 📁 현재 작업 디렉토리: %CD%

REM Python 가상환경 활성화
if exist "venv\Scripts\activate.bat" (
    echo 🐍 Python 가상환경 활성화...
    call venv\Scripts\activate.bat
) else (
    echo ❌ Python 가상환경을 찾을 수 없습니다.
    pause
    exit /b 1
)

REM 테스트 전 환경 확인
echo 📋 테스트 환경 확인...

REM Redis 연결 확인
redis-cli ping >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ Redis 연결 가능
) else (
    echo ⚠️ Redis에 연결할 수 없습니다. 큐 시스템 테스트가 실패할 수 있습니다.
)

REM PostgreSQL 연결 확인 (선택적)
psql -U postgres -d maxdp_test -c "\l" >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ PostgreSQL 테스트 데이터베이스 연결 가능
) else (
    echo ⚠️ PostgreSQL 테스트 데이터베이스에 연결할 수 없습니다.
    echo   테스트 데이터베이스 'maxdp_test'를 생성해주세요.
)

echo.
echo 🧪 테스트 실행 시작...
echo.

REM 명령행 인수에 따른 테스트 실행
if "%1"=="unit" (
    echo 📊 단위 테스트만 실행...
    pytest -m unit --cov=app --cov-report=html --cov-report=term
) else if "%1"=="integration" (
    echo 🔗 통합 테스트만 실행...
    pytest -m integration --tb=long
) else if "%1"=="e2e" (
    echo 🎭 E2E 테스트만 실행...
    echo   주의: E2E 테스트는 프론트엔드 서버가 실행 중이어야 합니다.
    playwright install chromium
    pytest -m e2e --tb=long --video=on --screenshot=on
) else if "%1"=="slow" (
    echo 🐌 느린 테스트 포함하여 실행...
    pytest --tb=long
) else if "%1"=="windows" (
    echo 🪟 Windows 전용 테스트만 실행...
    pytest -m windows --tb=long
) else if "%1"=="coverage" (
    echo 📈 커버리지 포함하여 전체 테스트 실행...
    pytest --cov=app --cov-report=html --cov-report=term --cov-report=xml
    echo.
    echo 📊 커버리지 리포트가 htmlcov/ 디렉토리에 생성되었습니다.
) else if "%1"=="quick" (
    echo ⚡ 빠른 테스트만 실행 (단위 + 통합, E2E 제외)...
    pytest -m "unit or integration" --tb=short
) else (
    echo 🚀 기본 테스트 실행 (단위 + 통합 테스트, 느린 테스트 제외)...
    pytest -m "not slow and not e2e" --tb=short
)

if %errorLevel% == 0 (
    echo.
    echo ✅ 모든 테스트가 성공적으로 완료되었습니다!
) else (
    echo.
    echo ❌ 일부 테스트가 실패했습니다.
    echo 자세한 내용은 위의 출력을 확인해주세요.
)

echo.
echo ================================================
echo 테스트 실행 옵션:
echo   run_tests.bat unit        - 단위 테스트만
echo   run_tests.bat integration - 통합 테스트만  
echo   run_tests.bat e2e         - E2E 테스트만
echo   run_tests.bat windows     - Windows 전용 테스트
echo   run_tests.bat coverage    - 커버리지 포함 전체 테스트
echo   run_tests.bat quick       - 빠른 테스트 (E2E 제외)
echo   run_tests.bat slow        - 느린 테스트 포함
echo ================================================

pause
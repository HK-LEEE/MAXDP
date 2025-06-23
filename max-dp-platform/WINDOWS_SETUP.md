# MAX DP Windows 설치 및 배포 가이드

CLAUDE.local.md 가이드라인에 따른 Windows 환경에서의 MAX DP 서버 설치, 설정, 배포 가이드입니다.

## 📋 목차

1. [시스템 요구사항](#시스템-요구사항)
2. [필수 소프트웨어 설치](#필수-소프트웨어-설치)
3. [개발 환경 설정](#개발-환경-설정)
4. [Windows 서비스 배포](#windows-서비스-배포)
5. [IIS 배포](#iis-배포)
6. [테스트](#테스트)
7. [모니터링 및 로깅](#모니터링-및-로깅)
8. [문제 해결](#문제-해결)

## 시스템 요구사항

### 최소 요구사항
- **운영체제**: Windows 10 Pro / Windows Server 2019 이상
- **CPU**: 2 Core 이상
- **메모리**: 4GB RAM 이상
- **디스크**: 10GB 이상 여유 공간
- **네트워크**: 인터넷 연결 (패키지 다운로드용)

### 권장 요구사항
- **운영체제**: Windows 11 Pro / Windows Server 2022
- **CPU**: 4 Core 이상
- **메모리**: 8GB RAM 이상
- **디스크**: 50GB 이상 SSD
- **네트워크**: 1Gbps 이상

## 필수 소프트웨어 설치

### 1. Python 설치
```powershell
# Chocolatey를 통한 설치 (권장)
choco install python --version=3.11.0

# 또는 직접 다운로드
# https://www.python.org/downloads/windows/
```

### 2. PostgreSQL 설치
```powershell
# Chocolatey를 통한 설치
choco install postgresql

# 수동 설치: https://www.postgresql.org/download/windows/
```

### 3. Redis 설치
```powershell
# Windows용 Redis 다운로드 및 설치
# https://github.com/microsoftarchive/redis/releases

# 설치 후 서비스 시작
net start Redis
```

### 4. Git 설치
```powershell
choco install git
```

## 개발 환경 설정

### 1. 프로젝트 클론
```bash
git clone <your-repository-url>
cd max-dp-platform/max_dp_server
```

### 2. 자동 환경 설정
```cmd
# 관리자 권한으로 실행
scripts\setup_windows_environment.bat
```

### 3. 수동 환경 설정 (선택)
```cmd
# Python 가상환경 생성
python -m venv venv
venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt
pip install -r requirements-windows.txt

# 환경 설정 파일 생성
copy .env.windows.example .env
```

### 4. 데이터베이스 설정
```sql
-- PostgreSQL에 연결
psql -U postgres

-- 데이터베이스 생성
CREATE DATABASE platform_integration;
CREATE USER maxdp_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE platform_integration TO maxdp_user;
```

### 5. 환경 변수 설정 (.env 파일)
```env
# 데이터베이스 설정
DATABASE_URL=postgresql+asyncpg://maxdp_user:your_password@localhost:5432/platform_integration

# Redis 설정
REDIS_URL=redis://localhost:6379/0

# 서버 설정
MAX_DP_SERVER_PORT=8001
DEBUG=false

# 인증 설정
AUTH_SERVER_URL=http://localhost:8000
JWT_SECRET_KEY=your-production-secret-key

# 로깅 설정
LOG_LEVEL=INFO
```

### 6. 데이터베이스 마이그레이션
```cmd
# 가상환경 활성화
venv\Scripts\activate

# Alembic 마이그레이션 실행
alembic upgrade head
```

## Windows 서비스 배포

### 1. 서비스 설치
```cmd
# 관리자 권한으로 실행
scripts\install_windows_service.bat
```

### 2. 수동 서비스 관리
```cmd
# 가상환경 활성화
venv\Scripts\activate

# 서비스 설치
python scripts\windows_service.py install

# 서비스 시작
python scripts\windows_service.py start

# 서비스 상태 확인
python scripts\windows_service.py status

# 서비스 중지
python scripts\windows_service.py stop

# 서비스 제거
python scripts\windows_service.py remove
```

### 3. Windows 서비스 관리자를 통한 관리
```
1. services.msc 실행
2. "MAX DP Server Service" 찾기
3. 우클릭 → 속성
4. 시작 유형을 "자동"으로 설정 (부팅 시 자동 시작)
```

## IIS 배포

### 1. IIS 및 필수 기능 설치
```powershell
# PowerShell을 관리자 권한으로 실행
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServer
Enable-WindowsOptionalFeature -Online -FeatureName IIS-CommonHttpFeatures
Enable-WindowsOptionalFeature -Online -FeatureName IIS-HttpErrors
Enable-WindowsOptionalFeature -Online -FeatureName IIS-HttpLogging
Enable-WindowsOptionalFeature -Online -FeatureName IIS-RequestFiltering
Enable-WindowsOptionalFeature -Online -FeatureName IIS-StaticContent
Enable-WindowsOptionalFeature -Online -FeatureName IIS-ASPNET45
```

### 2. wfastcgi 설치 및 설정
```cmd
# 가상환경에서 wfastcgi 설치
pip install wfastcgi

# wfastcgi 활성화
wfastcgi-enable
```

### 3. IIS 사이트 생성
```
1. IIS 관리자 실행
2. Sites → Add Website
3. Site name: MAX DP Server
4. Physical path: C:\inetpub\wwwroot\maxdp-server
5. Port: 8001
```

### 4. 프로젝트 파일 배포
```cmd
# 프로젝트 파일을 IIS 디렉토리로 복사
xcopy /E /I . C:\inetpub\wwwroot\maxdp-server

# web.config 파일 복사
copy scripts\web.config C:\inetpub\wwwroot\maxdp-server\
```

### 5. 권한 설정
```
1. C:\inetpub\wwwroot\maxdp-server 우클릭 → 속성
2. 보안 탭 → 편집
3. IIS_IUSRS에 "모든 권한" 부여
4. 적용
```

## 테스트

### 1. 개발 서버 테스트
```cmd
# 가상환경 활성화
venv\Scripts\activate

# 개발 서버 실행
python -m app.maxdp_main

# 다른 터미널에서 헬스체크
curl http://localhost:8001/health
```

### 2. 자동화된 테스트 실행
```cmd
# 전체 테스트 실행
scripts\run_tests.bat

# 단위 테스트만 실행
scripts\run_tests.bat unit

# E2E 테스트 실행
scripts\run_tests.bat e2e

# Windows 전용 테스트
scripts\run_tests.bat windows
```

### 3. 서비스 테스트
```cmd
# 서비스 시작
python scripts\windows_service.py start

# 상태 확인
python scripts\windows_service.py status

# API 테스트
curl http://localhost:8001/health
```

## 모니터링 및 로깅

### 1. 로그 파일 위치
```
logs/
├── maxdp_service.log      # Windows 서비스 로그
├── maxdp_server.log       # 애플리케이션 로그
├── queue_worker.log       # Redis 큐 워커 로그
└── error.log              # 에러 로그
```

### 2. Windows 이벤트 로그
```
1. eventvwr.msc 실행
2. Windows 로그 → 애플리케이션
3. "MAX DP Service" 관련 이벤트 확인
```

### 3. 성능 모니터링
```cmd
# 시스템 리소스 모니터링
perfmon

# 특정 카운터 추가:
# - Process\% Processor Time\python
# - Memory\Available MBytes
# - Network Interface\Bytes Total/sec
```

### 4. Redis 모니터링
```cmd
# Redis CLI를 통한 상태 확인
redis-cli info

# 큐 상태 확인
redis-cli llen maxdp:default
redis-cli zcard maxdp:priority
```

## 문제 해결

### 일반적인 문제들

#### 1. Python 실행 오류
```cmd
# Python 경로 확인
where python

# PATH 환경 변수에 Python 추가
# 시스템 속성 → 고급 → 환경 변수 → PATH 편집
```

#### 2. PostgreSQL 연결 오류
```sql
-- 연결 설정 확인
SELECT * FROM pg_hba_conf;

-- 포트 확인
SHOW port;

-- 서비스 상태 확인 (Windows 서비스 관리자에서)
```

#### 3. Redis 연결 오류
```cmd
# Redis 서비스 상태 확인
sc query Redis

# Redis 서비스 시작
net start Redis

# Redis 설정 파일 확인
# C:\Program Files\Redis\redis.windows.conf
```

#### 4. 포트 충돌 문제
```cmd
# 포트 사용 상황 확인
netstat -an | findstr :8001

# 포트를 사용하는 프로세스 확인
netstat -ano | findstr :8001

# 프로세스 종료
taskkill /PID <PID> /F
```

#### 5. 권한 문제
```cmd
# 관리자 권한으로 실행
# 파일/폴더 권한 확인
icacls C:\inetpub\wwwroot\maxdp-server

# 권한 부여
icacls C:\inetpub\wwwroot\maxdp-server /grant IIS_IUSRS:F
```

### 로그 분석

#### 1. 서비스 시작 실패
```
로그 위치: logs/maxdp_service.log
확인 사항:
- Python 경로 문제
- 가상환경 활성화 문제
- 의존성 모듈 누락
- 환경 변수 설정 오류
```

#### 2. 데이터베이스 연결 실패
```
로그 위치: logs/maxdp_server.log
확인 사항:
- DATABASE_URL 설정
- PostgreSQL 서비스 상태
- 네트워크 연결
- 인증 정보
```

#### 3. Redis 큐 오류
```
로그 위치: logs/queue_worker.log
확인 사항:
- REDIS_URL 설정
- Redis 서비스 상태
- 네트워크 연결
- 큐 권한 설정
```

## 성능 최적화

### 1. Python 최적화
```env
# .env 파일에 추가
PYTHONOPTIMIZE=1
PYTHONDONTWRITEBYTECODE=1
```

### 2. Redis 최적화
```
# redis.conf 설정
maxmemory 1gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
```

### 3. PostgreSQL 최적화
```sql
-- postgresql.conf 설정
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB
```

### 4. IIS 최적화
```xml
<!-- web.config에 추가 -->
<system.webServer>
  <httpCompression directory="%SystemDrive%\inetpub\temp\IIS Temporary Compressed Files">
    <scheme name="gzip" dll="%Windir%\system32\inetsrv\gzip.dll" />
    <dynamicTypes>
      <add mimeType="application/json" enabled="true" />
    </dynamicTypes>
  </httpCompression>
</system.webServer>
```

## 백업 및 복구

### 1. 데이터베이스 백업
```cmd
# PostgreSQL 백업
pg_dump -U maxdp_user -h localhost platform_integration > backup.sql

# 백업 복구
psql -U maxdp_user -h localhost platform_integration < backup.sql
```

### 2. Redis 백업
```cmd
# Redis 백업 (RDB 파일)
copy "C:\Program Files\Redis\dump.rdb" "backup\dump_%date%.rdb"
```

### 3. 애플리케이션 백업
```cmd
# 설정 파일 백업
copy .env backup\env_%date%.txt
copy logs\*.log backup\logs\
```

## 보안 고려사항

### 1. 환경 변수 보안
- `.env` 파일 권한을 관리자와 서비스 계정만 읽기 가능하도록 설정
- 프로덕션에서는 Windows 자격 증명 관리자 사용 권장

### 2. 네트워크 보안
- Windows 방화벽에서 필요한 포트만 허용
- IIS에서 IP 주소 및 도메인 제한 설정

### 3. 서비스 계정
- 전용 서비스 계정 생성 및 최소 권한 부여
- 로그온 서비스 권한만 부여

이제 MAX DP 서버가 Windows 환경에서 안정적으로 실행될 수 있습니다! 🚀
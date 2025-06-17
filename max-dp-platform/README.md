# MAX DP - 데이터 파이프라인 관리 플랫폼

## 프로젝트 개요

MAX DP는 데이터 파이프라인을 시각적으로 설계하고 실행할 수 있는 통합 플랫폼입니다.

### 기술 스택
- **Backend**: Python 3.11, FastAPI, SQLAlchemy (비동기), Alembic
- **Database**: PostgreSQL 17 with pgvector
- **Frontend**: Node.js v22.16.0 (계획)
- **Authentication**: JWT
- **ORM**: SQLAlchemy 2.0 (Async)

## Phase 1: 견고한 기반 설계 (완료)

### 구현 완료 사항

#### 1. 프로젝트 구조 설정
```
max-dp-platform/
├── max_dp_server/          # 백엔드 서버
│   ├── app/
│   │   ├── api/           # API 라우터들
│   │   ├── crud/          # 데이터 액세스 로직
│   │   ├── models/        # SQLAlchemy 모델들
│   │   ├── schemas/       # Pydantic 스키마들
│   │   ├── db/            # 데이터베이스 연결
│   │   ├── dependencies/  # FastAPI 의존성들
│   │   ├── utils/         # 유틸리티 함수들
│   │   └── core/          # 핵심 설정들
│   ├── migrations/        # Alembic 마이그레이션
│   ├── requirements.txt   # Python 의존성
│   ├── .env              # 환경 변수
│   └── alembic.ini       # Alembic 설정
└── max_dp_designer/       # 프론트엔드 (향후 구현)
```

#### 2. 데이터베이스 모델링
- **사용자 관리**: 기존 `users`, `groups`, `roles` 테이블 활용
- **워크스페이스 관리**: `maxdp_workspaces` 테이블
- **Flow 관리**: `maxdp_flows`, `maxdp_flow_versions` 테이블
- **권한 관리**: 워크스페이스 및 Flow별 권한 시스템

#### 3. 인증 시스템
- JWT 기반 액세스/리프레시 토큰
- 비밀번호 해싱 (bcrypt)
- 사용자 컨텍스트 관리
- FastAPI 의존성 기반 인증 검증

#### 4. API 구조
- RESTful API 설계
- `/api/v1` 기본 경로
- 모듈화된 라우터 구조
- 자동 API 문서 생성 (OpenAPI/Swagger)

#### 5. 환경 설정
- Pydantic 기반 설정 관리
- 환경 변수 기반 구성
- 개발/프로덕션 환경 분리
- 로깅 시스템 통합

## 설치 및 실행

### 1. 필수 요구사항
- Python 3.11+
- PostgreSQL 17
- Node.js v22.16.0 (프론트엔드용, 향후)

### 2. 데이터베이스 설정
```sql
-- PostgreSQL에서 데이터베이스 생성
CREATE DATABASE platform_integration;

-- 사용자 생성 (선택사항)
CREATE USER maxdp_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE platform_integration TO maxdp_user;
```

### 3. 백엔드 설정
```bash
cd max-dp-platform/max_dp_server

# Python 가상환경 생성
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 환경 변수 설정
cp .env.example .env
# .env 파일에서 DATABASE_URL 등 설정 수정

# 데이터베이스 마이그레이션 (향후 Alembic 설치 후)
# alembic upgrade head

# 서버 실행
python -m app.maxdp_main
```

### 4. API 테스트
서버 실행 후 다음 URL에서 확인 가능:
- API 문서: http://localhost:8001/docs
- Health Check: http://localhost:8001/health
- API 정보: http://localhost:8001/api/v1/

## 현재 구현된 API 엔드포인트

### 기본 엔드포인트
- `GET /` - 서버 상태
- `GET /health` - 헬스체크
- `GET /info` - 서버 정보

### API v1
- `GET /api/v1/` - API 정보
- `GET /api/v1/status` - API 상태
- `GET /api/v1/users/test-auth` - 인증 불필요 테스트
- `GET /api/v1/users/test-auth-required` - 인증 필요 테스트 (JWT 토큰 필요)
- `GET /api/v1/users/me` - 현재 사용자 정보 (JWT 토큰 필요)
- `GET /api/v1/users/profile` - 사용자 프로필 (JWT 토큰 필요)

## 다음 단계 (Phase 2)

1. **실행 엔진 구현**
   - LangChain 기반 실행 엔진
   - Worker-Manager 패턴
   - 비동기 작업 처리

2. **API 생명주기 관리**
   - Flow 실행 API
   - 버전 관리 API
   - 모니터링 API

3. **보안 강화**
   - 완전한 권한 부여 시스템
   - API 키 관리
   - 감사 로그

## 기술적 특징

- **비동기 처리**: 모든 데이터베이스 작업이 비동기로 처리
- **타입 안정성**: Pydantic을 통한 데이터 검증
- **확장성**: 모듈화된 구조로 쉬운 기능 추가
- **보안**: JWT 기반 인증 및 권한 시스템
- **모니터링**: 구조화된 로깅 및 헬스체크

## 개발 가이드라인

### 명명 규칙
- 모든 MAX DP 전용 테이블: `maxdp_` 접두사
- 파일명: `maxdp_` 접두사 사용
- 클래스명: PascalCase
- 함수명: snake_case

### 코드 품질
- 단일 책임 원칙 (SRP) 적용
- 파일당 500줄 이하 유지
- 상세한 로깅 및 예외 처리
- Type hints 필수 사용

---

**Phase 1 완료**: 견고한 기반 설계가 완료되었습니다. 이제 Phase 2에서 핵심 실행 엔진을 구현할 준비가 되었습니다. 

## 🏗️ 프로젝트 구조

```
max-dp-platform/
├── max_dp_designer/     # 프론트엔드 (React + Flow Designer)
├── max_dp_server/       # 백엔드 API 서버 (FastAPI)
└── README.md
```

## 📋 구현 진행 상황

### ✅ Part 1/3 완료 - 기반 인프라 구축
- **Phase 1**: 프로젝트 기반 구조 및 데이터베이스 스키마 ✅
- **Phase 2**: 사용자 인증 및 권한 관리 시스템 ✅  
- **Phase 3**: Flow 저장 및 관리 API ✅

### ✅ Part 2/3 완료 - 실행 엔진과 API 생명주기 관리
- **Phase 4**: LangChain 기반 실행 엔진 코어 구축 ✅
  - MaxDPNode 추상 클래스 구현 (LangChain Runnable 프로토콜 준수)
  - 위상 정렬 유틸리티 (DAG 검증 및 실행 순서 결정)
  - FlowExecutor 클래스 (flow_json 해석 및 노드 순차 실행)

- **Phase 5**: 모든 노드 클래스 상세 구현 ✅
  - **데이터 소스 노드들**: TableReaderNode, CustomSQLQueryNode, FileInputNode, ApiEndpointNode, StaticDataNode, WebhookListenerNode
  - **데이터 변환 노드들**: SelectColumnsNode, FilterRowsNode, SampleRowsNode, RenameColumnsNode, AddModifyColumnNode, ChangeDataTypeNode, SplitColumnNode, MapValuesNode
  - **고급 변환 노드들**: HandleMissingValuesNode, DeduplicateNode, SortDataNode, PivotTableNode, MeltNode, GroupAggregateNode, WindowFunctionsNode, JoinMergeNode, UnionConcatenateNode, RunPythonScriptNode, ApplyFunctionNode
  - **데이터 목적지 노드들**: TableWriterNode, FileWriterNode, APIRequestNode, DisplayResultsNode, SendNotificationNode
  - **제어 흐름 노드들**: ConditionalBranchNode, TryCatchNode, MergeNode
  - **노드 팩토리**: 동적 노드 인스턴스 생성 및 레지스트리 관리

- **Phase 6**: API Worker-Manager 및 실행 엔드포인트 완성 ✅
  - WorkerManager 싱글턴 패턴 구현 (자원 효율적 관리)
  - API별 FlowExecutor 캐싱 및 생명주기 관리
  - 공개 실행 엔드포인트 `/execute/{api_endpoint}` 구현
  - APScheduler 기반 자동 Worker 정리 및 모니터링

### 🔄 Part 3/3 예정 - 프론트엔드 및 통합
- **Phase 7**: React Flow 기반 시각적 디자이너
- **Phase 8**: 실시간 실행 모니터링 및 로그 시스템
- **Phase 9**: API 문서화 및 테스트 도구

## 🛠️ 기술 스택

### 백엔드 (max_dp_server)
- **Framework**: FastAPI 0.104.1
- **Database**: PostgreSQL + SQLAlchemy (async)
- **Authentication**: JWT + OAuth2
- **Execution Engine**: LangChain Core 0.2.10
- **Data Processing**: Pandas 2.1.4
- **Security**: RestrictedPython 6.0
- **Scheduling**: APScheduler 3.10.4
- **Validation**: Pydantic V2

### 프론트엔드 (max_dp_designer)
- **Framework**: React 18+ + TypeScript
- **Flow Designer**: React Flow / Xyflow
- **State Management**: Zustand
- **UI Components**: Ant Design / Mantine
- **Build Tool**: Vite

## 🚀 설치 및 실행

### 백엔드 서버

```bash
cd max_dp_server
pip install -r requirements.txt
python -m app.maxdp_main
```

### 환경 변수 설정

```bash
# .env 파일 생성
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/maxdp
JWT_SECRET_KEY=your-secret-key
DEBUG=true
MAX_DP_SERVER_PORT=8001

# Worker Manager 설정
MAX_ACTIVE_APIS=50
API_INACTIVE_TTL_HOURS=2
WORKER_CLEANUP_INTERVAL_MINUTES=30
```

## 📚 API 문서

서버 실행 후 다음 URL에서 API 문서를 확인할 수 있습니다:
- Swagger UI: `http://localhost:8001/docs`
- ReDoc: `http://localhost:8001/redoc`

### 주요 엔드포인트

#### 관리 API
- `POST /api/v1/flows/` - Flow 생성
- `PUT /api/v1/flows/{flow_id}` - Flow 수정
- `POST /api/v1/flows/{flow_id}/publish` - API 발행

#### 실행 API
- `GET|POST /execute/{api_endpoint}` - 발행된 API 실행
- `GET /execute/health` - 실행 엔진 상태 확인
- `GET /execute/worker-stats` - Worker 통계 조회 (관리자)

## 🏗️ 아키텍처 개요

### 실행 엔진 아키텍처

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   HTTP Request  │ -> │ Worker Manager   │ -> │ Flow Executor   │
│                 │    │                  │    │                 │
│ /execute/my-api │    │ - Worker Caching │    │ - DAG Analysis  │
└─────────────────┘    │ - Lifecycle Mgmt │    │ - Node Execution│
                       │ - Resource Mgmt  │    │ - Error Handling│
                       └──────────────────┘    └─────────────────┘
                                │
                       ┌──────────────────┐
                       │   Node Registry  │
                       │                  │
                       │ - 40+ Node Types │
                       │ - Dynamic Loading│
                       │ - LangChain Base │
                       └──────────────────┘
```

### 노드 실행 플로우

```
1. HTTP Request -> Worker Manager
2. Worker Manager -> Get/Create FlowExecutor
3. FlowExecutor -> Topological Sort (DAG)
4. FlowExecutor -> Sequential Node Execution
5. Each Node -> LangChain Runnable.invoke()
6. Node Factory -> Dynamic Node Instantiation
7. Result -> JSON Response
```

## 🔒 보안 및 제한사항

- **RestrictedPython**: 사용자 정의 Python 코드 안전 실행
- **JWT Authentication**: API 접근 제어
- **Input Validation**: Pydantic을 통한 엄격한 데이터 검증
- **Resource Limits**: Worker 수 제한 및 TTL 관리
- **Error Isolation**: 노드별 예외 처리 및 격리

## 🧪 테스트

```bash
# 백엔드 테스트
cd max_dp_server
pytest

# API 헬스체크
curl http://localhost:8001/health

# 실행 엔진 테스트
curl http://localhost:8001/execute/health
```

## 📈 모니터링

- **Worker 통계**: `/execute/worker-stats` (관리자 권한 필요)
- **실행 로그**: 구조화된 로깅 (JSON 형태)
- **성능 메트릭**: 실행 시간, 메모리 사용량 추적
- **자동 정리**: 비활성 Worker 자동 제거

## 🤝 기여하기

1. 이슈 확인 및 등록
2. 브랜치 생성: `git checkout -b feature/amazing-feature`
3. 커밋: `git commit -m 'Add amazing feature'`
4. 푸시: `git push origin feature/amazing-feature`
5. Pull Request 생성

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

---

## 🔧 개발 참고사항

### 새 노드 타입 추가하기

1. `MaxDPNode`를 상속받는 클래스 생성
2. `invoke()` 메서드 구현
3. `maxdp_node_factory.py`에 등록
4. 타입 검증 및 테스트 코드 작성

### Worker Manager 커스터마이징

- `maxdp_config.py`: Worker 관련 설정 수정
- `WorkerManager`: 생명주기 정책 커스터마이징
- `APScheduler`: 정리 작업 스케줄 조정

### 성능 최적화 팁

- **노드 캐싱**: 동일한 설정의 노드 인스턴스 재사용
- **배치 처리**: 대용량 데이터를 위한 청크 단위 처리  
- **메모리 관리**: Worker TTL 및 최대 수 조정
- **비동기 처리**: I/O 바운드 작업의 async/await 활용 
---

### Claude.local.md: 프로젝트 준수사항 가이드

**프로젝트 개요:** Data Provider (Flow as a Service) - 사용자가 컴포넌트를 시각적으로 구성하고 노드와 엣지를 연결하여 데이터를 서빙하는 서비스.

**개발 환경:**

* **운영체제:** Windows
* **배포 환경:** On-premise

---

### 개발 관점 준수사항

1.  **코딩 스타일 및 컨벤션:**
    * **Python (주 언어):** **PEP 8** 준수. (예: 4칸 들여쓰기, 공백 사용)
    * **변수명:** `snake_case` 사용. (예: `user_data`, `flow_component`)
    * **클래스명:** `PascalCase` 사용. (예: `DataProvider`, `FlowNode`)
    * **함수명:** `snake_case` 사용. (예: `get_flow_data`, `process_node`)
    * **주석:** 핵심 로직 및 복잡한 부분에 명확한 주석 추가.
    * **Docstrings:** 모든 함수 및 클래스에 Docstring 작성.

2.  **모듈/패키지 관리:**
    * **MCP Context7:** **최신 안정 버전**의 모듈/패키지만 사용. (레거시 코드/라이브러리 사용 지양)
    * `requirements.txt` 또는 `pyproject.toml`을 통한 명확한 **의존성 관리**.
    * **Windows 호환성:** Linux 전용 모듈 및 패키지 사용 금지 (WSL을 통한 사용 포함).

3.  **테스트:**
    * **MCP Playwrights:** 모든 UI/통합 테스트는 Playwrights를 사용하여 작성 및 실행.
    * **단위 테스트:** `pytest` 활용. 각 컴포넌트 및 핵심 로직에 대한 단위 테스트 필수.

4.  **아키텍처 및 디자인:**
    * 마이크로 서비스 지향 (필요시).
    * 모듈 간 명확한 책임 분리.

5.  **성능 및 확장성:**
    * 데이터 처리 효율성 최적화.
    * 향후 기능 확장 및 사용자 증가에 대비한 확장 가능한 구조 설계.

---

### 기술 스택

이 프로젝트는 다음 기술 스택을 활용하여 개발됩니다.

* **백엔드:**
    * **언어:** Python
    * **프레임워크:** **FastAPI** (고성능 비동기 API 구현)
    * **데이터베이스:** **PostgreSQL** (관계형 데이터 저장, Windows Installer/설치 가이드 활용)
    * **비동기 처리/태스크 큐:**
        * **APScheduler:** 스케줄링된 작업 및 주기적 백그라운드 태스크 처리. (Windows 서비스로 등록하여 상시 실행)
        * **Redis + Python `queue` 모듈 또는 직접 구현:** 간단한 메시지 큐 시스템 구현을 위해 Redis를 활용하고, Python의 내장 `queue` 모듈을 조합하거나 직접 Redis의 `LIST` 타입을 활용하여 비동기 작업을 처리. (Redis는 Windows용 포트 버전 제공)
    * **메시지 브로커:** **RabbitMQ** (Windows 설치 가능) - 필요시 복잡한 메시징 패턴에 활용.

* **프론트엔드:**
    * **언어:** TypeScript
    * **프레임워크:** **React** (컴포넌트 기반 UI 개발)
    * **상태 관리:** **Zustand** (경량 상태 관리 라이브러리)
    * **시각화/다이어그램:** **React Flow** (노드 및 엣지 시각화)

* **배포 및 인프라 (On-premise Windows 환경 특화):**
    * **웹 서버:** **IIS (Internet Information Services)** - FastAPI 애플리케이션을 WSGI(Web Server Gateway Interface) 서버(예: Waitress)와 연동하여 IIS에서 프록시 및 호스팅.
    * **서비스 관리:** **Windows Services** (백엔드 프로세스 및 작업 스케줄러 등록)

---

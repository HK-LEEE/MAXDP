"""
Pytest 설정 파일
CLAUDE.local.md 가이드라인에 따른 Playwright 기반 E2E 테스트 설정
"""

import pytest
import asyncio
import os
from typing import AsyncGenerator, Generator
from httpx import AsyncClient
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from app.maxdp_main import app
from app.db.maxdp_session import Base, get_database_url
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# 테스트 환경 설정
os.environ["DATABASE_URL"] = "postgresql+asyncpg://postgres:password@localhost:5432/maxdp_test"
os.environ["DEBUG"] = "true"

@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """이벤트 루프 설정"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def test_engine():
    """테스트용 데이터베이스 엔진"""
    engine = create_async_engine(
        get_database_url(),
        echo=True,
        future=True
    )
    
    # 테스트 테이블 생성
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    # 테스트 후 정리
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()

@pytest.fixture
async def test_db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """테스트용 데이터베이스 세션"""
    TestSessionLocal = sessionmaker(
        test_engine, 
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    async with TestSessionLocal() as session:
        yield session

@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """테스트용 HTTP 클라이언트"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

# Playwright 픽스처들
@pytest.fixture(scope="session")
async def browser() -> AsyncGenerator[Browser, None]:
    """Playwright 브라우저 인스턴스"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,  # CI/CD에서는 headless 모드
            args=["--no-sandbox", "--disable-dev-shm-usage"]  # Windows 호환성
        )
        yield browser
        await browser.close()

@pytest.fixture
async def browser_context(browser: Browser) -> AsyncGenerator[BrowserContext, None]:
    """브라우저 컨텍스트"""
    context = await browser.new_context(
        viewport={"width": 1280, "height": 720},
        locale="ko-KR",
        timezone_id="Asia/Seoul"
    )
    yield context
    await context.close()

@pytest.fixture
async def page(browser_context: BrowserContext) -> AsyncGenerator[Page, None]:
    """페이지 인스턴스"""
    page = await browser_context.new_page()
    yield page
    await page.close()

@pytest.fixture
def test_user_data():
    """테스트용 사용자 데이터"""
    return {
        "real_name": "테스트 사용자",
        "email": "test@example.com",
        "password": "test123!@#",
        "phone_number": "010-1234-5678",
        "department": "개발팀",
        "position": "개발자"
    }

@pytest.fixture
def test_workspace_data():
    """테스트용 워크스페이스 데이터"""
    return {
        "name": "테스트 워크스페이스",
        "description": "Playwright 테스트용 워크스페이스",
        "is_public": False
    }

@pytest.fixture
def test_flow_data():
    """테스트용 플로우 데이터"""
    return {
        "name": "테스트 플로우",
        "description": "Playwright 테스트용 데이터 플로우",
        "flow_config": {
            "nodes": [
                {
                    "id": "node_1",
                    "type": "source",
                    "position": {"x": 100, "y": 100},
                    "data": {"label": "데이터 소스"}
                },
                {
                    "id": "node_2", 
                    "type": "transform",
                    "position": {"x": 300, "y": 100},
                    "data": {"label": "데이터 변환"}
                }
            ],
            "edges": [
                {
                    "id": "edge_1",
                    "source": "node_1",
                    "target": "node_2"
                }
            ]
        }
    }

# 테스트 헬퍼 함수들
@pytest.fixture
async def authenticated_client(client: AsyncClient, test_user_data: dict) -> AsyncClient:
    """인증된 클라이언트"""
    # 사용자 등록
    register_response = await client.post("/api/auth/register", json=test_user_data)
    assert register_response.status_code == 201
    
    # 로그인
    login_data = {
        "email": test_user_data["email"],
        "password": test_user_data["password"]
    }
    login_response = await client.post("/api/auth/login", json=login_data)
    assert login_response.status_code == 200
    
    token_data = login_response.json()
    client.headers.update({
        "Authorization": f"Bearer {token_data['access_token']}"
    })
    
    return client

@pytest.fixture
async def authenticated_page(page: Page) -> Page:
    """인증된 페이지 (로그인 상태)"""
    # 로그인 페이지로 이동
    await page.goto("http://localhost:3001/login")
    
    # 로그인 폼 작성
    await page.fill('input[name="email"]', "test@example.com")
    await page.fill('input[name="password"]', "test123!@#")
    await page.click('button[type="submit"]')
    
    # 로그인 완료 대기
    await page.wait_for_url("**/dashboard")
    
    return page

# 마커 정의
def pytest_configure(config):
    """pytest 마커 설정"""
    config.addinivalue_line(
        "markers", "unit: 단위 테스트"
    )
    config.addinivalue_line(
        "markers", "integration: 통합 테스트"
    )
    config.addinivalue_line(
        "markers", "e2e: End-to-End 테스트"
    )
    config.addinivalue_line(
        "markers", "slow: 느린 테스트"
    )
    config.addinivalue_line(
        "markers", "windows: Windows 전용 테스트"
    )
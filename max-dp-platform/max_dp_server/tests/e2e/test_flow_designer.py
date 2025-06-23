"""
플로우 디자이너 E2E 테스트
CLAUDE.local.md 가이드라인에 따른 Playwright 기반 UI 테스트
"""

import pytest
from playwright.async_api import Page, expect

@pytest.mark.e2e
class TestFlowDesigner:
    """플로우 디자이너 E2E 테스트 클래스"""
    
    async def test_flow_designer_page_loads(self, authenticated_page: Page):
        """플로우 디자이너 페이지 로드 테스트"""
        # 플로우 디자이너 페이지로 이동
        await authenticated_page.goto("http://localhost:3001/flow-designer")
        
        # 페이지 제목 확인
        await expect(authenticated_page).to_have_title("MAX DP - Flow Designer")
        
        # 주요 UI 요소 확인
        await expect(authenticated_page.locator('[data-testid="flow-canvas"]')).to_be_visible()
        await expect(authenticated_page.locator('[data-testid="node-palette"]')).to_be_visible()
        await expect(authenticated_page.locator('[data-testid="toolbar"]')).to_be_visible()
    
    async def test_create_new_flow(self, authenticated_page: Page):
        """새 플로우 생성 테스트"""
        await authenticated_page.goto("http://localhost:3001/flow-designer")
        
        # 새 플로우 버튼 클릭
        await authenticated_page.click('[data-testid="new-flow-button"]')
        
        # 플로우 생성 모달 확인
        await expect(authenticated_page.locator('[data-testid="create-flow-modal"]')).to_be_visible()
        
        # 플로우 정보 입력
        await authenticated_page.fill('[data-testid="flow-name-input"]', "E2E 테스트 플로우")
        await authenticated_page.fill('[data-testid="flow-description-input"]', "Playwright E2E 테스트용 플로우")
        
        # 생성 버튼 클릭
        await authenticated_page.click('[data-testid="create-flow-submit"]')
        
        # 플로우 생성 완료 확인
        await expect(authenticated_page.locator('[data-testid="flow-title"]')).to_contain_text("E2E 테스트 플로우")
    
    async def test_add_nodes_to_flow(self, authenticated_page: Page):
        """플로우에 노드 추가 테스트"""
        await authenticated_page.goto("http://localhost:3001/flow-designer")
        
        # 새 플로우 생성
        await authenticated_page.click('[data-testid="new-flow-button"]')
        await authenticated_page.fill('[data-testid="flow-name-input"]', "노드 테스트 플로우")
        await authenticated_page.click('[data-testid="create-flow-submit"]')
        
        # 데이터 소스 노드 추가
        await authenticated_page.drag_and_drop(
            '[data-testid="node-source-csv"]',
            '[data-testid="flow-canvas"]'
        )
        
        # 노드가 캔버스에 추가되었는지 확인
        await expect(authenticated_page.locator('[data-testid="node-csv-source"]')).to_be_visible()
        
        # 변환 노드 추가
        await authenticated_page.drag_and_drop(
            '[data-testid="node-transform-filter"]',
            '[data-testid="flow-canvas"]'
        )
        
        await expect(authenticated_page.locator('[data-testid="node-filter-transform"]')).to_be_visible()
    
    async def test_connect_nodes(self, authenticated_page: Page):
        """노드 연결 테스트"""
        await authenticated_page.goto("http://localhost:3001/flow-designer")
        
        # 플로우 생성 및 노드 추가
        await authenticated_page.click('[data-testid="new-flow-button"]')
        await authenticated_page.fill('[data-testid="flow-name-input"]', "연결 테스트 플로우")
        await authenticated_page.click('[data-testid="create-flow-submit"]')
        
        # 소스 노드 추가
        await authenticated_page.drag_and_drop(
            '[data-testid="node-source-csv"]',
            '[data-testid="flow-canvas"]',
            target_position={"x": 100, "y": 100}
        )
        
        # 싱크 노드 추가
        await authenticated_page.drag_and_drop(
            '[data-testid="node-sink-database"]',
            '[data-testid="flow-canvas"]',
            target_position={"x": 300, "y": 100}
        )
        
        # 노드 연결
        await authenticated_page.drag_and_drop(
            '[data-testid="node-csv-source"] .react-flow__handle-right',
            '[data-testid="node-database-sink"] .react-flow__handle-left'
        )
        
        # 연결선이 생성되었는지 확인
        await expect(authenticated_page.locator('.react-flow__edge')).to_be_visible()
    
    async def test_node_configuration(self, authenticated_page: Page):
        """노드 설정 테스트"""
        await authenticated_page.goto("http://localhost:3001/flow-designer")
        
        # 플로우 생성 및 노드 추가
        await authenticated_page.click('[data-testid="new-flow-button"]')
        await authenticated_page.fill('[data-testid="flow-name-input"]', "설정 테스트 플로우")
        await authenticated_page.click('[data-testid="create-flow-submit"]')
        
        await authenticated_page.drag_and_drop(
            '[data-testid="node-source-csv"]',
            '[data-testid="flow-canvas"]'
        )
        
        # 노드 더블클릭으로 설정 모달 열기
        await authenticated_page.dblclick('[data-testid="node-csv-source"]')
        
        # 설정 모달 확인
        await expect(authenticated_page.locator('[data-testid="node-config-modal"]')).to_be_visible()
        
        # 파일 경로 설정
        await authenticated_page.fill(
            '[data-testid="csv-file-path-input"]',
            "C:\\data\\test.csv"
        )
        
        # 설정 저장
        await authenticated_page.click('[data-testid="save-node-config"]')
        
        # 설정이 저장되었는지 확인 (노드 색상 변경 등)
        await expect(authenticated_page.locator('[data-testid="node-csv-source"].configured')).to_be_visible()
    
    async def test_save_flow(self, authenticated_page: Page):
        """플로우 저장 테스트"""
        await authenticated_page.goto("http://localhost:3001/flow-designer")
        
        # 플로우 생성
        await authenticated_page.click('[data-testid="new-flow-button"]')
        await authenticated_page.fill('[data-testid="flow-name-input"]', "저장 테스트 플로우")
        await authenticated_page.click('[data-testid="create-flow-submit"]')
        
        # 노드 추가
        await authenticated_page.drag_and_drop(
            '[data-testid="node-source-csv"]',
            '[data-testid="flow-canvas"]'
        )
        
        # 저장 버튼 클릭
        await authenticated_page.click('[data-testid="save-flow-button"]')
        
        # 저장 성공 메시지 확인
        await expect(authenticated_page.locator('[data-testid="success-message"]')).to_contain_text("저장되었습니다")
        
        # 페이지 새로고침 후 플로우가 유지되는지 확인
        await authenticated_page.reload()
        await expect(authenticated_page.locator('[data-testid="node-csv-source"]')).to_be_visible()
    
    async def test_execute_flow(self, authenticated_page: Page):
        """플로우 실행 테스트"""
        await authenticated_page.goto("http://localhost:3001/flow-designer")
        
        # 완전한 플로우 생성 (소스 -> 변환 -> 싱크)
        await authenticated_page.click('[data-testid="new-flow-button"]')
        await authenticated_page.fill('[data-testid="flow-name-input"]', "실행 테스트 플로우")
        await authenticated_page.click('[data-testid="create-flow-submit"]')
        
        # 노드들 추가
        await authenticated_page.drag_and_drop(
            '[data-testid="node-source-csv"]',
            '[data-testid="flow-canvas"]',
            target_position={"x": 100, "y": 100}
        )
        
        await authenticated_page.drag_and_drop(
            '[data-testid="node-transform-filter"]',
            '[data-testid="flow-canvas"]',
            target_position={"x": 250, "y": 100}
        )
        
        await authenticated_page.drag_and_drop(
            '[data-testid="node-sink-database"]',
            '[data-testid="flow-canvas"]',
            target_position={"x": 400, "y": 100}
        )
        
        # 노드들 연결
        # 첫 번째 연결
        await authenticated_page.drag_and_drop(
            '[data-testid="node-csv-source"] .react-flow__handle-right',
            '[data-testid="node-filter-transform"] .react-flow__handle-left'
        )
        
        # 두 번째 연결
        await authenticated_page.drag_and_drop(
            '[data-testid="node-filter-transform"] .react-flow__handle-right',
            '[data-testid="node-database-sink"] .react-flow__handle-left'
        )
        
        # 플로우 저장
        await authenticated_page.click('[data-testid="save-flow-button"]')
        
        # 실행 버튼 클릭
        await authenticated_page.click('[data-testid="execute-flow-button"]')
        
        # 실행 상태 확인
        await expect(authenticated_page.locator('[data-testid="execution-status"]')).to_contain_text("실행 중")
        
        # 실행 완료 대기 (타임아웃 설정)
        await authenticated_page.wait_for_selector(
            '[data-testid="execution-status"]:has-text("완료")',
            timeout=30000
        )
    
    @pytest.mark.slow
    async def test_flow_performance(self, authenticated_page: Page):
        """플로우 성능 테스트"""
        await authenticated_page.goto("http://localhost:3001/flow-designer")
        
        # 대량의 노드를 추가하여 성능 테스트
        await authenticated_page.click('[data-testid="new-flow-button"]')
        await authenticated_page.fill('[data-testid="flow-name-input"]', "성능 테스트 플로우")
        await authenticated_page.click('[data-testid="create-flow-submit"]')
        
        # 여러 노드 추가 (성능 테스트)
        for i in range(10):
            await authenticated_page.drag_and_drop(
                '[data-testid="node-transform-filter"]',
                '[data-testid="flow-canvas"]',
                target_position={"x": 100 + i * 50, "y": 100 + i * 30}
            )
        
        # 페이지 응답성 확인
        await authenticated_page.click('[data-testid="zoom-fit-button"]')
        
        # 노드들이 모두 렌더링되었는지 확인
        node_count = await authenticated_page.locator('.react-flow__node').count()
        assert node_count == 10, f"Expected 10 nodes, got {node_count}"
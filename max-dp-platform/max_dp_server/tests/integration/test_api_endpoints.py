"""
API 엔드포인트 통합 테스트
CLAUDE.local.md 가이드라인에 따른 FastAPI 통합 테스트
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.maxdp_user_model import User
from app.models.maxdp_workspace_model import MaxDPWorkspace
from app.models.maxdp_flow_model import MaxDPFlow

@pytest.mark.integration
class TestAuthEndpoints:
    """인증 관련 엔드포인트 통합 테스트"""
    
    async def test_health_check(self, client: AsyncClient):
        """헬스체크 엔드포인트 테스트"""
        response = await client.get("/health")
        assert response.status_code == 200
        
        data = response.json()
        assert "status" in data
        assert "database" in data
        assert "version" in data
    
    async def test_root_endpoint(self, client: AsyncClient):
        """루트 엔드포인트 테스트"""
        response = await client.get("/")
        assert response.status_code == 200
        
        data = response.json()
        assert data["message"] == "MAX DP Server"
        assert "version" in data
        assert data["status"] == "running"
    
    async def test_server_info(self, client: AsyncClient):
        """서버 정보 엔드포인트 테스트"""
        response = await client.get("/info")
        assert response.status_code == 200
        
        data = response.json()
        assert "server" in data
        assert "database" in data
        assert data["server"]["name"] == "MAX DP Server"

@pytest.mark.integration 
class TestUserEndpoints:
    """사용자 관련 엔드포인트 통합 테스트"""
    
    async def test_user_registration(self, client: AsyncClient, test_user_data: dict):
        """사용자 등록 테스트"""
        response = await client.post("/api/auth/register", json=test_user_data)
        
        # 등록 성공 확인
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == test_user_data["email"]
        assert data["real_name"] == test_user_data["real_name"]
        assert "id" in data
        
        # 비밀번호는 응답에 포함되지 않아야 함
        assert "password" not in data
        assert "hashed_password" not in data
    
    async def test_user_login(self, client: AsyncClient, test_user_data: dict):
        """사용자 로그인 테스트"""
        # 먼저 사용자 등록
        await client.post("/api/auth/register", json=test_user_data)
        
        # 로그인 시도
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
        
        response = await client.post("/api/auth/login", json=login_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
    
    async def test_duplicate_user_registration(self, client: AsyncClient, test_user_data: dict):
        """중복 사용자 등록 테스트"""
        # 첫 번째 등록
        response1 = await client.post("/api/auth/register", json=test_user_data)
        assert response1.status_code == 201
        
        # 동일한 이메일로 두 번째 등록 시도
        response2 = await client.post("/api/auth/register", json=test_user_data)
        assert response2.status_code == 400  # 중복 등록 실패
    
    async def test_invalid_login(self, client: AsyncClient):
        """잘못된 로그인 테스트"""
        login_data = {
            "email": "nonexistent@example.com",
            "password": "wrongpassword"
        }
        
        response = await client.post("/api/auth/login", json=login_data)
        assert response.status_code == 401

@pytest.mark.integration
class TestWorkspaceEndpoints:
    """워크스페이스 관련 엔드포인트 통합 테스트"""
    
    async def test_create_workspace(self, authenticated_client: AsyncClient, test_workspace_data: dict):
        """워크스페이스 생성 테스트"""
        response = await authenticated_client.post(
            "/api/v1/maxdp/workspaces/", 
            json=test_workspace_data
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == test_workspace_data["name"]
        assert data["description"] == test_workspace_data["description"]
        assert "id" in data
        assert "created_at" in data
    
    async def test_list_workspaces(self, authenticated_client: AsyncClient, test_workspace_data: dict):
        """워크스페이스 목록 조회 테스트"""
        # 워크스페이스 생성
        await authenticated_client.post("/api/v1/maxdp/workspaces/", json=test_workspace_data)
        
        # 목록 조회
        response = await authenticated_client.get("/api/v1/maxdp/workspaces/")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        
        # 생성한 워크스페이스가 목록에 있는지 확인
        workspace_names = [ws["name"] for ws in data]
        assert test_workspace_data["name"] in workspace_names
    
    async def test_get_workspace_by_id(self, authenticated_client: AsyncClient, test_workspace_data: dict):
        """워크스페이스 단일 조회 테스트"""
        # 워크스페이스 생성
        create_response = await authenticated_client.post(
            "/api/v1/maxdp/workspaces/", 
            json=test_workspace_data
        )
        workspace_id = create_response.json()["id"]
        
        # 단일 조회
        response = await authenticated_client.get(f"/api/v1/maxdp/workspaces/{workspace_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == workspace_id
        assert data["name"] == test_workspace_data["name"]
    
    async def test_update_workspace(self, authenticated_client: AsyncClient, test_workspace_data: dict):
        """워크스페이스 수정 테스트"""
        # 워크스페이스 생성
        create_response = await authenticated_client.post(
            "/api/v1/maxdp/workspaces/", 
            json=test_workspace_data
        )
        workspace_id = create_response.json()["id"]
        
        # 수정 데이터
        update_data = {
            "name": "수정된 워크스페이스",
            "description": "수정된 설명"
        }
        
        # 수정 요청
        response = await authenticated_client.put(
            f"/api/v1/maxdp/workspaces/{workspace_id}",
            json=update_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["description"] == update_data["description"]
    
    async def test_delete_workspace(self, authenticated_client: AsyncClient, test_workspace_data: dict):
        """워크스페이스 삭제 테스트"""
        # 워크스페이스 생성
        create_response = await authenticated_client.post(
            "/api/v1/maxdp/workspaces/", 
            json=test_workspace_data
        )
        workspace_id = create_response.json()["id"]
        
        # 삭제 요청
        response = await authenticated_client.delete(f"/api/v1/maxdp/workspaces/{workspace_id}")
        assert response.status_code == 204
        
        # 삭제 확인 (조회 시 404 응답)
        get_response = await authenticated_client.get(f"/api/v1/maxdp/workspaces/{workspace_id}")
        assert get_response.status_code == 404

@pytest.mark.integration
class TestFlowEndpoints:
    """플로우 관련 엔드포인트 통합 테스트"""
    
    async def test_create_flow(self, authenticated_client: AsyncClient, test_workspace_data: dict, test_flow_data: dict):
        """플로우 생성 테스트"""
        # 워크스페이스 생성
        workspace_response = await authenticated_client.post(
            "/api/v1/maxdp/workspaces/", 
            json=test_workspace_data
        )
        workspace_id = workspace_response.json()["id"]
        
        # 플로우 생성
        flow_data = {**test_flow_data, "workspace_id": workspace_id}
        response = await authenticated_client.post(
            "/api/v1/maxdp/flows/",
            json=flow_data
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == test_flow_data["name"]
        assert data["workspace_id"] == workspace_id
        assert "id" in data
    
    async def test_list_flows_by_workspace(self, authenticated_client: AsyncClient, test_workspace_data: dict, test_flow_data: dict):
        """워크스페이스별 플로우 목록 조회 테스트"""
        # 워크스페이스 생성
        workspace_response = await authenticated_client.post(
            "/api/v1/maxdp/workspaces/", 
            json=test_workspace_data
        )
        workspace_id = workspace_response.json()["id"]
        
        # 플로우 생성
        flow_data = {**test_flow_data, "workspace_id": workspace_id}
        await authenticated_client.post("/api/v1/maxdp/flows/", json=flow_data)
        
        # 플로우 목록 조회
        response = await authenticated_client.get(f"/api/v1/maxdp/workspaces/{workspace_id}/flows")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["name"] == test_flow_data["name"]
    
    async def test_execute_flow(self, authenticated_client: AsyncClient, test_workspace_data: dict, test_flow_data: dict):
        """플로우 실행 테스트"""
        # 워크스페이스 및 플로우 생성
        workspace_response = await authenticated_client.post(
            "/api/v1/maxdp/workspaces/", 
            json=test_workspace_data
        )
        workspace_id = workspace_response.json()["id"]
        
        flow_data = {**test_flow_data, "workspace_id": workspace_id}
        flow_response = await authenticated_client.post("/api/v1/maxdp/flows/", json=flow_data)
        flow_id = flow_response.json()["id"]
        
        # 플로우 실행
        execution_data = {
            "parameters": {"param1": "value1"},
            "execution_mode": "sync"
        }
        
        response = await authenticated_client.post(
            f"/api/v1/maxdp/flows/{flow_id}/execute",
            json=execution_data
        )
        
        # 실행 요청이 정상적으로 접수되었는지 확인
        assert response.status_code in [200, 202]  # 동기/비동기 실행에 따라
        
        data = response.json()
        assert "execution_id" in data or "result" in data

@pytest.mark.integration
class TestErrorHandling:
    """에러 처리 통합 테스트"""
    
    async def test_404_endpoints(self, client: AsyncClient):
        """존재하지 않는 엔드포인트 테스트"""
        response = await client.get("/nonexistent/endpoint")
        assert response.status_code == 404
    
    async def test_unauthorized_access(self, client: AsyncClient):
        """인증되지 않은 접근 테스트"""
        response = await client.get("/api/v1/maxdp/workspaces/")
        assert response.status_code == 401
    
    async def test_invalid_json_request(self, client: AsyncClient):
        """잘못된 JSON 요청 테스트"""
        response = await client.post(
            "/api/auth/register",
            content="invalid json",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422
    
    async def test_missing_required_fields(self, client: AsyncClient):
        """필수 필드 누락 테스트"""
        incomplete_user_data = {
            "email": "test@example.com"
            # real_name, password 누락
        }
        
        response = await client.post("/api/auth/register", json=incomplete_user_data)
        assert response.status_code == 422
        
        data = response.json()
        assert "detail" in data
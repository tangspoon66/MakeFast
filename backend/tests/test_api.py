"""
API 端点测试

测试所有 API 端点的基本功能和验证逻辑。
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from conftest import make_learner_client

# 编译等私有接口需要学习者会话
client = make_learner_client()


class TestHealthEndpoint:
    """健康检查端点测试"""
    
    def test_health_check_returns_ok(self):
        """测试健康检查返回正常状态"""
        response = client.get("/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert "status" in data
        assert data["status"] in ["ok", "degraded"]
        assert data["service"] == "makefast-platform"
        assert data["version"] == "0.1.0"
    
    def test_health_check_includes_arduino_cli_info(self):
        """测试健康检查包含 Arduino CLI 信息"""
        response = client.get("/api/health")
        data = response.json()
        
        assert "arduino_cli" in data
        assert "ok" in data["arduino_cli"]
        assert isinstance(data["arduino_cli"]["ok"], bool)
    
    def test_health_check_includes_library_count(self):
        """测试健康检查包含库数量"""
        response = client.get("/api/health")
        data = response.json()
        
        assert "libraries" in data
        assert "preinstalled_count" in data["libraries"]
        assert isinstance(data["libraries"]["preinstalled_count"], int)
    
    def test_health_check_includes_disk_info(self):
        """测试健康检查包含磁盘信息"""
        response = client.get("/api/health")
        data = response.json()
        
        assert "disk" in data
        assert "free_gb" in data["disk"]
        assert isinstance(data["disk"]["free_gb"], (int, float))
        assert "usage_percent" in data["disk"]
        assert "storage_path" not in data["disk"]


class TestBoardsEndpoint:
    """开发板列表端点测试"""
    
    def test_get_boards_returns_list(self):
        """测试获取开发板列表"""
        response = client.get("/api/boards")
        assert response.status_code == 200
        
        data = response.json()
        assert "boards" in data
        assert isinstance(data["boards"], list)
        assert len(data["boards"]) > 0
    
    def test_board_info_structure(self):
        """测试开发板信息结构"""
        response = client.get("/api/boards")
        data = response.json()
        
        board = data["boards"][0]
        assert "id" in board
        assert "name" in board
        assert "fqbn" in board
        assert "description" in board
    
    def test_boards_include_esp32(self):
        """测试开发板列表包含 esp32"""
        response = client.get("/api/boards")
        data = response.json()
        
        board_ids = [board["id"] for board in data["boards"]]
        assert "esp32" in board_ids


class TestCompileEndpoint:
    """编译端点测试（编译服务用假实现，不调用 arduino-cli）"""

    @pytest.fixture(autouse=True)
    def _fake_compiler(self, monkeypatch):
        import app.compilation_service as cs
        from app.models import CompileResult

        class _Fake:
            def compile(self, **kwargs):
                return CompileResult(success=True, firmware_id="fake", firmware_size=1, duration=0.01)

        monkeypatch.setattr(cs, "get_compilation_service", lambda: _Fake())
    
    def test_compile_endpoint_exists(self):
        """测试编译端点存在"""
        response = client.post(
            "/api/compile",
            json={"code": "void setup() {}", "board_id": "esp32"}
        )
        # 目前返回 501 (未实现)，但端点应该存在
        assert response.status_code in [200, 501]
    
    def test_compile_rejects_empty_code(self):
        """测试拒绝空代码"""
        response = client.post(
            "/api/compile",
            json={"code": "", "board_id": "esp32"}
        )
        assert response.status_code == 422  # Validation error
        
        data = response.json()
        assert "detail" in data
    
    def test_compile_rejects_too_long_code(self):
        """测试拒绝超长代码"""
        long_code = "a" * 50001  # 超过 50000 字符限制
        response = client.post(
            "/api/compile",
            json={"code": long_code, "board_id": "esp32"}
        )
        assert response.status_code == 422  # Validation error
    
    def test_compile_rejects_invalid_board_id(self):
        """测试拒绝无效的开发板 ID"""
        response = client.post(
            "/api/compile",
            json={"code": "void setup() {}", "board_id": "invalid_board"}
        )
        assert response.status_code == 422  # Validation error
        
        data = response.json()
        assert "detail" in data
    
    def test_compile_accepts_valid_request(self):
        """测试接受有效请求"""
        response = client.post(
            "/api/compile",
            json={
                "code": "void setup() {\n  Serial.begin(115200);\n}\n\nvoid loop() {\n  delay(1000);\n}",
                "board_id": "esp32"
            }
        )
        # 目前返回 501 (未实现)，但应该通过验证
        assert response.status_code in [200, 501]
    
    def test_compile_accepts_all_supported_boards(self):
        """测试接受所有支持的开发板"""
        boards_response = client.get("/api/boards")
        boards = boards_response.json()["boards"]
        
        for board in boards:
            response = client.post(
                "/api/compile",
                json={"code": "void setup() {}", "board_id": board["id"]}
            )
            # 应该通过验证（即使返回 501）
            assert response.status_code in [200, 501]


class TestFirmwareEndpoint:
    """固件下载端点测试"""
    
    def test_firmware_endpoint_exists(self):
        """测试固件下载端点存在"""
        response = client.get("/api/firmware/test123")
        # 目前返回 501 (未实现)，但端点应该存在
        assert response.status_code in [200, 404, 501]


class TestRootEndpoint:
    """根端点测试"""
    
    def test_root_returns_info(self):
        """测试根端点返回服务信息"""
        response = client.get("/")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "version" in data
        assert "status" in data
        assert data["version"] == "0.1.0"

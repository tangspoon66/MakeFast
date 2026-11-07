"""
用户固件路由测试

测试用户端固件浏览 API 的功能。
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from conftest import make_learner_client

# 下载接口需要学习者会话
client = make_learner_client()


def _items(body):
    """/api/firmware 现在返回分页结构 {items, page, ...}；兼容旧的列表格式。"""
    return body["items"] if isinstance(body, dict) and "items" in body else body



def test_get_published_firmware_no_filters():
    """测试获取所有已发布固件（无筛选）"""
    response = client.get("/api/firmware")
    
    assert response.status_code == 200
    data = _items(response.json())
    assert isinstance(data, list)
    
    # 验证返回的固件都是已发布的
    for firmware in data:
        assert firmware.get("published") is True
        assert "firmware_id" in firmware
        assert "project_name" in firmware
        assert "version" in firmware


def test_get_published_firmware_with_board_filter():
    """测试按开发板 ID 筛选固件"""
    response = client.get("/api/firmware?board_id=esp32dev")
    
    assert response.status_code == 200
    data = _items(response.json())
    assert isinstance(data, list)
    
    # 验证返回的固件都支持指定的开发板
    for firmware in data:
        assert "esp32dev" in firmware.get("supported_board_ids", [])


def test_get_published_firmware_with_tags_filter():
    """测试按标签筛选固件"""
    response = client.get("/api/firmware?tags=wifi,sensor")
    
    assert response.status_code == 200
    data = _items(response.json())
    assert isinstance(data, list)
    
    # 验证返回的固件至少包含一个指定的标签
    for firmware in data:
        tags = firmware.get("tags", [])
        assert any(tag in ["wifi", "sensor"] for tag in tags)


def test_get_published_firmware_with_search():
    """测试搜索功能"""
    response = client.get("/api/firmware?search=温度")
    
    assert response.status_code == 200
    data = _items(response.json())
    assert isinstance(data, list)
    
    # 验证返回的固件名称或描述包含搜索关键词
    for firmware in data:
        project_name = firmware.get("project_name", "").lower()
        description = firmware.get("description", "").lower()
        assert "温度" in project_name or "温度" in description


def test_get_published_firmware_with_multiple_filters():
    """测试组合筛选"""
    response = client.get("/api/firmware?board_id=esp32dev&tags=wifi&search=监控")
    
    assert response.status_code == 200
    data = _items(response.json())
    assert isinstance(data, list)
    
    # 验证返回的固件满足所有筛选条件
    for firmware in data:
        assert "esp32dev" in firmware.get("supported_board_ids", [])
        assert "wifi" in firmware.get("tags", [])
        project_name = firmware.get("project_name", "").lower()
        description = firmware.get("description", "").lower()
        assert "监控" in project_name or "监控" in description


def test_get_published_firmware_sorted_by_created_at():
    """测试固件按创建时间降序排序"""
    response = client.get("/api/firmware")
    
    assert response.status_code == 200
    data = _items(response.json())
    
    if len(data) > 1:
        # 验证固件按创建时间降序排序
        for i in range(len(data) - 1):
            created_at_1 = data[i].get("created_at")
            created_at_2 = data[i + 1].get("created_at")
            assert created_at_1 >= created_at_2


def test_get_published_firmware_empty_result():
    """测试筛选结果为空的情况"""
    response = client.get("/api/firmware?board_id=nonexistent_board")
    
    assert response.status_code == 200
    data = _items(response.json())
    assert isinstance(data, list)
    assert len(data) == 0


def test_get_published_firmware_search_max_length():
    """测试搜索关键词长度限制"""
    # 创建一个超过 200 字符的搜索关键词
    long_search = "a" * 201
    response = client.get(f"/api/firmware?search={long_search}")
    
    # FastAPI 应该返回 422 验证错误
    assert response.status_code == 422


# ============================================================================
# 固件详情端点测试
# ============================================================================

def test_get_firmware_detail_success():
    """测试获取固件详情（成功）"""
    # 首先获取一个已发布的固件 ID
    list_response = client.get("/api/firmware")
    assert list_response.status_code == 200
    firmwares = _items(list_response.json())
    
    if len(firmwares) > 0:
        firmware_id = firmwares[0]["firmware_id"]
        
        # 获取固件详情
        response = client.get(f"/api/firmware/{firmware_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        # 验证返回的数据结构
        assert data["firmware_id"] == firmware_id
        assert "project_name" in data
        assert "description" in data
        assert "version" in data
        assert "supported_board_ids" in data
        assert "files" in data
        assert "total_size" in data
        assert data["published"] is True


def test_get_firmware_detail_not_found():
    """测试获取不存在的固件详情"""
    response = client.get("/api/firmware/nonexistent_firmware_id")
    
    assert response.status_code == 404
    data = response.json()
    # FastAPI returns detail field in error responses
    assert "detail" in data
    detail = data["detail"]
    assert detail["success"] is False
    assert detail["error_code"] == "firmware_not_found"


def test_get_firmware_detail_unpublished():
    """测试获取未发布的固件详情（应返回 404）"""
    # 注意：这个测试需要有未发布的固件存在
    # 在实际测试中，可能需要先创建一个未发布的固件
    pass


# ============================================================================
# 固件包下载端点测试
# ============================================================================

def test_download_firmware_package_success():
    """测试下载固件包（成功）"""
    # 首先获取一个已发布的固件 ID
    list_response = client.get("/api/firmware")
    assert list_response.status_code == 200
    firmwares = _items(list_response.json())
    
    if len(firmwares) > 0:
        firmware_id = firmwares[0]["firmware_id"]
        
        # 下载固件包
        response = client.get(f"/api/firmware/{firmware_id}/download")
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/zip"
        assert "content-disposition" in response.headers
        assert "attachment" in response.headers["content-disposition"]
        
        # 验证返回的是 ZIP 文件
        content = response.content
        assert len(content) > 0
        # ZIP 文件的魔术字节是 PK (0x50 0x4B)
        assert content[:2] == b'PK'


def test_download_firmware_package_not_found():
    """测试下载不存在的固件包"""
    response = client.get("/api/firmware/nonexistent_firmware_id/download")
    
    assert response.status_code == 404
    data = response.json()
    # FastAPI returns detail field in error responses
    assert "detail" in data
    detail = data["detail"]
    assert detail["success"] is False
    assert detail["error_code"] == "firmware_not_found"


def test_download_firmware_package_updates_statistics():
    """测试下载固件包更新统计信息"""
    # 首先获取一个已发布的固件 ID
    list_response = client.get("/api/firmware")
    assert list_response.status_code == 200
    firmwares = _items(list_response.json())
    
    if len(firmwares) > 0:
        firmware_id = firmwares[0]["firmware_id"]
        
        # 获取下载前的统计信息
        detail_response_before = client.get(f"/api/firmware/{firmware_id}")
        assert detail_response_before.status_code == 200
        download_count_before = detail_response_before.json()["download_count"]
        
        # 下载固件包
        download_response = client.get(f"/api/firmware/{firmware_id}/download")
        assert download_response.status_code == 200
        
        # 获取下载后的统计信息
        detail_response_after = client.get(f"/api/firmware/{firmware_id}")
        assert detail_response_after.status_code == 200
        download_count_after = detail_response_after.json()["download_count"]
        
        # 验证下载次数增加了 1
        assert download_count_after == download_count_before + 1


# ============================================================================
# 单个固件文件下载端点测试
# ============================================================================

def test_download_firmware_file_success():
    """测试下载单个固件文件（成功）"""
    # 首先获取一个已发布的固件 ID
    list_response = client.get("/api/firmware")
    assert list_response.status_code == 200
    firmwares = _items(list_response.json())
    
    if len(firmwares) > 0:
        firmware_id = firmwares[0]["firmware_id"]
        
        # 获取固件详情以获取文件列表
        detail_response = client.get(f"/api/firmware/{firmware_id}")
        assert detail_response.status_code == 200
        files = detail_response.json()["files"]
        
        if len(files) > 0:
            filename = files[0]["name"]
            
            # 下载单个文件
            response = client.get(f"/api/firmware/{firmware_id}/files/{filename}")
            
            assert response.status_code == 200
            assert response.headers["content-type"] == "application/octet-stream"
            assert "content-disposition" in response.headers
            assert filename in response.headers["content-disposition"]
            
            # 验证返回的文件内容不为空
            content = response.content
            assert len(content) > 0


def test_download_firmware_file_not_found():
    """测试下载不存在的固件文件"""
    # 首先获取一个已发布的固件 ID
    list_response = client.get("/api/firmware")
    assert list_response.status_code == 200
    firmwares = _items(list_response.json())
    
    if len(firmwares) > 0:
        firmware_id = firmwares[0]["firmware_id"]
        
        # 尝试下载不存在的文件
        response = client.get(f"/api/firmware/{firmware_id}/files/nonexistent.bin")
        
        assert response.status_code == 404
        data = response.json()
        # FastAPI returns detail field in error responses
        assert "detail" in data
        detail = data["detail"]
        assert detail["success"] is False
        assert detail["error_code"] == "file_not_found"


def test_download_firmware_file_path_traversal_protection():
    """测试路径遍历攻击防护"""
    # 首先获取一个已发布的固件 ID
    list_response = client.get("/api/firmware")
    assert list_response.status_code == 200
    firmwares = _items(list_response.json())
    
    if len(firmwares) > 0:
        firmware_id = firmwares[0]["firmware_id"]
        
        # 尝试路径遍历攻击
        malicious_filenames = [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32\\config\\sam",
            "../../metadata.json"
        ]
        
        for malicious_filename in malicious_filenames:
            response = client.get(f"/api/firmware/{firmware_id}/files/{malicious_filename}")
            
            # 应该返回 404，而不是泄露文件
            assert response.status_code == 404


# ============================================================================
# 缩略图端点测试
# ============================================================================

def test_get_firmware_thumbnail_success():
    """测试获取缩略图（成功）"""
    # 首先获取一个有缩略图的已发布固件 ID
    list_response = client.get("/api/firmware")
    assert list_response.status_code == 200
    firmwares = _items(list_response.json())
    
    # 查找有缩略图的固件
    firmware_with_thumbnail = None
    for firmware in firmwares:
        if firmware.get("has_thumbnail"):
            firmware_with_thumbnail = firmware
            break
    
    if firmware_with_thumbnail:
        firmware_id = firmware_with_thumbnail["firmware_id"]
        
        # 获取缩略图
        response = client.get(f"/api/firmware/{firmware_id}/thumbnail")
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"
        assert "cache-control" in response.headers
        
        # 验证返回的是图片文件
        content = response.content
        assert len(content) > 0
        # PNG 文件的魔术字节是 0x89 0x50 0x4E 0x47
        assert content[:4] == b'\x89PNG'


def test_get_firmware_thumbnail_not_found():
    """测试获取不存在的缩略图"""
    # 首先获取一个没有缩略图的已发布固件 ID
    list_response = client.get("/api/firmware")
    assert list_response.status_code == 200
    firmwares = _items(list_response.json())
    
    # 查找没有缩略图的固件
    firmware_without_thumbnail = None
    for firmware in firmwares:
        if not firmware.get("has_thumbnail"):
            firmware_without_thumbnail = firmware
            break
    
    if firmware_without_thumbnail:
        firmware_id = firmware_without_thumbnail["firmware_id"]
        
        # 尝试获取缩略图
        response = client.get(f"/api/firmware/{firmware_id}/thumbnail")
        
        assert response.status_code == 404
        data = response.json()
        # FastAPI returns detail field in error responses
        assert "detail" in data
        detail = data["detail"]
        assert detail["success"] is False
        assert detail["error_code"] == "file_not_found"


def test_get_firmware_thumbnail_firmware_not_found():
    """测试获取不存在固件的缩略图"""
    response = client.get("/api/firmware/nonexistent_firmware_id/thumbnail")
    
    assert response.status_code == 404
    data = response.json()
    # FastAPI returns detail field in error responses
    assert "detail" in data
    detail = data["detail"]
    assert detail["success"] is False
    assert detail["error_code"] == "firmware_not_found"

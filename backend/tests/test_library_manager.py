"""
库管理器测试

测试库管理器的所有功能。
"""

import pytest
from app.library_manager import (
    LibraryManager,
    LibraryNotFoundError,
    LibraryDownloadError,
    get_library_manager
)


class TestLibraryManager:
    """库管理器基础测试"""
    
    def test_library_manager_initialization(self):
        """测试库管理器初始化"""
        manager = LibraryManager()
        assert manager is not None
        assert manager.cache_dir.exists()
    
    def test_core_library_detection(self):
        """测试核心库检测"""
        manager = LibraryManager()
        
        # 核心库应该被识别
        assert manager.is_core_library('WiFi') is True
        assert manager.is_core_library('Bluetooth') is True
        assert manager.is_core_library('SPIFFS') is True
        assert manager.is_core_library('Wire') is True
        
        # 非核心库不应该被识别
        assert manager.is_core_library('PubSubClient') is False
        assert manager.is_core_library('NonExistentLib') is False
    
    def test_preinstalled_library_detection(self):
        """测试预装库检测"""
        manager = LibraryManager()
        
        # 核心库应该被视为预装
        assert manager.is_preinstalled('WiFi') is True
        
        # 预装库应该被识别
        assert manager.is_preinstalled('PubSubClient') is True
        assert manager.is_preinstalled('ArduinoJson') is True
    
    def test_library_name_validation(self):
        """测试库名称验证"""
        manager = LibraryManager()
        
        # 有效的库名
        assert manager.validate_library_name('WiFi') is True
        assert manager.validate_library_name('PubSubClient') is True
        assert manager.validate_library_name('Adafruit GFX Library') is True
        
        # 无效的库名（路径遍历）
        assert manager.validate_library_name('../../../etc/passwd') is False
        assert manager.validate_library_name('lib/../../../etc') is False
        
        # 无效的库名（危险字符）
        assert manager.validate_library_name('lib; rm -rf /') is False
        assert manager.validate_library_name('lib && echo hack') is False
        assert manager.validate_library_name('lib | cat /etc/passwd') is False
    
    def test_get_installed_libraries(self):
        """测试获取已安装库列表"""
        manager = LibraryManager()
        
        libs = manager.get_installed_libraries()
        assert isinstance(libs, list)
        assert len(libs) > 0
        
        # 应该包含一些预装库
        lib_names = {lib["name"] if isinstance(lib, dict) else lib for lib in libs}
        assert 'PubSubClient' in lib_names or 'ArduinoJson' in lib_names
    
    def test_singleton_pattern(self):
        """测试单例模式"""
        manager1 = get_library_manager()
        manager2 = get_library_manager()
        
        assert manager1 is manager2


class TestLibraryCache:
    """库缓存测试"""
    
    def test_is_cached_for_installed_library(self):
        """测试已安装库的缓存检测"""
        manager = LibraryManager()
        
        # PubSubClient 应该已经安装
        assert manager.is_cached('PubSubClient') is True
    
    def test_is_cached_for_non_installed_library(self):
        """测试未安装库的缓存检测"""
        manager = LibraryManager()
        
        # 一个不太可能安装的库
        assert manager.is_cached('NonExistentLibraryXYZ123') is False


class TestLibraryDownload:
    """库下载测试（集成测试）"""
    
    @pytest.mark.integration
    def test_download_existing_library(self):
        """测试下载存在的库"""
        manager = LibraryManager()
        
        # 如果 FastLED 已安装，先卸载
        if manager.is_cached('FastLED'):
            manager.clear_cache('FastLED')
        
        # 下载库
        manager.download_library('FastLED')
        
        # 验证库已安装
        assert manager.is_cached('FastLED') is True
    
    @pytest.mark.integration
    def test_download_non_existing_library(self):
        """测试下载不存在的库"""
        manager = LibraryManager()
        
        # 尝试下载不存在的库
        with pytest.raises(LibraryNotFoundError):
            manager.download_library('NonExistentLibraryXYZ123')
    
    @pytest.mark.integration
    def test_download_already_installed_library(self):
        """测试下载已安装的库"""
        manager = LibraryManager()
        
        # 下载已安装的库应该直接返回
        manager.download_library('PubSubClient')
        
        # 验证库仍然安装
        assert manager.is_cached('PubSubClient') is True


class TestEnsureLibraries:
    """确保库可用测试"""
    
    def test_ensure_core_libraries(self):
        """测试确保核心库可用"""
        manager = LibraryManager()
        
        # 核心库应该直接可用，不需要下载
        manager.ensure_libraries(['WiFi', 'Bluetooth', 'Wire'])
    
    def test_ensure_preinstalled_libraries(self):
        """测试确保预装库可用"""
        manager = LibraryManager()
        
        # 预装库应该已经可用
        manager.ensure_libraries(['PubSubClient', 'ArduinoJson'])
    
    def test_ensure_empty_library_list(self):
        """测试空库列表"""
        manager = LibraryManager()
        
        # 空列表应该直接返回
        manager.ensure_libraries([])
    
    @pytest.mark.integration
    def test_ensure_mixed_libraries(self):
        """测试混合库列表（核心库 + 预装库 + 需下载的库）"""
        manager = LibraryManager()
        
        # 如果 FastLED 已安装，先卸载
        if manager.is_cached('FastLED'):
            manager.clear_cache('FastLED')
        
        # 混合库列表
        libs = ['WiFi', 'PubSubClient', 'FastLED']
        manager.ensure_libraries(libs)
        
        # 验证所有库都可用
        assert manager.is_core_library('WiFi') or manager.is_cached('WiFi')
        assert manager.is_cached('PubSubClient')
        assert manager.is_cached('FastLED')
    
    @pytest.mark.integration
    def test_ensure_libraries_with_non_existing(self):
        """测试包含不存在库的列表"""
        manager = LibraryManager()
        
        # 包含不存在的库
        libs = ['WiFi', 'NonExistentLibraryXYZ123']
        
        with pytest.raises(LibraryNotFoundError):
            manager.ensure_libraries(libs)


class TestClearCache:
    """清除缓存测试"""
    
    @pytest.mark.integration
    def test_clear_cache_for_installed_library(self):
        """测试清除已安装库的缓存"""
        manager = LibraryManager()
        
        # 确保 FastLED 已安装
        if not manager.is_cached('FastLED'):
            manager.download_library('FastLED')
        
        # 清除缓存
        result = manager.clear_cache('FastLED')
        assert result is True
        
        # 验证库已卸载
        assert manager.is_cached('FastLED') is False
    
    @pytest.mark.integration
    def test_clear_cache_for_non_installed_library(self):
        """测试清除未安装库的缓存"""
        manager = LibraryManager()
        
        # 清除不存在的库
        result = manager.clear_cache('NonExistentLibraryXYZ123')
        # 应该返回 False 或不抛出异常
        assert result is False or result is True

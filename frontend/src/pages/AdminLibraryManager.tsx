/**
 * 库管理页面 - 管理员在线安装/卸载 Arduino 库
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  RefreshCw,
  Download,
  Trash2,
  AlertTriangle,
  CircleCheck,
} from 'lucide-react';
import { AdminClient } from '../api/adminClient';

interface LibInfo {
  name: string;
  version: string;
}

// 库简介和开发板支持信息
const LIB_DESCRIPTIONS: Record<string, { desc: string; boards: string }> = {
  'Adafruit NeoPixel': { desc: 'WS2812/NeoPixel 全彩 LED 灯带/灯珠驱动', boards: 'ESP32, Arduino' },
  'DHT sensor library': { desc: 'DHT11/DHT22 温湿度传感器驱动', boards: 'ESP32, Arduino' },
  'Adafruit SSD1306': { desc: 'SSD1306 OLED 显示屏驱动（I2C/SPI）', boards: 'ESP32, Arduino' },
  'Adafruit GFX Library': { desc: '图形库，提供基础绘图功能（线条、文字、图形）', boards: 'ESP32, Arduino' },
  'Servo': { desc: '舵机控制库，支持 PWM 舵机角度控制', boards: 'ESP32, Arduino' },
  'Wire': { desc: 'I2C 通信库，用于连接 I2C 设备', boards: 'ESP32, Arduino' },
  'SPI': { desc: 'SPI 通信库，用于高速串行通信', boards: 'ESP32, Arduino' },
  'WiFi': { desc: 'WiFi 网络连接库，支持 STA/AP 模式', boards: 'ESP32' },
  'HTTPClient': { desc: 'HTTP 客户端库，用于发送 HTTP 请求', boards: 'ESP32' },
  'ArduinoJson': { desc: 'JSON 解析和生成库，高效内存管理', boards: 'ESP32, Arduino' },
  'PubSubClient': { desc: 'MQTT 客户端库，用于 IoT 消息通信', boards: 'ESP32, Arduino' },
  'ESP32Servo': { desc: 'ESP32 专用舵机库，支持多通道 PWM', boards: 'ESP32' },
  'Adafruit Unified Sensor': { desc: '统一传感器接口库，提供标准化传感器数据格式', boards: 'ESP32, Arduino' },
  'OneWire': { desc: '单总线通信协议库（DS18B20 等）', boards: 'ESP32, Arduino' },
  'DallasTemperature': { desc: 'DS18B20 数字温度传感器驱动', boards: 'ESP32, Arduino' },
  'FastLED': { desc: '高性能 LED 灯带驱动库，支持多种灯带芯片', boards: 'ESP32, Arduino' },
  'LiquidCrystal I2C': { desc: 'I2C 接口 LCD 液晶显示屏驱动', boards: 'ESP32, Arduino' },
  'SD': { desc: 'SD 卡读写库，支持 FAT 文件系统', boards: 'ESP32, Arduino' },
  'EEPROM': { desc: 'EEPROM 模拟库，提供非易失性存储', boards: 'ESP32, Arduino' },
  'Preferences': { desc: 'ESP32 键值存储库，替代 EEPROM', boards: 'ESP32' },
  'ESPAsyncWebServer': { desc: '异步 Web 服务器库，支持 WebSocket', boards: 'ESP32' },
  'AsyncTCP': { desc: '异步 TCP 通信库（ESPAsyncWebServer 依赖）', boards: 'ESP32' },
  'IRremote': { desc: '红外遥控收发库，支持多种红外协议', boards: 'ESP32, Arduino' },
  'NewPing': { desc: '超声波测距传感器库（HC-SR04 等）', boards: 'ESP32, Arduino' },
  'Adafruit BME280': { desc: 'BME280 温湿度气压传感器驱动', boards: 'ESP32, Arduino' },
  'Adafruit BMP280': { desc: 'BMP280 气压传感器驱动', boards: 'ESP32, Arduino' },
  'MFRC522': { desc: 'RFID 射频识别模块驱动（RC522）', boards: 'ESP32, Arduino' },
  'U8g2': { desc: '单色图形显示驱动，支持多种 OLED/LCD', boards: 'ESP32, Arduino' },
  'TFT_eSPI': { desc: '高性能 TFT 彩屏驱动库（SPI）', boards: 'ESP32' },
  'Adafruit MPU6050': { desc: 'MPU6050 六轴加速度/陀螺仪传感器驱动', boards: 'ESP32, Arduino' },
  'HX711': { desc: 'HX711 称重传感器 ADC 驱动', boards: 'ESP32, Arduino' },
  'AccelStepper': { desc: '步进电机控制库，支持多种驱动方式', boards: 'ESP32, Arduino' },
  'BLE': { desc: '蓝牙低功耗（BLE）通信库', boards: 'ESP32' },
  'BluetoothSerial': { desc: '经典蓝牙串口通信库', boards: 'ESP32' },
};

export function AdminLibraryManager() {
  const navigate = useNavigate();
  const [libraries, setLibraries] = useState<LibInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installName, setInstallName] = useState('');
  const [installingLib, setInstallingLib] = useState<string | null>(null);
  const [installMsg, setInstallMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // 在线搜索
  const [searchResults, setSearchResults] = useState<Array<{ name: string; version: string; description?: string }>>([]);
  const [searchingLib, setSearchingLib] = useState(false);

  // 自定义库
  const [customLibs, setCustomLibs] = useState<Array<{ name: string }>>([]);
  const [customName, setCustomName] = useState('');
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [customUploading, setCustomUploading] = useState(false);
  const [customMsg, setCustomMsg] = useState<string | null>(null);

  const loadCustomLibs = async () => {
    try {
      const libs = await (await import('../api/compilationClient')).CompilationClient.getCustomLibraries();
      setCustomLibs(libs);
    } catch (e) {
      console.warn('Failed to load custom libraries:', e);
    }
  };

  const loadLibraries = async () => {
    setLoading(true);
    setError(null);
    try {
      const libs = await AdminClient.getLibraries();
      setLibraries(libs);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取库列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLibraries(); loadCustomLibs(); }, []);

  const handleSearchLib = async () => {
    if (!installName.trim() || searchingLib) return;
    setSearchingLib(true);
    setInstallMsg(null);
    setSearchResults([]);
    try {
      const { CompilationClient } = await import('../api/compilationClient');
      const libs = await CompilationClient.searchLibraries(installName.trim());
      setSearchResults(libs);
      if (libs.length === 0) {
        setInstallMsg('未找到匹配的库');
      }
    } catch {
      setInstallMsg('搜索失败，请重试');
    } finally {
      setSearchingLib(false);
    }
  };

  const handleInstallLib = async (name: string) => {
    if (installingLib) return;
    setInstallingLib(name);
    setInstallMsg(null);
    try {
      const result = await AdminClient.installLibrary(name);
      const installedName = result.name || name;
      setInstallMsg(`${result.message || `库 "${installedName}" 安装成功`}${result.version ? ` (v${result.version})` : ''}`);
      setInstallName('');
      setSearchResults([]);
      await loadLibraries();
      setSearchQuery(installedName);
    } catch (err) {
      setInstallMsg(`安装失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setInstallingLib(null);
    }
  };

  const handleUninstall = async (name: string) => {
    if (!confirm(`确定要卸载库 "${name}" 吗？`)) return;
    try {
      await AdminClient.uninstallLibrary(name);
      setLibraries(prev => prev.filter(l => l.name !== name));
    } catch (err) {
      alert(`卸载失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const filtered = libraries.filter(l =>
    l.name && l.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#edf6fb] p-8">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>返回管理后台</span>
        </button>

        <h1 className="text-2xl font-bold text-slate-900 mb-6">Arduino 库管理</h1>

        {/* 搜索安装库 */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">搜索安装库</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={installName}
              onChange={e => { setInstallName(e.target.value); setInstallMsg(null); setSearchResults([]); }}
              placeholder="输入库名搜索，如: DHT sensor library"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              onKeyDown={e => { if (e.key === 'Enter') handleSearchLib(); }}
            />
            <button
              onClick={handleSearchLib}
              disabled={!installName.trim() || searchingLib}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {searchingLib ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  搜索中...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  搜索
                </>
              )}
            </button>
          </div>
          {/* 搜索结果 */}
          {searchResults.length > 0 && (
            <div className="mt-3 border border-slate-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
              {searchResults.map((lib) => (
                <div key={lib.name} className="flex items-center justify-between px-3 py-2.5 hover:bg-[#edf6fb]">
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="text-sm font-medium text-slate-900 truncate">{lib.name}</div>
                    {lib.description && <div className="text-xs text-slate-500 truncate mt-0.5">{lib.description}</div>}
                  </div>
                  <button
                    onClick={() => handleInstallLib(lib.name)}
                    disabled={installingLib === lib.name}
                    className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white text-xs rounded hover:bg-teal-700 disabled:opacity-50 shrink-0 font-medium"
                  >
                    {installingLib === lib.name ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    安装
                  </button>
                </div>
              ))}
            </div>
          )}
          {installMsg && (
            <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${installMsg.includes('失败') || installMsg.includes('未找到') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {(installMsg.includes('失败') || installMsg.includes('未找到')) ? <AlertTriangle className="w-4 h-4 inline mr-1" /> : <CircleCheck className="w-4 h-4 inline mr-1" />}
              {installMsg}
            </div>
          )}
        </div>

        {/* 已安装库列表 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              已安装库 ({filtered.length})
            </h2>
            <button onClick={loadLibraries} disabled={loading} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>

          {/* 搜索 */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索库名..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="max-h-[480px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-slate-500">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                <p className="text-sm">加载中...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center text-red-600 text-sm">{error}</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                {searchQuery ? '没有匹配的库' : '暂无已安装的库'}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map(lib => {
                  const libDesc = LIB_DESCRIPTIONS[lib.name];
                  return (
                    <div key={lib.name} className="px-4 py-3 hover:bg-[#edf6fb]">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-slate-900">{lib.name}</span>
                          {lib.version && <span className="ml-2 text-xs text-gray-400">v{lib.version}</span>}
                        </div>
                        <button
                          onClick={() => handleUninstall(lib.name)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          卸载
                        </button>
                      </div>
                      {libDesc && (
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                          <span className="text-xs text-slate-500">{libDesc.desc}</span>
                          <span className="text-xs text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">{libDesc.boards}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 自定义库管理 */}
        <div className="bg-white rounded-lg shadow mt-6">
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700">自定义库 ({customLibs.length})</h2>
            <p className="text-xs text-gray-400 mt-1">管理员上传的 ZIP 库文件，会出现在用户搜索结果中</p>
          </div>

          {/* 上传区 */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">库名称</label>
                <input type="text" value={customName} onChange={e => setCustomName(e.target.value)}
                  placeholder="如: MyCustomDriver" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">ZIP 文件</label>
                <input type="file" accept=".zip" onChange={e => { const f = e.target.files?.[0]; if (f) { setCustomFile(f); if (!customName) setCustomName(f.name.replace('.zip', '')); } }}
                  className="text-sm text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-teal-50 file:text-teal-700 w-full" />
              </div>
              <button onClick={async () => {
                if (!customFile) return;
                setCustomUploading(true);
                setCustomMsg(null);
                try {
                  const result = await AdminClient.uploadCustomLibrary(
                    customFile,
                    customName || customFile.name.replace('.zip', ''),
                  );
                  setCustomMsg(result.success ? '上传成功' : '上传失败: ' + result.message);
                  if (result.success) {
                    setCustomFile(null);
                    setCustomName('');
                    loadCustomLibs();
                  }
                } catch (err: any) {
                  setCustomMsg('上传失败: ' + (err?.message || '未知错误'));
                } finally {
                  setCustomUploading(false);
                }
              }} disabled={!customFile || customUploading}
                className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium"
              >
                {customUploading ? '上传中...' : '上传'}
              </button>
            </div>
            {customMsg && (
              <div className={`mt-3 text-xs ${customMsg.includes('失败') ? 'text-red-600' : 'text-green-600'}`}>{customMsg}</div>
            )}
          </div>

          {/* 自定义库列表 */}
          {customLibs.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">暂无自定义库</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {customLibs.map(lib => (
                <div key={lib.name} className="flex items-center justify-between px-4 py-3 hover:bg-[#edf6fb]">
                  <div>
                    <span className="text-sm font-medium text-slate-900">{lib.name}</span>
                  </div>
                  <button onClick={async () => {
                    if (!confirm(`删除自定义库 "${lib.name}"？`)) return;
                    try {
                      const result = await AdminClient.deleteCustomLibrary(lib.name);
                      if (result.success) {
                        loadCustomLibs();
                      } else {
                        alert('删除失败: ' + result.message);
                      }
                    } catch (err: any) {
                      alert('删除失败: ' + (err?.message || '未知错误'));
                    }
                  }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />删除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

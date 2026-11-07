/**
 * 浏览器兼容性警告组件
 * 
 * 当浏览器不支持 Web Serial API 时显示友好的警告信息
 */

import { useState } from 'react';
import { checkBrowserCompatibility, getSupportedBrowsers } from '../utils/browserCompatibility';

export function BrowserCompatibilityWarning() {
  const [isVisible, setIsVisible] = useState(true);
  const compatibility = checkBrowserCompatibility();
  
  // 如果浏览器支持，不显示警告
  if (compatibility.isSupported || !isVisible) {
    return null;
  }
  
  const supportedBrowsers = getSupportedBrowsers();
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 relative">
        {/* 关闭按钮 */}
        <button
          onClick={() => setIsVisible(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="关闭"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        {/* 警告图标 */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center">
            <svg className="w-12 h-12 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>
        
        {/* 标题 */}
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">
          浏览器不支持 😢
        </h2>
        
        {/* 说明文字 */}
        <div className="text-gray-600 text-center mb-6 space-y-2">
          <p>
            您当前使用的浏览器是 <strong>{compatibility.browserName} {compatibility.browserVersion}</strong>
          </p>
          <p>
            该浏览器不支持 <strong>Web Serial API</strong>，无法直接上传固件到 ESP32 设备。
          </p>
          <p className="text-sm text-gray-500">
            （您仍然可以使用编译功能，但需要手动下载固件后使用其他工具上传）
          </p>
        </div>
        
        {/* 缺失功能列表 */}
        {compatibility.missingFeatures.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-red-800 mb-2">缺失的功能：</h3>
            <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
              {compatibility.missingFeatures.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* 推荐浏览器 */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
            推荐使用以下浏览器：
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {supportedBrowsers.map((browser, index) => (
              <a
                key={index}
                href={browser.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-lg transition-all text-center group"
              >
                <div className="text-4xl mb-2">{browser.icon}</div>
                <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {browser.name}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  版本 {browser.minVersion}+
                </div>
              </a>
            ))}
          </div>
        </div>
        
        {/* 继续使用按钮 */}
        <div className="flex justify-center">
          <button
            onClick={() => setIsVisible(false)}
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-colors"
          >
            我知道了，继续使用
          </button>
        </div>
      </div>
    </div>
  );
}

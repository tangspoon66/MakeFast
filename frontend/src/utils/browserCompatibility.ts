/**
 * 浏览器兼容性检查工具
 * 
 * 检查浏览器是否支持 Web Serial API（用于 ESP32 固件上传）
 */

export interface BrowserCompatibility {
  isSupported: boolean;
  missingFeatures: string[];
  browserName: string;
  browserVersion: string;
}

/**
 * 检测浏览器名称和版本
 */
function detectBrowser(): { name: string; version: string } {
  const userAgent = navigator.userAgent;
  
  // Chrome
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    const match = userAgent.match(/Chrome\/(\d+)/);
    return {
      name: 'Chrome',
      version: match ? match[1] : 'Unknown'
    };
  }
  
  // Edge
  if (userAgent.includes('Edg')) {
    const match = userAgent.match(/Edg\/(\d+)/);
    return {
      name: 'Edge',
      version: match ? match[1] : 'Unknown'
    };
  }
  
  // Opera
  if (userAgent.includes('OPR') || userAgent.includes('Opera')) {
    const match = userAgent.match(/(?:OPR|Opera)\/(\d+)/);
    return {
      name: 'Opera',
      version: match ? match[1] : 'Unknown'
    };
  }
  
  // Firefox
  if (userAgent.includes('Firefox')) {
    const match = userAgent.match(/Firefox\/(\d+)/);
    return {
      name: 'Firefox',
      version: match ? match[1] : 'Unknown'
    };
  }
  
  // Safari
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    const match = userAgent.match(/Version\/(\d+)/);
    return {
      name: 'Safari',
      version: match ? match[1] : 'Unknown'
    };
  }
  
  return {
    name: 'Unknown',
    version: 'Unknown'
  };
}

/**
 * 检查浏览器兼容性
 * 
 * @returns BrowserCompatibility 兼容性检查结果
 */
export function checkBrowserCompatibility(): BrowserCompatibility {
  const missingFeatures: string[] = [];
  const browser = detectBrowser();
  
  // 检查 Web Serial API
  if (!('serial' in navigator)) {
    missingFeatures.push('Web Serial API');
  }
  
  // 检查 HTTPS（Web Serial API 需要 HTTPS 或 localhost）
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    missingFeatures.push('HTTPS');
  }
  
  return {
    isSupported: missingFeatures.length === 0,
    missingFeatures,
    browserName: browser.name,
    browserVersion: browser.version
  };
}

/**
 * 获取支持的浏览器列表
 */
export function getSupportedBrowsers() {
  return [
    {
      name: 'Google Chrome',
      minVersion: '89',
      downloadUrl: 'https://www.google.com/chrome/',
      icon: '🌐'
    },
    {
      name: 'Microsoft Edge',
      minVersion: '89',
      downloadUrl: 'https://www.microsoft.com/edge',
      icon: '🌊'
    },
    {
      name: 'Opera',
      minVersion: '75',
      downloadUrl: 'https://www.opera.com/',
      icon: '🎭'
    }
  ];
}

/**
 * 检查是否需要显示兼容性警告
 */
export function shouldShowCompatibilityWarning(): boolean {
  const compatibility = checkBrowserCompatibility();
  return !compatibility.isSupported;
}

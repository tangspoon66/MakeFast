// Modern ESP Launchpad Application - 完整功能版本
// 导入 ESP 工具库
import { ESPLoader, Transport } from './bundle.js';

class ModernESPLaunchpad {
    constructor() {
        this.isConnected = false;
        this.isFlashing = false;
        this.device = null;
        this.transport = null;
        this.esploader = null;
        this.selectedFiles = [];
        this.progressCallback = null;
        this.chip = "default";
        this.chipDesc = "default";
        
        // 应用配置列表 - 可从外部配置文件加载
        this.availableApplications = [
            {
                name: "小智amourk08v1.6.2-增量包",
                url: "https://music.chenweikang.top/release_1.6.2/xiaozhi_xiaozhi_0x100000_1.6.2.bin",
                flashAddress: "0x100000",
                value: "xiaozhi-increment",
                description: "适用于已安装基础版本用户的增量更新包",
                version: "1.6.2",
                type: "increment"
            },
            {
                name: "小智amourk08v1.6.2-全量包", 
                url: "https://music.chenweikang.top/release_1.6.2/xiaozhi_xiaozhi_0x100000_1.6.2.bin",
                flashAddress: "0x0",
                value: "xiaozhi-full",
                description: "完整版本3合一固件，包含所有功能，适用于全新安装",
                version: "1.6.2",
                type: "full"
            }
        ];
        
        // ESP 库直接可用
        this.ESPLoader = ESPLoader;
        this.Transport = Transport;
        
        // USB 设备过滤器 - 支持的 ESP 设备
        this.usbPortFilters = [
            { usbVendorId: 0x10c4, usbProductId: 0xea60 }, /* CP2102/CP2102N */
            { usbVendorId: 0x0403, usbProductId: 0x6010 }, /* FT2232H */
            { usbVendorId: 0x303a, usbProductId: 0x1001 }, /* Espressif USB_SERIAL_JTAG */
            { usbVendorId: 0x303a, usbProductId: 0x1002 }, /* Espressif esp-usb-bridge firmware */
            { usbVendorId: 0x303a, usbProductId: 0x0002 }, /* ESP32-S2 USB_CDC */
            { usbVendorId: 0x303a, usbProductId: 0x0009 }, /* ESP32-S3 USB_CDC */
            { usbVendorId: 0x1a86, usbProductId: 0x55d4 }, /* CH9102F */
            { usbVendorId: 0x1a86, usbProductId: 0x7523 }, /* CH340T */
            { usbVendorId: 0x0403, usbProductId: 0x6001 }, /* FT232R */
        ];
        
        // 初始化应用
        this.init();
    }

    // 检查是否为不支持的浏览器
    isWebUSBSerialSupported() {
        let isSafari =
            /constructor/i.test(window.HTMLElement) ||
            (function (p) {
                return p.toString() === "[object SafariRemoteNotification]";
            })(
                !window["safari"] ||
                (typeof safari !== "undefined" && window["safari"].pushNotification)
            );

        let isFirefox = typeof InstallTrigger !== "undefined";

        return (isSafari || isFirefox);
    }

    async init() {
        this.initializeElements();
        this.bindEvents();
        this.checkBrowserSupport();
        this.initializeConsole();
        
        // 添加初始化成功信息
        this.addConsoleMessage('ESP 库加载成功，应用已就绪', 'success');
        
        await this.loadConfiguration();
    }

    initializeElements() {
        // 进度卡片元素（与连接提示卡片同位置切换）
        this.progressCard = document.getElementById('progressCard');
        // Connection elements
        this.connectToggleBtn = document.getElementById('connectToggleBtn');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.deviceInfoMini = document.getElementById('deviceInfoMini');
        this.chipInfoMini = document.getElementById('chipInfoMini');
        this.macAddressMini = document.getElementById('macAddressMini');

        // Firmware elements
        this.quickStartMode = document.getElementById('quickStartMode');
        this.diyMode = document.getElementById('diyMode');
        this.quickStartPanel = document.getElementById('quickStartPanel');
        this.diyPanel = document.getElementById('diyPanel');
        this.applicationSelect = document.getElementById('applicationSelect');
        this.firmwareFileInput = document.getElementById('firmwareFileInput');
        this.firmwareFilesList = document.getElementById('firmwareFilesList');
        this.fileUploadArea = document.getElementById('fileUploadArea');

        // Settings elements
        this.flashBaudrateSelect = document.getElementById('flashBaudrateSelect');
        this.consoleBaudrateSelect = document.getElementById('consoleBaudrateSelect');

        // Flash options elements
        this.flashButton = document.getElementById('flashButton');
        this.flashButtonText = document.getElementById('flashButtonText');
        this.eraseFlashBtn = document.getElementById('eraseFlashBtn');
        this.clearFilesBtn = document.getElementById('clearFilesBtn');
        this.validateFilesBtn = document.getElementById('validateFilesBtn');
        this.flashOptionsPanel = document.getElementById('flashOptionsPanel');
        this.quickAddSection = document.getElementById('quickAddSection');

        // Flash option controls
        this.eraseAllCheckbox = document.getElementById('eraseAllCheckbox');
        this.compressCheckbox = document.getElementById('compressCheckbox');
        this.flashSizeSelect = document.getElementById('flashSizeSelect');
        this.flashModeSelect = document.getElementById('flashModeSelect');

        // Progress elements
        this.progressCard = document.getElementById('progressCard');
        this.progressLabel = document.getElementById('progressLabel');
        this.progressPercentage = document.getElementById('progressPercentage');
        this.progressBar = document.getElementById('progressBar');
        this.progressDetails = document.getElementById('progressDetails');
        
        // 添加进度元素调试信息
        console.log('进度元素初始化状态:');
        console.log('progressCard:', !!this.progressCard);
        console.log('progressLabel:', !!this.progressLabel);
        console.log('progressPercentage:', !!this.progressPercentage);
        console.log('progressBar:', !!this.progressBar);
        console.log('progressDetails:', !!this.progressDetails);

        // Console elements
        this.consoleOutput = document.getElementById('consoleOutput');
        this.clearConsoleBtn = document.getElementById('clearConsoleBtn');
        this.resetDeviceBtn = document.getElementById('resetDeviceBtn');

        // QR Code elements
        this.qrCodeCard = document.getElementById('qrCodeCard');
        this.qrCodesContainer = document.getElementById('qrCodesContainer');

        // App description
        this.appDescriptionPanel = document.getElementById('appDescriptionPanel');
        this.appDescriptionText = document.getElementById('appDescriptionText');

        // Status alert
        this.statusAlert = document.getElementById('statusAlert');
        this.alertMessage = document.getElementById('alertMessage');
        this.emptyFilesState = document.getElementById('emptyFilesState');
    }

    bindEvents() {
        // Connection events
        if (this.connectToggleBtn) {
            this.connectToggleBtn.addEventListener('click', () => this.toggleConnection());
        }

        // Firmware mode toggle
        if (this.quickStartMode) {
            this.quickStartMode.addEventListener('change', () => this.toggleFirmwareMode());
        }
        if (this.diyMode) {
            this.diyMode.addEventListener('change', () => this.toggleFirmwareMode());
        }

        // File upload events
        if (this.firmwareFileInput) {
            this.firmwareFileInput.addEventListener('change', (e) => {
                e.stopPropagation();
                this.handleFileSelection(e);
            });
        }
        if (this.fileUploadArea) {
            this.fileUploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
            this.fileUploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            this.fileUploadArea.addEventListener('drop', (e) => this.handleFileDrop(e));
            this.fileUploadArea.addEventListener('click', (e) => this.handleUploadAreaClick(e));
        }

        // Application selection
        if (this.applicationSelect) {
            this.applicationSelect.addEventListener('change', () => this.handleApplicationChange());
        }

        // Flash events
        if (this.flashButton) {
            this.flashButton.addEventListener('click', () => this.startFlashing());
        }

        // Console events
        if (this.clearConsoleBtn) {
            this.clearConsoleBtn.addEventListener('click', () => this.clearConsole());
        }
        if (this.resetDeviceBtn) {
            this.resetDeviceBtn.addEventListener('click', () => this.resetDevice());
        }

        // Success modal reset button
        const resetAfterFlashBtn = document.getElementById('resetAfterFlashBtn');
        if (resetAfterFlashBtn) {
            resetAfterFlashBtn.addEventListener('click', () => {
                // 关闭模态框
                const successModal = bootstrap.Modal.getInstance(document.getElementById('successModal'));
                if (successModal) {
                    successModal.hide();
                }
                // 执行重置
                this.resetDevice();
            });
        }

        // Chip type events
        document.querySelectorAll('input[name="chipType"]').forEach(radio => {
            radio.addEventListener('change', () => this.handleChipTypeChange());
        });

        // DIY mode specific events - use event delegation since elements might not exist initially
        document.addEventListener('click', (e) => {
            if (e.target.id === 'removeFileBtn') {
                this.removeCurrentFile();
            }
            
            // 允许点击文件信息区域重新选择文件
            if (e.target.closest('#fileInfoSection') && !e.target.closest('#removeFileBtn')) {
                this.firmwareFileInput.click();
            }
        });

        document.addEventListener('input', (e) => {
            if (e.target.id === 'flashAddressInput') {
                this.updateFlashAddress(e.target.value);
            }
        });
    }

    checkBrowserSupport() {
        // 检查是否为不支持的浏览器
        if (this.isWebUSBSerialSupported()) {
            this.addConsoleMessage('检测到不支持的浏览器 (Safari/Firefox)', 'warning');
            const modal = new bootstrap.Modal(document.getElementById('browserSupportModal'));
            modal.show();
            return false;
        }
        
        // 检查 WebSerial 支持（优先）
        if ('serial' in navigator) {
            this.addConsoleMessage('浏览器支持 WebSerial API', 'success');
            return true;
        }
        
        // 检查 WebUSB 支持
        if ('usb' in navigator) {
            this.addConsoleMessage('浏览器支持 WebUSB API', 'success');
            return true;
        }
        
        // 都不支持则显示警告
        this.addConsoleMessage('浏览器不支持 WebSerial/WebUSB API', 'error');
        const modal = new bootstrap.Modal(document.getElementById('browserSupportModal'));
        modal.show();
        return false;
    }

    initializeConsole() {
        this.addConsoleMessage('ESP Launchpad 控制台已就绪', 'info');
        this.addConsoleMessage('请连接您的 ESP 设备到 USB 串口', 'info');
        
        // 调试控制台元素状态
        if (this.consoleOutput) {
            console.log('控制台元素状态:');
            console.log('- 元素存在:', !!this.consoleOutput);
            console.log('- 滚动高度:', this.consoleOutput.scrollHeight);
            console.log('- 客户端高度:', this.consoleOutput.clientHeight);
            console.log('- 当前滚动位置:', this.consoleOutput.scrollTop);
            console.log('- 溢出样式:', window.getComputedStyle(this.consoleOutput).overflowY);
        }
    }

    async loadConfiguration() {
        // Load default configuration
        this.addConsoleMessage('加载配置中...', 'info');
        
        // 尝试从外部源加载应用配置
        await this.loadApplicationsConfig();
        
        // 初始化应用列表信息
        this.initializeApplications();
        
        this.updateFlashButtonState();
    }

    async loadApplicationsConfig() {
        try {
            // 可以从配置文件或API加载应用列表
            // 这里演示如何支持外部配置
            const configUrl = './config/applications.json';
            
            // 尝试获取外部配置（如果文件不存在，使用默认配置）
            try {
                const response = await fetch(configUrl);
                if (response.ok) {
                    const externalConfig = await response.json();
                    if (externalConfig.applications && Array.isArray(externalConfig.applications)) {
                        this.availableApplications = externalConfig.applications;
                        this.addConsoleMessage('已从外部配置文件加载应用列表', 'info');
                        return;
                    }
                }
            } catch (fetchError) {
                console.log('外部配置文件不存在，使用默认配置:', fetchError.message);
            }
            
            // 使用默认配置（已在构造函数中定义）
            this.addConsoleMessage('使用默认应用配置', 'info');
            
        } catch (error) {
            console.error('加载应用配置时出错:', error);
            this.addConsoleMessage('应用配置加载失败，使用默认配置', 'warning');
        }
    }

    initializeApplications() {
        // 动态生成应用选项
        if (this.applicationSelect) {
            // 清空现有选项（除了默认的占位符选项）
            this.applicationSelect.innerHTML = '<option value="">请选择应用...</option>';
            
            // 添加所有应用选项
            this.availableApplications.forEach(app => {
                const option = document.createElement('option');
                option.value = app.value;
                option.textContent = app.name;
                option.dataset.url = app.url;
                option.dataset.address = app.flashAddress;
                option.dataset.version = app.version || '';
                option.dataset.type = app.type || '';
                if (app.description) {
                    option.title = app.description; // 添加鼠标悬停提示
                }
                this.applicationSelect.appendChild(option);
            });
            
            this.addConsoleMessage(`已加载 ${this.availableApplications.length} 个可用应用`, 'info');
        } else {
            console.error('applicationSelect 元素未找到');
            this.addConsoleMessage('应用选择器初始化失败', 'error');
        }
    }

    // 添加新应用到列表
    addApplication(appConfig) {
        // 验证应用配置
        const requiredFields = ['name', 'url', 'flashAddress', 'value'];
        for (const field of requiredFields) {
            if (!appConfig[field]) {
                throw new Error(`应用配置缺少必需字段: ${field}`);
            }
        }

        // 检查是否已存在相同的应用
        const existingApp = this.availableApplications.find(app => app.value === appConfig.value);
        if (existingApp) {
            throw new Error(`应用 "${appConfig.value}" 已存在`);
        }

        // 添加到应用列表
        this.availableApplications.push(appConfig);
        
        // 刷新UI
        this.initializeApplications();
        
        this.addConsoleMessage(`已添加新应用: ${appConfig.name}`, 'success');
    }

    // 移除应用
    removeApplication(appValue) {
        const index = this.availableApplications.findIndex(app => app.value === appValue);
        if (index === -1) {
            throw new Error(`应用 "${appValue}" 不存在`);
        }

        const removedApp = this.availableApplications.splice(index, 1)[0];
        
        // 刷新UI
        this.initializeApplications();
        
        this.addConsoleMessage(`已移除应用: ${removedApp.name}`, 'info');
    }

    // 获取应用信息
    getApplicationInfo(appValue) {
        return this.availableApplications.find(app => app.value === appValue);
    }

    // 核心功能：固件模式切换
    toggleFirmwareMode() {
        console.log('toggleFirmwareMode called'); // 调试信息
        
        const isQuickStart = this.quickStartMode.checked;
        console.log('isQuickStart:', isQuickStart); // 调试信息
        
        if (isQuickStart) {
            this.quickStartPanel.style.display = 'block';
            this.diyPanel.style.display = 'none';
            this.addConsoleMessage('切换到快速开始模式', 'info');
        } else {
            this.quickStartPanel.style.display = 'none';
            this.diyPanel.style.display = 'block';
            if (this.quickAddSection) {
                this.quickAddSection.style.display = 'block';
            }
            this.addConsoleMessage('切换到自定义模式', 'info');
        }

        this.updateFlashButtonState();
    }

    handleFileSelection(event) {
        const files = Array.from(event.target.files);
        if (files.length > 0) {
            this.setSingleFile(files[0]);
        }
        // 清除文件输入框的值，防止重复选择同一文件时不触发change事件
        event.target.value = '';
    }

    handleUploadAreaClick(event) {
        // 避免重复触发文件选择
        if (event.target === this.firmwareFileInput) {
            return;
        }
        
        // 如果点击的是按钮或input元素，不触发文件选择
        if (event.target.closest('button') || 
            event.target.closest('input') ||
            event.target.closest('#removeFileBtn')) {
            return;
        }
        
        // 阻止事件冒泡，防止重复触发
        event.preventDefault();
        event.stopPropagation();
        
        // 如果有文件且点击的是文件信息区域，允许重新选择
        if (this.selectedFiles.length > 0 && event.target.closest('#fileInfoSection')) {
            this.firmwareFileInput.click();
            return;
        }
        
        // 只有在点击上传区域本身时才触发文件选择
        if (event.target === this.fileUploadArea || 
            event.target.closest('.upload-content') ||
            event.target.closest('.file-upload-area')) {
            this.firmwareFileInput.click();
        }
    }

    handleDragOver(event) {
        event.preventDefault();
        this.fileUploadArea.classList.add('dragover');
    }

    handleDragLeave(event) {
        // 只有当鼠标真正离开上传区域时才移除样式
        if (!this.fileUploadArea.contains(event.relatedTarget)) {
            this.fileUploadArea.classList.remove('dragover');
        }
    }

    handleFileDrop(event) {
        event.preventDefault();
        this.fileUploadArea.classList.remove('dragover');
        const files = Array.from(event.dataTransfer.files);
        if (files.length > 0) {
            this.setSingleFile(files[0]);
        }
    }

    setSingleFile(file) {
        if (!file.name.endsWith('.bin')) {
            this.addConsoleMessage('请选择 .bin 格式的固件文件', 'error');
            return;
        }

        // 清空之前的文件
        this.selectedFiles = [];
        
        // 添加新文件
        this.selectedFiles.push({
            file: file,
            name: file.name,
            size: file.size,
            address: '100000' // 默认应用程序地址，使用字符串格式
        });

        this.updateSingleFileDisplay();
        this.addConsoleMessage(`已选择文件: ${file.name} (${this.formatFileSize(file.size)})`, 'success');
        
        // 更新Flash按钮状态
        this.updateFlashButtonState();
    }

    updateSingleFileDisplay() {
        const fileInfoSection = document.getElementById('fileInfoSection');
        const flashAddressSection = document.getElementById('flashAddressSection');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');
        const uploadContent = this.fileUploadArea.querySelector('.upload-content');
        
        if (this.selectedFiles.length > 0) {
            const file = this.selectedFiles[0];
            fileName.textContent = file.name;
            fileSize.textContent = this.formatFileSize(file.size);
            fileInfoSection.style.display = 'block';
            flashAddressSection.style.display = 'block';
            
            // 更新上传区域状态
            this.fileUploadArea.classList.add('has-files');
            if (uploadContent) {
                uploadContent.innerHTML = `
                    <i class="fas fa-check-circle upload-icon-sm text-success"></i>
                    <p class="upload-text-sm mb-1">文件已选择</p>
                    <small class="text-muted">点击文件信息区域可重新选择</small>
                `;
            }
            
            // 更新Flash地址输入框
            const flashAddressInput = document.getElementById('flashAddressInput');
            if (flashAddressInput) {
                flashAddressInput.value = file.address; // 直接使用字符串地址
            }
        } else {
            fileInfoSection.style.display = 'none';
            flashAddressSection.style.display = 'none';
            
            // 恢复上传区域原始状态
            this.fileUploadArea.classList.remove('has-files');
            if (uploadContent) {
                uploadContent.innerHTML = `
                    <i class="fas fa-cloud-upload-alt upload-icon-sm"></i>
                    <p class="upload-text-sm mb-1">拖拽文件或点击选择</p>
                    <small class="text-muted">选择单个 .bin 文件</small>
                `;
            }
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    removeCurrentFile() {
        this.selectedFiles = [];
        this.updateSingleFileDisplay();
        
        // 重置文件输入
        const fileInput = document.getElementById('firmwareFileInput');
        if (fileInput) {
            fileInput.value = '';
        }
        
        this.addConsoleMessage('已移除文件', 'info');
        this.updateFlashButtonState();
    }

    updateFlashAddress(addressStr) {
        if (this.selectedFiles.length > 0) {
            // 移除 0x 前缀（如果存在）并验证格式
            const cleanAddress = addressStr.replace(/^0x/i, '');
            
            if (/^[0-9a-fA-F]+$/.test(cleanAddress) && cleanAddress.length > 0) {
                this.selectedFiles[0].address = cleanAddress; // 保存为字符串格式
                const addressNum = parseInt(cleanAddress, 16);
                this.addConsoleMessage(`Flash地址已更新: 0x${addressNum.toString(16).toUpperCase()}`, 'info');
                this.updateFlashButtonState(); // 更新按钮状态
            } else {
                this.addConsoleMessage('地址格式无效，请输入有效的十六进制地址', 'error');
            }
        }
    }

    getDefaultAddress(filename) {
        const name = filename.toLowerCase();
        if (name.includes('bootloader')) return '0';
        if (name.includes('partition')) return '8000';
        if (name.includes('app') || name.includes('application')) return '10000';
        return '10000'; // Default application address
    }

    updateFilesList() {
        if (!this.firmwareFilesList) return;
        
        if (this.selectedFiles.length === 0) {
            this.firmwareFilesList.innerHTML = `
                <div class="empty-files-state">
                    <i class="fas fa-file-upload"></i>
                    <p class="mb-2">还没有上传文件</p>
                    <small class="text-muted">上传 .bin 文件开始配置烧录地址</small>
                </div>
            `;
            this.clearFilesBtn.style.display = 'none';
            this.validateFilesBtn.style.display = 'none';
            return;
        }

        this.clearFilesBtn.style.display = 'inline-block';
        this.validateFilesBtn.style.display = 'inline-block';

        this.firmwareFilesList.innerHTML = this.selectedFiles.map((fileInfo, index) => {
            const isValid = this.validateAddress(fileInfo.address);
            const sizeText = this.formatFileSize(fileInfo.size);
            
            return `
                <div class="firmware-file-item ${isValid ? 'valid' : 'invalid'}" data-index="${index}">
                    <div class="file-info">
                        <i class="fas fa-microchip file-icon"></i>
                        <div class="file-details">
                            <h6>${fileInfo.name}</h6>
                            <small>固件文件</small>
                            <span class="file-size-info">${sizeText}</span>
                        </div>
                    </div>
                    <div class="address-group">
                        <span class="address-label">Flash 地址</span>
                        <div class="address-input-container">
                            <span class="address-prefix">0x</span>
                            <input type="text" class="form-control address-input has-prefix ${isValid ? '' : 'is-invalid'}" 
                                   value="${fileInfo.address}" 
                                   onchange="modernLaunchpad.updateFileAddress(${index}, this.value)">
                        </div>
                    </div>
                    <div class="file-actions">
                        <i class="fas ${isValid ? 'fa-check-circle' : 'fa-exclamation-triangle'} file-validation-icon ${isValid ? 'valid' : 'invalid'}" 
                           title="${isValid ? '地址有效' : '地址无效'}"></i>
                        <button class="btn btn-outline-danger btn-sm" onclick="modernLaunchpad.removeFile(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateFileUploadArea() {
        if (!this.fileUploadArea) return;
        
        if (this.selectedFiles.length > 0) {
            this.fileUploadArea.classList.add('has-files');
            this.fileUploadArea.innerHTML = `
                <div class="upload-content">
                    <i class="fas fa-check-circle upload-icon text-success"></i>
                    <p class="upload-text">已选择 ${this.selectedFiles.length} 个文件</p>
                    <small class="text-muted">点击添加更多文件或拖拽文件到此处</small>
                </div>
                <input type="file" class="file-input" id="firmwareFileInput" accept=".bin" multiple>
            `;
            
            // Re-bind the new file input
            const newInput = this.fileUploadArea.querySelector('#firmwareFileInput');
            newInput.addEventListener('change', (e) => this.handleFileSelection(e));
        } else {
            this.fileUploadArea.classList.remove('has-files');
            this.fileUploadArea.innerHTML = `
                <div class="upload-content">
                    <i class="fas fa-cloud-upload-alt upload-icon"></i>
                    <p class="upload-text">拖拽文件到此处或点击选择</p>
                    <small class="text-muted">可同时选择多个 .bin 文件，系统将智能分配Flash地址</small>
                </div>
                <input type="file" class="file-input" id="firmwareFileInput" accept=".bin" multiple>
            `;
            
            // Re-bind the new file input
            const newInput = this.fileUploadArea.querySelector('#firmwareFileInput');
            newInput.addEventListener('change', (e) => this.handleFileSelection(e));
        }
    }

    validateAddress(address) {
        if (!address || address.trim() === '') return false;
        const cleanAddr = address.replace(/^0x/i, '');
        return /^[0-9a-fA-F]+$/.test(cleanAddr) && cleanAddr.length > 0;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    updateFileAddress(index, newAddress) {
        if (this.selectedFiles[index]) {
            this.selectedFiles[index].address = newAddress;
            this.updateFilesList();
            this.updateFlashButtonState();
        }
    }

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.updateFilesList();
        this.updateFileUploadArea();
        this.updateFlashButtonState();
        this.addConsoleMessage('已移除文件', 'info');
    }

    clearAllFiles() {
        this.selectedFiles = [];
        this.updateFilesList();
        this.updateFileUploadArea();
        this.updateFlashButtonState();
        this.addConsoleMessage('已清空所有文件', 'info');
    }

    validateAllFiles() {
        let validCount = 0;
        let invalidCount = 0;
        
        this.selectedFiles.forEach(fileInfo => {
            if (this.validateAddress(fileInfo.address)) {
                validCount++;
            } else {
                invalidCount++;
            }
        });
        
        this.addConsoleMessage(`文件验证完成: ${validCount} 个有效, ${invalidCount} 个无效`, 
                              invalidCount === 0 ? 'success' : 'warning');
        
        this.updateFlashButtonState();
    }

    updateFlashButtonState() {
        if (!this.flashButton) return;
        
        const isQuickStart = this.quickStartMode && this.quickStartMode.checked;
        
        if (isQuickStart) {
            // Quick start mode
            const hasApp = this.applicationSelect && this.applicationSelect.value;
            const isConnected = this.isConnected;
            
            this.flashButton.disabled = !hasApp || !isConnected;
            
            if (!isConnected) {
                this.flashButtonText.textContent = '请先连接设备';
                this.flashButton.className = 'btn btn-secondary btn-lg flash-button';
            } else if (!hasApp) {
                this.flashButtonText.textContent = '请选择应用';
                this.flashButton.className = 'btn btn-warning btn-lg flash-button';
            } else {
                this.flashButtonText.textContent = '开始烧录';
                this.flashButton.className = 'btn btn-primary btn-lg flash-button';
            }
        } else {
            // DIY mode
            const hasFiles = this.selectedFiles.length > 0;
            const allValid = this.selectedFiles.every(file => this.validateAddress(file.address));
            const isConnected = this.isConnected;
            
            // 添加调试信息
            console.log('DIY模式按钮状态检查:', {
                hasFiles,
                allValid,
                isConnected,
                filesCount: this.selectedFiles.length,
                addresses: this.selectedFiles.map(f => f.address)
            });
            
            this.flashButton.disabled = !hasFiles || !allValid || !isConnected;
            
            if (!isConnected) {
                this.flashButtonText.textContent = '请先连接设备';
                this.flashButton.className = 'btn btn-secondary btn-lg flash-button';
            } else if (!hasFiles) {
                this.flashButtonText.textContent = '请添加固件文件';
                this.flashButton.className = 'btn btn-warning btn-lg flash-button';
            } else if (!allValid) {
                this.flashButtonText.textContent = '修复地址错误后烧录';
                this.flashButton.className = 'btn btn-warning btn-lg flash-button';
            } else {
                this.flashButtonText.textContent = '开始烧录';
                this.flashButton.className = 'btn btn-primary btn-lg flash-button';
            }
        }
    }

    // Quick add functions
    addQuickFile(type) {
        const addresses = {
            'bootloader': '0',
            'partition': '8000',
            'application': '10000'
        };
        
        const names = {
            'bootloader': 'bootloader.bin',
            'partition': 'partition-table.bin',
            'application': 'app.bin'
        };
        
        // Create a placeholder file entry
        this.selectedFiles.push({
            file: null,
            name: names[type] || 'firmware.bin',
            size: 0,
            address: addresses[type] || '10000',
            isPlaceholder: true
        });
        
        this.updateFilesList();
        this.updateFileUploadArea();
        this.addConsoleMessage(`已添加 ${names[type]} 槽位，请上传对应文件`, 'info');
    }

    // 真正的设备连接功能
    async toggleConnection() {
        if (this.isConnected) {
            await this.disconnect();
        } else {
            await this.connect();
        }
    }

    async connect() {
        const maxRetries = 2; // 最多重试2次
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                this.addConsoleMessage(`正在连接设备... (尝试 ${attempt}/${maxRetries})`, 'info');
                
                if (!this.ESPLoader) {
                    throw new Error('ESP库未加载，无法连接设备');
                }

                // 尝试 WebSerial 连接
                if ('serial' in navigator) {
                    this.addConsoleMessage('使用 WebSerial API 连接...', 'info');
                    if (!this.device) { // 只在第一次尝试时请求设备
                        this.device = await navigator.serial.requestPort({
                            filters: this.usbPortFilters
                        });
                    }
                    this.transport = new this.Transport(this.device, true);
                }
                // 备选 WebUSB 连接
                else if ('usb' in navigator) {
                    this.addConsoleMessage('使用 WebUSB API 连接...', 'info');
                    if (!this.device) { // 只在第一次尝试时请求设备
                        this.device = await navigator.usb.requestDevice({
                            filters: this.usbPortFilters.map(filter => ({
                                vendorId: filter.usbVendorId,
                                productId: filter.usbProductId
                            }))
                        });
                    }
                    this.transport = new this.Transport(this.device, false);
                } else {
                    throw new Error('浏览器不支持设备连接');
                }

                await this.performConnection();
                return; // 连接成功，退出重试循环
                
            } catch (error) {
                lastError = error;
                console.warn(`连接尝试 ${attempt} 失败:`, error);
                
                if (error.name === 'NotFoundError') {
                    // 用户取消选择设备，不重试
                    throw error;
                }
                
                if (attempt < maxRetries) {
                    this.addConsoleMessage(`连接失败，${2}秒后重试...`, 'warning');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // 清理之前的连接尝试
                    if (this.transport) {
                        try {
                            await this.transport.disconnect();
                        } catch (e) {
                            console.warn('清理传输连接时出错:', e);
                        }
                        this.transport = null;
                    }
                } else {
                    // 所有尝试都失败了
                    throw lastError;
                }
            }
        }
    }
    
    async performConnection() {
        try {
            this.addConsoleMessage('创建 ESP 加载器...', 'info');
            
            // 验证波特率设置
            const flashBaudrate = parseInt(this.flashBaudrateSelect?.value || '460800');
            this.addConsoleMessage(`使用波特率: ${flashBaudrate}`, 'info');
            
            this.esploader = new this.ESPLoader({
                transport: this.transport,
                baudrate: flashBaudrate,
                romBaudrate: 115200,
                enableTracing: false
            });

            this.addConsoleMessage('正在连接并检测芯片...', 'info');
            
            // 执行连接和芯片检测
            await this.esploader.main();
            
            // 验证连接状态
            if (!this.esploader.chip) {
                throw new Error('芯片检测失败 - 未检测到有效的ESP芯片');
            }
            
            this.addConsoleMessage(`芯片类型: ${this.esploader.chip.constructor.name}`, 'info');
            
            // 获取芯片信息 - 添加错误处理
            try {
                this.chip = await this.esploader.chip.getChipDescription();
                this.addConsoleMessage(`检测到芯片: ${this.chip}`, 'success');
            } catch (e) {
                console.warn('无法获取芯片描述:', e);
                this.chip = this.esploader.chip.CHIP_NAME || 'ESP32'; // 使用备用名称
                this.addConsoleMessage(`使用默认芯片名称: ${this.chip}`, 'warning');
            }
            
            try {
                this.chipDesc = await this.esploader.chip.getChipFeatures();
                this.addConsoleMessage(`芯片特性: ${this.chipDesc}`, 'info');
            } catch (e) {
                console.warn('无法获取芯片特性:', e);
                this.chipDesc = '未知特性';
                this.addConsoleMessage('无法获取芯片特性', 'warning');
            }
            
            this.isConnected = true;
            this.updateConnectionStatus();
            this.addConsoleMessage(`设备连接成功: ${this.chip}`, 'success');
            
            // 获取 MAC 地址
            try {
                // 检查芯片是否支持 MAC 地址读取
                if (this.esploader.chip && typeof this.esploader.chip.readMac === 'function') {
                    const macAddr = await this.esploader.chip.readMac();
                    if (macAddr && Array.isArray(macAddr) && macAddr.length >= 6) {
                        const macStr = macAddr.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
                        this.addConsoleMessage(`MAC 地址: ${macStr}`, 'info');
                        if (this.macAddressMini) {
                            this.macAddressMini.textContent = macStr.substring(0, 8) + '...';
                        }
                    } else {
                        this.addConsoleMessage('MAC 地址格式无效', 'warning');
                    }
                } else {
                    this.addConsoleMessage('此芯片不支持 MAC 地址读取', 'info');
                }
            } catch (e) {
                console.warn('读取 MAC 地址时出错:', e);
                //this.addConsoleMessage(`无法读取 MAC 地址: ${e.message}`, 'warning');
                if (this.macAddressMini) {
                    this.macAddressMini.textContent = '未知';
                }
            }
            
        } catch (error) {
            this.addConsoleMessage(`连接失败: ${error.message}`, 'error');
            console.error('Connection error:', error);
            this.isConnected = false;
            this.updateConnectionStatus();
            
            throw error; // 重新抛出错误供重试机制处理
        }
    }

    async disconnect() {
        try {
            this.addConsoleMessage('正在断开连接...', 'info');
            
            // 尝试重置设备（可选，如果失败也继续断开连接）
            if (this.esploader && typeof this.esploader.hardReset === 'function') {
                try {
                    await this.esploader.hardReset();
                    this.addConsoleMessage('设备已重置', 'info');
                } catch (resetError) {
                    console.warn('重置设备时出错（将继续断开连接）:', resetError);
                    this.addConsoleMessage('设备重置失败，但将继续断开连接', 'warning');
                }
            }
            
            // 清理 esploader
            if (this.esploader) {
                this.esploader = null;
            }
            
            // 断开传输连接
            if (this.transport && typeof this.transport.disconnect === 'function') {
                try {
                    await this.transport.disconnect();
                    this.addConsoleMessage('传输连接已断开', 'info');
                } catch (transportError) {
                    console.warn('断开传输连接时出错:', transportError);
                    this.addConsoleMessage('传输连接断开时出现警告', 'warning');
                }
            }
            
            // 清理所有连接相关的引用
            this.transport = null;
            this.device = null;
            this.isConnected = false;
            
            // 更新UI状态
            this.updateConnectionStatus();
            this.addConsoleMessage('设备已断开连接', 'success');
            
        } catch (error) {
            // 即使出现错误，也要确保状态正确更新
            console.error('Disconnect error:', error);
            this.addConsoleMessage(`断开连接时出错: ${error.message}`, 'error');
            
            // 强制清理所有状态
            this.esploader = null;
            this.transport = null;
            this.device = null;
            this.isConnected = false;
            this.updateConnectionStatus();
            this.addConsoleMessage('已强制断开连接', 'warning');
        }
    }

    updateConnectionStatus() {
        const statusDot = this.statusIndicator.querySelector('.status-dot');
        
        if (this.isConnected) {
            // 已连接状态
            statusDot.className = 'fas fa-circle status-dot connected';
            this.statusText.textContent = '已连接';
            this.connectToggleBtn.innerHTML = '<i class="fas fa-unlink me-1"></i><span>断开连接</span>';
            this.connectToggleBtn.className = 'btn btn-outline-danger btn-sm ms-2';
            
            // 显示设备信息
            this.deviceInfoMini.classList.remove('d-none');
            this.chipInfoMini.textContent = this.chip || 'ESP32';
            
            // 启用重置按钮
            this.resetDeviceBtn.disabled = false;
            
            // 更新状态提示
            this.alertMessage.textContent = `设备已连接 - ${this.chip}，您可以选择固件进行烧录。`;
            this.statusAlert.className = 'alert alert-success alert-dismissible fade show modern-alert';
            this.statusAlert.querySelector('i').className = 'fas fa-check-circle me-2';
            
        } else {
            // 未连接状态
            statusDot.className = 'fas fa-circle status-dot';
            this.statusText.textContent = '未连接';
            this.connectToggleBtn.innerHTML = '<i class="fas fa-plug me-1"></i><span>连接设备</span>';
            this.connectToggleBtn.className = 'btn btn-outline-primary btn-sm ms-2';
            
            // 隐藏设备信息
            this.deviceInfoMini.classList.add('d-none');
            
            // 禁用重置按钮
            this.resetDeviceBtn.disabled = true;
            
            // 更新状态提示
            this.alertMessage.textContent = '请连接您的 ESP 设备到 USB 串口，然后点击"连接设备"按钮开始使用。';
            this.statusAlert.className = 'alert alert-info alert-dismissible fade show modern-alert';
            this.statusAlert.querySelector('i').className = 'fas fa-info-circle me-2';
        }
        
        this.updateFlashButtonState();
    }

    handleApplicationChange() {
        const selectedOption = this.applicationSelect.selectedOptions[0];
        const appInfoSection = document.getElementById('appInfoSection');
        const appName = document.getElementById('appName');
        const appAddress = document.getElementById('appAddress');
        
        if (selectedOption && selectedOption.value) {
            const name = selectedOption.textContent;
            const url = selectedOption.dataset.url;
            const address = selectedOption.dataset.address;
            
            // 显示应用信息
            if (appInfoSection && appName && appAddress) {
                appName.textContent = name;
                appAddress.textContent = address;
                appInfoSection.style.display = 'block';
            }
            
            this.addConsoleMessage(`已选择应用: ${name}`, 'info');
            this.addConsoleMessage(`Flash地址: ${address}`, 'info');
            this.addConsoleMessage(`固件URL: ${url}`, 'info');
        } else {
            // 隐藏应用信息
            if (appInfoSection) {
                appInfoSection.style.display = 'none';
            }
        }
        
        this.updateFlashButtonState();
    }

    handleChipTypeChange() {
        this.addConsoleMessage('芯片类型选择功能开发中...', 'info');
    }

    // 真正的烧录功能
    async startFlashing() {
        // 隐藏连接提示卡片，显示进度卡片
        if (this.statusAlert) this.statusAlert.style.display = 'none';
        if (this.progressCard) {
            this.progressCard.style.display = 'block';
            this.progressCard.classList.remove('d-none');
        }
        if (!this.isConnected || this.isFlashing) {
            this.addConsoleMessage(`烧录被阻止: 连接状态=${this.isConnected}, 烧录状态=${this.isFlashing}`, 'warning');
            return;
        }

        try {
            this.isFlashing = true;
            
            // 显示进度卡片
            if (this.progressCard) {
                this.progressCard.style.display = 'block';
                this.progressCard.classList.remove('d-none');
                console.log('进度卡片已显示');
            } else {
                console.error('progressCard 元素未找到');
            }
            
            this.flashButton.disabled = true;
            
            // 强制刷新控制台滚动
            this.forceConsoleRefresh();
            
            this.addConsoleMessage('开始烧录固件...', 'info');
            this.updateProgress('准备烧录...', 0);

            const isQuickStart = this.quickStartMode.checked;
            console.log('烧录模式:', isQuickStart ? 'QuickStart' : 'DIY');
            if (isQuickStart) {
                await this.flashQuickStartMode();
            } else {
                await this.flashCustomMode();
            }

            this.addConsoleMessage('固件烧录完成！正在重置设备...', 'success');
            this.updateProgress('重置设备中...', 95);
            
            // 烧录完成后自动重置设备，让其退出下载模式
            try {
                if (this.esploader && this.esploader.chip) {
                    if (typeof this.esploader.chip.softReset === 'function') {
                        try {
                            await this.esploader.chip.softReset();
                            await new Promise(resolve => setTimeout(resolve, 100));
                            this.addConsoleMessage('软重置完成', 'info');
                        } catch (softResetError) {
                            console.warn('软重置失败:', softResetError);
                            this.addConsoleMessage('软重置失败，将尝试硬重置', 'warning');
                        }
                    }
                    if (typeof this.esploader.hardReset === 'function') {
                        await this.esploader.hardReset();
                        this.addConsoleMessage('设备已重置，正在启动新固件...', 'success');
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } else {
                        throw new Error('hardReset 方法不可用');
                    }
                } else {
                    this.addConsoleMessage('ESP加载器不可用，跳过自动重置', 'warning');
                }
            } catch (resetError) {
                console.warn('自动重置失败:', resetError);
                this.addConsoleMessage('烧录完成，请断开USB连接', 'warning');
            }
            this.updateProgress('烧录完成', 100);
            
            // 烧录完成后，恢复连接提示卡片，隐藏进度卡片
            //if (this.statusAlert) this.statusAlert.style.display = '';
            //if (this.progressCard) this.progressCard.style.display = 'none';

            // 显示成功模态框
            //this.showSuccessModal();

        } catch (error) {
            this.addConsoleMessage(`烧录失败: ${error.message}`, 'error');
            console.error('Flash error:', error);
            // 烧录失败也恢复连接提示卡片，隐藏进度卡片
            if (this.statusAlert) this.statusAlert.style.display = '';
            if (this.progressCard) this.progressCard.style.display = 'none';
            
            // 显示错误模态框
            //this.showErrorModal(error.message);
        } finally {
            this.isFlashing = false;
            this.flashButton.disabled = false;
            this.updateFlashButtonState();
        }
    }

    async flashCustomMode() {
        if (this.selectedFiles.length === 0) {
            throw new Error('没有选择要烧录的文件');
        }

        // 验证所有文件地址
        for (const fileInfo of this.selectedFiles) {
            if (!this.validateAddress(fileInfo.address)) {
                throw new Error(`文件 ${fileInfo.name} 的地址格式不正确`);
            }
        }

        // 按地址排序文件
        const sortedFiles = [...this.selectedFiles].sort((a, b) => {
            const addrA = parseInt(a.address.replace(/^0x/i, ''), 16);
            const addrB = parseInt(b.address.replace(/^0x/i, ''), 16);
            return addrA - addrB;
        });

        const totalSize = sortedFiles.reduce((sum, file) => sum + (file.file?.size || 0), 0);
        let processedSize = 0;

        // 逐个烧录文件
        for (let i = 0; i < sortedFiles.length; i++) {
            const fileInfo = sortedFiles[i];
            if (!fileInfo.file) continue; // 跳过占位符文件

            const address = parseInt(fileInfo.address.replace(/^0x/i, ''), 16);
            const progressBase = (processedSize / totalSize) * 90; // 预留10%给最后的验证
            
            this.addConsoleMessage(`烧录 ${fileInfo.name} 到地址 0x${address.toString(16)}...`, 'info');
            this.updateProgress(`烧录 ${fileInfo.name}...`, progressBase);

            const fileData = await this.readFileAsBinaryString(fileInfo.file);
            
            // 调试：检查数据格式
            console.log('文件数据类型:', typeof fileData, '长度:', fileData.length);
            console.log('数据前10字符:', fileData.substring(0, 10).split('').map(c => c.charCodeAt(0).toString(16)).join(' '));
            
            this.addConsoleMessage(`开始写入 ${fileInfo.name} (${this.formatFileSize(fileInfo.file.size)})...`, 'info');
            
            let lastProgressReport = 0; // 用于控制进度报告频率
            
            await this.esploader.writeFlash({
                fileArray: [{
                    data: fileData,
                    address: address
                }],
                flashSize: 'keep',
                eraseAll: false,
                compress: this.compressCheckbox ? this.compressCheckbox.checked : true, // 默认启用压缩
                reportProgress: (fileIndex, written, total) => {
                    const fileProgress = (written / total) * (fileInfo.file.size / totalSize) * 90;
                    const currentProgress = progressBase + fileProgress;
                    const progressPercent = Math.round((written/total)*100);
                    
                    // 添加调试信息（减少频率）
                    if (progressPercent % 10 === 0 && progressPercent !== lastProgressReport) {
                        console.log(`烧录进度: ${written}/${total} bytes, 当前进度: ${currentProgress.toFixed(1)}%`);
                        this.addConsoleMessage(`写入进度: ${this.formatFileSize(written)}/${this.formatFileSize(total)} (${progressPercent}%)`, 'info');
                        lastProgressReport = progressPercent;
                    }
                    
                    this.updateProgress(`烧录 ${fileInfo.name}... (${progressPercent}%)`, currentProgress);
                }
            });

            processedSize += fileInfo.file.size;
            this.addConsoleMessage(`✓ ${fileInfo.name} 烧录完成`, 'success');
        }

        this.addConsoleMessage('所有文件烧录完成', 'success');
        // 移除验证延迟，直接返回让上层处理重置
    }

    async flashQuickStartMode() {
        const selectedOption = this.applicationSelect.selectedOptions[0];
        if (!selectedOption || !selectedOption.value) {
            throw new Error('请选择要烧录的应用');
        }

        const appName = selectedOption.textContent;
        const appUrl = selectedOption.dataset.url;
        const appAddress = selectedOption.dataset.address;
        
        if (!appUrl || !appAddress) {
            throw new Error('应用配置信息不完整');
        }

        this.addConsoleMessage(`开始烧录应用: ${appName}`, 'info');
        this.addConsoleMessage(`从远程下载固件: ${appUrl}`, 'info');
        
        // 下载远程固件文件
        this.updateProgress('正在下载固件...', 10);
        const firmwareData = await this.downloadRemoteFirmware(appUrl);
        
        this.updateProgress('固件下载完成，开始烧录...', 30);
        
        // 解析Flash地址
        const address = parseInt(appAddress.replace(/^0x/i, ''), 16);
        this.addConsoleMessage(`烧录到地址: ${appAddress} (${address})`, 'info');
        
        // 执行烧录
        await this.esploader.writeFlash({
            fileArray: [{
                data: firmwareData,
                address: address
            }],
            flashSize: 'keep',
            eraseAll: false,
            compress: this.compressCheckbox ? this.compressCheckbox.checked : true,
            reportProgress: (fileIndex, written, total) => {
                const progress = 30 + (written / total) * 60; // 30% - 90%
                const progressPercent = Math.round((written/total)*100);
                this.updateProgress(`烧录中... (${progressPercent}%)`, progress);
                
                // 每10%报告一次进度
                if (progressPercent % 10 === 0) {
                    this.addConsoleMessage(`烧录进度: ${this.formatFileSize(written)}/${this.formatFileSize(total)} (${progressPercent}%)`, 'info');
                }
            }
        });
        
        this.addConsoleMessage(`✓ ${appName} 烧录完成`, 'success');
    }

    async downloadRemoteFirmware(url) {
        try {
            this.addConsoleMessage('开始下载远程固件...', 'info');
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`下载失败: ${response.status} ${response.statusText}`);
            }
            
            // 获取文件大小（如果服务器提供）
            const contentLength = response.headers.get('content-length');
            const totalSize = contentLength ? parseInt(contentLength) : 0;
            
            if (totalSize > 0) {
                this.addConsoleMessage(`固件大小: ${this.formatFileSize(totalSize)}`, 'info');
            }
            
            // 使用流式下载以支持进度显示
            const reader = response.body.getReader();
            const chunks = [];
            let receivedLength = 0;
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                chunks.push(value);
                receivedLength += value.length;
                
                // 更新下载进度
                if (totalSize > 0) {
                    const progress = 10 + (receivedLength / totalSize) * 20; // 10% - 30%
                    const percent = Math.round((receivedLength / totalSize) * 100);
                    this.updateProgress(`下载固件... (${percent}%)`, progress);
                    
                    // 每25%报告一次
                    if (percent % 25 === 0) {
                        this.addConsoleMessage(`下载进度: ${this.formatFileSize(receivedLength)}/${this.formatFileSize(totalSize)} (${percent}%)`, 'info');
                    }
                } else {
                    // 如果不知道总大小，只显示已下载的大小
                    this.updateProgress(`下载固件... (${this.formatFileSize(receivedLength)})`, 15);
                }
            }
            
            // 合并所有chunks
            const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const uint8Array = new Uint8Array(totalLength);
            let position = 0;
            
            for (const chunk of chunks) {
                uint8Array.set(chunk, position);
                position += chunk.length;
            }
            
            // 转换为二进制字符串（ESP库需要的格式）
            let binaryString = '';
            for (let i = 0; i < uint8Array.length; i++) {
                binaryString += String.fromCharCode(uint8Array[i]);
            }
            
            this.addConsoleMessage(`固件下载完成，大小: ${this.formatFileSize(binaryString.length)}`, 'success');
            
            // 调试信息
            console.log('下载的固件数据类型:', typeof binaryString, '长度:', binaryString.length);
            console.log('数据前10字符:', binaryString.substring(0, 10).split('').map(c => c.charCodeAt(0).toString(16)).join(' '));
            
            return binaryString;
            
        } catch (error) {
            this.addConsoleMessage(`固件下载失败: ${error.message}`, 'error');
            throw new Error(`无法下载固件: ${error.message}`);
        }
    }

    async readFileAsBinaryString(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // ESP库期望二进制字符串格式，不是Uint8Array
                resolve(reader.result);
            };
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsBinaryString(file); // 使用 readAsBinaryString 而不是 readAsArrayBuffer
        });
    }

    updateProgress(message, percentage) {
        // 添加调试信息
        console.log(`更新进度: ${message} - ${percentage.toFixed(1)}%`);
        
        if (this.progressLabel) {
            this.progressLabel.textContent = message;
            console.log('进度标签已更新:', message);
        } else {
            console.warn('progressLabel 元素未找到');
        }
        
        if (this.progressPercentage) {
            this.progressPercentage.textContent = `${Math.round(percentage)}%`;
            console.log('进度百分比已更新:', `${Math.round(percentage)}%`);
        } else {
            console.warn('progressPercentage 元素未找到');
        }
        
        if (this.progressBar) {
            this.progressBar.style.width = `${percentage}%`;
            console.log('进度条已更新:', `${percentage}%`);
        } else {
            console.warn('progressBar 元素未找到');
        }
        
        // 更新进度详情
        if (this.progressDetails) {
            this.progressDetails.innerHTML = `<small class="text-muted">${message}</small>`;
            console.log('进度详情已更新:', message);
        } else {
            console.warn('progressDetails 元素未找到');
        }
        
        // 确保控制台滚动到底部
        this.scrollConsoleToBottom();
    }

    async eraseFlash() {
        if (!this.isConnected) {
            this.addConsoleMessage('请先连接设备', 'error');
            return;
        }

        try {
            this.addConsoleMessage('正在擦除闪存...', 'info');
            if (this.eraseFlashBtn) {
                this.eraseFlashBtn.disabled = true;
            }
            
            await this.esploader.eraseFlash();
            this.addConsoleMessage('闪存擦除完成', 'success');
            
        } catch (error) {
            this.addConsoleMessage(`擦除失败: ${error.message}`, 'error');
        } finally {
            if (this.eraseFlashBtn) {
                this.eraseFlashBtn.disabled = false;
            }
        }
    }

    async resetDevice() {
        if (!this.isConnected) {
            this.addConsoleMessage('请先连接设备', 'error');
            return;
        }

        try {
            this.addConsoleMessage('正在重置设备，退出下载模式...', 'info');
            
            // 执行软重置，让设备退出下载模式
            if (this.esploader && this.esploader.chip) {
                // 先尝试软重置（如果支持）
                if (typeof this.esploader.chip.softReset === 'function') {
                    try {
                        await this.esploader.chip.softReset();
                        await new Promise(resolve => setTimeout(resolve, 100));
                        this.addConsoleMessage('软重置完成', 'info');
                    } catch (softResetError) {
                        console.warn('软重置失败:', softResetError);
                        this.addConsoleMessage('软重置失败，将尝试硬重置', 'warning');
                    }
                }
                
                // 然后执行硬重置确保设备完全重启
                if (typeof this.esploader.hardReset === 'function') {
                    await this.esploader.hardReset();
                    this.addConsoleMessage('硬重置完成', 'info');
                } else {
                    throw new Error('hardReset 方法不可用');
                }
                
                this.addConsoleMessage('设备已重置，正在进入正常运行模式...', 'success');
                
                // 给设备一些时间启动
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // 断开连接，因为设备已经退出下载模式
                this.addConsoleMessage('设备已退出下载模式，断开连接...', 'info');
                await this.disconnect();
                
            } else {
                throw new Error('ESP加载器或芯片对象不可用');
            }
            
        } catch (error) {
            this.addConsoleMessage(`重置失败: ${error.message}`, 'error');
            console.error('Reset error:', error);
            
            // 即使重置失败，也尝试断开连接
            try {
                this.addConsoleMessage('尝试强制断开连接...', 'warning');
                await this.disconnect();
            } catch (disconnectError) {
                console.warn('断开连接时出错:', disconnectError);
                this.addConsoleMessage('强制断开连接也失败，请手动重新连接', 'error');
            }
        }
    }

    clearConsole() {
        if (this.consoleOutput) {
            this.consoleOutput.innerHTML = '';
        }
        this.addConsoleMessage('控制台已清空', 'info');
        // 确保滚动到底部
        this.scrollConsoleToBottom();
    }

    // 实用工具函数
    async getImageData(fileURL) {
        return new Promise(resolve => {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', fileURL, true);
            xhr.responseType = "blob";
            xhr.send();
            xhr.onload = function () {
                if (xhr.readyState === 4 && xhr.status === 200) {
                    var blob = new Blob([xhr.response], { type: "application/octet-stream" });
                    var reader = new FileReader();
                    reader.onload = (function (theFile) {
                        return function (e) {
                            resolve(e.target.result);
                        };
                    })(blob);
                    reader.readAsBinaryString(blob);
                } else {
                    resolve(undefined);
                }
            };
            xhr.onerror = function () {
                resolve(undefined);
            }
        });
    }

    // Console methods
    addConsoleMessage(message, type = 'info') {
        if (!this.consoleOutput) {
            console.warn('consoleOutput 元素未找到');
            return;
        }
        
        const timestamp = new Date().toLocaleTimeString();
        const typeClass = type === 'error' ? 'error' : type === 'success' ? 'success' : type === 'warning' ? 'warning' : '';
        
        const messageElement = document.createElement('div');
        messageElement.className = 'console-line';
        messageElement.innerHTML = `
            <span class="console-timestamp">[${timestamp}]</span>
            <span class="console-text ${typeClass}">${message}</span>
        `;
        
        this.consoleOutput.appendChild(messageElement);
        
        // 确保滚动到底部 - 使用 setTimeout 确保DOM更新完成后再滚动
        setTimeout(() => {
            if (this.consoleOutput) {
                this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;
            }
        }, 0);
    }

    // 强制滚动控制台到底部
    scrollConsoleToBottom() {
        if (this.consoleOutput) {
            // 使用 requestAnimationFrame 确保在下一帧执行滚动
            requestAnimationFrame(() => {
                this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;
            });
        }
    }

    // 批量添加控制台消息（用于快速连续的消息）
    addConsoleMessages(messages) {
        if (!Array.isArray(messages) || !this.consoleOutput) return;
        
        const fragment = document.createDocumentFragment();
        
        messages.forEach(({ message, type = 'info' }) => {
            const timestamp = new Date().toLocaleTimeString();
            const typeClass = type === 'error' ? 'error' : type === 'success' ? 'success' : type === 'warning' ? 'warning' : '';
            
            const messageElement = document.createElement('div');
            messageElement.className = 'console-line';
            messageElement.innerHTML = `
                <span class="console-timestamp">[${timestamp}]</span>
                <span class="console-text ${typeClass}">${message}</span>
            `;
            
            fragment.appendChild(messageElement);
        });
        
        this.consoleOutput.appendChild(fragment);
        this.scrollConsoleToBottom();
    }

    // 强制刷新控制台滚动（用于解决滚动卡住的问题）
    forceConsoleRefresh() {
        if (this.consoleOutput) {
            // 强制重新计算滚动高度
            const currentScrollTop = this.consoleOutput.scrollTop;
            this.consoleOutput.style.overflow = 'hidden';
            
            // 强制重绘
            this.consoleOutput.offsetHeight; // 触发重排
            
            this.consoleOutput.style.overflow = 'auto';
            
            // 滚动到底部
            setTimeout(() => {
                this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;
            }, 10);
        }
    }

    // 显示成功模态框
    showSuccessModal(message = '固件烧录已成功完成！') {
        try {
            const successModal = document.getElementById('successModal');
            if (successModal) {
                // 更新模态框内容（如果需要自定义消息）
                const modalBody = successModal.querySelector('.modal-body .success-content p.lead');
                if (modalBody) {
                    modalBody.textContent = message;
                }
                
                const modal = new bootstrap.Modal(successModal);
                modal.show();
                
                // 隐藏进度卡片，恢复状态提示
                if (this.progressCard) this.progressCard.style.display = 'none';
                if (this.statusAlert) this.statusAlert.style.display = '';
                
                this.addConsoleMessage('成功模态框已显示', 'info');
            } else {
                console.error('未找到成功模态框元素');
                this.addConsoleMessage('无法显示成功提示', 'warning');
            }
        } catch (error) {
            console.error('显示成功模态框失败:', error);
            this.addConsoleMessage('显示成功提示失败', 'error');
        }
    }

    // 显示错误模态框
    showErrorModal(errorMessage = '发生未知错误') {
        try {
            const errorModal = document.getElementById('errorModal');
            if (errorModal) {
                // 更新错误消息
                const errorMessageElement = document.getElementById('errorMessage');
                if (errorMessageElement) {
                    errorMessageElement.innerHTML = `
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            ${errorMessage}
                        </div>
                        <p class="text-muted mt-3">请检查：</p>
                        <ul class="text-muted">
                            <li>设备连接是否正常</li>
                            <li>固件文件是否正确</li>
                            <li>Flash地址是否有效</li>
                            <li>设备是否进入下载模式</li>
                        </ul>
                    `;
                }
                
                const modal = new bootstrap.Modal(errorModal);
                modal.show();
                
                this.addConsoleMessage('错误模态框已显示', 'info');
            } else {
                console.error('未找到错误模态框元素');
                this.addConsoleMessage('无法显示错误提示', 'warning');
            }
        } catch (error) {
            console.error('显示错误模态框失败:', error);
            this.addConsoleMessage('显示错误提示失败', 'error');
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.modernLaunchpad = new ModernESPLaunchpad();
});

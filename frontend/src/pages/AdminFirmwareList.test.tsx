/**
 * AdminFirmwareList 组件测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AdminFirmwareList } from './AdminFirmwareList';
import { AdminClient } from '../api/adminClient';
import type { FirmwareMetadata } from '../api/types';

// Mock AdminClient
vi.mock('../api/adminClient', () => ({
  AdminClient: {
    getAllFirmware: vi.fn(),
    togglePublish: vi.fn(),
    deleteFirmware: vi.fn(),
    exportFirmware: vi.fn(),
    importFirmware: vi.fn(),
    checkVersionConflict: vi.fn(),
    getProjectVersions: vi.fn()
  }
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

const mockFirmwares: FirmwareMetadata[] = [
  {
    firmware_id: 'fw-001',
    project_name: 'LED Blink',
    description: 'Simple LED blink example',
    version: '1.0.0',
    supported_board_ids: ['esp32'],
    tags: ['example', 'led'],
    published: true,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    files: [
      { name: 'bootloader.bin', address: 0x1000, size: 16384, role: 'bootloader' },
      { name: 'partitions.bin', address: 0x8000, size: 4096, role: 'partitions' },
      { name: 'boot_app0.bin', address: 0xe000, size: 4096, role: 'boot_app0' },
      { name: 'app.bin', address: 0x10000, size: 524288, role: 'app' }
    ],
    total_size: 548864,
    has_thumbnail: true,
    download_count: 150,
    flash_count: 120,
    flash_success_count: 115,
    flash_failure_count: 5
  },
  {
    firmware_id: 'fw-002',
    project_name: 'WiFi Scanner',
    description: 'WiFi network scanner',
    version: '2.1.0',
    supported_board_ids: ['esp32', 'esp32s3'],
    tags: ['wifi', 'network'],
    published: false,
    created_at: '2024-01-20T14:30:00Z',
    files: [
      { name: 'bootloader.bin', address: 0x1000, size: 16384, role: 'bootloader' },
      { name: 'partitions.bin', address: 0x8000, size: 4096, role: 'partitions' },
      { name: 'boot_app0.bin', address: 0xe000, size: 4096, role: 'boot_app0' },
      { name: 'app.bin', address: 0x10000, size: 786432, role: 'app' }
    ],
    total_size: 811008,
    has_thumbnail: false,
    download_count: 50,
    flash_count: 30,
    flash_success_count: 28,
    flash_failure_count: 2
  }
];

// Helper: switch to flat view and wait for items to appear
async function switchToFlatView() {
  const flatButton = screen.getByText('平铺视图');
  fireEvent.click(flatButton);
}

function mockList(items: FirmwareMetadata[]) {
  return { items, total_count: items.length, page: 1, page_size: 20, total_pages: Math.ceil(items.length / 20) };
}

describe('AdminFirmwareList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该显示加载状态', () => {
    vi.mocked(AdminClient.getAllFirmware).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(
      <BrowserRouter>
        <AdminFirmwareList />
      </BrowserRouter>
    );

    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('应该加载并显示固件列表（分组视图）', async () => {
    vi.mocked(AdminClient.getAllFirmware).mockResolvedValue(mockList(mockFirmwares));

    render(
      <BrowserRouter>
        <AdminFirmwareList />
      </BrowserRouter>
    );

    // 分组视图默认显示项目名称
    await waitFor(() => {
      expect(screen.getByText('LED Blink')).toBeInTheDocument();
      expect(screen.getByText('WiFi Scanner')).toBeInTheDocument();
    });

    // 分组头部显示版本数量和最新版本 (both groups have 1 version)
    const versionCounts = screen.getAllByText(/1 个版本/);
    expect(versionCounts).toHaveLength(2);
  });

  it('应该在平铺视图中显示所有固件详情', async () => {
    vi.mocked(AdminClient.getAllFirmware).mockResolvedValue(mockList(mockFirmwares));

    render(
      <BrowserRouter>
        <AdminFirmwareList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('LED Blink')).toBeInTheDocument();
    });

    // 切换到平铺视图
    await switchToFlatView();

    // 检查版本显示
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    expect(screen.getByText('v2.1.0')).toBeInTheDocument();

    // 检查发布状态
    expect(screen.getByText('已发布')).toBeInTheDocument();
    expect(screen.getByText('草稿')).toBeInTheDocument();

    // 检查统计数据
    expect(screen.getByText('150')).toBeInTheDocument(); // download_count
    expect(screen.getByText('120')).toBeInTheDocument(); // flash_count
  });

  it('应该显示错误状态', async () => {
    const errorMessage = '网络错误';
    vi.mocked(AdminClient.getAllFirmware).mockRejectedValue(new Error(errorMessage));

    render(
      <BrowserRouter>
        <AdminFirmwareList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('应该支持排序功能（平铺视图）', async () => {
    vi.mocked(AdminClient.getAllFirmware).mockResolvedValue(mockList(mockFirmwares));

    render(
      <BrowserRouter>
        <AdminFirmwareList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('LED Blink')).toBeInTheDocument();
    });

    // 切换到平铺视图
    await switchToFlatView();

    // 点击下载次数排序
    const downloadHeader = screen.getByText('下载').closest('div');
    if (downloadHeader) {
      fireEvent.click(downloadHeader);
    }

    // 验证排序后的顺序（通过检查元素在 DOM 中的位置）
    const firmwareNames = screen.getAllByText(/LED Blink|WiFi Scanner/);
    expect(firmwareNames[0]).toHaveTextContent('LED Blink'); // 150 downloads
  });

  it('应该显示删除确认对话框（平铺视图）', async () => {
    vi.mocked(AdminClient.getAllFirmware).mockResolvedValue(mockList(mockFirmwares));

    render(
      <BrowserRouter>
        <AdminFirmwareList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('LED Blink')).toBeInTheDocument();
    });

    // 切换到平铺视图
    await switchToFlatView();

    // 点击删除按钮 (WiFi Scanner is first due to created_at desc sort)
    const deleteButtons = screen.getAllByTitle('删除');
    fireEvent.click(deleteButtons[0]);

    // 验证对话框显示
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '确认删除' })).toBeInTheDocument();
      const wifiScannerElements = screen.getAllByText(/WiFi Scanner/);
      expect(wifiScannerElements.length).toBeGreaterThan(0);
      expect(screen.getByText(/fw-002/)).toBeInTheDocument();
    });
  });

  it('应该能够删除固件（平铺视图）', async () => {
    vi.mocked(AdminClient.getAllFirmware).mockResolvedValue(mockList(mockFirmwares));
    vi.mocked(AdminClient.deleteFirmware).mockResolvedValue();

    render(
      <BrowserRouter>
        <AdminFirmwareList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('LED Blink')).toBeInTheDocument();
    });

    // 切换到平铺视图
    await switchToFlatView();

    // 点击删除按钮 (WiFi Scanner is first due to created_at desc sort)
    const deleteButtons = screen.getAllByTitle('删除');
    fireEvent.click(deleteButtons[0]);

    // 确认删除
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '确认删除' })).toBeInTheDocument();
    });

    const confirmButtons = screen.getAllByRole('button', { name: '确认删除' });
    fireEvent.click(confirmButtons[0]);

    // 验证调用了删除 API (WiFi Scanner is fw-002)
    await waitFor(() => {
      expect(AdminClient.deleteFirmware).toHaveBeenCalledWith('fw-002');
    });
  });

  it('应该能够切换发布状态（平铺视图）', async () => {
    vi.mocked(AdminClient.getAllFirmware).mockResolvedValue(mockList(mockFirmwares));
    vi.mocked(AdminClient.togglePublish).mockResolvedValue();

    render(
      <BrowserRouter>
        <AdminFirmwareList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('LED Blink')).toBeInTheDocument();
    });

    // 切换到平铺视图
    await switchToFlatView();

    // 点击发布切换按钮 (WiFi Scanner is first, unpublished, so toggle to true)
    const publishButtons = screen.getAllByTitle(/发布|取消发布/);
    fireEvent.click(publishButtons[0]);

    // 验证调用了切换发布 API (WiFi Scanner is fw-002, published=false, toggle to true)
    await waitFor(() => {
      expect(AdminClient.togglePublish).toHaveBeenCalledWith('fw-002', true);
    });
  });

  it('应该能够导航到编辑页面（平铺视图）', async () => {
    vi.mocked(AdminClient.getAllFirmware).mockResolvedValue(mockList(mockFirmwares));

    render(
      <BrowserRouter>
        <AdminFirmwareList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('LED Blink')).toBeInTheDocument();
    });

    // 切换到平铺视图
    await switchToFlatView();

    // 点击编辑按钮 (WiFi Scanner is first due to created_at desc sort)
    const editButtons = screen.getAllByTitle('编辑');
    fireEvent.click(editButtons[0]);

    // 验证导航 (WiFi Scanner is fw-002)
    expect(mockNavigate).toHaveBeenCalledWith('/admin/firmware/fw-002/edit');
  });

  it('应该能够导航到上传页面', async () => {
    vi.mocked(AdminClient.getAllFirmware).mockResolvedValue(mockList([]));

    render(
      <BrowserRouter>
        <AdminFirmwareList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('上传新固件')).toBeInTheDocument();
    });

    // 点击上传按钮
    const uploadButton = screen.getByText('上传新固件');
    fireEvent.click(uploadButton);

    // 验证导航
    expect(mockNavigate).toHaveBeenCalledWith('/admin/firmware/upload');
  });

  it('应该显示空状态', async () => {
    vi.mocked(AdminClient.getAllFirmware).mockResolvedValue(mockList([]));

    render(
      <BrowserRouter>
        <AdminFirmwareList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('暂无固件包')).toBeInTheDocument();
    });
  });

  it('应该支持分组展开和折叠', async () => {
    vi.mocked(AdminClient.getAllFirmware).mockResolvedValue(mockList(mockFirmwares));

    render(
      <BrowserRouter>
        <AdminFirmwareList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('LED Blink')).toBeInTheDocument();
    });

    // 默认分组是折叠的，不应该看到版本号
    expect(screen.queryByText('v1.0.0')).not.toBeInTheDocument();

    // 点击展开 LED Blink 分组
    const ledBlinkGroup = screen.getByText('LED Blink').closest('div[class*="cursor-pointer"]');
    if (ledBlinkGroup) {
      fireEvent.click(ledBlinkGroup);
    }

    // 展开后应该看到版本号
    await waitFor(() => {
      expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    });
  });

  it('应该显示 Latest 标记', async () => {
    // 同一项目的多个版本
    const multiVersionFirmwares: FirmwareMetadata[] = [
      {
        ...mockFirmwares[0],
        firmware_id: 'fw-v1',
        project_name: 'TestProject',
        version: '1.0.0',
      },
      {
        ...mockFirmwares[0],
        firmware_id: 'fw-v2',
        project_name: 'TestProject',
        version: '2.0.0',
        created_at: '2024-02-01T00:00:00Z',
      },
    ];

    vi.mocked(AdminClient.getAllFirmware).mockResolvedValue(mockList(multiVersionFirmwares));

    render(
      <BrowserRouter>
        <AdminFirmwareList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('TestProject')).toBeInTheDocument();
    });

    // 分组头部应该显示最新版本
    expect(screen.getByText(/v2.0.0/)).toBeInTheDocument();
    expect(screen.getByText(/2 个版本/)).toBeInTheDocument();
  });

  it('应该支持视图模式切换', async () => {
    vi.mocked(AdminClient.getAllFirmware).mockResolvedValue(mockList(mockFirmwares));

    render(
      <BrowserRouter>
        <AdminFirmwareList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('LED Blink')).toBeInTheDocument();
    });

    // 默认是分组视图
    expect(screen.getByText('分组视图')).toBeInTheDocument();
    expect(screen.getByText('平铺视图')).toBeInTheDocument();

    // 切换到平铺视图
    fireEvent.click(screen.getByText('平铺视图'));

    // 平铺视图应该直接显示版本号
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    expect(screen.getByText('v2.1.0')).toBeInTheDocument();
  });
});

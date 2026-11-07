/**
 * AdminDashboard 组件测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AdminDashboard } from './AdminDashboard';
import { AdminClient } from '../api/adminClient';
import type { AdminStatistics } from '../api/types';

// Mock dependencies
vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    user: { username: 'admin' },
    logout: vi.fn()
  })
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn()
  };
});

vi.mock('../api/adminClient');

describe('AdminDashboard', () => {
  const mockStatistics: AdminStatistics = {
    total_firmware_count: 25,
    published_firmware_count: 20,
    total_storage_mb: 1024.5,
    downloads_last_30_days: 150,
    flashes_last_30_days: 80,
    top_firmware: [
      {
        firmware_id: 'fw-001',
        project_name: 'LED Blink',
        download_count: 50,
        flash_count: 30
      },
      {
        firmware_id: 'fw-002',
        project_name: 'WiFi Scanner',
        download_count: 40,
        flash_count: 25
      }
    ],
    storage_warning: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders dashboard header with user info', async () => {
    vi.spyOn(AdminClient, 'getStatistics').mockResolvedValue(mockStatistics);

    render(
      <BrowserRouter>
        <AdminDashboard />
      </BrowserRouter>
    );

    expect(screen.getByText('管理员仪表板')).toBeInTheDocument();
    expect(screen.getByText('欢迎，admin')).toBeInTheDocument();
  });

  it('displays loading state initially', () => {
    vi.spyOn(AdminClient, 'getStatistics').mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(
      <BrowserRouter>
        <AdminDashboard />
      </BrowserRouter>
    );

    expect(screen.getByText('加载统计信息中...')).toBeInTheDocument();
  });

  it('displays statistics cards with correct data', async () => {
    vi.spyOn(AdminClient, 'getStatistics').mockResolvedValue(mockStatistics);

    render(
      <BrowserRouter>
        <AdminDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('固件总数')).toBeInTheDocument();
      expect(screen.getByText('1.00 GB')).toBeInTheDocument(); // storage
      expect(screen.getByText('150')).toBeInTheDocument(); // downloads
      expect(screen.getByText('80')).toBeInTheDocument(); // flashes
      expect(screen.getByText('已发布: 20')).toBeInTheDocument();
    });
  });

  it('displays top firmware table', async () => {
    vi.spyOn(AdminClient, 'getStatistics').mockResolvedValue(mockStatistics);

    render(
      <BrowserRouter>
        <AdminDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('热门固件 Top 10')).toBeInTheDocument();
      expect(screen.getByText('LED Blink')).toBeInTheDocument();
      expect(screen.getByText('WiFi Scanner')).toBeInTheDocument();
    });
  });

  it('displays storage warning when storage_warning is true', async () => {
    const statsWithWarning = {
      ...mockStatistics,
      storage_warning: true
    };
    vi.spyOn(AdminClient, 'getStatistics').mockResolvedValue(statsWithWarning);

    render(
      <BrowserRouter>
        <AdminDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('存储容量不足')).toBeInTheDocument();
      expect(screen.getByText(/存储空间使用率已超过 80%/)).toBeInTheDocument();
    });
  });

  it('displays error message when API call fails', async () => {
    vi.spyOn(AdminClient, 'getStatistics').mockRejectedValue(
      new Error('Network error')
    );

    render(
      <BrowserRouter>
        <AdminDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
      expect(screen.getByText('重试')).toBeInTheDocument();
    });
  });

  it('displays empty state when no top firmware', async () => {
    const statsWithNoFirmware = {
      ...mockStatistics,
      top_firmware: []
    };
    vi.spyOn(AdminClient, 'getStatistics').mockResolvedValue(statsWithNoFirmware);

    render(
      <BrowserRouter>
        <AdminDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('暂无固件数据')).toBeInTheDocument();
    });
  });

  it('formats storage correctly for MB values', async () => {
    const statsWithMB = {
      ...mockStatistics,
      total_storage_mb: 512.75
    };
    vi.spyOn(AdminClient, 'getStatistics').mockResolvedValue(statsWithMB);

    render(
      <BrowserRouter>
        <AdminDashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('512.75 MB')).toBeInTheDocument();
    });
  });

  it('renders quick action buttons', async () => {
    vi.spyOn(AdminClient, 'getStatistics').mockResolvedValue(mockStatistics);

    render(
      <BrowserRouter>
        <AdminDashboard />
      </BrowserRouter>
    );

    expect(screen.getByText('固件管理')).toBeInTheDocument();
    expect(screen.getByText('上传固件')).toBeInTheDocument();
    expect(screen.getByText('服务配置')).toBeInTheDocument();
  });
});

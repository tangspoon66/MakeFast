/**
 * AdminFirmwareEdit 页面测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AdminFirmwareEdit } from './AdminFirmwareEdit';
import { AdminClient } from '../api/adminClient';
import { CompilationClient } from '../api/compilationClient';
import type { FirmwareMetadata, BoardInfo } from '../api/types';

// Mock the API clients
vi.mock('../api/adminClient');
vi.mock('../api/compilationClient');

// Mock useParams
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'test-firmware-id' }),
    useNavigate: () => vi.fn(),
  };
});

describe('AdminFirmwareEdit', () => {
  const mockFirmware: FirmwareMetadata = {
    firmware_id: 'test-firmware-id',
    project_name: 'Test Project',
    description: 'Test description for the firmware',
    version: '1.0.0',
    supported_board_ids: ['esp32', 'esp32s3'],
    tags: ['test', 'demo'],
    published: true,
    created_at: '2024-01-01T00:00:00Z',
    files: [
      { name: 'bootloader.bin', address: 0x1000, size: 16384, role: 'bootloader' },
      { name: 'partitions.bin', address: 0x8000, size: 4096, role: 'partitions' },
      { name: 'boot_app0.bin', address: 0xe000, size: 4096, role: 'boot_app0' },
      { name: 'app.bin', address: 0x10000, size: 524288, role: 'app' },
    ],
    total_size: 548864,
    has_thumbnail: true,
    download_count: 10,
    flash_count: 5,
    flash_success_count: 4,
    flash_failure_count: 1,
  };

  const mockBoards: BoardInfo[] = [
    {
      id: 'esp32',
      name: 'ESP32 Dev Module',
      fqbn: 'esp32:esp32:esp32',
      description: 'ESP32 Development Board',
      platform: 'esp32',
      flashable: true,
    },
    {
      id: 'esp32s3',
      name: 'ESP32-S3 Dev Module',
      fqbn: 'esp32:esp32:esp32s3',
      description: 'ESP32-S3 Development Board',
      platform: 'esp32',
      flashable: true,
    },
  ];

  function mockList(items: FirmwareMetadata[]) {
    return { items, total_count: items.length, page: 1, page_size: 12, total_pages: Math.ceil(items.length / 12) };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    // Mock API calls to never resolve
    vi.mocked(AdminClient.getAllFirmware).mockImplementation(
      () => new Promise(() => {})
    );
    vi.mocked(CompilationClient.getBoards).mockImplementation(
      () => new Promise(() => {})
    );

    render(
      <BrowserRouter>
        <AdminFirmwareEdit />
      </BrowserRouter>
    );

    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('should load and display firmware data', async () => {
    // Mock successful API calls
    vi.mocked(AdminClient.getAllFirmware).mockResolvedValue(mockList([mockFirmware]));
    vi.mocked(CompilationClient.getBoards).mockResolvedValue({ boards: mockBoards });

    render(
      <BrowserRouter>
        <AdminFirmwareEdit />
      </BrowserRouter>
    );

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Project')).toBeInTheDocument();
    });

    // Verify form is pre-filled
    expect(screen.getByDisplayValue('Test Project')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test description for the firmware')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1.0.0')).toBeInTheDocument();
    
    // Verify tags are displayed
    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('demo')).toBeInTheDocument();
  });

  it('should display error when firmware not found', async () => {
    // Mock API call returning empty array
    vi.mocked(AdminClient.getAllFirmware).mockResolvedValue(mockList([]));
    vi.mocked(CompilationClient.getBoards).mockResolvedValue({ boards: mockBoards });

    render(
      <BrowserRouter>
        <AdminFirmwareEdit />
      </BrowserRouter>
    );

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText('固件不存在')).toBeInTheDocument();
    });
  });

  it('should display error when API call fails', async () => {
    // Mock API call to reject
    vi.mocked(AdminClient.getAllFirmware).mockRejectedValue(new Error('Network error'));
    vi.mocked(CompilationClient.getBoards).mockResolvedValue({ boards: mockBoards });

    render(
      <BrowserRouter>
        <AdminFirmwareEdit />
      </BrowserRouter>
    );

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('should show current thumbnail when available', async () => {
    vi.mocked(AdminClient.getAllFirmware).mockResolvedValue(mockList([mockFirmware]));
    vi.mocked(CompilationClient.getBoards).mockResolvedValue({ boards: mockBoards });

    render(
      <BrowserRouter>
        <AdminFirmwareEdit />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Project')).toBeInTheDocument();
    });

    // Verify thumbnail section is present
    expect(screen.getByText('当前缩略图：')).toBeInTheDocument();
    const thumbnailImg = screen.getByAltText('Current thumbnail');
    expect(thumbnailImg).toBeInTheDocument();
    expect(thumbnailImg).toHaveAttribute('src', expect.stringContaining('/api/firmware/test-firmware-id/thumbnail'));
  });

  it('should display board checkboxes', async () => {
    vi.mocked(AdminClient.getAllFirmware).mockResolvedValue(mockList([mockFirmware]));
    vi.mocked(CompilationClient.getBoards).mockResolvedValue({ boards: mockBoards });

    render(
      <BrowserRouter>
        <AdminFirmwareEdit />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Project')).toBeInTheDocument();
    });

    // Verify boards are displayed
    expect(screen.getByText('ESP32 Dev Module')).toBeInTheDocument();
    expect(screen.getByText('ESP32-S3 Dev Module')).toBeInTheDocument();
  });
});

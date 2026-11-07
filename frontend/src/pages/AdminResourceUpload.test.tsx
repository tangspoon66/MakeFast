import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AdminResourceUpload } from './AdminResourceUpload';
import { templateApi } from '../api/templateApi';
import { AdminClient } from '../api/adminClient';

vi.mock('../components/ImageCropper', () => ({
  ImageCropper: () => null,
}));

vi.mock('../api/templateApi', () => ({
  templateApi: {
    adminList: vi.fn(),
    uploadZip: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../api/adminClient', () => ({
  AdminClient: {
    getAllFirmware: vi.fn(),
    uploadFirmware: vi.fn(),
  },
}));

describe('AdminResourceUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AdminClient.getAllFirmware).mockResolvedValue({
      items: [],
      total_count: 0,
      page: 1,
      page_size: 50,
      total_pages: 0,
    });
    vi.mocked(templateApi.adminList).mockResolvedValue({
      templates: [],
      total_count: 0,
      page: 1,
      page_size: 50,
      total_pages: 1,
    });
  });

  it('loads reusable categories with backend-safe template pagination', async () => {
    render(
      <BrowserRouter>
        <AdminResourceUpload />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(templateApi.adminList).toHaveBeenCalled();
    });

    expect(templateApi.adminList).toHaveBeenCalledWith({ page_size: 50 });
    expect(templateApi.adminList).not.toHaveBeenCalledWith({ page_size: 200 });
  });
});

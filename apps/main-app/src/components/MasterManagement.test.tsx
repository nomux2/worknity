// @vitest-environment jsdom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MasterManagement } from './MasterManagement';

// Mock Auth Context
let mockUser: any = { role: 'admin', login_id: 'admin_user' };
const mockFetchWithAuth = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    fetchWithAuth: mockFetchWithAuth,
  }),
}));

describe('MasterManagement Component', () => {
  let container: HTMLDivElement | null = null;
  let root: any = null;
  const mockAddToast = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    mockFetchWithAuth.mockReset();
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => [],
    });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root.unmount();
      });
      root = null;
    }
    if (container) {
      document.body.removeChild(container);
      container = null;
    }
  });

  it('renders Master Management for admin role', async () => {
    mockUser = { role: 'admin', login_id: 'admin_user' };

    await act(async () => {
      root = createRoot(container!);
      root.render(<MasterManagement addToast={mockAddToast} />);
    });

    // Check if the title exists
    const heading = container!.querySelector('h2');
    expect(heading?.textContent).toContain('マスタ管理システム');

    // Check if the tab buttons are present
    const buttons = container!.querySelectorAll('.master-subtabs button');
    expect(buttons.length).toBe(5); // customers, partners, stocks, cust_fields, calendar
  });

  it('shows access restriction for staff role', async () => {
    mockUser = { role: 'staff', login_id: 'staff_user' };

    await act(async () => {
      root = createRoot(container!);
      root.render(<MasterManagement addToast={mockAddToast} />);
    });

    // Check for access restriction text
    const restrictionHeading = container!.querySelector('h2');
    expect(restrictionHeading?.textContent).toContain('アクセス制限');
    expect(container!.textContent).toContain('マスタ管理画面は管理者（admin）のみが閲覧可能です。');
  });
});

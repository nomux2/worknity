// @vitest-environment jsdom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CustomerRegistry } from './CustomerRegistry';

// Mock Auth Context
let mockUser: any = { role: 'admin', login_id: 'admin_user' };
const mockFetchWithAuth = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    fetchWithAuth: mockFetchWithAuth,
  }),
}));

describe('CustomerRegistry Component', () => {
  let container: HTMLDivElement | null = null;
  let root: any = null;
  const mockAddToast = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    mockFetchWithAuth.mockReset();

    // Default mock response: customer-fields and customers list
    mockFetchWithAuth.mockImplementation(async (url: string) => {
      if (url.includes('/api/customer-fields')) {
        return {
          ok: true,
          json: async () => [
            { id: 1, field_key: 'phone', field_name: '電話番号', field_type: 'text', is_custom: false, is_enabled: true, is_searchable: true, sort_order: 1 },
            { id: 2, field_key: 'care_level', field_name: '介護度', field_type: 'select', options: ['要介護1', '要介護2'], is_custom: true, is_enabled: true, is_searchable: true, sort_order: 5 }
          ],
        };
      }
      if (url.includes('/api/customers')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 101,
              name: '山田太郎',
              kana: 'ヤマダタロウ',
              email: 'yamada@example.com',
              phone: '090-1111-2222',
              postal_code: '100-0001',
              address: '愛知県名古屋市',
              attributes: { care_level: '要介護1' },
              created_at: '2026-06-24',
              updated_at: '2026-06-24',
            }
          ],
        };
      }
      return { ok: false, json: async () => ({}) };
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

  it('renders Customer Registry layout and shows customer list', async () => {
    await act(async () => {
      root = createRoot(container!);
      root.render(<CustomerRegistry addToast={mockAddToast} />);
    });

    // Check header title
    const heading = container!.querySelector('h2');
    expect(heading?.textContent).toContain('顧客管理システム');

    // Wait for state updates and verify list item exists
    const customerBtn = container!.querySelector('button.menu-button');
    expect(customerBtn).toBeTruthy();
    expect(customerBtn?.textContent).toContain('山田太郎');
    expect(customerBtn?.textContent).toContain('090-1111-2222');
  });

  it('displays details when clicking a customer, and restricts delete to admin only', async () => {
    mockUser = { role: 'staff', login_id: 'staff_user' };

    await act(async () => {
      root = createRoot(container!);
      root.render(<CustomerRegistry addToast={mockAddToast} />);
    });

    // Click customer button
    const customerBtn = container!.querySelector('button.menu-button') as HTMLButtonElement;
    expect(customerBtn).toBeTruthy();
    await act(async () => {
      customerBtn.click();
    });

    // Verify detail pane displays selected customer details
    expect(container!.textContent).toContain('山田太郎');
    expect(container!.textContent).toContain('090-1111-2222');
    expect(container!.textContent).toContain('愛知県名古屋市');
    expect(container!.textContent).toContain('要介護1'); // dynamic field value

    // Staff role should not see Delete button
    const deleteBtn = Array.from(container!.querySelectorAll('button')).find(
      btn => btn.textContent?.includes('削除')
    );
    expect(deleteBtn).toBeFalsy();

    // Switch to admin role and re-render
    mockUser = { role: 'admin', login_id: 'admin_user' };
    await act(async () => {
      root.render(<CustomerRegistry addToast={mockAddToast} />);
    });

    // Admin should see Delete button
    const deleteBtnAdmin = Array.from(container!.querySelectorAll('button')).find(
      btn => btn.textContent?.includes('削除')
    );
    expect(deleteBtnAdmin).toBeTruthy();
  });
});

// @vitest-environment jsdom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useRouter } from './useRouter';

describe('useRouter hook', () => {
  let container: HTMLDivElement | null = null;
  let root: any = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    window.history.pushState({}, '', '/');
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

  // Test Harness Component
  let hookValue: ReturnType<typeof useRouter> | null = null;
  const TestComponent: React.FC<{ isAdmin?: boolean }> = ({ isAdmin = false }) => {
    hookValue = useRouter({ isAdmin });
    return (
      <div>
        <span data-testid="tab">{hookValue.currentTab}</span>
        <span data-testid="path">{hookValue.currentPath}</span>
      </div>
    );
  };

  it('correctly maps current pathname to tab', () => {
    window.history.pushState({}, '', '/tasks');
    root = createRoot(container!);
    act(() => {
      root.render(<TestComponent />);
    });

    expect(hookValue?.currentTab).toBe('tasks');
    expect(hookValue?.currentPath).toBe('/tasks');
  });

  it('falls back to portal on root or unknown paths', () => {
    window.history.pushState({}, '', '/');
    root = createRoot(container!);
    act(() => {
      root.render(<TestComponent />);
    });
    expect(hookValue?.currentTab).toBe('portal');

    act(() => {
      hookValue?.navigate('/some-unknown-path');
    });
    expect(hookValue?.currentTab).toBe('portal');
  });

  it('updates tab and URL when navigate is called', () => {
    window.history.pushState({}, '', '/portal');
    root = createRoot(container!);
    act(() => {
      root.render(<TestComponent />);
    });

    act(() => {
      hookValue?.navigate('/stocks');
    });

    expect(hookValue?.currentTab).toBe('stocks');
    expect(hookValue?.currentPath).toBe('/stocks');
    expect(window.location.pathname).toBe('/stocks');
  });

  it('supports navigation by tab name', () => {
    window.history.pushState({}, '', '/portal');
    root = createRoot(container!);
    act(() => {
      root.render(<TestComponent />);
    });

    act(() => {
      hookValue?.navigateToTab('purchase_orders');
    });

    expect(hookValue?.currentTab).toBe('purchase_orders');
    expect(hookValue?.currentPath).toBe('/purchase-orders');
    expect(window.location.pathname).toBe('/purchase-orders');
  });

  it('updates state when popstate (browser back/forward) is triggered', () => {
    window.history.pushState({}, '', '/projects');
    root = createRoot(container!);
    act(() => {
      root.render(<TestComponent />);
    });
    expect(hookValue?.currentTab).toBe('projects');

    act(() => {
      window.history.pushState({}, '', '/attendance');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(hookValue?.currentTab).toBe('attendance');
    expect(hookValue?.currentPath).toBe('/attendance');
  });

  it('guards admin-only routes for non-admin users', () => {
    window.history.pushState({}, '', '/members');
    root = createRoot(container!);
    act(() => {
      root.render(<TestComponent isAdmin={false} />);
    });
    expect(hookValue?.currentTab).toBe('portal');
  });

  it('allows admin-only routes for admin users', () => {
    window.history.pushState({}, '', '/members');
    root = createRoot(container!);
    act(() => {
      root.render(<TestComponent isAdmin={true} />);
    });
    expect(hookValue?.currentTab).toBe('members');
  });
});


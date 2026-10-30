import { useState, useEffect, useCallback } from 'react';

export type TabType = 
  | 'portal' 
  | 'stocks' 
  | 'attendance' 
  | 'billing' 
  | 'members' 
  | 'masters' 
  | 'customers' 
  | 'projects' 
  | 'tasks' 
  | 'orders' 
  | 'catalog_edit' 
  | 'purchase_orders' 
  | 'workflows' 
  | 'workflow_settings';

export const TAB_PATH_MAP: Record<TabType, string> = {
  portal: '/portal',
  stocks: '/stocks',
  attendance: '/attendance',
  billing: '/billing',
  members: '/members',
  masters: '/masters',
  customers: '/customers',
  projects: '/projects',
  tasks: '/tasks',
  orders: '/orders',
  catalog_edit: '/catalog-edit',
  purchase_orders: '/purchase-orders',
  workflows: '/workflows',
  workflow_settings: '/workflow-settings',
};

export const PATH_TAB_MAP: Record<string, TabType> = Object.entries(TAB_PATH_MAP).reduce(
  (acc, [tab, path]) => {
    acc[path] = tab as TabType;
    return acc;
  },
  {} as Record<string, TabType>
);

const ADMIN_ONLY_TABS: TabType[] = ['members', 'masters', 'workflow_settings'];

export interface UseRouterOptions {
  isAdmin?: boolean;
}

export function useRouter(options: UseRouterOptions = {}) {
  const { isAdmin = true } = options;

  // Helper to resolve tab and normalize path
  const resolveTabFromPath = useCallback((pathname: string): { tab: TabType; path: string } => {
    const cleanPath = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
    const tab = PATH_TAB_MAP[cleanPath];

    if (!tab) {
      return { tab: 'portal', path: cleanPath === '/' ? '/portal' : cleanPath };
    }

    // Guard admin-only routes
    if (!isAdmin && ADMIN_ONLY_TABS.includes(tab)) {
      return { tab: 'portal', path: '/portal' };
    }

    return { tab, path: cleanPath };
  }, [isAdmin]);

  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname);
  const [currentTab, setCurrentTab] = useState<TabType>(() => resolveTabFromPath(window.location.pathname).tab);

  // Sync state on path changes
  const updateRoute = useCallback((newPath: string) => {
    const { tab, path } = resolveTabFromPath(newPath);
    setCurrentPath(path);
    setCurrentTab(tab);
  }, [resolveTabFromPath]);

  // Navigate function
  const navigate = useCallback((targetPath: string, replace = false) => {
    const { path } = resolveTabFromPath(targetPath);
    if (replace) {
      window.history.replaceState({}, '', path);
    } else {
      window.history.pushState({}, '', path);
    }
    updateRoute(path);
  }, [resolveTabFromPath, updateRoute]);

  // Navigate by tab identifier
  const navigateToTab = useCallback((tab: TabType, replace = false) => {
    const path = TAB_PATH_MAP[tab] || '/portal';
    navigate(path, replace);
  }, [navigate]);

  // Listen to popstate (browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      updateRoute(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [updateRoute]);

  // Initial path resolution update when isAdmin changes
  useEffect(() => {
    updateRoute(window.location.pathname);
  }, [isAdmin, updateRoute]);

  return {
    currentTab,
    currentPath,
    navigate,
    navigateToTab,
  };
}


import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  decodeAttestationOptions,
  encodeAttestationCredential,
  decodeAssertionOptions,
  encodeAssertionCredential
} from '../utils/webauthn';

export interface OrganizationItem {
  id: number;
  name: string;
}

export interface UserDetails {
  id: number;
  email: string | null;
  login_id: string | null;
  role: string;
  organization_id: number;
  organization_name: string;
  setup_completed: boolean;
  organizations: OrganizationItem[];
}

interface AuthContextType {
  user: UserDetails | null;
  accessToken: string | null;
  loading: boolean;
  addons: string[];
  login: (loginId: string, password: string) => Promise<void>;
  register: (email: string, loginId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchOrg: (orgId: number) => Promise<void>;
  setupOrg: (orgName: string) => Promise<void>;
  registerPasskey: (alias?: string) => Promise<void>;
  loginPasskey: (loginId?: string) => Promise<void>;
  startSocialLogin: (provider: string) => Promise<{ redirect_url: string; is_mock: boolean; message: string }>;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
  setAuthToken: (token: string) => Promise<void>;
  fetchAddons: () => Promise<void>;
  toggleAddon: (addonId: string, enabled: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDetails | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [addons, setAddons] = useState<string[]>([]);

  // Auth fetch wrapper that automatically attaches the JWT Bearer token
  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    let currentToken = accessToken;
 
    const headers = new Headers(options.headers || {});
    if (currentToken) {
      headers.set('Authorization', `Bearer ${currentToken}`);
    }
    headers.set('Accept', 'application/json');
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
 
    let res = await fetch(url, { ...options, headers });
 
    // Handle token expiration by attempting refresh once
    if (res.status === 401 && !url.includes('/auth/refresh') && !url.includes('/auth/login') && !url.includes('/auth/register')) {
      try {
        const refreshedToken = await performSilentRefresh();
        if (refreshedToken) {
          headers.set('Authorization', `Bearer ${refreshedToken}`);
          res = await fetch(url, { ...options, headers });
        }
      } catch (err) {
        setUser(null);
        setAccessToken(null);
      }
    }
 
    return res;
  }, [accessToken]);

  const fetchAddons = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/settings/addons');
      if (res.ok) {
        const data = await res.json();
        setAddons(data.addons || []);
      }
    } catch (e) {
      console.error('Failed to fetch addons:', e);
    }
  }, [fetchWithAuth]);

  const toggleAddon = async (addonId: string, enabled: boolean) => {
    let newAddons = [...addons];
    if (enabled) {
      if (!newAddons.includes(addonId)) {
        newAddons.push(addonId);
      }
    } else {
      newAddons = newAddons.filter(a => a !== addonId);
    }

    const res = await fetchWithAuth('/api/settings/addons', {
      method: 'PUT',
      body: JSON.stringify({ addons: newAddons })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'アドオン設定の更新に失敗しました。');
    }

    const data = await res.json();
    setAddons(data.addons || []);
  };

  useEffect(() => {
    if (accessToken && user) {
      fetchAddons();
    } else {
      setAddons([]);
    }
  }, [accessToken, user, fetchAddons]);

  // Perform silent refresh using HttpOnly cookie
  const performSilentRefresh = async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setAccessToken(data.access_token);
        
        // Fetch user profile info
        const userRes = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${data.access_token}`,
            'Accept': 'application/json'
          }
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);
          return data.access_token;
        }
      }
    } catch (e) {
      console.error('Silent refresh failed:', e);
    }
    return null;
  };

  // Initial load: restore auth state if refresh token exists
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await performSilentRefresh();
      } catch (err) {
        console.error('Failed to initialize auth:', err);
      } finally {
        setLoading(false);
      }
    };
    initializeAuth();
  }, []);

  // Periodic silent refresh (every 50 minutes)
  useEffect(() => {
    if (!accessToken) return;

    const interval = setInterval(async () => {
      await performSilentRefresh();
    }, 50 * 60 * 1000);

    return () => clearInterval(interval);
  }, [accessToken]);

  const login = async (loginId: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ login_id: loginId, password })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `ログインに失敗しました (${res.status})。`);
    }
    const data = await res.json();
    setAccessToken(data.access_token);
    setUser(data.user);
  };

  const register = async (email: string, loginId: string, password: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, login_id: loginId, password })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `新規登録に失敗しました (${res.status})。`);
    }
    const data = await res.json();
    setAccessToken(data.access_token);
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await fetchWithAuth('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  };

  const switchOrg = async (orgId: number) => {
    const res = await fetchWithAuth('/api/auth/organization/switch', {
      method: 'POST',
      body: JSON.stringify({ organization_id: orgId })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || '組織の切り替えに失敗しました。');
    }
    const data = await res.json();
    setAccessToken(data.access_token);
    setUser(data.user);
  };

  const setupOrg = async (orgName: string) => {
    const res = await fetchWithAuth('/api/auth/organization/setup', {
      method: 'PUT',
      body: JSON.stringify({ organization_name: orgName })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'セットアップに失敗しました。');
    }
    const data = await res.json();
    if (user) {
      setUser({
        ...user,
        organization_name: data.organization.name,
        setup_completed: true,
        organizations: user.organizations.map(o => 
          o.id === data.organization.id ? { ...o, name: data.organization.name } : o
        )
      });
    }
  };

  const registerPasskey = async (alias?: string) => {
    // 1. Get options from server
    const optionsRes = await fetchWithAuth('/api/auth/passkey/register/options', {
      method: 'POST'
    });
    if (!optionsRes.ok) {
      const errData = await optionsRes.json().catch(() => ({}));
      throw new Error(errData.message || 'パスキー登録オプションの取得に失敗しました。');
    }
    const optionsData = await optionsRes.json();
    
    // 2. Decode options to binary formats
    const decodedOptions = decodeAttestationOptions(optionsData);
    
    // 3. Prompt browser WebAuthn API
    const credential = await navigator.credentials.create({
      publicKey: decodedOptions
    });
    if (!credential) {
      throw new Error('パスキーの作成がキャンセルされたか失敗しました。');
    }
    
    // 4. Encode credential back to strings
    const encodedCred = encodeAttestationCredential(credential);
    
    // 5. Submit to backend
    const saveRes = await fetchWithAuth('/api/auth/passkey/register', {
      method: 'POST',
      body: JSON.stringify({
        ...encodedCred,
        name: alias
      })
    });
    if (!saveRes.ok) {
      const errData = await saveRes.json().catch(() => ({}));
      throw new Error(errData.message || 'パスキーの登録に失敗しました。');
    }
  };

  const loginPasskey = async (loginId?: string) => {
    // 1. Get login challenge options
    const optionsRes = await fetch('/api/auth/passkey/login/options', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ login_id: loginId })
    });
    if (!optionsRes.ok) {
      const errData = await optionsRes.json().catch(() => ({}));
      throw new Error(errData.message || 'パスキーログインオプションの取得に失敗しました。');
    }
    const optionsData = await optionsRes.json();
    
    // 2. Decode options to binary formats
    const decodedOptions = decodeAssertionOptions(optionsData);
    
    // 3. Prompt browser WebAuthn API
    const credential = await navigator.credentials.get({
      publicKey: decodedOptions
    });
    if (!credential) {
      throw new Error('パスキー認証がキャンセルされたか失敗しました。');
    }
    
    // 4. Encode credential back to strings
    const encodedCred = encodeAssertionCredential(credential);
    
    // 5. Submit validation request to backend
    const loginRes = await fetch('/api/auth/passkey/login', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(encodedCred)
    });
    if (!loginRes.ok) {
      const errData = await loginRes.json().catch(() => ({}));
      throw new Error(errData.message || 'パスキーでのログインに失敗しました。');
    }
    
    const data = await loginRes.json();
    setAccessToken(data.access_token);
    setUser(data.user);
  };

  const startSocialLogin = async (provider: string) => {
    const res = await fetch(`/api/auth/social/${provider}/redirect`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'ソーシャルログインの接続に失敗しました。');
    }
    return await res.json();
  };

  const setAuthToken = async (token: string) => {
    setAccessToken(token);
    const userRes = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    if (userRes.ok) {
      const userData = await userRes.json();
      setUser(userData);
    } else {
      throw new Error('ユーザー情報の取得に失敗しました。');
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      accessToken,
      loading,
      addons,
      login,
      register,
      logout,
      switchOrg,
      setupOrg,
      registerPasskey,
      loginPasskey,
      startSocialLogin,
      fetchWithAuth,
      setAuthToken,
      fetchAddons,
      toggleAddon
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

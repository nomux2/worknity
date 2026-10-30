import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { Input } from '../components/ui/Input';
import { Switch } from '../components/ui/Switch';
import { InventoryManagement } from '../components/InventoryManagement';
import { AttendanceManagement } from '../components/AttendanceManagement';
import { MemberManagement } from '../components/MemberManagement';
import { MasterManagement } from '../components/MasterManagement';
import { CustomerRegistry } from '../components/CustomerRegistry';
import { ProjectManagement } from '../components/ProjectManagement';
import { TaskManagement } from '../components/TaskManagement';
import { OrderBoardPage } from './OrderBoardPage';
import { CatalogManagementPage } from './CatalogManagementPage';
import { PurchaseOrderManagement } from '../components/PurchaseOrderManagement';
import { WorkflowManagement } from '../components/WorkflowManagement';
import { WorkflowSettings } from '../components/WorkflowSettings';
import { 
  PortalIcon, 
  StockIcon, 
  AttendanceIcon, 
  BillingIcon, 
  CustomerIcon, 
  ProjectIcon, 
  TaskIcon, 
  MemberIcon, 
  MasterIcon, 
  OrderIcon, 
  CatalogIcon, 
  PurchaseIcon, 
  WorkflowIcon, 
  SettingIcon,
  SuccessIcon,
  ErrorIcon,
  WarningIcon 
} from '../components/ui/Icons';

interface StockItem {
  id: number;
  organization_id: number;
  product_name: string;
  quantity: number;
  minimum_quantity: number;
  attributes: {
    code?: string;
  } | null;
  recent_quantities: number[];
  created_at: string;
  updated_at: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning';
}

export const DashboardPage: React.FC = () => {
  const { 
    user, 
    logout, 
    switchOrg, 
    setupOrg, 
    registerPasskey, 
    fetchWithAuth,
    addons,
    toggleAddon
  } = useAuth();

  // Portal & navigation states
  const [activeTab, setActiveTab] = useState<'portal' | 'stocks' | 'attendance' | 'billing' | 'members' | 'masters' | 'customers' | 'projects' | 'tasks' | 'orders' | 'catalog_edit' | 'purchase_orders' | 'workflows' | 'workflow_settings'>('portal');
  const [isLauncherOpen, setIsLauncherOpen] = useState<boolean>(false);
  const [showAddonPanel, setShowAddonPanel] = useState<boolean>(false);

  const handleToggleAddon = async (addonId: string, enabled: boolean) => {
    try {
      await toggleAddon(addonId, enabled);
      addToast(enabled ? 'アドオンを有効化しました。' : 'アドオンを無効化しました。');
    } catch (err: any) {
      addToast(err.message || 'アドオン設定の更新に失敗しました。', 'error');
    }
  };

  // User profile dropdown states
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  const [isOnDuty, setIsOnDuty] = useState<boolean>(false);
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');

  // Clock tick effect
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Stocks state for portal health calculations
  const [stocks, setStocks] = useState<StockItem[]>([]);
  
  // Setup organization name state
  const [newOrgName, setNewOrgName] = useState<string>('');
  const [submittingOrg, setSubmittingOrg] = useState<boolean>(false);

  // Passkey state
  const [passkeyAlias, setPasskeyAlias] = useState<string>('');
  const [registeringPasskey, setRegisteringPasskey] = useState<boolean>(false);
  const [showSecurityPanel, setShowSecurityPanel] = useState<boolean>(false);

  // Toast system
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  // Fetch stocks for portal metrics summary
  const fetchStocks = async () => {
    try {
      const res = await fetchWithAuth('/api/stocks');
      if (res.ok) {
        const payload = await res.json();
        setStocks(payload.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTodayStatus = useCallback(async () => {
    try {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const res = await fetchWithAuth(`/api/attendances?month=${y}-${m}`);
      if (res.ok) {
        const payload = await res.json();
        const activeRec = (payload.data || []).find((r: any) => r.user_id === user?.id && r.status === 'working');
        if (activeRec) {
          setIsOnDuty(true);
          setClockInTime(activeRec.formatted_clock_in || new Date(activeRec.clock_in).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }));
        } else {
          setIsOnDuty(false);
          setClockInTime(null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [user?.id, fetchWithAuth]);

  useEffect(() => {
    if (user?.organization_id) {
      fetchStocks();
      fetchTodayStatus();
    }
  }, [user?.organization_id, activeTab, fetchTodayStatus]);

  // Handle Organization setup
  const handleSetupOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setSubmittingOrg(true);
    try {
      await setupOrg(newOrgName);
      addToast('組織のセットアップが完了しました！');
    } catch (err: any) {
      addToast(err.message || '組織名の登録に失敗しました。', 'error');
    } finally {
      setSubmittingOrg(false);
    }
  };

  // Register Passkey
  const handleRegisterPasskey = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisteringPasskey(true);
    try {
      const aliasName = passkeyAlias.trim() || 'デバイスキー';
      await registerPasskey(aliasName);
      addToast(`パスキー「${aliasName}」の登録が完了しました。`);
      setPasskeyAlias('');
      setShowSecurityPanel(false);
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'パスキーの登録に失敗しました。このブラウザがパスキーに対応しているかご確認ください。', 'error');
    } finally {
      setRegisteringPasskey(false);
    }
  };

  // Render initial setup wizard if organization name is empty
  if (user && !user.setup_completed) {
    return (
      <div className="setup-screen">
        <div className="auth-card" style={{ maxWidth: '500px' }}>
          <div className="auth-header">
            <h2>組織の初期設定 <span className="brand-dot"></span></h2>
            <p>ご利用を開始するには、在庫を管理する組織（会社・グループ名）を登録してください。</p>
          </div>
          <form onSubmit={handleSetupOrg} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Input
              id="orgName"
              type="text"
              label="組織・店舗名"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder="例: 株式会社サンプル, 表参道店"
              required
              containerClassName="form-group"
            />
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submittingOrg}>
              {submittingOrg ? '登録中...' : 'セットアップ完了'}
            </button>
            <button type="button" className="btn btn-text" onClick={logout} style={{ marginTop: '0.5rem' }}>
              ログアウト
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Calculate local statistics for metrics
  const totalStocks = stocks.length;
  const goodStocks = stocks.filter(s => s.quantity > s.minimum_quantity).length;
  const warningStocks = stocks.filter(s => s.quantity === s.minimum_quantity).length;
  const dangerStocks = stocks.filter(s => s.quantity < s.minimum_quantity).length;

  const healthPercentage = totalStocks > 0 
    ? Math.round((goodStocks / totalStocks) * 100) 
    : 100;

  // Determine health bar color based on percentage
  let healthColor = 'var(--status-good)';
  if (healthPercentage < 50) healthColor = 'var(--status-alert)';
  else if (healthPercentage < 80) healthColor = 'var(--status-warning)';

  return (
    <div className="app-container">
      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              {toast.type === 'success' ? <SuccessIcon size={16} /> : toast.type === 'error' ? <ErrorIcon size={16} /> : <WarningIcon size={16} />}
            </span>
            <div>{toast.message}</div>
          </div>
        ))}
      </div>

      {/* Navigation Header */}
      <header className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="brand" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('portal')}>
            Worknity <span className="brand-dot"></span>
          </div>
          <span className="nav-divider" style={{ color: 'var(--border-color)' }}>|</span>
          
          {/* Desktop Navigation (Direct Tabs) */}
          <nav className="nav-tabs">
            <button 
              type="button" 
              className={`nav-tab-item ${activeTab === 'portal' ? 'active' : ''}`}
              onClick={() => setActiveTab('portal')}
            >
              <PortalIcon />
              <span>ポータル</span>
            </button>
            <button 
              type="button" 
              className={`nav-tab-item ${activeTab === 'stocks' ? 'active' : ''}`}
              onClick={() => setActiveTab('stocks')}
            >
              <StockIcon />
              <span>在庫</span>
            </button>
            <button 
              type="button" 
              className={`nav-tab-item ${activeTab === 'attendance' ? 'active' : ''}`}
              onClick={() => setActiveTab('attendance')}
            >
              <AttendanceIcon />
              <span>勤怠</span>
            </button>
            <button 
              type="button" 
              className={`nav-tab-item ${activeTab === 'billing' ? 'active' : ''}`}
              onClick={() => setActiveTab('billing')}
            >
              <BillingIcon />
              <span>売上</span>
            </button>
            <button 
              type="button" 
              className={`nav-tab-item ${activeTab === 'customers' ? 'active' : ''}`}
              onClick={() => setActiveTab('customers')}
            >
              <CustomerIcon />
              <span>顧客</span>
            </button>
            <button 
              type="button" 
              className={`nav-tab-item ${activeTab === 'projects' ? 'active' : ''}`}
              onClick={() => setActiveTab('projects')}
            >
              <ProjectIcon />
              <span>プロジェクト</span>
            </button>
            <button 
              type="button" 
              className={`nav-tab-item ${activeTab === 'tasks' ? 'active' : ''}`}
              onClick={() => setActiveTab('tasks')}
            >
              <TaskIcon />
              <span>タスク</span>
            </button>
            <button 
              type="button" 
              className={`nav-tab-item ${activeTab === 'members' ? 'active' : ''}`}
              onClick={() => setActiveTab('members')}
            >
              <MemberIcon />
              <span>メンバー</span>
            </button>
            <button 
              type="button" 
              className={`nav-tab-item ${activeTab === 'masters' ? 'active' : ''}`}
              onClick={() => setActiveTab('masters')}
            >
              <MasterIcon />
              <span>管理</span>
            </button>
            <button 
              type="button" 
              className={`nav-tab-item ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              <OrderIcon />
              <span>注文管理</span>
            </button>
            <button 
              type="button" 
              className={`nav-tab-item ${activeTab === 'catalog_edit' ? 'active' : ''}`}
              onClick={() => setActiveTab('catalog_edit')}
            >
              <CatalogIcon />
              <span>メニュー</span>
            </button>
            {addons.includes('purchase_order') && (
              <button 
                type="button" 
                className={`nav-tab-item ${activeTab === 'purchase_orders' ? 'active' : ''}`}
                onClick={() => setActiveTab('purchase_orders')}
              >
                <PurchaseIcon />
                <span>発注</span>
              </button>
            )}
            <button 
              type="button" 
              className={`nav-tab-item ${activeTab === 'workflows' ? 'active' : ''}`}
              onClick={() => setActiveTab('workflows')}
            >
              <WorkflowIcon />
              <span>申請・報告</span>
            </button>
            {user?.role === 'admin' && (
              <button 
                type="button" 
                className={`nav-tab-item ${activeTab === 'workflow_settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('workflow_settings')}
              >
                <SettingIcon />
                <span>申請設定</span>
              </button>
            )}
          </nav>

          {/* Mobile Fallback Navigation (Quick Launcher & Current Title) */}
          <div className="nav-mobile-menu">
            <button 
              type="button" 
              className="nav-launcher-btn" 
              onClick={() => setIsLauncherOpen(true)}
              title="機能メニュー"
              aria-label="機能メニューを開く"
            >
              ⋮⋮⋮
            </button>
            <button 
              type="button" 
              className="nav-home-btn"
              onClick={() => setActiveTab('portal')}
              title="ポータルホーム"
              aria-label="ポータルホームへ"
            >
              <PortalIcon size={18} />
            </button>
            <span style={{ color: 'var(--text-muted)', margin: '0 0.25rem' }}>|</span>
            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
              {activeTab === 'portal' && 'ポータル'}
              {activeTab === 'stocks' && '在庫'}
              {activeTab === 'attendance' && '勤怠'}
              {activeTab === 'billing' && '売上'}
              {activeTab === 'members' && 'メンバー'}
              {activeTab === 'masters' && '管理'}
              {activeTab === 'customers' && '顧客'}
              {activeTab === 'orders' && '注文管理'}
              {activeTab === 'catalog_edit' && 'メニュー'}
              {activeTab === 'purchase_orders' && '発注'}
              {activeTab === 'workflows' && '申請・報告'}
              {activeTab === 'workflow_settings' && '申請設定'}
            </span>
          </div>
        </div>
        
        <div className="nav-actions">
          <div className="user-menu-container" ref={userMenuRef}>
            <button 
              type="button" 
              className="user-menu-btn"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              aria-label="ユーザーメニューを開く"
            >
              <img src="/icon/avatar.png" className="user-avatar" alt="アバター" onError={(e) => {
                // Fallback to text initials if avatar.png is not found
                (e.target as HTMLImageElement).style.display = 'none';
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent && !parent.querySelector('.user-avatar-fallback')) {
                  const span = document.createElement('span');
                  span.className = 'user-avatar-fallback';
                  span.innerText = user?.login_id?.charAt(0).toUpperCase() || 'U';
                  span.style.fontSize = '0.9rem';
                  span.style.fontWeight = '700';
                  span.style.color = 'var(--text-main)';
                  parent.appendChild(span);
                }
              }} />
            </button>
            {isUserMenuOpen && (
              <div className="user-menu-dropdown">
                {user && (
                  <>
                    <div className="dropdown-info">
                      <span className="dropdown-user-name">{user.login_id}</span>
                      <span className="dropdown-user-role">{user.role === 'admin' ? '管理者' : 'スタッフ'}</span>
                    </div>
                    <div className="dropdown-divider"></div>
                    <div className="dropdown-item org-select-item">
                      <span>組織:</span>
                      <select 
                        className="org-selector"
                        value={user.organization_id}
                        onChange={(e) => {
                          switchOrg(Number(e.target.value));
                          setIsUserMenuOpen(false);
                        }}
                      >
                        {user.organizations.map(org => (
                          <option key={org.id} value={org.id}>{org.name || '未セットアップ'}</option>
                        ))}
                      </select>
                    </div>
                    <div className="dropdown-divider"></div>
                  </>
                )}
                {user && user.role === 'admin' && (
                  <button 
                    type="button" 
                    className="dropdown-item"
                    onClick={() => {
                      setShowAddonPanel(true);
                      setIsUserMenuOpen(false);
                    }}
                  >
                    アドオン管理
                  </button>
                )}

                <button 
                  type="button" 
                  className="dropdown-item"
                  onClick={() => {
                    setShowSecurityPanel(!showSecurityPanel);
                    setIsUserMenuOpen(false);
                  }}
                >
                  セキュリティ設定
                </button>

                <ThemeToggle className="dropdown-item" />

                <div className="dropdown-divider"></div>
                <button 
                  type="button" 
                  className="dropdown-item logout-btn"
                  onClick={() => {
                    logout();
                    setIsUserMenuOpen(false);
                  }}
                >
                  ログアウト
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="dashboard-content">
        {/* Passkey Settings Collapsible Panel */}
        {showSecurityPanel && (
          <div className="section-card" style={{ animation: 'slideDown 0.2s ease-out' }}>
            <div className="section-header">
              <h2>パスキーセキュリティ設定</h2>
              <button className="btn btn-text btn-xs" onClick={() => setShowSecurityPanel(false)}>閉じる</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                お使いのデバイスにパスキーを登録すると、次回からパスワードの入力なしで指紋や顔認証（Windows Hello / Touch ID 等）を用いて安全にログインできるようになります。
              </p>
              <form onSubmit={handleRegisterPasskey} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Input
                  id="passkeyAlias"
                  type="text"
                  label="デバイスの呼び名"
                  value={passkeyAlias}
                  onChange={(e) => setPasskeyAlias(e.target.value)}
                  placeholder="例: 私のパソコン, 社用スマホ"
                  required
                  containerClassName="form-group"
                  containerStyle={{ marginBottom: 0, flex: 1, minWidth: '200px' }}
                />
                <button type="submit" className="btn btn-primary" disabled={registeringPasskey}>
                  {registeringPasskey ? '登録中...' : 'パスキーを登録する'}
                </button>
              </form>
            </div>
          </div>
        )}

      {/* Addons Management Modal */}
      {showAddonPanel && (
        <div className="modal-overlay" onClick={() => setShowAddonPanel(false)}>
          <div className="modal-content" style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>アドオン管理 <span className="brand-dot"></span></h2>
              <button type="button" className="close-btn" onClick={() => setShowAddonPanel(false)} aria-label="閉じる">×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                組織で利用するアドオン機能を有効化・無効化できます。
              </p>
              
              <div className="addon-card" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-app)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>仕入発注管理</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>仕入先への発注、注文書出力、分納入荷を管理します。</span>
                </div>
                <Switch 
                  id="addon-purchase-order"
                  checked={addons.includes('purchase_order')}
                  onChange={(e) => {
                    handleToggleAddon('purchase_order', e.target.checked);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

        {/* Tab Module Views */}
        {activeTab === 'portal' && (
          <div className="portal-container" style={{ animation: 'fadeIn 0.2s ease-out' }}>
            <h1 className="portal-welcome">
              こんにちは、{user?.login_id}さん。今日の稼働状況です。
            </h1>
            <div className="portal-grid">
              {/* 1. 在庫管理 */}
              <div className="portal-card">
                <div className="portal-card-header">
                  <h3>在庫管理</h3>
                  <span className="portal-card-badge status-active">稼働中</span>
                </div>
                <div className="portal-card-content">
                  <div className="health-status-header" style={{ padding: 0 }}>
                    <span>在庫健全性: {healthPercentage}%</span>
                  </div>
                  <div className="health-bar-bg" style={{ margin: '0.5rem 0' }}>
                    <div 
                      className="health-bar-fill" 
                      style={{ width: `${healthPercentage}%`, backgroundColor: healthColor }}
                    ></div>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                    良好: {goodStocks}点 / 警告: {warningStocks}点 / 不足: {dangerStocks}点
                  </p>
                </div>
                <div className="portal-card-actions">
                  <button 
                    type="button" 
                    className="btn btn-primary btn-sm"
                    onClick={() => setActiveTab('stocks')}
                  >
                    在庫管理を開く
                  </button>
                </div>
              </div>

              {/* 2. 勤怠管理 */}
              <div className="portal-card">
                <div className="portal-card-header">
                  <h3>勤怠管理</h3>
                  <span className={`portal-card-badge ${isOnDuty ? 'status-active' : ''}`}>
                    {isOnDuty ? '勤務中' : '勤務外'}
                  </span>
                </div>
                <div className="portal-card-content" style={{ alignItems: 'center', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-main)', margin: '0.5rem 0' }}>
                    {currentTime || '00:00:00'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
                    <Switch
                      label={isOnDuty ? '勤務中 (打刻済み)' : '出勤する'}
                      checked={isOnDuty}
                      onChange={async (e) => {
                        const checked = e.target.checked;
                        if (checked) {
                          try {
                            const res = await fetchWithAuth('/api/attendances/clock-in', { method: 'POST' });
                            const data = await res.json();
                            if (res.ok) {
                              setIsOnDuty(true);
                              const now = new Date();
                              setClockInTime(now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }));
                              addToast('出勤打刻を完了しました。', 'success');
                            } else {
                              addToast(data.message || '出勤打刻に失敗しました。', 'error');
                            }
                          } catch (e) {
                            addToast('出勤打刻に失敗しました。', 'error');
                          }
                        } else {
                          try {
                            const res = await fetchWithAuth('/api/attendances/clock-out', { method: 'POST' });
                            const data = await res.json();
                            if (res.ok) {
                              setIsOnDuty(false);
                              setClockInTime(null);
                              addToast('退勤打刻を完了しました。今日も一日お疲れ様でした！', 'success');
                            } else {
                              addToast(data.message || '退勤打刻に失敗しました。', 'error');
                            }
                          } catch (e) {
                            addToast('退勤打刻に失敗しました。', 'error');
                          }
                        }
                      }}
                    />
                    {isOnDuty && clockInTime && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        出勤時刻: {clockInTime}
                      </span>
                    )}
                  </div>
                </div>
                <div className="portal-card-actions">
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveTab('attendance')}
                  >
                    勤務表を開く
                  </button>
                </div>
              </div>

              {/* 3. 請求・売上 */}
              <div className="portal-card">
                <div className="portal-card-header">
                  <h3>請求・売上管理</h3>
                  <span className="portal-card-badge">今期目標</span>
                </div>
                <div className="portal-card-content">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    <span>今月の売上進捗</span>
                    <span style={{ fontWeight: 600 }}>75% (¥750,000 / ¥1,000,000)</span>
                  </div>
                  <div className="health-bar-bg" style={{ margin: '0.25rem 0 0.75rem 0' }}>
                    <div 
                      className="health-bar-fill" 
                      style={{ width: '75%', backgroundColor: 'var(--primary)' }}
                    ></div>
                  </div>
                  
                  {/* Simple SVG Chart mock */}
                  <svg viewBox="0 0 100 25" style={{ width: '100%', height: '35px', overflow: 'visible' }}>
                    <path
                      d="M0,20 L15,18 L30,12 L45,15 L60,8 L75,10 L90,3 L100,5"
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="90" cy="3" r="2.5" fill="var(--primary)" />
                  </svg>
                </div>
                <div className="portal-card-actions">
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveTab('billing')}
                  >
                    売上管理を開く
                  </button>
                </div>
              </div>

              {/* 4. プロジェクト */}
              <div className="portal-card">
                <div className="portal-card-header">
                  <h3>プロジェクト管理</h3>
                  <span className="portal-card-badge status-active">進行中</span>
                </div>
                <div className="portal-card-content">
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.5rem 0' }}>
                    現場や案件ごとの進捗・消化工数をビジュアル表示。予算との乖離を防ぎます。
                  </p>
                </div>
                <div className="portal-card-actions">
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveTab('projects')}
                  >
                    プロジェクト一覧を開く
                  </button>
                </div>
              </div>

              {/* 5. タスク */}
              <div className="portal-card">
                <div className="portal-card-header">
                  <h3>日常タスク管理</h3>
                  <span className="portal-card-badge status-active">カレンダー</span>
                </div>
                <div className="portal-card-content">
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.5rem 0' }}>
                    定常作業や繰り返しタスクをカレンダーおよびカンバン形式で可視化。
                  </p>
                </div>
                <div className="portal-card-actions">
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveTab('tasks')}
                  >
                    タスクカレンダーを開く
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {activeTab === 'stocks' && (
          <InventoryManagement addToast={addToast} />
        )}

        {activeTab === 'attendance' && (
          <AttendanceManagement addToast={addToast} />
        )}

        {activeTab === 'billing' && (
          <div className="section-card kiosk-main-card" style={{ padding: '2rem', animation: 'fadeIn 0.2s ease-out' }}>
            <div className="section-header">
              <h2>請求・売上管理システム</h2>
              <span className="badge badge-good">順調</span>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', padding: '0.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                <div className="metric-card">
                  <h3>今月の売上</h3>
                  <div className="metric-value">¥750,000</div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>目標: ¥1,000,000 (75% 達成)</p>
                </div>
                <div className="metric-card">
                  <h3>未入金請求書</h3>
                  <div className="metric-value" style={{ color: 'var(--status-warning)' }}>3 件</div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>支払期限超過なし</p>
                </div>
              </div>
              <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', padding: '1.5rem' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>最近の請求履歴</h3>
                <table className="stock-table">
                  <thead>
                    <tr>
                      <th>請求番号</th>
                      <th>取引先</th>
                      <th style={{ textAlign: 'right' }}>金額</th>
                      <th>状態</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontFamily: 'var(--mono)' }}>INV-2026-003</td>
                      <td>山田物産 株式会社</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>¥250,000</td>
                      <td><span className="badge badge-good">入金済み</span></td>
                    </tr>
                    <tr>
                      <td style={{ fontFamily: 'var(--mono)' }}>INV-2026-004</td>
                      <td>鈴木商事 合同会社</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>¥180,000</td>
                      <td><span className="badge badge-good">入金済み</span></td>
                    </tr>
                    <tr>
                      <td style={{ fontFamily: 'var(--mono)' }}>INV-2026-005</td>
                      <td>佐藤電気 工業</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>¥320,000</td>
                      <td><span className="badge badge-warning">未入金</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'members' && (
          <MemberManagement addToast={addToast} />
        )}
        {activeTab === 'masters' && (
          <MasterManagement addToast={addToast} />
        )}
        {activeTab === 'customers' && (
          <CustomerRegistry addToast={addToast} />
        )}
        {activeTab === 'projects' && user && (
          <ProjectManagement addToast={addToast} isAdmin={user.role === 'admin'} />
        )}
        {activeTab === 'tasks' && user && (
          <TaskManagement 
            addToast={addToast} 
            isAdmin={user.role === 'admin'} 
            currentUser={{
              id: user.id,
              login_id: user.login_id || '',
              organization_id: user.organization_id
            }} 
          />
        )}
        {activeTab === 'orders' && (
          <OrderBoardPage />
        )}
        {activeTab === 'catalog_edit' && (
          <CatalogManagementPage />
        )}
        {activeTab === 'purchase_orders' && (
          <PurchaseOrderManagement addToast={addToast} />
        )}
        {activeTab === 'workflows' && (
          <WorkflowManagement addToast={addToast} />
        )}
        {activeTab === 'workflow_settings' && (
          <WorkflowSettings addToast={addToast} />
        )}
      </main>



      {/* Fullscreen Quick Launcher Overlay */}
      {isLauncherOpen && (
        <div className="quick-launcher-overlay" onClick={() => setIsLauncherOpen(false)}>
          <div className="quick-launcher-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="quick-launcher-title">機能メニュー</h2>
            <div className="quick-launcher-grid">
              <button 
                type="button" 
                className={`menu-button ${activeTab === 'portal' ? 'active' : ''}`}
                onClick={() => { setActiveTab('portal'); setIsLauncherOpen(false); }}
              >
                <PortalIcon size={28} />
                <span className="menu-text">ポータル</span>
              </button>
              <button 
                type="button" 
                className={`menu-button ${activeTab === 'stocks' ? 'active' : ''}`}
                onClick={() => { setActiveTab('stocks'); setIsLauncherOpen(false); }}
              >
                <StockIcon size={28} />
                <span className="menu-text">在庫</span>
              </button>
              <button 
                type="button" 
                className={`menu-button ${activeTab === 'attendance' ? 'active' : ''}`}
                onClick={() => { setActiveTab('attendance'); setIsLauncherOpen(false); }}
              >
                <AttendanceIcon size={28} />
                <span className="menu-text">勤怠</span>
              </button>
              <button 
                type="button" 
                className={`menu-button ${activeTab === 'billing' ? 'active' : ''}`}
                onClick={() => { setActiveTab('billing'); setIsLauncherOpen(false); }}
              >
                <BillingIcon size={28} />
                <span className="menu-text">売上</span>
              </button>
              <button 
                type="button" 
                className={`menu-button ${activeTab === 'members' ? 'active' : ''}`}
                onClick={() => { setActiveTab('members'); setIsLauncherOpen(false); }}
              >
                <MemberIcon size={28} />
                <span className="menu-text">メンバー</span>
              </button>
              <button 
                type="button" 
                className={`menu-button ${activeTab === 'masters' ? 'active' : ''}`}
                onClick={() => { setActiveTab('masters'); setIsLauncherOpen(false); }}
              >
                <MasterIcon size={28} />
                <span className="menu-text">管理</span>
              </button>
              <button 
                type="button" 
                className={`menu-button ${activeTab === 'customers' ? 'active' : ''}`}
                onClick={() => { setActiveTab('customers'); setIsLauncherOpen(false); }}
              >
                <CustomerIcon size={28} />
                <span className="menu-text">顧客</span>
              </button>
              <button 
                type="button" 
                className={`menu-button ${activeTab === 'projects' ? 'active' : ''}`}
                onClick={() => { setActiveTab('projects'); setIsLauncherOpen(false); }}
              >
                <ProjectIcon size={28} />
                <span className="menu-text">プロジェクト</span>
              </button>
              <button 
                type="button" 
                className={`menu-button ${activeTab === 'tasks' ? 'active' : ''}`}
                onClick={() => { setActiveTab('tasks'); setIsLauncherOpen(false); }}
              >
                <TaskIcon size={28} />
                <span className="menu-text">タスク</span>
              </button>
              <button 
                type="button" 
                className={`menu-button ${activeTab === 'orders' ? 'active' : ''}`}
                onClick={() => { setActiveTab('orders'); setIsLauncherOpen(false); }}
              >
                <OrderIcon size={28} />
                <span className="menu-text">注文管理</span>
              </button>
              <button 
                type="button" 
                className={`menu-button ${activeTab === 'catalog_edit' ? 'active' : ''}`}
                onClick={() => { setActiveTab('catalog_edit'); setIsLauncherOpen(false); }}
              >
                <CatalogIcon size={28} />
                <span className="menu-text">メニュー</span>
              </button>
              {addons.includes('purchase_order') && (
                <button 
                  type="button" 
                  className={`menu-button ${activeTab === 'purchase_orders' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('purchase_orders'); setIsLauncherOpen(false); }}
                >
                  <PurchaseIcon size={28} />
                  <span className="menu-text">発注</span>
                </button>
              )}
              <button 
                type="button" 
                className={`menu-button ${activeTab === 'workflows' ? 'active' : ''}`}
                onClick={() => { setActiveTab('workflows'); setIsLauncherOpen(false); }}
              >
                <WorkflowIcon size={28} />
                <span className="menu-text">申請・報告</span>
              </button>
              {user?.role === 'admin' && (
                <button 
                  type="button" 
                  className={`menu-button ${activeTab === 'workflow_settings' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('workflow_settings'); setIsLauncherOpen(false); }}
                >
                  <SettingIcon size={28} />
                  <span className="menu-text">申請設定</span>
                </button>
              )}
            </div>
            <button 
              type="button" 
              className="quick-launcher-close-btn"
              onClick={() => setIsLauncherOpen(false)}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

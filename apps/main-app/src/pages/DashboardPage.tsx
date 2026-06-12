import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { Input } from '../components/ui/Input';
import { NumberInput } from '../components/ui/NumberInput';
import { Switch } from '../components/ui/Switch';

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
    fetchWithAuth 
  } = useAuth();

  // Portal & navigation states
  const [activeTab, setActiveTab] = useState<'portal' | 'stocks' | 'attendance' | 'billing'>('portal');
  const [isLauncherOpen, setIsLauncherOpen] = useState<boolean>(false);
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

  // Stocks and filtering states
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [keyword, setKeyword] = useState<string>('');
  const [loadingStocks, setLoadingStocks] = useState<boolean>(true);
  
  // Setup organization name state
  const [newOrgName, setNewOrgName] = useState<string>('');
  const [submittingOrg, setSubmittingOrg] = useState<boolean>(false);

  // New stock item modal states
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newProductName, setNewProductName] = useState<string>('');
  const [newProductCode, setNewProductCode] = useState<string>('');
  const [newQuantity, setNewQuantity] = useState<number>(0);
  const [newMinQuantity, setNewMinQuantity] = useState<number>(0);
  const [submittingStock, setSubmittingStock] = useState<boolean>(false);

  // Expand row states for inline operations
  const [expandedStockId, setExpandedStockId] = useState<number | null>(null);
  const toggleExpandRow = (id: number) => {
    setExpandedStockId(prev => prev === id ? null : id);
  };
  const [opInflowQty, setOpInflowQty] = useState<string>('');
  const [opOutflowQty, setOpOutflowQty] = useState<string>('');
  const [opStocktakeQty, setOpStocktakeQty] = useState<string>('');

  // Passkey state
  const [passkeyAlias, setPasskeyAlias] = useState<string>('');
  const [registeringPasskey, setRegisteringPasskey] = useState<boolean>(false);
  const [showSecurityPanel, setShowSecurityPanel] = useState<boolean>(false);

  // Toast system
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  // Fetch stocks with optional search keyword
  const fetchStocks = async (searchKeyword = '') => {
    try {
      const res = await fetchWithAuth(`/api/stocks?keyword=${encodeURIComponent(searchKeyword)}`);
      if (res.ok) {
        const payload = await res.json();
        setStocks(payload.data || []);
      }
    } catch (e) {
      console.error(e);
      addToast('在庫データの取得に失敗しました。', 'error');
    } finally {
      setLoadingStocks(false);
    }
  };

  // Debounced search trigger
  useEffect(() => {
    setLoadingStocks(true);
    const delay = setTimeout(() => {
      fetchStocks(keyword);
    }, 300);
    return () => clearTimeout(delay);
  }, [keyword, user?.organization_id]);

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

  // Handle Add New Stock Item
  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) return;
    setSubmittingStock(true);

    try {
      const res = await fetchWithAuth('/api/stocks', {
        method: 'POST',
        body: JSON.stringify({
          product_name: newProductName,
          quantity: newQuantity,
          minimum_quantity: newMinQuantity,
          attributes: newProductCode ? { code: newProductCode } : null
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || '商品登録に失敗しました。');
      }

      const newStock = await res.json();
      setStocks(prev => [newStock, ...prev]);
      addToast(`「${newProductName}」を新規登録しました。`);
      
      // Reset form
      setNewProductName('');
      setNewProductCode('');
      setNewQuantity(0);
      setNewMinQuantity(0);
      setShowAddModal(false);
    } catch (err: any) {
      addToast(err.message || '商品の登録に失敗しました。', 'error');
    } finally {
      setSubmittingStock(false);
    }
  };

  // Perform Optimistic stock operation (inflow, outflow, stocktake)
  const handleStockOperation = async (stockId: number, type: 'inflow' | 'outflow' | 'stocktake') => {
    let inputVal = '';
    if (type === 'inflow') inputVal = opInflowQty;
    if (type === 'outflow') inputVal = opOutflowQty;
    if (type === 'stocktake') inputVal = opStocktakeQty;

    const amount = parseInt(inputVal, 10);
    if (isNaN(amount) || amount < 0 || (type !== 'stocktake' && amount <= 0)) {
      addToast('有効な数量を入力してください。', 'warning');
      return;
    }

    const targetStock = stocks.find(s => s.id === stockId);
    if (!targetStock) return;

    // Outflow safeguard validation
    if (type === 'outflow' && targetStock.quantity < amount) {
      addToast('出庫数が現在の在庫数を超えています。', 'warning');
      return;
    }

    // Save old state for rollback
    const originalStocks = [...stocks];

    // Calculate optimistic new quantity
    let optimisticQuantity = targetStock.quantity;
    if (type === 'inflow') optimisticQuantity += amount;
    if (type === 'outflow') optimisticQuantity = Math.max(0, optimisticQuantity - amount);
    if (type === 'stocktake') optimisticQuantity = amount;

    // Optimistically update UI
    setStocks(prev => prev.map(s => {
      if (s.id === stockId) {
        // Prepare new sparkline log optimistically
        const updatedRecent = [...s.recent_quantities];
        if (updatedRecent.length >= 7) {
          updatedRecent.shift();
        }
        updatedRecent.push(optimisticQuantity);
        
        return { 
          ...s, 
          quantity: optimisticQuantity,
          recent_quantities: updatedRecent
        };
      }
      return s;
    }));

    // Reset operations inputs
    setOpInflowQty('');
    setOpOutflowQty('');
    setOpStocktakeQty('');

    // Call API in background
    try {
      const url = `/api/stocks/${stockId}/${type === 'stocktake' ? 'stocktake' : type}`;
      const method = type === 'stocktake' ? 'PUT' : 'POST';
      const body = JSON.stringify({ quantity: amount });

      const res = await fetchWithAuth(url, { method, body });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || '操作に失敗しました。');
      }

      const updatedStock = await res.json();
      // Replace with actual server response (which includes final logs/calculations)
      setStocks(prev => prev.map(s => s.id === stockId ? updatedStock : s));
      
      const opMsg = type === 'inflow' ? '入庫' : type === 'outflow' ? '出庫' : '棚卸';
      addToast(`「${targetStock.product_name}」の${opMsg}処理が完了しました。`);
    } catch (err: any) {
      console.error(err);
      // Rollback to original state on failure
      setStocks(originalStocks);
      addToast(err.message || '在庫操作中にエラーが発生しました。変更をロールバックしました。', 'error');
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

  // Sparkline SVG generator
  const renderSparkline = (quantities: number[]) => {
    if (!quantities || quantities.length === 0) {
      return <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>記録なし</span>;
    }
    
    // Reverse because backend returns latest first, and we want oldest -> newest (left -> right)
    // Actually, backend: logs()->latest('id')->limit(7)->get()->reverse()->pluck('new_quantity')
    // Wait, the backend already does `reverse()`, so it is already oldest to newest (chronological)!
    // Let's verify: `logs()->latest('id')->limit(7)` gets latest 7 (e.g. log 10, 9, 8, 7, 6, 5, 4).
    // Then `->get()->reverse()` reverses it to (log 4, 5, 6, 7, 8, 9, 10), which is oldest to newest!
    // So the quantities array is already oldest to newest. We don't need to reverse it again.
    const qArray = quantities;
    const minVal = Math.min(...qArray);
    const maxVal = Math.max(...qArray);
    const range = maxVal - minVal === 0 ? 1 : maxVal - minVal;
    
    const width = 100;
    const height = 30;
    const padding = 3;
    
    const points = qArray.map((val, idx) => {
      const x = qArray.length === 1 
        ? width / 2 
        : (idx / (qArray.length - 1)) * (width - padding * 2) + padding;
      const y = height - ((val - minVal) / range) * (height - padding * 2) - padding;
      return `${x},${y}`;
    });

    const pathD = qArray.length === 1 
      ? `M ${padding},${height/2} L ${width - padding},${height/2}`
      : `M ${points.join(' L ')}`;

    return (
      <div className="sparkline-container" title={`履歴: ${qArray.join(' → ')}`}>
        <svg className="sparkline-svg" viewBox={`0 0 ${width} ${height}`}>
          <path className="sparkline-glow" d={pathD} />
          <path className="sparkline-path" d={pathD} />
          {qArray.length > 1 && points.map((pt, idx) => {
            const [x, y] = pt.split(',');
            return <circle key={idx} cx={x} cy={y} r="2.5" className="sparkline-dots" />;
          })}
        </svg>
      </div>
    );
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
            <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : '⚠️'}</span>
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
              <span className="nav-tab-icon">🏠</span>
              <span className="nav-tab-label">ポータル</span>
            </button>
            <button 
              type="button" 
              className={`nav-tab-item ${activeTab === 'stocks' ? 'active' : ''}`}
              onClick={() => setActiveTab('stocks')}
            >
              <span className="nav-tab-icon">📦</span>
              <span className="nav-tab-label">在庫管理</span>
            </button>
            <button 
              type="button" 
              className={`nav-tab-item ${activeTab === 'attendance' ? 'active' : ''}`}
              onClick={() => setActiveTab('attendance')}
            >
              <span className="nav-tab-icon">👥</span>
              <span className="nav-tab-label">勤怠管理</span>
            </button>
            <button 
              type="button" 
              className={`nav-tab-item ${activeTab === 'billing' ? 'active' : ''}`}
              onClick={() => setActiveTab('billing')}
            >
              <span className="nav-tab-icon">📄</span>
              <span className="nav-tab-label">売上管理</span>
            </button>
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
              🏠
            </button>
            <span style={{ color: 'var(--text-muted)', margin: '0 0.25rem' }}>|</span>
            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
              {activeTab === 'portal' && '🏠 ポータル'}
              {activeTab === 'stocks' && '📦 在庫'}
              {activeTab === 'attendance' && '👥 勤怠'}
              {activeTab === 'billing' && '📄 売上'}
            </span>
          </div>
        </div>
        
        <div className="nav-actions">
          {user && (
            <div className="nav-user">
              <span>🏢 組織:</span>
              <select 
                className="org-selector"
                value={user.organization_id}
                onChange={(e) => switchOrg(Number(e.target.value))}
              >
                {user.organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name || '未セットアップ'}</option>
                ))}
              </select>

              <span style={{ color: 'var(--text-muted)' }}>|</span>
              
              <span>👤 {user.login_id} ({user.role === 'admin' ? '管理者' : 'スタッフ'})</span>
            </div>
          )}

          <button 
            type="button" 
            className="btn btn-secondary btn-sm"
            onClick={() => setShowSecurityPanel(!showSecurityPanel)}
          >
            🔒 セキュリティ
          </button>

          <ThemeToggle className="btn-sm" />

          <button 
            type="button" 
            className="btn btn-text btn-sm"
            onClick={logout}
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="dashboard-content">
        {/* Passkey Settings Collapsible Panel */}
        {showSecurityPanel && (
          <div className="section-card" style={{ animation: 'slideDown 0.2s ease-out' }}>
            <div className="section-header">
              <h2>🔒 パスキーセキュリティ設定</h2>
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
                  {registeringPasskey ? '登録中...' : '🔑 パスキーを登録する'}
                </button>
              </form>
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
                  <h3>📦 在庫管理</h3>
                  <span className="portal-card-badge status-active">稼働中</span>
                </div>
                <div className="portal-card-content">
                  <div className="health-status-header" style={{ padding: 0 }}>
                    <span>📊 在庫健全性: {healthPercentage}%</span>
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
                  <h3>👥 勤怠管理</h3>
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
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsOnDuty(checked);
                        if (checked) {
                          const now = new Date();
                          setClockInTime(now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }));
                          addToast('出勤打刻を完了しました。', 'success');
                        } else {
                          setClockInTime(null);
                          addToast('退勤打刻を完了しました。今日も一日お疲れ様でした！', 'success');
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
                  <h3>📄 請求・売上管理</h3>
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
            </div>
          </div>
        )}

        {activeTab === 'stocks' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', gap: '1.5rem', animation: 'fadeIn 0.2s ease-out' }}>
            {/* Metrics Row */}
            <div className="metrics-grid">
              <div className="metric-card metric-good">
                <div className="metric-info">
                  <h3>良好な商品数</h3>
                  <div className="metric-value">{goodStocks}</div>
                </div>
                <div className="metric-icon-box">✓</div>
              </div>

              <div className="metric-card metric-warning">
                <div className="metric-info">
                  <h3>警告レベル (しきい値一致)</h3>
                  <div className="metric-value">{warningStocks}</div>
                </div>
                <div className="metric-icon-box">!</div>
              </div>

              <div className="metric-card metric-alert">
                <div className="metric-info">
                  <h3>不足している商品数</h3>
                  <div className="metric-value">{dangerStocks}</div>
                </div>
                <div className="metric-icon-box">✗</div>
              </div>
            </div>

            {/* Health status bar */}
            <div className="health-status-container">
              <div className="health-status-header">
                <span>📊 組織の在庫健全性</span>
                <span className="health-percentage" style={{ color: healthColor }}>
                  {healthPercentage}%
                </span>
              </div>
              <div className="health-bar-bg">
                <div 
                  className="health-bar-fill" 
                  style={{ 
                    width: `${healthPercentage}%`,
                    backgroundColor: healthColor
                  }}
                ></div>
              </div>
            </div>

            {/* Search, Filter & Action Bar */}
            <div className="section-card kiosk-main-card">
              <div className="search-bar">
                <div className="search-input-wrapper">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    className="form-control search-input"
                    placeholder="商品名で検索..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                  />
                </div>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={() => setShowAddModal(true)}
                >
                  ＋ 在庫商品を新規登録
                </button>
              </div>

              {/* Stocks Table */}
              <div className="table-responsive">
                {loadingStocks ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem' }}>
                    <div className="spinner"></div>
                    <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>読み込み中...</p>
                  </div>
                ) : stocks.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">📦</div>
                    <h3>登録されている商品がありません</h3>
                    <p>「在庫商品を新規登録」ボタンから、商品を登録してください。</p>
                  </div>
                ) : (
                  <table className="stock-table">
                    <thead>
                      <tr>
                        <th>コード</th>
                        <th>商品名</th>
                        <th style={{ textAlign: 'right' }}>在庫数</th>
                        <th style={{ textAlign: 'right' }}>安全しきい値</th>
                        <th>ステータス</th>
                        <th>過去7日間の推移</th>
                        <th style={{ textAlign: 'center' }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stocks.map(stock => {
                        const isGood = stock.quantity > stock.minimum_quantity;
                        const isWarning = stock.quantity === stock.minimum_quantity;
                        const statusClass = isGood 
                          ? 'badge-good' 
                          : isWarning 
                            ? 'badge-warning' 
                            : 'badge-alert';
                        const statusText = isGood 
                          ? '良好' 
                          : isWarning 
                            ? '警告' 
                            : '不足';

                        const isExpanded = expandedStockId === stock.id;

                        return (
                          <React.Fragment key={stock.id}>
                            <tr>
                              <td style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem' }}>
                                {stock.attributes?.code || `#${stock.id}`}
                              </td>
                              <td style={{ fontWeight: 500, color: 'var(--text-main)' }}>
                                {stock.product_name}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '1.05rem' }}>
                                {stock.quantity}
                              </td>
                              <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                                {stock.minimum_quantity}
                              </td>
                              <td>
                                <span className={`badge ${statusClass}`}>{statusText}</span>
                              </td>
                              <td>
                                {renderSparkline(stock.recent_quantities)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-xs"
                                  onClick={() => toggleExpandRow(stock.id)}
                                >
                                  {isExpanded ? '閉じる ▲' : '操作 ▼'}
                                </button>
                              </td>
                            </tr>
                            
                            {/* Expanded details row for inflow, outflow, stocktake */}
                            {isExpanded && (
                              <tr className="operations-tr">
                                <td colSpan={7} className="operations-td">
                                  <div className="operations-panel">
                                    {/* Inflow Box */}
                                    <div className="operation-box">
                                      <h4>📥 入庫処理</h4>
                                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <NumberInput
                                          min={1}
                                          value={opInflowQty}
                                          onChange={(e) => setOpInflowQty(e.target.value)}
                                          placeholder="数量"
                                          containerStyle={{ flex: 1 }}
                                        />
                                        <button
                                          type="button"
                                          className="btn btn-primary btn-sm"
                                          onClick={() => handleStockOperation(stock.id, 'inflow')}
                                        >
                                          入庫
                                        </button>
                                      </div>
                                    </div>

                                    {/* Outflow Box */}
                                    <div className="operation-box">
                                      <h4>📤 出庫処理</h4>
                                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <NumberInput
                                          min={1}
                                          value={opOutflowQty}
                                          onChange={(e) => setOpOutflowQty(e.target.value)}
                                          placeholder="数量"
                                          containerStyle={{ flex: 1 }}
                                        />
                                        <button
                                          type="button"
                                          className="btn btn-danger btn-sm"
                                          onClick={() => handleStockOperation(stock.id, 'outflow')}
                                        >
                                          出庫
                                        </button>
                                      </div>
                                    </div>

                                    {/* Stocktake Box */}
                                    <div className="operation-box">
                                      <h4>📝 実在庫の棚卸</h4>
                                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <NumberInput
                                          min={0}
                                          value={opStocktakeQty}
                                          onChange={(e) => setOpStocktakeQty(e.target.value)}
                                          placeholder="確定在庫数"
                                          containerStyle={{ flex: 1 }}
                                        />
                                        <button
                                          type="button"
                                          className="btn btn-secondary btn-sm"
                                          onClick={() => handleStockOperation(stock.id, 'stocktake')}
                                          style={{ border: '1px solid var(--text-muted)' }}
                                        >
                                          確定
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="section-card kiosk-main-card" style={{ padding: '2rem', animation: 'fadeIn 0.2s ease-out' }}>
            <div className="section-header">
              <h2>👥 勤怠管理システム</h2>
              <span className={`badge ${isOnDuty ? 'badge-good' : 'badge-alert'}`}>
                {isOnDuty ? '勤務中' : '勤務外'}
              </span>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
              <div style={{ fontSize: '3.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-main)' }}>
                {currentTime || '00:00:00'}
              </div>
              <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', padding: '2.5rem 4rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ margin: 0 }}>現在の状態: {isOnDuty ? '勤務中 (打刻済み)' : '勤務外'}</h3>
                <Switch
                  label={isOnDuty ? '打刻を解除 (退勤)' : '打刻を開始 (出勤)'}
                  checked={isOnDuty}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsOnDuty(checked);
                    if (checked) {
                      const now = new Date();
                      setClockInTime(now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }));
                      addToast('出勤打刻を完了しました。', 'success');
                    } else {
                      setClockInTime(null);
                      addToast('退勤打刻を完了しました。今日も一日お疲れ様でした！', 'success');
                    }
                  }}
                />
                {isOnDuty && clockInTime && (
                  <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>
                    出勤時刻: <strong>{clockInTime}</strong>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'billing' && (
          <div className="section-card kiosk-main-card" style={{ padding: '2rem', animation: 'fadeIn 0.2s ease-out' }}>
            <div className="section-header">
              <h2>📄 請求・売上管理システム</h2>
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
      </main>

      {/* Add Stock Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>📦 在庫商品の新規登録</h2>
              <p>新しく倉庫・組織に登録する在庫商品の基本情報を入力してください。</p>
            </div>
            
            <form onSubmit={handleAddStock} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Input
                id="productName"
                type="text"
                label="商品名 (必須)"
                placeholder="例: ノートパソコン Core i7"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                required
                containerClassName="form-group"
              />

              <Input
                id="productCode"
                type="text"
                label="商品コード (オプション)"
                placeholder="例: PC-001"
                value={newProductCode}
                onChange={(e) => setNewProductCode(e.target.value)}
                containerClassName="form-group"
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <NumberInput
                  id="initialQty"
                  label="初期在庫数"
                  min={0}
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(parseInt(e.target.value, 10) || 0)}
                  containerClassName="form-group"
                />

                <NumberInput
                  id="minQty"
                  label="安全しきい値 (警告ライン)"
                  min={0}
                  value={newMinQuantity}
                  onChange={(e) => setNewMinQuantity(parseInt(e.target.value, 10) || 0)}
                  containerClassName="form-group"
                />
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowAddModal(false)}
                  disabled={submittingStock}
                >
                  キャンセル
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submittingStock}
                >
                  {submittingStock ? '登録中...' : '登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fullscreen Quick Launcher Overlay */}
      {isLauncherOpen && (
        <div className="quick-launcher-overlay" onClick={() => setIsLauncherOpen(false)}>
          <div className="quick-launcher-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="quick-launcher-title">機能メニュー</h2>
            <div className="quick-launcher-grid">
              <button 
                type="button" 
                className={`quick-launcher-item ${activeTab === 'portal' ? 'active' : ''}`}
                onClick={() => { setActiveTab('portal'); setIsLauncherOpen(false); }}
              >
                <span className="quick-launcher-icon">🏠</span>
                <span className="quick-launcher-name">総合ポータル</span>
              </button>
              <button 
                type="button" 
                className={`quick-launcher-item ${activeTab === 'stocks' ? 'active' : ''}`}
                onClick={() => { setActiveTab('stocks'); setIsLauncherOpen(false); }}
              >
                <span className="quick-launcher-icon">📦</span>
                <span className="quick-launcher-name">在庫管理</span>
              </button>
              <button 
                type="button" 
                className={`quick-launcher-item ${activeTab === 'attendance' ? 'active' : ''}`}
                onClick={() => { setActiveTab('attendance'); setIsLauncherOpen(false); }}
              >
                <span className="quick-launcher-icon">👥</span>
                <span className="quick-launcher-name">勤怠管理</span>
              </button>
              <button 
                type="button" 
                className={`quick-launcher-item ${activeTab === 'billing' ? 'active' : ''}`}
                onClick={() => { setActiveTab('billing'); setIsLauncherOpen(false); }}
              >
                <span className="quick-launcher-icon">📄</span>
                <span className="quick-launcher-name">請求・売上</span>
              </button>
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

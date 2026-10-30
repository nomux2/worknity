import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import type { CatalogConfig, CatalogCategory, CatalogItem } from '../types/catalog';
import { KioskUnlockModal } from '../components/KioskUnlockModal';
import { SuccessIcon } from '../components/ui/Icons';

interface CartItem {
  item: CatalogItem;
  quantity: number;
}

export const CatalogKioskPage: React.FC = () => {
  const { fetchWithAuth, setAuthToken, accessToken } = useAuth();
  
  // Auth and Config States
  const [config, setConfig] = useState<CatalogConfig | null>(null);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  
  // Device Register Form States
  const [deviceCode, setDeviceCode] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>('');
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  
  // Kiosk Logic States
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [currentLanguage, setCurrentLanguage] = useState<string>('ja');
  const [orderSuccess, setOrderSuccess] = useState<boolean>(false);
  const [orderSubmitting, setOrderSubmitting] = useState<boolean>(false);

  // Helper to parse localized text
  const getLocalizedText = (text: any, lang: string = currentLanguage) => {
    if (!text) return '';
    try {
      const parsed = typeof text === 'string' ? JSON.parse(text) : text;
      if (parsed && typeof parsed === 'object') {
        return parsed[lang] || parsed['ja'] || Object.values(parsed)[0] || '';
      }
    } catch (e) {}
    return String(text);
  };

  // Device Auto-login
  useEffect(() => {
    const attemptDeviceLogin = async () => {
      const savedCode = localStorage.getItem('kiosk_device_code');
      const savedToken = localStorage.getItem('kiosk_device_token');

      if (!savedCode || !savedToken) {
        // If not registered and not logged in as normal user, show registration form
        if (!accessToken) {
          setIsRegisterMode(true);
          setLoading(false);
          return;
        }
        // If logged in as normal user (e.g. during setup), allow checking config
      } else {
        try {
          const res = await fetch('/api/catalog/devices/auth', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({ device_code: savedCode, access_token: savedToken }),
          });

          if (res.ok) {
            const data = await res.json();
            await setAuthToken(data.access_token);
          } else {
            setError('端末認証に失敗しました。端末情報を再設定してください。');
            setIsRegisterMode(true);
          }
        } catch (err) {
          setError('ネットワーク接続を確認してください。');
        }
      }
    };

    attemptDeviceLogin();
  }, [accessToken, setAuthToken]);

  // Load Menu and Config when authorized
  useEffect(() => {
    if (!accessToken) return;

    const loadCatalogData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Config
        const configRes = await fetchWithAuth('/api/catalog/config');
        if (configRes.ok) {
          const configData = await configRes.json();
          setConfig(configData.data);
        }

        // 2. Fetch Catalog Items
        const menuRes = await fetchWithAuth('/api/catalog/categories');
        if (menuRes.ok) {
          const menuData = await menuRes.json();
          const cats: CatalogCategory[] = menuData.data;
          setCategories(cats);
          if (cats.length > 0) {
            setSelectedCategoryId(cats[0].id);
          }
        }
      } catch (err) {
        setError('データの読み込みに失敗しました。');
      } finally {
        setLoading(false);
      }
    };

    loadCatalogData();
  }, [accessToken, fetchWithAuth]);

  // Handle manual device registration (for setup)
  const handleDeviceRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName || !deviceCode) {
      setError('すべてのフィールドを入力してください。');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Register device on backend
      const res = await fetchWithAuth('/api/catalog/devices/register', {
        method: 'POST',
        body: JSON.stringify({
          name: deviceName,
          device_code: deviceCode,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // 2. Save token and code locally
        localStorage.setItem('kiosk_device_code', deviceCode);
        localStorage.setItem('kiosk_device_token', data.data.access_token);
        
        // 3. Login as device
        const authRes = await fetch('/api/catalog/devices/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ device_code: deviceCode, access_token: data.data.access_token }),
        });

        if (authRes.ok) {
          const authData = await authRes.json();
          await setAuthToken(authData.access_token);
          setIsRegisterMode(false);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.message || '登録に失敗しました。認証されたスタッフアカウントでログインしているか確認してください。');
      }
    } catch (err) {
      setError('通信エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  // Cart operations
  const addToCart = (item: CatalogItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        return prev.map(i => i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const updateCartQty = (itemId: number, change: number) => {
    setCart(prev => {
      return prev.map(i => {
        if (i.item.id === itemId) {
          const nextQty = i.quantity + change;
          return nextQty > 0 ? { ...i, quantity: nextQty } : null;
        }
        return i;
      }).filter(Boolean) as CartItem[];
    });
  };

  // Send Order
  const submitOrder = async () => {
    if (cart.length === 0) return;

    setOrderSubmitting(true);
    const orderItems = cart.map(i => ({ id: i.item.id, quantity: i.quantity }));

    // Keep rollback copy of cart
    const previousCart = [...cart];

    try {
      const res = await fetchWithAuth('/api/catalog/orders', {
        method: 'POST',
        body: JSON.stringify({ items: orderItems }),
      });

      if (res.ok) {
        setCart([]);
        setOrderSuccess(true);
        // Clear success screen after 3 seconds
        setTimeout(() => setOrderSuccess(false), 3000);
      } else {
        // Rollback on fail
        setCart(previousCart);
        alert('注文の送信に失敗しました。もう一度送信してください。');
      }
    } catch (err) {
      setCart(previousCart);
      alert('通信エラーが発生しました。接続を確認してください。');
    } finally {
      setOrderSubmitting(false);
    }
  };

  // Kiosk Exit Callback
  const handleKioskUnlockSuccess = () => {
    localStorage.removeItem('kiosk_device_code');
    localStorage.removeItem('kiosk_device_token');
    window.location.pathname = '/'; // Redirect back to normal layout dashboard
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        height: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1e1e2e',
        color: '#cdd6f4',
        fontSize: '1.25rem',
      }}>
        読み込み中...
      </div>
    );
  }

  // Initial Device Setup Form
  if (isRegisterMode) {
    return (
      <div style={{
        display: 'flex',
        height: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1e1e2e',
        padding: '20px',
        color: '#cdd6f4',
      }}>
        <div style={{
          background: '#252538',
          border: '1px solid #313244',
          borderRadius: '16px',
          padding: '32px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: 600 }}>端末の初期接続設定</h2>
          <p style={{ margin: '0 0 24px 0', fontSize: '0.875rem', color: '#a6adc8' }}>
            客席や個室のタブレットとして利用するために、本端末を登録します。※操作にはスタッフアカウントの認証状態が必要です。
          </p>

          {error && (
            <div style={{
              background: 'rgba(243, 139, 168, 0.1)',
              border: '1px solid #f38ba8',
              color: '#f38ba8',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '20px',
              fontSize: '0.875rem',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleDeviceRegister}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500 }}>
                端末の呼称番号 (例: テーブル 1, 302号室)
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={e => setDeviceName(e.target.value)}
                placeholder="テーブル 5"
                style={{
                  width: '100%',
                  height: '44px',
                  background: '#181825',
                  border: '1px solid #45475a',
                  borderRadius: '8px',
                  padding: '0 12px',
                  color: '#cdd6f4',
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500 }}>
                端末識別コード (英数字のユニークID)
              </label>
              <input
                type="text"
                value={deviceCode}
                onChange={e => setDeviceCode(e.target.value)}
                placeholder="table-05-device"
                style={{
                  width: '100%',
                  height: '44px',
                  background: '#181825',
                  border: '1px solid #45475a',
                  borderRadius: '8px',
                  padding: '0 12px',
                  color: '#cdd6f4',
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                height: '48px',
                background: '#a6e3a1',
                color: '#11111b',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              端末を登録して接続
            </button>
          </form>

          {accessToken && (
            <button
              onClick={() => { window.location.pathname = '/'; }}
              style={{
                width: '100%',
                height: '44px',
                background: 'transparent',
                color: '#cdd6f4',
                border: '1px solid #45475a',
                borderRadius: '8px',
                marginTop: '12px',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              キャンセルして戻る
            </button>
          )}
        </div>
      </div>
    );
  }

  // Order Success Screen Overlay
  if (orderSuccess) {
    return (
      <div style={{
        display: 'flex',
        height: '100vh',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1e1e2e',
        color: '#a6e3a1',
        textAlign: 'center',
      }}>
        <div style={{ marginBottom: '16px' }}><SuccessIcon size={64} /></div>
        <h2 style={{ fontSize: '2rem', fontWeight: 600, margin: '0 0 8px 0' }}>送信が完了しました</h2>
        <p style={{ color: '#a6adc8', fontSize: '1.125rem' }}>まもなく対応いたしますので、そのままでお待ちください。</p>
      </div>
    );
  }

  const activeCategory = categories.find(c => c.id === selectedCategoryId);
  const showPrice = config ? config.show_price : true;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#181825',
      color: '#cdd6f4',
      overflow: 'hidden',
    }}>
      {/* Kiosk Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        background: '#11111b',
        borderBottom: '1px solid #313244',
      }}>
        {/* Categories Tab Bar */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', flex: 1, paddingRight: '16px' }}>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              style={{
                height: '48px',
                padding: '0 20px',
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: '8px',
                border: 'none',
                background: selectedCategoryId === cat.id ? '#cba6f7' : '#313244',
                color: selectedCategoryId === cat.id ? '#11111b' : '#cdd6f4',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
            >
              {getLocalizedText(cat.name)}
            </button>
          ))}
        </div>

        {/* Language Selection and Exit lock button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <select
            value={currentLanguage}
            onChange={e => setCurrentLanguage(e.target.value)}
            style={{
              height: '44px',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1px solid #45475a',
              background: '#313244',
              color: '#cdd6f4',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            <option value="ja">日本語</option>
            <option value="en">English</option>
          </select>

          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              height: '44px',
              padding: '0 14px',
              borderRadius: '8px',
              border: '1px solid #f38ba8',
              background: 'transparent',
              color: '#f38ba8',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            解除
          </button>
        </div>
      </header>

      {/* Item Grid Grid Container */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '20px',
        alignContent: 'start',
      }}>
        {activeCategory?.items && activeCategory.items.length > 0 ? (
          activeCategory.items.map(item => (
            <div
              key={item.id}
              style={{
                background: '#1e1e2e',
                border: '1px solid #313244',
                borderRadius: '12px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
              }}
            >
              <div style={{
                height: '140px',
                background: item.image_path ? `url(${item.image_path}) center/cover` : '#313244',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#585b70',
                fontSize: '0.85rem',
                fontWeight: 600,
                letterSpacing: '0.05em',
              }}>
                {!item.image_path && 'NO IMAGE'}
              </div>

              <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '1.125rem', fontWeight: 600 }}>
                  {getLocalizedText(item.name)}
                </h4>
                <p style={{
                  margin: '0 0 16px 0',
                  fontSize: '0.85rem',
                  color: '#a6adc8',
                  flex: 1,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {getLocalizedText(item.description)}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {showPrice && item.price !== null ? (
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f9e2af' }}>
                      ¥{item.price.toLocaleString()}
                    </span>
                  ) : (
                    <span></span>
                  )}

                  <button
                    onClick={() => addToCart(item)}
                    style={{
                      height: '40px',
                      padding: '0 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#a6e3a1',
                      color: '#11111b',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    追加
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: '#a6adc8' }}>
            このカテゴリには掲載アイテムがありません。
          </div>
        )}
      </main>

      {/* Cart Drawer / Floating Bar */}
      {cart.length > 0 && (
        <div style={{
          background: '#11111b',
          borderTop: '2px solid #313244',
          padding: '16px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 -8px 24px rgba(0,0,0,0.3)',
        }}>
          {/* Cart Contents Row */}
          <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
            {cart.map(c => (
              <div
                key={c.item.id}
                style={{
                  background: '#1e1e2e',
                  border: '1px solid #45475a',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{getLocalizedText(c.item.name)}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => updateCartQty(c.item.id, -1)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      border: 'none',
                      background: '#313244',
                      color: '#cdd6f4',
                      fontSize: '1rem',
                      cursor: 'pointer',
                    }}
                  >
                    -
                  </button>
                  <span style={{ fontWeight: 'bold' }}>{c.quantity}</span>
                  <button
                    onClick={() => addToCart(c.item)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      border: 'none',
                      background: '#313244',
                      color: '#cdd6f4',
                      fontSize: '1rem',
                      cursor: 'pointer',
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              {showPrice ? (
                <span style={{ fontSize: '1.25rem' }}>
                  合計金額:{' '}
                  <strong style={{ fontSize: '1.5rem', color: '#f9e2af' }}>
                    ¥
                    {cart.reduce((sum, c) => sum + (c.item.price || 0) * c.quantity, 0).toLocaleString()}
                  </strong>
                </span>
              ) : (
                <span style={{ fontSize: '1rem', color: '#a6adc8' }}>
                  選択中: <strong>{cart.reduce((sum, c) => sum + c.quantity, 0)} 件</strong> のリクエスト
                </span>
              )}
            </div>

            <button
              onClick={submitOrder}
              disabled={orderSubmitting}
              style={{
                height: '48px',
                padding: '0 32px',
                fontSize: '1.125rem',
                fontWeight: 600,
                borderRadius: '8px',
                border: 'none',
                background: '#cba6f7',
                color: '#11111b',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(203, 166, 247, 0.3)',
              }}
            >
              {orderSubmitting ? '送信中...' : '注文を確定する'}
            </button>
          </div>
        </div>
      )}

      {/* Unlock Code Pad Modal */}
      <KioskUnlockModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUnlockSuccess={handleKioskUnlockSuccess}
        fetchWithAuth={fetchWithAuth}
      />
    </div>
  );
};

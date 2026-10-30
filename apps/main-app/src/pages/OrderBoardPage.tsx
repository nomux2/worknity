import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Order, CatalogConfig } from '../types/catalog';

export const OrderBoardPage: React.FC = () => {
  const { fetchWithAuth } = useAuth();
  
  // Data States
  const [orders, setOrders] = useState<Order[]>([]);
  const [config, setConfig] = useState<CatalogConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  
  // Auto-refresh timer reference
  const pollingRef = useRef<any>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Ref to play notification sound
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousOrdersCount = useRef<number>(0);

  // Helper to format localized text
  const getLocalizedText = (text: any, lang: string = 'ja') => {
    if (!text) return '';
    try {
      const parsed = typeof text === 'string' ? JSON.parse(text) : text;
      if (parsed && typeof parsed === 'object') {
        return parsed[lang] || parsed['ja'] || Object.values(parsed)[0] || '';
      }
    } catch (e) {}
    return String(text);
  };

  // Fetch all active orders and configurations
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // 1. Fetch config to know device labels (e.g. 'テーブル', '部屋')
      const configRes = await fetchWithAuth('/api/catalog/config');
      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData.data);
      }

      // 2. Fetch active orders
      const ordersRes = await fetchWithAuth('/api/catalog/orders');
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        const activeOrders: Order[] = ordersData.data;

        // Play audio alert if there are NEW incoming orders
        const currentOrderedCount = activeOrders.filter(o => o.status === 'ordered').length;
        if (silent && currentOrderedCount > previousOrdersCount.current) {
          playAlertSound();
        }
        previousOrdersCount.current = currentOrderedCount;

        setOrders(activeOrders);
      }
    } catch (err) {
      setError('注文データの更新に失敗しました。');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const playAlertSound = () => {
    try {
      if (audioRef.current) {
        audioRef.current.play().catch(() => {});
      }
    } catch (e) {}
  };

  // Initial mount: load data and set timers
  useEffect(() => {
    loadData();

    // 1. Polling for new orders every 5 seconds
    pollingRef.current = setInterval(() => {
      loadData(true);
    }, 5000);

    // 2. Clock timer to update elapsed time labels every 30 seconds
    const clockTimer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      clearInterval(clockTimer);
    };
  }, []);

  // Update Status with Optimistic UI & Rollback
  const updateOrderStatus = async (orderId: number, nextStatus: 'ordered' | 'preparing' | 'served') => {
    // Hold reference for rollback
    const originalOrders = [...orders];

    // Optimistic Update: Move or modify status immediately
    setOrders(prev => {
      if (nextStatus === 'served') {
        // If served, remove from active board
        return prev.filter(o => o.id !== orderId);
      }
      return prev.map(o => o.id === orderId ? { ...o, status: nextStatus } : o);
    });

    try {
      const res = await fetchWithAuth(`/api/catalog/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) {
        // Rollback on fail
        setOrders(originalOrders);
        alert('ステータスの更新に失敗しました。');
      }
    } catch (err) {
      setOrders(originalOrders);
      alert('通信エラーが発生しました。');
    }
  };

  // Calculate elapsed time in minutes
  const getElapsedTime = (createdAtStr: string): number => {
    const created = new Date(createdAtStr);
    const diffMs = currentTime.getTime() - created.getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  };

  // Alert colors based on elapsed minutes
  const getAlertStyle = (minutes: number): React.CSSProperties => {
    if (minutes >= 10) {
      return { border: '2px solid var(--color-danger-border)', boxShadow: '0 0 10px var(--color-danger-bg)' }; // Red alert
    }
    if (minutes >= 5) {
      return { border: '2px solid var(--color-warning-border)', boxShadow: '0 0 10px var(--color-warning-bg)' }; // Yellow alert
    }
    return { border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)' };
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '80vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        読み込み中...
      </div>
    );
  }

  const deviceLabel = config ? config.device_label : 'テーブル';
  const showPrice = config ? config.show_price : true;

  // Filter orders by lane status
  const orderedList = orders.filter(o => o.status === 'ordered');
  const preparingList = orders.filter(o => o.status === 'preparing');

  return (
    <div style={{ padding: '24px', height: 'calc(100vh - 72px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', color: 'var(--text-main)' }}>
      {/* Audio Element for Notification sound */}
      <audio
        ref={audioRef}
        src="https://assets.mixkit.co/active_storage/sfx/2019/2019-84.wav"
        preload="auto"
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
          注文管理ボード
        </h2>
        <button
          onClick={() => loadData()}
          className="btn btn-secondary"
        >
          更新
        </button>
      </div>

      {error && (
        <div style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger-text)', borderRadius: 'var(--border-radius-sm)', padding: '12px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* Kanban Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flex: 1, overflow: 'hidden' }}>
        {/* Column 1: Ordered (Unresolved / New) */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-hover)', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border-color)', padding: '16px', overflow: 'hidden' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', fontWeight: 600, color: 'var(--color-warning-text)', display: 'flex', justifyContent: 'space-between' }}>
            <span>未対応 (ordered)</span>
            <span style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.875rem' }}>{orderedList.length}</span>
          </h3>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '4px' }}>
            {orderedList.map(order => {
              const elapsed = getElapsedTime(order.created_at);
              return (
                <div
                  key={order.id}
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--border-radius-sm)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.2s ease',
                    ...getAlertStyle(elapsed),
                  }}
                >
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>
                      {order.device?.name}番 {deviceLabel}
                    </strong>
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: elapsed >= 10 ? 'var(--color-danger-text)' : elapsed >= 5 ? 'var(--color-warning-text)' : 'var(--text-muted)'
                    }}>
                      {elapsed}分経過
                    </span>
                  </div>

                  {/* Card Items details */}
                  <div style={{ flex: 1, fontSize: '0.95rem', marginBottom: '16px', color: 'var(--text-main)' }}>
                    {order.items?.map(i => (
                      <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border-color)' }}>
                        <span>・{getLocalizedText(i.item?.name)}</span>
                        <strong>× {i.quantity}</strong>
                      </div>
                    ))}
                  </div>

                  {/* Footer details & Action */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {showPrice && order.total_price !== null ? (
                      <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-warning-text)' }}>
                        合計: ¥{order.total_price.toLocaleString()}
                      </span>
                    ) : (
                      <span></span>
                    )}

                    <button
                      onClick={() => updateOrderStatus(order.id, 'preparing')}
                      className="btn btn-primary"
                      style={{ fontSize: '0.875rem', padding: '0.4rem 1rem' }}
                    >
                      対応開始
                    </button>
                  </div>
                </div>
              );
            })}
            {orderedList.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>新規の注文はありません。</div>
            )}
          </div>
        </div>

        {/* Column 2: Preparing (In progress) */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-hover)', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border-color)', padding: '16px', overflow: 'hidden' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', fontWeight: 600, color: 'var(--primary)', display: 'flex', justifyContent: 'space-between' }}>
            <span>対応中 (preparing)</span>
            <span style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.875rem' }}>{preparingList.length}</span>
          </h3>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '4px' }}>
            {preparingList.map(order => {
              const elapsed = getElapsedTime(order.created_at);
              return (
                <div
                  key={order.id}
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--border-radius-sm)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.2s ease',
                    ...getAlertStyle(elapsed),
                  }}
                >
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>
                      {order.device?.name}番 {deviceLabel}
                    </strong>
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: elapsed >= 10 ? 'var(--color-danger-text)' : elapsed >= 5 ? 'var(--color-warning-text)' : 'var(--text-muted)'
                    }}>
                      {elapsed}分経過
                    </span>
                  </div>

                  {/* Card Items details */}
                  <div style={{ flex: 1, fontSize: '0.95rem', marginBottom: '16px', color: 'var(--text-main)' }}>
                    {order.items?.map(i => (
                      <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border-color)' }}>
                        <span>・{getLocalizedText(i.item?.name)}</span>
                        <strong>× {i.quantity}</strong>
                      </div>
                    ))}
                  </div>

                  {/* Footer details & Action */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {showPrice && order.total_price !== null ? (
                      <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--primary)' }}>
                        合計: ¥{order.total_price.toLocaleString()}
                      </span>
                    ) : (
                      <span></span>
                    )}

                    <button
                      onClick={() => updateOrderStatus(order.id, 'served')}
                      className="btn btn-primary"
                      style={{ fontSize: '0.875rem', padding: '0.4rem 1rem' }}
                    >
                      対応完了
                    </button>
                  </div>
                </div>
              );
            })}
            {preparingList.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>対応中の注文はありません。</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

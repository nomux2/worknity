import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { OrderIcon } from './ui/Icons';

interface PartnerItem {
  id: number;
  name: string;
  address?: string;
  phone?: string;
}

interface StockItem {
  id: number;
  product_name: string;
  price?: number;
  quantity: number;
  minimum_quantity: number;
}

interface PurchaseOrderItemDetails {
  id: number;
  stock_id: number;
  quantity: number;
  received_quantity: number;
  unit_price: number;
  stock: StockItem;
}

interface PurchaseOrderDetails {
  id: number;
  partner_id: number;
  report_id: number | null;
  order_number: string;
  order_date: string;
  delivery_deadline: string | null;
  status: 'draft' | 'ordered' | 'partially_received' | 'completed' | 'cancelled';
  created_by: number;
  created_at: string;
  updated_at: string;
  partner: PartnerItem;
  creator: {
    id: number;
    login_id: string;
  };
  items: PurchaseOrderItemDetails[];
}

interface FormItemInput {
  stock_id: number;
  quantity: number;
  unit_price: number;
}

interface PurchaseOrderManagementProps {
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}

export const PurchaseOrderManagement: React.FC<PurchaseOrderManagementProps> = ({ addToast }) => {
  const { fetchWithAuth, user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // State lists
  const [orders, setOrders] = useState<PurchaseOrderDetails[]>([]);
  const [partners, setPartners] = useState<PartnerItem[]>([]);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(false);

  // Filter/Search states
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Selection state
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrderDetails | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Form states (Create / Edit)
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [formPartnerId, setFormPartnerId] = useState<number>(0);
  const [formOrderDate, setFormOrderDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formDeliveryDeadline, setFormDeliveryDeadline] = useState<string>('');
  const [formReportId, setFormReportId] = useState<string>('');
  const [formItems, setFormItems] = useState<FormItemInput[]>([{ stock_id: 0, quantity: 1, unit_price: 0 }]);
  const [submittingForm, setSubmittingForm] = useState<boolean>(false);

  // Incoming shipment receipt state (分納入力)
  const [isReceiving, setIsReceiving] = useState<boolean>(false);
  const [receiptQuantities, setReceiptQuantities] = useState<{ [itemId: number]: number }>({});
  const [submittingReceipt, setSubmittingReceipt] = useState<boolean>(false);

  // Print Mode state
  const [isPrintPreview, setIsPrintPreview] = useState<boolean>(false);

  // Load lists
  const fetchOrders = useCallback(async () => {
    setLoadingList(true);
    try {
      let url = `/api/purchase-orders?keyword=${encodeURIComponent(searchKeyword)}`;
      if (statusFilter) {
        url += `&status=${statusFilter}`;
      }
      const res = await fetchWithAuth(url);
      if (res.ok) {
        const payload = await res.json();
        setOrders(payload.data || []);
      }
    } catch (e) {
      console.error(e);
      addToast('発注一覧の読み込みに失敗しました。', 'error');
    } finally {
      setLoadingList(false);
    }
  }, [searchKeyword, statusFilter, fetchWithAuth, addToast]);

  const loadPartnersAndStocks = useCallback(async () => {
    try {
      const [partnerRes, stockRes] = await Promise.all([
        fetchWithAuth('/api/partners'),
        fetchWithAuth('/api/stocks?per_page=100')
      ]);

      if (partnerRes.ok) {
        const partnerData = await partnerRes.json();
        setPartners(partnerData.data || []);
      }
      if (stockRes.ok) {
        const stockData = await stockRes.json();
        setStocks(stockData.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    fetchOrders();
    loadPartnersAndStocks();
  }, [fetchOrders, loadPartnersAndStocks]);

  // Load detail
  const fetchOrderDetail = async (id: number) => {
    setLoadingDetail(true);
    try {
      const res = await fetchWithAuth(`/api/purchase-orders/${id}`);
      if (res.ok) {
        const payload = await res.json();
        setSelectedOrder(payload.data);
        setIsReceiving(false);
      } else if (res.status === 404) {
        addToast('発注データが見つかりません。', 'error');
        setSelectedOrder(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Status text mapping
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="badge badge-warning">下書き</span>;
      case 'ordered':
        return <span className="badge status-active" style={{ background: 'var(--status-working)', color: '#fff' }}>発注済</span>;
      case 'partially_received':
        return <span className="badge badge-warning">一部入荷</span>;
      case 'completed':
        return <span className="badge badge-good">入荷完了</span>;
      case 'cancelled':
        return <span className="badge badge-alert">キャンセル</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  // Form handlers
  const handleAddItem = () => {
    setFormItems([...formItems, { stock_id: 0, quantity: 1, unit_price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, key: keyof FormItemInput, value: number) => {
    const updated = [...formItems];
    updated[index] = { ...updated[index], [key]: value };

    // Automatically set price from stock reference if stock_id changes and unit_price is 0
    if (key === 'stock_id' && value > 0) {
      const matched = stocks.find(s => s.id === value);
      if (matched && matched.price) {
        updated[index].unit_price = matched.price;
      }
    }

    setFormItems(updated);
  };

  const handleStartCreate = () => {
    setIsCreating(true);
    setIsEditing(false);
    setFormPartnerId(partners[0]?.id || 0);
    setFormOrderDate(new Date().toISOString().split('T')[0]);
    setFormDeliveryDeadline('');
    setFormReportId('');
    setFormItems([{ stock_id: 0, quantity: 1, unit_price: 0 }]);
  };

  const handleStartEdit = () => {
    if (!selectedOrder) return;
    setIsEditing(true);
    setIsCreating(false);
    setFormPartnerId(selectedOrder.partner_id);
    setFormOrderDate(selectedOrder.order_date);
    setFormDeliveryDeadline(selectedOrder.delivery_deadline || '');
    setFormReportId(selectedOrder.report_id ? String(selectedOrder.report_id) : '');
    setFormItems(selectedOrder.items.map(i => ({
      stock_id: i.stock_id,
      quantity: i.quantity,
      unit_price: i.unit_price
    })));
  };

  const handleCancelForm = () => {
    setIsCreating(false);
    setIsEditing(false);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formPartnerId <= 0) {
      addToast('取引先を選択してください。', 'warning');
      return;
    }

    const invalidItem = formItems.some(i => i.stock_id <= 0 || i.quantity <= 0);
    if (invalidItem) {
      addToast('商品と数量を正しく入力してください。', 'warning');
      return;
    }

    setSubmittingForm(true);
    try {
      const payload = {
        partner_id: formPartnerId,
        order_date: formOrderDate,
        delivery_deadline: formDeliveryDeadline || null,
        report_id: formReportId ? Number(formReportId) : null,
        items: formItems
      };

      const url = isCreating ? '/api/purchase-orders' : `/api/purchase-orders/${selectedOrder?.id}`;
      const method = isCreating ? 'POST' : 'PUT';

      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(payload)
      });

      const resData = await res.json();
      if (res.ok) {
        addToast(isCreating ? '発注書を下書き保存しました。' : '発注内容を更新しました。');
        setIsCreating(false);
        setIsEditing(false);
        fetchOrders();
        if (resData.data) {
          setSelectedOrder(resData.data);
        }
      } else {
        addToast(resData.message || '保存に失敗しました。', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('通信エラーが発生しました。', 'error');
    } finally {
      setSubmittingForm(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return;
    if (!window.confirm('この下書き発注を削除してよろしいですか？')) return;

    try {
      const res = await fetchWithAuth(`/api/purchase-orders/${selectedOrder.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        addToast('発注書を削除しました。');
        setSelectedOrder(null);
        fetchOrders();
      } else {
        const data = await res.json();
        addToast(data.message || '削除に失敗しました。', 'error');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfirmOrder = async () => {
    if (!selectedOrder) return;
    if (!window.confirm('発注を確定させますか？確定後は編集ができなくなります。')) return;

    try {
      const res = await fetchWithAuth(`/api/purchase-orders/${selectedOrder.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'ordered' })
      });
      if (res.ok) {
        addToast('発注を確定しました。');
        fetchOrders();
        fetchOrderDetail(selectedOrder.id);
      } else {
        const data = await res.json();
        addToast(data.message || '発注確定に失敗しました。', 'error');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    if (!window.confirm('この発注をキャンセルしますか？')) return;

    try {
      const res = await fetchWithAuth(`/api/purchase-orders/${selectedOrder.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'cancelled' })
      });
      if (res.ok) {
        addToast('発注をキャンセルしました。');
        fetchOrders();
        fetchOrderDetail(selectedOrder.id);
      } else {
        const data = await res.json();
        addToast(data.message || 'キャンセルの更新に失敗しました。', 'error');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Receipt handlers
  const handleStartReceipt = () => {
    if (!selectedOrder) return;
    setIsReceiving(true);
    const initialQtys: { [itemId: number]: number } = {};
    selectedOrder.items.forEach(i => {
      initialQtys[i.id] = 0; // default incoming amount
    });
    setReceiptQuantities(initialQtys);
  };

  const handleReceiptQtyChange = (itemId: number, max: number, value: number) => {
    const qty = Math.max(0, Math.min(max, value));
    setReceiptQuantities({ ...receiptQuantities, [itemId]: qty });
  };

  const handleConfirmReceipt = async () => {
    if (!selectedOrder) return;
    
    // Check if at least one item has incoming quantity
    const hasIncoming = Object.values(receiptQuantities).some(q => q > 0);
    if (!hasIncoming) {
      addToast('入荷数量を1件以上入力してください。', 'warning');
      return;
    }

    setSubmittingReceipt(true);
    
    // Save backup of original order to rollback in case of error (Optimistic UI fallback)
    const backupOrder = { ...selectedOrder };

    // Optimistically update quantities locally
    const optimisticallyUpdatedItems = selectedOrder.items.map(item => {
      const incoming = receiptQuantities[item.id] || 0;
      return {
        ...item,
        received_quantity: item.received_quantity + incoming
      };
    });

    const isAllCompleted = optimisticallyUpdatedItems.every(i => i.received_quantity === i.quantity);
    const isAnyReceived = optimisticallyUpdatedItems.some(i => i.received_quantity > 0);
    const newStatus = isAllCompleted ? 'completed' : (isAnyReceived ? 'partially_received' : 'ordered');

    setSelectedOrder({
      ...selectedOrder,
      items: optimisticallyUpdatedItems,
      status: newStatus
    });
    setIsReceiving(false);

    try {
      const itemsPayload = Object.keys(receiptQuantities).map(id => ({
        item_id: Number(id),
        quantity: receiptQuantities[Number(id)]
      })).filter(i => i.quantity > 0);

      const res = await fetchWithAuth(`/api/purchase-orders/${selectedOrder.id}/receive`, {
        method: 'POST',
        body: JSON.stringify({ items: itemsPayload })
      });

      const resData = await res.json();
      if (res.ok) {
        addToast('入荷処理が完了し、在庫を加算しました。');
        fetchOrders();
        // Reload fresh details
        fetchOrderDetail(selectedOrder.id);
      } else {
        // Rollback on server error
        addToast(resData.message || '入荷処理中にエラーが発生しました。', 'error');
        setSelectedOrder(backupOrder);
      }
    } catch (err) {
      console.error(err);
      addToast('通信エラーが発生しました。データを差し戻します。', 'error');
      setSelectedOrder(backupOrder);
    } finally {
      setSubmittingReceipt(false);
    }
  };

  // Helper calculation
  const calculateTotal = (items: any[]) => {
    return items.reduce((acc: number, i: any) => acc + (i.quantity * i.unit_price), 0);
  };

  // const getPartnerLabel = (partnerId: number) => {
  //   return partners.find(p => p.id === partnerId)?.name || '未選択';
  // };

  return (
    <div className="inventory-management-container" style={{ animation: 'fadeIn 0.2s ease-out' }}>
      
      {/* LEFT PANE: Orders List */}
      <div className="left-pane" style={{ display: isPrintPreview ? 'none' : 'flex' }}>
        <div className="pane-header">
          <h2>仕入発注一覧</h2>
          {isAdmin && (
            <button 
              type="button" 
              className="btn btn-primary btn-sm"
              onClick={handleStartCreate}
            >
              発注を追加
            </button>
          )}
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
          <Select 
            size="sm"
            containerStyle={{ flex: 1 }}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setSelectedOrder(null);
            }}
            options={[
              { value: '', label: 'すべての状態' },
              { value: 'draft', label: '下書き' },
              { value: 'ordered', label: '発注済' },
              { value: 'partially_received', label: '一部入荷' },
              { value: 'completed', label: '入荷完了' },
              { value: 'cancelled', label: 'キャンセル' }
            ]}
          />
          <input 
            type="text"
            className="form-control"
            style={{ flex: 2, padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-main)' }}
            placeholder="発注番号で検索..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
        </div>

        {/* List items */}
        <div className="timeline-container" style={{ flex: 1, overflowY: 'auto' }}>
          {loadingList ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
              <span style={{ color: 'var(--text-muted)' }}>発注データを読み込んでいます...</span>
            </div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              登録されている発注データはありません。
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {orders.map(order => (
                <div
                  key={order.id}
                  className={`timeline-item ${selectedOrder?.id === order.id ? 'active' : ''}`}
                  onClick={() => fetchOrderDetail(order.id)}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: selectedOrder?.id === order.id ? 'var(--accent-light)' : 'var(--bg-app)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <strong style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem', color: 'var(--text-main)' }}>{order.order_number}</strong>
                    {getStatusBadge(order.status)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>取引先: {order.partner?.name}</span>
                    <span>発注日: {order.order_date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANE: Order Detail or Form */}
      <div className="right-pane" style={{ flex: isPrintPreview ? '1' : '2', background: isPrintPreview ? '#fff' : 'var(--bg-card)' }}>
        
        {/* PRINT PREVIEW MODE VIEW */}
        {isPrintPreview && selectedOrder && (
          <div className="print-order-container" style={{ padding: '2rem', background: '#fff', color: '#000', fontSize: '14px', lineHeight: 1.5 }}>
            {/* Screen layout close preview bar */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid #ccc' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>注文書印刷プレビュー</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-primary" onClick={() => window.print()}>
                  印刷 / PDF保存実行
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPrintPreview(false)}>
                  閉じる
                </button>
              </div>
            </div>

            {/* Real printable invoice template */}
            <div id="print-area" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                  <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 700, letterSpacing: '4px' }}>注 文 書</h1>
                  <p style={{ margin: '5px 0', fontSize: '12px' }}>発注番号: {selectedOrder.order_number}</p>
                  <p style={{ margin: '5px 0', fontSize: '12px' }}>発注日: {selectedOrder.order_date}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h2 style={{ fontSize: '18px', margin: 0 }}>Worknity 組織名</h2>
                  <p style={{ margin: '5px 0', fontSize: '12px' }}>{user?.organization_name || '自社組織'}</p>
                  <p style={{ margin: '5px 0', fontSize: '12px' }}>発注担当者: {selectedOrder.creator?.login_id}</p>
                </div>
              </div>

              <div style={{ marginBottom: '2rem', borderBottom: '2px solid #000', paddingBottom: '1rem' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>発注先（御中）:</h3>
                <div style={{ fontSize: '14px', paddingLeft: '0.5rem' }}>
                  <strong>{selectedOrder.partner?.name}</strong>
                  {selectedOrder.partner?.address && <p style={{ margin: '5px 0' }}>住所: {selectedOrder.partner.address}</p>}
                  {selectedOrder.partner?.phone && <p style={{ margin: '5px 0' }}>TEL: {selectedOrder.partner.phone}</p>}
                </div>
              </div>

              <p style={{ fontSize: '13px', marginBottom: '1.5rem' }}>
                下記の通り注文いたします。納品期限および納品場所について、ご査収のほどよろしくお願い申し上げます。
              </p>

              {selectedOrder.delivery_deadline && (
                <div style={{ marginBottom: '1.5rem', background: '#f5f5f5', padding: '0.75rem', borderRadius: '4px' }}>
                  <strong>希望納期: {selectedOrder.delivery_deadline}</strong>
                </div>
              )}

              {/* Order items table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #000', background: '#f5f5f5' }}>
                    <th style={{ textAlign: 'left', padding: '8px', fontSize: '13px' }}>商品名</th>
                    <th style={{ textAlign: 'right', padding: '8px', fontSize: '13px', width: '100px' }}>発注数</th>
                    <th style={{ textAlign: 'right', padding: '8px', fontSize: '13px', width: '120px' }}>単価</th>
                    <th style={{ textAlign: 'right', padding: '8px', fontSize: '13px', width: '120px' }}>金額</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '10px 8px' }}>{item.stock?.product_name}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>{item.quantity}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>¥{item.unit_price.toLocaleString()}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600 }}>¥{(item.quantity * item.unit_price).toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid #000', fontWeight: 'bold' }}>
                    <td colSpan={2} style={{ padding: '10px 8px' }}></td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: '16px' }}>合計金額</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: '16px' }}>¥{calculateTotal(selectedOrder.items).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ marginTop: '3rem', borderTop: '1px solid #ccc', paddingTop: '1rem', fontSize: '11px', color: '#666' }}>
                ※ 本書は Worknity 発注管理システムより出力されたデジタル注文書です。
              </div>
            </div>
          </div>
        )}

        {/* DEFAULT DETAIL/FORM MODE VIEW */}
        {!isPrintPreview && (
          <>
            {isCreating || isEditing ? (
              /* CREATE / EDIT FORM VIEW */
              <form onSubmit={handleSaveForm} className="form-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="pane-header">
                  <h2>{isCreating ? '発注書の作成（下書き）' : '発注内容の編集'}</h2>
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Partner select */}
                  <Select
                    label="発注先取引先"
                    value={formPartnerId}
                    onChange={(e) => setFormPartnerId(Number(e.target.value))}
                    required
                    options={[
                      { value: '0', label: '取引先を選択してください' },
                      ...partners.map(p => ({ value: String(p.id), label: p.name }))
                    ]}
                  />

                  {/* Dates */}
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <Input
                      id="formOrderDate"
                      type="date"
                      label="発注日"
                      value={formOrderDate}
                      onChange={(e) => setFormOrderDate(e.target.value)}
                      required
                      containerClassName="form-group"
                      containerStyle={{ flex: 1 }}
                    />
                    <Input
                      id="formDeliveryDeadline"
                      type="date"
                      label="希望納期（任意）"
                      value={formDeliveryDeadline}
                      onChange={(e) => setFormDeliveryDeadline(e.target.value)}
                      containerClassName="form-group"
                      containerStyle={{ flex: 1 }}
                    />
                  </div>

                  {/* Optional Report Integration */}
                  <Input
                    id="formReportId"
                    type="number"
                    label="紐付ける承認済み申請ID（任意）"
                    placeholder="例: 14"
                    value={formReportId}
                    onChange={(e) => setFormReportId(e.target.value)}
                    containerClassName="form-group"
                  />

                  {/* Items Area */}
                  <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>発注商品明細</span>
                      <button 
                        type="button" 
                        className="btn btn-secondary btn-sm"
                        onClick={handleAddItem}
                      >
                        ＋ 行を追加
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {formItems.map((item, index) => (
                        <div 
                          key={index}
                          style={{
                            display: 'flex',
                            gap: '0.5rem',
                            alignItems: 'center',
                            padding: '0.5rem',
                            borderRadius: '6px',
                            background: 'var(--bg-app)',
                            border: '1px solid var(--border-color)'
                          }}
                        >
                          {/* Stock Select */}
                          <Select
                            size="sm"
                            containerStyle={{ flex: 3 }}
                            value={item.stock_id}
                            onChange={(e) => handleItemChange(index, 'stock_id', Number(e.target.value))}
                            required
                            options={[
                              { value: '0', label: '商品を選択...' },
                              ...stocks.map(s => ({
                                value: String(s.id),
                                label: `${s.product_name} (在庫: ${s.quantity})`
                              }))
                            ]}
                          />

                          {/* Quantity */}
                          <input
                            type="number"
                            className="form-control"
                            style={{ flex: 1, width: '60px', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-main)' }}
                            placeholder="数量"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', Math.max(1, Number(e.target.value)))}
                            required
                          />

                          {/* Unit price */}
                          <div style={{ flex: 1.5, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>¥</span>
                            <input
                              type="number"
                              className="form-control"
                              style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-main)' }}
                              placeholder="単価"
                              min="0"
                              value={item.unit_price}
                              onChange={(e) => handleItemChange(index, 'unit_price', Math.max(0, Number(e.target.value)))}
                              required
                            />
                          </div>

                          {/* Remove row */}
                          <button
                            type="button"
                            className="btn btn-text"
                            onClick={() => handleRemoveItem(index)}
                            disabled={formItems.length === 1}
                            style={{ color: 'var(--status-danger)', fontSize: '1.25rem', padding: '0 0.5rem' }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Form Total price estimation */}
                    <div style={{ marginTop: '1.5rem', textAlign: 'right', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      概算合計金額: <span style={{ fontSize: '1.3rem', color: 'var(--accent)' }}>¥{calculateTotal(formItems).toLocaleString()}</span>
                    </div>
                  </div>

                </div>

                <div className="modal-footer" style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={handleCancelForm} disabled={submittingForm}>
                    キャンセル
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submittingForm}>
                    {submittingForm ? '保存中...' : '下書き保存'}
                  </button>
                </div>
              </form>
            ) : selectedOrder ? (
              /* DETAIL VIEW MODE */
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {loadingDetail ? (
                  <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
                    <div className="spinner" style={{ marginBottom: '1rem' }}></div>
                    <span style={{ color: 'var(--text-muted)' }}>発注詳細をロードしています...</span>
                  </div>
                ) : (
                  <>
                    {/* Detail Pane Header */}
                    <div className="pane-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '1.25rem' }}>{selectedOrder.order_number}</span>
                          {getStatusBadge(selectedOrder.status)}
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                          担当: {selectedOrder.creator?.login_id}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {selectedOrder.status === 'draft' && isAdmin && (
                          <>
                            <button type="button" className="btn btn-primary btn-sm" onClick={handleConfirmOrder}>
                              発注確定
                            </button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={handleStartEdit}>
                              編集
                            </button>
                            <button type="button" className="btn btn-text btn-sm" onClick={handleDeleteOrder} style={{ color: 'var(--status-danger)' }}>
                              削除
                            </button>
                          </>
                        )}
                        {['ordered', 'partially_received'].includes(selectedOrder.status) && (
                          <>
                            <button type="button" className="btn btn-primary btn-sm" onClick={handleStartReceipt} disabled={isReceiving}>
                              入荷登録
                            </button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsPrintPreview(true)}>
                              注文書を出力
                            </button>
                          </>
                        )}
                        {['draft', 'ordered', 'partially_received'].includes(selectedOrder.status) && isAdmin && (
                          <button type="button" className="btn btn-text btn-sm" onClick={handleCancelOrder} style={{ color: 'var(--status-danger)' }}>
                            発注をキャンセル
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {/* Summary details */}
                      <div 
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '1rem',
                          background: 'var(--bg-app)',
                          padding: '1rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)'
                        }}
                      >
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>発注先取引先</span>
                          <strong style={{ color: 'var(--text-main)' }}>{selectedOrder.partner?.name}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>発注日</span>
                          <strong style={{ color: 'var(--text-main)' }}>{selectedOrder.order_date}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>希望納期</span>
                          <strong style={{ color: 'var(--text-main)' }}>{selectedOrder.delivery_deadline || '指定なし'}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>関連申請報告ID</span>
                          <strong style={{ color: 'var(--text-main)' }}>{selectedOrder.report_id ? `#${selectedOrder.report_id}` : 'なし'}</strong>
                        </div>
                      </div>

                      {/* INCOMING RECEIPT WORKSPACE AREA */}
                      {isReceiving && (
                        <div 
                          style={{
                            background: 'var(--accent-light)',
                            border: '1px solid var(--accent)',
                            borderRadius: '8px',
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem'
                          }}
                        >
                          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>入荷数量の入力 (分納対応)</h3>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>本日入荷した数量を入力してください（発注残数を超える数は入力できません）。</p>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                            {selectedOrder.items.map(item => {
                              const maxAllocated = item.quantity - item.received_quantity;
                              if (maxAllocated <= 0) return null; // already fully received

                              return (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem', borderBottom: '1px solid var(--border-color)' }}>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{item.stock?.product_name}</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>残: {maxAllocated} /</span>
                                    <input 
                                      type="number"
                                      className="form-control"
                                      style={{ width: '70px', padding: '0.2rem', textAlign: 'right', background: '#fff', color: '#000', border: '1px solid #ccc', borderRadius: '4px' }}
                                      min="0"
                                      max={maxAllocated}
                                      value={receiptQuantities[item.id] || 0}
                                      onChange={(e) => handleReceiptQtyChange(item.id, maxAllocated, Number(e.target.value))}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsReceiving(false)} disabled={submittingReceipt}>
                              閉じる
                            </button>
                            <button type="button" className="btn btn-primary btn-sm" onClick={handleConfirmReceipt} disabled={submittingReceipt}>
                              {submittingReceipt ? '入荷処理中...' : '入荷数量を確定'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Items List Table */}
                      <div>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>明細内容</h3>
                        <table className="stock-table">
                          <thead>
                            <tr>
                              <th>商品名</th>
                              <th style={{ textAlign: 'right' }}>発注数</th>
                              <th style={{ textAlign: 'right' }}>入荷済</th>
                              <th style={{ textAlign: 'right' }}>単価</th>
                              <th style={{ textAlign: 'right' }}>金額</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedOrder.items.map(item => (
                              <tr key={item.id}>
                                <td style={{ fontWeight: 500 }}>{item.stock?.product_name}</td>
                                <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                                <td style={{ textAlign: 'right', color: item.received_quantity === item.quantity ? 'var(--status-good)' : 'var(--status-warning)' }}>
                                  {item.received_quantity}
                                </td>
                                <td style={{ textAlign: 'right' }}>¥{item.unit_price.toLocaleString()}</td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>¥{(item.quantity * item.unit_price).toLocaleString()}</td>
                              </tr>
                            ))}
                            <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: 'bold' }}>
                              <td colSpan={3} style={{ textAlign: 'right' }}>合計金額</td>
                              <td colSpan={2} style={{ textAlign: 'right', fontSize: '1.15rem', color: 'var(--accent)' }}>
                                ¥{calculateTotal(selectedOrder.items).toLocaleString()}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* EMPTY CHOOSE PLACEHOLDER */
              <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column', color: 'var(--text-muted)' }}>
                <OrderIcon size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                <h3>発注書が選択されていません</h3>
                <p>左側のリストから発注伝票を選択するか、新規に追加してください。</p>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
};

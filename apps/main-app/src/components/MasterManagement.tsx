import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Input } from './ui/Input';
import { CalendarHolidayManagement } from './CalendarHolidayManagement';
import { SettingIcon } from './ui/Icons';

interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

interface Partner {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
}

interface Stock {
  id: number;
  product_name: string;
  quantity: number;
  minimum_quantity: number;
  jan_code: string | null;
  description: string | null;
  price: number | null;
  brand_name: string | null;
  category_name: string | null;
}

interface CustomerField {
  id: number;
  field_key: string;
  field_name: string;
  field_type: 'text' | 'number' | 'select' | 'date';
  options: string[] | null;
  is_custom: boolean;
  is_enabled: boolean;
  is_searchable: boolean;
  sort_order: number;
}

interface MasterManagementProps {
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}

type SubTab = 'customers' | 'partners' | 'stocks' | 'cust_fields' | 'calendar';

export const MasterManagement: React.FC<MasterManagementProps> = ({ addToast }) => {
  const { user, fetchWithAuth } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>('customers');
  const [loading, setLoading] = useState<boolean>(true);

  // Lists state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [custFields, setCustFields] = useState<CustomerField[]>([]);

  // Modal & Form state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form Fields (Standard Masters)
  const [fieldName, setFieldName] = useState<string>('');
  const [fieldEmail, setFieldEmail] = useState<string>('');
  const [fieldPhone, setFieldPhone] = useState<string>('');
  const [fieldAddress, setFieldAddress] = useState<string>('');

  // Stock Fields
  const [stockMinQty, setStockMinQty] = useState<number>(0);
  const [stockJan, setStockJan] = useState<string>('');
  const [stockDesc, setStockDesc] = useState<string>('');
  const [stockPrice, setStockPrice] = useState<number>(0);
  const [stockBrand, setStockBrand] = useState<string>('');
  const [stockCategory, setStockCategory] = useState<string>('');

  // Customer Field config fields
  const [fieldKey, setFieldKey] = useState<string>('');
  const [fieldType, setFieldType] = useState<'text' | 'number' | 'select' | 'date'>('text');
  const [fieldOptions, setFieldOptions] = useState<string>('');
  const [fieldIsEnabled, setFieldIsEnabled] = useState<boolean>(true);
  const [fieldIsSearchable, setFieldIsSearchable] = useState<boolean>(true);
  const [fieldSortOrder, setFieldSortOrder] = useState<number>(0);

  const isAdmin = user?.role === 'admin';

  const resetForm = () => {
    setFieldName('');
    setFieldEmail('');
    setFieldPhone('');
    setFieldAddress('');
    setStockMinQty(0);
    setStockJan('');
    setStockDesc('');
    setStockPrice(0);
    setStockBrand('');
    setStockCategory('');
    
    // Dynamic Fields state reset
    setFieldKey('');
    setFieldType('text');
    setFieldOptions('');
    setFieldIsEnabled(true);
    setFieldIsSearchable(true);
    setFieldSortOrder(0);

    setEditingItem(null);
  };

  const fetchList = useCallback(async () => {
    if (!isAdmin) return;
    if (subTab === 'calendar') return;
    setLoading(true);
    try {
      const endpoint = subTab === 'customers' ? '/api/customers' 
                     : subTab === 'partners' ? '/api/partners' 
                     : subTab === 'stocks' ? '/api/stocks'
                     : '/api/customer-fields';
      const res = await fetchWithAuth(endpoint);
      if (res.ok) {
        const data = await res.json();
        if (subTab === 'customers') {
          setCustomers(data);
        } else if (subTab === 'partners') {
          setPartners(data);
        } else if (subTab === 'stocks') {
          setStocks(data.data || data);
        } else {
          setCustFields(data);
        }
      } else {
        addToast('データの取得に失敗しました。', 'error');
      }
    } catch (e) {
      addToast('ネットワークエラーが発生しました。', 'error');
    } finally {
      setLoading(false);
    }
  }, [subTab, isAdmin, fetchWithAuth, addToast]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Open Edit Modal helper
  const openEditModal = (item: any) => {
    setEditingItem(item);
    
    if (subTab === 'cust_fields') {
      const field = item as CustomerField;
      setFieldName(field.field_name);
      setFieldKey(field.field_key);
      setFieldType(field.field_type);
      setFieldOptions(field.options?.join(', ') || '');
      setFieldIsEnabled(field.is_enabled);
      setFieldIsSearchable(field.is_searchable);
      setFieldSortOrder(field.sort_order);
    } else {
      setFieldName(item.name || item.product_name || '');
      setFieldEmail(item.email || '');
      setFieldPhone(item.phone || '');
      setFieldAddress(item.address || '');

      if (subTab === 'stocks') {
        setStockMinQty(item.minimum_quantity || 0);
        setStockJan(item.jan_code || '');
        setStockDesc(item.description || '');
        setStockPrice(item.price || 0);
        setStockBrand(item.brand_name || '');
        setStockCategory(item.category_name || '');
      }
    }
    setShowAddModal(true);
  };

  // Submit Store or Update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (subTab !== 'cust_fields' && !fieldName.trim()) {
      addToast('名称を入力してください。', 'warning');
      return;
    }
    if (subTab === 'cust_fields' && !fieldName.trim()) {
      addToast('表示名を入力してください。', 'warning');
      return;
    }
    if (subTab === 'cust_fields' && !editingItem && !fieldKey.trim()) {
      addToast('フィールドキーを入力してください。', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const method = editingItem ? 'PUT' : 'POST';
      let endpoint = '';
      let body: any = {};

      if (subTab === 'customers') {
        endpoint = editingItem ? `/api/customers/${editingItem.id}` : '/api/customers';
        body = { name: fieldName, email: fieldEmail || null, phone: fieldPhone || null, address: fieldAddress || null, kana: editingItem ? editingItem.kana : fieldName };
      } else if (subTab === 'partners') {
        endpoint = editingItem ? `/api/partners/${editingItem.id}` : '/api/partners';
        body = { name: fieldName, address: fieldAddress || null, phone: fieldPhone || null };
      } else if (subTab === 'stocks') {
        endpoint = editingItem ? `/api/stocks/${editingItem.id}` : '/api/stocks';
        body = {
          product_name: fieldName,
          minimum_quantity: stockMinQty,
          jan_code: stockJan || null,
          description: stockDesc || null,
          price: stockPrice || null,
          brand_name: stockBrand || null,
          category_name: stockCategory || null,
        };
      } else if (subTab === 'cust_fields') {
        endpoint = editingItem ? `/api/customer-fields/${editingItem.id}` : '/api/customer-fields';
        
        const optionsList = fieldType === 'select'
          ? fieldOptions.split(',').map(s => s.trim()).filter(Boolean)
          : null;

        body = {
          field_name: fieldName,
          field_key: editingItem ? undefined : fieldKey,
          field_type: fieldType,
          options: optionsList,
          is_enabled: fieldIsEnabled,
          is_searchable: fieldIsSearchable,
          sort_order: fieldSortOrder,
          is_custom: editingItem ? editingItem.is_custom : true,
        };
      }

      const res = await fetchWithAuth(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        addToast(editingItem ? '更新しました。' : '登録しました。', 'success');
        setShowAddModal(false);
        resetForm();
        fetchList();
      } else {
        addToast(data.message || '処理に失敗しました。', 'error');
      }
    } catch (e) {
      addToast('通信中にエラーが発生しました。', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Item
  const handleDelete = async (id: number) => {
    const confirmMsg = subTab === 'customers' ? 'この顧客を削除しますか？'
                     : subTab === 'partners' ? 'この取引先を削除しますか？'
                     : subTab === 'stocks' ? 'この商品を削除しますか？ (紐付く入出庫履歴もすべて削除されます)'
                     : 'この追加項目を削除しますか？';
    if (!window.confirm(confirmMsg)) return;

    try {
      const endpoint = subTab === 'customers' ? `/api/customers/${id}` 
                     : subTab === 'partners' ? `/api/partners/${id}` 
                     : subTab === 'stocks' ? `/api/stocks/${id}`
                     : `/api/customer-fields/${id}`;

      const res = await fetchWithAuth(endpoint, { method: 'DELETE' });
      
      if (res.ok) {
        addToast('削除しました。', 'success');
        fetchList();
      } else {
        const data = await res.json();
        addToast(data.message || '削除に失敗しました。', 'error');
      }
    } catch (e) {
      addToast('通信中にエラーが発生しました。', 'error');
    }
  };

  if (!isAdmin) {
    return (
      <div className="section-card kiosk-main-card" style={{ padding: '2rem', textAlign: 'center', animation: 'fadeIn 0.2s ease-out' }}>
        <h2 style={{ color: 'var(--status-danger)' }}>アクセス制限</h2>
        <p style={{ color: 'var(--text-muted)' }}>マスタ管理画面は管理者（admin）のみが閲覧可能です。</p>
      </div>
    );
  }

  return (
    <div className="section-card kiosk-main-card" style={{ padding: '2rem', animation: 'fadeIn 0.2s ease-out' }}>
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <SettingIcon size={24} />
          <h2>マスタ管理システム</h2>
        </div>
        {subTab !== 'calendar' && (
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={() => { resetForm(); setShowAddModal(true); }}
          >
            新規{subTab === 'customers' ? '顧客' : subTab === 'partners' ? '取引先' : subTab === 'stocks' ? '商品' : '項目'}追加
          </button>
        )}
      </div>

      {/* Sub Tabs */}
      <div className="master-subtabs" style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn ${subTab === 'customers' ? 'btn-primary' : 'btn-text'}`}
          onClick={() => setSubTab('customers')}
          style={{ padding: '0.5rem 1.25rem' }}
        >
          顧客 (基本情報)
        </button>
        <button
          type="button"
          className={`btn ${subTab === 'partners' ? 'btn-primary' : 'btn-text'}`}
          onClick={() => setSubTab('partners')}
          style={{ padding: '0.5rem 1.25rem' }}
        >
          取引先 (企業)
        </button>
        <button
          type="button"
          className={`btn ${subTab === 'stocks' ? 'btn-primary' : 'btn-text'}`}
          onClick={() => setSubTab('stocks')}
          style={{ padding: '0.5rem 1.25rem' }}
        >
          商品マスタ
        </button>
        <button
          type="button"
          className={`btn ${subTab === 'cust_fields' ? 'btn-primary' : 'btn-text'}`}
          onClick={() => setSubTab('cust_fields')}
          style={{ padding: '0.5rem 1.25rem' }}
        >
          顧客項目設定
        </button>
        <button
          type="button"
          className={`btn ${subTab === 'calendar' ? 'btn-primary' : 'btn-text'}`}
          onClick={() => setSubTab('calendar')}
          style={{ padding: '0.5rem 1.25rem' }}
        >
          カレンダー・休日設定
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', marginTop: '0.5rem' }}>
        {subTab === 'calendar' ? (
          <CalendarHolidayManagement addToast={addToast} />
        ) : loading ? (
          <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '1rem' }}>
            <div className="spinner"></div>
            <p style={{ color: 'var(--text-muted)' }}>データを読み込んでいます...</p>
          </div>
        ) : (subTab === 'customers' && customers.length === 0) || 
            (subTab === 'partners' && partners.length === 0) || 
            (subTab === 'stocks' && stocks.length === 0) ||
            (subTab === 'cust_fields' && custFields.length === 0) ? (
          <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', flexDirection: 'column', padding: '3rem', color: 'var(--text-muted)' }}>
            <SettingIcon size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
            <h3>登録されているデータはありません。</h3>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', overflow: 'hidden' }}>
            <table className="stock-table">
              <thead>
                {subTab === 'customers' && (
                  <tr>
                    <th>ID</th>
                    <th>顧客名</th>
                    <th>メールアドレス</th>
                    <th>電話番号</th>
                    <th>住所</th>
                    <th style={{ textAlign: 'right' }}>操作</th>
                  </tr>
                )}
                {subTab === 'partners' && (
                  <tr>
                    <th>ID</th>
                    <th>取引先名</th>
                    <th>電話番号</th>
                    <th>住所</th>
                    <th style={{ textAlign: 'right' }}>操作</th>
                  </tr>
                )}
                {subTab === 'stocks' && (
                  <tr>
                    <th>ID</th>
                    <th>商品名</th>
                    <th>現在庫</th>
                    <th>安全在庫</th>
                    <th>参考価格</th>
                    <th>ブランド</th>
                    <th>カテゴリ</th>
                    <th style={{ textAlign: 'right' }}>操作</th>
                  </tr>
                )}
                {subTab === 'cust_fields' && (
                  <tr>
                    <th>項目名 (表示用)</th>
                    <th>キー (システム用)</th>
                    <th>型</th>
                    <th>区分</th>
                    <th>表示状態</th>
                    <th>検索対象</th>
                    <th style={{ textAlign: 'right' }}>操作</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {subTab === 'customers' && customers.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>#{c.id}</td>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>{c.email || '---'}</td>
                    <td>{c.phone || '---'}</td>
                    <td>{c.address || '---'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-text btn-xs" style={{ marginRight: '0.5rem' }} onClick={() => openEditModal(c)}>編集</button>
                      <button className="btn btn-text btn-xs" style={{ color: 'var(--status-danger)' }} onClick={() => handleDelete(c.id)}>削除</button>
                    </td>
                  </tr>
                ))}
                {subTab === 'partners' && partners.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>#{p.id}</td>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>{p.phone || '---'}</td>
                    <td>{p.address || '---'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-text btn-xs" style={{ marginRight: '0.5rem' }} onClick={() => openEditModal(p)}>編集</button>
                      <button className="btn btn-text btn-xs" style={{ color: 'var(--status-danger)' }} onClick={() => handleDelete(p.id)}>削除</button>
                    </td>
                  </tr>
                ))}
                {subTab === 'stocks' && stocks.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>#{s.id}</td>
                    <td style={{ fontWeight: 600 }}>{s.product_name}</td>
                    <td>{s.quantity}</td>
                    <td>{s.minimum_quantity}</td>
                    <td>{s.price !== null ? `¥${s.price.toLocaleString()}` : '---'}</td>
                    <td>{s.brand_name || '---'}</td>
                    <td>{s.category_name || '---'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-text btn-xs" style={{ marginRight: '0.5rem' }} onClick={() => openEditModal(s)}>編集</button>
                      <button className="btn btn-text btn-xs" style={{ color: 'var(--status-danger)' }} onClick={() => handleDelete(s.id)}>削除</button>
                    </td>
                  </tr>
                ))}
                {subTab === 'cust_fields' && custFields.map((f) => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600 }}>{f.field_name}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{f.field_key}</td>
                    <td>
                      {f.field_type === 'text' && 'テキスト'}
                      {f.field_type === 'number' && '数値'}
                      {f.field_type === 'select' && '選択肢'}
                      {f.field_type === 'date' && '日付'}
                    </td>
                    <td>
                      <span className={`badge ${f.is_custom ? 'badge-good' : 'badge-warning'}`}>
                        {f.is_custom ? 'カスタム' : '標準項目'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${f.is_enabled ? 'badge-good' : ''}`}>
                        {f.is_enabled ? '表示中' : '非表示'}
                      </span>
                    </td>
                    <td>{f.is_searchable ? '対象' : '---'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-text btn-xs" style={{ marginRight: '0.5rem' }} onClick={() => openEditModal(f)}>設定</button>
                      {f.is_custom && (
                        <button className="btn btn-text btn-xs" style={{ color: 'var(--status-danger)' }} onClick={() => handleDelete(f.id)}>削除</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="quick-launcher-overlay" onClick={() => { setShowAddModal(false); resetForm(); }}>
          <div 
            className="quick-launcher-content" 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              maxWidth: '500px', 
              borderRadius: 'var(--border-radius-lg)', 
              padding: '2rem',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {editingItem ? '設定の編集' : `新規${subTab === 'customers' ? '顧客' : subTab === 'partners' ? '取引先' : subTab === 'stocks' ? '商品' : '追加項目'}の登録`}
            </h3>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '75vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {subTab !== 'cust_fields' ? (
                /* Normal masters forms */
                <>
                  <Input
                    id="name"
                    type="text"
                    label={subTab === 'stocks' ? '商品名 (必須)' : '名称 (必須)'}
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                    placeholder={subTab === 'stocks' ? '例: アルコール消毒液' : '例: 山田太郎, 〇〇商事'}
                    required
                  />

                  {subTab === 'customers' && (
                    <Input
                      id="email"
                      type="email"
                      label="メールアドレス (任意)"
                      value={fieldEmail}
                      onChange={(e) => setFieldEmail(e.target.value)}
                      placeholder="customer@example.com"
                    />
                  )}

                  {subTab !== 'stocks' && (
                    <>
                      <Input
                        id="phone"
                        type="text"
                        label="電話番号 (任意)"
                        value={fieldPhone}
                        onChange={(e) => setFieldPhone(e.target.value)}
                        placeholder="090-0000-0000"
                      />
                      <Input
                        id="address"
                        type="text"
                        label="住所 (任意)"
                        value={fieldAddress}
                        onChange={(e) => setFieldAddress(e.target.value)}
                        placeholder="東京都渋谷区..."
                      />
                    </>
                  )}

                  {subTab === 'stocks' && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <Input
                          id="minQty"
                          type="number"
                          label="安全在庫数"
                          value={stockMinQty.toString()}
                          onChange={(e) => setStockMinQty(Number(e.target.value))}
                          min="0"
                        />
                        <Input
                          id="price"
                          type="number"
                          label="参考価格"
                          value={stockPrice.toString()}
                          onChange={(e) => setStockPrice(Number(e.target.value))}
                          min="0"
                        />
                      </div>
                      <Input
                        id="janCode"
                        type="text"
                        label="JANコード"
                        value={stockJan}
                        onChange={(e) => setStockJan(e.target.value)}
                        placeholder="バーコード数値"
                      />
                      <Input
                        id="brand"
                        type="text"
                        label="ブランド・メーカー"
                        value={stockBrand}
                        onChange={(e) => setStockBrand(e.target.value)}
                        placeholder="サントリー, ソニーなど"
                      />
                      <Input
                        id="category"
                        type="text"
                        label="カテゴリ名"
                        value={stockCategory}
                        onChange={(e) => setStockCategory(e.target.value)}
                        placeholder="日用品 ＞ 衛生品 など"
                      />
                      <div className="form-group">
                        <label htmlFor="description" className="form-label">商品説明・仕様</label>
                        <textarea
                          id="description"
                          className="form-control"
                          value={stockDesc}
                          onChange={(e) => setStockDesc(e.target.value)}
                          placeholder="サイズ、色、用途など"
                          style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', color: 'var(--text-main)', padding: '0.6rem', width: '100%', minHeight: '80px', fontFamily: 'inherit' }}
                        />
                      </div>
                    </>
                  )}
                </>
              ) : (
                /* Customer custom fields settings form */
                <>
                  <Input
                    id="field_name"
                    type="text"
                    label="表示名 (必須)"
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                    placeholder="例: 介護度, 髪質"
                    required
                  />

                  <Input
                    id="field_key"
                    type="text"
                    label="フィールドキー (必須/英数字のみ)"
                    value={fieldKey}
                    onChange={(e) => setFieldKey(e.target.value)}
                    placeholder="例: care_level, hair_type"
                    required
                    disabled={!!editingItem} // Key is immutable once created
                  />

                  <div className="form-group">
                    <label htmlFor="field_type" className="form-label">項目データ型</label>
                    <select
                      id="field_type"
                      className="form-control"
                      value={fieldType}
                      onChange={(e) => setFieldType(e.target.value as any)}
                      disabled={editingItem && !editingItem.is_custom} // Cannot change standard fields type
                      style={{ padding: '0.6rem', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', color: 'var(--text-main)' }}
                    >
                      <option value="text">テキスト</option>
                      <option value="number">数値</option>
                      <option value="select">選択肢リスト</option>
                      <option value="date">日付</option>
                    </select>
                  </div>

                  {fieldType === 'select' && (
                    <Input
                      id="field_options"
                      type="text"
                      label="選択肢 (カンマ区切りで入力)"
                      value={fieldOptions}
                      onChange={(e) => setFieldOptions(e.target.value)}
                      placeholder="例: 要介護1, 要介護2, 要介護3"
                      required
                    />
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="checkbox"
                        id="field_enabled"
                        checked={fieldIsEnabled}
                        onChange={(e) => setFieldIsEnabled(e.target.checked)}
                        style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
                      />
                      <label htmlFor="field_enabled" style={{ cursor: 'pointer', fontWeight: 500 }}>有効にする</label>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="checkbox"
                        id="field_searchable"
                        checked={fieldIsSearchable}
                        onChange={(e) => setFieldIsSearchable(e.target.checked)}
                        style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
                      />
                      <label htmlFor="field_searchable" style={{ cursor: 'pointer', fontWeight: 500 }}>検索対象にする</label>
                    </div>
                  </div>

                  <Input
                    id="field_sort"
                    type="number"
                    label="並び順 (数字が小さいほど先頭に配置)"
                    value={fieldSortOrder.toString()}
                    onChange={(e) => setFieldSortOrder(Number(e.target.value))}
                    min="0"
                  />
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  disabled={submitting}
                >
                  キャンセル
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? '保存中...' : editingItem ? '更新する' : '登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

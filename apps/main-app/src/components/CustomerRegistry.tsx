import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Input } from './ui/Input';
import { CustomerIcon, SearchIcon } from './ui/Icons';

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

interface Customer {
  id: number;
  name: string;
  kana: string;
  email: string | null;
  phone: string | null;
  postal_code: string | null;
  address: string | null;
  attributes: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

interface CustomerRegistryProps {
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}

export const CustomerRegistry: React.FC<CustomerRegistryProps> = ({ addToast }) => {
  const { user, fetchWithAuth } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Fields and Customers states
  const [fields, setFields] = useState<CustomerField[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loadingList, setLoadingList] = useState<boolean>(true);

  // Search states
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState<boolean>(false);
  const [searchParams, setSearchParams] = useState<Record<string, string>>({
    phone: '',
    email: '',
    postal_code: '',
    address: '',
  });

  // Edit / Form states
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isNewMode, setIsNewMode] = useState<boolean>(false);
  const [formValues, setFormValues] = useState<Record<string, any>>({
    name: '',
    kana: '',
    phone: '',
    email: '',
    postal_code: '',
    address: '',
  });
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Fetch field definitions
  const fetchFields = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/customer-fields');
      if (res.ok) {
        const data = await res.json();
        setFields(data);
      } else {
        addToast('項目設定の取得に失敗しました。', 'error');
      }
    } catch (e) {
      addToast('ネットワークエラーが発生しました。', 'error');
    }
  }, [fetchWithAuth, addToast]);

  // Fetch customer list with search queries
  const fetchCustomers = useCallback(async (keyword = '', advanced: Record<string, string> = {}) => {
    setLoadingList(true);
    try {
      let queryStr = `?keyword=${encodeURIComponent(keyword)}`;
      
      // Add advanced search parameters if enabled
      if (showAdvancedSearch) {
        Object.entries(advanced).forEach(([key, val]) => {
          if (val) {
            queryStr += `&${key}=${encodeURIComponent(val)}`;
          }
        });
      }

      const res = await fetchWithAuth(`/api/customers${queryStr}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      } else {
        addToast('顧客データの取得に失敗しました。', 'error');
      }
    } catch (e) {
      addToast('通信中にエラーが発生しました。', 'error');
    } finally {
      setLoadingList(false);
    }
  }, [fetchWithAuth, addToast, showAdvancedSearch]);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  useEffect(() => {
    fetchCustomers(searchKeyword, searchParams);
  }, [fetchCustomers, searchKeyword, searchParams]);

  // Trigger search execution
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers(searchKeyword, searchParams);
  };

  // Reset all search forms
  const handleSearchReset = () => {
    setSearchKeyword('');
    const resetParams: Record<string, string> = {
      phone: '',
      email: '',
      postal_code: '',
      address: '',
    };
    fields.forEach(f => {
      if (f.is_custom && f.is_searchable) {
        resetParams[f.field_key] = '';
      }
    });
    setSearchParams(resetParams);
    fetchCustomers('', resetParams);
  };

  // Open Create Form
  const handleOpenCreate = () => {
    setIsNewMode(true);
    setIsEditMode(false);
    setSelectedCustomer(null);

    const initialValues: Record<string, any> = {
      name: '',
      kana: '',
      phone: '',
      email: '',
      postal_code: '',
      address: '',
    };
    // Initialize custom fields with default values
    fields.forEach(f => {
      if (f.is_custom && f.is_enabled) {
        initialValues[f.field_key] = f.field_type === 'number' ? '' : '';
      }
    });
    setFormValues(initialValues);
  };

  // Open Edit Form
  const handleOpenEdit = (customer: Customer) => {
    setIsNewMode(false);
    setIsEditMode(true);

    const editValues: Record<string, any> = {
      name: customer.name,
      kana: customer.kana,
      phone: customer.phone || '',
      email: customer.email || '',
      postal_code: customer.postal_code || '',
      address: customer.address || '',
    };
    // Map custom attributes
    fields.forEach(f => {
      if (f.is_custom && f.is_enabled) {
        editValues[f.field_key] = customer.attributes?.[f.field_key] ?? '';
      }
    });
    setFormValues(editValues);
  };

  // Save (Create or Update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValues.name.trim() || !formValues.kana.trim()) {
      addToast('顧客名とフリガナは必須です。', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const method = isNewMode ? 'POST' : 'PUT';
      const endpoint = isNewMode ? '/api/customers' : `/api/customers/${selectedCustomer?.id}`;

      const res = await fetchWithAuth(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues),
      });

      const data = await res.json();

      if (res.ok) {
        addToast(isNewMode ? '顧客を登録しました。' : '顧客情報を更新しました。', 'success');
        setIsNewMode(false);
        setIsEditMode(false);
        setSelectedCustomer(data);
        fetchCustomers(searchKeyword, searchParams);
      } else {
        addToast(data.message || '保存に失敗しました。', 'error');
      }
    } catch (e) {
      addToast('通信エラーが発生しました。', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Customer
  const handleDelete = async (customer: Customer) => {
    if (!isAdmin) return;
    if (!window.confirm(`「${customer.name}」様の顧客データを完全に削除しますか？`)) {
      return;
    }

    try {
      const res = await fetchWithAuth(`/api/customers/${customer.id}`, { method: 'DELETE' });
      if (res.ok) {
        addToast('顧客データを削除しました。', 'success');
        setSelectedCustomer(null);
        fetchCustomers(searchKeyword, searchParams);
      } else {
        const data = await res.json();
        addToast(data.message || '削除に失敗しました。', 'error');
      }
    } catch (e) {
      addToast('通信中にエラーが発生しました。', 'error');
    }
  };

  // Dynamic field input change handler
  const handleFieldChange = (key: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // Advanced search input change handler
  const handleSearchParamChange = (key: string, value: string) => {
    setSearchParams(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // Check if standard field is enabled in configuration
  const isFieldEnabled = (key: string) => {
    const f = fields.find(field => field.field_key === key);
    return f ? f.is_enabled : true;
  };

  return (
    <div className="section-card kiosk-main-card" style={{ padding: '2rem', animation: 'fadeIn 0.2s ease-out' }}>
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CustomerIcon size={24} />
          <h2>顧客管理システム</h2>
        </div>
        <button 
          type="button" 
          className="btn btn-primary"
          onClick={handleOpenCreate}
        >
          新規顧客登録
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flex: 1, marginTop: '1rem', minHeight: 0, overflow: 'hidden' }}>
        
        {/* Left Side Pane: Search and List */}
        <div style={{ width: '340px', display: 'flex', flexDirection: 'column', gap: '1rem', borderRight: '1px solid var(--border-color)', paddingRight: '1.25rem' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="form-control"
                placeholder="名前・フリガナで検索"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                style={{ flex: 1, fontSize: '0.9rem', padding: '0.5rem' }}
              />
              <button type="submit" className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="検索">
                <SearchIcon size={16} />
              </button>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-text btn-xs"
                onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                style={{ padding: 0 }}
              >
                {showAdvancedSearch ? '▲ 簡易検索' : '▼ 詳細条件で絞り込む'}
              </button>
              {(searchKeyword || Object.values(searchParams).some(v => v)) && (
                <button
                  type="button"
                  className="btn btn-text btn-xs"
                  onClick={handleSearchReset}
                  style={{ color: 'var(--status-danger)', padding: 0 }}
                >
                  検索リセット
                </button>
              )}
            </div>

            {/* Advanced Search Filters dropdown */}
            {showAdvancedSearch && (
              <div className="section-card" style={{ padding: '1rem', animation: 'slideDown 0.15s ease-out', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                {isFieldEnabled('phone') && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>電話番号</label>
                    <input
                      type="text"
                      className="form-control"
                      value={searchParams.phone}
                      onChange={(e) => handleSearchParamChange('phone', e.target.value)}
                      style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                    />
                  </div>
                )}
                {isFieldEnabled('email') && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>メールアドレス</label>
                    <input
                      type="text"
                      className="form-control"
                      value={searchParams.email}
                      onChange={(e) => handleSearchParamChange('email', e.target.value)}
                      style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                    />
                  </div>
                )}
                {isFieldEnabled('address') && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>住所</label>
                    <input
                      type="text"
                      className="form-control"
                      value={searchParams.address}
                      onChange={(e) => handleSearchParamChange('address', e.target.value)}
                      style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                    />
                  </div>
                )}
                {fields.filter(f => f.is_custom && f.is_enabled && f.is_searchable).map(field => (
                  <div className="form-group" key={field.id} style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{field.field_name}</label>
                    {field.field_type === 'select' ? (
                      <select
                        className="form-control"
                        value={searchParams[field.field_key] || ''}
                        onChange={(e) => handleSearchParamChange(field.field_key, e.target.value)}
                        style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                      >
                        <option value="">すべて</option>
                        {field.options?.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                        className="form-control"
                        value={searchParams[field.field_key] || ''}
                        onChange={(e) => handleSearchParamChange(field.field_key, e.target.value)}
                        style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </form>

          {/* Customer list container */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {loadingList ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div className="spinner"></div>
              </div>
            ) : customers.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', fontSize: '0.9rem' }}>顧客が見つかりません</p>
            ) : (
              customers.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setSelectedCustomer(c); setIsEditMode(false); setIsNewMode(false); }}
                  className={`menu-button ${selectedCustomer?.id === c.id ? 'active' : ''}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    padding: '0.75rem 1rem',
                    textAlign: 'left',
                    borderRadius: 'var(--border-radius-sm)',
                    width: '100%',
                    background: selectedCustomer?.id === c.id ? 'var(--primary-light)' : 'transparent',
                    border: '1px solid ' + (selectedCustomer?.id === c.id ? 'var(--primary)' : 'var(--border-color)'),
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.kana}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>{c.name}</span>
                  {c.phone && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>TEL: {c.phone}</span>}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Side Pane: Details / Form */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingLeft: '0.5rem' }}>
          {isNewMode || isEditMode ? (
            /* Registry / Edit Form */
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '600px' }}>
              <h3>{isNewMode ? '顧客の新規登録' : '顧客情報の編集'}</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Input
                  id="cust_name"
                  type="text"
                  label="顧客名 (必須)"
                  value={formValues.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  placeholder="山田 太郎"
                  required
                />
                <Input
                  id="cust_kana"
                  type="text"
                  label="フリガナ (必須)"
                  value={formValues.kana}
                  onChange={(e) => handleFieldChange('kana', e.target.value)}
                  placeholder="ヤマダ タロウ"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {isFieldEnabled('phone') && (
                  <Input
                    id="cust_phone"
                    type="text"
                    label="電話番号"
                    value={formValues.phone}
                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                    placeholder="090-0000-0000"
                  />
                )}
                {isFieldEnabled('email') && (
                  <Input
                    id="cust_email"
                    type="email"
                    label="メールアドレス"
                    value={formValues.email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    placeholder="example@mail.com"
                  />
                )}
              </div>

              {isFieldEnabled('postal_code') && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                  <Input
                    id="cust_zip"
                    type="text"
                    label="郵便番号"
                    value={formValues.postal_code}
                    onChange={(e) => handleFieldChange('postal_code', e.target.value)}
                    placeholder="100-0001"
                  />
                  {isFieldEnabled('address') && (
                    <Input
                      id="cust_addr"
                      type="text"
                      label="住所"
                      value={formValues.address}
                      onChange={(e) => handleFieldChange('address', e.target.value)}
                      placeholder="東京都千代田区..."
                    />
                  )}
                </div>
              )}

              {/* Dynamic Custom Fields rendering */}
              {fields.filter(f => f.is_custom && f.is_enabled).map(field => (
                <div className="form-group" key={field.id}>
                  <label htmlFor={'field_' + field.field_key} className="form-label">{field.field_name}</label>
                  {field.field_type === 'select' ? (
                    <select
                      id={'field_' + field.field_key}
                      className="form-control"
                      value={formValues[field.field_key] || ''}
                      onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
                      style={{ padding: '0.6rem', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', color: 'var(--text-main)' }}
                    >
                      <option value="">未選択</option>
                      {field.options?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={'field_' + field.field_key}
                      type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                      className="form-control"
                      value={formValues[field.field_key] || ''}
                      onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
                      placeholder={`${field.field_name}を入力`}
                      style={{ padding: '0.6rem' }}
                    />
                  )}
                </div>
              ))}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setIsEditMode(false); setIsNewMode(false); }}
                  disabled={submitting}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? '保存中...' : '保存する'}
                </button>
              </div>
            </form>
          ) : selectedCustomer ? (
            /* Details view */
            <div style={{ animation: 'fadeIn 0.15s ease-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedCustomer.kana}</span>
                  <h2 style={{ margin: 0 }}>{selectedCustomer.name}</h2>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenEdit(selectedCustomer)}
                  >
                    編集
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      className="btn btn-text btn-sm"
                      onClick={() => handleDelete(selectedCustomer)}
                      style={{ color: 'var(--status-danger)' }}
                    >
                      削除
                    </button>
                  )}
                </div>
              </div>

              {/* Standard Fields Info list */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {isFieldEnabled('phone') && (
                  <div>
                    <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>電話番号</strong>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '1rem' }}>{selectedCustomer.phone || '-'}</p>
                  </div>
                )}
                {isFieldEnabled('email') && (
                  <div>
                    <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>メールアドレス</strong>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '1rem' }}>{selectedCustomer.email || '-'}</p>
                  </div>
                )}
                {isFieldEnabled('postal_code') && (
                  <div>
                    <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>郵便番号</strong>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '1rem' }}>{selectedCustomer.postal_code || '-'}</p>
                  </div>
                )}
                {isFieldEnabled('address') && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>住所</strong>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '1rem' }}>{selectedCustomer.address || '-'}</p>
                  </div>
                )}
              </div>

              {/* Dynamic Custom Fields Info */}
              {fields.filter(f => f.is_custom && f.is_enabled).length > 0 && (
                <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', padding: '1.25rem' }}>
                  <h4 style={{ marginTop: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>追加情報</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
                    {fields.filter(f => f.is_custom && f.is_enabled).map(field => {
                      const val = selectedCustomer.attributes?.[field.field_key];
                      return (
                        <div key={field.id}>
                          <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{field.field_name}</strong>
                          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.95rem', fontWeight: 500 }}>
                            {val !== undefined && val !== null && val !== '' ? val.toString() : '-'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* No selection placeholder */
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', padding: '4rem' }}>
              <CustomerIcon size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <p>左側のリストから顧客を選択するか、「新規顧客登録」を押してください。</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

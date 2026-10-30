import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import type { CatalogConfig, CatalogCategory, CatalogItem } from '../types/catalog';
import { ConfirmModal } from '../components/ui/ConfirmModal';

export const CatalogManagementPage: React.FC = () => {
  const { fetchWithAuth } = useAuth();
  
  // States
  const [, setConfig] = useState<CatalogConfig | null>(null);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  
  // Confirm Modal States
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  
  // Config Form States
  const [unlockPassword, setUnlockPassword] = useState<string>('');
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [deviceLabel, setDeviceLabel] = useState<string>('テーブル');
  
  // Category Form States
  const [editingCategory, setEditingCategory] = useState<Partial<CatalogCategory> | null>(null);
  const [catNameJa, setCatNameJa] = useState<string>('');
  const [catNameEn, setCatNameEn] = useState<string>('');
  const [catSortOrder, setCatSortOrder] = useState<number>(0);
  
  // Item Form States
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<Partial<CatalogItem> | null>(null);
  const [itemNameJa, setItemNameJa] = useState<string>('');
  const [itemNameEn, setItemNameEn] = useState<string>('');
  const [itemDescJa, setItemDescJa] = useState<string>('');
  const [itemDescEn, setItemDescEn] = useState<string>('');
  const [itemPrice, setItemPrice] = useState<string>('');
  const [itemImagePath, setItemImagePath] = useState<string>('');
  const [itemSortOrder, setItemSortOrder] = useState<number>(0);

  // Helper to parse localized text
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

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Config
      const configRes = await fetchWithAuth('/api/catalog/config');
      if (configRes.ok) {
        const configData = await configRes.json();
        const conf: CatalogConfig = configData.data;
        setConfig(conf);
        setShowPrice(conf.show_price);
        setDeviceLabel(conf.device_label);
      }

      // 2. Categories with Items
      const catalogRes = await fetchWithAuth('/api/catalog/categories');
      if (catalogRes.ok) {
        const catalogData = await catalogRes.json();
        const cats: CatalogCategory[] = catalogData.data;
        setCategories(cats);
        if (cats.length > 0 && !selectedCatId) {
          setSelectedCatId(cats[0].id);
        }
      }
    } catch (err) {
      setError('データの読み込みに失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockPassword) {
      setError('ロック解除用パスワードを入力してください。');
      return;
    }

    try {
      const res = await fetchWithAuth('/api/catalog/config', {
        method: 'PUT',
        body: JSON.stringify({
          unlock_password: unlockPassword,
          show_price: showPrice,
          device_label: deviceLabel
        })
      });

      if (res.ok) {
        setSuccess('設定を保存しました。');
        setUnlockPassword('');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const errData = await res.json();
        setError(errData.message || '設定の保存に失敗しました。');
      }
    } catch (err) {
      setError('通信エラーが発生しました。');
    }
  };

  // Category Operations
  const handleEditCategory = (cat: CatalogCategory | null) => {
    if (cat) {
      setEditingCategory(cat);
      setCatNameJa(getLocalizedText(cat.name, 'ja'));
      setCatNameEn(getLocalizedText(cat.name, 'en'));
      setCatSortOrder(cat.sort_order);
    } else {
      setEditingCategory({});
      setCatNameJa('');
      setCatNameEn('');
      setCatSortOrder(categories.length);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNameJa) {
      setError('カテゴリ名（日本語）を入力してください。');
      return;
    }

    const localizedName = JSON.stringify({ ja: catNameJa, en: catNameEn });

    try {
      const res = await fetchWithAuth('/api/catalog/categories', {
        method: 'POST',
        body: JSON.stringify({
          id: editingCategory?.id,
          name: localizedName,
          sort_order: catSortOrder
        })
      });

      if (res.ok) {
        setEditingCategory(null);
        loadData();
      } else {
        alert('カテゴリの保存に失敗しました。');
      }
    } catch (err) {
      alert('通信エラーが発生しました。');
    }
  };

  const handleDeleteCategory = (catId: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'カテゴリの削除',
      message: 'このカテゴリおよび配下の全アイテムを削除してよろしいですか？この操作は取り消せません。',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await fetchWithAuth(`/api/catalog/categories/${catId}`, {
            method: 'DELETE'
          });
          if (res.ok) {
            setSuccess('カテゴリを削除しました。');
            loadData();
          } else {
            setError('カテゴリの削除に失敗しました。');
          }
        } catch (err) {
          setError('通信エラーが発生しました。');
        }
      }
    });
  };

  // Item Operations
  const handleEditItem = (item: CatalogItem | null) => {
    if (item) {
      setEditingItem(item);
      setItemNameJa(getLocalizedText(item.name, 'ja'));
      setItemNameEn(getLocalizedText(item.name, 'en'));
      setItemDescJa(getLocalizedText(item.description, 'ja'));
      setItemDescEn(getLocalizedText(item.description, 'en'));
      setItemPrice(item.price !== null ? String(item.price) : '');
      setItemImagePath(item.image_path || '');
      setItemSortOrder(item.sort_order);
    } else {
      setEditingItem({});
      setItemNameJa('');
      setItemNameEn('');
      setItemDescJa('');
      setItemDescEn('');
      setItemPrice('');
      setItemImagePath('');
      setItemSortOrder(0);
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatId) return;
    if (!itemNameJa) {
      setError('アイテム名（日本語）を入力してください。');
      return;
    }

    const localizedName = JSON.stringify({ ja: itemNameJa, en: itemNameEn });
    const localizedDesc = JSON.stringify({ ja: itemDescJa, en: itemDescEn });
    const priceVal = itemPrice === '' ? null : parseInt(itemPrice, 10);

    try {
      const res = await fetchWithAuth('/api/catalog/items', {
        method: 'POST',
        body: JSON.stringify({
          id: editingItem?.id,
          category_id: selectedCatId,
          name: localizedName,
          description: localizedDesc,
          price: priceVal,
          image_path: itemImagePath,
          sort_order: itemSortOrder
        })
      });

      if (res.ok) {
        setEditingItem(null);
        loadData();
      } else {
        alert('アイテムの保存に失敗しました。');
      }
    } catch (err) {
      alert('通信エラーが発生しました。');
    }
  };

  const handleDeleteItem = (itemId: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'アイテムの削除',
      message: 'このアイテムを削除してよろしいですか？',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await fetchWithAuth(`/api/catalog/items/${itemId}`, {
            method: 'DELETE'
          });
          if (res.ok) {
            setSuccess('アイテムを削除しました。');
            loadData();
          } else {
            setError('アイテムの削除に失敗しました。');
          }
        } catch (err) {
          setError('通信エラーが発生しました。');
        }
      }
    });
  };

  const selectedCategory = categories.find(c => c.id === selectedCatId);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        読み込み中...
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px', margin: '0 auto', color: 'var(--text-main)' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>カタログメニュー・設定管理</h2>

      {error && (
        <div style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger-text)', borderRadius: 'var(--border-radius-sm)', padding: '12px' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)', color: 'var(--color-success-text)', borderRadius: 'var(--border-radius-sm)', padding: '12px' }}>
          {success}
        </div>
      )}

      {/* Row 1: Kiosk Config Form */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', padding: '20px', boxShadow: 'var(--shadow-lg)' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)' }}>1. キオスク表示・セキュリティ設定</h3>
        <form onSubmit={handleSaveConfig} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>ロック解除用パスワード</label>
            <input
              type="password"
              placeholder="解除キーを設定 (例: 9999)"
              value={unlockPassword}
              onChange={e => setUnlockPassword(e.target.value)}
              style={{ width: '100%', height: '40px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '0 12px', color: 'var(--text-main)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>デバイスの呼称（ラベル）</label>
            <input
              type="text"
              placeholder="テーブル, 部屋, セット面..."
              value={deviceLabel}
              onChange={e => setDeviceLabel(e.target.value)}
              style={{ width: '100%', height: '40px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '0 12px', color: 'var(--text-main)' }}
            />
          </div>

          <div style={{ height: '40px', display: 'flex', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-main)' }}>
              <input
                type="checkbox"
                checked={showPrice}
                onChange={e => setShowPrice(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              画面に価格を表示する（飲食店等）
            </label>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ height: '40px' }}
          >
            設定を保存
          </button>
        </form>
      </div>

      {/* Row 2: Categories Section */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', padding: '20px', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)' }}>2. カテゴリ管理</h3>
          <button
            onClick={() => handleEditCategory(null)}
            className="btn btn-primary"
            style={{ height: '34px', padding: '0 14px', fontSize: '0.85rem' }}
          >
            新規追加
          </button>
        </div>

        {/* Categories Grid List */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          {categories.map(cat => (
            <div
              key={cat.id}
              onClick={() => setSelectedCatId(cat.id)}
              style={{
                background: selectedCatId === cat.id ? 'var(--primary-light)' : 'var(--bg-hover)',
                border: selectedCatId === cat.id ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                color: selectedCatId === cat.id ? 'var(--primary)' : 'var(--text-main)',
                borderRadius: 'var(--border-radius-sm)',
                padding: '8px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
            >
              <strong>{getLocalizedText(cat.name)}</strong>
              <button
                onClick={(e) => { e.stopPropagation(); handleEditCategory(cat); }}
                className="btn btn-text btn-xs"
                style={{ color: 'var(--primary)', padding: '2px 4px', fontSize: '0.8rem' }}
              >
                編集
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                className="btn btn-text btn-xs"
                style={{ color: 'var(--color-danger-text)', padding: '2px 4px', fontSize: '0.8rem' }}
              >
                削除
              </button>
            </div>
          ))}
        </div>

        {/* Category Edit Form Modal Overlay (Inline) */}
        {editingCategory && (
          <form onSubmit={handleSaveCategory} style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', alignItems: 'end', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>カテゴリ名 (日本語)</label>
              <input
                type="text"
                value={catNameJa}
                onChange={e => setCatNameJa(e.target.value)}
                style={{ width: '100%', height: '36px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '0 8px', color: 'var(--text-main)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>カテゴリ名 (英語)</label>
              <input
                type="text"
                value={catNameEn}
                onChange={e => setCatNameEn(e.target.value)}
                style={{ width: '100%', height: '36px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '0 8px', color: 'var(--text-main)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>並び順</label>
              <input
                type="number"
                value={catSortOrder}
                onChange={e => setCatSortOrder(parseInt(e.target.value, 10))}
                style={{ width: '100%', height: '36px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '0 8px', color: 'var(--text-main)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, height: '36px' }}>保存</button>
              <button type="button" onClick={() => setEditingCategory(null)} className="btn btn-secondary" style={{ flex: 1, height: '36px' }}>キャンセル</button>
            </div>
          </form>
        )}
      </div>

      {/* Row 3: Items Section */}
      {selectedCatId && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', padding: '20px', boxShadow: 'var(--shadow-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)' }}>
              3. 「{getLocalizedText(selectedCategory?.name)}」の掲載アイテム一覧
            </h3>
            <button
              onClick={() => handleEditItem(null)}
              className="btn btn-primary"
              style={{ height: '34px', padding: '0 14px', fontSize: '0.85rem' }}
            >
              アイテム追加
            </button>
          </div>

          {/* Item Edit Form Modal Overlay (Inline) */}
          {editingItem && (
            <form onSubmit={handleSaveItem} style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--primary)' }}>
                {editingItem.id ? 'アイテムの編集' : '新規アイテム登録'}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>アイテム名 (日本語)</label>
                  <input
                    type="text"
                    value={itemNameJa}
                    onChange={e => setItemNameJa(e.target.value)}
                    style={{ width: '100%', height: '36px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '0 8px', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>アイテム名 (英語)</label>
                  <input
                    type="text"
                    value={itemNameEn}
                    onChange={e => setItemNameEn(e.target.value)}
                    style={{ width: '100%', height: '36px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '0 8px', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>説明 (日本語)</label>
                  <textarea
                    value={itemDescJa}
                    onChange={e => setItemDescJa(e.target.value)}
                    style={{ width: '100%', height: '60px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '8px', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>説明 (英語)</label>
                  <textarea
                    value={itemDescEn}
                    onChange={e => setItemDescEn(e.target.value)}
                    style={{ width: '100%', height: '60px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '8px', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>価格 (¥)</label>
                  <input
                    type="number"
                    value={itemPrice}
                    onChange={e => setItemPrice(e.target.value)}
                    placeholder="空欄で価格なし"
                    style={{ width: '100%', height: '36px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '0 8px', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>画像URL</label>
                  <input
                    type="text"
                    value={itemImagePath}
                    onChange={e => setItemImagePath(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    style={{ width: '100%', height: '36px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '0 8px', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>表示順</label>
                  <input
                    type="number"
                    value={itemSortOrder}
                    onChange={e => setItemSortOrder(parseInt(e.target.value, 10))}
                    style={{ width: '100%', height: '36px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '0 8px', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignSelf: 'flex-end', marginTop: '8px' }}>
                <button type="submit" className="btn btn-primary" style={{ padding: '0 24px', height: '36px' }}>保存</button>
                <button type="button" onClick={() => setEditingItem(null)} className="btn btn-secondary" style={{ padding: '0 24px', height: '36px' }}>キャンセル</button>
              </div>
            </form>
          )}

          {/* Items Table List */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px' }}>画像</th>
                  <th style={{ padding: '12px' }}>名前 (日本語/英語)</th>
                  <th style={{ padding: '12px' }}>説明</th>
                  <th style={{ padding: '12px' }}>価格</th>
                  <th style={{ padding: '12px' }}>表示順</th>
                  <th style={{ padding: '12px' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {selectedCategory?.items?.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ width: '50px', height: '50px', background: item.image_path ? `url(${item.image_path}) center/cover` : 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)' }}></div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <strong>{getLocalizedText(item.name, 'ja')}</strong>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{getLocalizedText(item.name, 'en')}</div>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getLocalizedText(item.description, 'ja')}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>
                      {item.price !== null ? `¥${item.price.toLocaleString()}` : '-'}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{item.sort_order}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                          onClick={() => handleEditItem(item)}
                          className="btn btn-text btn-xs"
                          style={{ color: 'var(--primary)' }}
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="btn btn-text btn-xs"
                          style={{ color: 'var(--color-danger-text)' }}
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!selectedCategory?.items || selectedCategory.items.length === 0) && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>登録されたアイテムはありません。</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        isDanger={true}
        confirmText="削除する"
        cancelText="キャンセル"
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

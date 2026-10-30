import React, { useRef, useEffect, useState } from 'react';
import { useInventory, type StockItem, type StocktakeItem } from '../hooks/useInventory';
import { Input } from './ui/Input';
import { NumberInput } from './ui/NumberInput';
import { TextArea } from './ui/TextArea';
import { StockIcon, LockIcon } from './ui/Icons';
 
interface InventoryManagementProps {
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}
 
export const InventoryManagement: React.FC<InventoryManagementProps> = ({ addToast }) => {
  const {
    mode,
    setMode,
    stocks,
    loadingStocks,
    keyword,
    setKeyword,
    voucherItems,
    addStockToVoucher,
    removeVoucherItem,
    updateVoucherItemQuantity,
    confirmVoucher,
    submittingVoucher,
    stocktakeItems,
    getSortedStocktakeItems,
    updateStocktakeActualQty,
    confirmStocktakeRow,
    submittingStocktake,
    selectedStockId,
    setSelectedStockId,
    historyLogs,
    loadingHistory,
    selectStockForHistory,
    createStock,
  } = useInventory(addToast);

  // New stock registration states
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newProductName, setNewProductName] = useState<string>('');
  const [newProductCode, setNewProductCode] = useState<string>('');
  const [newQuantity, setNewQuantity] = useState<number>(0);
  const [newMinQuantity, setNewMinQuantity] = useState<number>(0);
  const [newJanCode, setNewJanCode] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newImageUrl, setNewImageUrl] = useState<string>('');
  const [newPrice, setNewPrice] = useState<number>(0);
  const [newBrandName, setNewBrandName] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [submittingNewStock, setSubmittingNewStock] = useState<boolean>(false);

  // Input refs for Stocktake focus management
  const stocktakeInputRefs = useRef<{ [stockId: number]: HTMLInputElement | null }>({});

  // Sparkline generator
  const renderSparkline = (quantities: number[]) => {
    if (!quantities || quantities.length === 0) {
      return <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>記録なし</span>;
    }
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

  // Auto-focus first row of stocktake when mode changes to stocktake
  useEffect(() => {
    if (mode === 'stocktake' && stocktakeItems.length > 0) {
      const sorted = getSortedStocktakeItems();
      // Find the first unconfirmed item
      const firstUnconfirmed = sorted.find(item => !item.isConfirmed);
      const targetId = firstUnconfirmed ? firstUnconfirmed.stockId : sorted[0].stockId;
      
      const timer = setTimeout(() => {
        const input = stocktakeInputRefs.current[targetId];
        if (input) {
          input.focus();
          input.select();
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [mode]);

  // Handle Enter key in Stocktake Row
  const handleStocktakeKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    item: StocktakeItem,
    sortedList: StocktakeItem[]
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // 1. Trigger Row confirmation
      confirmStocktakeRow(item.stockId);

      // 2. Focus Management: Find current row and shift focus down to next unconfirmed or next row
      const currentIndex = sortedList.findIndex(x => x.stockId === item.stockId);
      if (currentIndex !== -1 && currentIndex + 1 < sortedList.length) {
        const nextItem = sortedList[currentIndex + 1];
        setTimeout(() => {
          const nextInput = stocktakeInputRefs.current[nextItem.stockId];
          if (nextInput) {
            nextInput.focus();
            nextInput.select();
          }
        }, 80);
      }
    }
  };

  // Add new product submit handler
  const handleCreateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) return;
    setSubmittingNewStock(true);

    const success = await createStock(
      newProductName,
      newQuantity,
      newMinQuantity,
      newProductCode,
      newJanCode,
      newDescription,
      newImageUrl,
      newPrice || undefined,
      newBrandName,
      newCategoryName
    );

    if (success) {
      // Reset form
      setNewProductName('');
      setNewProductCode('');
      setNewQuantity(0);
      setNewMinQuantity(0);
      setNewJanCode('');
      setNewDescription('');
      setNewImageUrl('');
      setNewPrice(0);
      setNewBrandName('');
      setNewCategoryName('');
      setShowAddModal(false);
    }
    setSubmittingNewStock(false);
  };

  // Right-pane click actions based on mode
  const handleRightPaneItemClick = (stock: StockItem) => {
    if (mode === 'inbound' || mode === 'outbound') {
      addStockToVoucher(stock);
    } else if (mode === 'history') {
      selectStockForHistory(stock.id);
    } else if (mode === 'details') {
      setSelectedStockId(stock.id);
    }
    // Stocktake master pane is disabled/locked, so clicking won't fire.
  };

  // Master List spotlight & coloring helpers in Stocktake mode
  const getStocktakeRowHighlight = (stockId: number): string => {
    if (mode !== 'stocktake') return '';
    const stocktakeRow = stocktakeItems.find(item => item.stockId === stockId);
    if (!stocktakeRow || !stocktakeRow.isConfirmed) return '';
    
    if (stocktakeRow.discrepancy === 'match') return 'stocktake-match';
    if (stocktakeRow.discrepancy === 'shortage') return 'stocktake-shortage';
    if (stocktakeRow.discrepancy === 'surplus') return 'stocktake-surplus';
    return '';
  };

  const isRowSpotlighted = (stockId: number): boolean => {
    if (mode !== 'stocktake') return true;
    const stocktakeRow = stocktakeItems.find(item => item.stockId === stockId);
    return !!(stocktakeRow && stocktakeRow.isConfirmed);
  };

  const sortedStocktakeList = getSortedStocktakeItems();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', gap: '1rem' }}>
      
      {/* 2-Pane Layout Core Controls (Global Mode Switcher & Search Bar) */}
      <div className="section-card" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        
        {/* Header Mode Toggle Switchers */}
        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-app)', padding: '0.25rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'details' ? 'btn-primary' : 'btn-text'}`}
            onClick={() => setMode('details')}
            style={{ borderRadius: '6px', padding: '0.5rem 1rem' }}
          >
            詳細
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'inbound' ? 'btn-primary' : 'btn-text'}`}
            onClick={() => setMode('inbound')}
            style={{ borderRadius: '6px', padding: '0.5rem 1rem' }}
          >
            入庫
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'outbound' ? 'btn-primary' : 'btn-text'}`}
            onClick={() => setMode('outbound')}
            style={{ borderRadius: '6px', padding: '0.5rem 1rem' }}
          >
            出庫
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'stocktake' ? 'btn-primary' : 'btn-text'}`}
            onClick={() => setMode('stocktake')}
            style={{ borderRadius: '6px', padding: '0.5rem 1rem' }}
          >
            棚卸し
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'history' ? 'btn-primary' : 'btn-text'}`}
            onClick={() => setMode('history')}
            style={{ borderRadius: '6px', padding: '0.5rem 1rem' }}
          >
            履歴
          </button>
        </div>

        {/* Global master list controls */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1, justifyContent: 'flex-end', minWidth: '300px' }}>
          <div className="search-input-wrapper" style={{ margin: 0, width: '100%', maxWidth: '300px' }}>
            <input
              type="text"
              className="form-control search-input"
              placeholder="商品名で検索..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: '100%', paddingLeft: '1rem' }}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
            style={{ whiteSpace: 'nowrap' }}
          >
            新規登録
          </button>
        </div>
      </div>

      {/* 2-Pane Screen Layout */}
      <div className="inventory-container">
        
        {/* Left Pane (Action Area) - 1/3 Width */}
        <div className="action-pane slide-in-right">
          
          {/* Action Pane Title bar */}
          <div className="pane-header">
            <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {mode === 'details' && '製品詳細情報'}
              {mode === 'inbound' && '入庫伝票シート'}
              {mode === 'outbound' && '出庫伝票シート'}
              {mode === 'stocktake' && '棚卸入力シート'}
              {mode === 'history' && 'アクションタイムライン'}
            </h3>
            {mode === 'inbound' || mode === 'outbound' ? (
              <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
                {voucherItems.length} 行
              </span>
            ) : null}
          </div>

          {/* Action Pane Contents */}
          <div className="pane-body-scrollable" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
            
            {/* Mode E: Product Details */}
            {mode === 'details' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {!selectedStockId ? (
                  <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: '0.9rem' }}>右側のマスター在庫一覧から商品をクリックして、詳細情報を表示してください。</p>
                  </div>
                ) : (() => {
                  const selectedStock = stocks.find(s => s.id === selectedStockId);
                  if (!selectedStock) {
                    return (
                      <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <p style={{ fontSize: '0.9rem' }}>選択された商品が見つかりません。</p>
                      </div>
                    );
                  }

                  const isGood = selectedStock.quantity > selectedStock.minimum_quantity;
                  const isWarning = selectedStock.quantity === selectedStock.minimum_quantity;
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

                  const formattedCreatedAt = new Date(selectedStock.created_at).toLocaleString('ja-JP', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });

                  const formattedUpdatedAt = new Date(selectedStock.updated_at).toLocaleString('ja-JP', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });

                  const formattedPrice = selectedStock.price !== null && selectedStock.price !== undefined
                    ? `${selectedStock.price.toLocaleString('ja-JP')} 円`
                    : '未設定';

                  return (
                    <div className="product-details-pane" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {/* Product Image Preview if exists */}
                      {selectedStock.image_url && (
                        <div style={{ width: '100%', height: '180px', borderRadius: 'var(--border-radius-md)', overflow: 'hidden', background: '#f1f5f9', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img 
                            src={selectedStock.image_url} 
                            alt={selectedStock.product_name} 
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}

                      <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                            コード: {selectedStock.attributes?.code || '未設定'}
                          </span>
                          {selectedStock.jan_code && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                              JAN: {selectedStock.jan_code}
                            </span>
                          )}
                        </div>
                        <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                          {selectedStock.product_name}
                        </h4>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="metric-card" style={{ padding: '1rem', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>現在庫数</span>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>{selectedStock.quantity}</span>
                            {selectedStock.on_order_quantity !== undefined && selectedStock.on_order_quantity > 0 && (
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>(発注中: {selectedStock.on_order_quantity})</span>
                            )}
                          </div>
                        </div>
                        <div className="metric-card" style={{ padding: '1rem', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>安全しきい値</span>
                          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>{selectedStock.minimum_quantity}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ステータス</span>
                          <span className={`badge ${statusClass}`} style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}>{statusText}</span>
                        </div>
                        <div style={{ height: '1px', background: 'var(--border-color)' }}></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ブランド・メーカー</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{selectedStock.brand_name || '未設定'}</span>
                        </div>
                        <div style={{ height: '1px', background: 'var(--border-color)' }}></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>カテゴリ</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{selectedStock.category_name || '未設定'}</span>
                        </div>
                        <div style={{ height: '1px', background: 'var(--border-color)' }}></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>参考価格</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}>{formattedPrice}</span>
                        </div>
                        <div style={{ height: '1px', background: 'var(--border-color)' }}></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>商品ID</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 500, fontFamily: 'var(--mono)' }}>#{selectedStock.id}</span>
                        </div>
                        <div style={{ height: '1px', background: 'var(--border-color)' }}></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>登録日時</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{formattedCreatedAt}</span>
                        </div>
                        <div style={{ height: '1px', background: 'var(--border-color)' }}></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>最終更新日</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{formattedUpdatedAt}</span>
                        </div>
                      </div>

                      {/* Product Description if exists */}
                      {selectedStock.description && (
                        <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>商品説明・仕様</span>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                            {selectedStock.description}
                          </p>
                        </div>
                      )}

                      {/* Sparkline trend representation in Details pane */}
                      <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>過去7日間の在庫推移</span>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem 0' }}>
                          {renderSparkline(selectedStock.recent_quantities)}
                        </div>
                        {selectedStock.recent_quantities && selectedStock.recent_quantities.length > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <span>最初: {selectedStock.recent_quantities[0]}</span>
                            <span>最新: {selectedStock.recent_quantities[selectedStock.recent_quantities.length - 1]}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Mode A/B: Inbound & Outbound Voucher */}
            {(mode === 'inbound' || mode === 'outbound') && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {voucherItems.length === 0 ? (
                    <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <p style={{ fontSize: '0.9rem' }}>右側のマスター在庫一覧から商品をクリックして、伝票に追加してください。</p>
                    </div>
                  ) : (
                    <table className="stock-table" style={{ fontSize: '0.9rem' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '0.5rem' }}>商品名</th>
                          <th style={{ padding: '0.5rem', width: '90px', textAlign: 'right' }}>数量</th>
                          <th style={{ padding: '0.5rem', width: '40px', textAlign: 'center' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {voucherItems.map((item, index) => (
                          <tr key={`${item.stockId}-${index}`}>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>{item.product_name}</div>
                              {item.code && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{item.code}</span>}
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                              <input
                                type="number"
                                className="spreadsheet-input"
                                min="1"
                                max={mode === 'outbound' ? item.maxQuantity : undefined}
                                value={item.quantity}
                                onChange={(e) => updateVoucherItemQuantity(index, parseInt(e.target.value, 10) || 0)}
                                style={{ width: '70px', padding: '0.25rem' }}
                              />
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-xs btn-text"
                                onClick={() => removeVoucherItem(index)}
                                style={{ color: 'var(--status-alert)', padding: '0.2rem', fontSize: '1rem', lineHeight: 1 }}
                                title="行を削除"
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                
                {voucherItems.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={confirmVoucher}
                      disabled={submittingVoucher}
                      style={{ width: '100%' }}
                    >
                      {submittingVoucher ? '送信中...' : '確定 (一括更新)'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mode C: Stocktake Spreadsheet-like Input Sheet */}
            {mode === 'stocktake' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {stocktakeItems.length === 0 ? (
                    <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      読み込み中...
                    </div>
                  ) : (
                    <table className="stock-table" style={{ fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '0.5rem' }}>商品名</th>
                          <th style={{ padding: '0.5rem', width: '50px', textAlign: 'right' }}>理論</th>
                          <th style={{ padding: '0.5rem', width: '80px', textAlign: 'right' }}>実在庫</th>
                          <th style={{ padding: '0.5rem', width: '50px', textAlign: 'center' }}>判定</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedStocktakeList.map((item) => {
                          let labelClass = 'badge-secondary';
                          let labelText = '未処理';
                          
                          if (item.isConfirmed) {
                            if (item.discrepancy === 'match') {
                              labelClass = 'badge-good';
                              labelText = '一致';
                            } else if (item.discrepancy === 'shortage') {
                              labelClass = 'badge-alert';
                              labelText = '不足';
                            } else if (item.discrepancy === 'surplus') {
                              labelClass = 'badge-warning';
                              labelText = '過剰';
                            }
                          }

                          return (
                            <tr
                              key={item.stockId}
                              className={`stocktake-table-row spreadsheet-row ${item.isConfirmed ? (item.discrepancy === 'match' ? 'stocktake-match' : item.discrepancy === 'shortage' ? 'stocktake-shortage' : 'stocktake-surplus') : ''}`}
                            >
                              <td style={{ padding: '0.6rem 0.4rem', fontWeight: 500 }}>
                                <div>{item.product_name}</div>
                              </td>
                              <td style={{ padding: '0.6rem 0.4rem', textAlign: 'right', fontFamily: 'var(--mono)' }}>
                                {item.systemStock}
                              </td>
                              <td style={{ padding: '0.6rem 0.4rem', textAlign: 'right' }}>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  ref={el => { stocktakeInputRefs.current[item.stockId] = el; }}
                                  className="spreadsheet-input"
                                  value={item.actualStock}
                                  onChange={(e) => updateStocktakeActualQty(item.stockId, e.target.value)}
                                  onKeyDown={(e) => handleStocktakeKeyDown(e, item, sortedStocktakeList)}
                                  disabled={submittingStocktake[item.stockId]}
                                  placeholder="未入力"
                                />
                              </td>
                              <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center' }}>
                                <span className={`badge ${labelClass}`} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
                                  {labelText}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
                <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'var(--primary-light)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(79, 70, 229, 0.1)' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                    <strong>キーボード操作:</strong> 実在庫を入力し、<code>[Enter]</code> を押すと確定して自動的に次の行に進みます。
                  </p>
                </div>
              </div>
            )}

            {/* Mode D: History Action Timeline */}
            {mode === 'history' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {!selectedStockId ? (
                  <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: '0.9rem' }}>右側のマスター在庫一覧から商品をクリックして、履歴を表示してください。</p>
                  </div>
                ) : loadingHistory ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem' }}>
                    <div className="spinner"></div>
                    <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>履歴ロード中...</p>
                  </div>
                ) : historyLogs.length === 0 ? (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: '0.9rem' }}>この商品の履歴ログは見つかりませんでした。</p>
                  </div>
                ) : (
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <div style={{ marginBottom: '1rem', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                      {stocks.find(s => s.id === selectedStockId)?.product_name} の履歴
                    </div>
                    <div className="timeline">
                      {historyLogs.map((log) => {
                        let opLabel = '作成';
                        let diffText = `+${log.new_quantity}`;
                        let isPositive = true;
                        
                        if (log.operation === 'in') {
                          opLabel = '入庫';
                          diffText = `+${log.new_quantity - log.prior_quantity}`;
                          isPositive = true;
                        } else if (log.operation === 'out') {
                          opLabel = '出庫';
                          diffText = `-${log.prior_quantity - log.new_quantity}`;
                          isPositive = false;
                        } else if (log.operation === 'stocktake') {
                          opLabel = '棚卸';
                          const diff = log.new_quantity - log.prior_quantity;
                          diffText = diff >= 0 ? `+${diff}` : `${diff}`;
                          isPositive = diff >= 0;
                        }

                        const dateString = new Date(log.created_at).toLocaleString('ja-JP', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        });

                        return (
                          <div className="timeline-item" key={log.id}>
                            <div className={`timeline-dot ${log.operation}`}></div>
                            <div className="timeline-content">
                              <div className="timeline-header">
                                <span className="timeline-title">{opLabel}</span>
                                <span>{dateString}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  在庫数: {log.prior_quantity} → {log.new_quantity}
                                </span>
                                <span className={`timeline-qty ${isPositive ? 'positive' : 'negative'}`}>
                                  {diffText}
                                </span>
                              </div>
                              {log.operator_name && (
                                <div className="timeline-operator">
                                  担当: {log.operator_name}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Vector Arrow Area (Between Panes) */}
        <div className="vector-arrow-container">
          {mode === 'details' && (
            <div className="vector-arrow" style={{ opacity: 0.3, transform: 'scale(0.8)', fontSize: '0.9rem' }} title="詳細表示">
              詳細
            </div>
          )}
          {mode === 'inbound' && (
            <div className={`vector-arrow arrow-right-dir ${submittingVoucher ? 'arrow-submitting-right' : ''}`} title="伝票 (左) からマスター (右) へ入庫反映">
              →
            </div>
          )}
          {mode === 'outbound' && (
            <div className={`vector-arrow arrow-left-dir ${submittingVoucher ? 'arrow-submitting-left' : ''}`} title="マスター (右) から伝票 (左) へ出庫反映">
              ←
            </div>
          )}
          {mode === 'stocktake' && (
            <div className="vector-arrow" style={{ opacity: 0.5, transform: 'scale(0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="棚卸し同期ロック中">
              <LockIcon size={20} />
            </div>
          )}
          {mode === 'history' && (
            <div className="vector-arrow" style={{ opacity: 0.5, transform: 'scale(0.8)', fontSize: '0.8rem' }} title="履歴読み込み">
              履歴
            </div>
          )}
        </div>

        {/* Right Pane (Master Inventory List) - 2/3 Width */}
        <div className={`master-pane ${mode === 'stocktake' ? 'locked-master' : ''}`}>
          
          <div className="pane-header">
            <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              マスター在庫一覧
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              全 {stocks.length} 件
            </span>
          </div>

          <div className="pane-body-scrollable">
            {loadingStocks ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6rem' }}>
                <div className="spinner"></div>
                <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>読み込み中...</p>
              </div>
            ) : stocks.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '4rem' }}>
                <StockIcon size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                <h3>登録されている商品がありません</h3>
              </div>
            ) : (
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>コード</th>
                    <th>商品名</th>
                    <th style={{ textAlign: 'right' }}>現在庫数</th>
                    <th style={{ textAlign: 'right' }}>しきい値</th>
                    <th>ステータス</th>
                    <th>過去7日間の推移</th>
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

                    // Spotlighting logic
                    const spotlightClass = isRowSpotlighted(stock.id) ? 'spotlight-row' : '';
                    const stocktakeHighlight = getStocktakeRowHighlight(stock.id);

                    return (
                      <tr
                        key={stock.id}
                        onClick={() => handleRightPaneItemClick(stock)}
                        className={`${spotlightClass} ${stocktakeHighlight}`}
                        style={{
                          cursor: mode === 'stocktake' ? 'default' : 'pointer',
                          transition: 'all 0.25s ease'
                        }}
                      >
                        <td style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem' }}>
                          {stock.attributes?.code || `#${stock.id}`}
                        </td>
                        <td style={{ fontWeight: 500, color: 'var(--text-main)' }}>
                          {stock.product_name}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '1.05rem' }}>
                          <div>{stock.quantity}</div>
                          {stock.on_order_quantity !== undefined && stock.on_order_quantity > 0 && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal', marginTop: '0.1rem' }}>
                              (発注中: {stock.on_order_quantity})
                            </div>
                          )}
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* Product Registration Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>在庫商品の新規登録</h2>
              <p>新しく倉庫・組織に登録する在庫商品の基本情報を入力してください。</p>
            </div>
            
            <form onSubmit={handleCreateStock} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '55vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                <Input
                  id="modalProductName"
                  type="text"
                  label="商品名 (必須)"
                  placeholder="例: ノートパソコン Core i7"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  required
                  containerClassName="form-group"
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <Input
                    id="modalProductCode"
                    type="text"
                    label="商品コード"
                    placeholder="例: PC-001"
                    value={newProductCode}
                    onChange={(e) => setNewProductCode(e.target.value)}
                    containerClassName="form-group"
                  />
                  
                  <Input
                    id="modalJanCode"
                    type="text"
                    label="JANコード"
                    placeholder="例: 4901234567890"
                    value={newJanCode}
                    onChange={(e) => setNewJanCode(e.target.value)}
                    containerClassName="form-group"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <Input
                    id="modalBrandName"
                    type="text"
                    label="ブランド・メーカー"
                    placeholder="例: Apple"
                    value={newBrandName}
                    onChange={(e) => setNewBrandName(e.target.value)}
                    containerClassName="form-group"
                  />

                  <Input
                    id="modalCategoryName"
                    type="text"
                    label="カテゴリ"
                    placeholder="例: パソコン・周辺機器"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    containerClassName="form-group"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <NumberInput
                    id="modalPrice"
                    label="参考価格 (円)"
                    min={0}
                    value={newPrice}
                    onChange={(e) => setNewPrice(parseInt(e.target.value, 10) || 0)}
                    containerClassName="form-group"
                  />

                  <Input
                    id="modalImageUrl"
                    type="url"
                    label="画像URL"
                    placeholder="例: https://example.com/image.jpg"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    containerClassName="form-group"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem' }}>
                  <NumberInput
                    id="modalInitialQty"
                    label="初期在庫数"
                    min={0}
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(parseInt(e.target.value, 10) || 0)}
                    containerClassName="form-group"
                  />

                  <NumberInput
                    id="modalMinQty"
                    label="安全しきい値 (警告ライン)"
                    min={0}
                    value={newMinQuantity}
                    onChange={(e) => setNewMinQuantity(parseInt(e.target.value, 10) || 0)}
                    containerClassName="form-group"
                  />
                </div>

                <TextArea
                  id="modalDescription"
                  label="商品説明・仕様"
                  placeholder="商品の詳しい説明や仕様を入力してください。"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  containerClassName="form-group"
                />
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowAddModal(false)}
                  disabled={submittingNewStock}
                >
                  キャンセル
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submittingNewStock}
                >
                  {submittingNewStock ? '登録中...' : '登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

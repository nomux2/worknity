import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export interface StockItem {
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
  jan_code?: string | null;
  description?: string | null;
  image_url?: string | null;
  price?: number | null;
  brand_name?: string | null;
  category_name?: string | null;
  on_order_quantity?: number;
}

export type InventoryMode = 'details' | 'inbound' | 'outbound' | 'stocktake' | 'history';

export interface VoucherItem {
  stockId: number;
  product_name: string;
  quantity: number;
  maxQuantity: number;
  code?: string;
}

export interface StocktakeItem {
  stockId: number;
  product_name: string;
  code?: string;
  systemStock: number;
  actualStock: string; // Keep as string for numeric input typing
  isConfirmed: boolean;
  discrepancy: 'match' | 'shortage' | 'surplus' | null;
}

export interface HistoryLog {
  id: number;
  operation: 'create' | 'in' | 'out' | 'stocktake';
  prior_quantity: number;
  new_quantity: number;
  created_at: string;
  operator_name: string | null;
}

export const useInventory = (addToast: (msg: string, type?: 'success' | 'error' | 'warning') => void) => {
  const { fetchWithAuth, user } = useAuth();

  const [mode, setModeState] = useState<InventoryMode>('details');
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loadingStocks, setLoadingStocks] = useState<boolean>(false);
  const [keyword, setKeyword] = useState<string>('');

  // Voucher Items for Inbound/Outbound
  const [voucherItems, setVoucherItems] = useState<VoucherItem[]>([]);
  const [submittingVoucher, setSubmittingVoucher] = useState<boolean>(false);

  // Stocktake Items
  const [stocktakeItems, setStocktakeItems] = useState<StocktakeItem[]>([]);
  const [submittingStocktake, setSubmittingStocktake] = useState<{ [stockId: number]: boolean }>({});

  // History state
  const [selectedStockId, setSelectedStockId] = useState<number | null>(null);
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Fetch stocks from API
  const fetchStocks = useCallback(async (searchKeyword = '') => {
    setLoadingStocks(true);
    try {
      const res = await fetchWithAuth(`/api/stocks?keyword=${encodeURIComponent(searchKeyword)}`);
      if (res.ok) {
        const payload = await res.json();
        setStocks(payload.data || []);
      } else {
        addToast('在庫データの取得に失敗しました。', 'error');
      }
    } catch (e) {
      console.error(e);
      addToast('在庫データの取得に失敗しました。', 'error');
    } finally {
      setLoadingStocks(false);
    }
  }, [fetchWithAuth, addToast]);

  // Debounced Search trigger
  useEffect(() => {
    const delay = setTimeout(() => {
      fetchStocks(keyword);
    }, 300);
    return () => clearTimeout(delay);
  }, [keyword, user?.organization_id, fetchStocks]);

  // Handle Mode Change
  const setMode = useCallback((newMode: InventoryMode) => {
    setModeState(newMode);
    // Reset secondary states depending on mode
    if (newMode !== 'history' && newMode !== 'details') {
      setSelectedStockId(null);
      setHistoryLogs([]);
    }
    if (newMode === 'stocktake') {
      // Initialize stocktake items from the current stocks
      const initialItems: StocktakeItem[] = stocks.map(stock => ({
        stockId: stock.id,
        product_name: stock.product_name,
        code: stock.attributes?.code,
        systemStock: stock.quantity,
        actualStock: '',
        isConfirmed: false,
        discrepancy: null,
      }));
      setStocktakeItems(initialItems);
    } else {
      setStocktakeItems([]);
    }
  }, [stocks]);

  // Re-sync stocktake list if stockmaster changes (but preserve inputs if possible)
  useEffect(() => {
    if (mode === 'stocktake' && stocktakeItems.length === 0 && stocks.length > 0) {
      const initialItems: StocktakeItem[] = stocks.map(stock => ({
        stockId: stock.id,
        product_name: stock.product_name,
        code: stock.attributes?.code,
        systemStock: stock.quantity,
        actualStock: '',
        isConfirmed: false,
        discrepancy: null,
      }));
      setStocktakeItems(initialItems);
    }
  }, [stocks, mode, stocktakeItems.length]);

  // Add Item from Master list to Voucher Sheet (Inbound/Outbound)
  const addStockToVoucher = useCallback((stock: StockItem) => {
    setVoucherItems(prev => {
      // Duplicate behavior: instantly added as a new row even if duplicate, as requested in spec.
      const newItem: VoucherItem = {
        stockId: stock.id,
        product_name: stock.product_name,
        quantity: 1,
        maxQuantity: stock.quantity,
        code: stock.attributes?.code,
      };
      return [...prev, newItem];
    });
    addToast(`「${stock.product_name}」を伝票に追加しました。`, 'success');
  }, [addToast]);

  // Remove Item from Voucher Sheet
  const removeVoucherItem = useCallback((index: number) => {
    setVoucherItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Update quantity of Voucher Item
  const updateVoucherItemQuantity = useCallback((index: number, quantity: number) => {
    setVoucherItems(prev => prev.map((item, i) => i === index ? { ...item, quantity } : item));
  }, []);

  // Submit Inbound/Outbound Voucher batch updates
  const confirmVoucher = useCallback(async () => {
    if (voucherItems.length === 0) {
      addToast('伝票に商品がありません。', 'warning');
      return;
    }

    // Validation
    for (const item of voucherItems) {
      if (isNaN(item.quantity) || item.quantity <= 0) {
        addToast(`「${item.product_name}」の数量を正しく入力してください。`, 'warning');
        return;
      }
      if (mode === 'outbound' && item.quantity > item.maxQuantity) {
        addToast(`「${item.product_name}」の出庫数が在庫数を超えています。`, 'warning');
        return;
      }
    }

    setSubmittingVoucher(true);

    const originalStocks = [...stocks];
    const opType = mode === 'inbound' ? 'inflow' : 'outflow';

    // Optimistically update right master list quantities
    setStocks(prev => prev.map(s => {
      const voucherRows = voucherItems.filter(v => v.stockId === s.id);
      if (voucherRows.length > 0) {
        const totalDelta = voucherRows.reduce((acc, curr) => acc + curr.quantity, 0);
        const optimisticQuantity = mode === 'inbound' 
          ? s.quantity + totalDelta 
          : Math.max(0, s.quantity - totalDelta);

        const updatedRecent = [...s.recent_quantities];
        if (updatedRecent.length >= 7) {
          updatedRecent.shift();
        }
        updatedRecent.push(optimisticQuantity);

        return {
          ...s,
          quantity: optimisticQuantity,
          recent_quantities: updatedRecent,
        };
      }
      return s;
    }));

    // Trigger sequential or parallel updates
    try {
      const promises = voucherItems.map(async (item) => {
        const url = `/api/stocks/${item.stockId}/${opType}`;
        const body = JSON.stringify({ quantity: item.quantity });
        const res = await fetchWithAuth(url, { method: 'POST', body });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || `${item.product_name}の処理に失敗しました。`);
        }
        return res.json();
      });

      const updatedStockResults = await Promise.all(promises);
      
      // Update master list with official responses
      setStocks(prev => prev.map(s => {
        const official = updatedStockResults.find(r => r.id === s.id);
        return official || s;
      }));

      addToast(`一括確定処理が完了しました。`, 'success');
      setVoucherItems([]); // Clear Voucher
    } catch (err: any) {
      console.error(err);
      setStocks(originalStocks); // Rollback
      addToast(err.message || '一括更新中にエラーが発生しました。変更をロールバックしました。', 'error');
    } finally {
      setSubmittingVoucher(false);
    }
  }, [voucherItems, mode, stocks, fetchWithAuth, addToast]);

  // Update Stocktake actual quantity input
  const updateStocktakeActualQty = useCallback((stockId: number, qtyString: string) => {
    setStocktakeItems(prev => prev.map(item => 
      item.stockId === stockId ? { ...item, actualStock: qtyString } : item
    ));
  }, []);

  // Sort helper for Stocktake Sheet: Anomaly rows to top, then Unprocessed, then Matched
  const getSortedStocktakeItems = useCallback(() => {
    return [...stocktakeItems].sort((a, b) => {
      const aIsAnomaly = a.isConfirmed && (a.discrepancy === 'shortage' || a.discrepancy === 'surplus');
      const bIsAnomaly = b.isConfirmed && (b.discrepancy === 'shortage' || b.discrepancy === 'surplus');

      if (aIsAnomaly && !bIsAnomaly) return -1;
      if (!aIsAnomaly && bIsAnomaly) return 1;

      // Both anomaly or both not anomaly
      const aIsUnprocessed = !a.isConfirmed;
      const bIsUnprocessed = !b.isConfirmed;

      if (aIsUnprocessed && !bIsUnprocessed) return -1;
      if (!aIsUnprocessed && bIsUnprocessed) return 1;

      // Preserve relative positions
      return 0;
    });
  }, [stocktakeItems]);

  // Confirm single row in Stocktake Sheet
  const confirmStocktakeRow = useCallback(async (stockId: number) => {
    const targetItem = stocktakeItems.find(item => item.stockId === stockId);
    if (!targetItem) return;

    const actualQty = parseInt(targetItem.actualStock, 10);
    if (isNaN(actualQty) || actualQty < 0) {
      addToast('有効な数量を入力してください。', 'warning');
      return;
    }

    setSubmittingStocktake(prev => ({ ...prev, [stockId]: true }));

    // Optimistic UI updates
    let discrepancy: 'match' | 'shortage' | 'surplus' = 'match';
    if (actualQty < targetItem.systemStock) {
      discrepancy = 'shortage';
    } else if (actualQty > targetItem.systemStock) {
      discrepancy = 'surplus';
    }

    // Optimistic stocktake list update
    setStocktakeItems(prev => prev.map(item => 
      item.stockId === stockId 
        ? { ...item, isConfirmed: true, discrepancy } 
        : item
    ));

    // Optimistically update master stock list quantity
    setStocks(prev => prev.map(s => {
      if (s.id === stockId) {
        const updatedRecent = [...s.recent_quantities];
        if (updatedRecent.length >= 7) {
          updatedRecent.shift();
        }
        updatedRecent.push(actualQty);
        return { ...s, quantity: actualQty, recent_quantities: updatedRecent };
      }
      return s;
    }));

    try {
      const url = `/api/stocks/${stockId}/stocktake`;
      const res = await fetchWithAuth(url, {
        method: 'PUT',
        body: JSON.stringify({ quantity: actualQty })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || '棚卸確定に失敗しました。');
      }

      const updatedStock = await res.json();
      setStocks(prev => prev.map(s => s.id === stockId ? updatedStock : s));
      addToast(`「${targetItem.product_name}」の棚卸しを確定しました。`, 'success');
    } catch (err: any) {
      console.error(err);
      // Rollback discrepancy state and stocks
      setStocktakeItems(prev => prev.map(item => 
        item.stockId === stockId 
          ? { ...item, isConfirmed: false, discrepancy: null } 
          : item
      ));
      fetchStocks(keyword); // Fetch fresh state on error
      addToast(err.message || '棚卸確定中にエラーが発生しました。', 'error');
    } finally {
      setSubmittingStocktake(prev => ({ ...prev, [stockId]: false }));
    }
  }, [stocktakeItems, fetchWithAuth, addToast, fetchStocks, keyword]);

  // Fetch product history
  const selectStockForHistory = useCallback(async (stockId: number) => {
    setSelectedStockId(stockId);
    setLoadingHistory(true);
    try {
      const res = await fetchWithAuth(`/api/stocks/${stockId}/history`);
      if (res.ok) {
        const payload = await res.json();
        setHistoryLogs(payload.data || []);
      } else {
        addToast('履歴データの取得に失敗しました。', 'error');
      }
    } catch (e) {
      console.error(e);
      addToast('履歴データの取得に失敗しました。', 'error');
    } finally {
      setLoadingHistory(false);
    }
  }, [fetchWithAuth, addToast]);
  // Create a new stock item
  const createStock = useCallback(async (
    productName: string,
    quantity: number,
    minQuantity: number,
    productCode: string,
    janCode?: string,
    description?: string,
    imageUrl?: string,
    price?: number,
    brandName?: string,
    categoryName?: string
  ) => {
    try {
      const res = await fetchWithAuth('/api/stocks', {
        method: 'POST',
        body: JSON.stringify({
          product_name: productName,
          quantity: quantity,
          minimum_quantity: minQuantity,
          attributes: productCode ? { code: productCode } : null,
          jan_code: janCode || null,
          description: description || null,
          image_url: imageUrl || null,
          price: price !== undefined && price !== null ? price : null,
          brand_name: brandName || null,
          category_name: categoryName || null,
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || '商品登録に失敗しました。');
      }

      await fetchStocks(keyword);
      addToast(`「${productName}」を新規登録しました。`, 'success');
      return true;
    } catch (err: any) {
      addToast(err.message || '商品の登録に失敗しました。', 'error');
      return false;
    }
  }, [fetchWithAuth, keyword, fetchStocks, addToast]);

  return {
    mode,
    setMode,
    stocks,
    loadingStocks,
    keyword,
    setKeyword,
    
    // Voucher items
    voucherItems,
    addStockToVoucher,
    removeVoucherItem,
    updateVoucherItemQuantity,
    confirmVoucher,
    submittingVoucher,

    // Stocktake items
    stocktakeItems,
    getSortedStocktakeItems,
    updateStocktakeActualQty,
    confirmStocktakeRow,
    submittingStocktake,

    // History items
    selectedStockId,
    setSelectedStockId,
    historyLogs,
    loadingHistory,
    selectStockForHistory,
    fetchStocks,
    createStock,
  };
};

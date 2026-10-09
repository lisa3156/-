import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  Edit2, 
  Package, 
  DollarSign, 
  TrendingUp,
  X,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  CheckSquare,
  Upload,
  RefreshCw,
  MoreHorizontal,
  Menu,
  Copy,
  Database,
  FileJson,
  Share2,
  FileUp,
  ClipboardCopy,
  Receipt,
  Calculator,
  Settings2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowUpDown,
  Tag,
  Layers,
  SlidersHorizontal,
  Undo2,
  Redo2,
  Cloud,
  CloudOff,
  Loader2,
  Calendar,
  History,
  RotateCcw
} from 'lucide-react';
import { InventoryItem, SortField, SortOrder, SettlementSettings, SettlementPayout, UndoAction } from './types';
import { InputWithSuggestions } from './components/InputWithSuggestions';
import { StatsCard } from './components/StatsCard';
import { CloudSettingsModal } from './components/CloudSettingsModal';
import { SettlementModal } from './components/SettlementModal';
import { 
  isSupabaseConfigured,
  fetchInventoryFromCloud,
  upsertInventoryItemCloud,
  batchUpsertInventoryCloud,
  deleteInventoryItemCloud,
  batchDeleteInventoryCloud,
  batchUpdateListingCloud,
  batchUpdateShelfCloud,
  quickSellCloud,
  syncFullInventoryCloud,
  fetchSettlementSettingsCloud,
  saveSettlementSettingsCloud,
  subscribeToCloudChanges,
  STORAGE_MIGRATED_KEY
} from './lib/supabase';

const STORAGE_KEY = 'merch_tracker_cn_v1';
const SETTLEMENT_KEY = 'merch_settlement_rates_v1';

const DEFAULT_SETTLEMENT: SettlementSettings = {
  hb3Rate: 0.92,
  hc3Rate: 0.80,
  payouts: []
};

const DEFAULT_SHELF_OPTIONS = ['HB3', 'HC3'];

const DEFAULT_DEMO_ITEMS: InventoryItem[] = [
  { 
    id: 1001, 
    style: '镭射票', 
    character: '旅行者', 
    series: '原神', 
    shelfLocation: 'HB3', 
    stock: 50, 
    price: 15, 
    sold: 12, 
    remark: '热销中', 
    isListed: true, 
    createdAt: Date.now() 
  },
  { 
    id: 1002, 
    style: '15cm 站姿立牌', 
    character: '芙莉莲', 
    series: '葬送的芙莉莲', 
    shelfLocation: 'HC3', 
    stock: 0, 
    price: 45, 
    sold: 15, 
    remark: '已售罄需补货', 
    isListed: true, 
    createdAt: Date.now() - 10000 
  },
  { 
    id: 1003, 
    style: '双面夹层亚克力挂件', 
    character: '星野', 
    series: '蔚蓝档案', 
    shelfLocation: 'HB3', 
    stock: 25, 
    price: 20, 
    sold: 8, 
    remark: '', 
    isListed: false, 
    createdAt: Date.now() - 20000 
  }
];

const COLUMN_WIDTHS_KEY = 'MERCH_TABLE_COL_WIDTHS_V2';

interface ColumnDef {
  fieldId: string;
  key: SortField | null;
  label: string;
  defaultWidth: number;
  minWidth: number;
  align?: 'left' | 'center';
  stickyRight?: boolean;
}

const TABLE_COLUMNS: ColumnDef[] = [
  { fieldId: 'id', key: 'id', label: '编号', defaultWidth: 75, minWidth: 55, align: 'left' },
  { fieldId: 'series', key: 'series', label: '作品/系列', defaultWidth: 140, minWidth: 85, align: 'left' },
  { fieldId: 'character', key: 'character', label: '角色', defaultWidth: 120, minWidth: 75, align: 'left' },
  { fieldId: 'style', key: null, label: '款式规格', defaultWidth: 190, minWidth: 100, align: 'left' },
  { fieldId: 'shelfLocation', key: 'shelfLocation', label: '货架位置', defaultWidth: 95, minWidth: 75, align: 'left' },
  { fieldId: 'isListed', key: null, label: '上架状态', defaultWidth: 95, minWidth: 75, align: 'left' },
  { fieldId: 'price', key: 'price', label: '单价', defaultWidth: 90, minWidth: 70, align: 'left' },
  { fieldId: 'stock', key: 'stock', label: '库存', defaultWidth: 80, minWidth: 65, align: 'left' },
  { fieldId: 'sold', key: 'sold', label: '已出', defaultWidth: 80, minWidth: 65, align: 'left' },
  { fieldId: 'revenue', key: 'revenue', label: '销售总额', defaultWidth: 105, minWidth: 80, align: 'left' },
  { fieldId: 'actions', key: null, label: '操作', defaultWidth: 185, minWidth: 175, align: 'center', stickyRight: true }
];

const DEFAULT_COL_WIDTHS: Record<string, number> = TABLE_COLUMNS.reduce((acc, col) => {
  acc[col.fieldId] = col.defaultWidth;
  return acc;
}, {} as Record<string, number>);

export const App: React.FC = () => {
  // --- State ---
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Table Column Widths & Resizing
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(COLUMN_WIDTHS_KEY);
      if (saved) {
        return { ...DEFAULT_COL_WIDTHS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_COL_WIDTHS;
  });

  const [activeResizingCol, setActiveResizingCol] = useState<string | null>(null);

  const handleResizeStart = (e: React.MouseEvent, fieldId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const initialWidth = colWidths[fieldId] || DEFAULT_COL_WIDTHS[fieldId] || 100;
    const colDef = TABLE_COLUMNS.find(c => c.fieldId === fieldId);
    const minW = colDef?.minWidth || 60;
    setActiveResizingCol(fieldId);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - startX;
      const newWidth = Math.max(minW, initialWidth + diff);
      setColWidths(prev => ({
        ...prev,
        [fieldId]: newWidth
      }));
    };

    const onMouseUp = () => {
      setActiveResizingCol(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setColWidths(curr => {
        try {
          localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(curr));
        } catch (err) {}
        return curr;
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleResetColWidths = () => {
    setColWidths(DEFAULT_COL_WIDTHS);
    try {
      localStorage.removeItem(COLUMN_WIDTHS_KEY);
    } catch (e) {}
    showToast('已重置所有列宽为默认值', false);
  };

  const totalTableWidth = useMemo(() => {
    const colsTotal = TABLE_COLUMNS.reduce((sum, col) => sum + (colWidths[col.fieldId] || col.defaultWidth), 0);
    return 48 + colsTotal; // 48px checkbox column
  }, [colWidths]);
  
  // Cloud & Loading State
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [isInitialLoaded, setIsInitialLoaded] = useState(false);

  // Modal & Drawer State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isSalesDetailModalOpen, setIsSalesDetailModalOpen] = useState(false);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);

  // Settlement Ratio Settings
  const [settlementSettings, setSettlementSettings] = useState<SettlementSettings>(DEFAULT_SETTLEMENT);

  // Undo & Redo History State
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [redoStack, setRedoStack] = useState<UndoAction[]>([]);
  const [toastMessage, setToastMessage] = useState<{ text: string; isUndoNotification: boolean } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Form State (No 'type' field)
  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    style: '',
    character: '',
    series: '',
    shelfLocation: 'HB3',
    stock: 1,
    price: 0,
    sold: 0,
    remark: '',
    isListed: true
  });

  // Filter & Search State (No 'filterType')
  const [searchQuery, setSearchQuery] = useState('');
  const [filterShelf, setFilterShelf] = useState('');
  const [filterListedStatus, setFilterListedStatus] = useState<'all' | 'listed' | 'unlisted'>('all');
  const [filterStockStatus, setFilterStockStatus] = useState<'all' | 'in_stock' | 'sold_out'>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Sorting State
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // --- Helpers ---

  // Toast notification helper
  const showToast = useCallback((text: string, isUndoNotification = true) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({ text, isUndoNotification });
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  }, []);

  // Parse local items safely
  const parseLocalItems = (raw: string): InventoryItem[] => {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item: any) => ({
          ...item,
          id: Number(item.id),
          stock: Number(item.stock) || 0,
          sold: Number(item.sold) || 0,
          price: Number(item.price) || 0,
          shelfLocation: item.shelfLocation ? String(item.shelfLocation).trim() : 'HB3',
          isListed: item.isListed !== undefined ? !!item.isListed : !!(item.isOnline || item.isOffline),
          createdAt: item.createdAt || Date.now()
        }))
        .filter((item: any) => !isNaN(item.id));
    } catch {
      return [];
    }
  };

  // Push snapshot to undo stack
  const pushUndo = (description: string, prevItems: InventoryItem[]) => {
    setUndoStack(prev => [{ description, items: prevItems, timestamp: Date.now() }, ...prev.slice(0, 29)]);
    setRedoStack([]); // Clear redo stack on new modification
    showToast(description, true);
  };

  // Undo Handler with Cloud Sync
  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    const [actionToUndo, ...remainingUndo] = undoStack;

    if (isSupabaseConfigured()) {
      setIsSyncing(true);
      try {
        await syncFullInventoryCloud(actionToUndo.items);
      } catch (err: any) {
        setIsSyncing(false);
        alert(`撤销同步到云端失败：${err.message || '请检查网络连接'}`);
        return;
      }
      setIsSyncing(false);
    }

    setRedoStack(prev => [{ description: actionToUndo.description, items, timestamp: Date.now() }, ...prev.slice(0, 29)]);
    setUndoStack(remainingUndo);
    setItems(actionToUndo.items);
    showToast(`已撤销：${actionToUndo.description}`, false);
  };

  // Redo Handler with Cloud Sync
  const handleRedo = async () => {
    if (redoStack.length === 0) return;
    const [actionToRedo, ...remainingRedo] = redoStack;

    if (isSupabaseConfigured()) {
      setIsSyncing(true);
      try {
        await syncFullInventoryCloud(actionToRedo.items);
      } catch (err: any) {
        setIsSyncing(false);
        alert(`重做同步到云端失败：${err.message || '请检查网络连接'}`);
        return;
      }
      setIsSyncing(false);
    }

    setUndoStack(prev => [{ description: actionToRedo.description, items, timestamp: Date.now() }, ...prev.slice(0, 29)]);
    setRedoStack(remainingRedo);
    setItems(actionToRedo.items);
    showToast(`已重做：${actionToRedo.description}`, false);
  };

  // Global Keyboard Shortcuts (Ctrl+Z / Cmd+Z for Undo, Ctrl+Y / Cmd+Shift+Z for Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as any).isContentEditable);
      
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          if (!isInput && redoStack.length > 0) {
            e.preventDefault();
            handleRedo();
          }
        } else {
          if (!isInput && undoStack.length > 0) {
            e.preventDefault();
            handleUndo();
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (!isInput && redoStack.length > 0) {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, items]);

  // Save Settlement Settings on change with Cloud Sync
  const updateSettlementSettings = async (newSettings: SettlementSettings) => {
    // 1. Immediately save to local state and localStorage to guarantee persistence
    setSettlementSettings(newSettings);
    localStorage.setItem(SETTLEMENT_KEY, JSON.stringify(newSettings));

    // 2. If Supabase is configured, sync to cloud asynchronously
    if (isSupabaseConfigured()) {
      setIsSyncing(true);
      try {
        await saveSettlementSettingsCloud(newSettings);
      } catch (err: any) {
        console.warn('Cloud sync error for settlement settings:', err);
        showToast(`已保存在本地，云端同步提醒：${err.message || '网络连接异常'}`, true);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  // --- Initial Data Loading & Migration Workflow ---
  const loadCloudData = useCallback(async () => {
    setIsLoading(true);
    setCloudError(null);

    // If Supabase is not configured, fallback to localStorage
    if (!isSupabaseConfigured()) {
      setIsCloudConnected(false);
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setItems(parseLocalItems(saved));
      } else {
        setItems(DEFAULT_DEMO_ITEMS);
      }

      const savedSettings = localStorage.getItem(SETTLEMENT_KEY);
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          setSettlementSettings({
            hb3Rate: typeof parsed.hb3Rate === 'number' ? parsed.hb3Rate : DEFAULT_SETTLEMENT.hb3Rate,
            hc3Rate: typeof parsed.hc3Rate === 'number' ? parsed.hc3Rate : DEFAULT_SETTLEMENT.hc3Rate,
            payouts: Array.isArray(parsed.payouts) ? parsed.payouts : []
          });
        } catch (e) {
          console.error("Failed to parse settlement settings", e);
        }
      }
      setIsInitialLoaded(true);
      setIsLoading(false);
      return;
    }

    // Supabase is configured: query cloud database
    try {
      // 1. Settlement settings sync
      try {
        const remoteSettings = await fetchSettlementSettingsCloud();
        if (remoteSettings) {
          // Merge with local payouts if remote has none so local records are preserved
          const savedSettings = localStorage.getItem(SETTLEMENT_KEY);
          let localPayouts: SettlementPayout[] = [];
          if (savedSettings) {
            try {
              const parsed = JSON.parse(savedSettings);
              if (Array.isArray(parsed?.payouts)) localPayouts = parsed.payouts;
            } catch {}
          }
          const finalPayouts = (Array.isArray(remoteSettings.payouts) && remoteSettings.payouts.length > 0)
            ? remoteSettings.payouts
            : (localPayouts.length > 0 ? localPayouts : (remoteSettings.payouts || []));

          const mergedSettings: SettlementSettings = {
            hb3Rate: remoteSettings.hb3Rate ?? 0.92,
            hc3Rate: remoteSettings.hc3Rate ?? 0.80,
            payouts: finalPayouts
          };
          setSettlementSettings(mergedSettings);
          localStorage.setItem(SETTLEMENT_KEY, JSON.stringify(mergedSettings));
        } else {
          // Supabase has no settings row yet; check local storage to migrate
          const savedSettings = localStorage.getItem(SETTLEMENT_KEY);
          let settingsToUpload = DEFAULT_SETTLEMENT;
          if (savedSettings) {
            try {
              const parsed = JSON.parse(savedSettings);
              settingsToUpload = {
                hb3Rate: typeof parsed.hb3Rate === 'number' ? parsed.hb3Rate : DEFAULT_SETTLEMENT.hb3Rate,
                hc3Rate: typeof parsed.hc3Rate === 'number' ? parsed.hc3Rate : DEFAULT_SETTLEMENT.hc3Rate,
                payouts: Array.isArray(parsed.payouts) ? parsed.payouts : []
              };
            } catch {}
          }
          await saveSettlementSettingsCloud(settingsToUpload);
          setSettlementSettings(settingsToUpload);
        }
      } catch (e) {
        console.warn('Settlement cloud sync warning:', e);
      }

      // 2. Inventory items sync & one-time migration
      const cloudItems = await fetchInventoryFromCloud();

      // Check migration condition:
      // If cloud is empty, AND localStorage has data, AND not marked as migrated:
      const localDataRaw = localStorage.getItem(STORAGE_KEY);
      const isMigrated = localStorage.getItem(STORAGE_MIGRATED_KEY) === 'true';

      if (cloudItems.length === 0 && localDataRaw && !isMigrated) {
        const localItems = parseLocalItems(localDataRaw);
        if (localItems.length > 0) {
          // Perform one-time migration to Supabase
          await batchUpsertInventoryCloud(localItems);
          localStorage.setItem(STORAGE_MIGRATED_KEY, 'true');
          const reloaded = await fetchInventoryFromCloud();
          setItems(reloaded);
          setIsCloudConnected(true);
          setIsInitialLoaded(true);
          showToast(`已成功将本地 ${reloaded.length} 项库存迁移至云端`, false);
          return;
        }
      }

      // Supabase already has data or is ready
      setItems(cloudItems);
      setIsCloudConnected(true);
      setIsInitialLoaded(true);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudItems));
    } catch (err: any) {
      console.error('Failed to load from cloud:', err);
      setCloudError('云端数据加载失败，请检查网络连接或 Supabase 配置');
      setIsCloudConnected(false);

      // Graceful fallback to local cache to prevent blank screen
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setItems(parseLocalItems(saved));
      }
      showToast('云端加载失败，已加载本地缓存数据', false);
      setIsInitialLoaded(true);
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Initial load on mount
  useEffect(() => {
    loadCloudData();
  }, [loadCloudData]);

  // Realtime subscription for multi-device sync
  useEffect(() => {
    if (!isCloudConnected || !isSupabaseConfigured()) return;

    const unsubscribe = subscribeToCloudChanges(
      async () => {
        try {
          const freshItems = await fetchInventoryFromCloud();
          setItems(freshItems);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(freshItems));
        } catch (e) {
          console.warn('Realtime refresh error:', e);
        }
      },
      (newSettings) => {
        setSettlementSettings((prev) => {
          const mergedPayouts = (Array.isArray(newSettings.payouts) && newSettings.payouts.length > 0)
            ? newSettings.payouts
            : (prev.payouts && prev.payouts.length > 0 ? prev.payouts : (newSettings.payouts || []));
          const merged = {
            ...prev,
            hb3Rate: newSettings.hb3Rate ?? prev.hb3Rate,
            hc3Rate: newSettings.hc3Rate ?? prev.hc3Rate,
            payouts: mergedPayouts
          };
          localStorage.setItem(SETTLEMENT_KEY, JSON.stringify(merged));
          return merged;
        });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isCloudConnected]);

  // Local storage caching only after initial load finishes
  useEffect(() => {
    if (isInitialLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  }, [items, isInitialLoaded]);

  // --- Derived Data for Autocomplete & Filters ---
  const existingSeries = useMemo(() => Array.from(new Set(items.map(i => i.series))).filter(Boolean), [items]);
  const existingCharacters = useMemo(() => Array.from(new Set(items.map(i => i.character))).filter(Boolean), [items]);
  const existingShelves = useMemo(() => {
    const customShelves = items.map(i => i.shelfLocation).filter(Boolean) as string[];
    const combined = Array.from(new Set([...DEFAULT_SHELF_OPTIONS, ...customShelves]));
    return combined;
  }, [items]);

  // --- Derived Data for Table & Calculation ---
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        (item.series || '').toLowerCase().includes(q) ||
        (item.character || '').toLowerCase().includes(q) ||
        (item.style || '').toLowerCase().includes(q) ||
        (item.shelfLocation || '').toLowerCase().includes(q) ||
        (item.remark || '').toLowerCase().includes(q) ||
        item.id.toString().includes(q);
      
      const matchesShelf = filterShelf 
        ? (filterShelf === '__NONE__' 
            ? !item.shelfLocation 
            : (item.shelfLocation || '').toUpperCase() === filterShelf.toUpperCase()) 
        : true;

      const matchesListed = filterListedStatus === 'all' 
        ? true 
        : filterListedStatus === 'listed' 
          ? item.isListed 
          : !item.isListed;

      const matchesStock = filterStockStatus === 'all' 
        ? true 
        : filterStockStatus === 'in_stock' 
          ? (item.stock || 0) > 0 
          : (item.stock || 0) <= 0;

      return matchesSearch && matchesShelf && matchesListed && matchesStock;
    }).sort((a, b) => {
      if (sortField === 'revenue') {
        const revA = (a.sold || 0) * (a.price || 0);
        const revB = (b.sold || 0) * (b.price || 0);
        return sortOrder === 'asc' ? revA - revB : revB - revA;
      }

      const valA = a[sortField];
      const valB = b[sortField];
      
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      // String sorting
      const strA = String(valA || '');
      const strB = String(valB || '');
      return sortOrder === 'asc' ? strA.localeCompare(strB, 'zh-CN') : strB.localeCompare(strA, 'zh-CN');
    });
  }, [items, searchQuery, filterShelf, filterListedStatus, filterStockStatus, sortField, sortOrder]);

  // Check if all visible items are selected
  const isAllSelected = filteredItems.length > 0 && filteredItems.every(item => selectedIds.has(item.id));

  // --- Stats & Settlement Calculation ---
  const stats = useMemo(() => {
    const totalItems = filteredItems.length;
    const totalStock = filteredItems.reduce((acc, curr) => acc + (curr.stock || 0), 0);
    const totalSold = filteredItems.reduce((acc, curr) => acc + (curr.sold || 0), 0);
    const potentialRevenue = filteredItems.reduce((acc, curr) => acc + ((curr.stock || 0) * (curr.price || 0)), 0);
    const actualRevenue = filteredItems.reduce((acc, curr) => acc + ((curr.sold || 0) * (curr.price || 0)), 0);
    const inStockCount = filteredItems.filter(i => (i.stock || 0) > 0).length;
    const soldOutCount = filteredItems.filter(i => (i.stock || 0) <= 0).length;

    // Shelf revenue breakdown
    const hb3Sales = filteredItems
      .filter(i => (i.shelfLocation || '').trim().toUpperCase() === 'HB3')
      .reduce((acc, curr) => acc + ((curr.sold || 0) * (curr.price || 0)), 0);

    const hc3Sales = filteredItems
      .filter(i => (i.shelfLocation || '').trim().toUpperCase() === 'HC3')
      .reduce((acc, curr) => acc + ((curr.sold || 0) * (curr.price || 0)), 0);

    const otherSales = actualRevenue - hb3Sales - hc3Sales;

    // Settlement Formula: HB3 Sales * rateHB3 + HC3 Sales * rateHC3
    const hb3Settlement = hb3Sales * (settlementSettings.hb3Rate ?? 0.92);
    const hc3Settlement = hc3Sales * (settlementSettings.hc3Rate ?? 0.80);
    const settlementAmount = hb3Settlement + hc3Settlement;

    // Manual Payouts & Pending Settlement calculation (= 总数 - 已结算金额)
    const payoutsList = Array.isArray(settlementSettings.payouts) ? settlementSettings.payouts : [];
    const totalPaidAmount = payoutsList.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const pendingSettlementAmount = Math.max(0, settlementAmount - totalPaidAmount);

    return { 
      totalItems, 
      totalStock, 
      totalSold, 
      potentialRevenue, 
      actualRevenue,
      inStockCount,
      soldOutCount,
      hb3Sales,
      hc3Sales,
      otherSales,
      hb3Settlement,
      hc3Settlement,
      settlementAmount,
      totalPaidAmount,
      pendingSettlementAmount,
      payoutsCount: payoutsList.length
    };
  }, [filteredItems, settlementSettings]);

  // --- Handlers ---

  const handleInputChange = (field: keyof InventoryItem, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    
    if (editingId) {
      // Update existing
      const existingItem = items.find(i => i.id === editingId);
      const updatedItem: InventoryItem = { 
        ...existingItem, 
        ...formData,
        id: editingId,
        shelfLocation: formData.shelfLocation ? String(formData.shelfLocation).trim() : 'HB3',
        isListed: formData.isListed !== undefined ? !!formData.isListed : true
      } as InventoryItem;

      if (isSupabaseConfigured()) {
        try {
          await upsertInventoryItemCloud(updatedItem);
        } catch (err: any) {
          setIsSyncing(false);
          alert(`保存失败，数据尚未同步到云端：${err.message || '请检查网络连接'}`);
          return;
        }
      }

      pushUndo(`修改商品 #${editingId} (${existingItem?.character || ''} ${existingItem?.style || ''})`, items);
      setItems(prev => prev.map(item => item.id === editingId ? updatedItem : item));
    } else {
      // Create new
      const maxId = items.length > 0 ? Math.max(0, ...items.map(i => i.id)) : 1000;
      const newId = maxId + 1;
      
      const newItem: InventoryItem = {
        ...(formData as InventoryItem),
        id: newId,
        sold: formData.sold || 0,
        shelfLocation: formData.shelfLocation ? String(formData.shelfLocation).trim() : 'HB3',
        isListed: formData.isListed !== undefined ? !!formData.isListed : true,
        createdAt: Date.now()
      };

      if (isSupabaseConfigured()) {
        try {
          await upsertInventoryItemCloud(newItem);
        } catch (err: any) {
          setIsSyncing(false);
          alert(`新增商品失败，数据尚未同步到云端：${err.message || '请检查网络连接'}`);
          return;
        }
      }
      
      pushUndo(`新增商品 #${newId} (${newItem.character || ''} ${newItem.style || ''})`, items);
      setItems(prev => [newItem, ...prev]);
    }
    
    setIsSyncing(false);
    resetForm();
  };

  const handleEdit = (e: React.MouseEvent, item: InventoryItem) => {
    e.stopPropagation();
    setFormData({
      ...item,
      shelfLocation: item.shelfLocation || 'HB3',
      isListed: item.isListed !== undefined ? item.isListed : true
    });
    setEditingId(item.id);
    setIsSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDuplicate = (e: React.MouseEvent, item: InventoryItem) => {
    e.stopPropagation();
    const newItemData = {
      ...item,
      sold: 0, // Reset sold count for new copy
      shelfLocation: item.shelfLocation || 'HB3',
      isListed: item.isListed !== undefined ? item.isListed : true
    };
    setFormData(newItemData);
    setEditingId(null);
    setIsSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (isNaN(id)) {
      alert("无法删除 ID 无效的条目，请尝试刷新页面。");
      return;
    }

    const itemToDelete = items.find(i => String(i.id) === String(id));
    if (window.confirm(`确定要删除商品 #${id} (${itemToDelete?.character || ''} ${itemToDelete?.style || ''}) 吗？`)) {
      if (isSupabaseConfigured()) {
        setIsSyncing(true);
        try {
          await deleteInventoryItemCloud(id);
        } catch (err: any) {
          setIsSyncing(false);
          alert(`删除失败，数据尚未同步到云端：${err.message || '请检查网络连接'}`);
          return;
        }
        setIsSyncing(false);
      }

      pushUndo(`删除商品 #${id} (${itemToDelete?.character || ''} ${itemToDelete?.style || ''})`, items);
      setItems(prev => prev.filter(i => String(i.id) !== String(id)));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`确定要删除选中的 ${selectedIds.size} 项商品吗？`)) {
      const idsArray = Array.from(selectedIds) as number[];
      if (isSupabaseConfigured()) {
        setIsSyncing(true);
        try {
          await batchDeleteInventoryCloud(idsArray);
        } catch (err: any) {
          setIsSyncing(false);
          alert(`批量删除失败，数据尚未同步到云端：${err.message || '请检查网络连接'}`);
          return;
        }
        setIsSyncing(false);
      }

      pushUndo(`批量删除 ${selectedIds.size} 项商品`, items);
      const idsToRemove = new Set(idsArray.map(String));
      setItems(prev => prev.filter(item => !idsToRemove.has(String(item.id))));
      setSelectedIds(new Set());
      setIsSidebarOpen(false);
    }
  };

  const handleBulkListingUpdate = async (isListed: boolean) => {
    if (selectedIds.size === 0) return;
    const idsArray = Array.from(selectedIds) as number[];

    if (isSupabaseConfigured()) {
      setIsSyncing(true);
      try {
        await batchUpdateListingCloud(idsArray, isListed);
      } catch (err: any) {
        setIsSyncing(false);
        alert(`批量更新上架状态失败，数据尚未同步到云端：${err.message || '请检查网络连接'}`);
        return;
      }
      setIsSyncing(false);
    }

    pushUndo(`批量${isListed ? '上架' : '下架'} ${selectedIds.size} 项商品`, items);
    setItems(prev => prev.map(item => {
      if (!selectedIds.has(item.id)) return item;
      return { ...item, isListed };
    }));
    setIsSidebarOpen(false);
  };

  const handleBulkShelfUpdate = async (shelfLocation: string) => {
    if (selectedIds.size === 0) return;
    const idsArray = Array.from(selectedIds) as number[];

    if (isSupabaseConfigured()) {
      setIsSyncing(true);
      try {
        await batchUpdateShelfCloud(idsArray, shelfLocation);
      } catch (err: any) {
        setIsSyncing(false);
        alert(`批量修改货架失败，数据尚未同步到云端：${err.message || '请检查网络连接'}`);
        return;
      }
      setIsSyncing(false);
    }

    pushUndo(`批量修改货架为 ${shelfLocation} (${selectedIds.size} 项)`, items);
    setItems(prev => prev.map(item => {
      if (!selectedIds.has(item.id)) return item;
      return { ...item, shelfLocation };
    }));
    setIsSidebarOpen(false);
  };

  const handleQuickSell = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const itemToSell = items.find(i => i.id === id);
    if (!itemToSell || itemToSell.stock <= 0) {
      alert("库存不足！");
      return;
    }

    const nextStock = itemToSell.stock - 1;
    const nextSold = itemToSell.sold + 1;

    if (isSupabaseConfigured()) {
      setIsSyncing(true);
      try {
        await quickSellCloud(id, nextStock, nextSold);
      } catch (err: any) {
        setIsSyncing(false);
        alert(`售出更新失败，数据尚未同步到云端：${err.message || '请检查网络连接'}`);
        return;
      }
      setIsSyncing(false);
    }

    pushUndo(`快速售出 +1 (${itemToSell.character || ''} ${itemToSell.style || ''})`, items);
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          stock: nextStock,
          sold: nextSold
        };
      }
      return item;
    }));
  };

  const resetForm = () => {
    setFormData({
      style: '',
      character: '',
      series: '',
      shelfLocation: 'HB3',
      stock: 1,
      price: 0,
      sold: 0,
      remark: '',
      isListed: true
    });
    setEditingId(null);
    setIsSidebarOpen(false);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      const newSet = new Set(selectedIds);
      filteredItems.forEach(item => newSet.delete(item.id));
      setSelectedIds(newSet);
    } else {
      const newSet = new Set(selectedIds);
      filteredItems.forEach(item => newSet.add(item.id));
      setSelectedIds(newSet);
    }
  };

  const toggleSelectRow = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // --- Export to Excel with "打签名称" column (作品/系列-角色-款式) ---
  const exportToExcel = async () => {
    if (!window.XLSX) {
      alert("Excel 导出组件尚未加载完成，请稍后再试。");
      return;
    }

    let itemsToExport = filteredItems;
    if (selectedIds.size > 0) {
      itemsToExport = items.filter(item => selectedIds.has(item.id));
    }
    
    // Format data: "打签名称" is formatted as "作品/系列-角色-款式", only present in exported excel
    const exportData = itemsToExport.map(item => {
      const tagLabel = `${item.series || '未分类'}-${item.character || '未命名'}-${item.style || '默认'}`;
      const itemRevenue = (item.sold || 0) * (item.price || 0);

      return {
        '编号': item.id,
        '作品/系列': item.series,
        '角色': item.character,
        '款式': item.style,
        '货架位置': item.shelfLocation || '',
        '是否已上架': item.isListed ? '是' : '否',
        '单价 (¥)': item.price,
        '库存数量': item.stock,
        '已出数量': item.sold,
        '销售总额 (¥)': itemRevenue,
        '库存货值 (¥)': (item.stock || 0) * (item.price || 0),
        '备注': item.remark,
        '打签名称': tagLabel
      };
    });

    const ws = window.XLSX.utils.json_to_sheet(exportData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "库存表");
    const filename = `周边库存_${selectedIds.size > 0 ? '选定' : '完整'}_${new Date().toISOString().slice(0,10)}.xlsx`;

    try {
      const wbout = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: blob.type })] })) {
        const file = new File([blob], filename, { type: blob.type });
        await navigator.share({
          files: [file],
          title: '导出库存数据',
          text: '这是您的库存 Excel 文件'
        });
        setIsSidebarOpen(false);
        return;
      } 
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIsSidebarOpen(false);

    } catch (error) {
      console.error("Export error:", error);
      window.XLSX.writeFile(wb, filename);
      setIsSidebarOpen(false);
    }
  };

  const triggerImport = () => {
    fileInputRef.current?.click();
    setIsSidebarOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.XLSX) {
      alert("Excel 组件尚未加载完成，请稍后再试。");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = window.XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = window.XLSX.utils.sheet_to_json(sheet);

        if (jsonData.length === 0) {
          alert("文件中没有数据");
          return;
        }

        let maxId = items.length > 0 ? Math.max(0, ...items.map(i => i.id)) : 1000;
        const currentItemsMap = new Map<number, InventoryItem>();
        items.forEach(i => currentItemsMap.set(i.id, i));

        let updatedCount = 0;
        let addedCount = 0;

        jsonData.forEach((row: any) => {
          const rawId = row['编号'];
          let parsedId = NaN;
          
          if (rawId !== undefined && rawId !== null && String(rawId).trim() !== '') {
            parsedId = parseInt(String(rawId), 10);
          }
          
          // Parse listing status: supports '是否已上架', or legacy '线上上架'/'线下上架'
          let isListed = true;
          if (row['是否已上架'] !== undefined) {
            const val = String(row['是否已上架']).trim().toLowerCase();
            isListed = val === '是' || val === 'true' || val === '1' || val === '已上架';
          } else if (row['线上上架'] !== undefined || row['线下上架'] !== undefined) {
            isListed = String(row['线上上架']).trim() === '是' || String(row['线下上架']).trim() === '是';
          }

          // Parse shelf location: supports '货架位置' or '货架'
          const shelfLocation = String(row['货架位置'] || row['货架'] || 'HB3').trim();

          const newItemData: Partial<InventoryItem> = {
            series: String(row['作品/系列'] || row['作品'] || ''),
            character: String(row['角色'] || ''),
            style: String(row['款式'] || ''),
            shelfLocation: shelfLocation || 'HB3',
            isListed,
            price: Number(row['单价 (¥)']) || Number(row['单价']) || 0,
            stock: Number(row['库存数量']) || Number(row['库存']) || 0,
            sold: Number(row['已出数量']) || Number(row['已出']) || 0,
            remark: String(row['备注'] || '')
          };

          if (!isNaN(parsedId) && currentItemsMap.has(parsedId)) {
            // Update existing
            const existing = currentItemsMap.get(parsedId)!;
            currentItemsMap.set(parsedId, { ...existing, ...newItemData });
            updatedCount++;
          } else {
            // Add new
            const newId = (!isNaN(parsedId) && !currentItemsMap.has(parsedId)) 
              ? parsedId 
              : ++maxId;
            
            const newItem: InventoryItem = {
              id: newId,
              style: newItemData.style || '',
              character: newItemData.character || '未命名',
              series: newItemData.series || '未分类',
              shelfLocation: newItemData.shelfLocation || 'HB3',
              isListed: newItemData.isListed !== undefined ? newItemData.isListed : true,
              stock: newItemData.stock || 0,
              price: newItemData.price || 0,
              sold: newItemData.sold || 0,
              remark: newItemData.remark || '',
              createdAt: Date.now()
            };
            currentItemsMap.set(newId, newItem);
            addedCount++;
          }
        });

        const validItems = Array.from(currentItemsMap.values())
          .filter(i => !isNaN(i.id))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        if (isSupabaseConfigured()) {
          setIsSyncing(true);
          try {
            await batchUpsertInventoryCloud(validItems);
          } catch (err: any) {
            setIsSyncing(false);
            alert(`Excel 导入同步到云端失败：${err.message || '请检查网络连接'}`);
            return;
          }
          setIsSyncing(false);
        }

        pushUndo(`导入 Excel 数据 (新增 ${addedCount} 条, 更新 ${updatedCount} 条)`, items);
        setItems(validItems);
        showToast(`导入完成！新增: ${addedCount} 条，更新: ${updatedCount} 条。${isSupabaseConfigured() ? '已成功同步至云端。' : ''}`, false);

      } catch (error) {
        console.error("Import error:", error);
        showToast("导入失败，请检查文件格式是否正确。");
      }
    };

    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // --- SettlementModal is imported from ./components/SettlementModal ---

  // --- Sales Detail Modal Component ---
  const SalesDetailModal = () => {
    const soldItems = useMemo(() => {
      return filteredItems
        .filter(item => item.sold > 0)
        .sort((a, b) => (b.sold * b.price) - (a.sold * a.price));
    }, []);

    const totalSold = soldItems.reduce((acc, i) => acc + i.sold, 0);
    const totalRevenue = soldItems.reduce((acc, i) => acc + (i.sold * i.price), 0);

    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsSalesDetailModalOpen(false)} />
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl relative z-10 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="flex justify-between items-center p-4 border-b border-[#AC9B95]/30 bg-[#FAF7F5]">
            <h3 className="text-lg font-bold text-[#3A2923] flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#8D4429]" />
              已售商品明细与货架结算 ({soldItems.length} 款)
            </h3>
            <button onClick={() => setIsSalesDetailModalOpen(false)} className="text-stone-400 hover:text-[#3A2923] p-1 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-0 overflow-auto flex-1 bg-[#FAF7F5]/50">
            {/* Mobile View */}
            <div className="md:hidden">
              {soldItems.map(item => {
                const itemRevenue = item.sold * item.price;
                const shelf = (item.shelfLocation || '').toUpperCase();
                const rate = shelf === 'HB3' ? settlementSettings.hb3Rate : (shelf === 'HC3' ? settlementSettings.hc3Rate : 0);
                const settlement = itemRevenue * rate;

                return (
                  <div key={item.id} className="bg-white p-4 border-b border-[#AC9B95]/20 last:border-0">
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-medium text-[#3A2923] flex items-center gap-1.5">
                        <span className="font-bold">{item.style || '无款式'}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          shelf === 'HB3' ? 'bg-[#F5F1EF] text-[#5F3E32] border border-[#AC9B95]/40' : (shelf === 'HC3' ? 'bg-[#FDF3ED] text-[#BB754B] border border-[#E8C5B0]' : 'bg-stone-100 text-[#8C776D]')
                        }`}>
                          {item.shelfLocation || '未设货架'}
                        </span>
                      </div>
                      <div className="text-[#8D4429] font-bold">¥{itemRevenue.toLocaleString()}</div>
                    </div>
                    <div className="text-xs text-[#8C776D] mb-2">
                      {item.series} | {item.character} | {item.type}
                    </div>
                    <div className="flex justify-between text-xs text-[#8C776D] bg-[#FAF7F5] p-2 rounded-lg border border-[#AC9B95]/20">
                      <span>单价: ¥{item.price}</span>
                      <span>已出: <b className="text-[#3A2923]">{item.sold}</b></span>
                      {rate > 0 && (
                        <span className="text-[#8D4429] font-medium">
                          结算 ({Math.round(rate * 100)}%): <b>¥{settlement.toFixed(2)}</b>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {soldItems.length === 0 && (
                <div className="text-center py-10 text-[#8C776D]">暂无销售记录</div>
              )}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block">
              <table className="min-w-full divide-y divide-[#AC9B95]/20">
                <thead className="bg-[#FAF7F5] sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#8C776D] uppercase tracking-wider">商品信息</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#8C776D] uppercase tracking-wider">货架</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#8C776D] uppercase tracking-wider">单价</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#8C776D] uppercase tracking-wider">已出数量</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-[#8C776D] uppercase tracking-wider">销售总额</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-[#8D4429] uppercase tracking-wider">货架结算贡献</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[#AC9B95]/15">
                  {soldItems.map((item) => {
                    const itemRevenue = item.sold * item.price;
                    const shelf = (item.shelfLocation || '').toUpperCase();
                    const rate = shelf === 'HB3' ? settlementSettings.hb3Rate : (shelf === 'HC3' ? settlementSettings.hc3Rate : 0);
                    const settlement = itemRevenue * rate;

                    return (
                      <tr key={item.id} className="hover:bg-[#FAF7F5]/80">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-[#3A2923]">{item.style || '默认款式'}</div>
                          <div className="text-xs text-[#8C776D]">{item.series} - {item.character} ({item.type})</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            shelf === 'HB3' ? 'bg-[#F5F1EF] text-[#5F3E32] border border-[#AC9B95]/40' : (shelf === 'HC3' ? 'bg-[#FDF3ED] text-[#BB754B] border border-[#E8C5B0]' : 'bg-stone-100 text-[#8C776D]')
                          }`}>
                            {item.shelfLocation || '无'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#8C776D]">
                          ¥{item.price.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#3A2923] font-semibold">
                          {item.sold}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#3A2923] font-bold text-right">
                          ¥{itemRevenue.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#8D4429] font-bold text-right">
                          {rate > 0 ? (
                            <span>¥{settlement.toFixed(2)} <span className="text-[11px] font-normal text-[#8C776D]">({Math.round(rate * 100)}%)</span></span>
                          ) : (
                            <span className="text-stone-400 text-xs font-normal">未参与</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {soldItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-[#8C776D]">当前筛选条件下暂无销售记录</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border-t border-[#AC9B95]/30 p-4 flex flex-wrap justify-between items-center shadow-lg relative z-20 gap-3">
            <div className="text-sm text-[#8C776D]">
              共售出 <span className="font-bold text-[#3A2923]">{totalSold}</span> 件商品 | 销售总额: <span className="font-bold text-[#3A2923]">¥{totalRevenue.toLocaleString()}</span>
            </div>
            <div className="text-base font-bold text-[#8D4429] flex items-center gap-2">
              <span>预计结算金额 (HB3+HC3):</span>
              <span className="text-lg">¥{stats.settlementAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- Backup Modal Component ---
  const BackupModal = () => {
    const [mode, setMode] = useState<'export' | 'import'>('export');
    const [importText, setImportText] = useState('');
    const jsonFileRef = useRef<HTMLInputElement>(null);
    const jsonString = JSON.stringify(items, null, 2);

    const handleCopy = () => {
      navigator.clipboard.writeText(jsonString).then(() => {
        showToast('数据已复制到剪贴板！', false);
      });
    };

    const handleDownloadJSON = () => {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inventory_backup_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    const handleJSONFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if(!file) return;
      
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        setImportText(text);
        tryRestore(text);
      };
      reader.readAsText(file);
      e.target.value = '';
    };

    const tryRestore = async (jsonContent: string) => {
      if (!jsonContent) return;
      
      try {
        const parsed = JSON.parse(jsonContent);
        if (!Array.isArray(parsed)) throw new Error('Format error');
        
        const sanitizedData: InventoryItem[] = parsed.map((item: any) => ({
          ...item,
          id: Number(item.id),
          stock: Number(item.stock) || 0,
          sold: Number(item.sold) || 0,
          price: Number(item.price) || 0,
          shelfLocation: item.shelfLocation ? String(item.shelfLocation).trim() : 'HB3',
          isListed: item.isListed !== undefined ? !!item.isListed : !!(item.isOnline || item.isOffline),
          createdAt: item.createdAt || Date.now()
        })).filter((item: any) => !isNaN(item.id));

        if (isSupabaseConfigured()) {
          setIsSyncing(true);
          try {
            await syncFullInventoryCloud(sanitizedData);
          } catch (err: any) {
            setIsSyncing(false);
            showToast(`JSON 备份数据同步到云端失败：${err.message || '请检查网络连接'}`);
            return;
          }
          setIsSyncing(false);
        }

        pushUndo(`从 JSON 备份恢复数据 (${sanitizedData.length} 条)`, items);
        setItems(sanitizedData);
        showToast(`成功恢复 ${sanitizedData.length} 条数据！${isSupabaseConfigured() ? '已同步至云端。' : ''}`, false);
        setIsBackupModalOpen(false);
      } catch (e) {
        showToast('数据格式错误，请确保导入的是正确的 JSON 备份文件。');
      }
    };

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsBackupModalOpen(false)} />
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative z-10 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="flex justify-between items-center p-4 border-b border-[#AC9B95]/30 bg-[#FAF7F5]">
            <h3 className="text-lg font-bold text-[#3A2923] flex items-center gap-2">
              <Database className="w-5 h-5 text-[#8D4429]" />
              数据备份与迁移
            </h3>
            <button onClick={() => setIsBackupModalOpen(false)} className="text-stone-400 hover:text-[#3A2923]">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex border-b border-[#AC9B95]/30 bg-[#FAF7F5]">
            <button 
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${mode === 'export' ? 'text-[#8D4429] border-b-2 border-[#8D4429] bg-[#F5F1EF]' : 'text-[#8C776D] hover:bg-stone-100'}`}
              onClick={() => setMode('export')}
            >
              导出 (备份)
            </button>
            <button 
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${mode === 'import' ? 'text-[#8D4429] border-b-2 border-[#8D4429] bg-[#F5F1EF]' : 'text-[#8C776D] hover:bg-stone-100'}`}
              onClick={() => setMode('import')}
            >
              导入 (恢复)
            </button>
          </div>

          <div className="p-5 flex-1 overflow-auto">
            {mode === 'export' ? (
              <div className="space-y-5">
                <div className="bg-[#F5F1EF] p-4 rounded-xl border border-[#AC9B95]/30">
                  <h4 className="font-semibold text-[#5F3E32] mb-1.5 flex items-center">
                    <FileJson className="w-4 h-4 mr-2 text-[#8D4429]" /> 推荐：下载备份文件
                  </h4>
                  <p className="text-xs text-[#5F3E32]/80 mb-3">
                    将生成一个 .json 文件。在其他设备上使用“上传备份文件”即可恢复。
                  </p>
                  <button 
                    onClick={handleDownloadJSON}
                    className="w-full py-2.5 bg-[#8D4429] text-white rounded-xl hover:bg-[#723720] font-semibold shadow-sm flex items-center justify-center text-sm transition-colors"
                  >
                    <Download className="w-4 h-4 mr-2" /> 下载 JSON 文件
                  </button>
                </div>

                <div className="border-t border-[#AC9B95]/30 pt-4">
                  <h4 className="font-medium text-[#3A2923] mb-2 text-sm flex items-center">
                    <ClipboardCopy className="w-4 h-4 mr-2 text-[#8C776D]" /> 备用：复制文本
                  </h4>
                  <textarea 
                    readOnly 
                    value={jsonString}
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                    className="w-full h-24 p-2 border border-[#AC9B95]/40 rounded-xl text-[10px] font-mono bg-[#FAF7F5] focus:ring-2 focus:ring-[#8D4429] text-[#8C776D]"
                  />
                  <button 
                    onClick={handleCopy}
                    className="w-full mt-2 py-2 border border-[#8D4429] text-[#8D4429] rounded-xl hover:bg-[#F5F1EF] font-semibold text-xs transition-colors"
                  >
                    复制文本到剪贴板
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <input 
                  type="file" 
                  ref={jsonFileRef} 
                  accept=".json"
                  className="hidden"
                  onChange={handleJSONFileImport}
                />

                <div className="bg-[#FAF7F5] p-4 rounded-xl border border-[#AC9B95]/30">
                  <h4 className="font-semibold text-[#3A2923] mb-1.5 flex items-center">
                    <FileUp className="w-4 h-4 mr-2 text-[#8D4429]" /> 方式一：上传备份文件
                  </h4>
                  <p className="text-xs text-[#8C776D] mb-3">
                    选择之前下载的 .json 备份文件进行恢复。
                  </p>
                  <button 
                    onClick={() => jsonFileRef.current?.click()}
                    className="w-full py-2.5 bg-white border border-[#AC9B95]/40 text-[#3A2923] rounded-xl hover:bg-stone-50 font-semibold shadow-sm flex items-center justify-center text-sm transition-colors"
                  >
                    <Upload className="w-4 h-4 mr-2" /> 选择文件
                  </button>
                </div>

                <div className="border-t border-[#AC9B95]/30 pt-4 space-y-3">
                  <h4 className="font-medium text-[#3A2923] text-sm flex items-center">
                    <ClipboardCopy className="w-4 h-4 mr-2 text-[#8C776D]" /> 方式二：粘贴文本
                  </h4>
                  <textarea 
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder='在此粘贴 JSON 数据...'
                    className="w-full h-24 p-3 border border-[#AC9B95]/40 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#8D4429] text-[#3A2923]"
                  />
                  <button 
                    onClick={() => tryRestore(importText)}
                    disabled={!importText}
                    className="w-full py-2.5 bg-[#8D4429] text-white rounded-xl hover:bg-[#723720] font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    覆盖并恢复数据
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 font-sans relative">
      
      {/* Hidden File Input for Excel Import */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept=".xlsx, .xls" 
        className="hidden" 
      />

      {/* Modals */}
      {isBackupModalOpen && <BackupModal />}
      {isSalesDetailModalOpen && <SalesDetailModal />}
      <SettlementModal 
        isOpen={isSettlementModalOpen}
        onClose={() => setIsSettlementModalOpen(false)}
        settlementSettings={settlementSettings}
        onUpdateSettings={updateSettlementSettings}
        onSave={updateSettlementSettings}
        stats={stats}
        onToast={(msg) => showToast(msg, false)}
      />
      <CloudSettingsModal 
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        isCloudConnected={isCloudConnected}
        onRefreshFromCloud={loadCloudData}
        items={items}
        settlementSettings={settlementSettings}
        onToast={(msg) => showToast(msg, false)}
      />

      {/* Mobile Sidebar (Drawer) with Settlement Ratio Settings */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsSidebarOpen(false)}
          />
          
          <div className="relative w-80 bg-white h-full shadow-2xl p-5 flex flex-col gap-5 overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="flex justify-between items-center border-b border-[#AC9B95]/30 pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#8D4429]" />
                <h2 className="text-lg font-bold text-[#3A2923]">功能菜单</h2>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 text-stone-400 hover:bg-stone-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4 flex-1">
              <button 
                onClick={() => { resetForm(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="w-full flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-[#8D4429] rounded-xl hover:bg-[#723720] shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4 mr-2 text-white" />
                新建商品登记
              </button>

              {/* Cloud Sync in Mobile Drawer */}
              <button 
                onClick={() => { setIsCloudModalOpen(true); setIsSidebarOpen(false); }}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-[#3A2923] bg-[#FAF7F5] border border-[#AC9B95]/30 rounded-xl hover:bg-[#F5F1EF] transition-colors"
              >
                <div className="flex items-center">
                  <Cloud className="w-4 h-4 mr-3 text-[#8D4429]" />
                  <span>云端数据同步 (Supabase)</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isCloudConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {isCloudConnected ? '已连接' : '未连接'}
                </span>
              </button>

              {/* Mobile Settlement Ratio Settings Section */}
              <div className="bg-[#FAF7F5] p-4 rounded-xl border border-[#AC9B95]/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#5F3E32]">
                    <Calculator className="w-4 h-4 text-[#8D4429]" />
                    <span>结算比例设置 (货架)</span>
                  </div>
                  <button 
                    onClick={() => updateSettlementSettings(DEFAULT_SETTLEMENT)}
                    className="text-[11px] text-[#8D4429] font-medium hover:underline"
                  >
                    重置
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[#8C776D] mb-1">HB3 比例 (%)</label>
                    <input 
                      type="number" 
                      step="1"
                      min="0"
                      max="100"
                      value={Math.round((settlementSettings.hb3Rate ?? 0.92) * 100)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        updateSettlementSettings({
                          ...settlementSettings,
                          hb3Rate: isNaN(val) ? 0 : val / 100
                        });
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#AC9B95]/40 rounded-lg text-sm font-bold text-[#3A2923] focus:ring-1 focus:ring-[#8D4429] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[#8C776D] mb-1">HC3 比例 (%)</label>
                    <input 
                      type="number" 
                      step="1"
                      min="0"
                      max="100"
                      value={Math.round((settlementSettings.hc3Rate ?? 0.80) * 100)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        updateSettlementSettings({
                          ...settlementSettings,
                          hc3Rate: isNaN(val) ? 0 : val / 100
                        });
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#AC9B95]/40 rounded-lg text-sm font-bold text-[#3A2923] focus:ring-1 focus:ring-[#8D4429] focus:outline-none"
                    />
                  </div>
                </div>
                <div className="text-[10px] text-[#8C776D] leading-tight">
                  结算金额 = HB3销售额 × {(settlementSettings.hb3Rate * 100).toFixed(0)}% + HC3销售额 × {(settlementSettings.hc3Rate * 100).toFixed(0)}%
                </div>
              </div>

              {/* Bulk operations when items selected */}
              {selectedIds.size > 0 && (
                <div className="bg-[#FAF7F5] p-3 rounded-xl border border-[#AC9B95]/30 space-y-2">
                  <div className="text-xs font-semibold text-[#3A2923]">
                    已选定 {selectedIds.size} 项商品批量操作:
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button 
                      onClick={() => handleBulkListingUpdate(true)} 
                      className="flex items-center justify-center p-2 bg-white text-emerald-800 border border-emerald-200 rounded-lg text-xs font-medium hover:bg-emerald-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      设为已上架
                    </button>
                    <button 
                      onClick={() => handleBulkListingUpdate(false)} 
                      className="flex items-center justify-center p-2 bg-white text-[#3A2923] border border-[#AC9B95]/30 rounded-lg text-xs font-medium hover:bg-stone-50"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      设为未上架
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button 
                      onClick={() => handleBulkShelfUpdate('HB3')} 
                      className="flex items-center justify-center p-2 bg-white text-[#5F3E32] border border-[#AC9B95]/40 rounded-lg text-xs font-bold hover:bg-[#F5F1EF]"
                    >
                      设为货架 HB3
                    </button>
                    <button 
                      onClick={() => handleBulkShelfUpdate('HC3')} 
                      className="flex items-center justify-center p-2 bg-white text-[#BB754B] border border-[#E8C5B0] rounded-lg text-xs font-bold hover:bg-[#FDF3ED]"
                    >
                      设为货架 HC3
                    </button>
                  </div>
                  <button 
                    onClick={handleBatchDelete} 
                    className="w-full flex items-center justify-center p-2 bg-[#8D4429] text-white rounded-lg text-xs font-semibold hover:bg-[#723720] shadow-sm transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    批量删除选中 ({selectedIds.size})
                  </button>
                </div>
              )}

              <hr className="border-slate-100" />

              {/* Undo & Redo in Mobile Drawer */}
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => { handleUndo(); setIsSidebarOpen(false); }}
                  disabled={undoStack.length === 0}
                  className="flex items-center justify-center px-3 py-2 text-xs font-semibold text-[#5F3E32] bg-[#F5F1EF] rounded-xl hover:bg-[#eae3df] disabled:opacity-40 disabled:pointer-events-none transition-colors border border-[#AC9B95]/30"
                >
                  <Undo2 className="w-4 h-4 mr-1.5" />
                  撤销 ({undoStack.length})
                </button>
                <button 
                  onClick={() => { handleRedo(); setIsSidebarOpen(false); }}
                  disabled={redoStack.length === 0}
                  className="flex items-center justify-center px-3 py-2 text-xs font-semibold text-[#5F3E32] bg-[#F5F1EF] rounded-xl hover:bg-[#eae3df] disabled:opacity-40 disabled:pointer-events-none transition-colors border border-[#AC9B95]/30"
                >
                  <Redo2 className="w-4 h-4 mr-1.5" />
                  重做 ({redoStack.length})
                </button>
              </div>

              <button 
                onClick={() => { setIsSalesDetailModalOpen(true); setIsSidebarOpen(false); }}
                className="w-full flex items-center px-4 py-2.5 text-sm font-medium text-[#3A2923] bg-[#FAF7F5] border border-[#AC9B95]/30 rounded-xl hover:bg-[#F5F1EF]"
              >
                <Receipt className="w-4 h-4 mr-3 text-[#8D4429]" />
                已售商品明细
              </button>

              <button 
                onClick={() => { setIsBackupModalOpen(true); setIsSidebarOpen(false); }}
                className="w-full flex items-center px-4 py-2.5 text-sm font-medium text-[#3A2923] bg-[#FAF7F5] border border-[#AC9B95]/30 rounded-xl hover:bg-[#F5F1EF]"
              >
                <Database className="w-4 h-4 mr-3 text-[#8D4429]" />
                数据备份 / 恢复
              </button>

              <button 
                onClick={triggerImport}
                className="w-full flex items-center px-4 py-2.5 text-sm font-medium text-[#3A2923] bg-[#FAF7F5] border border-[#AC9B95]/30 rounded-xl hover:bg-[#F5F1EF]"
              >
                <Upload className="w-4 h-4 mr-3 text-[#8C776D]" />
                导入 Excel
              </button>
              
              <button 
                onClick={exportToExcel}
                className="w-full flex items-center px-4 py-2.5 text-sm font-medium text-[#3A2923] bg-[#FAF7F5] border border-[#AC9B95]/30 rounded-xl hover:bg-[#F5F1EF]"
              >
                <Download className="w-4 h-4 mr-3 text-[#8D4429]" />
                {selectedIds.size > 0 ? `导出选中 (${selectedIds.size}) Excel` : '导出全部 Excel (含打签)'}
              </button>
            </div>
            
            <div className="text-[11px] text-[#8C776D] text-center border-t border-[#AC9B95]/20 pt-3">
              周边库存管理表
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-[#5F3E32] shadow-md sticky top-0 z-30 border-b border-[#4A2F25]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 bg-white/15 text-white rounded-xl backdrop-blur-sm border border-white/20 shadow-sm">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-bold text-white leading-tight truncate tracking-wide">
                周边库存管理表
              </h1>
            </div>
          </div>
          
          {/* Desktop Toolbar */}
          <div className="hidden md:flex gap-2 items-center">
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-1.5 border-r border-white/20 pr-3 mr-1">
                <span className="text-xs text-white/80 font-medium">选中 {selectedIds.size} 项:</span>
                <button 
                  onClick={() => handleBulkListingUpdate(true)} 
                  title="设为已上架" 
                  className="px-2 py-1 text-xs text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-lg flex items-center gap-1 font-semibold"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> 上架
                </button>
                <button 
                  onClick={() => handleBulkListingUpdate(false)} 
                  title="设为未上架" 
                  className="px-2 py-1 text-xs text-[#3A2923] bg-white/90 hover:bg-white rounded-lg flex items-center gap-1 font-semibold"
                >
                  <XCircle className="w-3.5 h-3.5" /> 下架
                </button>
                <button 
                  onClick={() => handleBulkShelfUpdate('HB3')} 
                  title="设为 HB3" 
                  className="px-2 py-1 text-xs text-[#5F3E32] bg-[#F5F1EF] hover:bg-[#eae3df] rounded-lg font-bold border border-[#AC9B95]/40"
                >
                  HB3
                </button>
                <button 
                  onClick={() => handleBulkShelfUpdate('HC3')} 
                  title="设为 HC3" 
                  className="px-2 py-1 text-xs text-[#BB754B] bg-[#FDF3ED] hover:bg-[#fae4d7] rounded-lg font-bold border border-[#E8C5B0]"
                >
                  HC3
                </button>
                <button 
                  onClick={handleBatchDelete}
                  title="批量删除"
                  className="p-1.5 text-white bg-[#8D4429] hover:bg-[#723720] rounded-lg shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Cloud Sync Status Button */}
            <button
              onClick={() => setIsCloudModalOpen(true)}
              className={`flex items-center px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
                isCloudConnected
                  ? 'text-emerald-100 bg-emerald-900/40 hover:bg-emerald-900/60 border-emerald-500/40'
                  : 'text-amber-100 bg-amber-900/40 hover:bg-amber-900/60 border-amber-500/40'
              }`}
              title={isCloudConnected ? "云端同步已连接 (Supabase) · 点击查看状态" : "未连接 Supabase 云端 · 点击配置"}
            >
              {isSyncing ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-[#AC9B95]" />
              ) : isCloudConnected ? (
                <Cloud className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              ) : (
                <CloudOff className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
              )}
              <span>{isSyncing ? '同步中' : isCloudConnected ? '云端已同步' : '未连接云端'}</span>
            </button>

            {/* Undo / Redo Toolbar Buttons */}
            <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl border border-white/20">
              <button 
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className="flex items-center px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20 disabled:opacity-40 disabled:pointer-events-none rounded-lg transition-colors"
                title={`撤销操作 (Ctrl+Z) - 当前可撤销 ${undoStack.length} 步`}
              >
                <Undo2 className="w-3.5 h-3.5 mr-1 text-[#AC9B95]" />
                <span>撤销</span>
                {undoStack.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 bg-[#8D4429] text-white rounded-full text-[10px] font-bold">
                    {undoStack.length}
                  </span>
                )}
              </button>
              <button 
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className="flex items-center px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20 disabled:opacity-40 disabled:pointer-events-none rounded-lg transition-colors"
                title={`重做操作 (Ctrl+Y) - 当前可重做 ${redoStack.length} 步`}
              >
                <Redo2 className="w-3.5 h-3.5 mr-1 text-[#AC9B95]" />
                <span>重做</span>
                {redoStack.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 bg-[#BB754B] text-white rounded-full text-[10px] font-bold">
                    {redoStack.length}
                  </span>
                )}
              </button>
            </div>

            <button 
              onClick={() => setIsSettlementModalOpen(true)}
              className="flex items-center px-3 py-2 text-xs font-semibold text-[#5F3E32] bg-white rounded-lg hover:bg-stone-100 transition-colors shadow-sm"
              title="设置 HB3 / HC3 结算比例"
            >
              <Calculator className="w-3.5 h-3.5 mr-1.5 text-[#8D4429]" />
              结算比例设置
            </button>

            <button 
              onClick={() => setIsBackupModalOpen(true)}
              className="flex items-center px-3 py-2 text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors"
            >
              <Database className="w-3.5 h-3.5 mr-1.5 text-[#AC9B95]" />
              备份 / 恢复
            </button>
            <button 
              onClick={triggerImport}
              className="flex items-center px-3 py-2 text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              导入
            </button>
            <button 
              onClick={exportToExcel}
              className="flex items-center px-3 py-2 text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors"
              title="导出包含打签名称、货架位置、是否上架等完整数据的 Excel 表"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-[#AC9B95]" />
              导出 Excel
            </button>
            <button 
              onClick={() => { resetForm(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="flex items-center px-3.5 py-2 text-xs font-semibold text-white bg-[#8D4429] rounded-lg hover:bg-[#723720] transition-colors shadow-sm"
            >
              {editingId ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-white" /> : <Plus className="w-3.5 h-3.5 mr-1.5 text-white" />}
              {editingId ? '取消编辑' : '新建商品'}
            </button>
          </div>

          {/* Mobile Menu Trigger */}
          <div className="md:hidden flex items-center gap-1.5">
            <button
              onClick={() => setIsCloudModalOpen(true)}
              className={`p-2 rounded-lg transition-colors ${
                isCloudConnected ? 'text-emerald-300 bg-emerald-900/40' : 'text-amber-300 bg-amber-900/40'
              }`}
              title={isCloudConnected ? "云端同步已连接" : "未连接云端"}
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#AC9B95]" />
              ) : isCloudConnected ? (
                <Cloud className="w-4 h-4" />
              ) : (
                <CloudOff className="w-4 h-4" />
              )}
            </button>
            <button 
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="p-2 text-white bg-white/15 hover:bg-white/25 rounded-lg disabled:opacity-40"
              title="撤销"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setIsSettlementModalOpen(true)}
              className="p-2 text-[#5F3E32] bg-white rounded-lg shadow-sm"
              title="结算设置"
            >
              <Calculator className="w-4 h-4 text-[#8D4429]" />
            </button>
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-white hover:bg-white/10 rounded-lg focus:outline-none"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Floating Undo Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="bg-[#3A2923] text-white px-4 py-3 rounded-2xl shadow-xl border border-[#5F3E32] flex items-center gap-3 text-sm">
            <span className="font-medium">{toastMessage.text}</span>
            {toastMessage.isUndoNotification && undoStack.length > 0 && (
              <button 
                onClick={handleUndo}
                className="px-2.5 py-1 bg-[#8D4429] hover:bg-[#723720] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shadow-sm"
              >
                <Undo2 className="w-3 h-3" />
                撤销
              </button>
            )}
            <button 
              onClick={() => setToastMessage(null)}
              className="text-stone-300 hover:text-white ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Initial Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-xs">
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-[#AC9B95]/30 flex flex-col items-center gap-3 animate-in fade-in zoom-in-95 duration-150">
            <Loader2 className="w-8 h-8 animate-spin text-[#8D4429]" />
            <div className="text-sm font-bold text-[#3A2923]">正在连接 Supabase 加载云端库存...</div>
            <div className="text-xs text-[#8C776D]">多设备数据读取与状态核对中</div>
          </div>
        </div>
      )}

      {/* Cloud Error Notice */}
      {cloudError && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs md:text-sm text-red-800 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span>{cloudError}（当前显示本地缓存，不影响正常使用）</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadCloudData}
                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-bold transition-colors"
              >
                重试连接
              </button>
              <button
                onClick={() => setIsCloudModalOpen(true)}
                className="px-3 py-1.5 bg-white border border-red-200 hover:bg-red-50 text-red-800 rounded-lg text-xs font-semibold transition-colors"
              >
                检查配置
              </button>
              <button
                onClick={() => setCloudError(null)}
                className="p-1 text-red-400 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Statistics Section with 结算金额 Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard 
            title="库存总货值" 
            value={`¥${stats.potentialRevenue.toLocaleString()}`} 
            subValue={`${stats.totalStock} 件在库`}
            icon={Package} 
            colorClass="bg-[#8D4429] text-[#8D4429]" 
          />
          <StatsCard 
            title="总销售额" 
            value={`¥${stats.actualRevenue.toLocaleString()}`} 
            subValue={`${stats.totalSold} 件已出 · 点击看明细`}
            icon={DollarSign} 
            colorClass="bg-[#5F3E32] text-[#5F3E32]" 
            onClick={() => setIsSalesDetailModalOpen(true)}
          />
          {/* Settlement Card: Total & Pending Settlement */}
          <StatsCard 
            title="结算金额" 
            value={
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xl sm:text-2xl font-bold text-[#3A2923]" title="总结算金额">
                  ¥{stats.settlementAmount.toFixed(1)}
                </span>
                <span 
                  className={`text-xs px-2 py-0.5 rounded-full font-bold border ${
                    stats.pendingSettlementAmount > 0 
                      ? 'bg-[#FDF3ED] text-[#BB754B] border-[#E8C5B0]' 
                      : 'bg-[#F5F1EF] text-[#5F3E32] border-[#AC9B95]/40'
                  }`}
                  title="待结算金额 = 总结算金额 - 已结算金额"
                >
                  待结: ¥{stats.pendingSettlementAmount.toFixed(1)}
                </span>
              </div>
            } 
            subValue={
              <div className="flex items-center gap-1.5 text-xs text-[#8C776D] truncate">
                <span>已结: ¥{stats.totalPaidAmount.toFixed(1)}</span>
                <span>·</span>
                <span className="text-[#8D4429] font-semibold hover:underline">点击录入/查明细</span>
              </div>
            }
            icon={Calculator} 
            colorClass="bg-[#8D4429] text-[#8D4429]" 
            onClick={() => setIsSettlementModalOpen(true)}
            actionButton={
              <button 
                onClick={(e) => { e.stopPropagation(); setIsSettlementModalOpen(true); }}
                className="p-1 text-[#8D4429] hover:bg-[#F5F1EF] rounded-lg"
                title="已结核销明细与比例设置"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            }
          />
          <StatsCard 
            title="商品总数" 
            value={stats.totalItems} 
            subValue={
              items.filter(i => (i.stock || 0) <= 0).length > 0 
                ? `未售罄 ${items.filter(i => (i.stock || 0) > 0).length} 款 · ⚠️ 已售罄 ${items.filter(i => (i.stock || 0) <= 0).length} 款` 
                : '全部库存充裕'
            }
            icon={Filter} 
            colorClass={items.filter(i => (i.stock || 0) <= 0).length > 0 ? "bg-[#BB754B] text-[#BB754B]" : "bg-[#9B8072] text-[#9B8072]"} 
            onClick={() => {
              if (filterStockStatus === 'all') setFilterStockStatus('in_stock');
              else if (filterStockStatus === 'in_stock') setFilterStockStatus('sold_out');
              else setFilterStockStatus('all');
            }}
          />
        </div>

        {/* Input Form Area */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#AC9B95]/30 p-4 md:p-6 transition-all">
          <div className="flex justify-between items-center mb-4 md:mb-5 pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-5 bg-[#8D4429] rounded-full"></div>
              <h2 className="text-base md:text-lg font-bold text-[#3A2923]">
                {editingId ? `编辑商品 #${editingId}` : '商品登记与录入'}
              </h2>
            </div>
            {editingId && (
              <button onClick={resetForm} className="text-xs font-semibold text-[#8C776D] hover:text-[#3A2923] bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg transition-colors">
                放弃修改
              </button>
            )}
          </div>
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            <InputWithSuggestions 
              label="作品 / 系列" 
              value={formData.series || ''} 
              onChange={(val) => handleInputChange('series', val)}
              suggestions={existingSeries}
              placeholder="例如：原神"
              required
            />
            <InputWithSuggestions 
              label="角色" 
              value={formData.character || ''} 
              onChange={(val) => handleInputChange('character', val)}
              suggestions={existingCharacters}
              placeholder="例如：胡桃"
              required
            />
            <div>
              <label className="block text-sm font-medium text-[#3A2923] mb-1">款式规格</label>
              <input 
                type="text" 
                value={formData.style || ''} 
                onChange={(e) => handleInputChange('style', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8D4429] focus:border-[#8D4429] text-sm text-[#3A2923]"
                placeholder="例如：镭射票 / 15cm 站姿"
              />
            </div>
            
            {/* Shelf Location with quick HB3 / HC3 selector */}
            <div>
              <label className="block text-sm font-medium text-[#3A2923] mb-1">
                货架位置 <span className="text-[#8D4429] text-xs font-normal">(主要结算依据)</span>
              </label>
              <div className="flex gap-1.5">
                <input 
                  type="text"
                  value={formData.shelfLocation || ''}
                  onChange={(e) => handleInputChange('shelfLocation', e.target.value.toUpperCase())}
                  placeholder="例如：HB3 或 HC3"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8D4429] focus:border-[#8D4429] text-sm font-medium text-[#3A2923]"
                />
                <button 
                  type="button" 
                  onClick={() => handleInputChange('shelfLocation', 'HB3')}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                    (formData.shelfLocation || '').toUpperCase() === 'HB3'
                      ? 'bg-[#5F3E32] text-white border-[#4A2F25]'
                      : 'bg-[#F5F1EF] text-[#5F3E32] border-[#AC9B95]/40 hover:bg-[#eae3df]'
                  }`}
                >
                  HB3
                </button>
                <button 
                  type="button" 
                  onClick={() => handleInputChange('shelfLocation', 'HC3')}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                    (formData.shelfLocation || '').toUpperCase() === 'HC3'
                      ? 'bg-[#BB754B] text-white border-[#a35e36]'
                      : 'bg-[#FDF3ED] text-[#BB754B] border-[#E8C5B0] hover:bg-[#fae4d7]'
                  }`}
                >
                  HC3
                </button>
              </div>
            </div>

            {/* Listing Status Toggle (是否已上架) */}
            <div className="flex flex-col justify-end pb-1">
              <label className="block text-sm font-medium text-[#3A2923] mb-1">上架状态</label>
              <label className="flex items-center gap-2.5 p-2 border border-[#AC9B95]/30 rounded-lg cursor-pointer hover:bg-stone-50 bg-white">
                <input 
                  type="checkbox" 
                  checked={formData.isListed !== undefined ? formData.isListed : true}
                  onChange={(e) => handleInputChange('isListed', e.target.checked)}
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded cursor-pointer accent-emerald-600"
                />
                <span className="text-sm font-semibold text-[#3A2923] flex items-center gap-1.5">
                  {formData.isListed !== false ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 已上架展示
                    </span>
                  ) : (
                    <span className="text-[#8C776D] flex items-center gap-1">
                      <XCircle className="w-4 h-4 text-[#8C776D]" /> 未上架 / 暂存
                    </span>
                  )}
                </span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#3A2923] mb-1">单价 (¥)</label>
              <input 
                type="number" 
                min="0" 
                step="0.01"
                value={formData.price || ''} 
                onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8D4429] focus:border-[#8D4429] text-sm font-medium text-[#3A2923]"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#3A2923] mb-1">当前库存数量</label>
              <input 
                type="number" 
                min="0" 
                value={formData.stock !== undefined ? formData.stock : ''} 
                onChange={(e) => handleInputChange('stock', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8D4429] focus:border-[#8D4429] text-sm font-medium text-[#3A2923]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#3A2923] mb-1">已出数量 (初始/历史)</label>
              <input 
                type="number" 
                min="0" 
                value={formData.sold || 0} 
                onChange={(e) => handleInputChange('sold', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8D4429] bg-stone-50 text-sm text-[#3A2923]"
              />
            </div>

            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-[#3A2923] mb-1">备注说明</label>
              <input 
                type="text" 
                value={formData.remark || ''} 
                onChange={(e) => handleInputChange('remark', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8D4429] focus:border-[#8D4429] text-sm text-[#3A2923]"
                placeholder="可选备注（如：下周补货、打折等）"
              />
            </div>

            <div className="flex items-end pb-0.5">
              <button 
                type="submit" 
                className="w-full py-2.5 bg-[#8D4429] text-white text-sm font-semibold rounded-xl hover:bg-[#723720] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8D4429] shadow-sm transition-colors flex items-center justify-center gap-1.5"
              >
                {editingId ? <RefreshCw className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {editingId ? '更新商品信息' : '保存商品条目'}
              </button>
            </div>
          </form>
        </div>

        {/* Filters and Sorting Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-3.5 sm:p-4 space-y-3">
          {/* Main Filter Row: Search, Quick Stock Toggles, Advanced Filter Toggle */}
          <div className="flex flex-col md:flex-row gap-2.5 sm:gap-3 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="搜索作品、角色、款式、货架、编号..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-[#AC9B95]/40 rounded-xl text-sm focus:ring-2 focus:ring-[#8D4429] focus:border-[#8D4429] text-[#3A2923]"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Stock Filters & Advanced Filters Toggle */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {/* 全部 */}
              <button 
                type="button"
                onClick={() => setFilterStockStatus('all')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                  filterStockStatus === 'all'
                    ? 'bg-[#8D4429] text-white border-[#723720] shadow-sm' 
                    : 'bg-stone-50 text-[#8C776D] border-stone-200 hover:bg-stone-100 hover:text-[#3A2923]'
                }`}
              >
                全部 ({items.length})
              </button>

              {/* 仅看未售罄 */}
              <button 
                type="button"
                onClick={() => setFilterStockStatus(filterStockStatus === 'in_stock' ? 'all' : 'in_stock')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all ${
                  filterStockStatus === 'in_stock' 
                    ? 'bg-[#5F3E32] text-white border-[#4A2F25] shadow-sm' 
                    : 'bg-[#F5F1EF] text-[#5F3E32] border-[#AC9B95]/40 hover:bg-[#eae3df]'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                仅看未售罄 ({items.filter(i => (i.stock || 0) > 0).length})
              </button>

              {/* 仅看已售罄 */}
              <button 
                type="button"
                onClick={() => setFilterStockStatus(filterStockStatus === 'sold_out' ? 'all' : 'sold_out')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all ${
                  filterStockStatus === 'sold_out' 
                    ? 'bg-[#BB754B] text-white border-[#a35e36] shadow-sm' 
                    : 'bg-[#FDF3ED] text-[#BB754B] border-[#E8C5B0] hover:bg-[#fae4d7]'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                仅看已售罄 ({items.filter(i => (i.stock || 0) <= 0).length})
              </button>

              {/* Collapsible Advanced Filters Toggle Button */}
              <button
                type="button"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  showAdvancedFilters || (filterShelf || filterListedStatus !== 'all')
                    ? 'bg-[#F5F1EF] text-[#8D4429] border-[#AC9B95] ring-2 ring-[#8D4429]/20'
                    : 'bg-white text-[#3A2923] border-[#AC9B95]/40 hover:bg-stone-50'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>更多筛选</span>
                {(filterShelf || filterListedStatus !== 'all') && (
                  <span className="w-2 h-2 rounded-full bg-[#8D4429]" />
                )}
                {showAdvancedFilters ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
              </button>
            </div>
          </div>

          {/* Collapsible Advanced Filter Panel */}
          {showAdvancedFilters && (
            <div className="bg-[#FAF7F5] rounded-xl p-3.5 border border-[#AC9B95]/30 space-y-3 text-xs animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Shelf Location Filter */}
                <div>
                  <label className="block text-[#8C776D] font-semibold mb-1 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-gray-400" /> 货架位置
                  </label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-[#8D4429] text-xs text-[#3A2923]"
                    value={filterShelf}
                    onChange={(e) => setFilterShelf(e.target.value)}
                  >
                    <option value="">全部货架</option>
                    {existingShelves.map(s => <option key={s} value={s}>{s}</option>)}
                    <option value="__NONE__">未设置货架</option>
                  </select>
                </div>

                {/* Listing Status Filter */}
                <div>
                  <label className="block text-[#8C776D] font-semibold mb-1 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-gray-400" /> 上架状态
                  </label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-[#8D4429] text-xs text-[#3A2923]"
                    value={filterListedStatus}
                    onChange={(e) => setFilterListedStatus(e.target.value as any)}
                  >
                    <option value="all">全部状态</option>
                    <option value="listed">仅看已上架</option>
                    <option value="unlisted">仅看未上架</option>
                  </select>
                </div>

                {/* Sorting Selector */}
                <div>
                  <label className="block text-[#8C776D] font-semibold mb-1 flex items-center gap-1">
                    <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" /> 数据排序
                  </label>
                  <select 
                    className="w-full px-3 py-2 border border-[#AC9B95]/40 bg-[#F5F1EF]/50 text-[#8D4429] rounded-lg font-semibold focus:ring-2 focus:ring-[#8D4429] text-xs"
                    value={`${sortField}-${sortOrder}`}
                    onChange={(e) => {
                      const [field, order] = e.target.value.split('-');
                      setSortField(field as SortField);
                      setSortOrder(order as SortOrder);
                    }}
                  >
                    <option value="id-desc">编号最新 (倒序)</option>
                    <option value="id-asc">编号正序 (从低到高)</option>
                    <option value="price-desc">单价最高 (从高到低)</option>
                    <option value="price-asc">单价最低 (从低到高)</option>
                    <option value="stock-desc">库存最多</option>
                    <option value="stock-asc">库存最少 (缺货在先)</option>
                    <option value="sold-desc">销量最多 (已出最多)</option>
                    <option value="revenue-desc">销售额最高</option>
                    <option value="shelfLocation-asc">货架位置</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Row: Results Count & Clear Button */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 text-xs">
            <div className="flex items-center gap-2 text-[#8C776D] font-medium">
              <span>当前结果: <b className="text-[#3A2923]">{filteredItems.length}</b> 件</span>
              {(filterShelf || filterListedStatus !== 'all' || filterStockStatus !== 'all' || searchQuery) && (
                <span className="text-[#8D4429] bg-[#F5F1EF] px-2 py-0.5 rounded-md text-[11px] font-semibold border border-[#AC9B95]/30">
                  筛选中
                </span>
              )}
            </div>

            {(filterShelf || filterListedStatus !== 'all' || filterStockStatus !== 'all' || searchQuery) && (
              <button 
                onClick={() => { 
                  setFilterShelf('');
                  setFilterListedStatus('all');
                  setFilterStockStatus('all');
                  setSearchQuery(''); 
                }}
                className="px-2.5 py-1 text-xs text-[#BB754B] hover:bg-[#FDF3ED] rounded-lg border border-[#E8C5B0] font-semibold transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                清空全部筛选
              </button>
            )}
          </div>
        </div>

        {/* Mobile: Card List View */}
        <div className="md:hidden space-y-3">
          {filteredItems.length > 0 && (
            <div className="flex items-center justify-between px-2 text-xs text-[#8C776D]">
              <label className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  className="h-4 w-4 text-[#8D4429] focus:ring-[#8D4429] border-gray-300 rounded cursor-pointer accent-[#8D4429]"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                />
                <span>全选本页 ({filteredItems.length} 项)</span>
              </label>
              <div className="text-right text-[11px]">
                <span className="text-[#5F3E32] font-bold">总结: ¥{stats.settlementAmount.toFixed(1)}</span>
                <span className="text-[#BB754B] font-bold ml-1.5 bg-[#FDF3ED] px-1.5 py-0.5 rounded border border-[#E8C5B0]">待结: ¥{stats.pendingSettlementAmount.toFixed(1)}</span>
              </div>
            </div>
          )}

          {filteredItems.map((item) => (
            <div 
              key={item.id}
              onClick={(e) => handleEdit(e, item)}
              className={`bg-white rounded-2xl shadow-sm border p-4 transition-all ${
                selectedIds.has(item.id) 
                  ? 'border-[#8D4429] ring-2 ring-[#8D4429]/30 bg-[#F5F1EF]/30' 
                  : 'border-[#AC9B95]/30 hover:border-[#AC9B95]/60'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-start gap-2.5">
                  <input 
                    type="checkbox" 
                    className="mt-1 h-5 w-5 text-[#8D4429] focus:ring-[#8D4429] border-gray-300 rounded cursor-pointer accent-[#8D4429]"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleSelectRow(item.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div>
                    <div className="font-bold text-[#3A2923] text-base leading-tight">
                      {item.style || '默认款式'}
                    </div>
                    <div className="text-xs text-[#8C776D] mt-1 flex items-center gap-1.5">
                      <span className="font-medium text-[#3A2923]">{item.character}</span>
                      <span className="text-stone-300">·</span> 
                      <span>{item.series}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1">
                    {/* Shelf badge */}
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      item.shelfLocation === 'HB3' 
                        ? 'bg-[#F5F1EF] text-[#5F3E32] border border-[#AC9B95]/40' 
                        : (item.shelfLocation === 'HC3' ? 'bg-[#FDF3ED] text-[#BB754B] border border-[#E8C5B0]' : 'bg-stone-100 text-[#8C776D]')
                    }`}>
                      {item.shelfLocation || '未设货架'}
                    </span>
                    {/* Listed status badge */}
                    {item.isListed ? (
                      <span className="px-1.5 py-0.5 rounded bg-[#F5F1EF] text-[#8D4429] border border-[#AC9B95]/30 text-[10px] font-semibold flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> 已上架
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-stone-100 text-[#8C776D] text-[10px] font-medium">
                        未上架
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-[#8D4429]">
                    ¥{item.price.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Data Grid: Stock, Sold, Total Revenue */}
              <div className="grid grid-cols-3 gap-2 bg-[#FAF7F5] p-2.5 rounded-xl text-center mt-3 border border-[#AC9B95]/20">
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#8C776D]">库存</span>
                  <span className={`text-sm font-bold ${item.stock > 0 ? 'text-[#3A2923]' : 'text-[#BB754B]'}`}>
                    {item.stock > 0 ? item.stock : '已售罄'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#8C776D]">已出</span>
                  <span className="text-sm font-bold text-[#8D4429]">{item.sold}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#8C776D]">销售额</span>
                  <span className="text-sm font-bold text-[#3A2923]">
                    ¥{(item.sold * item.price).toFixed(1)}
                  </span>
                </div>
              </div>

              {item.remark && (
                <div className="mt-2 text-xs text-[#8C776D] italic bg-[#FDF3ED]/60 px-2 py-1 rounded border border-[#E8C5B0]/50">
                  注: {item.remark}
                </div>
              )}

              <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between gap-2">
                <button 
                  onClick={(e) => handleQuickSell(e, item.id)}
                  disabled={item.stock <= 0}
                  className="flex-1 bg-[#FDF3ED] text-[#BB754B] py-2 px-3 rounded-xl text-xs font-bold hover:bg-[#fae4d7] flex justify-center items-center disabled:opacity-40 transition-colors shadow-xs border border-[#E8C5B0]/40"
                >
                  <ShoppingCart className="w-3.5 h-3.5 mr-1.5 pointer-events-none" /> 售出 +1
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={(e) => handleEdit(e, item)}
                    className="bg-[#F5F1EF] text-[#8D4429] px-2.5 py-2 rounded-xl text-xs font-semibold hover:bg-[#eae3df] flex items-center gap-1 transition-colors border border-[#AC9B95]/30"
                    title="编辑商品"
                  >
                    <Edit2 className="w-3.5 h-3.5 pointer-events-none" /> 编辑
                  </button>
                  <button 
                    onClick={(e) => handleDuplicate(e, item)}
                    className="bg-stone-100 text-[#5F3E32] px-2 py-2 rounded-xl text-xs font-semibold hover:bg-stone-200 flex items-center transition-colors border border-stone-200"
                    title="复制为新商品"
                  >
                    <Copy className="w-3.5 h-3.5 pointer-events-none" />
                  </button>
                  <button 
                    onClick={(e) => handleDelete(e, item.id)}
                    className="bg-[#FDF3ED] text-[#8D4429] px-2.5 py-2 rounded-xl text-xs font-semibold hover:bg-[#fae4d7] flex items-center gap-1 transition-colors border border-[#E8C5B0]/40"
                    title="删除商品"
                  >
                    <Trash2 className="w-3.5 h-3.5 pointer-events-none" /> 删除
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-[#AC9B95]/30 text-[#8C776D]">
              <Package className="w-12 h-12 mx-auto mb-2 text-[#AC9B95]" />
              <p className="font-medium text-sm text-[#3A2923]">未找到符合条件的商品</p>
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setFilterShelf('');
                  setFilterListedStatus('all');
                  setFilterStockStatus('all');
                }}
                className="mt-2 text-xs text-[#8D4429] font-semibold hover:underline"
              >
                重置所有筛选条件
              </button>
            </div>
          )}
        </div>

        {/* Desktop: Table View with Draggable Column Resizing */}
        <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-[#AC9B95]/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table 
              className="w-full divide-y divide-[#AC9B95]/20 border-separate border-spacing-0"
              style={{ minWidth: `${totalTableWidth}px`, tableLayout: 'fixed' }}
            >
              <colgroup>
                <col style={{ width: '48px' }} />
                {TABLE_COLUMNS.map(col => (
                  <col key={col.fieldId} style={{ width: `${colWidths[col.fieldId] || col.defaultWidth}px` }} />
                ))}
              </colgroup>
              <thead className="bg-[#FAF7F5]">
                <tr>
                  <th className="px-4 py-3.5 w-12 min-w-[48px] bg-[#FAF7F5] border-b border-[#AC9B95]/30">
                    <input 
                      type="checkbox" 
                      className="h-4 w-4 text-[#8D4429] focus:ring-[#8D4429] border-gray-300 rounded cursor-pointer accent-[#8D4429]"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  {TABLE_COLUMNS.map((col) => {
                    const isResizingThis = activeResizingCol === col.fieldId;
                    const isSticky = col.stickyRight;

                    return (
                      <th 
                        key={col.fieldId}
                        className={`px-3.5 py-3.5 text-xs font-bold text-[#8C776D] uppercase tracking-wider relative select-none transition-colors border-b border-[#AC9B95]/30 ${
                          col.key ? 'cursor-pointer hover:bg-[#F5F1EF]' : ''
                        } ${
                          isSticky 
                            ? 'sticky right-0 bg-[#FAF7F5] z-20 border-l border-[#AC9B95]/30 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.06)]' 
                            : 'bg-[#FAF7F5]'
                        } ${col.align === 'center' ? 'text-center' : 'text-left'}`}
                        style={{ width: `${colWidths[col.fieldId] || col.defaultWidth}px` }}
                        onClick={() => col.key && handleSort(col.key)}
                      >
                        <div className={`flex items-center gap-1 overflow-hidden ${col.align === 'center' ? 'justify-center' : ''}`}>
                          <span className="truncate">{col.label}</span>
                          {col.key && (
                            sortField === col.key ? (
                              sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-[#8D4429] shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-[#8D4429] shrink-0" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-[#AC9B95] opacity-0 group-hover:opacity-100 shrink-0" />
                            )
                          )}
                        </div>

                        {/* Drag Handle to Resize Column */}
                        <div 
                          onMouseDown={(e) => handleResizeStart(e, col.fieldId)}
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setColWidths(prev => ({ ...prev, [col.fieldId]: col.defaultWidth }));
                          }}
                          title="按住左右拖动调整此列宽 (双击恢复默认)"
                          className={`absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-30 flex items-center justify-center group/handle transition-colors ${
                            isResizingThis ? 'bg-[#8D4429]/20' : 'hover:bg-[#8D4429]/15'
                          }`}
                        >
                          <div className={`w-[2px] h-3.5 rounded-full transition-colors ${
                            isResizingThis ? 'bg-[#8D4429]' : 'bg-[#AC9B95] group-hover/handle:bg-[#8D4429]'
                          }`} />
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-[#AC9B95]/15">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-6 py-14 text-center text-[#8C776D]">
                      <div className="flex flex-col items-center">
                        <Package className="w-12 h-12 text-[#AC9B95] mb-2" />
                        <p className="font-medium text-sm text-[#3A2923]">未找到匹配的商品</p>
                        <p className="text-xs text-[#8C776D] mt-1">请尝试放宽搜索词或重置筛选条件</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr 
                      key={item.id} 
                      className={`transition-colors ${
                        selectedIds.has(item.id) ? 'bg-[#F5F1EF]/70' : 'hover:bg-[#FAF7F5]/80'
                      }`}
                    >
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <input 
                          type="checkbox" 
                          className="h-4 w-4 text-[#8D4429] focus:ring-[#8D4429] border-gray-300 rounded cursor-pointer accent-[#8D4429]"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelectRow(item.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-3.5 py-3.5 whitespace-nowrap text-xs font-bold text-[#8C776D]">
                        #{item.id}
                      </td>
                      <td className="px-3.5 py-3.5 whitespace-nowrap text-sm font-semibold text-[#3A2923]">
                        <span className="truncate block" title={item.series}>{item.series}</span>
                      </td>
                      <td className="px-3.5 py-3.5 whitespace-nowrap text-sm text-[#3A2923]">
                        <span className="truncate block" title={item.character}>{item.character}</span>
                      </td>
                      <td className="px-3.5 py-3.5 text-sm text-[#3A2923]">
                        <div className="truncate font-medium" title={item.style}>{item.style || '-'}</div>
                        {item.remark && (
                          <div className="text-[11px] text-[#8C776D] italic truncate mt-0.5" title={item.remark}>
                            {item.remark}
                          </div>
                        )}
                      </td>
                      {/* Shelf Location Column */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap text-xs">
                        <span className={`px-2.5 py-1 rounded-md font-bold text-xs ${
                          item.shelfLocation === 'HB3' 
                            ? 'bg-[#F5F1EF] text-[#5F3E32] border border-[#AC9B95]/40' 
                            : (item.shelfLocation === 'HC3' ? 'bg-[#FDF3ED] text-[#BB754B] border border-[#E8C5B0]' : 'bg-stone-100 text-[#8C776D]')
                        }`}>
                          {item.shelfLocation || '未设'}
                        </span>
                      </td>
                      {/* Listing Status Column */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap text-xs">
                        {item.isListed ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#F5F1EF] text-[#8D4429] border border-[#AC9B95]/30">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> 已上架
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-[#8C776D]">
                            <XCircle className="w-3 h-3 mr-1" /> 未上架
                          </span>
                        )}
                      </td>
                      {/* Price Column */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap text-sm font-bold text-[#3A2923]">
                        ¥{item.price.toFixed(2)}
                      </td>
                      {/* Stock Column */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 inline-flex text-xs font-bold rounded-md ${
                          item.stock > 0 ? 'bg-[#F5F1EF] text-[#5F3E32] border border-[#AC9B95]/30' : 'bg-[#FDF3ED] text-[#BB754B] border border-[#E8C5B0]'
                        }`}>
                          {item.stock > 0 ? item.stock : '售罄'}
                        </span>
                      </td>
                      {/* Sold Column */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap text-sm text-[#3A2923] font-medium">
                        {item.sold}
                      </td>
                      {/* Total Sales Column */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap text-sm text-[#8D4429] font-bold">
                        ¥{(item.sold * item.price).toFixed(2)}
                      </td>
                      {/* Actions Column (Sticky Right) */}
                      <td 
                        className={`px-3 py-3.5 whitespace-nowrap text-center text-sm font-medium sticky right-0 z-10 border-l border-[#AC9B95]/30 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.06)] ${
                          selectedIds.has(item.id) ? 'bg-[#f4efe8]' : 'bg-white group-hover:bg-[#FAF7F5]'
                        }`}
                        style={{ width: `${colWidths['actions'] || 185}px` }}
                      >
                        <div className="flex items-center justify-center gap-1.5 flex-nowrap w-full">
                          <button 
                            onClick={(e) => handleQuickSell(e, item.id)}
                            disabled={item.stock <= 0}
                            title="快速售出 (+1 已出, -1 库存)"
                            className="p-1.5 text-[#BB754B] bg-[#FDF3ED] hover:bg-[#fae4d7] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 border border-[#E8C5B0]/50"
                          >
                            <ShoppingCart className="w-4 h-4 pointer-events-none" />
                          </button>
                          <button 
                            onClick={(e) => handleDuplicate(e, item)}
                            title="复制为新商品"
                            className="p-1.5 text-[#5F3E32] bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors shrink-0 border border-stone-200"
                          >
                            <Copy className="w-4 h-4 pointer-events-none" />
                          </button>
                          <button 
                            onClick={(e) => handleEdit(e, item)}
                            title="编辑商品"
                            className="p-1.5 text-[#8D4429] bg-[#F5F1EF] hover:bg-[#eae3df] rounded-lg transition-colors shrink-0 border border-[#AC9B95]/30"
                          >
                            <Edit2 className="w-4 h-4 pointer-events-none" />
                          </button>
                          <button 
                            onClick={(e) => handleDelete(e, item.id)}
                            title="删除商品"
                            className="p-1.5 text-[#8D4429] bg-[#FDF3ED] hover:bg-[#fae4d7] rounded-lg transition-colors shrink-0 border border-[#E8C5B0]/50"
                          >
                            <Trash2 className="w-4 h-4 pointer-events-none" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-[#FAF7F5] px-6 py-3 border-t border-[#AC9B95]/30 text-xs text-[#8C776D] flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-3">
              <span>显示 {filteredItems.length} 项商品 (共 {items.length} 条记录)</span>
              <button
                onClick={handleResetColWidths}
                className="text-[11px] text-[#8D4429] hover:underline flex items-center gap-1 hover:text-[#723720]"
                title="重置所有表格列宽为默认值"
              >
                <RotateCcw className="w-3 h-3" /> 重置列宽
              </button>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <span>总销售额: <b className="text-[#3A2923] font-bold">¥{stats.actualRevenue.toLocaleString()}</b></span>
              <span className="text-[#5F3E32]">
                总结算: <b className="font-bold">¥{stats.settlementAmount.toFixed(1)}</b>
              </span>
              <span className="text-[#8D4429]">
                已结算: <b className="font-bold">¥{stats.totalPaidAmount.toFixed(1)}</b>
              </span>
              <span className="text-[#BB754B] bg-[#FDF3ED] px-2.5 py-0.5 rounded-md border border-[#E8C5B0] font-bold">
                待结算: ¥{stats.pendingSettlementAmount.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;

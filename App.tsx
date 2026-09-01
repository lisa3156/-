import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Redo2
} from 'lucide-react';
import { InventoryItem, SortField, SortOrder, SettlementSettings, UndoAction } from './types';
import { InputWithSuggestions } from './components/InputWithSuggestions';
import { StatsCard } from './components/StatsCard';

const STORAGE_KEY = 'merch_tracker_cn_v1';
const SETTLEMENT_KEY = 'merch_settlement_rates_v1';

const DEFAULT_SETTLEMENT: SettlementSettings = {
  hb3Rate: 0.92,
  hc3Rate: 0.80
};

const DEFAULT_SHELF_OPTIONS = ['HB3', 'HC3'];

export const App: React.FC = () => {
  // --- State ---
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  // --- Effects ---

  // Toast notification helper
  const showToast = (text: string, isUndoNotification = true) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({ text, isUndoNotification });
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Push snapshot to undo stack
  const pushUndo = (description: string, prevItems: InventoryItem[]) => {
    setUndoStack(prev => [{ description, items: prevItems, timestamp: Date.now() }, ...prev.slice(0, 29)]);
    setRedoStack([]); // Clear redo stack on new modification
    showToast(description, true);
  };

  // Undo Handler
  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const [actionToUndo, ...remainingUndo] = undoStack;
    setRedoStack(prev => [{ description: actionToUndo.description, items, timestamp: Date.now() }, ...prev.slice(0, 29)]);
    setUndoStack(remainingUndo);
    setItems(actionToUndo.items);
    showToast(`已撤销：${actionToUndo.description}`, false);
  };

  // Redo Handler
  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const [actionToRedo, ...remainingRedo] = redoStack;
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

  // Load Settlement Settings on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem(SETTLEMENT_KEY);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettlementSettings({
          hb3Rate: typeof parsed.hb3Rate === 'number' ? parsed.hb3Rate : DEFAULT_SETTLEMENT.hb3Rate,
          hc3Rate: typeof parsed.hc3Rate === 'number' ? parsed.hc3Rate : DEFAULT_SETTLEMENT.hc3Rate
        });
      } catch (e) {
        console.error("Failed to parse settlement settings", e);
      }
    }
  }, []);

  // Save Settlement Settings on change
  const updateSettlementSettings = (newSettings: SettlementSettings) => {
    setSettlementSettings(newSettings);
    localStorage.setItem(SETTLEMENT_KEY, JSON.stringify(newSettings));
  };

  // Load data on mount with Sanitization & Backward compatibility migration
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsedData = JSON.parse(saved);
        if (Array.isArray(parsedData)) {
          const sanitizedData: InventoryItem[] = parsedData
            .map((item: any) => {
              // Backward compatibility: If isListed is missing, infer from isOnline || isOffline
              const isListed = item.isListed !== undefined 
                ? !!item.isListed 
                : !!(item.isOnline || item.isOffline);
                
              return {
                ...item,
                id: Number(item.id),
                stock: Number(item.stock) || 0,
                sold: Number(item.sold) || 0,
                price: Number(item.price) || 0,
                shelfLocation: item.shelfLocation ? String(item.shelfLocation).trim() : 'HB3',
                isListed,
                createdAt: item.createdAt || Date.now()
              };
            })
            .filter((item) => !isNaN(item.id));
            
          setItems(sanitizedData);
        }
      } catch (e) {
        console.error("Failed to parse saved data", e);
      }
    } else {
      // Seed initial demo data (without requiring type)
      setItems([
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
      ]);
    }
  }, []);

  // Save data on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

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
      settlementAmount 
    };
  }, [filteredItems, settlementSettings]);

  // --- Handlers ---

  const handleInputChange = (field: keyof InventoryItem, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingId) {
      // Update existing
      const existingItem = items.find(i => i.id === editingId);
      pushUndo(`修改商品 #${editingId} (${existingItem?.character || ''} ${existingItem?.style || ''})`, items);
      
      setItems(prev => prev.map(item => 
        item.id === editingId ? { 
          ...item, 
          ...formData,
          shelfLocation: formData.shelfLocation ? String(formData.shelfLocation).trim() : 'HB3',
          isListed: formData.isListed !== undefined ? !!formData.isListed : true
        } as InventoryItem : item
      ));
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
      
      pushUndo(`新增商品 #${newId} (${newItem.character || ''} ${newItem.style || ''})`, items);
      setItems(prev => [newItem, ...prev]);
    }
    
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

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (isNaN(id)) {
      alert("无法删除 ID 无效的条目，请尝试刷新页面。");
      return;
    }

    const itemToDelete = items.find(i => String(i.id) === String(id));
    if (window.confirm(`确定要删除商品 #${id} (${itemToDelete?.character || ''} ${itemToDelete?.style || ''}) 吗？`)) {
      pushUndo(`删除商品 #${id} (${itemToDelete?.character || ''} ${itemToDelete?.style || ''})`, items);
      setItems(prev => prev.filter(i => String(i.id) !== String(id)));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`确定要删除选中的 ${selectedIds.size} 项商品吗？`)) {
      pushUndo(`批量删除 ${selectedIds.size} 项商品`, items);
      const idsToRemove = new Set(Array.from(selectedIds).map(String));
      setItems(prev => prev.filter(item => !idsToRemove.has(String(item.id))));
      setSelectedIds(new Set());
      setIsSidebarOpen(false);
    }
  };

  const handleBulkListingUpdate = (isListed: boolean) => {
    if (selectedIds.size === 0) return;
    pushUndo(`批量${isListed ? '上架' : '下架'} ${selectedIds.size} 项商品`, items);
    setItems(prev => prev.map(item => {
      if (!selectedIds.has(item.id)) return item;
      return { ...item, isListed };
    }));
    setIsSidebarOpen(false);
  };

  const handleBulkShelfUpdate = (shelfLocation: string) => {
    if (selectedIds.size === 0) return;
    pushUndo(`批量修改货架为 ${shelfLocation} (${selectedIds.size} 项)`, items);
    setItems(prev => prev.map(item => {
      if (!selectedIds.has(item.id)) return item;
      return { ...item, shelfLocation };
    }));
    setIsSidebarOpen(false);
  };

  const handleQuickSell = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const itemToSell = items.find(i => i.id === id);
    if (!itemToSell || itemToSell.stock <= 0) {
      alert("库存不足！");
      return;
    }

    pushUndo(`快速售出 +1 (${itemToSell.character || ''} ${itemToSell.style || ''})`, items);
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          stock: item.stock - 1,
          sold: item.sold + 1
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
    reader.onload = (evt) => {
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

        pushUndo(`导入 Excel 数据 (新增 ${addedCount} 条, 更新 ${updatedCount} 条)`, items);
        setItems(validItems);
        alert(`导入完成！新增: ${addedCount} 条，更新: ${updatedCount} 条。`);

      } catch (error) {
        console.error("Import error:", error);
        alert("导入失败，请检查文件格式是否正确。");
      }
    };

    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // --- Settlement Ratio Settings Modal ---
  const SettlementModal = () => {
    const [hb3Input, setHb3Input] = useState((settlementSettings.hb3Rate * 100).toString());
    const [hc3Input, setHc3Input] = useState((settlementSettings.hc3Rate * 100).toString());

    const handleSave = () => {
      const hb3Num = parseFloat(hb3Input);
      const hc3Num = parseFloat(hc3Input);
      
      const newHb3Rate = isNaN(hb3Num) ? DEFAULT_SETTLEMENT.hb3Rate : Math.max(0, hb3Num) / 100;
      const newHc3Rate = isNaN(hc3Num) ? DEFAULT_SETTLEMENT.hc3Rate : Math.max(0, hc3Num) / 100;

      updateSettlementSettings({
        hb3Rate: newHb3Rate,
        hc3Rate: newHc3Rate
      });
      setIsSettlementModalOpen(false);
    };

    const handleReset = () => {
      setHb3Input((DEFAULT_SETTLEMENT.hb3Rate * 100).toString());
      setHc3Input((DEFAULT_SETTLEMENT.hc3Rate * 100).toString());
      updateSettlementSettings(DEFAULT_SETTLEMENT);
    };

    return (
      <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsSettlementModalOpen(false)} />
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="flex justify-between items-center p-5 border-b bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#EAF3F8] text-[#2D6994] rounded-xl">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#2C3842]">结算金额比例设置</h3>
                <p className="text-xs text-[#697A88]">自定义不同货架的销售提成与结算比例</p>
              </div>
            </div>
            <button onClick={() => setIsSettlementModalOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-slate-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div className="bg-[#EAF3F8] p-3.5 rounded-xl border border-[#72B8D6]/30 text-xs text-[#2D6994] leading-relaxed">
              <span className="font-semibold block mb-1">当前计算公式：</span>
              结算金额 = 货架 HB3 销售额 × <b>{((settlementSettings.hb3Rate || 0.92) * 100).toFixed(0)}%</b> + 货架 HC3 销售额 × <b>{((settlementSettings.hc3Rate || 0.8) * 100).toFixed(0)}%</b>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#2C3842] mb-1 flex justify-between items-center">
                  <span>HB3 货架结算比例 (%)</span>
                  <span className="text-xs text-[#2D6994] font-medium">默认 92% (乘数 0.92)</span>
                </label>
                <div className="relative">
                  <input 
                    type="number" 
                    step="0.1"
                    min="0"
                    max="100"
                    value={hb3Input}
                    onChange={(e) => setHb3Input(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#2D6994] focus:border-[#2D6994] font-medium text-[#2C3842]"
                    placeholder="92"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">%</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#2C3842] mb-1 flex justify-between items-center">
                  <span>HC3 货架结算比例 (%)</span>
                  <span className="text-xs text-[#2D6994] font-medium">默认 80% (乘数 0.80)</span>
                </label>
                <div className="relative">
                  <input 
                    type="number" 
                    step="0.1"
                    min="0"
                    max="100"
                    value={hc3Input}
                    onChange={(e) => setHc3Input(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#2D6994] focus:border-[#2D6994] font-medium text-[#2C3842]"
                    placeholder="80"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">%</span>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200/80 pt-4 space-y-2 text-xs text-[#697A88]">
              <div className="flex justify-between">
                <span>HB3 当前总销售额：</span>
                <span className="font-semibold text-[#2C3842]">¥{stats.hb3Sales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>HC3 当前总销售额：</span>
                <span className="font-semibold text-[#2C3842]">¥{stats.hc3Sales.toFixed(2)}</span>
              </div>
              {stats.otherSales > 0 && (
                <div className="flex justify-between text-[#D87048]">
                  <span>其他/未设置货架销售额 (不参与结算)：</span>
                  <span className="font-semibold">¥{stats.otherSales.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-[#2D6994] pt-1 border-t border-slate-200">
                <span>预计结算总额：</span>
                <span>¥{stats.settlementAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t flex justify-between gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 text-xs font-medium text-[#697A88] hover:text-[#2C3842] hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              恢复默认 (92% / 80%)
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsSettlementModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-[#2C3842] bg-white border border-gray-300 rounded-lg hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2 text-sm font-medium text-white bg-[#2D6994] rounded-lg hover:bg-[#235375] shadow-sm"
              >
                保存设置
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

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
          <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-lg font-bold text-[#2C3842] flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#2D6994]" />
              已售商品明细与货架结算 ({soldItems.length} 款)
            </h3>
            <button onClick={() => setIsSalesDetailModalOpen(false)} className="text-gray-400 hover:text-[#2C3842] p-1 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-0 overflow-auto flex-1 bg-slate-50/60">
            {/* Mobile View */}
            <div className="md:hidden">
              {soldItems.map(item => {
                const itemRevenue = item.sold * item.price;
                const shelf = (item.shelfLocation || '').toUpperCase();
                const rate = shelf === 'HB3' ? settlementSettings.hb3Rate : (shelf === 'HC3' ? settlementSettings.hc3Rate : 0);
                const settlement = itemRevenue * rate;

                return (
                  <div key={item.id} className="bg-white p-4 border-b border-slate-100 last:border-0">
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-medium text-[#2C3842] flex items-center gap-1.5">
                        <span className="font-bold">{item.style || '无款式'}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          shelf === 'HB3' ? 'bg-amber-100 text-amber-800' : (shelf === 'HC3' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-700')
                        }`}>
                          {item.shelfLocation || '未设货架'}
                        </span>
                      </div>
                      <div className="text-[#2D6994] font-bold">¥{itemRevenue.toLocaleString()}</div>
                    </div>
                    <div className="text-xs text-[#697A88] mb-2">
                      {item.series} | {item.character} | {item.type}
                    </div>
                    <div className="flex justify-between text-xs text-[#697A88] bg-slate-50 p-2 rounded-lg">
                      <span>单价: ¥{item.price}</span>
                      <span>已出: <b className="text-[#2C3842]">{item.sold}</b></span>
                      {rate > 0 && (
                        <span className="text-[#2D6994] font-medium">
                          结算 ({Math.round(rate * 100)}%): <b>¥{settlement.toFixed(2)}</b>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {soldItems.length === 0 && (
                <div className="text-center py-10 text-[#697A88]">暂无销售记录</div>
              )}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#697A88] uppercase tracking-wider">商品信息</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#697A88] uppercase tracking-wider">货架</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#697A88] uppercase tracking-wider">单价</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#697A88] uppercase tracking-wider">已出数量</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-[#697A88] uppercase tracking-wider">销售总额</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-[#2D6994] uppercase tracking-wider">货架结算贡献</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {soldItems.map((item) => {
                    const itemRevenue = item.sold * item.price;
                    const shelf = (item.shelfLocation || '').toUpperCase();
                    const rate = shelf === 'HB3' ? settlementSettings.hb3Rate : (shelf === 'HC3' ? settlementSettings.hc3Rate : 0);
                    const settlement = itemRevenue * rate;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-[#2C3842]">{item.style || '默认款式'}</div>
                          <div className="text-xs text-[#697A88]">{item.series} - {item.character} ({item.type})</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            shelf === 'HB3' ? 'bg-amber-100 text-amber-800' : (shelf === 'HC3' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600')
                          }`}>
                            {item.shelfLocation || '无'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#697A88]">
                          ¥{item.price.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#2C3842] font-semibold">
                          {item.sold}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#2C3842] font-bold text-right">
                          ¥{itemRevenue.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#2D6994] font-bold text-right">
                          {rate > 0 ? (
                            <span>¥{settlement.toFixed(2)} <span className="text-[11px] font-normal text-[#697A88]">({Math.round(rate * 100)}%)</span></span>
                          ) : (
                            <span className="text-gray-400 text-xs font-normal">未参与</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {soldItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-[#697A88]">当前筛选条件下暂无销售记录</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border-t border-slate-100 p-4 flex flex-wrap justify-between items-center shadow-lg relative z-20 gap-3">
            <div className="text-sm text-[#697A88]">
              共售出 <span className="font-bold text-[#2C3842]">{totalSold}</span> 件商品 | 销售总额: <span className="font-bold text-[#2C3842]">¥{totalRevenue.toLocaleString()}</span>
            </div>
            <div className="text-base font-bold text-[#2D6994] flex items-center gap-2">
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
        alert('数据已复制到剪贴板！');
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

    const tryRestore = (jsonContent: string) => {
      if (!jsonContent) return;
      if (!window.confirm('警告：此操作将覆盖当前所有数据！确定要恢复吗？')) return;
      
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

        pushUndo(`从 JSON 备份恢复数据 (${sanitizedData.length} 条)`, items);
        setItems(sanitizedData);
        alert(`成功恢复 ${sanitizedData.length} 条数据！`);
        setIsBackupModalOpen(false);
      } catch (e) {
        alert('数据格式错误，请确保导入的是正确的 JSON 备份文件。');
      }
    };

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsBackupModalOpen(false)} />
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative z-10 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-lg font-bold text-[#2C3842] flex items-center gap-2">
              <Database className="w-5 h-5 text-[#2D6994]" />
              数据备份与迁移
            </h3>
            <button onClick={() => setIsBackupModalOpen(false)} className="text-gray-400 hover:text-[#2C3842]">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex border-b border-slate-100">
            <button 
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${mode === 'export' ? 'text-[#2D6994] border-b-2 border-[#2D6994] bg-[#EAF3F8]/30' : 'text-[#697A88] hover:bg-slate-50'}`}
              onClick={() => setMode('export')}
            >
              导出 (备份)
            </button>
            <button 
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${mode === 'import' ? 'text-[#2D6994] border-b-2 border-[#2D6994] bg-[#EAF3F8]/30' : 'text-[#697A88] hover:bg-slate-50'}`}
              onClick={() => setMode('import')}
            >
              导入 (恢复)
            </button>
          </div>

          <div className="p-5 flex-1 overflow-auto">
            {mode === 'export' ? (
              <div className="space-y-5">
                <div className="bg-[#EAF3F8] p-4 rounded-xl border border-[#72B8D6]/30">
                  <h4 className="font-semibold text-[#2D6994] mb-1.5 flex items-center">
                    <FileJson className="w-4 h-4 mr-2" /> 推荐：下载备份文件
                  </h4>
                  <p className="text-xs text-[#2D6994]/80 mb-3">
                    将生成一个 .json 文件。在其他设备上使用“上传备份文件”即可恢复。
                  </p>
                  <button 
                    onClick={handleDownloadJSON}
                    className="w-full py-2.5 bg-[#2D6994] text-white rounded-xl hover:bg-[#235375] font-semibold shadow-sm flex items-center justify-center text-sm transition-colors"
                  >
                    <Download className="w-4 h-4 mr-2" /> 下载 JSON 文件
                  </button>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <h4 className="font-medium text-[#2C3842] mb-2 text-sm flex items-center">
                    <ClipboardCopy className="w-4 h-4 mr-2 text-[#697A88]" /> 备用：复制文本
                  </h4>
                  <textarea 
                    readOnly 
                    value={jsonString}
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                    className="w-full h-24 p-2 border border-slate-200 rounded-xl text-[10px] font-mono bg-slate-50 focus:ring-2 focus:ring-[#2D6994] text-[#697A88]"
                  />
                  <button 
                    onClick={handleCopy}
                    className="w-full mt-2 py-2 border border-[#2D6994] text-[#2D6994] rounded-xl hover:bg-[#EAF3F8] font-semibold text-xs transition-colors"
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

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="font-semibold text-[#2C3842] mb-1.5 flex items-center">
                    <FileUp className="w-4 h-4 mr-2 text-[#2D6994]" /> 方式一：上传备份文件
                  </h4>
                  <p className="text-xs text-[#697A88] mb-3">
                    选择之前下载的 .json 备份文件进行恢复。
                  </p>
                  <button 
                    onClick={() => jsonFileRef.current?.click()}
                    className="w-full py-2.5 bg-white border border-slate-300 text-[#2C3842] rounded-xl hover:bg-slate-50 font-semibold shadow-sm flex items-center justify-center text-sm transition-colors"
                  >
                    <Upload className="w-4 h-4 mr-2" /> 选择文件
                  </button>
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <h4 className="font-medium text-[#2C3842] text-sm flex items-center">
                    <ClipboardCopy className="w-4 h-4 mr-2 text-[#697A88]" /> 方式二：粘贴文本
                  </h4>
                  <textarea 
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder='在此粘贴 JSON 数据...'
                    className="w-full h-24 p-3 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#2D6994] text-[#2C3842]"
                  />
                  <button 
                    onClick={() => tryRestore(importText)}
                    disabled={!importText}
                    className="w-full py-2.5 bg-[#D87048] text-white rounded-xl hover:bg-[#c25e37] font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
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
      {isSettlementModalOpen && <SettlementModal />}

      {/* Mobile Sidebar (Drawer) with Settlement Ratio Settings */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsSidebarOpen(false)}
          />
          
          <div className="relative w-80 bg-white h-full shadow-2xl p-5 flex flex-col gap-5 overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#2D6994]" />
                <h2 className="text-lg font-bold text-[#2C3842]">功能菜单</h2>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 text-gray-400 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4 flex-1">
              <button 
                onClick={() => { resetForm(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="w-full flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-[#2C3842] bg-[#F5B8A9] rounded-xl hover:bg-[#f3a896] shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4 mr-2 text-[#2C3842]" />
                新建商品登记
              </button>

              {/* Mobile Settlement Ratio Settings Section */}
              <div className="bg-[#EAF3F8] p-4 rounded-xl border border-[#72B8D6]/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#2D6994]">
                    <Calculator className="w-4 h-4 text-[#2D6994]" />
                    <span>结算比例设置 (货架)</span>
                  </div>
                  <button 
                    onClick={() => updateSettlementSettings(DEFAULT_SETTLEMENT)}
                    className="text-[11px] text-[#2D6994] font-medium hover:underline"
                  >
                    重置
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[#697A88] mb-1">HB3 比例 (%)</label>
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
                      className="w-full px-2.5 py-1.5 bg-white border border-[#72B8D6]/40 rounded-lg text-sm font-bold text-[#2C3842]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#697A88] mb-1">HC3 比例 (%)</label>
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
                      className="w-full px-2.5 py-1.5 bg-white border border-[#72B8D6]/40 rounded-lg text-sm font-bold text-[#2C3842]"
                    />
                  </div>
                </div>
                <div className="text-[10px] text-[#2D6994]/80 leading-tight">
                  结算金额 = HB3销售额 × {(settlementSettings.hb3Rate * 100).toFixed(0)}% + HC3销售额 × {(settlementSettings.hc3Rate * 100).toFixed(0)}%
                </div>
              </div>

              {/* Bulk operations when items selected */}
              {selectedIds.size > 0 && (
                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 space-y-2">
                  <div className="text-xs font-semibold text-[#2C3842]">
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
                      className="flex items-center justify-center p-2 bg-white text-[#2C3842] border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-50"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      设为未上架
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button 
                      onClick={() => handleBulkShelfUpdate('HB3')}
                      className="flex items-center justify-center p-2 bg-white text-amber-800 border border-amber-200 rounded-lg text-xs font-medium hover:bg-amber-50"
                    >
                      设为货架 HB3
                    </button>
                    <button 
                      onClick={() => handleBulkShelfUpdate('HC3')}
                      className="flex items-center justify-center p-2 bg-white text-purple-800 border border-purple-200 rounded-lg text-xs font-medium hover:bg-purple-50"
                    >
                      设为货架 HC3
                    </button>
                  </div>
                  <button 
                    onClick={handleBatchDelete}
                    className="w-full flex items-center justify-center p-2 bg-[#D87048] text-white rounded-lg text-xs font-semibold hover:bg-[#c25e37] shadow-sm"
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
                  className="flex items-center justify-center px-3 py-2 text-xs font-semibold text-[#2D6994] bg-[#EAF3F8] rounded-xl hover:bg-[#d9ecf5] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  <Undo2 className="w-4 h-4 mr-1.5" />
                  撤销 ({undoStack.length})
                </button>
                <button 
                  onClick={() => { handleRedo(); setIsSidebarOpen(false); }}
                  disabled={redoStack.length === 0}
                  className="flex items-center justify-center px-3 py-2 text-xs font-semibold text-[#2D6994] bg-[#EAF3F8] rounded-xl hover:bg-[#d9ecf5] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  <Redo2 className="w-4 h-4 mr-1.5" />
                  重做 ({redoStack.length})
                </button>
              </div>

              <button 
                onClick={() => { setIsSalesDetailModalOpen(true); setIsSidebarOpen(false); }}
                className="w-full flex items-center px-4 py-2.5 text-sm font-medium text-[#2C3842] bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100"
              >
                <Receipt className="w-4 h-4 mr-3 text-[#2D6994]" />
                已售商品明细
              </button>

              <button 
                onClick={() => { setIsBackupModalOpen(true); setIsSidebarOpen(false); }}
                className="w-full flex items-center px-4 py-2.5 text-sm font-medium text-[#2C3842] bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100"
              >
                <Database className="w-4 h-4 mr-3 text-[#2D6994]" />
                数据备份 / 恢复
              </button>

              <button 
                onClick={triggerImport}
                className="w-full flex items-center px-4 py-2.5 text-sm font-medium text-[#2C3842] bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100"
              >
                <Upload className="w-4 h-4 mr-3 text-[#697A88]" />
                导入 Excel
              </button>
              
              <button 
                onClick={exportToExcel}
                className="w-full flex items-center px-4 py-2.5 text-sm font-medium text-[#2C3842] bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100"
              >
                <Download className="w-4 h-4 mr-3 text-[#2D6994]" />
                {selectedIds.size > 0 ? `导出选中 (${selectedIds.size}) Excel` : '导出全部 Excel (含打签)'}
              </button>
            </div>
            
            <div className="text-[11px] text-[#697A88] text-center border-t border-slate-100 pt-3">
              周边库存管理表 · HB3/HC3 结算版
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-[#2D6994] shadow-md sticky top-0 z-30 border-b border-[#235375]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 bg-white/15 text-white rounded-xl backdrop-blur-sm border border-white/20 shadow-sm">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-bold text-white leading-tight truncate tracking-wide">
                周边库存管理表
              </h1>
              <p className="text-[11px] text-[#72B8D6] hidden sm:block font-medium">
                支持货架管理 · HB3/HC3 自定义结算 · 打签名称导出
              </p>
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
                  className="px-2 py-1 text-xs text-[#2C3842] bg-white/90 hover:bg-white rounded-lg flex items-center gap-1 font-semibold"
                >
                  <XCircle className="w-3.5 h-3.5" /> 下架
                </button>
                <button 
                  onClick={() => handleBulkShelfUpdate('HB3')} 
                  title="设为 HB3" 
                  className="px-2 py-1 text-xs text-amber-900 bg-amber-200 hover:bg-amber-300 rounded-lg font-bold"
                >
                  HB3
                </button>
                <button 
                  onClick={() => handleBulkShelfUpdate('HC3')} 
                  title="设为 HC3" 
                  className="px-2 py-1 text-xs text-purple-900 bg-purple-200 hover:bg-purple-300 rounded-lg font-bold"
                >
                  HC3
                </button>
                <button 
                  onClick={handleBatchDelete}
                  title="批量删除"
                  className="p-1.5 text-white bg-[#D87048] hover:bg-[#c25e37] rounded-lg shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Undo / Redo Toolbar Buttons */}
            <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl border border-white/20">
              <button 
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className="flex items-center px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20 disabled:opacity-40 disabled:pointer-events-none rounded-lg transition-colors"
                title={`撤销操作 (Ctrl+Z) - 当前可撤销 ${undoStack.length} 步`}
              >
                <Undo2 className="w-3.5 h-3.5 mr-1 text-[#72B8D6]" />
                <span>撤销</span>
                {undoStack.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 bg-[#72B8D6] text-[#2D6994] rounded-full text-[10px] font-bold">
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
                <Redo2 className="w-3.5 h-3.5 mr-1 text-[#72B8D6]" />
                <span>重做</span>
                {redoStack.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 bg-[#F5B8A9] text-[#2C3842] rounded-full text-[10px] font-bold">
                    {redoStack.length}
                  </span>
                )}
              </button>
            </div>

            <button 
              onClick={() => setIsSettlementModalOpen(true)}
              className="flex items-center px-3 py-2 text-xs font-semibold text-[#2D6994] bg-white rounded-lg hover:bg-slate-100 transition-colors shadow-sm"
              title="设置 HB3 / HC3 结算比例"
            >
              <Calculator className="w-3.5 h-3.5 mr-1.5 text-[#2D6994]" />
              结算比例设置
            </button>

            <button 
              onClick={() => setIsBackupModalOpen(true)}
              className="flex items-center px-3 py-2 text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors"
            >
              <Database className="w-3.5 h-3.5 mr-1.5 text-[#72B8D6]" />
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
              <Download className="w-3.5 h-3.5 mr-1.5 text-[#72B8D6]" />
              导出 Excel
            </button>
            <button 
              onClick={() => { resetForm(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="flex items-center px-3.5 py-2 text-xs font-semibold text-[#2C3842] bg-[#F5B8A9] rounded-lg hover:bg-[#f3a896] transition-colors shadow-sm"
            >
              {editingId ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-[#2C3842]" /> : <Plus className="w-3.5 h-3.5 mr-1.5 text-[#2C3842]" />}
              {editingId ? '取消编辑' : '新建商品'}
            </button>
          </div>

          {/* Mobile Menu Trigger */}
          <div className="md:hidden flex items-center gap-1.5">
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
              className="p-2 text-[#2D6994] bg-white rounded-lg shadow-sm"
              title="结算设置"
            >
              <Calculator className="w-4 h-4" />
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
          <div className="bg-[#2C3842] text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700/60 flex items-center gap-3 text-sm">
            <span className="font-medium">{toastMessage.text}</span>
            {toastMessage.isUndoNotification && undoStack.length > 0 && (
              <button 
                onClick={handleUndo}
                className="px-2.5 py-1 bg-[#2D6994] hover:bg-[#235375] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shadow-sm"
              >
                <Undo2 className="w-3 h-3" />
                撤销
              </button>
            )}
            <button 
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-white ml-1"
            >
              <X className="w-4 h-4" />
            </button>
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
            colorClass="bg-[#72B8D6] text-[#2D6994]" 
          />
          <StatsCard 
            title="总销售额" 
            value={`¥${stats.actualRevenue.toLocaleString()}`} 
            subValue={`${stats.totalSold} 件已出 · 点击看明细`}
            icon={DollarSign} 
            colorClass="bg-[#2D6994] text-[#2D6994]" 
            onClick={() => setIsSalesDetailModalOpen(true)}
          />
          {/* Settlement Card */}
          <StatsCard 
            title="结算金额" 
            value={`¥${stats.settlementAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
            subValue={`HB3(${((settlementSettings.hb3Rate || 0.92) * 100).toFixed(0)}%): ¥${stats.hb3Settlement.toFixed(1)} | HC3(${((settlementSettings.hc3Rate || 0.8) * 100).toFixed(0)}%): ¥${stats.hc3Settlement.toFixed(1)}`}
            icon={Calculator} 
            colorClass="bg-emerald-500 text-emerald-700" 
            onClick={() => setIsSettlementModalOpen(true)}
            actionButton={
              <button 
                onClick={(e) => { e.stopPropagation(); setIsSettlementModalOpen(true); }}
                className="p-1 text-[#2D6994] hover:bg-[#EAF3F8] rounded-lg"
                title="调整结算比例"
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
            colorClass={items.filter(i => (i.stock || 0) <= 0).length > 0 ? "bg-[#D87048] text-[#D87048]" : "bg-[#72B8D6] text-[#2D6994]"} 
            onClick={() => {
              if (filterStockStatus === 'all') setFilterStockStatus('in_stock');
              else if (filterStockStatus === 'in_stock') setFilterStockStatus('sold_out');
              else setFilterStockStatus('all');
            }}
          />
        </div>

        {/* Input Form Area */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 md:p-6 transition-all">
          <div className="flex justify-between items-center mb-4 md:mb-5 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-5 bg-[#72B8D6] rounded-full"></div>
              <h2 className="text-base md:text-lg font-bold text-[#2C3842]">
                {editingId ? `编辑商品 #${editingId}` : '商品登记与录入'}
              </h2>
            </div>
            {editingId && (
              <button onClick={resetForm} className="text-xs font-semibold text-[#697A88] hover:text-[#2C3842] bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors">
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
              <label className="block text-sm font-medium text-[#2C3842] mb-1">款式规格</label>
              <input 
                type="text" 
                value={formData.style || ''} 
                onChange={(e) => handleInputChange('style', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D6994] focus:border-[#2D6994] text-sm text-[#2C3842]"
                placeholder="例如：镭射票 / 15cm 站姿"
              />
            </div>
            
            {/* Shelf Location with quick HB3 / HC3 selector */}
            <div>
              <label className="block text-sm font-medium text-[#2C3842] mb-1">
                货架位置 <span className="text-[#2D6994] text-xs font-normal">(主要结算依据)</span>
              </label>
              <div className="flex gap-1.5">
                <input 
                  type="text"
                  value={formData.shelfLocation || ''}
                  onChange={(e) => handleInputChange('shelfLocation', e.target.value.toUpperCase())}
                  placeholder="例如：HB3 或 HC3"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D6994] focus:border-[#2D6994] text-sm font-medium text-[#2C3842]"
                />
                <button 
                  type="button" 
                  onClick={() => handleInputChange('shelfLocation', 'HB3')}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                    (formData.shelfLocation || '').toUpperCase() === 'HB3'
                      ? 'bg-amber-500 text-white border-amber-600'
                      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  HB3
                </button>
                <button 
                  type="button" 
                  onClick={() => handleInputChange('shelfLocation', 'HC3')}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                    (formData.shelfLocation || '').toUpperCase() === 'HC3'
                      ? 'bg-purple-600 text-white border-purple-700'
                      : 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
                  }`}
                >
                  HC3
                </button>
              </div>
            </div>

            {/* Listing Status Toggle (是否已上架) */}
            <div className="flex flex-col justify-end pb-1">
              <label className="block text-sm font-medium text-[#2C3842] mb-1">上架状态</label>
              <label className="flex items-center gap-2.5 p-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 bg-white">
                <input 
                  type="checkbox" 
                  checked={formData.isListed !== undefined ? formData.isListed : true}
                  onChange={(e) => handleInputChange('isListed', e.target.checked)}
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded cursor-pointer accent-emerald-600"
                />
                <span className="text-sm font-semibold text-[#2C3842] flex items-center gap-1.5">
                  {formData.isListed !== false ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 已上架展示
                    </span>
                  ) : (
                    <span className="text-[#697A88] flex items-center gap-1">
                      <XCircle className="w-4 h-4 text-[#697A88]" /> 未上架 / 暂存
                    </span>
                  )}
                </span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2C3842] mb-1">单价 (¥)</label>
              <input 
                type="number" 
                min="0" 
                step="0.01"
                value={formData.price || ''} 
                onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D6994] focus:border-[#2D6994] text-sm font-medium text-[#2C3842]"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2C3842] mb-1">当前库存数量</label>
              <input 
                type="number" 
                min="0" 
                value={formData.stock !== undefined ? formData.stock : ''} 
                onChange={(e) => handleInputChange('stock', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D6994] focus:border-[#2D6994] text-sm font-medium text-[#2C3842]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2C3842] mb-1">已出数量 (初始/历史)</label>
              <input 
                type="number" 
                min="0" 
                value={formData.sold || 0} 
                onChange={(e) => handleInputChange('sold', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D6994] bg-slate-50 text-sm text-[#2C3842]"
              />
            </div>

            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-[#2C3842] mb-1">备注说明</label>
              <input 
                type="text" 
                value={formData.remark || ''} 
                onChange={(e) => handleInputChange('remark', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D6994] focus:border-[#2D6994] text-sm text-[#2C3842]"
                placeholder="可选备注（如：下周补货、打折等）"
              />
            </div>

            <div className="flex items-end pb-0.5">
              <button 
                type="submit" 
                className="w-full py-2.5 bg-[#2D6994] text-white text-sm font-semibold rounded-xl hover:bg-[#235375] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2D6994] shadow-sm transition-colors flex items-center justify-center gap-1.5"
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
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#2D6994] focus:border-[#2D6994] text-[#2C3842]"
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
                    ? 'bg-[#2D6994] text-white border-[#235375] shadow-sm' 
                    : 'bg-slate-50 text-[#697A88] border-slate-200 hover:bg-slate-100 hover:text-[#2C3842]'
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
                    ? 'bg-[#72B8D6] text-white border-[#5ea2bf] shadow-sm' 
                    : 'bg-[#EAF3F8] text-[#2D6994] border-[#72B8D6]/40 hover:bg-[#d9ecf5]'
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
                    ? 'bg-[#D87048] text-white border-[#c25e37] shadow-sm' 
                    : 'bg-[#FDF1EC] text-[#D87048] border-[#D87048]/30 hover:bg-[#fae2d9]'
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
                    ? 'bg-[#EAF3F8] text-[#2D6994] border-[#72B8D6] ring-2 ring-[#72B8D6]/20'
                    : 'bg-white text-[#2C3842] border-slate-300 hover:bg-slate-50'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>更多筛选</span>
                {(filterShelf || filterListedStatus !== 'all') && (
                  <span className="w-2 h-2 rounded-full bg-[#2D6994]" />
                )}
                {showAdvancedFilters ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
              </button>
            </div>
          </div>

          {/* Collapsible Advanced Filter Panel */}
          {showAdvancedFilters && (
            <div className="bg-[#F8FAFC] rounded-xl p-3.5 border border-slate-200/80 space-y-3 text-xs animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Shelf Location Filter */}
                <div>
                  <label className="block text-[#697A88] font-semibold mb-1 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-gray-400" /> 货架位置
                  </label>
                  <select 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-[#2D6994] text-xs text-[#2C3842]"
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
                  <label className="block text-[#697A88] font-semibold mb-1 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-gray-400" /> 上架状态
                  </label>
                  <select 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-[#2D6994] text-xs text-[#2C3842]"
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
                  <label className="block text-[#697A88] font-semibold mb-1 flex items-center gap-1">
                    <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" /> 数据排序
                  </label>
                  <select 
                    className="w-full px-3 py-2 border border-[#72B8D6]/40 bg-[#EAF3F8]/50 text-[#2D6994] rounded-lg font-semibold focus:ring-2 focus:ring-[#2D6994] text-xs"
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
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2 text-[#697A88] font-medium">
              <span>当前结果: <b className="text-[#2C3842]">{filteredItems.length}</b> 件</span>
              {(filterShelf || filterListedStatus !== 'all' || filterStockStatus !== 'all' || searchQuery) && (
                <span className="text-[#2D6994] bg-[#EAF3F8] px-2 py-0.5 rounded-md text-[11px] font-semibold">
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
                className="px-2.5 py-1 text-xs text-[#D87048] hover:bg-[#FDF1EC] rounded-lg border border-[#D87048]/30 font-semibold transition-colors flex items-center gap-1"
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
            <div className="flex items-center justify-between px-2 text-xs text-[#697A88]">
              <label className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  className="h-4 w-4 text-[#2D6994] focus:ring-[#2D6994] border-gray-300 rounded cursor-pointer accent-[#2D6994]"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                />
                <span>全选本页 ({filteredItems.length} 项)</span>
              </label>
              <span className="text-[#2D6994] font-bold">
                结算总额: ¥{stats.settlementAmount.toFixed(1)}
              </span>
            </div>
          )}

          {filteredItems.map((item) => (
            <div 
              key={item.id}
              onClick={(e) => handleEdit(e, item)}
              className={`bg-white rounded-2xl shadow-sm border p-4 transition-all ${
                selectedIds.has(item.id) 
                  ? 'border-[#2D6994] ring-2 ring-[#2D6994]/30 bg-[#EAF3F8]/30' 
                  : 'border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-start gap-2.5">
                  <input 
                    type="checkbox" 
                    className="mt-1 h-5 w-5 text-[#2D6994] focus:ring-[#2D6994] border-gray-300 rounded cursor-pointer accent-[#2D6994]"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleSelectRow(item.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div>
                    <div className="font-bold text-[#2C3842] text-base leading-tight">
                      {item.style || '默认款式'}
                    </div>
                    <div className="text-xs text-[#697A88] mt-1 flex items-center gap-1.5">
                      <span className="font-medium text-[#2C3842]">{item.character}</span>
                      <span className="text-slate-300">·</span> 
                      <span>{item.series}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1">
                    {/* Shelf badge */}
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      item.shelfLocation === 'HB3' 
                        ? 'bg-amber-100 text-amber-800' 
                        : (item.shelfLocation === 'HC3' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-[#697A88]')
                    }`}>
                      {item.shelfLocation || '未设货架'}
                    </span>
                    {/* Listed status badge */}
                    {item.isListed ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> 已上架
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[#697A88] text-[10px] font-medium">
                        未上架
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-[#2D6994]">
                    ¥{item.price.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Data Grid: Stock, Sold, Total Revenue */}
              <div className="grid grid-cols-3 gap-2 bg-[#F8FAFC] p-2.5 rounded-xl text-center mt-3 border border-slate-100">
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#697A88]">库存</span>
                  <span className={`text-sm font-bold ${item.stock > 0 ? 'text-[#2C3842]' : 'text-[#D87048]'}`}>
                    {item.stock > 0 ? item.stock : '已售罄'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#697A88]">已出</span>
                  <span className="text-sm font-bold text-[#2D6994]">{item.sold}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#697A88]">销售额</span>
                  <span className="text-sm font-bold text-[#2C3842]">
                    ¥{(item.sold * item.price).toFixed(1)}
                  </span>
                </div>
              </div>

              {item.remark && (
                <div className="mt-2 text-xs text-[#697A88] italic bg-amber-50/60 px-2 py-1 rounded border border-amber-100">
                  注: {item.remark}
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button 
                  onClick={(e) => handleQuickSell(e, item.id)}
                  disabled={item.stock <= 0}
                  className="flex-1 bg-[#EAF3F8] text-[#2D6994] py-1.5 rounded-lg text-xs font-bold hover:bg-[#d9ecf5] flex justify-center items-center disabled:opacity-40 transition-colors"
                >
                  <ShoppingCart className="w-3.5 h-3.5 mr-1 pointer-events-none" /> 售出 +1
                </button>
                <button 
                  onClick={(e) => handleDuplicate(e, item)}
                  className="bg-slate-100 text-[#2C3842] px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-200 flex justify-center items-center transition-colors"
                  title="复制为新商品"
                >
                  <Copy className="w-3.5 h-3.5 mr-1 pointer-events-none" /> 复制
                </button>
                <button 
                  onClick={(e) => handleDelete(e, item.id)}
                  className="bg-[#FDF1EC] text-[#D87048] px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#fae2d9] flex justify-center items-center transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
                </button>
              </div>
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-[#697A88]">
              <Package className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p className="font-medium text-sm text-[#2C3842]">未找到符合条件的商品</p>
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setFilterShelf('');
                  setFilterListedStatus('all');
                  setFilterStockStatus('all');
                }}
                className="mt-2 text-xs text-[#2D6994] font-semibold hover:underline"
              >
                重置所有筛选条件
              </button>
            </div>
          )}
        </div>

        {/* Desktop: Table View */}
        <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  <th className="px-5 py-3.5 w-10">
                    <input 
                      type="checkbox" 
                      className="h-4 w-4 text-[#2D6994] focus:ring-[#2D6994] border-gray-300 rounded cursor-pointer accent-[#2D6994]"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  {[
                    { key: 'id', label: '编号' },
                    { key: 'series', label: '作品/系列' }, 
                    { key: 'character', label: '角色' },
                    { key: 'style', label: '款式规格' },
                    { key: 'shelfLocation', label: '货架位置' },
                    { key: null, label: '上架状态' },
                    { key: 'price', label: '单价' },
                    { key: 'stock', label: '库存' },
                    { key: 'sold', label: '已出' },
                    { key: 'revenue', label: '销售总额' },
                    { key: null, label: '操作' }
                  ].map((col, idx) => (
                    <th 
                      key={idx}
                      className="px-3.5 py-3.5 text-left text-xs font-bold text-[#697A88] uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                      onClick={() => col.key && handleSort(col.key as SortField)}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {col.key && (
                          sortField === col.key ? (
                            sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-[#2D6994]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#2D6994]" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100" />
                          )
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-14 text-center text-[#697A88]">
                      <div className="flex flex-col items-center">
                        <Package className="w-12 h-12 text-slate-300 mb-2" />
                        <p className="font-medium text-sm text-[#2C3842]">未找到匹配的商品</p>
                        <p className="text-xs text-[#697A88] mt-1">请尝试放宽搜索词或重置筛选条件</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr 
                      key={item.id} 
                      className={`transition-colors ${
                        selectedIds.has(item.id) ? 'bg-[#EAF3F8]/40' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="px-5 py-4 whitespace-nowrap">
                        <input 
                          type="checkbox" 
                          className="h-4 w-4 text-[#2D6994] focus:ring-[#2D6994] border-gray-300 rounded cursor-pointer accent-[#2D6994]"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelectRow(item.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-3.5 py-4 whitespace-nowrap text-xs font-bold text-[#697A88]">
                        #{item.id}
                      </td>
                      <td className="px-3.5 py-4 whitespace-nowrap text-sm font-semibold text-[#2C3842]">
                        {item.series}
                      </td>
                      <td className="px-3.5 py-4 whitespace-nowrap text-sm text-[#2C3842]">
                        {item.character}
                      </td>
                      <td className="px-3.5 py-4 text-sm text-[#2C3842] max-w-[200px]">
                        <div className="truncate font-medium" title={item.style}>{item.style || '-'}</div>
                        {item.remark && (
                          <div className="text-[11px] text-[#697A88] italic truncate mt-0.5" title={item.remark}>
                            {item.remark}
                          </div>
                        )}
                      </td>
                      {/* Shelf Location Column */}
                      <td className="px-3.5 py-4 whitespace-nowrap text-xs">
                        <span className={`px-2.5 py-1 rounded-md font-bold text-xs ${
                          item.shelfLocation === 'HB3' 
                            ? 'bg-amber-100 text-amber-800' 
                            : (item.shelfLocation === 'HC3' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-[#697A88]')
                        }`}>
                          {item.shelfLocation || '未设'}
                        </span>
                      </td>
                      {/* Listing Status Column (是否已上架) */}
                      <td className="px-3.5 py-4 whitespace-nowrap text-xs">
                        {item.isListed ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> 已上架
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-[#697A88]">
                            <XCircle className="w-3 h-3 mr-1" /> 未上架
                          </span>
                        )}
                      </td>
                      {/* Price Column */}
                      <td className="px-3.5 py-4 whitespace-nowrap text-sm font-bold text-[#2C3842]">
                        ¥{item.price.toFixed(2)}
                      </td>
                      {/* Stock Column */}
                      <td className="px-3.5 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 inline-flex text-xs font-bold rounded-md ${
                          item.stock > 0 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60' : 'bg-[#FDF1EC] text-[#D87048] border border-[#D87048]/30'
                        }`}>
                          {item.stock > 0 ? item.stock : '售罄'}
                        </span>
                      </td>
                      {/* Sold Column */}
                      <td className="px-3.5 py-4 whitespace-nowrap text-sm text-[#2C3842] font-medium">
                        {item.sold}
                      </td>
                      {/* Total Sales Column */}
                      <td className="px-3.5 py-4 whitespace-nowrap text-sm text-[#2D6994] font-bold">
                        ¥{(item.sold * item.price).toFixed(2)}
                      </td>
                      {/* Actions Column */}
                      <td className="px-3.5 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={(e) => handleQuickSell(e, item.id)}
                            disabled={item.stock <= 0}
                            title="快速售出 (+1 已出, -1 库存)"
                            className="p-1.5 text-[#2D6994] bg-[#EAF3F8] hover:bg-[#d9ecf5] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <ShoppingCart className="w-4 h-4 pointer-events-none" />
                          </button>
                          <button 
                            onClick={(e) => handleDuplicate(e, item)}
                            title="复制为新商品"
                            className="p-1.5 text-[#2C3842] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            <Copy className="w-4 h-4 pointer-events-none" />
                          </button>
                          <button 
                            onClick={(e) => handleEdit(e, item)}
                            title="编辑"
                            className="p-1.5 text-[#2D6994] bg-[#EAF3F8] hover:bg-[#d9ecf5] rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4 pointer-events-none" />
                          </button>
                          <button 
                            onClick={(e) => handleDelete(e, item.id)}
                            title="删除"
                            className="p-1.5 text-[#D87048] bg-[#FDF1EC] hover:bg-[#fae2d9] rounded-lg transition-colors"
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
          <div className="bg-[#F8FAFC] px-6 py-3 border-t border-slate-200 text-xs text-[#697A88] flex flex-wrap justify-between items-center gap-2">
            <span>显示 {filteredItems.length} 项商品 (共 {items.length} 条记录)</span>
            <div className="flex items-center gap-4">
              <span>总销售额: <b className="text-[#2C3842] font-bold">¥{stats.actualRevenue.toLocaleString()}</b></span>
              <span className="text-[#2D6994]">
                结算金额 (HB3×{(settlementSettings.hb3Rate * 100).toFixed(0)}% + HC3×{(settlementSettings.hc3Rate * 100).toFixed(0)}%): <b className="font-bold text-sm">¥{stats.settlementAmount.toFixed(2)}</b>
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;

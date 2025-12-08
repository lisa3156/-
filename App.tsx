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
  Globe,
  Store,
  Menu,
  Copy,
  Database,
  FileJson,
  Share2,
  FileUp,
  ClipboardCopy,
  EyeOff
} from 'lucide-react';
import { InventoryItem, SortField, SortOrder } from './types';
import { InputWithSuggestions } from './components/InputWithSuggestions';
import { StatsCard } from './components/StatsCard';

const STORAGE_KEY = 'merch_tracker_cn_v1';

const App: React.FC = () => {
  // --- State ---
  const [items, setItems] = useState<InventoryItem[]>([]);
  // Removed isFormOpen state to keep form always visible
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Mobile UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    type: '',
    style: '',
    character: '',
    series: '',
    stock: 1,
    price: 0,
    sold: 0,
    remark: '',
    isOnline: false,
    isOffline: false
  });

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeries, setFilterSeries] = useState('');
  const [filterCharacter, setFilterCharacter] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [showOfflineOnly, setShowOfflineOnly] = useState(false);
  const [showUnlistedOnly, setShowUnlistedOnly] = useState(false); // New Filter
  
  // Sorting State
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // --- Effects ---

  // Load data on mount with Sanitization
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsedData = JSON.parse(saved);
        if (Array.isArray(parsedData)) {
          // Filter out valid items and ensure IDs are numbers
          const sanitizedData = parsedData
            .map((item: any) => ({
              ...item,
              id: Number(item.id),
              stock: Number(item.stock) || 0,
              sold: Number(item.sold) || 0,
              price: Number(item.price) || 0,
              isOnline: !!item.isOnline,
              isOffline: !!item.isOffline,
              createdAt: item.createdAt || Date.now()
            }))
            .filter((item) => !isNaN(item.id)); // Remove items with NaN IDs
            
          setItems(sanitizedData);
        }
      } catch (e) {
        console.error("Failed to parse saved data", e);
        // Fallback handled by empty check below
      }
    } else {
      // Seed some demo data if empty
      setItems([
        { id: 1001, type: '徽章', style: '镭射票', character: '旅行者', series: '原神', stock: 50, price: 15, sold: 12, remark: '下周需补货', isOnline: true, isOffline: false, createdAt: Date.now() },
        { id: 1002, type: '立牌', style: '15cm 站姿', character: '芙莉莲', series: '葬送的芙莉莲', stock: 20, price: 45, sold: 5, remark: '', isOnline: false, isOffline: true, createdAt: Date.now() },
      ]);
    }
  }, []);

  // Save data on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // --- Derived Data for Autocomplete ---
  const existingTypes = useMemo(() => Array.from(new Set(items.map(i => i.type))).filter(Boolean), [items]);
  const existingSeries = useMemo(() => Array.from(new Set(items.map(i => i.series))).filter(Boolean), [items]);
  const existingCharacters = useMemo(() => Array.from(new Set(items.map(i => i.character))).filter(Boolean), [items]);

  // --- Derived Data for Table ---
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = 
        (item.series || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.character || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.style || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.remark || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id.toString().includes(searchQuery);

      const matchesSeries = filterSeries ? item.series === filterSeries : true;
      const matchesCharacter = filterCharacter ? item.character === filterCharacter : true;
      const matchesType = filterType ? item.type === filterType : true;
      
      const matchesOnline = showOnlineOnly ? item.isOnline : true;
      const matchesOffline = showOfflineOnly ? item.isOffline : true;
      // New logic: Only Unlisted
      const matchesUnlisted = showUnlistedOnly ? (!item.isOnline && !item.isOffline) : true;

      return matchesSearch && matchesSeries && matchesCharacter && matchesType && matchesOnline && matchesOffline && matchesUnlisted;
    }).sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      // String sorting
      const strA = String(valA || '');
      const strB = String(valB || '');
      return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [items, searchQuery, filterSeries, filterCharacter, filterType, sortField, sortOrder, showOnlineOnly, showOfflineOnly, showUnlistedOnly]);

  // Check if all visible items are selected
  const isAllSelected = filteredItems.length > 0 && filteredItems.every(item => selectedIds.has(item.id));

  // --- Stats Calculation ---
  const stats = useMemo(() => {
    const totalItems = filteredItems.length;
    const totalStock = filteredItems.reduce((acc, curr) => acc + (curr.stock || 0), 0);
    const totalSold = filteredItems.reduce((acc, curr) => acc + (curr.sold || 0), 0);
    const potentialRevenue = filteredItems.reduce((acc, curr) => acc + ((curr.stock || 0) * (curr.price || 0)), 0);
    const actualRevenue = filteredItems.reduce((acc, curr) => acc + ((curr.sold || 0) * (curr.price || 0)), 0);

    return { totalItems, totalStock, totalSold, potentialRevenue, actualRevenue };
  }, [filteredItems]);

  // --- Handlers ---

  const handleInputChange = (field: keyof InventoryItem, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingId) {
      // Update
      setItems(prev => prev.map(item => 
        item.id === editingId ? { ...item, ...formData } as InventoryItem : item
      ));
    } else {
      // Create
      // Safe Max ID calculation
      const maxId = items.length > 0 ? Math.max(0, ...items.map(i => i.id)) : 1000;
      const newId = maxId + 1;
      
      const newItem: InventoryItem = {
        ...(formData as InventoryItem),
        id: newId,
        sold: formData.sold || 0,
        isOnline: formData.isOnline || false,
        isOffline: formData.isOffline || false,
        createdAt: Date.now()
      };
      setItems(prev => [newItem, ...prev]);
    }
    
    resetForm();
  };

  const handleEdit = (e: React.MouseEvent, item: InventoryItem) => {
    e.stopPropagation(); // Prevent row click
    setFormData(item);
    setEditingId(item.id);
    setIsSidebarOpen(false); // Close sidebar if open
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDuplicate = (e: React.MouseEvent, item: InventoryItem) => {
    e.stopPropagation();
    // Copy item data but reset sold count and ID related info
    const newItemData = {
        ...item,
        sold: 0, // Reset sold for new item
    };
    // Clean up internal ID if it existed in spread
    setFormData(newItemData);
    setEditingId(null); // Ensure we are in "Create" mode
    setIsSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); // Prevent row click or other events
    
    if (isNaN(id)) {
      alert("无法删除 ID 无效的条目，请尝试刷新页面。");
      return;
    }

    if (window.confirm(`确定要删除商品 #${id} 吗？`)) {
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
    if (window.confirm(`确定要删除选中的 ${selectedIds.size} 项商品吗？此操作无法撤销。`)) {
      const idsToRemove = new Set(Array.from(selectedIds).map(String));
      setItems(prev => prev.filter(item => !idsToRemove.has(String(item.id))));
      setSelectedIds(new Set());
      setIsSidebarOpen(false);
    }
  };

  const handleBulkStatusUpdate = (action: 'setOnline' | 'setOffline' | 'setUnlisted') => {
    if (selectedIds.size === 0) return;
    
    setItems(prev => prev.map(item => {
      if (!selectedIds.has(item.id)) return item;
      
      switch(action) {
        case 'setOnline':
          return { ...item, isOnline: true };
        case 'setOffline':
          return { ...item, isOffline: true };
        case 'setUnlisted':
          return { ...item, isOnline: false, isOffline: false };
        default:
          return item;
      }
    }));
    
    setIsSidebarOpen(false);
  };

  const handleQuickSell = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        if (item.stock <= 0) {
          alert("库存不足！");
          return item;
        }
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
      type: '',
      style: '',
      character: '',
      series: '',
      stock: 1,
      price: 0,
      sold: 0,
      remark: '',
      isOnline: false,
      isOffline: false
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
      // Deselect all currently visible items
      const newSet = new Set(selectedIds);
      filteredItems.forEach(item => newSet.delete(item.id));
      setSelectedIds(newSet);
    } else {
      // Select all currently visible items
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

  const exportToExcel = async () => {
    if (!window.XLSX) {
      alert("Excel 导出组件尚未加载完成，请稍后再试。");
      return;
    }

    // Determine what to export: Selected items OR Filtered items
    let itemsToExport = filteredItems;
    if (selectedIds.size > 0) {
        itemsToExport = items.filter(item => selectedIds.has(item.id));
    }
    
    // Format data
    const exportData = itemsToExport.map(item => ({
      '编号': item.id,
      '作品/系列': item.series,
      '角色': item.character,
      '物品类型': item.type,
      '款式': item.style,
      '线上上架': item.isOnline ? '是' : '否',
      '线下上架': item.isOffline ? '是' : '否',
      '单价 (¥)': item.price,
      '库存数量': item.stock,
      '已出数量': item.sold,
      '销售总额 (¥)': item.sold * item.price,
      '库存货值 (¥)': item.stock * item.price,
      '备注': item.remark
    }));

    const ws = window.XLSX.utils.json_to_sheet(exportData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "库存表");
    const filename = `周边库存_${selectedIds.size > 0 ? '选定' : '完整'}_${new Date().toISOString().slice(0,10)}.xlsx`;

    try {
        // Generate Blob for more robust mobile handling
        const wbout = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        // Try Web Share API Level 2 (Android/iOS 15+)
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
        
        // Fallback: Create Object URL (Better than writeFile on mobile)
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
        // Last resort fallback
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

        // Robust max ID calculation
        let maxId = items.length > 0 ? Math.max(0, ...items.map(i => i.id)) : 1000;
        
        const currentItemsMap = new Map<number, InventoryItem>();
        items.forEach(i => currentItemsMap.set(i.id, i));

        let updatedCount = 0;
        let addedCount = 0;

        jsonData.forEach((row: any) => {
          // Robust ID parsing
          const rawId = row['编号'];
          let parsedId = NaN;
          
          if (rawId !== undefined && rawId !== null && String(rawId).trim() !== '') {
            parsedId = parseInt(String(rawId), 10);
          }
          
          const newItemData: Partial<InventoryItem> = {
            series: String(row['作品/系列'] || row['作品'] || ''),
            character: String(row['角色'] || ''),
            type: String(row['物品类型'] || row['类型'] || ''),
            style: String(row['款式'] || ''),
            isOnline: String(row['线上上架']).trim() === '是',
            isOffline: String(row['线下上架']).trim() === '是',
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
              type: newItemData.type || '未分类',
              style: newItemData.style || '',
              character: newItemData.character || '未命名',
              series: newItemData.series || '未分类',
              isOnline: !!newItemData.isOnline,
              isOffline: !!newItemData.isOffline,
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

        setItems(validItems);
        alert(`导入完成！新增: ${addedCount} 条，更新: ${updatedCount} 条。`);

      } catch (error) {
        console.error("Import error:", error);
        alert("导入失败，请检查文件格式是否正确。");
      }
    };

    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
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
            setImportText(text); // Set text for preview/confirmation
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
            
            // Sanitize imported data
            const sanitizedData = parsed.map((item: any) => ({
                ...item,
                id: Number(item.id),
                stock: Number(item.stock) || 0,
                sold: Number(item.sold) || 0,
                price: Number(item.price) || 0,
                isOnline: !!item.isOnline,
                isOffline: !!item.isOffline,
                createdAt: item.createdAt || Date.now()
            })).filter((item: any) => !isNaN(item.id));

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
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg relative z-10 flex flex-col max-h-[90vh]">
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-600" />
              数据备份与迁移
            </h3>
            <button onClick={() => setIsBackupModalOpen(false)} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex border-b">
             <button 
                className={`flex-1 py-3 text-sm font-medium ${mode === 'export' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
                onClick={() => setMode('export')}
             >
                导出 (备份)
             </button>
             <button 
                className={`flex-1 py-3 text-sm font-medium ${mode === 'import' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
                onClick={() => setMode('import')}
             >
                导入 (恢复)
             </button>
          </div>

          <div className="p-4 flex-1 overflow-auto">
             {mode === 'export' ? (
                <div className="space-y-6">
                  <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                      <h4 className="font-semibold text-indigo-900 mb-2 flex items-center">
                          <FileJson className="w-4 h-4 mr-2" /> 推荐：下载备份文件
                      </h4>
                      <p className="text-xs text-indigo-700 mb-3">
                          将生成一个 .json 文件。在其他设备上使用“上传备份文件”即可恢复。适合数据量大的情况。
                      </p>
                      <button 
                        onClick={handleDownloadJSON}
                        className="w-full py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium shadow-sm flex items-center justify-center"
                      >
                        <Download className="w-4 h-4 mr-2" /> 下载 JSON 文件
                      </button>
                  </div>

                  <div className="border-t pt-4">
                     <h4 className="font-medium text-gray-700 mb-2 text-sm flex items-center">
                         <ClipboardCopy className="w-4 h-4 mr-2" /> 备用：复制文本
                     </h4>
                     <textarea 
                        readOnly 
                        value={jsonString}
                        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                        className="w-full h-24 p-2 border rounded-md text-[10px] font-mono bg-gray-50 focus:ring-2 focus:ring-indigo-500 text-gray-500"
                      />
                      <button 
                        onClick={handleCopy}
                        className="w-full mt-2 py-2 border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-50 font-medium text-sm"
                      >
                        复制文本到剪贴板
                      </button>
                  </div>
                </div>
             ) : (
               <div className="space-y-6">
                 <input 
                    type="file" 
                    ref={jsonFileRef}
                    accept=".json"
                    className="hidden"
                    onChange={handleJSONFileImport}
                 />

                 <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                          <FileUp className="w-4 h-4 mr-2" /> 方式一：上传备份文件
                      </h4>
                      <p className="text-xs text-gray-600 mb-3">
                          选择之前下载的 .json 备份文件进行恢复。
                      </p>
                      <button 
                        onClick={() => jsonFileRef.current?.click()}
                        className="w-full py-3 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 font-medium shadow-sm flex items-center justify-center"
                      >
                        <Upload className="w-4 h-4 mr-2" /> 选择文件
                      </button>
                  </div>

                  <div className="border-t pt-4 space-y-3">
                      <h4 className="font-medium text-gray-700 text-sm flex items-center">
                         <ClipboardCopy className="w-4 h-4 mr-2" /> 方式二：粘贴文本
                     </h4>
                      <p className="text-xs text-gray-500">
                        如果数据量较小，也可以直接粘贴文本：
                      </p>
                      <textarea 
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        placeholder='在此粘贴 JSON 数据...'
                        className="w-full h-24 p-3 border rounded-md text-xs font-mono focus:ring-2 focus:ring-indigo-500"
                      />
                      <button 
                        onClick={() => tryRestore(importText)}
                        disabled={!importText}
                        className="w-full py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
    <div className="min-h-screen bg-gray-50 pb-20 font-sans relative">
      
      {/* Hidden File Input for Excel Import */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept=".xlsx, .xls" 
        className="hidden" 
      />

      {/* Backup Modal */}
      {isBackupModalOpen && <BackupModal />}

      {/* Mobile Sidebar (Drawer) */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsSidebarOpen(false)}
          />
          
          {/* Sidebar Content */}
          <div className="relative w-72 bg-white h-full shadow-2xl p-6 flex flex-col gap-6 animate-in slide-in-from-right duration-200">
            <div className="flex justify-between items-center border-b pb-4">
               <h2 className="text-xl font-bold text-gray-800">菜单</h2>
               <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
                 <X className="w-6 h-6" />
               </button>
            </div>
            
            <div className="space-y-3 flex-1">
                <button 
                  onClick={() => { resetForm(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="w-full flex items-center px-4 py-3 text-base font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm"
                >
                  <Plus className="w-5 h-5 mr-3" />
                  新建商品
                </button>
                
                <hr className="border-gray-100 my-2" />

                {selectedIds.size > 0 && (
                   <div className="grid grid-cols-3 gap-2 mb-2">
                       <button 
                         onClick={() => handleBulkStatusUpdate('setOnline')}
                         className="flex flex-col items-center justify-center p-2 bg-blue-50 text-blue-700 rounded-lg text-xs hover:bg-blue-100"
                       >
                          <Globe className="w-5 h-5 mb-1" />
                          设为线上
                       </button>
                       <button 
                         onClick={() => handleBulkStatusUpdate('setOffline')}
                         className="flex flex-col items-center justify-center p-2 bg-purple-50 text-purple-700 rounded-lg text-xs hover:bg-purple-100"
                       >
                          <Store className="w-5 h-5 mb-1" />
                          设为线下
                       </button>
                        <button 
                         onClick={() => handleBulkStatusUpdate('setUnlisted')}
                         className="flex flex-col items-center justify-center p-2 bg-gray-50 text-gray-700 rounded-lg text-xs hover:bg-gray-100"
                       >
                          <EyeOff className="w-5 h-5 mb-1" />
                          下架
                       </button>
                   </div>
                )}

                <button 
                  onClick={() => { setIsBackupModalOpen(true); setIsSidebarOpen(false); }}
                  className="w-full flex items-center px-4 py-3 text-base font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Database className="w-5 h-5 mr-3 text-indigo-600" />
                  数据备份/恢复
                </button>

                <button 
                  onClick={triggerImport}
                  className="w-full flex items-center px-4 py-3 text-base font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Upload className="w-5 h-5 mr-3 text-gray-500" />
                  导入 Excel
                </button>
                
                <button 
                  onClick={exportToExcel}
                  className="w-full flex items-center px-4 py-3 text-base font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {/* Icon logic: use Share icon if likely on mobile/supported, else Download */}
                  {navigator.share ? <Share2 className="w-5 h-5 mr-3 text-green-600" /> : <Download className="w-5 h-5 mr-3 text-gray-500" />}
                  {selectedIds.size > 0 ? `导出选中 (${selectedIds.size})` : '导出全部 (Excel)'}
                </button>
                
                {selectedIds.size > 0 && (
                   <button 
                    onClick={handleBatchDelete}
                    className="w-full flex items-center px-4 py-3 text-base font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors shadow-sm"
                  >
                    <Trash2 className="w-5 h-5 mr-3" />
                    批量删除 ({selectedIds.size})
                  </button>
                )}
            </div>
            
            <div className="text-xs text-gray-400 text-center border-t pt-4">
               周边库存管理系统 v1.5
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <Package className="w-6 h-6 text-indigo-600 flex-shrink-0" />
            <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate">周边管理</h1>
          </div>
          
          {/* Desktop Toolbar */}
          <div className="hidden md:flex gap-2 md:gap-3 items-center">
            {selectedIds.size > 0 && (
               <div className="flex items-center gap-1 border-r border-gray-300 pr-3 mr-1">
                 <span className="text-xs text-gray-500 font-medium hidden lg:inline mr-1">批量设置:</span>
                 <button onClick={() => handleBulkStatusUpdate('setOnline')} title="批量设为线上" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md">
                    <Globe className="w-4 h-4" />
                 </button>
                 <button onClick={() => handleBulkStatusUpdate('setOffline')} title="批量设为线下" className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-md">
                    <Store className="w-4 h-4" />
                 </button>
                 <button onClick={() => handleBulkStatusUpdate('setUnlisted')} title="批量下架" className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-md">
                    <EyeOff className="w-4 h-4" />
                 </button>
               </div>
            )}

            {selectedIds.size > 0 && (
              <button 
                onClick={handleBatchDelete}
                className="flex items-center px-3 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 transition-colors shadow-sm"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                批量删除 ({selectedIds.size})
              </button>
            )}
             <button 
              onClick={() => setIsBackupModalOpen(true)}
              className="flex items-center px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors"
            >
              <Database className="w-4 h-4 mr-2" />
              备份
            </button>
            <button 
              onClick={triggerImport}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-4 h-4 mr-2" />
              导入
            </button>
            <button 
              onClick={exportToExcel}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              导出 Excel
            </button>
            <button 
              onClick={() => { resetForm(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
            >
              {editingId ? <RefreshCw className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {editingId ? '放弃编辑' : '新建'}
            </button>
          </div>

          {/* Mobile Menu Trigger */}
          <div className="md:hidden">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-md focus:outline-none"
              >
                  <Menu className="w-6 h-6" />
              </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Statistics Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatsCard 
            title="库存总货值" 
            value={`¥${stats.potentialRevenue.toLocaleString()}`} 
            subValue={`${stats.totalStock} 件库存`}
            icon={Package} 
            colorClass="bg-blue-500 text-blue-600" 
          />
          <StatsCard 
            title="总销售额" 
            value={`¥${stats.actualRevenue.toLocaleString()}`} 
            subValue={`${stats.totalSold} 件已出`}
            icon={DollarSign} 
            colorClass="bg-green-500 text-green-600" 
          />
           <StatsCard 
            title="商品种类" 
            value={stats.totalItems} 
            icon={Filter} 
            colorClass="bg-orange-500 text-orange-600" 
          />
        </div>

        {/* Input Form Area - Always Visible */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 md:p-6">
          <div className="flex justify-between items-center mb-4 md:mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingId ? `编辑商品 #${editingId}` : '新商品登记'}
            </h2>
            {editingId && (
              <button onClick={resetForm} className="text-sm text-gray-500 hover:text-gray-700 underline">
                取消
              </button>
            )}
          </div>
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
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
              <InputWithSuggestions 
              label="物品类型" 
              value={formData.type || ''} 
              onChange={(val) => handleInputChange('type', val)}
              suggestions={existingTypes}
              placeholder="例如：徽章"
              required
            />
            
            <div className="flex flex-col gap-2">
                <div className="flex space-x-4 h-full items-end pb-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={formData.isOnline || false}
                            onChange={(e) => handleInputChange('isOnline', e.target.checked)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer accent-indigo-600"
                        />
                        <span className="text-sm text-gray-700">线上上架</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={formData.isOffline || false}
                            onChange={(e) => handleInputChange('isOffline', e.target.checked)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer accent-indigo-600"
                        />
                        <span className="text-sm text-gray-700">线下上架</span>
                    </label>
                </div>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">款式</label>
              <input 
                type="text" 
                value={formData.style || ''} 
                onChange={(e) => handleInputChange('style', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 text-base md:text-sm"
                placeholder="例如：镭射票"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">库存数量</label>
                <input 
                  type="number" 
                  min="0"
                  value={formData.stock || ''} 
                  onChange={(e) => handleInputChange('stock', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 text-base md:text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">单价 (¥)</label>
                <input 
                  type="number" 
                  min="0"
                  step="0.01"
                  value={formData.price || ''} 
                  onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 text-base md:text-sm"
                  required
                />
              </div>
            </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">已出数量 (初始)</label>
                <input 
                  type="number" 
                  min="0"
                  value={formData.sold || 0} 
                  onChange={(e) => handleInputChange('sold', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-base md:text-sm"
                />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
              <input 
                type="text" 
                value={formData.remark || ''} 
                onChange={(e) => handleInputChange('remark', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 text-base md:text-sm"
                placeholder="可选备注..."
              />
            </div>

            <div className="lg:col-span-4 flex justify-end pt-4 border-t border-gray-100">
              <button 
                type="submit" 
                className="w-full md:w-auto px-6 py-3 md:py-2 bg-indigo-600 text-white text-base md:text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {editingId ? '更新商品' : '保存商品'}
              </button>
            </div>
          </form>
        </div>

        {/* Filters Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="搜索..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-hide items-center">
            <select 
              className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-indigo-500 flex-shrink-0"
              value={filterSeries}
              onChange={(e) => setFilterSeries(e.target.value)}
            >
              <option value="">作品</option>
              {existingSeries.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select 
              className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-indigo-500 flex-shrink-0"
              value={filterCharacter}
              onChange={(e) => setFilterCharacter(e.target.value)}
            >
              <option value="">角色</option>
              {existingCharacters.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select 
              className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-indigo-500 flex-shrink-0"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">类型</option>
              {existingTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            
            <label className="flex items-center space-x-1 whitespace-nowrap text-sm text-gray-700 cursor-pointer select-none">
                <input 
                    type="checkbox" 
                    checked={showOnlineOnly} 
                    onChange={(e) => {
                        setShowOnlineOnly(e.target.checked);
                        if(e.target.checked) setShowUnlistedOnly(false); // Mutually exclusive UI logic
                    }}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded accent-indigo-600"
                />
                <span>仅看线上</span>
            </label>
            <label className="flex items-center space-x-1 whitespace-nowrap text-sm text-gray-700 cursor-pointer select-none">
                <input 
                    type="checkbox" 
                    checked={showOfflineOnly} 
                    onChange={(e) => {
                        setShowOfflineOnly(e.target.checked);
                        if(e.target.checked) setShowUnlistedOnly(false);
                    }}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded accent-indigo-600"
                />
                <span>仅看线下</span>
            </label>
            <label className="flex items-center space-x-1 whitespace-nowrap text-sm text-gray-700 cursor-pointer select-none">
                <input 
                    type="checkbox" 
                    checked={showUnlistedOnly} 
                    onChange={(e) => {
                        setShowUnlistedOnly(e.target.checked);
                        if(e.target.checked) {
                             setShowOnlineOnly(false);
                             setShowOfflineOnly(false);
                        }
                    }}
                    className="h-4 w-4 text-red-600 border-gray-300 rounded accent-red-600"
                />
                <span>仅看未上架</span>
            </label>

            {(filterSeries || filterCharacter || filterType || searchQuery || showOnlineOnly || showOfflineOnly || showUnlistedOnly) && (
              <button 
                onClick={() => { 
                    setFilterSeries(''); 
                    setFilterCharacter(''); 
                    setFilterType(''); 
                    setSearchQuery(''); 
                    setShowOnlineOnly(false);
                    setShowOfflineOnly(false);
                    setShowUnlistedOnly(false);
                }}
                className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md border border-transparent whitespace-nowrap flex-shrink-0"
              >
                清除
              </button>
            )}
          </div>
        </div>

        {/* Mobile: Card List View */}
        <div className="md:hidden space-y-4">
           {/* Mobile Select All */}
           {filteredItems.length > 0 && (
             <div className="flex items-center justify-between px-2 text-sm text-gray-500">
                <label className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer accent-indigo-600"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                  />
                  <span>全选本页</span>
                </label>
                <span>共 {filteredItems.length} 项</span>
             </div>
           )}

           {filteredItems.map((item) => (
             <div 
                key={item.id}
                onClick={(e) => handleEdit(e, item)}
                className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 transition-colors ${selectedIds.has(item.id) ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''}`}
             >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-start gap-3">
                     <input 
                        type="checkbox" 
                        className="mt-1 h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer accent-indigo-600"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelectRow(item.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div>
                        <div className="font-bold text-gray-900 text-lg leading-tight">{item.style || '无款式'}</div>
                        <div className="text-sm text-gray-500 mt-0.5">
                           <span>{item.character}</span>
                           <span className="mx-1 text-gray-300">|</span> 
                           <span>{item.series}</span>
                        </div>
                      </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <div className="flex space-x-1 mb-1">
                        {item.isOnline && (
                             <span className="p-0.5 rounded bg-blue-100 text-blue-700" title="线上上架">
                                <Globe className="w-3 h-3" />
                             </span>
                        )}
                        {item.isOffline && (
                             <span className="p-0.5 rounded bg-purple-100 text-purple-700" title="线下上架">
                                <Store className="w-3 h-3" />
                             </span>
                        )}
                        {!item.isOnline && !item.isOffline && (
                             <span className="p-0.5 rounded bg-red-100 text-red-700 text-[10px] px-1" title="未上架">
                                未上架
                             </span>
                        )}
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 mb-1">
                          {item.type}
                    </span>
                    <div className="text-xs text-gray-400">#{item.id}</div>
                  </div>
                </div>

                <div className="flex items-center text-sm text-gray-600 mb-3 space-x-3">
                    <span className="font-medium text-orange-600">¥{item.price}</span>
                </div>

                <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                    <div className="flex flex-col">
                       <span className="text-xs text-gray-400">库存</span>
                       <span className={`font-bold ${item.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>{item.stock}</span>
                    </div>
                    <div className="flex flex-col text-center">
                       <span className="text-xs text-gray-400">已出</span>
                       <span className="font-bold text-gray-900">{item.sold}</span>
                    </div>
                     <div className="flex flex-col text-right">
                       <span className="text-xs text-gray-400">销售额</span>
                       <span className="font-bold text-gray-900">¥{item.sold * item.price}</span>
                    </div>
                </div>

                {item.remark && (
                  <div className="mt-2 text-xs text-gray-500 italic">
                    注: {item.remark}
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                    <button 
                      onClick={(e) => handleQuickSell(e, item.id)}
                      disabled={item.stock <= 0}
                      className="flex-1 bg-green-50 text-green-700 py-2 rounded-md text-sm font-medium hover:bg-green-100 flex justify-center items-center disabled:opacity-50"
                    >
                       <ShoppingCart className="w-4 h-4 mr-1 pointer-events-none" /> 售出
                    </button>
                    <button 
                      onClick={(e) => handleDuplicate(e, item)}
                      className="flex-none bg-blue-50 text-blue-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-100 flex justify-center items-center"
                      title="复制"
                    >
                       <Copy className="w-4 h-4 pointer-events-none" />
                    </button>
                    <button 
                      onClick={(e) => handleDelete(e, item.id)}
                      className="flex-none bg-red-50 text-red-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-red-100 flex justify-center items-center"
                    >
                       <Trash2 className="w-4 h-4 pointer-events-none" />
                    </button>
                </div>
             </div>
           ))}
             {filteredItems.length === 0 && (
              <div className="text-center py-10 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>暂无数据</p>
              </div>
            )}
        </div>

        {/* Desktop: Table View */}
        <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 w-10">
                    <input 
                      type="checkbox" 
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer accent-indigo-600"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  {[
                    { key: 'id', label: '编号' },
                    { key: 'series', label: '作品/系列' }, 
                    { key: 'character', label: '角色' },
                    { key: 'type', label: '类型' },
                    { key: 'style', label: '款式' },
                    { key: null, label: '上架状态' },
                    { key: 'price', label: '单价' },
                    { key: 'stock', label: '库存' },
                    { key: 'sold', label: '已出' },
                    { key: null, label: '销售额' },
                    { key: null, label: '操作' }
                  ].map((col, idx) => (
                    <th 
                      key={idx}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap"
                      onClick={() => col.key && handleSort(col.key as SortField)}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {col.key && sortField === col.key && (
                          sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <Package className="w-12 h-12 text-gray-300 mb-2" />
                        <p>未找到匹配的商品。</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr 
                      key={item.id} 
                      className={`transition-colors ${selectedIds.has(item.id) ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                         <input 
                            type="checkbox" 
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer accent-indigo-600"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSelectRow(item.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{item.id}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                        {item.series}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                         {item.character}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                          {item.type}
                        </span>
                      </td>
                       <td className="px-4 py-4 text-sm text-gray-700 max-w-xs">
                        <div className="truncate" title={item.style}>{item.style}</div>
                        {item.remark && <div className="text-xs text-gray-400 mt-1 italic truncate" title={item.remark}>{item.remark}</div>}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <div className="flex space-x-1">
                            {item.isOnline && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800" title="线上上架">
                                    <Globe className="w-3 h-3 mr-1" /> 线上
                                </span>
                            )}
                            {item.isOffline && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800" title="线下上架">
                                    <Store className="w-3 h-3 mr-1" /> 线下
                                </span>
                            )}
                            {!item.isOnline && !item.isOffline && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-50 text-red-500" title="未上架">
                                     未上架
                                </span>
                            )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        ¥{item.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${item.stock > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {item.stock}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.sold}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        ¥{(item.sold * item.price).toFixed(2)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => handleQuickSell(e, item.id)}
                            disabled={item.stock <= 0}
                            title="快速售出 (+1 已出, -1 库存)"
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <ShoppingCart className="w-4 h-4 pointer-events-none" />
                          </button>
                           <button 
                            onClick={(e) => handleDuplicate(e, item)}
                            title="复制为新商品"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          >
                            <Copy className="w-4 h-4 pointer-events-none" />
                          </button>
                          <button 
                            onClick={(e) => handleEdit(e, item)}
                            title="编辑"
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                          >
                            <Edit2 className="w-4 h-4 pointer-events-none" />
                          </button>
                          <button 
                            onClick={(e) => handleDelete(e, item.id)}
                            title="删除"
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
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
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-sm text-gray-500 flex justify-between">
            <span>显示 {filteredItems.length} 项商品</span>
            <span>总库存货值: ¥{stats.potentialRevenue.toLocaleString()}</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
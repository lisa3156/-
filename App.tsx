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
  Upload
} from 'lucide-react';
import { InventoryItem, SortField, SortOrder } from './types';
import { InputWithSuggestions } from './components/InputWithSuggestions';
import { StatsCard } from './components/StatsCard';

const STORAGE_KEY = 'merch_tracker_cn_v1';

const App: React.FC = () => {
  // --- State ---
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    type: '',
    style: '',
    character: '',
    series: '',
    stock: 1,
    price: 0,
    sold: 0,
    remark: ''
  });

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeries, setFilterSeries] = useState('');
  const [filterCharacter, setFilterCharacter] = useState('');
  const [filterType, setFilterType] = useState('');
  
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
        { id: 1001, type: '徽章', style: '镭射票', character: '旅行者', series: '原神', stock: 50, price: 15, sold: 12, remark: '下周需补货', createdAt: Date.now() },
        { id: 1002, type: '立牌', style: '15cm 站姿', character: '芙莉莲', series: '葬送的芙莉莲', stock: 20, price: 45, sold: 5, remark: '', createdAt: Date.now() },
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

      return matchesSearch && matchesSeries && matchesCharacter && matchesType;
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
  }, [items, searchQuery, filterSeries, filterCharacter, filterType, sortField, sortOrder]);

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
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); // Prevent row click or other events
    
    // Safety check for invalid IDs
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
    }
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
      remark: ''
    });
    setEditingId(null);
    setIsFormOpen(false);
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

  const exportToExcel = () => {
    if (!window.XLSX) {
      alert("Excel 导出组件尚未加载完成，请稍后再试。");
      return;
    }
    
    // Format data for user-friendly export
    const exportData = filteredItems.map(item => ({
      '编号': item.id,
      '作品/系列': item.series,
      '角色': item.character,
      '物品类型': item.type,
      '款式': item.style,
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
    window.XLSX.writeFile(wb, `周边库存_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const triggerImport = () => {
    fileInputRef.current?.click();
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
          // Robust ID parsing: Check for undefined or null explicitly
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
            // If parsedId is valid and unused, use it. Otherwise generate new.
            const newId = (!isNaN(parsedId) && !currentItemsMap.has(parsedId)) 
              ? parsedId 
              : ++maxId;
            
            const newItem: InventoryItem = {
              id: newId,
              type: newItemData.type || '未分类',
              style: newItemData.style || '',
              character: newItemData.character || '未命名',
              series: newItemData.series || '未分类',
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

        // Convert Map back to array and validate all IDs are numbers
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

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl font-bold text-gray-900">周边商品管理系统</h1>
          </div>
          <div className="flex gap-3 items-center">
             <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".xlsx, .xls" 
              className="hidden" 
            />
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
              onClick={triggerImport}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-4 h-4 mr-2" />
              导入 Excel
            </button>
            <button 
              onClick={exportToExcel}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              导出 Excel
            </button>
            <button 
              onClick={() => { resetForm(); setIsFormOpen(!isFormOpen); }}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
            >
              {isFormOpen ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {isFormOpen ? '关闭表单' : '登记商品'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Statistics Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

        {/* Input Form Area */}
        {isFormOpen && (
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 animate-fade-in-down">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? `编辑商品 #${editingId}` : '新商品登记'}
              </h2>
              {editingId && (
                <button onClick={resetForm} className="text-sm text-gray-500 hover:text-gray-700 underline">
                  取消编辑
                </button>
              )}
            </div>
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">款式</label>
                <input 
                  type="text" 
                  value={formData.style || ''} 
                  onChange={(e) => handleInputChange('style', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                  />
              </div>

              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <input 
                  type="text" 
                  value={formData.remark || ''} 
                  onChange={(e) => handleInputChange('remark', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  placeholder="可选备注..."
                />
              </div>

              <div className="lg:col-span-4 flex justify-end pt-4 border-t border-gray-100">
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {editingId ? '更新商品' : '保存商品'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="搜索编号、作品、角色、类型、款式..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto flex-wrap">
            <select 
              className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-indigo-500"
              value={filterSeries}
              onChange={(e) => setFilterSeries(e.target.value)}
            >
              <option value="">全部作品</option>
              {existingSeries.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select 
              className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-indigo-500"
              value={filterCharacter}
              onChange={(e) => setFilterCharacter(e.target.value)}
            >
              <option value="">全部角色</option>
              {existingCharacters.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select 
              className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-indigo-500"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">全部类型</option>
              {existingTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {(filterSeries || filterCharacter || filterType || searchQuery) && (
              <button 
                onClick={() => { setFilterSeries(''); setFilterCharacter(''); setFilterType(''); setSearchQuery(''); }}
                className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md border border-transparent"
              >
                清除
              </button>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
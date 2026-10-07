export interface InventoryItem {
  id: number;
  type?: string;         // 物品类型 (已弃用/选填兼容)
  style: string;         // 款式
  character: string;     // 角色
  series: string;        // 作品
  shelfLocation?: string;// 货架位置 (如 HB3, HC3)
  stock: number;         // 库存数量
  price: number;         // 单价
  sold: number;          // 已出数量
  remark: string;        // 备注
  isListed: boolean;     // 是否已上架
  // Legacy fields for backward compatibility
  isOnline?: boolean;
  isOffline?: boolean;
  createdAt: number;
}

export interface UndoAction {
  description: string;
  items: InventoryItem[];
  timestamp: number;
}

export type SortField = 'id' | 'stock' | 'sold' | 'price' | 'revenue' | 'shelfLocation' | 'series' | 'character';
export type SortOrder = 'asc' | 'desc';

export interface SettlementPayout {
  id: string;          // 唯一ID
  month: string;       // 结算月份 (如 "2026年2月" 或 "2026-02")
  amount: number;      // 已结算金额 (¥)
  remark?: string;     // 备注说明 (选填，如转账流水、经手人)
  createdAt: number;   // 记录创建时间戳
}

export interface SettlementSettings {
  hb3Rate: number; // 默认 0.92 (即 92%)
  hc3Rate: number; // 默认 0.80 (即 80%)
  payouts?: SettlementPayout[]; // 已结算记录列表
}

// Extend Window interface for SheetJS
declare global {
  interface Window {
    XLSX: any;
  }
}

export interface InventoryItem {
  id: number;
  type: string;      // 物品类型
  style: string;     // 款式
  character: string; // 角色
  series: string;    // 作品
  stock: number;     // 库存数量
  price: number;     // 单价
  sold: number;      // 已出数量
  remark: string;    // 备注
  isOnline: boolean; // 线上上架
  isOffline: boolean;// 线下上架
  createdAt: number;
}

export type SortField = 'id' | 'stock' | 'sold' | 'price';
export type SortOrder = 'asc' | 'desc';

// Extend Window interface for SheetJS
declare global {
  interface Window {
    XLSX: any;
  }
}
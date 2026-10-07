import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { InventoryItem, SettlementSettings } from '../types';

// Retrieve config from Vite env vars, with localStorage fallback for testing/browser configuration
const env = (import.meta as any).env || {};
const ENV_SUPABASE_URL = (env.VITE_SUPABASE_URL || '').trim();
const ENV_SUPABASE_ANON_KEY = (env.VITE_SUPABASE_ANON_KEY || '').trim();

export const STORAGE_MIGRATED_KEY = 'merch_supabase_migrated_v1';
const LOCAL_SUPABASE_URL_KEY = 'merch_supabase_url';
const LOCAL_SUPABASE_KEY = 'merch_supabase_anon_key';

export function getSupabaseConfig(): { url: string; key: string } {
  const url = ENV_SUPABASE_URL || localStorage.getItem(LOCAL_SUPABASE_URL_KEY) || '';
  const key = ENV_SUPABASE_ANON_KEY || localStorage.getItem(LOCAL_SUPABASE_KEY) || '';
  return { url: url.trim(), key: key.trim() };
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getSupabaseConfig();
  return Boolean(url && key && url.startsWith('http'));
}

export function saveLocalSupabaseConfig(url: string, key: string) {
  if (url) localStorage.setItem(LOCAL_SUPABASE_URL_KEY, url.trim());
  else localStorage.removeItem(LOCAL_SUPABASE_URL_KEY);

  if (key) localStorage.setItem(LOCAL_SUPABASE_KEY, key.trim());
  else localStorage.removeItem(LOCAL_SUPABASE_KEY);

  // Reinitialize client
  initClient();
}

let clientInstance: SupabaseClient | null = null;

function initClient(): SupabaseClient | null {
  const { url, key } = getSupabaseConfig();
  if (url && key && url.startsWith('http')) {
    try {
      clientInstance = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
      return clientInstance;
    } catch (e) {
      console.error('[Supabase] Failed to initialize client:', e);
      clientInstance = null;
    }
  }
  return null;
}

// Initial client initialization
initClient();

export function getSupabase(): SupabaseClient | null {
  if (!clientInstance && isSupabaseConfigured()) {
    return initClient();
  }
  return clientInstance;
}

// --- Data Mappings ---

export interface SupabaseInventoryRow {
  id: number;
  style: string;
  character: string;
  series: string;
  shelf_location: string;
  stock: number;
  price: number;
  sold: number;
  remark: string;
  is_listed: boolean;
  type?: string;
  is_online?: boolean;
  is_offline?: boolean;
  created_at: number;
}

export function toSupabaseRow(item: InventoryItem): SupabaseInventoryRow {
  return {
    id: Number(item.id),
    style: item.style || '',
    character: item.character || '',
    series: item.series || '',
    shelf_location: item.shelfLocation ? String(item.shelfLocation).trim() : 'HB3',
    stock: Number(item.stock) || 0,
    price: Number(item.price) || 0,
    sold: Number(item.sold) || 0,
    remark: item.remark || '',
    is_listed: item.isListed !== undefined ? !!item.isListed : true,
    type: item.type || '',
    is_online: !!item.isOnline,
    is_offline: !!item.isOffline,
    created_at: Number(item.createdAt) || Date.now()
  };
}

export function fromSupabaseRow(row: any): InventoryItem {
  return {
    id: Number(row.id),
    style: String(row.style || ''),
    character: String(row.character || ''),
    series: String(row.series || ''),
    shelfLocation: String(row.shelf_location || 'HB3'),
    stock: Number(row.stock) || 0,
    price: Number(row.price) || 0,
    sold: Number(row.sold) || 0,
    remark: String(row.remark || ''),
    isListed: row.is_listed !== undefined ? !!row.is_listed : true,
    type: row.type || '',
    isOnline: !!row.is_online,
    isOffline: !!row.is_offline,
    createdAt: Number(row.created_at) || Date.now()
  };
}

// --- Supabase Database API Operations ---

/**
 * Fetch all inventory items from Supabase ordered by id desc or created_at desc
 */
export async function fetchInventoryFromCloud(): Promise<InventoryItem[]> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 尚未配置');

  const { data, error } = await sb
    .from('inventory')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Supabase] fetchInventory error:', error);
    throw error;
  }

  return (data || []).map(fromSupabaseRow);
}

/**
 * Add or update a single inventory item in Supabase
 */
export async function upsertInventoryItemCloud(item: InventoryItem): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 尚未配置');

  const row = toSupabaseRow(item);
  const { error } = await sb
    .from('inventory')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    console.error('[Supabase] upsert item error:', error);
    throw error;
  }
}

/**
 * Batch insert or update multiple inventory items (e.g. on Excel Import or initial migration)
 */
export async function batchUpsertInventoryCloud(items: InventoryItem[]): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 尚未配置');
  if (items.length === 0) return;

  const rows = items.map(toSupabaseRow);
  // Chunk into batches of 100 to avoid payload limit
  const CHUNK_SIZE = 100;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await sb
      .from('inventory')
      .upsert(chunk, { onConflict: 'id' });

    if (error) {
      console.error('[Supabase] batch upsert error:', error);
      throw error;
    }
  }
}

/**
 * Delete a single inventory item from Supabase
 */
export async function deleteInventoryItemCloud(id: number): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 尚未配置');

  const { error } = await sb
    .from('inventory')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Supabase] delete item error:', error);
    throw error;
  }
}

/**
 * Batch delete items by IDs
 */
export async function batchDeleteInventoryCloud(ids: number[]): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 尚未配置');
  if (ids.length === 0) return;

  const { error } = await sb
    .from('inventory')
    .delete()
    .in('id', ids);

  if (error) {
    console.error('[Supabase] batch delete error:', error);
    throw error;
  }
}

/**
 * Batch update listing status (is_listed)
 */
export async function batchUpdateListingCloud(ids: number[], isListed: boolean): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 尚未配置');
  if (ids.length === 0) return;

  const { error } = await sb
    .from('inventory')
    .update({ is_listed: isListed })
    .in('id', ids);

  if (error) {
    console.error('[Supabase] batch update listing error:', error);
    throw error;
  }
}

/**
 * Batch update shelf location
 */
export async function batchUpdateShelfCloud(ids: number[], shelfLocation: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 尚未配置');
  if (ids.length === 0) return;

  const { error } = await sb
    .from('inventory')
    .update({ shelf_location: shelfLocation })
    .in('id', ids);

  if (error) {
    console.error('[Supabase] batch update shelf error:', error);
    throw error;
  }
}

/**
 * Quick sell item (update stock & sold)
 */
export async function quickSellCloud(id: number, newStock: number, newSold: number): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 尚未配置');

  const { error } = await sb
    .from('inventory')
    .update({ stock: newStock, sold: newSold })
    .eq('id', id);

  if (error) {
    console.error('[Supabase] quick sell error:', error);
    throw error;
  }
}

/**
 * Full state synchronization (used for Undo / Redo / JSON Restore).
 * Reconciles the cloud database with the provided target items:
 * - Upserts all items currently in targetItems
 * - Deletes any items in cloud that are not in targetItems
 */
export async function syncFullInventoryCloud(targetItems: InventoryItem[]): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 尚未配置');

  // Fetch current IDs in cloud to identify deleted items
  const { data: currentRows, error: fetchErr } = await sb
    .from('inventory')
    .select('id');

  if (fetchErr) {
    console.error('[Supabase] syncFullInventory fetch error:', fetchErr);
    throw fetchErr;
  }

  const currentIds = new Set((currentRows || []).map((r: any) => Number(r.id)));
  const targetIds = new Set(targetItems.map(i => Number(i.id)));

  // IDs to delete from cloud
  const idsToDelete = Array.from(currentIds).filter(id => !targetIds.has(id));

  if (idsToDelete.length > 0) {
    const { error: delErr } = await sb
      .from('inventory')
      .delete()
      .in('id', idsToDelete);

    if (delErr) {
      console.error('[Supabase] syncFullInventory delete error:', delErr);
      throw delErr;
    }
  }

  // Upsert target items
  if (targetItems.length > 0) {
    await batchUpsertInventoryCloud(targetItems);
  }
}

/**
 * Fetch settlement settings from Supabase
 */
export async function fetchSettlementSettingsCloud(): Promise<SettlementSettings | null> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 尚未配置');

  // Try fetching with payouts column first
  const { data, error } = await sb
    .from('settlement_settings')
    .select('hb3_rate, hc3_rate, payouts')
    .eq('id', 'default')
    .maybeSingle();

  if (error) {
    // If column payouts does not exist in schema yet, fallback to rates only
    if (error.code === '42703' || String(error.message || '').toLowerCase().includes('payouts')) {
      const { data: fallbackData, error: fallbackError } = await sb
        .from('settlement_settings')
        .select('hb3_rate, hc3_rate')
        .eq('id', 'default')
        .maybeSingle();

      if (fallbackError) {
        console.error('[Supabase] fetchSettlementSettings error:', fallbackError);
        throw fallbackError;
      }
      if (fallbackData) {
        return {
          hb3Rate: Number(fallbackData.hb3_rate) ?? 0.92,
          hc3Rate: Number(fallbackData.hc3_rate) ?? 0.80,
          payouts: []
        };
      }
      return null;
    }

    console.error('[Supabase] fetchSettlementSettings error:', error);
    throw error;
  }

  if (data) {
    const rawPayouts = Array.isArray(data.payouts) ? data.payouts : [];
    return {
      hb3Rate: Number(data.hb3_rate) ?? 0.92,
      hc3Rate: Number(data.hc3_rate) ?? 0.80,
      payouts: rawPayouts
    };
  }

  return null;
}

/**
 * Save settlement settings to Supabase
 */
export async function saveSettlementSettingsCloud(settings: SettlementSettings): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 尚未配置');

  const payload: any = {
    id: 'default',
    hb3_rate: settings.hb3Rate,
    hc3_rate: settings.hc3Rate,
    payouts: settings.payouts || [],
    updated_at: new Date().toISOString()
  };

  const { error } = await sb
    .from('settlement_settings')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    // If payouts column doesn't exist, fallback to saving without payouts
    if (error.code === '42703' || String(error.message || '').toLowerCase().includes('payouts')) {
      const { error: fallbackError } = await sb
        .from('settlement_settings')
        .upsert({
          id: 'default',
          hb3_rate: settings.hb3Rate,
          hc3_rate: settings.hc3Rate,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (fallbackError) {
        console.error('[Supabase] saveSettlementSettings fallback error:', fallbackError);
        throw fallbackError;
      }
      return;
    }

    console.error('[Supabase] saveSettlementSettings error:', error);
    throw error;
  }
}

/**
 * Realtime subscription to inventory and settlement changes
 */
export function subscribeToCloudChanges(
  onInventoryChange: () => void,
  onSettlementChange: (settings: SettlementSettings) => void
): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};

  try {
    const channel = sb
      .channel('merch_tracker_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory' },
        () => {
          onInventoryChange();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settlement_settings' },
        (payload: any) => {
          if (payload?.new) {
            onSettlementChange({
              hb3Rate: Number(payload.new.hb3_rate) ?? 0.92,
              hc3Rate: Number(payload.new.hc3_rate) ?? 0.80,
              payouts: Array.isArray(payload.new.payouts) ? payload.new.payouts : []
            });
          } else {
            onInventoryChange();
          }
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  } catch (e) {
    console.warn('[Supabase] Failed to subscribe to realtime:', e);
    return () => {};
  }
}

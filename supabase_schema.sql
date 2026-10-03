-- ====================================================================
-- 周边库存管理系统 Supabase 初始化脚本
-- 请在 Supabase 控制台的 SQL Editor 中直接运行此脚本
-- ====================================================================

-- 1. 创建 inventory (库存商品表)
CREATE TABLE IF NOT EXISTS public.inventory (
  id BIGINT PRIMARY KEY,                           -- 商品数字唯一ID
  style TEXT NOT NULL DEFAULT '',                  -- 款式
  character TEXT NOT NULL DEFAULT '',              -- 角色
  series TEXT NOT NULL DEFAULT '',                 -- 作品/系列
  shelf_location TEXT NOT NULL DEFAULT 'HB3',      -- 货架位置 (默认 HB3)
  stock INTEGER NOT NULL DEFAULT 0,                -- 库存数量
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,         -- 单价 (¥)
  sold INTEGER NOT NULL DEFAULT 0,                 -- 已售出数量
  remark TEXT NOT NULL DEFAULT '',                 -- 备注
  is_listed BOOLEAN NOT NULL DEFAULT true,         -- 是否上架
  type TEXT DEFAULT '',                            -- 旧版本兼容字段 (物品类别)
  is_online BOOLEAN DEFAULT false,                 -- 旧版本兼容字段
  is_offline BOOLEAN DEFAULT false,                -- 旧版本兼容字段
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000) -- 创建毫秒时间戳
);

-- 创建常用索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_inventory_created_at ON public.inventory (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_shelf ON public.inventory (shelf_location);

-- 2. 创建 settlement_settings (结算比例设置表)
CREATE TABLE IF NOT EXISTS public.settlement_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',           -- 主键固定为 default
  hb3_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.92,   -- HB3货架提成比例 (默认 92%)
  hc3_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.80,   -- HC3货架提成比例 (默认 80%)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()    -- 更新时间
);

-- 插入默认结算比例初始行
INSERT INTO public.settlement_settings (id, hb3_rate, hc3_rate)
VALUES ('default', 0.92, 0.80)
ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- 3. 行级安全策略 (Row Level Security, RLS)
-- 适用于个人自用管理系统 (无须登录即可多设备直接同步)
-- ====================================================================

-- 启用 RLS
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_settings ENABLE ROW LEVEL SECURITY;

-- 允许匿名客户端通过 anon key 进行全部 CRUD 操作
DROP POLICY IF EXISTS "Allow anon full access on inventory" ON public.inventory;
CREATE POLICY "Allow anon full access on inventory"
  ON public.inventory
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon full access on settlement_settings" ON public.settlement_settings;
CREATE POLICY "Allow anon full access on settlement_settings"
  ON public.settlement_settings
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- ====================================================================
-- 4. 开启 Realtime 实时多设备数据变动推送
-- ====================================================================
DO $$
BEGIN
  -- 将 inventory 与 settlement_settings 加入 realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'inventory'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'settlement_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.settlement_settings;
  END IF;
END $$;

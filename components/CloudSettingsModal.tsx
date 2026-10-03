import React, { useState } from 'react';
import { 
  Cloud, 
  CloudOff, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Database, 
  UploadCloud, 
  DownloadCloud, 
  Copy, 
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Terminal
} from 'lucide-react';
import { 
  getSupabaseConfig, 
  saveLocalSupabaseConfig, 
  isSupabaseConfigured,
  fetchInventoryFromCloud,
  batchUpsertInventoryCloud,
  fetchSettlementSettingsCloud,
  saveSettlementSettingsCloud
} from '../lib/supabase';
import { InventoryItem, SettlementSettings } from '../types';

interface CloudSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isCloudConnected: boolean;
  onRefreshFromCloud: () => Promise<void>;
  items: InventoryItem[];
  settlementSettings: SettlementSettings;
  onToast: (msg: string) => void;
}

export const CloudSettingsModal: React.FC<CloudSettingsModalProps> = ({
  isOpen,
  onClose,
  isCloudConnected,
  onRefreshFromCloud,
  items,
  settlementSettings,
  onToast
}) => {
  const currentConfig = getSupabaseConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(currentConfig.url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(currentConfig.key);
  const [testingStatus, setTestingStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'status' | 'config' | 'sql'>('status');
  const [isSyncingLocal, setIsSyncingLocal] = useState(false);

  if (!isOpen) return null;

  const handleSaveConfig = () => {
    saveLocalSupabaseConfig(supabaseUrl, supabaseAnonKey);
    onToast('Supabase 配置已更新，正在重新连接...');
    onRefreshFromCloud();
  };

  const handleTestConnection = async () => {
    setTestingStatus('testing');
    setStatusMessage('正在测试连接 Supabase...');
    try {
      saveLocalSupabaseConfig(supabaseUrl, supabaseAnonKey);
      await fetchInventoryFromCloud();
      setTestingStatus('success');
      setStatusMessage('连接成功！数据库表已就绪。');
      onToast('Supabase 连接成功！');
    } catch (err: any) {
      setTestingStatus('failed');
      setStatusMessage(`连接失败: ${err.message || '请检查 URL、Key 及是否在 Supabase 运行了建表 SQL'}`);
    }
  };

  const handleForceUploadLocal = async () => {
    if (!window.confirm(`确定要将当前本地的 ${items.length} 项商品与结算比例上传到 Supabase 吗？\n注意：如果云端已有同 ID 商品将被更新。`)) {
      return;
    }

    setIsSyncingLocal(true);
    try {
      if (items.length > 0) {
        await batchUpsertInventoryCloud(items);
      }
      await saveSettlementSettingsCloud(settlementSettings);
      setIsSyncingLocal(false);
      onToast(`成功上传 ${items.length} 项商品至云端！`);
      await onRefreshFromCloud();
    } catch (err: any) {
      setIsSyncingLocal(false);
      alert(`上传失败: ${err.message || '请检查网络'}`);
    }
  };

  const sqlCode = `-- 在 Supabase SQL Editor 中运行：
CREATE TABLE IF NOT EXISTS public.inventory (
  id BIGINT PRIMARY KEY,
  style TEXT NOT NULL DEFAULT '',
  character TEXT NOT NULL DEFAULT '',
  series TEXT NOT NULL DEFAULT '',
  shelf_location TEXT NOT NULL DEFAULT 'HB3',
  stock INTEGER NOT NULL DEFAULT 0,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  sold INTEGER NOT NULL DEFAULT 0,
  remark TEXT NOT NULL DEFAULT '',
  is_listed BOOLEAN NOT NULL DEFAULT true,
  type TEXT DEFAULT '',
  is_online BOOLEAN DEFAULT false,
  is_offline BOOLEAN DEFAULT false,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

CREATE TABLE IF NOT EXISTS public.settlement_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  hb3_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.92,
  hc3_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.80,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.settlement_settings (id, hb3_rate, hc3_rate)
VALUES ('default', 0.92, 0.80)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon all on inventory" ON public.inventory FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on settlement_settings" ON public.settlement_settings FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settlement_settings;`;

  const copySql = () => {
    navigator.clipboard.writeText(sqlCode);
    onToast('SQL 建表语句已复制到剪贴板！');
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl relative z-10 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${isCloudConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {isCloudConnected ? <Cloud className="w-5 h-5" /> : <CloudOff className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2C3842]">Supabase 云端多设备同步</h3>
              <p className="text-xs text-[#697A88]">手机、电脑、平板随时随地共享实时库存</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-[#2C3842] rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-100 text-xs font-semibold">
          <button 
            onClick={() => setActiveTab('status')}
            className={`flex-1 py-3 transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'status' 
                ? 'text-[#2D6994] border-b-2 border-[#2D6994] bg-[#EAF3F8]/30 font-bold' 
                : 'text-[#697A88] hover:bg-slate-50'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            连接状态与同步
          </button>
          <button 
            onClick={() => setActiveTab('config')}
            className={`flex-1 py-3 transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'config' 
                ? 'text-[#2D6994] border-b-2 border-[#2D6994] bg-[#EAF3F8]/30 font-bold' 
                : 'text-[#697A88] hover:bg-slate-50'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            参数配置 / 环境变量
          </button>
          <button 
            onClick={() => setActiveTab('sql')}
            className={`flex-1 py-3 transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'sql' 
                ? 'text-[#2D6994] border-b-2 border-[#2D6994] bg-[#EAF3F8]/30 font-bold' 
                : 'text-[#697A88] hover:bg-slate-50'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            建表 SQL 脚本
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-auto space-y-4">
          
          {activeTab === 'status' && (
            <div className="space-y-4">
              {/* Status Banner */}
              <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                isCloudConnected 
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
                  : 'bg-amber-50/80 border-amber-200 text-amber-900'
              }`}>
                {isCloudConnected ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="text-xs space-y-1">
                  <div className="font-bold text-sm">
                    {isCloudConnected ? '云端连接正常 · 实时多端同步已激活' : '尚未连接到 Supabase 云端'}
                  </div>
                  <div className="opacity-90">
                    {isCloudConnected 
                      ? '手机、电脑修改或添加商品时，数据将秒级同步至 Supabase 云端数据库。' 
                      : '目前使用浏览器本地存储。请配置 Supabase 环境变量或在“参数配置”中填入连接密钥。'}
                  </div>
                </div>
              </div>

              {/* Data Status Summary */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-[#2C3842] space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[#697A88]">当前加载商品数量：</span>
                  <span className="font-bold text-sm text-[#2D6994]">{items.length} 件</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#697A88]">当前货架结算比例：</span>
                  <span className="font-semibold">HB3: {(settlementSettings.hb3Rate * 100).toFixed(0)}% | HC3: {(settlementSettings.hc3Rate * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#697A88]">当前 Supabase 项目地址：</span>
                  <span className="font-mono text-[11px] text-[#697A88] truncate max-w-[240px]" title={currentConfig.url}>
                    {currentConfig.url || '未设置'}
                  </span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    await onRefreshFromCloud();
                    onToast('已从云端拉取最新数据！');
                  }}
                  className="flex items-center justify-center p-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-semibold text-[#2C3842] transition-colors"
                >
                  <RefreshCw className="w-4 h-4 mr-2 text-[#2D6994]" />
                  从云端重新拉取
                </button>

                <button
                  type="button"
                  onClick={handleForceUploadLocal}
                  disabled={isSyncingLocal}
                  className="flex items-center justify-center p-3 bg-[#2D6994] text-white rounded-xl hover:bg-[#235375] text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  <UploadCloud className="w-4 h-4 mr-2" />
                  {isSyncingLocal ? '正在上传...' : '强制将本地上传云端'}
                </button>
              </div>

              {/* Security Boundary Explanation */}
              <div className="bg-[#EAF3F8] p-3.5 rounded-xl border border-[#72B8D6]/30 text-xs text-[#2D6994] leading-relaxed flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#2D6994]" />
                <div>
                  <span className="font-bold block mb-0.5">私人管理站点安全说明：</span>
                  当前采用 Supabase 匿名公开 Key (anon) 方案，无需登录即可实现手机、平板、电脑随时打开即同步，零使用门槛。请勿将此私密网站地址公开分享给无关人员即可保持私密。
                </div>
              </div>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-4">
              <div className="text-xs text-[#697A88] leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
                <b>部署提示 (Netlify)：</b>
                推荐在 Netlify 控制台 <b>Site configuration &gt; Environment variables</b> 中添加以下两个变量，部署后将永久自动生效：
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2C3842] mb-1">
                  VITE_SUPABASE_URL
                </label>
                <input 
                  type="text"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://your-project.supabase.co"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#2D6994] text-[#2C3842]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2C3842] mb-1">
                  VITE_SUPABASE_ANON_KEY
                </label>
                <input 
                  type="text"
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#2D6994] text-[#2C3842]"
                />
              </div>

              {testingStatus !== 'idle' && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  testingStatus === 'success' 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : testingStatus === 'failed' 
                      ? 'bg-red-50 text-red-800 border border-red-200' 
                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                }`}>
                  {testingStatus === 'testing' && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {testingStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  {testingStatus === 'failed' && <AlertCircle className="w-4 h-4 text-red-600" />}
                  <span>{statusMessage}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={!supabaseUrl || !supabaseAnonKey}
                  className="flex-1 py-2.5 border border-[#2D6994] text-[#2D6994] hover:bg-[#EAF3F8] rounded-xl text-xs font-semibold transition-colors disabled:opacity-40"
                >
                  测试连接
                </button>
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="flex-1 py-2.5 bg-[#2D6994] text-white hover:bg-[#235375] rounded-xl text-xs font-semibold shadow-sm transition-colors"
                >
                  保存设置并连接
                </button>
              </div>
            </div>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#697A88]">
                  请在 Supabase 控制台的 <b>SQL Editor</b> 中粘贴并点击 <b>Run</b>：
                </span>
                <button
                  type="button"
                  onClick={copySql}
                  className="px-2.5 py-1 bg-[#2D6994] text-white rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-[#235375]"
                >
                  <Copy className="w-3.5 h-3.5" />
                  一键复制 SQL
                </button>
              </div>

              <pre className="bg-slate-900 text-slate-100 p-3.5 rounded-xl text-[11px] font-mono overflow-x-auto max-h-72 leading-relaxed border border-slate-800">
                {sqlCode}
              </pre>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#2C3842] bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
          >
            完成并关闭
          </button>
        </div>

      </div>
    </div>
  );
};

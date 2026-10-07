import React, { useState } from 'react';
import { 
  Calculator, 
  X, 
  Plus, 
  Trash2, 
  Calendar, 
  History, 
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import { SettlementSettings, SettlementPayout } from '../types';

interface SettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  settlementSettings: SettlementSettings;
  onUpdateSettings: (newSettings: SettlementSettings) => void;
  stats: {
    settlementAmount: number;
    totalPaidAmount: number;
    pendingSettlementAmount: number;
    hb3Sales: number;
    hc3Sales: number;
    otherSales: number;
    payoutsCount?: number;
  };
  onToast: (msg: string) => void;
}

const DEFAULT_RATES = {
  hb3Rate: 0.92,
  hc3Rate: 0.80
};

export const SettlementModal: React.FC<SettlementModalProps> = ({
  isOpen,
  onClose,
  settlementSettings,
  onUpdateSettings,
  stats,
  onToast
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'payouts' | 'rates'>('payouts');

  // Payout input states
  const now = new Date();
  const currentMonthDefault = `${now.getFullYear()}年${now.getMonth() + 1}月`;
  const [monthInput, setMonthInput] = useState(currentMonthDefault);
  const [amountInput, setAmountInput] = useState('');
  const [remarkInput, setRemarkInput] = useState('');

  // Rate input states
  const [hb3Input, setHb3Input] = useState((settlementSettings.hb3Rate * 100).toString());
  const [hc3Input, setHc3Input] = useState((settlementSettings.hc3Rate * 100).toString());

  const payoutsList = Array.isArray(settlementSettings.payouts) ? settlementSettings.payouts : [];

  const [formError, setFormError] = useState<string | null>(null);

  const handleAddPayout = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const numAmount = parseFloat(amountInput);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('请输入大于 0 的有效结算金额');
      return;
    }
    if (!monthInput.trim()) {
      setFormError('请输入结算月份，例如：2026年2月');
      return;
    }

    const newPayout: SettlementPayout = {
      id: Date.now().toString() + '_' + Math.random().toString(36).slice(2, 7),
      month: monthInput.trim(),
      amount: numAmount,
      remark: remarkInput.trim(),
      createdAt: Date.now()
    };

    const updatedPayouts = [newPayout, ...payoutsList];
    onUpdateSettings({
      ...settlementSettings,
      payouts: updatedPayouts
    });

    setAmountInput('');
    setRemarkInput('');
    setFormError(null);
    onToast(`已成功录入 ${newPayout.month} 已结算 ¥${numAmount.toFixed(1)}`);
  };

  const handleDeletePayout = (id: string, month: string, amount: number) => {
    const updatedPayouts = payoutsList.filter(p => p.id !== id);
    onUpdateSettings({
      ...settlementSettings,
      payouts: updatedPayouts
    });
    onToast(`已删除 ${month} 的已结算记录 (¥${amount.toFixed(1)})`);
  };

  const handleSaveRates = () => {
    const hb3Num = parseFloat(hb3Input);
    const hc3Num = parseFloat(hc3Input);
    
    const newHb3Rate = isNaN(hb3Num) ? DEFAULT_RATES.hb3Rate : Math.max(0, hb3Num) / 100;
    const newHc3Rate = isNaN(hc3Num) ? DEFAULT_RATES.hc3Rate : Math.max(0, hc3Num) / 100;

    onUpdateSettings({
      ...settlementSettings,
      hb3Rate: newHb3Rate,
      hc3Rate: newHc3Rate
    });
    onToast('结算比例设置已保存');
    onClose();
  };

  const handleResetRates = () => {
    setHb3Input((DEFAULT_RATES.hb3Rate * 100).toString());
    setHc3Input((DEFAULT_RATES.hc3Rate * 100).toString());
    onUpdateSettings({
      ...settlementSettings,
      hb3Rate: DEFAULT_RATES.hb3Rate,
      hc3Rate: DEFAULT_RATES.hc3Rate
    });
    onToast('结算比例已恢复默认');
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl relative z-10 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 sm:p-5 border-b bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#EAF3F8] text-[#2D6994] rounded-xl">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2C3842]">结算金额管理与核销明细</h3>
              <p className="text-xs text-[#697A88]">查看总额、录入已结月份金额、核对待结算余额</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Summary Cards Banner */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-medium text-[#697A88]">总结算金额</div>
              <div className="text-base sm:text-lg font-bold text-[#2C3842] mt-0.5 truncate">
                ¥{stats.settlementAmount.toFixed(1)}
              </div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-medium text-[#697A88]">累计已结算</div>
              <div className="text-base sm:text-lg font-bold text-[#2D6994] mt-0.5 truncate">
                ¥{stats.totalPaidAmount.toFixed(1)}
              </div>
            </div>
            <div className="bg-[#FEF6EE] p-3 rounded-xl border border-[#F9DBAF] shadow-xs">
              <div className="text-[11px] font-bold text-[#B54708]">待结算金额</div>
              <div className="text-base sm:text-lg font-extrabold text-[#D87048] mt-0.5 truncate">
                ¥{stats.pendingSettlementAmount.toFixed(1)}
              </div>
            </div>
          </div>
          <div className="text-[11px] text-[#697A88] text-center mt-2 flex items-center justify-center gap-1">
            <span>待结算金额 = 总结算金额 (¥{stats.settlementAmount.toFixed(1)}) - 累计已结算 (¥{stats.totalPaidAmount.toFixed(1)})</span>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-white px-4 pt-2">
          <button
            onClick={() => setActiveTab('payouts')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'payouts'
                ? 'border-[#2D6994] text-[#2D6994]'
                : 'border-transparent text-[#697A88] hover:text-[#2C3842]'
            }`}
          >
            <History className="w-4 h-4" />
            <span>已结算明细与录入</span>
            {payoutsList.length > 0 && (
              <span className="px-1.5 py-0.2 bg-[#EAF3F8] text-[#2D6994] rounded-full text-[10px] font-bold">
                {payoutsList.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('rates')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'rates'
                ? 'border-[#2D6994] text-[#2D6994]'
                : 'border-transparent text-[#697A88] hover:text-[#2C3842]'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>货架比例设置 (HB3/HC3)</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'payouts' ? (
            <div className="space-y-4">
              {/* Form to enter a new settlement payout */}
              <form onSubmit={handleAddPayout} className="bg-[#F8FAFC] p-3.5 sm:p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-[#2C3842] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-[#2D6994]" /> 手动录入已结算明细
                  </span>
                  <span className="text-[11px] text-[#697A88] font-normal">多设备云端自动同步</span>
                </div>

                {formError && (
                  <div className="text-xs text-[#D87048] bg-[#FAECE6] p-2 rounded-lg border border-[#F5B8A9]">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#2C3842] mb-1 flex items-center justify-between">
                      <span>结算月份 *</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            setMonthInput(`${d.getFullYear()}年${d.getMonth() + 1}月`);
                          }}
                          className="text-[10px] text-[#2D6994] hover:underline"
                        >
                          当月
                        </button>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            d.setMonth(d.getMonth() - 1);
                            setMonthInput(`${d.getFullYear()}年${d.getMonth() + 1}月`);
                          }}
                          className="text-[10px] text-[#2D6994] hover:underline"
                        >
                          上月
                        </button>
                      </div>
                    </label>
                    <input 
                      type="text" 
                      value={monthInput}
                      onChange={(e) => setMonthInput(e.target.value)}
                      placeholder="如：2026年2月"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium text-[#2C3842] focus:ring-2 focus:ring-[#2D6994]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#2C3842] mb-1">
                      已结算金额 (¥) *
                    </label>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0.01"
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      placeholder="如：50"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-[#2C3842] focus:ring-2 focus:ring-[#2D6994]"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#697A88] mb-1">
                    备注说明 (选填，如转账流水、经手人)
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={remarkInput}
                      onChange={(e) => setRemarkInput(e.target.value)}
                      placeholder="如：微信转账 / 展会现场结算"
                      className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-[#2C3842] focus:ring-2 focus:ring-[#2D6994]"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#2D6994] hover:bg-[#235375] text-white rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center gap-1 flex-shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" /> 确认录入
                    </button>
                  </div>
                </div>
              </form>

              {/* List of Settlement Payouts */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-[#2C3842]">
                  <span>已结算历史明细 ({payoutsList.length} 笔)</span>
                  <span className="text-[#697A88] font-medium">累计已结: <b className="text-[#2D6994]">¥{stats.totalPaidAmount.toFixed(1)}</b></span>
                </div>

                {payoutsList.length === 0 ? (
                  <div className="text-center py-8 bg-[#F8FAFC] rounded-xl border border-dashed border-slate-200 text-xs text-[#697A88]">
                    <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                    <p className="font-semibold text-[#2C3842]">暂无手动已结算记录</p>
                    <p className="mt-1">在上方输入月份与金额（如：2026年2月 已结算 50元），面板将自动核销并计算待结算余额。</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                    {payoutsList.map((payout) => (
                      <div 
                        key={payout.id}
                        className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="px-2 py-0.5 rounded bg-[#EAF3F8] text-[#2D6994] font-bold border border-[#72B8D6]/40 text-[11px] flex-shrink-0">
                            {payout.month}
                          </span>
                          <div className="truncate">
                            <span className="font-bold text-[#2C3842] text-sm mr-2">¥{Number(payout.amount).toFixed(2)}</span>
                            {payout.remark && (
                              <span className="text-[#697A88] text-[11px] bg-slate-50 px-1.5 py-0.5 rounded">
                                {payout.remark}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] text-[#697A88] hidden sm:inline">
                            {new Date(payout.createdAt || Date.now()).toLocaleDateString('zh-CN')}
                          </span>
                          <button
                            onClick={() => handleDeletePayout(payout.id, payout.month, payout.amount)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="删除此笔记录"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-[#EAF3F8] p-3.5 rounded-xl border border-[#72B8D6]/30 text-xs text-[#2D6994] leading-relaxed">
                <span className="font-semibold block mb-1">当前货架结算公式：</span>
                结算金额 = 货架 HB3 销售额 × <b>{((settlementSettings.hb3Rate || 0.92) * 100).toFixed(0)}%</b> + 货架 HC3 销售额 × <b>{((settlementSettings.hc3Rate || 0.8) * 100).toFixed(0)}%</b>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#2C3842] mb-1 flex justify-between items-center">
                    <span>HB3 货架结算比例 (%)</span>
                    <span className="text-[11px] text-[#2D6994] font-medium">默认 92% (乘数 0.92)</span>
                  </label>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.1"
                      min="0"
                      max="100"
                      value={hb3Input}
                      onChange={(e) => setHb3Input(e.target.value)}
                      className="w-full px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#2D6994] font-bold text-[#2C3842] text-sm"
                      placeholder="92"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#2C3842] mb-1 flex justify-between items-center">
                    <span>HC3 货架结算比例 (%)</span>
                    <span className="text-[11px] text-[#2D6994] font-medium">默认 80% (乘数 0.80)</span>
                  </label>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.1"
                      min="0"
                      max="100"
                      value={hc3Input}
                      onChange={(e) => setHc3Input(e.target.value)}
                      className="w-full px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#2D6994] font-bold text-[#2C3842] text-sm"
                      placeholder="80"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">%</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200/80 pt-3 space-y-1.5 text-xs text-[#697A88]">
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
                <div className="flex justify-between text-sm font-bold text-[#2D6994] pt-1.5 border-t border-slate-200">
                  <span>预计总结算额：</span>
                  <span>¥{stats.settlementAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t flex justify-between items-center gap-2">
          {activeTab === 'rates' ? (
            <button
              type="button"
              onClick={handleResetRates}
              className="px-3 py-1.5 text-xs font-medium text-[#697A88] hover:text-[#2C3842] hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              恢复默认 (92% / 80%)
            </button>
          ) : (
            <span className="text-[11px] text-[#697A88]">录入后多设备实时同步</span>
          )}
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-[#2C3842] bg-white border border-gray-300 rounded-lg hover:bg-slate-50"
            >
              关闭
            </button>
            {activeTab === 'rates' && (
              <button
                type="button"
                onClick={handleSaveRates}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#2D6994] rounded-lg hover:bg-[#235375] shadow-sm"
              >
                保存比例
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

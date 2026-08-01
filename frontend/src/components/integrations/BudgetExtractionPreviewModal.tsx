import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, DollarSign, FileSpreadsheet, Save, Loader2, TrendingUp, Tag, ExternalLink, Layers } from 'lucide-react';

interface CategoryItem {
  category_name: string;
  original_amount: number;
  appraised_amount?: number | null;
  earned_value_to_date: number;
  appraisal_delta?: number;
  is_appraised?: boolean;
}

interface BudgetExtractionPreviewModalProps {
  showModal: boolean;
  onClose: () => void;
  onConfirm: (finalData: any) => void;
  extractedData: any;
  isSaving: boolean;
  documentTitle?: string;
  documentUrl?: string;
  tradeLabel?: string;
  expectedCount?: number;
  currentWorkbookIndex?: number;
}

const COMMON_TRADES = [
  'Builders Works',
  'Electrical Works',
  'Mechanical Works',
  'Civil & Structural Works',
  'Plumbing & Drainage',
  'General Master Budget',
];

export default function BudgetExtractionPreviewModal({
  showModal,
  onClose,
  onConfirm,
  extractedData,
  isSaving,
  documentTitle,
  documentUrl,
  tradeLabel: initialTradeLabel = 'General Master Budget',
  expectedCount = 1,
  currentWorkbookIndex = 1,
}: BudgetExtractionPreviewModalProps) {
  const [originalSum, setOriginalSum] = useState<number>(0);
  const [appraisedBudget, setAppraisedBudget] = useState<number | ''>('');
  const [earnedValue, setEarnedValue] = useState<number>(0);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [tradeLabel, setTradeLabel] = useState<string>(initialTradeLabel);
  const [customTrade, setCustomTrade] = useState<string>('');

  useEffect(() => {
    if (extractedData?.metrics) {
      const m = extractedData.metrics;
      setOriginalSum(m.original_contract_sum || 0);
      setAppraisedBudget(m.appraised_budget !== null && m.appraised_budget !== undefined ? m.appraised_budget : '');
      setEarnedValue(m.earned_value || 0);
    }
    if (extractedData?.categories) {
      setCategories(extractedData.categories);
    }
    if (extractedData?.project_metadata?.trade_label) {
      setTradeLabel(extractedData.project_metadata.trade_label);
    } else if (initialTradeLabel) {
      setTradeLabel(initialTradeLabel);
    }
  }, [extractedData, initialTradeLabel]);

  if (!showModal) return null;

  const effectiveBudget = (appraisedBudget !== '' && Number(appraisedBudget) > 0)
    ? Number(appraisedBudget)
    : originalSum;

  const remainingBalance = Math.max(0, effectiveBudget - earnedValue);
  const percentUsed = effectiveBudget > 0 ? Math.min(100, (earnedValue / effectiveBudget) * 100) : 0;
  const isAppraised = appraisedBudget !== '' && Number(appraisedBudget) !== originalSum;

  const handleCategoryChange = (index: number, field: keyof CategoryItem, value: any) => {
    const updated = [...categories];
    const num = Number(value) || 0;
    const item = { ...updated[index], [field]: num };
    
    if (field === 'appraised_amount' || field === 'original_amount') {
      const orig = item.original_amount || 0;
      const appr = item.appraised_amount !== undefined && item.appraised_amount !== null ? item.appraised_amount : orig;
      item.appraisal_delta = appr - orig;
      item.is_appraised = appr !== orig;
    }
    
    updated[index] = item;
    setCategories(updated);
  };

  const handleSave = () => {
    const finalTrade = tradeLabel === 'Custom' ? (customTrade.trim() || 'Custom Trade') : tradeLabel;
    onConfirm({
      original_contract_sum: originalSum,
      appraised_budget: appraisedBudget !== '' ? Number(appraisedBudget) : null,
      earned_value: earnedValue,
      remaining_balance: remainingBalance,
      percent_used: percentUsed,
      trade_label: finalTrade,
      project_metadata: extractedData?.project_metadata,
      categories: categories.map((c) => ({
        ...c,
        appraisal_delta: (c.appraised_amount ?? c.original_amount) - c.original_amount,
        is_appraised: c.appraised_amount !== undefined && c.appraised_amount !== null && c.appraised_amount !== c.original_amount,
      })),
    });
  };

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val);
  };

  return (
    <div className="fixed inset-0 bg-dark-teal-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col relative overflow-hidden">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-dark-teal-950 via-dark-teal-900 to-indigo-950 p-6 flex items-center justify-between flex-shrink-0 text-white">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[10px] font-bold">
                  <Layers className="w-3 h-3 mr-1" /> Workbook {currentWorkbookIndex} of {expectedCount}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> System Verified
                </span>
              </div>
              <h2 className="text-lg font-bold font-lexend mt-0.5">Budget Verification & Alignment Preview</h2>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Source Document: <strong className="text-white">{documentTitle || 'Master Budget Sheet'}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {documentUrl && (
              <a
                href={documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 backdrop-blur-md border border-white/20"
              >
                <span>Open in Drive</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Validation Issues Alert Bar */}
        {extractedData?.validation_issues?.length > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 p-3 px-6 flex items-center space-x-3 text-amber-900 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>Validation Notice: {extractedData.validation_issues.join(' | ')}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6 bg-gray-50/40">
          
          {/* Trade Discipline Assignment Input */}
          <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <label className="block text-xs font-bold font-lexend text-gray-900">
                Confirm Trade Discipline for Workbook ({currentWorkbookIndex} of {expectedCount}):
              </label>
              <p className="text-[11px] text-gray-500">Categorizes this workbook in the Master Bundle Matrix.</p>
            </div>
            <div className="flex items-center space-x-2">
              <select
                value={tradeLabel}
                onChange={(e) => setTradeLabel(e.target.value)}
                className="p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-dark-teal-500"
              >
                {COMMON_TRADES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
                <option value="Custom">Custom Trade...</option>
              </select>

              {tradeLabel === 'Custom' && (
                <input
                  type="text"
                  placeholder="Custom trade..."
                  value={customTrade}
                  onChange={(e) => setCustomTrade(e.target.value)}
                  className="p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold"
                />
              )}
            </div>
          </div>

          {/* Executive Summary Top Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Original Contract Sum</span>
              <div className="flex items-center space-x-1 text-gray-900 font-bold font-lexend text-sm">
                <span>$</span>
                <input
                  type="number"
                  value={originalSum}
                  onChange={(e) => setOriginalSum(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-900 focus:ring-2 focus:ring-dark-teal-500"
                />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-sm space-y-1 relative">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Appraised Budget</span>
                {isAppraised && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <Tag className="w-2.5 h-2.5 mr-0.5" /> Appraised
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1 text-indigo-900 font-bold font-lexend text-sm">
                <span>$</span>
                <input
                  type="number"
                  placeholder="Optional Appraised Sum"
                  value={appraisedBudget}
                  onChange={(e) => setAppraisedBudget(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-indigo-50/50 border border-indigo-200 rounded-lg px-2 py-1 text-xs font-bold text-indigo-950 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Earned Value to Date</span>
              <div className="flex items-center space-x-1 text-emerald-700 font-bold font-lexend text-sm">
                <span>$</span>
                <input
                  type="number"
                  value={earnedValue}
                  onChange={(e) => setEarnedValue(Number(e.target.value))}
                  className="w-full bg-emerald-50/50 border border-emerald-200 rounded-lg px-2 py-1 text-xs font-bold text-emerald-950 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Remaining Balance</span>
              <p className="text-sm font-bold font-lexend text-dark-teal-900 pt-1">
                {formatCurrency(remainingBalance)}
              </p>
            </div>
          </div>

          {/* Visual Budget Progress Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-sm space-y-2">
            <div className="flex justify-between items-center text-xs font-bold font-lexend">
              <span className="text-gray-700 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1.5 text-dark-teal-600" /> Contract Budget Consumption
              </span>
              <span className="text-dark-teal-900 font-extrabold">{percentUsed.toFixed(1)}% Used</span>
            </div>
            <div className="w-full bg-gray-150 h-3 rounded-full overflow-hidden p-0.5 border border-gray-200">
              <div
                className="bg-gradient-to-r from-dark-teal-700 via-dark-teal-600 to-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${percentUsed}%` }}
              />
            </div>
          </div>

          {/* Itemized Category Appraisals Table */}
          <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden space-y-3 p-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-xs font-bold font-lexend text-gray-900">Summary Category Breakdowns & Appraisals</h3>
                <p className="text-[11px] text-gray-500">Cross-check section budgets extracted for this workbook.</p>
              </div>
              <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-[10px] font-bold text-gray-600">
                {categories.length} Categories Found
              </span>
            </div>

            {categories.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-4 text-center">No itemized category breakdown detected on summary page.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-2.5">Category Name</th>
                      <th className="px-4 py-2.5 text-right">Original Amount ($)</th>
                      <th className="px-4 py-2.5 text-right">Appraised Amount ($)</th>
                      <th className="px-4 py-2.5 text-right">Earned Value to Date ($)</th>
                      <th className="px-4 py-2.5 text-right">Variance (Delta)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {categories.map((cat, idx) => {
                      const orig = cat.original_amount || 0;
                      const appr = cat.appraised_amount !== undefined && cat.appraised_amount !== null ? cat.appraised_amount : orig;
                      const delta = appr - orig;
                      const isCatAppraised = appr !== orig;

                      return (
                        <tr key={idx} className="hover:bg-gray-50/80 transition">
                          <td className="px-4 py-3 font-bold text-gray-900">{cat.category_name}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-700">
                            <input
                              type="number"
                              value={cat.original_amount || 0}
                              onChange={(e) => handleCategoryChange(idx, 'original_amount', e.target.value)}
                              className="w-28 text-right bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 font-semibold text-xs"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            <input
                              type="number"
                              placeholder="Original"
                              value={cat.appraised_amount !== undefined && cat.appraised_amount !== null ? cat.appraised_amount : ''}
                              onChange={(e) => handleCategoryChange(idx, 'appraised_amount', e.target.value === '' ? null : e.target.value)}
                              className="w-28 text-right bg-indigo-50/50 border border-indigo-200 rounded px-1.5 py-0.5 font-bold text-xs text-indigo-950"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            <input
                              type="number"
                              value={cat.earned_value_to_date || 0}
                              onChange={(e) => handleCategoryChange(idx, 'earned_value_to_date', e.target.value)}
                              className="w-28 text-right bg-emerald-50/50 border border-emerald-200 rounded px-1.5 py-0.5 font-bold text-xs text-emerald-950"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-bold">
                            {isCatAppraised ? (
                              <span className={delta >= 0 ? 'text-indigo-600' : 'text-red-600'}>
                                {delta >= 0 ? '+' : ''}{formatCurrency(delta)}
                              </span>
                            ) : (
                              <span className="text-gray-400 font-normal">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer Controls */}
        <div className="p-5 bg-gray-50 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <p className="text-[11px] text-gray-500 font-medium">
            Confirming will add this workbook ({currentWorkbookIndex} of {expectedCount}) to the Master Bundle Matrix and run system reconciliation.
          </p>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 bg-gray-150 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 bg-dark-teal-800 hover:bg-dark-teal-900 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center space-x-2 active:scale-95 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Committing & Reconciling...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Confirm & Reconcile Master Table</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

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
  initialModule?: string;
}

const COMMON_TRADES = [
  'Builders Works',
  'Electrical Works',
  'Mechanical Works',
  'Civil & Structural Works',
  'Plumbing & Drainage',
  'General Master Budget',
];

interface NumberInputProps {
  value: number | string | null | undefined;
  onChange: (val: number | null) => void;
  className?: string;
  placeholder?: string;
}

const NumberInput = ({ value, onChange, className = '', placeholder = '' }: NumberInputProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState('');

  // Format value to show commas
  const formatWithCommas = (val: number | string | null | undefined) => {
    if (val === null || val === undefined || val === '') return '';
    const parts = String(val).replace(/,/g, '').split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  // Sync display value when value changes externally and not focused
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatWithCommas(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const cleanVal = rawVal.replace(/[^0-9.-]/g, '');
    setDisplayValue(rawVal);
    
    if (cleanVal === '') {
      onChange(null);
      return;
    }
    const parsedNum = parseFloat(cleanVal);
    if (!isNaN(parsedNum)) {
      onChange(parsedNum);
    } else {
      onChange(null);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    setDisplayValue(value !== null && value !== undefined ? String(value) : '');
  };

  const handleBlur = () => {
    setIsFocused(false);
    setDisplayValue(formatWithCommas(value));
  };

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
    />
  );
};

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
  initialModule = 'budget',
}: BudgetExtractionPreviewModalProps) {
  const [originalSum, setOriginalSum] = useState<number>(0);
  const [appraisedBudget, setAppraisedBudget] = useState<number | ''>('');
  const [earnedValue, setEarnedValue] = useState<number>(0);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [tradeLabel, setTradeLabel] = useState<string>(initialTradeLabel);
  const [customTrade, setCustomTrade] = useState<string>('');
  const [moduleTag, setModuleTag] = useState<string>(initialModule);

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
    if (initialModule) {
      setModuleTag(initialModule);
    }
  }, [extractedData, initialTradeLabel, initialModule]);

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

  const handleCategoryNameChange = (index: number, newName: string) => {
    const updated = [...categories];
    updated[index] = { ...updated[index], category_name: newName };
    setCategories(updated);
  };

  const handleAddCategory = () => {
    setCategories([
      ...categories,
      {
        category_name: 'New Category',
        original_amount: 0,
        appraised_amount: null,
        earned_value_to_date: 0,
        appraisal_delta: 0,
        is_appraised: false,
      },
    ]);
  };

  const handleDeleteCategory = (index: number) => {
    setCategories(categories.filter((_, idx) => idx !== index));
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
      module: moduleTag,
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
      <div className="bg-slate-900 rounded-3xl w-full max-w-5xl shadow-2xl border border-slate-700/50 max-h-[92vh] flex flex-col relative overflow-hidden">
        
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
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-900/200/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold">
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
        <div className="p-6 flex-1 overflow-y-auto space-y-6 bg-slate-800/50/40">
          
          {/* Trade & Module Category Assignment Inputs */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-gray-150 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col justify-between gap-2 border-b md:border-b-0 md:border-r border-slate-700/50 pb-4 md:pb-0 md:pr-6">
              <div>
                <label className="block text-xs font-bold font-lexend text-white uppercase tracking-wide">
                  Confirm Trade Discipline for Workbook ({currentWorkbookIndex} of {expectedCount}):
                </label>
                <p className="text-[11px] text-slate-400 mt-0.5">Categorizes this workbook in the Master Bundle Matrix.</p>
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <select
                  value={tradeLabel}
                  onChange={(e) => setTradeLabel(e.target.value)}
                  className="p-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-xs font-bold text-slate-200 focus:ring-2 focus:ring-dark-teal-500"
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
                    className="p-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-xs font-semibold"
                  />
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between gap-2">
              <div>
                <label className="block text-xs font-bold font-lexend text-white uppercase tracking-wide">
                  Module Tag / Tab Destination:
                </label>
                <p className="text-[11px] text-slate-400 mt-0.5">Determines which tab this linked workbook displays under on the dashboard.</p>
              </div>
              <div className="mt-2">
                <select
                  value={moduleTag}
                  onChange={(e) => setModuleTag(e.target.value)}
                  className="p-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-xs font-bold text-slate-200 focus:ring-2 focus:ring-dark-teal-500 w-full max-w-[240px]"
                >
                  <option value="budget">Project Budget</option>
                  <option value="progress">Work Progress Calculations</option>
                </select>
              </div>
            </div>
          </div>

          {/* Executive Summary Top Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 p-4 rounded-2xl border border-gray-150 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Original Contract Sum</span>
              <div className="flex items-center space-x-1 text-white font-bold font-lexend text-sm">
                <span>$</span>
                <NumberInput
                  value={originalSum}
                  onChange={(val) => setOriginalSum(val || 0)}
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-2 py-1 text-xs font-bold text-white focus:ring-2 focus:ring-dark-teal-500"
                />
              </div>
            </div>

            <div className="bg-slate-900 p-4 rounded-2xl border border-gray-150 shadow-sm space-y-1 relative">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Appraised Budget</span>
                {isAppraised && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-500/40">
                    <Tag className="w-2.5 h-2.5 mr-0.5" /> Appraised
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1 text-indigo-200 font-bold font-lexend text-sm">
                <span>$</span>
                <NumberInput
                  placeholder="Optional Appraised Sum"
                  value={appraisedBudget === '' ? undefined : appraisedBudget}
                  onChange={(val) => setAppraisedBudget(val === null ? '' : val)}
                  className="w-full bg-indigo-900/20 border border-indigo-500/40 rounded-lg px-2 py-1 text-xs font-bold text-indigo-950 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="bg-slate-900 p-4 rounded-2xl border border-gray-150 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Earned Value to Date</span>
              <div className="flex items-center space-x-1 text-emerald-400 font-bold font-lexend text-sm">
                <span>$</span>
                <NumberInput
                  value={earnedValue}
                  onChange={(val) => setEarnedValue(val || 0)}
                  className="w-full bg-emerald-900/20/50 border border-emerald-200 rounded-lg px-2 py-1 text-xs font-bold text-emerald-100 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="bg-slate-900 p-4 rounded-2xl border border-gray-150 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Remaining Balance</span>
              <p className="text-sm font-bold font-lexend text-dark-teal-900 pt-1">
                {formatCurrency(remainingBalance)}
              </p>
            </div>
          </div>

          {/* Visual Budget Progress Bar */}
          <div className="bg-slate-900 p-4 rounded-2xl border border-gray-150 shadow-sm space-y-2">
            <div className="flex justify-between items-center text-xs font-bold font-lexend">
              <span className="text-slate-300 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1.5 text-dark-teal-600" /> Contract Budget Consumption
              </span>
              <span className="text-dark-teal-900 font-extrabold">{percentUsed.toFixed(1)}% Used</span>
            </div>
            <div className="w-full bg-gray-150 h-3 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
              <div
                className="bg-gradient-to-r from-dark-teal-700 via-dark-teal-600 to-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${percentUsed}%` }}
              />
            </div>
          </div>

          {/* Itemized Category Appraisals Table */}
          <div className="bg-slate-900 rounded-2xl border border-gray-150 shadow-sm overflow-hidden space-y-3 p-5">
            <div className="flex items-center justify-between border-b border-slate-700/50 pb-3">
              <div>
                <h3 className="text-xs font-bold font-lexend text-white">Summary Category Breakdowns & Appraisals</h3>
                <p className="text-[11px] text-slate-400">Cross-check section budgets extracted for this workbook.</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="px-2.5 py-1 bg-dark-teal-50 hover:bg-dark-teal-100 text-dark-teal-700 rounded-lg text-[10px] font-bold transition flex items-center shadow-sm"
                >
                  <Layers className="w-3.5 h-3.5 mr-1" /> Add Category Row
                </button>
                <span className="px-2.5 py-1 bg-slate-800 rounded-lg text-[10px] font-bold text-slate-400">
                  {categories.length} Categories Found
                </span>
              </div>
            </div>

            {categories.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-4 text-center">No itemized category breakdown detected on summary page.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/50 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-2.5 min-w-[320px]">Category Name</th>
                      <th className="px-4 py-2.5 text-right">Original Amount ($)</th>
                      <th className="px-4 py-2.5 text-right">Appraised Amount ($)</th>
                      <th className="px-4 py-2.5 text-right">Earned Value to Date ($)</th>
                      <th className="px-4 py-2.5 text-right">Variance (Delta)</th>
                      <th className="px-4 py-2.5 text-center w-12">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {categories.map((cat, idx) => {
                      const orig = cat.original_amount || 0;
                      const appr = cat.appraised_amount !== undefined && cat.appraised_amount !== null ? cat.appraised_amount : orig;
                      const delta = appr - orig;
                      const isCatAppraised = appr !== orig;

                      return (
                        <tr key={idx} className="hover:bg-slate-800/50/80 transition">
                          <td className="px-4 py-3 font-bold text-white min-w-[320px]">
                            <input
                              type="text"
                              value={cat.category_name}
                              onChange={(e) => handleCategoryNameChange(idx, e.target.value)}
                              className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-600 focus:border-dark-teal-500 focus:ring-0 px-0.5 py-0.5 font-bold text-xs text-white focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-300">
                            <NumberInput
                              value={cat.original_amount || 0}
                              onChange={(val) => handleCategoryChange(idx, 'original_amount', val || 0)}
                              className="w-40 text-right bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1 font-semibold text-xs focus:ring-2 focus:ring-dark-teal-500/20 focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            <NumberInput
                              placeholder="Original"
                              value={cat.appraised_amount !== undefined && cat.appraised_amount !== null ? cat.appraised_amount : undefined}
                              onChange={(val) => handleCategoryChange(idx, 'appraised_amount', val)}
                              className="w-40 text-right bg-indigo-900/20 border border-indigo-500/40 rounded px-2 py-1 font-bold text-xs text-indigo-950 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            <NumberInput
                              value={cat.earned_value_to_date || 0}
                              onChange={(val) => handleCategoryChange(idx, 'earned_value_to_date', val || 0)}
                              className="w-40 text-right bg-emerald-900/20/50 border border-emerald-200 rounded px-2 py-1 font-bold text-xs text-emerald-100 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
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
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(idx)}
                              className="p-1 text-gray-400 hover:text-red-600 rounded transition"
                              title="Delete Row"
                            >
                              <X className="w-4 h-4" />
                            </button>
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
        <div className="p-5 bg-slate-800/50 border-t border-slate-700/50 flex items-center justify-between flex-shrink-0">
          <p className="text-[11px] text-slate-400 font-medium">
            Confirming will add this workbook ({currentWorkbookIndex} of {expectedCount}) to the Master Bundle Matrix and run system reconciliation.
          </p>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 bg-gray-150 hover:bg-gray-200 text-slate-300 rounded-xl text-xs font-bold transition"
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

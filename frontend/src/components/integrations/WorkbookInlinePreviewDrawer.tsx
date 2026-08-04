import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, FileSpreadsheet, Edit3, Save, Plus, Trash2, CheckCircle2, Loader2, X } from 'lucide-react';
import { updateBudgetWorkbookMatrix } from '@/services/api';

interface WorkbookInlinePreviewDrawerProps {
  projectId?: number;
  onRefresh?: () => void;
  workbookData: {
    integration_id?: number;
    trade_label?: string;
    title?: string;
    file_url?: string;
    extracted_project_name?: string;
    summary_metrics?: {
      original_contract_sum?: number;
      appraised_budget?: number | null;
      earned_value?: number;
      remaining_balance?: number;
      percent_used?: number;
    };
    categories?: any[];
  };
}

export default function WorkbookInlinePreviewDrawer({
  projectId,
  onRefresh,
  workbookData,
}: WorkbookInlinePreviewDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [tradeLabel, setTradeLabel] = useState(workbookData.trade_label || 'Trade Workbook');
  const [categories, setCategories] = useState<any[]>(workbookData.categories || []);

  useEffect(() => {
    setTradeLabel(workbookData.trade_label || 'Trade Workbook');
    setCategories(workbookData.categories ? JSON.parse(JSON.stringify(workbookData.categories)) : []);
  }, [workbookData]);

  const metrics = workbookData.summary_metrics || {};
  const orig = metrics.original_contract_sum || 0;
  const appr = metrics.appraised_budget;
  const ev = metrics.earned_value || 0;
  const eff = (appr !== null && appr !== undefined && appr > 0) ? appr : orig;
  const rem = metrics.remaining_balance ?? Math.max(0, eff - ev);

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val);
  };

  const handleCategoryChange = (index: number, field: string, value: any) => {
    const next = [...categories];
    next[index] = { ...next[index], [field]: value };
    setCategories(next);
  };

  const handleAddCategory = () => {
    setCategories([
      ...categories,
      {
        category_name: 'New Trade Scope',
        original_amount: 0,
        appraised_amount: null,
        earned_value_to_date: 0,
        source_trade: tradeLabel,
      },
    ]);
  };

  const handleRemoveCategory = (index: number) => {
    setCategories(categories.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    if (!projectId) {
      setErrorMessage('Project ID is required to save updates.');
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(null);

    try {
      // Clean categories numeric formatting
      const cleanedCategories = categories.map((cat) => ({
        ...cat,
        category_name: cat.category_name || 'Unassigned Scope',
        original_amount: parseFloat(cat.original_amount) || 0,
        appraised_amount: cat.appraised_amount !== null && cat.appraised_amount !== undefined && cat.appraised_amount !== ''
          ? parseFloat(cat.appraised_amount)
          : null,
        earned_value_to_date: parseFloat(cat.earned_value_to_date) || 0,
        source_trade: tradeLabel,
      }));

      await updateBudgetWorkbookMatrix({
        project_id: projectId,
        integration_id: workbookData.integration_id,
        old_trade_label: workbookData.trade_label,
        trade_label: tradeLabel,
        categories: cleanedCategories,
      });

      setSaveSuccess('Workbook updated! Master Budget & subtotal sums recompiled above.');
      setIsEditing(false);
      if (onRefresh) {
        onRefresh();
      }
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      console.error('Save error:', err);
      setErrorMessage(err.response?.data?.detail || 'Failed to save workbook updates.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-2xl bg-white overflow-hidden shadow-sm transition">
      {/* Drawer Header Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3.5 px-4 bg-gray-50/80 hover:bg-gray-100/80 transition flex items-center justify-between text-left"
      >
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-white rounded-xl text-dark-teal-800 border border-gray-200 shadow-xs">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-dark-teal-800 font-inter">
                {tradeLabel || 'Trade Workbook Summary'}
              </span>
              {appr && appr !== orig && (
                <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Appraised
                </span>
              )}
            </div>
            <p className="text-xs font-bold font-lexend text-gray-900 leading-tight">
              {workbookData.title || 'Workbook Summary Table'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Effective Budget / EV</p>
            <p className="text-xs font-bold text-gray-800">{formatCurrency(eff)} / {formatCurrency(ev)}</p>
          </div>
          <div className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-600">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Expandable Drawer Body */}
      {isOpen && (
        <div className="p-5 space-y-4 border-t border-gray-200 bg-gray-50/30 animate-fade-in">
          {/* Top Feedback Banners */}
          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-bold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{saveSuccess}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 font-bold flex items-center justify-between">
              <span>{errorMessage}</span>
              <button onClick={() => setErrorMessage(null)}>
                <X className="w-4 h-4 text-red-600" />
              </button>
            </div>
          )}

          {/* Action Header bar for Editing */}
          <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-200">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-gray-700">Source Trade Header:</span>
              {isEditing ? (
                <input
                  type="text"
                  value={tradeLabel}
                  onChange={(e) => setTradeLabel(e.target.value)}
                  className="p-2 px-3 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-dark-teal-500 min-w-[240px] shadow-xs"
                  placeholder="Trade Label (e.g. Electrical)"
                />
              ) : (
                <span className="px-2.5 py-1 bg-dark-teal-50 text-dark-teal-900 rounded-lg font-bold text-xs border border-dark-teal-100">
                  {tradeLabel}
                </span>
              )}
            </div>

            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs border border-indigo-200 transition flex items-center space-x-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Workbook Values</span>
              </button>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setCategories(workbookData.categories ? JSON.parse(JSON.stringify(workbookData.categories)) : []);
                    setTradeLabel(workbookData.trade_label || 'Trade Workbook');
                  }}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{isSaving ? 'Saving...' : 'Save Workbook Changes'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Core Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white p-3 rounded-xl border border-gray-150 space-y-0.5">
              <span className="text-[9px] uppercase font-bold text-gray-400">Original Contract Sum</span>
              <p className="font-bold text-gray-900">{formatCurrency(orig)}</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-gray-150 space-y-0.5">
              <span className="text-[9px] uppercase font-bold text-gray-400">Appraised Budget</span>
              <p className="font-bold text-indigo-900">{appr ? formatCurrency(appr) : 'None'}</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-gray-150 space-y-0.5">
              <span className="text-[9px] uppercase font-bold text-gray-400">Earned Value to Date</span>
              <p className="font-bold text-emerald-700">{formatCurrency(ev)}</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-gray-150 space-y-0.5">
              <span className="text-[9px] uppercase font-bold text-gray-400">Remaining Balance</span>
              <p className="font-bold text-dark-teal-900">{formatCurrency(rem)}</p>
            </div>
          </div>

          {/* Itemized Categories Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden space-y-2">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-150 flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Extracted Component Categories ({categories.length})
              </span>
              {isEditing && (
                <button
                  onClick={handleAddCategory}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold border border-emerald-200 transition flex items-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Component Row</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/50 text-gray-400 font-bold uppercase text-[9px] border-b border-gray-150">
                  <tr>
                    <th className="px-4 py-2">Category Name</th>
                    <th className="px-4 py-2 text-right">Original ($)</th>
                    <th className="px-4 py-2 text-right">Appraised ($)</th>
                    <th className="px-4 py-2 text-right">EV to Date ($)</th>
                    {isEditing && <th className="px-3 py-2 text-center w-12">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                  {categories.length === 0 ? (
                    <tr>
                      <td colSpan={isEditing ? 5 : 4} className="px-4 py-4 text-center text-gray-400 italic text-[11px]">
                        No categories found. Click "Add Component Row" to insert items.
                      </td>
                    </tr>
                  ) : (
                    categories.map((c, idx) => {
                      const cOrig = c.original_amount || 0;
                      const cAppr = c.appraised_amount;
                      const cEv = c.earned_value_to_date || 0;

                      return (
                        <tr key={idx} className="hover:bg-gray-50/60">
                          <td className="px-4 py-2.5 font-bold text-gray-900 min-w-[240px]">
                            {isEditing ? (
                              <input
                                type="text"
                                value={c.category_name || ''}
                                onChange={(e) => handleCategoryChange(idx, 'category_name', e.target.value)}
                                className="w-full p-2 bg-white border border-gray-300 rounded-xl font-bold text-xs focus:outline-none focus:ring-2 focus:ring-dark-teal-500 shadow-xs"
                                placeholder="Component Category Name"
                              />
                            ) : (
                              c.category_name
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right min-w-[160px]">
                            {isEditing ? (
                              <input
                                type="number"
                                step="any"
                                value={c.original_amount ?? 0}
                                onChange={(e) => handleCategoryChange(idx, 'original_amount', e.target.value)}
                                className="w-36 text-right p-2 bg-white border border-gray-300 rounded-xl font-bold text-xs focus:outline-none focus:ring-2 focus:ring-dark-teal-500 shadow-xs ml-auto"
                              />
                            ) : (
                              formatCurrency(cOrig)
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-indigo-900 min-w-[160px]">
                            {isEditing ? (
                              <input
                                type="number"
                                step="any"
                                placeholder="None"
                                value={c.appraised_amount ?? ''}
                                onChange={(e) => handleCategoryChange(idx, 'appraised_amount', e.target.value)}
                                className="w-36 text-right p-2 bg-white border border-gray-300 rounded-xl font-bold text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs ml-auto"
                              />
                            ) : cAppr ? (
                              formatCurrency(cAppr)
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-emerald-800 min-w-[160px]">
                            {isEditing ? (
                              <input
                                type="number"
                                step="any"
                                value={c.earned_value_to_date ?? 0}
                                onChange={(e) => handleCategoryChange(idx, 'earned_value_to_date', e.target.value)}
                                className="w-36 text-right p-2 bg-white border border-gray-300 rounded-xl font-bold text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs ml-auto"
                              />
                            ) : (
                              formatCurrency(cEv)
                            )}
                          </td>
                          {isEditing && (
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => handleRemoveCategory(idx)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition"
                                title="Remove row"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

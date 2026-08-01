import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileSpreadsheet, Tag, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';

interface WorkbookInlinePreviewDrawerProps {
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

export default function WorkbookInlinePreviewDrawer({ workbookData }: WorkbookInlinePreviewDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const metrics = workbookData.summary_metrics || {};
  const orig = metrics.original_contract_sum || 0;
  const appr = metrics.appraised_budget;
  const ev = metrics.earned_value || 0;
  const eff = (appr !== null && appr !== undefined && appr > 0) ? appr : orig;
  const rem = metrics.remaining_balance ?? Math.max(0, eff - ev);
  const pct = metrics.percent_used ?? (eff > 0 ? (ev / eff) * 100 : 0);
  const categories = workbookData.categories || [];

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val);
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
                {workbookData.trade_label || 'Trade Workbook Summary'}
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
          
          {/* Header Metadata Info */}
          {workbookData.extracted_project_name && (
            <div className="p-3 bg-white rounded-xl border border-gray-200 flex items-center justify-between text-xs font-semibold">
              <span className="text-gray-500">Header Project Title Found:</span>
              <span className="font-bold text-dark-teal-900">{workbookData.extracted_project_name}</span>
            </div>
          )}

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

          {/* Itemized Categories Table for this specific workbook */}
          {categories.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-150 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Raw Extracted Categories ({categories.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/50 text-gray-400 font-bold uppercase text-[9px]">
                    <tr>
                      <th className="px-4 py-2">Category</th>
                      <th className="px-4 py-2 text-right">Original ($)</th>
                      <th className="px-4 py-2 text-right">Appraised ($)</th>
                      <th className="px-4 py-2 text-right">EV to Date ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                    {categories.map((c, idx) => {
                      const cOrig = c.original_amount || 0;
                      const cAppr = c.appraised_amount;
                      const cEv = c.earned_value_to_date || 0;
                      return (
                        <tr key={idx} className="hover:bg-gray-50/60">
                          <td className="px-4 py-2 font-bold text-gray-900">{c.category_name}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(cOrig)}</td>
                          <td className="px-4 py-2 text-right font-semibold text-indigo-900">{cAppr ? formatCurrency(cAppr) : '-'}</td>
                          <td className="px-4 py-2 text-right font-semibold text-emerald-800">{formatCurrency(cEv)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-gray-400 italic text-center py-2">No category breakdown details stored for this workbook.</p>
          )}

        </div>
      )}

    </div>
  );
}

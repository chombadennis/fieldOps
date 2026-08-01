import React, { useState } from 'react';
import { X, Layers, CheckCircle2, ChevronRight, FileSpreadsheet, ArrowRight } from 'lucide-react';

interface BudgetBundleSetupModalProps {
  showModal: boolean;
  onClose: () => void;
  onConfirm: (config: { isBundle: boolean; expectedCount: number; tradeLabel: string }) => void;
  provider: 'google' | 'onedrive';
  currentLinkedCount: number;
}

const COMMON_TRADES = [
  'Builders Works',
  'Electrical Works',
  'Mechanical Works',
  'Civil & Structural Works',
  'Plumbing & Drainage',
  'General Master Budget',
];

export default function BudgetBundleSetupModal({
  showModal,
  onClose,
  onConfirm,
  provider,
  currentLinkedCount,
}: BudgetBundleSetupModalProps) {
  const [isBundle, setIsBundle] = useState<boolean>(false);
  const [expectedCount, setExpectedCount] = useState<number>(1);
  const [tradeLabel, setTradeLabel] = useState<string>('General Master Budget');
  const [customTrade, setCustomTrade] = useState<string>('');

  if (!showModal) return null;

  const handleProceed = () => {
    const finalTrade = tradeLabel === 'Custom' ? (customTrade.trim() || 'Custom Trade') : tradeLabel;
    onConfirm({
      isBundle,
      expectedCount: isBundle ? expectedCount : 1,
      tradeLabel: finalTrade,
    });
  };

  return (
    <div className="fixed inset-0 bg-dark-teal-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-gray-100 flex flex-col overflow-hidden relative">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-dark-teal-950 via-dark-teal-900 to-indigo-950 p-6 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20">
              <Layers className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-extrabold tracking-widest text-emerald-400 font-inter">
                Workbook Linkage Setup
              </span>
              <h3 className="text-base font-bold font-lexend mt-0.5">Budget Structure & Trade Label</h3>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 bg-gray-50/40">
          
          {/* Question 1: Single vs Multi-Bundle */}
          <div className="space-y-3">
            <label className="block text-xs font-bold font-lexend text-gray-900">
              1. Is your project budget contained in a single workbook or split across multiple trade workbooks?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={currentLinkedCount > 1}
                onClick={() => {
                  setIsBundle(false);
                  setExpectedCount(1);
                }}
                className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between ${
                  currentLinkedCount > 1
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                    : !isBundle
                    ? 'bg-dark-teal-50/80 border-dark-teal-600 ring-2 ring-dark-teal-500/20 text-dark-teal-950 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <FileSpreadsheet className={`w-5 h-5 ${!isBundle && currentLinkedCount <= 1 ? 'text-dark-teal-700' : 'text-gray-400'}`} />
                  {!isBundle && currentLinkedCount <= 1 && <CheckCircle2 className="w-4 h-4 text-dark-teal-700" />}
                </div>
                <div>
                  <p className="text-xs font-bold font-lexend">Single Master Workbook</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">One workbook holds the complete project budget.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsBundle(true);
                  if (expectedCount === 1) setExpectedCount(2);
                }}
                className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between ${
                  isBundle
                    ? 'bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-500/20 text-indigo-950 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Layers className={`w-5 h-5 ${isBundle ? 'text-indigo-700' : 'text-gray-400'}`} />
                  {isBundle && <CheckCircle2 className="w-4 h-4 text-indigo-700" />}
                </div>
                <div>
                  <p className="text-xs font-bold font-lexend">Multi-Trade Bundle</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Multiple workbooks (Builders, Electrical, etc.).</p>
                </div>
              </button>
            </div>
          </div>

          {/* Question 2: Total Workbooks Count (If Multi-Bundle) */}
          {isBundle && (
            <div className="space-y-2 bg-white p-4 rounded-2xl border border-indigo-150 shadow-sm animate-fade-in">
              <label className="block text-xs font-bold text-gray-900 font-lexend">
                2. How many workbooks in total make up this project budget bundle? (Max 5)
              </label>
              {currentLinkedCount > 1 && (
                <div className="text-[10px] text-amber-600 font-semibold mb-1 bg-amber-50 p-1.5 rounded-lg border border-amber-200">
                  Note: You already have {currentLinkedCount} workbooks linked. You cannot select a total lower than {currentLinkedCount}. Please go back to the dashboard and disconnect the extra workbooks first.
                </div>
              )}
              <div className="flex items-center space-x-2 pt-1">
                {[2, 3, 4, 5].map((cnt) => {
                  const isDisabled = cnt < currentLinkedCount;
                  return (
                    <button
                      key={cnt}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => setExpectedCount(cnt)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                        isDisabled
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                          : expectedCount === cnt
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {cnt} Workbooks
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Question 3: Trade Label Assignment */}
          <div className="space-y-2 bg-white p-4 rounded-2xl border border-gray-150 shadow-sm">
            <label className="block text-xs font-bold text-gray-900 font-lexend">
              3. Assign Trade Discipline Label to this Workbook:
            </label>
            <select
              value={tradeLabel}
              onChange={(e) => setTradeLabel(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-dark-teal-500"
            >
              {COMMON_TRADES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
              <option value="Custom">Other Custom Trade...</option>
            </select>

            {tradeLabel === 'Custom' && (
              <input
                type="text"
                placeholder="Enter custom trade discipline name..."
                value={customTrade}
                onChange={(e) => setCustomTrade(e.target.value)}
                className="w-full mt-2 p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-dark-teal-500"
              />
            )}
          </div>

        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-150 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
          >
            Cancel
          </button>
          <button
            onClick={handleProceed}
            className="px-5 py-2.5 bg-dark-teal-800 hover:bg-dark-teal-900 text-white rounded-xl text-xs font-bold shadow transition flex items-center space-x-1.5 active:scale-95"
          >
            <span>Proceed to Select Workbook</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
}

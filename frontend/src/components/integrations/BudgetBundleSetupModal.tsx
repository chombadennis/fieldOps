import React, { useState, useEffect } from 'react';
import { X, Layers, CheckCircle2, ChevronRight, FileSpreadsheet, ArrowRight, Lock, Info } from 'lucide-react';

interface PersistedBundleConfig {
  tracking_mode?: string;
  expected_count?: number;
  linked_count?: number;
  is_complete?: boolean;
}

interface BudgetBundleSetupModalProps {
  showModal: boolean;
  onClose: () => void;
  onConfirm: (config: { isBundle: boolean; expectedCount: number; tradeLabel: string }) => void;
  provider: 'google' | 'onedrive';
  currentLinkedCount: number;
  persistedBundleConfig?: PersistedBundleConfig;
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
  persistedBundleConfig,
}: BudgetBundleSetupModalProps) {
  // Determine if the structure choice is locked (user has already linked at least one workbook)
  const isStructureLocked = !!(persistedBundleConfig && (persistedBundleConfig.linked_count || 0) > 0);
  const persistedTrackingMode = persistedBundleConfig?.tracking_mode;
  const persistedExpectedCount = persistedBundleConfig?.expected_count || 1;
  const persistedLinkedCount = persistedBundleConfig?.linked_count || 0;
  const remainingSlots = Math.max(0, persistedExpectedCount - persistedLinkedCount);

  const [isBundle, setIsBundle] = useState<boolean>(false);
  const [expectedCount, setExpectedCount] = useState<number>(1);
  const [tradeLabel, setTradeLabel] = useState<string>('General Master Budget');
  const [customTrade, setCustomTrade] = useState<string>('');

  // Initialize state from persisted config when modal opens
  useEffect(() => {
    if (showModal && isStructureLocked) {
      setIsBundle(persistedTrackingMode === 'split');
      setExpectedCount(persistedExpectedCount);
    } else if (showModal && !isStructureLocked) {
      // Fresh start — reset to defaults
      setIsBundle(false);
      setExpectedCount(1);
    }
    // Always reset trade label on open
    if (showModal) {
      setTradeLabel('General Master Budget');
      setCustomTrade('');
    }
  }, [showModal, isStructureLocked, persistedTrackingMode, persistedExpectedCount]);

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

          {/* Remaining Slots Info Banner (when structure is locked) */}
          {isStructureLocked && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3 animate-fade-in">
              <div className="p-2 bg-indigo-100 rounded-xl flex-shrink-0 mt-0.5">
                <Info className="w-4 h-4 text-indigo-700" />
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-900 font-lexend">
                  {remainingSlots > 0
                    ? `${remainingSlots} workbook${remainingSlots > 1 ? 's' : ''} remaining to link`
                    : 'All workbooks have been linked'
                  }
                </p>
                <p className="text-[10px] text-indigo-700 mt-0.5">
                  Your project is configured as a{' '}
                  <strong>{persistedTrackingMode === 'split' ? 'Multi-Trade Bundle' : 'Single Master Workbook'}</strong>
                  {persistedTrackingMode === 'split' && ` with ${persistedExpectedCount} total workbooks`}.
                  {' '}{persistedLinkedCount} of {persistedExpectedCount} already committed to database.
                </p>
              </div>
            </div>
          )}
          
          {/* Question 1: Single vs Multi-Bundle */}
          <div className="space-y-3">
            <label className="block text-xs font-bold font-lexend text-gray-900">
              {isStructureLocked ? (
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-gray-400" />
                  1. Budget structure (locked after first link):
                </span>
              ) : (
                '1. Is your project budget contained in a single workbook or split across multiple trade workbooks?'
              )}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isStructureLocked || currentLinkedCount > 1}
                onClick={() => {
                  setIsBundle(false);
                  setExpectedCount(1);
                }}
                className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between ${
                  isStructureLocked
                    ? (!isBundle
                      ? 'bg-dark-teal-50/60 border-dark-teal-400 text-dark-teal-800 opacity-80 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-50')
                    : currentLinkedCount > 1
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                    : !isBundle
                    ? 'bg-dark-teal-50/80 border-dark-teal-600 ring-2 ring-dark-teal-500/20 text-dark-teal-950 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <FileSpreadsheet className={`w-5 h-5 ${!isBundle ? 'text-dark-teal-700' : 'text-gray-400'}`} />
                  {!isBundle && <CheckCircle2 className={`w-4 h-4 ${isStructureLocked ? 'text-dark-teal-600' : 'text-dark-teal-700'}`} />}
                  {isStructureLocked && !isBundle && <Lock className="w-3 h-3 text-dark-teal-500 ml-1" />}
                </div>
                <div>
                  <p className="text-xs font-bold font-lexend">Single Master Workbook</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">One workbook holds the complete project budget.</p>
                </div>
              </button>

              <button
                type="button"
                disabled={isStructureLocked}
                onClick={() => {
                  setIsBundle(true);
                  if (expectedCount === 1) setExpectedCount(2);
                }}
                className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between ${
                  isStructureLocked
                    ? (isBundle
                      ? 'bg-indigo-50/60 border-indigo-400 text-indigo-800 opacity-80 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-50')
                    : isBundle
                    ? 'bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-500/20 text-indigo-950 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Layers className={`w-5 h-5 ${isBundle ? 'text-indigo-700' : 'text-gray-400'}`} />
                  {isBundle && <CheckCircle2 className={`w-4 h-4 ${isStructureLocked ? 'text-indigo-600' : 'text-indigo-700'}`} />}
                  {isStructureLocked && isBundle && <Lock className="w-3 h-3 text-indigo-500 ml-1" />}
                </div>
                <div>
                  <p className="text-xs font-bold font-lexend">Multi-Trade Bundle</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Multiple workbooks (Builders, Electrical, etc.).</p>
                </div>
              </button>
            </div>
          </div>

          {/* Question 2: Total Workbooks Count (If Multi-Bundle) — hidden when locked */}
          {isBundle && !isStructureLocked && (
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

          {/* Locked workbook count display (when locked and multi-trade) */}
          {isBundle && isStructureLocked && (
            <div className="bg-white p-4 rounded-2xl border border-indigo-150 shadow-sm animate-fade-in">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-gray-400" />
                <label className="text-xs font-bold text-gray-900 font-lexend">
                  2. Workbook count (locked):
                </label>
                <span className="ml-auto px-3 py-1 bg-indigo-600 text-white rounded-xl text-xs font-bold">
                  {persistedExpectedCount} Workbooks
                </span>
              </div>
            </div>
          )}

          {/* Question 3: Trade Label Assignment */}
          <div className="space-y-2 bg-white p-4 rounded-2xl border border-gray-150 shadow-sm">
            <label className="block text-xs font-bold text-gray-900 font-lexend">
              {isStructureLocked ? (
                <span>{isBundle ? '3' : '2'}. Assign Trade Discipline Label to this Workbook:</span>
              ) : (
                '3. Assign Trade Discipline Label to this Workbook:'
              )}
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

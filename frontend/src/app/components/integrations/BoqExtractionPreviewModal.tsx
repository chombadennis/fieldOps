import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertTriangle, Save } from 'lucide-react';

interface ExtractedBoqItem {
  bill_item_number: string | null;
  description: string;
  row_category: string;
  hierarchy_level: number;
  unit: string | null;
  quantity: number;
  rate: number;
  amount: number;
}

interface BoqExtractionPreviewModalProps {
  showModal: boolean;
  onClose: () => void;
  onConfirm: (data: any) => void;
  extractedData: any;
  isSaving: boolean;
  error?: string | null;
}

export default function BoqExtractionPreviewModal({
  showModal,
  onClose,
  onConfirm,
  extractedData,
  isSaving,
  error
}: BoqExtractionPreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [localItems, setLocalItems] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (extractedData?.boq_items) {
      setLocalItems(extractedData.boq_items.map((item: any) => ({
        ...item,
        quantity: item.quantity ? item.quantity.toLocaleString() : '',
        rate: item.rate ? item.rate.toLocaleString() : '',
        amount: item.amount ? item.amount.toLocaleString() : ''
      })));
    }
  }, [extractedData]);

  if (!showModal || !extractedData || !mounted) return null;

  const metadata = extractedData.project_metadata || {};

  const handleItemChange = (index: number, field: string, value: string) => {
    const newItems = [...localItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setLocalItems(newItems);
  };

  const handleConfirm = () => {
    const finalData = {
      ...extractedData,
      boq_items: localItems.map(item => ({
        ...item,
        // Strip commas before parsing back to float for the DB
        quantity: parseFloat(String(item.quantity).replace(/,/g, '')) || 0,
        rate: parseFloat(String(item.rate).replace(/,/g, '')) || 0,
        amount: parseFloat(String(item.amount).replace(/,/g, '')) || 0,
      }))
    };
    onConfirm(finalData);
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#030305]/90 backdrop-blur-md transition-opacity duration-300" 
        onClick={!isSaving ? onClose : undefined}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-[95vw] max-h-[95vh] bg-gradient-to-b from-[#1a1c23] to-[#0a0a0c] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex-none flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
          <div className="flex items-center space-x-4">
            <div className="p-2.5 bg-neon-cyan/20 rounded-xl border border-neon-cyan/30">
              <CheckCircle2 className="w-6 h-6 text-neon-cyan" />
            </div>
            <div>
              <h2 className="text-2xl font-bold font-lexend text-white tracking-tight">
                AI Extraction Preview
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Successfully parsed <strong className="text-white">{localItems.length}</strong> items. <span className="text-amber-400">You can edit the values below before saving.</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={isSaving}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* Metadata Cards */}
          {Object.keys(metadata).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(metadata).map(([key, val]) => (
                <div key={key} className="bg-black/40 border border-white/5 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">
                    {key.replace(/_/g, ' ')}
                  </p>
                  <p className="text-sm text-gray-200 font-medium truncate" title={String(val)}>
                    {String(val) || '-'}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Data Grid */}
          <div className="bg-[#0f1115] border border-white/10 rounded-xl overflow-hidden shadow-inner">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-xs uppercase bg-[#1a1d24] text-gray-400 font-semibold border-b border-white/5">
                  <tr>
                    <th className="px-4 py-4 w-[100px]">Item No</th>
                    <th className="px-4 py-4 w-[500px]">Description</th>
                    <th className="px-4 py-4 w-[100px] text-center">Unit</th>
                    <th className="px-4 py-4 w-[120px] text-right">Qty</th>
                    <th className="px-4 py-4 w-[150px] text-right">Rate</th>
                    <th className="px-4 py-4 w-[150px] text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {localItems.map((item, idx) => {
                    const isHeader = item.row_category === 'HEADER';
                    const indentStyle = isHeader ? {} : { marginLeft: `${item.hierarchy_level * 16}px` };
                    
                    return (
                      <tr key={idx} className={`hover:bg-white/5 transition-colors ${isHeader ? 'bg-white/[0.02]' : ''}`}>
                        <td className="px-4 py-3 align-top">
                          <input 
                            type="text"
                            value={item.bill_item_number || ''}
                            onChange={(e) => handleItemChange(idx, 'bill_item_number', e.target.value)}
                            className="w-full bg-transparent border border-transparent hover:border-white/20 focus:border-neon-cyan focus:bg-black/50 rounded px-2 py-1 text-neon-cyan font-mono text-xs transition-colors outline-none"
                            placeholder="-"
                          />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div style={indentStyle}>
                            <textarea
                              value={item.description}
                              onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                              rows={Math.max(1, item.description.split('\n').length)}
                              className={`w-full bg-transparent border border-transparent hover:border-white/20 focus:border-neon-cyan focus:bg-black/50 rounded px-2 py-1 transition-colors outline-none resize-none custom-scrollbar ${isHeader ? 'text-white font-bold' : 'text-gray-300'}`}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <input 
                            type="text"
                            value={item.unit || ''}
                            onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                            className="w-full bg-transparent border border-transparent hover:border-white/20 focus:border-neon-cyan focus:bg-black/50 rounded px-2 py-1 text-center text-gray-400 transition-colors outline-none"
                            placeholder="-"
                          />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <input 
                            type="text"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            className="w-full bg-transparent border border-transparent hover:border-white/20 focus:border-neon-cyan focus:bg-black/50 rounded px-2 py-1 text-right font-mono text-xs text-gray-300 transition-colors outline-none"
                            placeholder="-"
                          />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <input 
                            type="text"
                            value={item.rate}
                            onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                            className="w-full bg-transparent border border-transparent hover:border-white/20 focus:border-neon-cyan focus:bg-black/50 rounded px-2 py-1 text-right font-mono text-xs text-gray-300 transition-colors outline-none"
                            placeholder="-"
                          />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <input 
                            type="text"
                            value={item.amount}
                            onChange={(e) => handleItemChange(idx, 'amount', e.target.value)}
                            className="w-full bg-transparent border border-transparent hover:border-white/20 focus:border-neon-cyan focus:bg-black/50 rounded px-2 py-1 text-right font-mono text-xs text-emerald-400 transition-colors outline-none"
                            placeholder="-"
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {localItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        No items found in this extraction.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-none p-6 border-t border-white/10 bg-black/50 flex flex-col gap-4">
          {error && (
            <div className="w-full bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center text-red-400 text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
              <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center text-amber-400 text-sm">
              <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
              <span>Please review the extracted data before saving.</span>
            </div>
            
            <div className="flex space-x-3 w-full sm:w-auto">
              <button
                onClick={onClose}
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 transition-colors disabled:opacity-50 flex-1 sm:flex-none"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-neon-cyan text-black font-bold shadow-[0_0_15px_rgba(0,243,255,0.3)] hover:bg-white hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] transition-all active:scale-95 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:active:scale-100 flex-1 sm:flex-none min-w-[180px]"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    <span>Saving to DB...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Confirm & Save</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBoqItems, updateBoqItems } from '@/services/api';
import { X, Search, FileSpreadsheet, Loader2, Edit2, Check, RotateCcw, AlertTriangle } from 'lucide-react';

interface BoqItem {
  id: number;
  boq_id: number;
  bill_item_number: string | null;
  description: string;
  unit: string | null;
  quantity: number;
  rate: number;
  amount: number;
  row_category: string;
  hierarchy_level: number;
  parent_id: number | null;
}

interface BoqItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  boqId: number | null;
  docName: string;
  isReadOnly: boolean;
}

const formatNumberHelper = (num: number) => {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
};

const CommaNumberInput = ({ value, onChange, className }: { value: number, onChange: (v: number) => void, className: string }) => {
  const [localVal, setLocalVal] = useState(() => value ? formatNumberHelper(value) : '');

  useEffect(() => {
    setLocalVal(value ? formatNumberHelper(value) : '');
  }, [value]);

  const handleBlur = () => {
    const parsed = parseFloat(localVal.replace(/,/g, '')) || 0;
    setLocalVal(parsed ? formatNumberHelper(parsed) : '');
    onChange(parsed);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^[0-9.,]*$/.test(val)) {
      setLocalVal(val);
      const parsed = parseFloat(val.replace(/,/g, '')) || 0;
      onChange(parsed);
    }
  };

  return (
    <input 
      type="text"
      value={localVal}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
    />
  );
};

export default function BoqItemsModal({ isOpen, onClose, boqId, docName, isReadOnly }: BoqItemsModalProps) {
  const [items, setItems] = useState<BoqItem[]>([]);
  const [originalItems, setOriginalItems] = useState<BoqItem[]>([]);
    const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Edit mode states
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showConfirmSave, setShowConfirmSave] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const queryClient = useQueryClient();
  
  const { data: fetchedItems = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['boqItems', boqId],
    queryFn: () => getBoqItems(boqId!),
    enabled: isOpen && boqId !== null,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (fetchedItems.length > 0) {
      setItems(fetchedItems);
      setOriginalItems(JSON.parse(JSON.stringify(fetchedItems)));
      setIsDirty(false);
    }
  }, [fetchedItems]);

  useEffect(() => {
    if (!isOpen) {
      // Reset state on close
      setIsEditing(false);
      setIsDirty(false);
      setSuccessMessage(null);
      setError(null);
    }
  }, [isOpen]);

  const handleFieldChange = (id: number, field: keyof BoqItem, value: any) => {
    setItems((prevItems) => {
      const updated = prevItems.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          // Auto-calculate amount for line items
          if (field === 'quantity' || field === 'rate') {
            const qty = field === 'quantity' ? value : item.quantity;
            const rate = field === 'rate' ? value : item.rate;
            if (updatedItem.row_category === 'LINE_ITEM') {
              updatedItem.amount = qty * rate;
            }
          }
          return updatedItem;
        }
        return item;
      });
      
      // Determine if dirty
      const changed = JSON.stringify(updated) !== JSON.stringify(originalItems);
      setIsDirty(changed);
      return updated;
    });
  };

  const handleDiscard = () => {
    setItems(JSON.parse(JSON.stringify(originalItems)));
    setIsDirty(false);
    setIsEditing(false);
    setSuccessMessage(null);
    setError(null);
  };

  const handleSaveChanges = async () => {
    if (boqId === null) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await updateBoqItems(boqId, items);
      queryClient.invalidateQueries({ queryKey: ['boqItems', boqId] });
      setOriginalItems(JSON.parse(JSON.stringify(items)));
      setIsDirty(false);
      setIsEditing(false);
      setShowConfirmSave(false);
      setSuccessMessage('Changes saved successfully');
      
      // Auto-hide success message after 4 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to save changes.');
      setShowConfirmSave(false);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const filteredItems = items.filter((item) =>
    item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.bill_item_number && item.bill_item_number.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatNumber = (num: number) => {
    return formatNumberHelper(num);
  };

  const isHeader = (item: BoqItem) => {
    return item.row_category !== 'LINE_ITEM';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#030305]/90 backdrop-blur-md p-4">
      <div className="bg-[#0a0a0f] rounded-2xl w-full max-w-6xl h-[85vh] flex flex-col shadow-[0_0_40px_rgba(0,0,0,0.8)] overflow-hidden border border-white/10 animate-in fade-in zoom-in duration-200 relative">
        
        {/* Modal Header */}
        <header className="px-6 py-4 bg-black/40 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 bg-neon-cyan/20 rounded-xl flex items-center justify-center text-neon-cyan border border-neon-cyan/30 flex-shrink-0 shadow-[0_0_15px_rgba(0,243,255,0.2)]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold font-lexend text-white truncate" title={docName}>{docName}</h2>
                {isReadOnly && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Read-Only
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 font-medium">
                {isReadOnly ? 'Spreadsheet is disconnected. Reconnect integration to enable edits.' : 'Structured Bill of Quantities items'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {items.length > 0 && !loading && !isReadOnly && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center space-x-2 font-bold py-2 px-4 rounded-xl border text-sm transition-all shadow-sm ${
                  isEditing
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                    : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <Edit2 className="w-4 h-4" />
                <span>{isEditing ? 'Editing Mode Active' : 'Toggle Edit Mode'}</span>
              </button>
            )}
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Success/Error Banners */}
        {successMessage && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-3 flex items-center text-emerald-400 text-sm font-bold">
            <Check className="w-4 h-4 mr-2" />
            {successMessage}
          </div>
        )}
        {error && (
          <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-3 flex items-center text-red-400 text-sm font-bold">
            <AlertTriangle className="w-4 h-4 mr-2" />
            {error}
          </div>
        )}

        {/* Modal Search Bar */}
        <div className="p-4 border-b border-white/10 flex items-center space-x-4 bg-black/20">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search items by number or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full bg-black/50 border border-white/10 focus:border-neon-cyan focus:bg-black/80 text-white text-sm font-medium rounded-xl py-2.5 outline-none transition-all placeholder:text-gray-600"
            />
          </div>
        </div>

        {/* Modal Body / Items Table */}
        <div className="flex-1 overflow-auto bg-transparent pb-20">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-neon-cyan animate-spin" />
              <p className="text-sm text-gray-400 font-bold">Loading BOQ items...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="h-full flex items-center justify-center p-6">
              <div className="text-center text-gray-500">
                <FileSpreadsheet className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <p className="font-bold">No items found matching search query.</p>
              </div>
            </div>
          ) : (
            <div className="inline-block min-w-full align-middle p-4">
              <div className="overflow-hidden border border-white/10 rounded-xl shadow-lg bg-black/40 backdrop-blur-md">
                <table className="min-w-full divide-y divide-white/10">
                  <thead className="bg-white/5">
                    <tr>
                      {isEditing && <th scope="col" className="py-3 px-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider w-[120px]">Type</th>}
                      {isEditing && <th scope="col" className="py-3 px-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider w-[80px]">Depth</th>}
                      <th scope="col" className="py-3 px-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider w-[120px]">Item No</th>
                      <th scope="col" className="py-3 px-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider min-w-[450px]">Description</th>
                      <th scope="col" className="py-3 px-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider w-[80px]">Unit</th>
                      <th scope="col" className="py-3 px-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider w-[120px]">Quantity</th>
                      <th scope="col" className="py-3 px-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider w-[120px]">Rate</th>
                      <th scope="col" className="py-3 px-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider w-[140px]">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredItems.map((item) => {
                      const isHeaderRow = isHeader(item);
                      const depth = Math.max(0, item.hierarchy_level);
                      return (
                        <tr
                          key={item.id}
                          className={`${
                            isHeaderRow
                              ? 'bg-white/5 font-bold text-white border-y border-white/10'
                              : 'hover:bg-white/5 text-gray-300 transition-colors'
                          }`}
                        >
                          {isEditing && (
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              <select
                                value={item.row_category}
                                onChange={(e) => handleFieldChange(item.id, 'row_category', e.target.value)}
                                className="w-full bg-black/50 border border-white/20 text-white text-sm rounded-xl px-3 py-2 outline-none focus:border-neon-cyan font-bold shadow-inner"
                              >
                                <option value="LINE_ITEM">Line Item</option>
                                <option value="BILL_HEADER">Bill Header</option>
                                <option value="ELEMENT_HEADER">Element Header</option>
                                <option value="SUB_HEADER">Sub Header</option>
                              </select>
                            </td>
                          )}
                          {isEditing && (
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              <input
                                type="number"
                                min="-1"
                                max="10"
                                value={item.hierarchy_level}
                                onChange={(e) => handleFieldChange(item.id, 'hierarchy_level', parseInt(e.target.value) || 0)}
                                className="w-16 bg-black/50 border border-white/20 text-white text-sm rounded-xl px-3 py-2 outline-none focus:border-neon-cyan font-mono text-center shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                          )}
                          <td className="py-2.5 px-4 text-sm font-bold whitespace-nowrap">
                            {isEditing ? (
                              <input
                                type="text"
                                value={item.bill_item_number || ''}
                                onChange={(e) => handleFieldChange(item.id, 'bill_item_number', e.target.value)}
                                className="w-24 bg-black/50 border border-white/20 text-white text-sm rounded-xl px-3 py-2 outline-none focus:border-neon-cyan font-mono shadow-inner"
                              />
                            ) : (
                              item.bill_item_number || ''
                            )}
                          </td>
                          <td 
                            className="py-2.5 px-4 text-sm break-words min-w-[450px]"
                            style={{ paddingLeft: isEditing ? '1rem' : `${depth > 0 ? depth * 1.5 + 1 : 1}rem` }}
                          >
                            {isEditing ? (
                              <textarea
                                value={item.description}
                                rows={3}
                                onChange={(e) => handleFieldChange(item.id, 'description', e.target.value)}
                                className="w-full bg-black/50 border border-white/20 text-white text-sm rounded-xl p-3 outline-none focus:border-neon-cyan transition-all resize-y min-h-[80px] font-sans font-semibold leading-relaxed shadow-inner"
                              />
                            ) : (
                              item.description
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-sm font-bold whitespace-nowrap text-gray-400">
                            {isEditing ? (
                              <input
                                type="text"
                                value={item.unit || ''}
                                onChange={(e) => handleFieldChange(item.id, 'unit', e.target.value)}
                                className="w-20 bg-black/50 border border-white/20 text-white text-sm rounded-xl px-3 py-2 outline-none focus:border-neon-cyan shadow-inner"
                              />
                            ) : (
                              item.unit || ''
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-sm text-right whitespace-nowrap">
                            {isEditing ? (
                              <CommaNumberInput
                                value={item.quantity}
                                onChange={(val) => handleFieldChange(item.id, 'quantity', val)}
                                className="w-28 bg-black/50 border border-white/20 text-white text-sm rounded-xl px-3 py-2 outline-none focus:border-neon-cyan text-right font-mono shadow-inner"
                              />
                            ) : (
                              isHeaderRow || !item.quantity ? '' : formatNumber(item.quantity)
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-sm text-right whitespace-nowrap">
                            {isEditing ? (
                              <CommaNumberInput
                                value={item.rate}
                                onChange={(val) => handleFieldChange(item.id, 'rate', val)}
                                className="w-28 bg-black/50 border border-white/20 text-white text-sm rounded-xl px-3 py-2 outline-none focus:border-neon-cyan text-right font-mono shadow-inner"
                              />
                            ) : (
                              isHeaderRow || !item.rate ? '' : formatNumber(item.rate)
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-sm text-right font-bold text-emerald-400 whitespace-nowrap">
                            {isEditing ? (
                              isHeaderRow ? (
                                <CommaNumberInput
                                  value={item.amount}
                                  onChange={(val) => handleFieldChange(item.id, 'amount', val)}
                                  className="w-32 bg-black/50 border border-white/20 text-emerald-400 text-sm rounded-xl px-3 py-2 outline-none focus:border-neon-cyan text-right font-mono font-bold shadow-inner"
                                />
                              ) : (
                                <span className="font-mono px-3 py-2">{formatNumber(item.amount)}</span>
                              )
                            ) : (
                              item.amount ? formatNumber(item.amount) : ''
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Edit Mode / Sticky Footer Bar */}
        {isEditing && (
          <footer className="absolute bottom-0 inset-x-0 bg-black/90 backdrop-blur-md border-t border-white/10 px-6 py-4 flex items-center justify-between shadow-[0_-4px_20px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-200">
            {isDirty ? (
              <span className="text-sm font-bold text-amber-400 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2" /> You have unsaved changes.
              </span>
            ) : (
              <span className="text-sm font-bold text-gray-400">
                Editing Mode Active - Make changes to enable saving.
              </span>
            )}
            <div className="flex items-center space-x-3">
              <button
                onClick={handleDiscard}
                disabled={!isDirty || saving}
                className="flex items-center space-x-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold py-2 px-4 rounded-xl shadow-sm text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Discard Changes</span>
              </button>
              <button
                onClick={() => setShowConfirmSave(true)}
                disabled={!isDirty || saving}
                className="flex items-center space-x-2 bg-neon-cyan hover:bg-white text-black font-bold py-2 px-5 rounded-xl shadow-[0_0_15px_rgba(0,243,255,0.3)] text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                <Check className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </footer>
        )}

        {/* Confirmation Modal */}
        {showConfirmSave && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div className="bg-[#030305] rounded-2xl p-6 max-w-md w-full border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-150 text-center">
              <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-400 mx-auto mb-4 border border-amber-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Save Changes</h3>
              <p className="text-sm text-gray-400 leading-relaxed mb-6 font-medium">
                You are about to save edited changes to your BOQ {docName}. This will update the records in the database. Are you sure you want to proceed?
              </p>
              <div className="flex items-center justify-center space-x-3">
                <button
                  onClick={() => setShowConfirmSave(false)}
                  disabled={saving}
                  className="bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveChanges}
                  disabled={saving}
                  className="flex items-center justify-center space-x-2 bg-neon-cyan hover:bg-white text-black font-bold py-2.5 px-6 rounded-xl shadow-[0_0_15px_rgba(0,243,255,0.3)] text-sm transition-all active:scale-95 min-w-[120px]"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Confirm</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

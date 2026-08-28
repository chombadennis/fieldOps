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
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  };

  const isHeader = (item: BoqItem) => {
    return item.row_category !== 'LINE_ITEM';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-200 relative">
        
        {/* Modal Header */}
        <header className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 bg-crimson-violet-50 rounded-xl flex items-center justify-center text-crimson-violet-600 flex-shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-gray-800 truncate" title={docName}>{docName}</h2>
                {isReadOnly && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Read-Only
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {isReadOnly ? 'Spreadsheet is disconnected. Reconnect integration to enable edits.' : 'Structured Bill of Quantities items'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {items.length > 0 && !loading && !isReadOnly && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center space-x-2 font-semibold py-2 px-4 rounded-xl border text-sm transition-all shadow-sm ${
                  isEditing
                    ? 'bg-crimson-violet-50 border-crimson-violet-200 text-crimson-violet-600'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Edit2 className="w-4 h-4" />
                <span>{isEditing ? 'Editing Mode' : 'Edit Items'}</span>
              </button>
            )}
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Success/Error Banners */}
        {successMessage && (
          <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-3 flex items-center text-emerald-800 text-sm font-semibold">
            <Check className="w-4 h-4 mr-2" />
            {successMessage}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border-b border-red-100 px-6 py-3 flex items-center text-red-800 text-sm font-semibold">
            <AlertTriangle className="w-4 h-4 mr-2" />
            {error}
          </div>
        )}

        {/* Modal Search Bar */}
        <div className="p-4 border-b border-gray-100 flex items-center space-x-4 bg-white">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search items by number or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full bg-gray-50 border border-gray-200 focus:border-crimson-violet-300 focus:bg-white text-sm rounded-xl py-2.5 outline-none transition-all"
            />
          </div>
        </div>

        {/* Modal Body / Items Table */}
        <div className="flex-1 overflow-auto bg-gray-50/30 pb-20">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-crimson-violet-600 animate-spin" />
              <p className="text-sm text-gray-500 font-medium">Loading BOQ items...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="h-full flex items-center justify-center p-6">
              <div className="text-center text-gray-500">
                <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="font-medium">No items found matching search query.</p>
              </div>
            </div>
          ) : (
            <div className="inline-block min-w-full align-middle p-4">
              <div className="overflow-hidden border border-gray-200 rounded-xl shadow bg-white">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {isEditing && <th scope="col" className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-[120px]">Type</th>}
                      {isEditing && <th scope="col" className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-[80px]">Depth</th>}
                      <th scope="col" className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-[120px]">Item No</th>
                      <th scope="col" className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[450px]">Description</th>
                      <th scope="col" className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-[80px]">Unit</th>
                      <th scope="col" className="py-3 px-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-[120px]">Quantity</th>
                      <th scope="col" className="py-3 px-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-[120px]">Rate</th>
                      <th scope="col" className="py-3 px-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-[140px]">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredItems.map((item) => {
                      const isHeaderRow = isHeader(item);
                      const depth = Math.max(0, item.hierarchy_level);
                      return (
                        <tr
                          key={item.id}
                          className={`${
                            isHeaderRow
                              ? 'bg-gray-50/80 font-bold text-gray-800'
                              : 'hover:bg-gray-50/50 text-gray-600'
                          }`}
                        >
                          {isEditing && (
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              <select
                                value={item.row_category}
                                onChange={(e) => handleFieldChange(item.id, 'row_category', e.target.value)}
                                className="w-full bg-white border border-gray-200 text-xs rounded px-2 py-1 outline-none focus:border-crimson-violet-300 font-semibold"
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
                                className="w-16 bg-white border border-gray-200 text-xs rounded px-2 py-1 outline-none focus:border-crimson-violet-300 font-mono text-center"
                              />
                            </td>
                          )}
                          <td className="py-2.5 px-4 text-sm font-medium whitespace-nowrap">
                            {isEditing ? (
                              <input
                                type="text"
                                value={item.bill_item_number || ''}
                                onChange={(e) => handleFieldChange(item.id, 'bill_item_number', e.target.value)}
                                className="w-24 bg-white border border-gray-200 text-xs rounded px-2 py-1 outline-none focus:border-crimson-violet-300 font-mono"
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
                                className="w-full bg-white border border-gray-200 text-sm rounded-lg p-2.5 outline-none focus:border-crimson-violet-300 focus:ring-1 focus:ring-crimson-violet-100 transition-all resize-y min-h-[80px] font-sans text-gray-700 leading-relaxed"
                              />
                            ) : (
                              item.description
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-sm whitespace-nowrap">
                            {isEditing ? (
                              <input
                                type="text"
                                value={item.unit || ''}
                                onChange={(e) => handleFieldChange(item.id, 'unit', e.target.value)}
                                className="w-16 bg-white border border-gray-200 text-xs rounded px-2 py-1 outline-none focus:border-crimson-violet-300"
                              />
                            ) : (
                              item.unit || ''
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-sm text-right whitespace-nowrap">
                            {isEditing ? (
                              <input
                                type="number"
                                step="any"
                                value={item.quantity}
                                onChange={(e) => handleFieldChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                className="w-24 bg-white border border-gray-200 text-xs rounded px-2 py-1 outline-none focus:border-crimson-violet-300 text-right font-mono"
                              />
                            ) : (
                              isHeaderRow || !item.quantity ? '' : formatNumber(item.quantity)
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-sm text-right whitespace-nowrap">
                            {isEditing ? (
                              <input
                                type="number"
                                step="any"
                                value={item.rate}
                                onChange={(e) => handleFieldChange(item.id, 'rate', parseFloat(e.target.value) || 0)}
                                className="w-24 bg-white border border-gray-200 text-xs rounded px-2 py-1 outline-none focus:border-crimson-violet-300 text-right font-mono"
                              />
                            ) : (
                              isHeaderRow || !item.rate ? '' : formatNumber(item.rate)
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-sm text-right font-semibold text-gray-800 whitespace-nowrap">
                            {isEditing ? (
                              isHeaderRow ? (
                                <input
                                  type="number"
                                  step="any"
                                  value={item.amount}
                                  onChange={(e) => handleFieldChange(item.id, 'amount', parseFloat(e.target.value) || 0)}
                                  className="w-28 bg-white border border-gray-200 text-xs rounded px-2 py-1 outline-none focus:border-crimson-violet-300 text-right font-mono font-semibold"
                                />
                              ) : (
                                <span className="font-mono">{formatNumber(item.amount)}</span>
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

        {/* Bottom Dirty / Sticky Footer Bar */}
        {isDirty && (
          <footer className="absolute bottom-0 inset-x-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between shadow-[0_-4px_12px_rgba(0,0,0,0.05)] animate-in slide-in-from-bottom duration-200">
            <span className="text-sm font-medium text-gray-600">You have unsaved changes.</span>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleDiscard}
                className="flex items-center space-x-2 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-700 font-semibold py-2 px-4 rounded-xl shadow-sm text-sm transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Discard Changes</span>
              </button>
              <button
                onClick={() => setShowConfirmSave(true)}
                className="flex items-center space-x-2 bg-crimson-violet-600 hover:bg-crimson-violet-700 text-white font-semibold py-2 px-5 rounded-xl shadow-md text-sm transition-all"
              >
                <Check className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </footer>
        )}

        {/* Confirmation Modal */}
        {showConfirmSave && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-gray-100 shadow-2xl animate-in zoom-in-95 duration-150 text-center">
              <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mx-auto mb-4 border border-amber-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Save Changes</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                You are about to save edited changes to your BOQ {docName}. This will update the records in the database. Are you sure you want to proceed?
              </p>
              <div className="flex items-center justify-center space-x-3">
                <button
                  onClick={() => setShowConfirmSave(false)}
                  disabled={saving}
                  className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2 px-4 rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveChanges}
                  disabled={saving}
                  className="flex items-center justify-center space-x-2 bg-crimson-violet-600 hover:bg-crimson-violet-700 text-white font-semibold py-2 px-5 rounded-xl shadow-md text-sm transition-all"
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

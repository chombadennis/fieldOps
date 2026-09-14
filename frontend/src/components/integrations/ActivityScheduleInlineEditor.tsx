import React, { useState, useEffect } from 'react';
import { Edit3, Save, X, Plus, Trash2, Loader2, CheckCircle2, ChevronDown, ChevronUp, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { getActivityScheduleItems, updateActivityScheduleItems } from '@/services/api';

interface ActivityItem {
  id?: number;
  activity_id: string;
  description: string;
  weight_percentage: number;
  fixed_price: number;
  values_map?: Record<string, any>;
}

interface ActivityScheduleInlineEditorProps {
  projectId: number;
  documentId: number;
  documentTitle: string;
  onRefresh?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

interface NumberInputProps {
  value: number | string | null | undefined;
  onChange: (val: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

const NumberInput = ({ value, onChange, className = '', placeholder = '', disabled = false }: NumberInputProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState('');

  const formatWithCommas = (val: number | string | null | undefined) => {
    if (val === null || val === undefined || val === '') return '';
    const parts = String(val).replace(/,/g, '').split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatWithCommas(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const cleanVal = rawVal.replace(/[^0-9.-]/g, '');
    setDisplayValue(rawVal);
    
    const parsedNum = parseFloat(cleanVal);
    if (!isNaN(parsedNum)) {
      onChange(parsedNum);
    } else {
      onChange(0);
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
      disabled={disabled}
      placeholder={placeholder}
      className={className}
    />
  );
};

export default function ActivityScheduleInlineEditor({
  projectId,
  documentId,
  documentTitle,
  onRefresh,
  isOpen = false,
  onClose,
}: ActivityScheduleInlineEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getActivityScheduleItems(projectId, documentId);
      setItems(data || []);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch schedule items.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchItems();
    }
  }, [isOpen, projectId, documentId]);

  const totalWeight = items.reduce((acc, item) => acc + (Number(item.weight_percentage) || 0), 0);
  const totalPrice = items.reduce((acc, item) => acc + (Number(item.fixed_price) || 0), 0);

  const handleItemChange = (index: number, field: keyof ActivityItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleAddRow = () => {
    setItems([
      ...items,
      {
        activity_id: `${items.length + 1}`,
        description: 'New Activity Item',
        weight_percentage: 0.0,
        fixed_price: 0.0
      }
    ]);
  };

  const handleDeleteRow = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateActivityScheduleItems(projectId, documentId, items);
      setSuccess('Activity Schedule updated successfully.');
      setIsEditing(false);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error(err);
      setError('Failed to save activity items.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    fetchItems();
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#030305]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-[#030305] rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10 animate-scale-up relative">
        {/* Title & Toggle Button */}
        <div className="flex justify-between items-center p-6 border-b border-white/10">
          <div className="flex items-center space-x-3 text-left">
            <div className="p-2.5 bg-dark-teal-50 rounded-xl">
              <FileSpreadsheet className="w-5 h-5 text-dark-teal-800" />
            </div>
            <div>
              <h4 className="text-xl font-bold font-lexend text-white drop-shadow-md">
                Active Schedules Matrix: {documentTitle}
              </h4>
              <p className="text-sm text-gray-400 font-semibold mt-0.5">
                {items.length} items • Weight: {totalWeight.toFixed(2)}% • Price: {formatCurrency(totalPrice)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-black/40 hover:bg-white/10 text-gray-300 rounded-xl text-sm font-bold flex items-center gap-1.5 transition border border-white/10"
              >
                <Edit3 className="w-4 h-4" /> Edit Items
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-white rounded-xl hover:bg-white/5 active:scale-95 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          
          {/* Notifications */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-900/20 border border-emerald-200 text-emerald-600 text-xs font-bold rounded-xl flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center flex flex-col items-center justify-center space-y-3 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin text-dark-teal-500" />
              <span className="text-sm font-bold">Fetching active activities...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto border border-white/10 rounded-2xl bg-black/40 backdrop-blur-md">
                <table className="w-full text-left text-xs min-w-[800px]">
                  <thead className="bg-white/5 text-gray-400 font-bold uppercase tracking-wider text-[10px] border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3 w-[140px]">Activity ID</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3 w-[160px] text-right">Weight (%)</th>
                      <th className="px-4 py-3 w-[200px] text-right">Fixed Price ($)</th>
                      {isEditing && <th className="px-4 py-3 w-[80px] text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-medium text-gray-300">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition">
                        <td className="px-4 py-2">
                          {isEditing ? (
                            <input
                              type="text"
                              value={item.activity_id}
                              onChange={(e) => handleItemChange(idx, 'activity_id', e.target.value)}
                              className="w-full p-2 bg-black/50 border border-white/20 rounded-xl font-bold text-xs focus:outline-none focus:ring-2 focus:ring-dark-teal-500 shadow-inner"
                            />
                          ) : (
                            <span className="font-bold text-white bg-white/5 px-2 py-1 rounded-md border border-white/10">{item.activity_id}</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {isEditing ? (
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                              className="w-full p-2 bg-black/50 border border-white/20 rounded-xl font-bold text-xs focus:outline-none focus:ring-2 focus:ring-dark-teal-500 shadow-inner"
                            />
                          ) : (
                            <span className="text-gray-200">{item.description}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {isEditing ? (
                            <NumberInput
                              value={item.weight_percentage}
                              onChange={(val) => handleItemChange(idx, 'weight_percentage', val)}
                              className="w-24 p-2 bg-black/50 border border-white/20 rounded-xl font-bold text-xs text-right focus:outline-none focus:ring-2 focus:ring-dark-teal-500 ml-auto shadow-inner"
                            />
                          ) : (
                            <span className="font-bold text-dark-teal-300">{Number(item.weight_percentage).toFixed(2)}%</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {isEditing ? (
                            <NumberInput
                              value={item.fixed_price}
                              onChange={(val) => handleItemChange(idx, 'fixed_price', val)}
                              className="w-32 p-2 bg-black/50 border border-white/20 rounded-xl font-bold text-xs text-right focus:outline-none focus:ring-2 focus:ring-dark-teal-500 ml-auto shadow-inner"
                            />
                          ) : (
                            <span className="font-bold text-emerald-400">{formatCurrency(Number(item.fixed_price))}</span>
                          )}
                        </td>
                        {isEditing && (
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={() => handleDeleteRow(idx)}
                              className="p-1.5 text-red-500 hover:bg-red-500/20 rounded-xl transition"
                              title="Delete Row"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {items.length === 0 && !isEditing && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500 italic text-xs">
                          No schedule items found. Click Edit Items to add.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {isEditing && (
                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={handleAddRow}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-sm transition flex items-center gap-1.5 border border-white/10"
                  >
                    <Plus className="w-4 h-4" /> Add Row
                  </button>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 bg-transparent hover:bg-white/5 text-gray-400 font-bold rounded-xl text-sm transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm shadow-[0_0_15px_rgba(16,185,129,0.4)] transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Changes
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

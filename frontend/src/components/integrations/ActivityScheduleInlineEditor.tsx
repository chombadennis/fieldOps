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
}: ActivityScheduleInlineEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  return (
    <div className="bg-black/40/5 border border-white/10 rounded-3xl p-5 shadow-sm space-y-4 transition hover:shadow-md">
      {/* Title & Toggle Button */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-3 text-left focus:outline-none group"
        >
          <div className="p-2.5 bg-dark-teal-50 rounded-xl group-hover:bg-dark-teal-100 transition">
            <FileSpreadsheet className="w-5 h-5 text-dark-teal-800" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold font-lexend text-white drop-shadow-md group-hover:text-dark-teal-800 transition">
              {documentTitle}
            </h4>
            <p className="text-[10px] text-gray-400 font-semibold">
              {items.length || 'Click to view'} items • Weight: {totalWeight.toFixed(2)}% • Price: {formatCurrency(totalPrice)}
            </p>
          </div>
        </button>

        <div className="flex items-center space-x-2">
          {isOpen && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 bg-black/40/10 hover:bg-gray-150 text-gray-300 rounded-xl text-[11px] font-bold flex items-center gap-1 transition"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit Items
            </button>
          )}

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1.5 bg-black/40/10 text-gray-400 rounded-lg hover:bg-gray-150 transition"
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded view */}
      {isOpen && (
        <div className="space-y-4 pt-3 border-t border-white/10 animate-fade-in">
          
          {/* Notifications */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-xl flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center flex flex-col items-center justify-center space-y-2 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin text-neon-cyan" />
              <span className="text-xs font-medium">Fetching active activities...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto border border-white/10 rounded-2xl">
                <table className="w-full text-left text-xs min-w-[800px]">
                  <thead className="bg-black/40/10 text-gray-400 font-bold uppercase tracking-wider text-[9px] border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3 w-[140px]">Activity ID</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3 w-[160px] text-right">Weight (%)</th>
                      <th className="px-4 py-3 w-[200px] text-right">Fixed Price ($)</th>
                      {isEditing && <th className="px-4 py-3 w-[80px] text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium text-gray-300 bg-black/40">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-black/40/10/50 transition">
                        <td className="px-4 py-2">
                          {isEditing ? (
                            <input
                              type="text"
                              value={item.activity_id}
                              onChange={(e) => handleItemChange(idx, 'activity_id', e.target.value)}
                              className="w-full px-2 py-1 bg-black/40 border border-white/20 rounded-lg text-xs font-bold text-white drop-shadow-md focus:outline-none focus:border-neon-cyan"
                            />
                          ) : (
                            <span className="font-bold text-white drop-shadow-md">{item.activity_id || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {isEditing ? (
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                              className="w-full px-2 py-1 bg-black/40 border border-white/20 rounded-lg text-xs font-semibold text-gray-200 focus:outline-none focus:border-neon-cyan"
                            />
                          ) : (
                            <span className="font-semibold text-gray-300">{item.description}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {isEditing ? (
                            <NumberInput
                              value={item.weight_percentage}
                              onChange={(val) => handleItemChange(idx, 'weight_percentage', val)}
                              className="w-full px-2 py-1 bg-black/40 border border-white/20 rounded-lg text-xs font-bold text-right text-emerald-400 focus:outline-none focus:border-neon-cyan"
                            />
                          ) : (
                            <span className="font-bold text-emerald-400">{item.weight_percentage.toFixed(2)}%</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {isEditing ? (
                            <NumberInput
                              value={item.fixed_price}
                              onChange={(val) => handleItemChange(idx, 'fixed_price', val)}
                              className="w-full px-2 py-1 bg-black/40 border border-white/20 rounded-lg text-xs font-bold text-right text-neon-purple focus:outline-none focus:border-neon-cyan"
                            />
                          ) : (
                            <span className="font-bold text-neon-purple">{formatCurrency(item.fixed_price)}</span>
                          )}
                        </td>
                        {isEditing && (
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={() => handleDeleteRow(idx)}
                              className="p-1 text-red-600 bg-red-50 border border-red-100 rounded-md hover:bg-red-100 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}

                    {/* Autosum Subtotal Row */}
                    {/* Autosum Subtotal Row */}
                    <tr className="bg-transparent font-bold text-white border-t border-b border-white/20">
                      <td colSpan={2} className="px-4 py-2.5 font-lexend text-xs">
                        <div className="flex items-center space-x-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan font-mono text-[9px] shadow-[0_0_10px_rgba(0,243,255,0.2)]">∑ Subtotal</span>
                          <span className="font-extrabold text-white drop-shadow-md">{documentTitle}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-extrabold text-neon-cyan drop-shadow-sm">
                        {totalWeight.toFixed(2)}%
                      </td>
                      <td className="px-4 py-2.5 text-right font-extrabold text-neon-purple drop-shadow-sm">
                        {formatCurrency(totalPrice)}
                      </td>
                      {isEditing && <td className="bg-black/40"></td>}
                    </tr>
                  </tbody>
                </table>
              </div>

              {isEditing ? (
                <div className="flex justify-between items-center bg-black/40/10 border border-white/10 p-4 rounded-2xl">
                  <button
                    onClick={handleAddRow}
                    className="px-3 py-1.5 bg-black/40 border border-white/20 hover:bg-gray-100 text-gray-200 rounded-xl text-xs font-bold flex items-center gap-1 transition"
                  >
                    <Plus className="w-4 h-4" /> Add Row
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleCancel}
                      disabled={saving}
                      className="px-4 py-2 border border-white/20 bg-black/40 hover:bg-gray-150 text-gray-300 rounded-xl text-xs font-bold transition flex items-center gap-1 active:scale-95"
                    >
                      <X className="w-4 h-4" /> Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-5 py-2.5 bg-dark-teal-900 hover:bg-black disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 active:scale-95"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Updates
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

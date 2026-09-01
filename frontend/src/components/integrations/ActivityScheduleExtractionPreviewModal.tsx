import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, FileSpreadsheet, Save, Loader2, Plus, Trash2, Tag, ExternalLink } from 'lucide-react';

interface ActivityItem {
  activity_id: string;
  description: string;
  weight_percentage: number;
  fixed_price: number;
  values_map?: Record<string, any>;
}

interface ActivityScheduleExtractionPreviewModalProps {
  showModal: boolean;
  onClose: () => void;
  onConfirm: (items: ActivityItem[], title: string) => void;
  extractedData: any;
  isSaving: boolean;
  documentTitle?: string;
  documentUrl?: string;
  actionError?: string | null;
  onClearError?: () => void;
  actionSuccess?: string | null;
  onSuccessClose?: () => void;
}

interface NumberInputProps {
  value: number | string | null | undefined;
  onChange: (val: number) => void;
  className?: string;
  placeholder?: string;
}

const NumberInput = ({ value, onChange, className = '', placeholder = '' }: NumberInputProps) => {
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
      placeholder={placeholder}
      className={className}
    />
  );
};

export default function ActivityScheduleExtractionPreviewModal({
  showModal,
  onClose,
  onConfirm,
  extractedData,
  isSaving,
  documentTitle,
  documentUrl,
  actionError,
  onClearError,
  actionSuccess,
  onSuccessClose,
}: ActivityScheduleExtractionPreviewModalProps) {
  const [docTitle, setDocTitle] = useState('');
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [validationStatus, setValidationStatus] = useState('VALID');
  const [activeTab, setActiveTab] = useState<'matrix' | 'json' | 'dynamic_data'>('matrix');
  const [overrideMetrics, setOverrideMetrics] = useState({
    total_activities: 0,
    total_weight_percentage: 0.0,
    total_price: 0.0
  });
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  useEffect(() => {
    if (extractedData) {
      setItems(extractedData.items || []);
      setValidationIssues(extractedData.validation_issues || []);
      setValidationStatus(extractedData.validation_status || 'VALID');
      setOverrideMetrics({
        total_activities: extractedData.metrics?.total_activities || 0,
        total_weight_percentage: extractedData.metrics?.total_weight_percentage || 0.0,
        total_price: extractedData.metrics?.total_price || 0.0
      });
      if (extractedData.column_mapping) {
        setColumnMapping(extractedData.column_mapping);
      }
    }
    if (documentTitle) {
      setDocTitle(documentTitle);
    }
  }, [extractedData, documentTitle]);

  if (!showModal) return null;

  // Derived totals for reference, but user edits the override metrics directly
  const computedTotalWeight = items.reduce((acc, item) => acc + (Number(item.weight_percentage) || 0), 0);
  const computedTotalPrice = items.reduce((acc, item) => acc + (Number(item.fixed_price) || 0), 0);

  // Compute dynamic columns from values_map
  const dynamicKeys = Array.from(
    new Set(
      items.flatMap(item => Object.keys(item.values_map || {}))
    )
  );

  const handleItemChange = (index: number, field: keyof ActivityItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    
    // Two-way sync: Update the raw values_map if we have a mapping for this field
    const mappedRawKey = columnMapping[field];
    if (mappedRawKey) {
       updated[index].values_map = { ...(updated[index].values_map || {}), [mappedRawKey]: value };
    }
    
    setItems(updated);
  };

  const handleDynamicChange = (index: number, rawKey: string, value: any) => {
    const updated = [...items];
    updated[index].values_map = { ...(updated[index].values_map || {}), [rawKey]: value };
    
    // Two-way sync: Update the main field if this rawKey maps to one
    const mainField = Object.keys(columnMapping).find(k => columnMapping[k] === rawKey);
    if (mainField) {
      (updated[index] as any)[mainField] = value;
    }
    
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        activity_id: `${items.length + 1}`,
        description: 'New Activity Description',
        weight_percentage: 0.0,
        fixed_price: 0.0
      }
    ]);
  };

  const handleDeleteItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const handleSave = () => {
    onConfirm(items, docTitle || 'Activity Schedule');
  };

  return (
    <div className="fixed inset-0 bg-dark-teal-950/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-fade-in">
      <div className="bg-slate-900 rounded-3xl w-full max-w-5xl shadow-2xl border border-gray-150 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-dark-teal-950 via-dark-teal-900 to-indigo-950 p-6 text-white flex justify-between items-center flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-2xl border border-white/10">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">AI Pre-Scan Validator</span>
              <h3 className="text-base font-bold font-lexend mt-0.5">Validate Activity Schedule Extraction</h3>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Error Overlay */}
        {actionError && (
          <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in rounded-3xl">
            <div className="bg-slate-900 border border-red-200 shadow-xl rounded-2xl p-8 max-w-md w-full text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-5">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Save Failed</h3>
              <p className="text-sm text-slate-400 mb-8 leading-relaxed">
                {actionError}
              </p>
              <button
                onClick={onClearError}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-md transition active:scale-95"
              >
                Acknowledge & Try Again
              </button>
            </div>
          </div>
        )}
        
        {/* Success Overlay */}
        {actionSuccess && (
          <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in rounded-3xl">
            <div className="bg-slate-900 border border-emerald-200 shadow-xl rounded-2xl p-8 max-w-md w-full text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-5">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Success!</h3>
              <p className="text-sm text-slate-400 mb-8 leading-relaxed">
                {actionSuccess}
              </p>
              <button
                onClick={onSuccessClose}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md transition active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Metadata Grid */}
          <div className="bg-slate-800/50 border border-gray-150 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Document Title / Name</label>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="Enter document title..."
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700/50 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-dark-teal-500/20 focus:border-dark-teal-500 transition shadow-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Source Document URL</label>
              <div className="flex items-center space-x-2 pt-1">
                {documentUrl ? (
                  <a
                    href={documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 rounded-xl text-xs font-bold transition"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>View Original Document</span>
                  </a>
                ) : (
                  <span className="text-xs font-medium text-slate-400 italic">No cloud link available</span>
                )}
              </div>
            </div>
          </div>

          {/* AI Pre-scan Warnings & Notices */}
          {validationStatus !== 'VALID' && validationIssues.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2 text-amber-900 font-medium">
              <div className="flex items-center space-x-2 text-xs font-bold text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>AI Validation Auditor Notice ({validationStatus}):</span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-amber-900/90 space-y-1 pl-1">
                {validationIssues.map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Metrics summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-800/50/70 p-4 rounded-2xl border border-gray-150 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Activities</span>
              <NumberInput
                value={overrideMetrics.total_activities}
                onChange={(val) => setOverrideMetrics(prev => ({ ...prev, total_activities: val }))}
                className="w-full bg-transparent text-base font-bold font-lexend text-white focus:outline-none"
              />
            </div>
            <div className="bg-emerald-900/20/40 p-4 rounded-2xl border border-emerald-150 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Total Weight Percentage</span>
              <div className="flex items-center">
                <NumberInput
                  value={overrideMetrics.total_weight_percentage}
                  onChange={(val) => setOverrideMetrics(prev => ({ ...prev, total_weight_percentage: val }))}
                  className="w-full bg-transparent text-base font-bold font-lexend text-emerald-100 focus:outline-none"
                />
                <span className="text-emerald-900 font-bold ml-1">%</span>
              </div>
            </div>
            <div className="bg-indigo-50/40 p-4 rounded-2xl border border-indigo-150 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Total Fixed Price</span>
              <div className="flex items-center">
                <span className="text-indigo-200 font-bold mr-1">$</span>
                <NumberInput
                  value={overrideMetrics.total_price}
                  onChange={(val) => setOverrideMetrics(prev => ({ ...prev, total_price: val }))}
                  className="w-full bg-transparent text-base font-bold font-lexend text-indigo-950 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-4 border-b border-slate-700/50">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`py-2 px-1 border-b-2 text-sm font-bold transition-colors ${
                activeTab === 'matrix' ? 'border-dark-teal-600 text-dark-teal-900' : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              Extracted Activities Matrix
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`py-2 px-1 border-b-2 text-sm font-bold transition-colors ${
                activeTab === 'json' ? 'border-indigo-600 text-indigo-200' : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              AI Diagnostic Metadata
            </button>
            <button
              onClick={() => setActiveTab('dynamic_data')}
              className={`py-2 px-1 border-b-2 text-sm font-bold transition-colors ${
                activeTab === 'dynamic_data' ? 'border-amber-600 text-amber-900' : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              Additional Data Matrix
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'matrix' ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold font-lexend text-slate-200">Review & Edit Items</h4>
                <button
                  onClick={handleAddItem}
                  className="px-3 py-1.5 bg-dark-teal-50 border border-dark-teal-100 hover:bg-dark-teal-100 text-dark-teal-900 rounded-xl text-[11px] font-bold flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Row
                </button>
              </div>

              <div className="overflow-x-auto border border-gray-150 rounded-2xl">
                <table className="w-full text-left text-xs min-w-[800px]">
                  <thead className="bg-slate-800/50 text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-slate-700/50">
                    <tr>
                      <th className="px-4 py-3 w-[140px]">Activity ID</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3 w-[160px] text-right">Weight (%)</th>
                      <th className="px-4 py-3 w-[200px] text-right">Fixed Price ($)</th>
                      <th className="px-4 py-3 w-[80px] text-center">Actions</th>
                    </tr>
                  </thead>
                <tbody className="divide-y divide-gray-150 text-slate-300 font-medium bg-slate-900">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/50/50 transition">
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={item.activity_id}
                          onChange={(e) => handleItemChange(idx, 'activity_id', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-dark-teal-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-xs font-semibold text-slate-200 focus:outline-none focus:border-dark-teal-500"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <NumberInput
                          value={item.weight_percentage}
                          onChange={(val) => handleItemChange(idx, 'weight_percentage', val)}
                          className="w-full px-2.5 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-xs font-bold text-right text-emerald-900 focus:outline-none focus:border-dark-teal-500"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <NumberInput
                          value={item.fixed_price}
                          onChange={(val) => handleItemChange(idx, 'fixed_price', val)}
                          className="w-full px-2.5 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-xs font-bold text-right text-indigo-200 focus:outline-none focus:border-dark-teal-500"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => handleDeleteItem(idx)}
                          className="p-1.5 bg-red-50 text-red-600 border border-red-100 rounded-lg hover:bg-red-100 hover:text-red-700 transition"
                          title="Delete Row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400 font-semibold italic">
                        No activities extracted yet. Click "Add Row" to start manually.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          ) : activeTab === 'json' ? (
            <div className="bg-slate-900 border border-gray-150 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/50 border-b border-gray-150 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                  <tr>
                    <th className="px-6 py-3 w-1/3">Property / Metric</th>
                    <th className="px-6 py-3 w-2/3">Extracted Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-slate-300">
                  <tr className="hover:bg-slate-800/50/50">
                    <td className="px-6 py-3 text-slate-400 font-bold">Document Type Identified</td>
                    <td className="px-6 py-3">{extractedData?.identified_document_type || 'Unknown'}</td>
                  </tr>
                  <tr className="hover:bg-slate-800/50/50">
                    <td className="px-6 py-3 text-slate-400 font-bold">Is Activity Schedule</td>
                    <td className="px-6 py-3">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${extractedData?.is_activity_schedule_document ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                        {extractedData?.is_activity_schedule_document ? 'TRUE' : 'FALSE'}
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-800/50/50">
                    <td className="px-6 py-3 text-slate-400 font-bold">AI Validation Status</td>
                    <td className="px-6 py-3">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                        extractedData?.validation_status === 'VALID' ? 'bg-emerald-100 text-emerald-800' : 
                        extractedData?.validation_status === 'WARNING' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {extractedData?.validation_status || 'UNKNOWN'}
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-800/50/50">
                    <td className="px-6 py-3 text-slate-400 font-bold">AI Confidence Score</td>
                    <td className="px-6 py-3">
                      {extractedData?.validation_score ? `${(extractedData.validation_score * 100).toFixed(0)}%` : 'N/A'}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-800/50/50">
                    <td className="px-6 py-3 text-slate-400 font-bold">Total Items Parsed</td>
                    <td className="px-6 py-3">{extractedData?.items?.length || 0}</td>
                  </tr>
                  {extractedData?.validation_issues && extractedData.validation_issues.length > 0 && (
                    <tr className="hover:bg-slate-800/50/50">
                      <td className="px-6 py-3 text-slate-400 font-bold align-top">Diagnostic Issues</td>
                      <td className="px-6 py-3">
                        <ul className="list-disc list-inside space-y-1 text-amber-700">
                          {extractedData.validation_issues.map((issue: string, idx: number) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold font-lexend text-slate-200">Dynamic JSONB Columns</h4>
              </div>

              <div className="overflow-x-auto border border-gray-150 rounded-2xl">
                <table className="w-full text-left text-xs min-w-[800px]">
                  <thead className="bg-amber-50 text-amber-700 font-bold uppercase tracking-wider text-[9px] border-b border-amber-100">
                    <tr>
                      <th className="px-4 py-3 w-[140px]">Activity ID</th>
                      <th className="px-4 py-3 min-w-[200px]">Description</th>
                      {dynamicKeys.map(key => (
                        <th key={key} className="px-4 py-3 min-w-[150px]">{key}</th>
                      ))}
                      {dynamicKeys.length === 0 && (
                         <th className="px-4 py-3">No additional data extracted</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 text-slate-300 font-medium bg-slate-900">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/50/50 transition">
                        <td className="px-4 py-2 font-bold">{item.activity_id}</td>
                        <td className="px-4 py-2 text-slate-400">{item.description}</td>
                        {dynamicKeys.map(key => (
                          <td key={key} className="px-4 py-2">
                            <input
                              type="text"
                              value={item.values_map?.[key] || ''}
                              onChange={(e) => {
                                handleDynamicChange(idx, key, e.target.value);
                              }}
                              className="w-full px-2.5 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-500"
                            />
                          </td>
                        ))}
                        {dynamicKeys.length === 0 && (
                          <td className="px-4 py-2 text-gray-400 italic">N/A</td>
                        )}
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={2 + Math.max(1, dynamicKeys.length)} className="px-4 py-8 text-center text-gray-400 font-semibold italic">
                          No activities available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="bg-slate-800/50 border-t border-gray-150 p-6 flex justify-between items-center flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-slate-700/50 bg-slate-900 hover:bg-gray-150 text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1 active:scale-95"
          >
            Cancel
          </button>
          
          <button
            onClick={handleSave}
            disabled={isSaving || items.length === 0}
            className="px-6 py-2.5 bg-dark-teal-900 hover:bg-black disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 active:scale-95"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save & Commit to database
          </button>
        </div>
      </div>
    </div>
  );
}

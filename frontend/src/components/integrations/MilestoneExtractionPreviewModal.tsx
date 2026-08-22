import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, FileSpreadsheet, Save, Loader2, Plus, Trash2, ExternalLink } from 'lucide-react';

interface MilestoneClaimItem {
  activity_id: string;
  description: string;
  percentage_complete_this_period: number;
  amount_claimed_this_period: number;
  values_map?: Record<string, any>;
}

interface MilestoneClaimMetrics {
  gross_amount_claimed: number;
  retention_deducted: number;
  net_amount_due: number;
  values_map?: Record<string, any>;
}

interface MilestoneExtractionPreviewModalProps {
  showModal: boolean;
  onClose: () => void;
  onConfirm: (metrics: MilestoneClaimMetrics, items: MilestoneClaimItem[], title: string) => void;
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

export default function MilestoneExtractionPreviewModal({
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
}: MilestoneExtractionPreviewModalProps) {
  const [docTitle, setDocTitle] = useState('');
  const [items, setItems] = useState<MilestoneClaimItem[]>([]);
  const [metrics, setMetrics] = useState<MilestoneClaimMetrics>({
    gross_amount_claimed: 0,
    retention_deducted: 0,
    net_amount_due: 0,
    values_map: {}
  });
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [validationStatus, setValidationStatus] = useState('VALID');
  const [activeTab, setActiveTab] = useState<'matrix' | 'json' | 'dynamic_data'>('matrix');
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  useEffect(() => {
    if (extractedData) {
      setItems(extractedData.items || []);
      setValidationIssues(extractedData.validation_issues || []);
      setValidationStatus(extractedData.validation_status || 'VALID');
      
      if (extractedData.metrics) {
        setMetrics({
          gross_amount_claimed: extractedData.metrics.gross_amount_claimed || 0,
          retention_deducted: extractedData.metrics.retention_deducted || 0,
          net_amount_due: extractedData.metrics.net_amount_due || 0,
          values_map: extractedData.metrics.values_map || {}
        });
      }
      
      if (extractedData.column_mapping) {
        setColumnMapping(extractedData.column_mapping);
      }
    }
    if (documentTitle) {
      setDocTitle(documentTitle);
    }
  }, [extractedData, documentTitle]);

  if (!showModal) return null;

  // Compute dynamic keys for row items (Child JSONB)
  const itemDynamicKeys = Array.from(
    new Set(
      items.flatMap(item => Object.keys(item.values_map || {}))
    )
  );

  // Compute dynamic keys for metrics (Parent JSONB)
  const metricDynamicKeys = Object.keys(metrics.values_map || {});

  const handleMetricChange = (field: keyof MilestoneClaimMetrics, value: any) => {
    setMetrics(prev => {
      const updated = { ...prev, [field]: value };
      
      // Two-way sync: update values_map if there is a mapping
      // Note: We're making an assumption here that standard Cover Page fields map to similar keys if needed
      // If we wanted exact mapping we could add it to column_mapping too.
      // But typically, the fields are known.
      return updated;
    });
  };

  const handleMetricDynamicChange = (rawKey: string, value: any) => {
    setMetrics(prev => {
      const updated = { ...prev };
      updated.values_map = { ...(updated.values_map || {}), [rawKey]: value };
      return updated;
    });
  };

  const handleItemChange = (index: number, field: keyof MilestoneClaimItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    
    // Two-way sync: Update the raw values_map if we have a mapping for this field
    const mappedRawKey = columnMapping[field];
    if (mappedRawKey) {
       updated[index].values_map = { ...(updated[index].values_map || {}), [mappedRawKey]: value };
    }
    
    setItems(updated);
  };

  const handleItemDynamicChange = (index: number, rawKey: string, value: any) => {
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
        description: 'New Activity',
        percentage_complete_this_period: 0.0,
        amount_claimed_this_period: 0.0
      }
    ]);
  };

  const handleDeleteItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleSave = () => {
    onConfirm(metrics, items, docTitle || 'Milestone Claim');
  };

  return (
    <div className="fixed inset-0 bg-dark-teal-950/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl border border-gray-150 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-dark-teal-950 via-dark-teal-900 to-indigo-950 p-6 text-white flex justify-between items-center flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-2xl border border-white/10">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Extraction Validator</span>
              <h3 className="text-base font-bold font-lexend mt-0.5">Validate Milestone Claim Extraction</h3>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Error Overlay */}
        {actionError && (
          <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in rounded-3xl">
            <div className="bg-white border border-red-200 shadow-xl rounded-2xl p-8 max-w-md w-full text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-5">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Save Failed</h3>
              <p className="text-sm text-gray-600 mb-8 leading-relaxed">
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
            <div className="bg-white border border-emerald-200 shadow-xl rounded-2xl p-8 max-w-md w-full text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-5">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Success!</h3>
              <p className="text-sm text-gray-600 mb-8 leading-relaxed">
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
          <div className="bg-gray-50 border border-gray-150 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Document Title / Name</label>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="Enter document title..."
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-dark-teal-500/20 focus:border-dark-teal-500 transition shadow-xs"
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
                  <span className="text-xs font-medium text-gray-500 italic">No cloud link available</span>
                )}
              </div>
            </div>
          </div>

          {/* AI Pre-scan Warnings & Notices */}
          {validationStatus !== 'VALID' && validationIssues.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2 text-amber-900 font-medium">
              <div className="flex items-center space-x-2 text-xs font-bold text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Validation Notice ({validationStatus}):</span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-amber-900/90 space-y-1 pl-1">
                {validationIssues.map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Tabs */}
          <div className="flex space-x-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`py-2 px-1 border-b-2 text-sm font-bold transition-colors ${
                activeTab === 'matrix' ? 'border-dark-teal-600 text-dark-teal-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Main Summary & Strict Matrix
            </button>
            <button
              onClick={() => setActiveTab('dynamic_data')}
              className={`py-2 px-1 border-b-2 text-sm font-bold transition-colors ${
                activeTab === 'dynamic_data' ? 'border-amber-600 text-amber-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              All Raw Data (JSONB)
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`py-2 px-1 border-b-2 text-sm font-bold transition-colors ${
                activeTab === 'json' ? 'border-indigo-600 text-indigo-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Diagnostic Metadata
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'matrix' ? (
            <div className="space-y-6">
              
              {/* Unified Matrix Table */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold font-lexend text-gray-800">Unified Extracted Matrix (Editable)</h4>

                  <button
                    onClick={handleAddItem}
                    className="px-3 py-1.5 bg-dark-teal-50 border border-dark-teal-100 hover:bg-dark-teal-100 text-dark-teal-900 rounded-xl text-[11px] font-bold flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Row
                  </button>
                </div>

                <div className="overflow-x-auto border border-gray-150 rounded-2xl shadow-sm">
                  <table className="w-full text-left text-xs min-w-[800px]">
                    <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-[9px] border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3 w-[140px]">Activity ID</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3 w-[160px] text-right">% Complete</th>
                        <th className="px-4 py-3 w-[200px] text-right">Amount Claimed ($)</th>
                        <th className="px-4 py-3 w-[80px] text-center">Actions</th>
                      </tr>
                    </thead>
                  <tbody className="divide-y divide-gray-150 text-gray-700 font-medium bg-white">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition">
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.activity_id}
                            onChange={(e) => handleItemChange(idx, 'activity_id', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-900 focus:outline-none focus:border-dark-teal-500"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:border-dark-teal-500"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <NumberInput
                            value={item.percentage_complete_this_period}
                            onChange={(val) => handleItemChange(idx, 'percentage_complete_this_period', val)}
                            className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-right text-emerald-900 focus:outline-none focus:border-dark-teal-500"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <NumberInput
                            value={item.amount_claimed_this_period}
                            onChange={(val) => handleItemChange(idx, 'amount_claimed_this_period', val)}
                            className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-right text-indigo-900 focus:outline-none focus:border-dark-teal-500"
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
                    
                    {/* Unified Document Totals */}
                    <tr className="hover:bg-gray-50/50 transition">
                      <td className="px-4 py-2 font-bold text-gray-500 text-center">-</td>
                      <td className="px-4 py-2 font-bold text-gray-900">Gross Amount Claimed</td>
                      <td className="px-4 py-2 text-right"></td>
                      <td className="px-4 py-2 text-right">
                        <NumberInput
                          value={metrics.gross_amount_claimed}
                          onChange={(val) => handleMetricChange('gross_amount_claimed', val)}
                          className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-right text-gray-900 focus:outline-none focus:border-dark-teal-500"
                        />
                      </td>
                      <td className="px-4 py-2"></td>
                    </tr>
                    <tr className="hover:bg-gray-50/50 transition">
                      <td className="px-4 py-2 font-bold text-gray-500 text-center">-</td>
                      <td className="px-4 py-2 font-bold text-gray-900">Retention Deducted</td>
                      <td className="px-4 py-2 text-right"></td>
                      <td className="px-4 py-2 text-right">
                        <NumberInput
                          value={metrics.retention_deducted}
                          onChange={(val) => handleMetricChange('retention_deducted', val)}
                          className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-right text-gray-900 focus:outline-none focus:border-dark-teal-500"
                        />
                      </td>
                      <td className="px-4 py-2"></td>
                    </tr>
                    <tr className="hover:bg-gray-50/50 transition">
                      <td className="px-4 py-2 font-bold text-gray-500 text-center">-</td>
                      <td className="px-4 py-2 font-bold text-gray-900">Net Amount Due</td>
                      <td className="px-4 py-2 text-right"></td>
                      <td className="px-4 py-2 text-right">
                        <NumberInput
                          value={metrics.net_amount_due}
                          onChange={(val) => handleMetricChange('net_amount_due', val)}
                          className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-right text-gray-900 focus:outline-none focus:border-dark-teal-500"
                        />
                      </td>
                      <td className="px-4 py-2"></td>
                    </tr>

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
            </div>
          ) : activeTab === 'json' ? (
            <div className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-150 text-gray-500 font-bold uppercase tracking-wider text-[9px]">
                  <tr>
                    <th className="px-6 py-3 w-1/3">Property / Metric</th>
                    <th className="px-6 py-3 w-2/3">Extracted Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  <tr className="hover:bg-gray-50/50">
                    <td className="px-6 py-3 text-gray-500 font-bold">Document Type Identified</td>
                    <td className="px-6 py-3">{extractedData?.identified_document_type || 'Unknown'}</td>
                  </tr>
                  <tr className="hover:bg-gray-50/50">
                    <td className="px-6 py-3 text-gray-500 font-bold">Is Milestone Claim</td>
                    <td className="px-6 py-3">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${extractedData?.is_milestone_document ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                        {extractedData?.is_milestone_document ? 'TRUE' : 'FALSE'}
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50/50">
                    <td className="px-6 py-3 text-gray-500 font-bold">Validation Status</td>
                    <td className="px-6 py-3">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                        extractedData?.validation_status === 'VALID' ? 'bg-emerald-100 text-emerald-800' : 
                        extractedData?.validation_status === 'WARNING' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {extractedData?.validation_status || 'UNKNOWN'}
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50/50">
                    <td className="px-6 py-3 text-gray-500 font-bold">Confidence Score</td>
                    <td className="px-6 py-3">
                      {extractedData?.validation_score ? `${(extractedData.validation_score * 100).toFixed(0)}%` : 'N/A'}
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50/50">
                    <td className="px-6 py-3 text-gray-500 font-bold">Total Items Parsed</td>
                    <td className="px-6 py-3">{extractedData?.items?.length || 0}</td>
                  </tr>
                  {extractedData?.validation_issues && extractedData.validation_issues.length > 0 && (
                    <tr className="hover:bg-gray-50/50">
                      <td className="px-6 py-3 text-gray-500 font-bold align-top">Diagnostic Issues</td>
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
            <div className="space-y-6">
              {/* Unified Raw Data Table (All JSONB) */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold font-lexend text-gray-800">All Raw JSONB Data (Document & Row Level)</h4>
                <div className="overflow-x-auto border border-amber-200 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-amber-50 text-amber-700 font-bold uppercase tracking-wider text-[9px] border-b border-amber-100">
                      <tr>
                        <th className="px-4 py-3 w-[140px]">Source / Ref</th>
                        <th className="px-4 py-3 w-1/3">Raw JSON Key</th>
                        <th className="px-4 py-3 w-1/2">Raw Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100 text-gray-700 font-medium bg-white">
                      
                      {/* Document Level JSONB */}
                      {metricDynamicKeys.length > 0 && (
                        <tr className="bg-amber-50/50">
                          <td colSpan={3} className="px-4 py-2 text-[9px] font-extrabold uppercase tracking-widest text-amber-800">Document Totals / Header</td>
                        </tr>
                      )}
                      {metricDynamicKeys.map(key => (
                        <tr key={`doc-${key}`} className="hover:bg-amber-50/30 transition">
                          <td className="px-4 py-2 text-xs font-bold text-gray-400">Cover Page</td>
                          <td className="px-4 py-2 font-bold text-gray-800">{key}</td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={metrics.values_map?.[key] || ''}
                              onChange={(e) => handleMetricDynamicChange(key, e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:border-amber-500"
                            />
                          </td>
                        </tr>
                      ))}

                      {/* Row Level JSONB */}
                      {items.length > 0 && itemDynamicKeys.length > 0 && (
                        <tr className="bg-amber-50/50">
                          <td colSpan={3} className="px-4 py-2 text-[9px] font-extrabold uppercase tracking-widest text-amber-800">Activity Rows Matrix</td>
                        </tr>
                      )}
                      {items.flatMap((item, idx) => {
                        return itemDynamicKeys.filter(key => item.values_map?.[key] !== undefined).map(key => (
                          <tr key={`row-${idx}-${key}`} className="hover:bg-amber-50/30 transition">
                            <td className="px-4 py-2 text-xs font-bold text-gray-600">Activity ID: {item.activity_id}</td>
                            <td className="px-4 py-2 font-bold text-gray-800">{key}</td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={item.values_map?.[key] || ''}
                                onChange={(e) => handleItemDynamicChange(idx, key, e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:border-amber-500"
                              />
                            </td>
                          </tr>
                        ));
                      })}

                      {metricDynamicKeys.length === 0 && itemDynamicKeys.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-gray-400 font-semibold italic">
                            No additional raw JSON data extracted.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="bg-gray-50 border-t border-gray-150 p-6 flex justify-between items-center flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-gray-200 bg-white hover:bg-gray-150 text-gray-700 rounded-xl text-xs font-bold transition flex items-center gap-1 active:scale-95"
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

import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, FileSpreadsheet, ChevronRight, FileText, Loader2, Save, ExternalLink } from 'lucide-react';

interface IpcExtractionPreviewModalProps {
  showModal: boolean;
  onClose: () => void;
  onConfirm: (finalData: any) => void;
  extractedData: any;
  isSaving: boolean;
  documentUrl?: string;
}

export default function IpcExtractionPreviewModal({
  showModal,
  onClose,
  onConfirm,
  extractedData,
  isSaving,
  documentUrl
}: IpcExtractionPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<'main' | 'advance' | 'boq'>('main');
  const [editableMetrics, setEditableMetrics] = useState(extractedData?.ipc_summary?.metrics || {});

  // Sync state when new data comes in and format with commas
  React.useEffect(() => {
    if (extractedData?.ipc_summary?.metrics) {
      const formatted: any = {};
      for (const [k, v] of Object.entries(extractedData.ipc_summary.metrics || {})) {
        formatted[k] = formatCurrency(v as any);
      }
      if (extractedData.ipc_summary.certificate_number && !formatted.certificate_number) {
        formatted.certificate_number = extractedData.ipc_summary.certificate_number;
      }
      setEditableMetrics(formatted);
    }
  }, [extractedData]);

  if (!showModal) return null;

  const handleMetricChange = (key: string, value: string) => {
    if (key === 'certificate_number') {
      value = value.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 15);
    }
    // Allow the user to type freely (strings)
    setEditableMetrics((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // Clean up all formatted strings back to numbers before saving
    const cleanMetrics: any = {};
    for (const [k, v] of Object.entries(editableMetrics)) {
      if (k === 'certificate_number') {
        cleanMetrics[k] = String(v).trim();
      } else {
        cleanMetrics[k] = parseFloat(String(v).replace(/[^0-9.-]+/g, '')) || 0;
      }
    }

    onConfirm({
      ...extractedData,
      ipc_summary: {
        ...(extractedData?.ipc_summary || {}),
        metrics: cleanMetrics
      }
    });
  };

  const formatCurrency = (val: number | string | undefined | null) => {
    if (val === undefined || val === null || val === '') return '';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '';
    // Round to 3 decimal places as requested
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(num);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-gray-100 max-h-[90vh] flex flex-col relative overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 p-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-4">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/20">
              <FileSpreadsheet className="w-6 h-6 text-indigo-100" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white tracking-wide flex items-center">
                Extracted IPC Data
                <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] uppercase font-bold tracking-widest">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Verified IPC
                </span>
              </h2>
              <p className="text-xs text-indigo-100 mt-1.5 max-w-2xl leading-relaxed">
                The system has extracted these figures from your linked document.
                <strong className="text-white"> Please carefully cross-check and confirm the figures below before saving them to the database.</strong>
                This ensures your centralized ledgers remain 100% accurate.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {documentUrl && (
              <a
                href={documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center transition-colors border border-white/20 shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-2" />
                Open Source Document
              </a>
            )}
            <button onClick={onClose} className="p-2 text-indigo-200 hover:text-white hover:bg-white/10 rounded-xl transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Multi-Tab Navigation */}
        <div className="flex border-b border-gray-100 bg-gray-50/50 px-4 flex-shrink-0">
          <button
            onClick={() => setActiveTab('main')}
            className={`py-3.5 px-5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab === 'main' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
          >
            Main IPC Summary
          </button>
          <button
            onClick={() => setActiveTab('advance')}
            className={`py-3.5 px-5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center space-x-2 ${activeTab === 'advance' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
          >
            <span>Advance Recovery</span>
            {!extractedData?.advance_recovery?.found && (
              <span className="w-2 h-2 rounded-full bg-gray-300" title="Not detected" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('boq')}
            className={`py-3.5 px-5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center space-x-2 ${activeTab === 'boq' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
          >
            <span>BoQ Grand Summary</span>
            {!extractedData?.boq_grand_summary?.found && (
              <span className="w-2 h-2 rounded-full bg-gray-300" title="Not detected" />
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">

          {extractedData?.legacy_exists && (
            <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-orange-800">Legacy Data Detected</h4>
                <p className="text-xs text-orange-700 mt-1">
                  An IPC with Certificate No. {extractedData.ipc_summary?.certificate_number || 'this number'} already exists. Clicking <strong>Confirm & Save</strong> will update the legacy extracted snapshot and overwrite the core database values. Your team's manual valuation ledgers will remain safely intact.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'main' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-gray-800">Financial Metrics</h3>
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Editable Grid</span>
                </div>
                <div className="grid grid-cols-2 gap-px bg-gray-200">

                  {/* Grid Cells */}
                  {[
                    { key: 'certificate_number', label: 'Certificate Number' },
                    { key: 'gross_amount_claimed', label: 'Gross Amount Claimed' },
                    { key: 'gross_amount_certified', label: 'Gross Amount Certified' },
                    { key: 'materials_on_site', label: 'Materials on Site' },
                    { key: 'price_variation', label: 'Price Variation' },
                    { key: 'vat_amount', label: 'VAT Amount (16%)' },
                    { key: 'retention_deducted', label: 'Retention Deducted' },
                    { key: 'advance_recovered', label: 'Advance Recovered' },
                    { key: 'withholding_tax', label: 'Withholding Tax' },
                    { key: 'withholding_vat', label: 'Withholding VAT' },
                    { key: 'total_deductions', label: 'Total Deductions' },
                    { key: 'net_amount_due', label: 'Net Amount Due' },
                  ].map((field) => (
                    <div key={field.key} className="bg-white p-4 flex justify-between items-center group">
                      <span className="text-xs font-semibold text-gray-600">{field.label}</span>
                      <div className="relative">
                        {field.key !== 'certificate_number' && (
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
                        )}
                        <input
                          type="text"
                          value={editableMetrics[field.key] !== undefined ? editableMetrics[field.key] : ''}
                          onChange={(e) => handleMetricChange(field.key, e.target.value)}
                          onBlur={(e) => {
                            if (field.key === 'certificate_number') return;
                            const num = parseFloat(e.target.value.replace(/[^0-9.-]+/g, '')) || 0;
                            handleMetricChange(field.key, formatCurrency(num));
                          }}
                          className={`w-48 py-1.5 px-3 ${field.key !== 'certificate_number' ? 'pl-7 text-right' : 'text-left'} text-sm font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all hover:bg-gray-100 group-hover:border-indigo-300`}
                        />
                      </div>
                    </div>
                  ))}

                </div>
              </div>
            </div>
          )}

          {activeTab === 'advance' && (
            <div className="animate-fade-in h-full flex flex-col items-center justify-center text-center">
              {extractedData?.advance_recovery?.found ? (
                <div className="w-full h-full overflow-y-auto border border-gray-200 rounded-xl bg-white shadow-sm">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-gray-600">Description</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(extractedData?.advance_recovery?.raw_breakdown || []).map((row: any, i: number) => (
                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-800">{row.description || '—'}</td>
                          <td className="px-4 py-3 text-gray-800 font-bold text-right">{formatCurrency(row.amount)}</td>
                        </tr>
                      ))}
                      {(extractedData?.advance_recovery?.raw_breakdown?.length === 0) && (
                        <tr>
                          <td colSpan={2} className="px-4 py-8 text-center text-gray-500 text-sm italic">
                            No row items found in this sheet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 border-2 border-dashed border-gray-200 rounded-2xl bg-white max-w-sm w-full">
                  <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6 text-gray-400" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-700 mb-1">Sheet Not Detected</h3>
                  <p className="text-xs text-gray-500">The optional Advance Recovery sheet was not found in this document.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'boq' && (
            <div className="animate-fade-in h-full flex flex-col items-center justify-center text-center">
              {extractedData?.boq_grand_summary?.found ? (
                <div className="w-full h-full overflow-y-auto border border-gray-200 rounded-xl bg-white shadow-sm">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-gray-600 w-24">Bill No</th>
                        <th className="px-4 py-3 font-semibold text-gray-600">Description</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 text-right">Tender Amount</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 text-right">Total To Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(extractedData?.boq_grand_summary?.data || []).map((row: any, i: number) => (
                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-500 font-mono text-xs">{row.bill_no || '—'}</td>
                          <td className="px-4 py-3 text-gray-800 font-medium">{row.description || '—'}</td>
                          <td className="px-4 py-3 text-gray-600 text-right">{formatCurrency(row.tender_amount)}</td>
                          <td className="px-4 py-3 text-indigo-700 font-bold text-right">{formatCurrency(row.total_to_date)}</td>
                        </tr>
                      ))}
                      {(extractedData?.boq_grand_summary?.data?.length === 0) && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-500 text-sm italic">
                            No row items found in this sheet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 border-2 border-dashed border-gray-200 rounded-2xl bg-white max-w-sm w-full">
                  <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6 text-gray-400" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-700 mb-1">Sheet Not Detected</h3>
                  <p className="text-xs text-gray-500">The optional BoQ Grand Summary sheet was not found in this document.</p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-gray-100 bg-white flex items-center justify-between flex-shrink-0">

          {/* Validation Warning */}
          <div className="flex-1">
            {(!editableMetrics.certificate_number || String(editableMetrics.certificate_number).trim() === '') && (
              <div className="inline-flex items-center text-red-600 text-[11px] font-bold bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                Certificate Number is empty. It must be filled first to enable saving.
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <div className="relative group/btn">
              <button
                onClick={handleSave}
                disabled={isSaving || (!editableMetrics.certificate_number || String(editableMetrics.certificate_number).trim() === '')}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all active:scale-[0.98] flex items-center space-x-2 disabled:opacity-50 disabled:bg-gray-400 disabled:shadow-none"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{isSaving ? 'Saving to Database...' : 'Confirm & Save to Database'}</span>
              </button>
              {(!editableMetrics.certificate_number || String(editableMetrics.certificate_number).trim() === '') && (
                <div className="absolute bottom-full mb-2 right-0 hidden group-hover/btn:block w-max bg-gray-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg">
                  Certificate Number is required
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

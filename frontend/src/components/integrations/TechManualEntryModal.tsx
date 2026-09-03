import React, { useState, useEffect } from 'react';
import { X, Save, FileText, ChevronDown, AlertTriangle } from 'lucide-react';

interface TechManualEntryModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (metadata: any) => void;
  initialData: {
    url: string;
    title: string;
  };
  isSubmitting?: boolean;
}

export default function TechManualEntryModal({
  show,
  onClose,
  onSubmit,
  initialData,
  isSubmitting = false
}: TechManualEntryModalProps) {
  const [formData, setFormData] = useState({
    url: '',
    title: '',
    document_type: '',
    discipline: '',
    document_number: '',
    revision: '',
    status: '',
    issue_date: '',
    originator: '',
    description: ''
  });

  useEffect(() => {
    if (show) {
      setFormData({
        url: initialData.url || '',
        title: initialData.title || '',
        document_type: '',
        discipline: '',
        document_number: '',
        revision: '',
        status: '',
        issue_date: '',
        originator: '',
        description: ''
      });
    }
  }, [show, initialData]);

  if (!show) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.url || !formData.title || !formData.document_type || !formData.discipline) {
      alert('Please fill out all required fields.');
      return;
    }
    onSubmit(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div 
        className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <FileText className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-lexend">LINK ENGINEERING DOCUMENT</h3>
              <p className="text-xs text-slate-400">Provide metadata for the selected document</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          
          {/* Permission Alert */}
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200">
              <span className="font-semibold text-amber-400">Important:</span> You are linking a file from your connected cloud drive. If you attach this document to an RFI or Submittal, you will need to grant 'View Access' via your cloud provider to team members who request it.
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Document URL <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="url"
                value={formData.url}
                readOnly
                className="w-full bg-slate-950 border border-slate-700/50 rounded-lg p-2.5 text-sm text-slate-500 focus:outline-none cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Foundation Plan"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Document Number
                </label>
                <input
                  type="text"
                  name="document_number"
                  value={formData.document_number}
                  onChange={handleChange}
                  placeholder="e.g. S-101"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Document Type <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <select
                    name="document_type"
                    value={formData.document_type}
                    onChange={handleChange}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none pr-10"
                  >
                    <option value="">Select Type...</option>
                    <option value="Drawing">Drawing</option>
                    <option value="Specification">Specification</option>
                    <option value="Calculation">Calculation</option>
                    <option value="Report">Report</option>
                    <option value="Model">3D Model / BIM</option>
                    <option value="Other">Other</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Discipline <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <select
                    name="discipline"
                    value={formData.discipline}
                    onChange={handleChange}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none pr-10"
                  >
                    <option value="">Select Discipline...</option>
                    <option value="Architectural">Architectural</option>
                    <option value="Structural">Structural</option>
                    <option value="Mechanical">Mechanical</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Plumbing">Plumbing</option>
                    <option value="Civil">Civil</option>
                    <option value="General">General / All</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Revision
                </label>
                <input
                  type="text"
                  name="revision"
                  value={formData.revision}
                  onChange={handleChange}
                  placeholder="e.g. C or 03"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Status
                </label>
                <div className="relative">
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none pr-10"
                  >
                    <option value="">Select Status...</option>
                    <option value="For Review">For Review</option>
                    <option value="Approved">Approved</option>
                    <option value="Approved with Comments">Approved with Comments</option>
                    <option value="Rejected">Rejected</option>
                    <option value="For Information">For Information</option>
                    <option value="Draft">Draft</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Issue Date
                </label>
                <input
                  type="date"
                  name="issue_date"
                  value={formData.issue_date}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Originator
                </label>
                <input
                  type="text"
                  name="originator"
                  value={formData.originator}
                  onChange={handleChange}
                  placeholder="e.g. ABC Consultants"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                placeholder="Optional description or notes..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/80 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 transition-all flex items-center space-x-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Link Document</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

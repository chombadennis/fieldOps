import React, { useState, useEffect } from 'react';
import { X, Send, Paperclip, AlertCircle, FileText, CheckCircle, HelpCircle } from 'lucide-react';

interface TechWorkflowFormProps {
  workflowType: 'rfi' | 'submittal' | 'issue';
  documents: any[];
  onClose: () => void;
  onSubmit: (data: any) => void;
  isSubmitting?: boolean;
  initialData?: any;
}

export default function TechWorkflowForm({
  workflowType,
  documents,
  onClose,
  onSubmit,
  isSubmitting = false,
  initialData = null
}: TechWorkflowFormProps) {
  const [formData, setFormData] = useState({
    subject: initialData?.values_map?.subject || '',
    content: initialData?.content || '',
    priority: initialData?.priority || 'Normal',
    assigned_to: initialData?.values_map?.assigned_to || '',
    status: initialData?.values_map?.status || 'Open',
    due_date: initialData?.values_map?.due_date || ''
  });
  
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>(initialData?.values_map?.document_ids || []);

  const toggleDocument = (id: number) => {
    setSelectedDocIds(prev => 
      prev.includes(id) ? prev.filter(docId => docId !== id) : [...prev, id]
    );
  };

  const getPlaceholders = () => {
    switch (workflowType) {
      case 'rfi': 
        return { 
          subject: 'e.g. Clarification on Foundation Grid B4', 
          desc: 'e.g. The structural drawings show a conflict at Grid B4. Please advise on how to proceed.' 
        };
      case 'submittal': 
        return { 
          subject: 'e.g. Steel Beam Material Specs', 
          desc: 'e.g. Attached are the manufacturer specifications for the Type 304 Stainless Steel beams for approval.' 
        };
      case 'issue': 
        return { 
          subject: 'e.g. Concrete Pour Defect at Zone A', 
          desc: 'e.g. The concrete poured at Zone A yesterday has visible surface cracking. Attached reference drawing for exact location.' 
        };
    }
  };

  const placeholders = getPlaceholders();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject || !formData.content) {
      alert('Subject and description are required.');
      return;
    }

    const wordCount = formData.content.trim().split(/\s+/).length;
    if (wordCount > 750) {
      alert(`Description exceeds the 750-word limit. Current count: ${wordCount}`);
      return;
    }

    // Basic frontend sanitization to strip script tags
    const sanitize = (str: string) => str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Construct the payload mapping to our Note model capabilities
    const payload = {
      content: sanitize(formData.content),
      is_issue: workflowType === 'issue',
      priority: formData.priority,
      follow_up_date: formData.due_date || null,
      document_ids: selectedDocIds,
      values_map: {
        type: workflowType,
        subject: sanitize(formData.subject),
        status: formData.status,
        assigned_to: sanitize(formData.assigned_to),
        // Auto-generate a mock ID for display purposes if new
        record_number: initialData?.values_map?.record_number || `${workflowType.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`
      }
    };
    
    onSubmit(payload);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const getHeaderInfo = () => {
    switch (workflowType) {
      case 'rfi': return { title: 'New RFI', icon: <HelpCircle className="w-5 h-5 text-amber-400" />, desc: 'Request for Information' };
      case 'submittal': return { title: 'New Submittal', icon: <CheckCircle className="w-5 h-5 text-emerald-400" />, desc: 'Submit materials or specs for approval' };
      case 'issue': return { title: 'New Issue', icon: <AlertCircle className="w-5 h-5 text-red-400" />, desc: 'Log a design flaw or clash' };
    }
  };

  const { title, icon, desc } = getHeaderInfo();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div 
        className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 rounded-lg shadow-inner border border-slate-700">
              {icon}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-lexend">{initialData ? 'Edit' : 'New'} {title}</h3>
              <p className="text-xs text-slate-400">{desc}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Subject <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                placeholder={placeholders.subject}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Assign To
                </label>
                <input
                  type="text"
                  name="assigned_to"
                  value={formData.assigned_to}
                  onChange={handleChange}
                  placeholder="e.g. Lead Engineer"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Priority
                </label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="Low">Low</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  name="due_date"
                  value={formData.due_date}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex justify-between">
                <span>Description / Details <span className="text-red-400">*</span></span>
                <span className="text-slate-500 font-normal">{formData.content.trim() ? formData.content.trim().split(/\s+/).length : 0} / 750 words</span>
              </label>
              <textarea
                name="content"
                value={formData.content}
                onChange={handleChange}
                required
                rows={5}
                placeholder={placeholders.desc}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              />
            </div>
          </div>

          {/* Document Picker */}
          <div className="border-t border-slate-800 pt-6">
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-slate-400" />
              Reference Linked Documents
            </h4>
            
            {documents.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No documents available in the workspace to reference. Link documents from the cloud first.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                {documents.map((doc: any) => {
                  const meta = doc.metadata_map || {};
                  const isSelected = selectedDocIds.includes(doc.id);
                  return (
                    <div 
                      key={doc.id}
                      onClick={() => toggleDocument(doc.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex gap-3 items-start ${
                        isSelected 
                          ? 'bg-indigo-500/20 border-indigo-500/50 shadow-inner' 
                          : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center ${
                        isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-500'
                      }`}>
                        {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate" title={doc.name}>
                          {meta.title || doc.name}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">
                          {meta.document_number ? `${meta.document_number} • ` : ''} 
                          {meta.discipline || 'General'}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
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
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit {workflowType.toUpperCase()}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

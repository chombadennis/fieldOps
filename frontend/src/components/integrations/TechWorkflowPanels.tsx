import React, { useState } from 'react';
import { HelpCircle, CheckCircle, AlertCircle, FileText, Filter, Search, Paperclip } from 'lucide-react';

interface TechWorkflowPanelsProps {
  workflowType: 'rfi' | 'submittal' | 'issue';
  notes: any[]; // These are the workflow items stored as Notes
  currentUser?: any;
  onEdit?: (note: any) => void;
  onDelete?: (noteId: number) => void;
  isDeletingId?: number | null;
}

export default function TechWorkflowPanels({ workflowType, notes, currentUser, onEdit, onDelete, isDeletingId }: TechWorkflowPanelsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Filter notes that match the current workflowType
  const typeNotes = notes.filter(n => n.values_map?.type === workflowType);

  // Extract unique statuses
  const uniqueStatuses = Array.from(new Set(typeNotes.map(n => n.values_map?.status).filter(Boolean)));

  const filteredNotes = typeNotes.filter(n => {
    const vals = n.values_map || {};
    const matchesSearch = 
      (vals.subject || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (vals.record_number || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !filterStatus || vals.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getHeaderInfo = () => {
    switch (workflowType) {
      case 'rfi': return { title: 'Requests for Information (RFIs)', icon: <HelpCircle className="w-6 h-6 text-amber-400" /> };
      case 'submittal': return { title: 'Material Submittals', icon: <CheckCircle className="w-6 h-6 text-emerald-400" /> };
      case 'issue': return { title: 'Design & Field Issues', icon: <AlertCircle className="w-6 h-6 text-red-400" /> };
    }
  };

  const { title, icon } = getHeaderInfo();

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl animate-fade-in">
      
      {/* Header & Filters */}
      <div className="p-5 border-b border-slate-800 bg-slate-900/50 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 rounded-lg shadow-inner border border-slate-700">
            {icon}
          </div>
          <h3 className="text-lg font-bold text-white font-lexend">{title}</h3>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          
          <Filter className="w-4 h-4 text-slate-400" />
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-2 focus:outline-none"
          >
            <option value="">All Statuses</option>
            {uniqueStatuses.map((s: any) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="text-xs uppercase bg-slate-800/50 text-slate-400 border-b border-slate-700">
            <tr>
              <th className="px-6 py-4 font-semibold">Number</th>
              <th className="px-6 py-4 font-semibold">Subject</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold">Priority</th>
              <th className="px-6 py-4 font-semibold">Assigned To</th>
              <th className="px-6 py-4 font-semibold">Docs</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredNotes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center opacity-30">
                    {icon}
                    <p className="mt-4 text-base">No {workflowType.toUpperCase()}s found.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredNotes.map((note) => {
                const vals = note.values_map || {};
                const attachedDocsCount = vals.document_ids?.length || 0;
                
                return (
                  <tr key={note.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-400">
                      {vals.record_number || `#${note.id}`}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-white">{vals.subject || 'Untitled'}</p>
                      <p className="text-xs text-slate-500 truncate max-w-xs mt-1">{note.content}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                        vals.status === 'Open' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        vals.status === 'Closed' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' :
                        vals.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                      }`}>
                        {vals.status || 'Draft'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {note.priority}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                      {vals.assigned_to || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {attachedDocsCount > 0 ? (
                        <span className="flex items-center gap-1.5 text-xs text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20 w-fit">
                          <Paperclip className="w-3 h-3" />
                          {attachedDocsCount}
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {currentUser?.id === note.author_id && (
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {onEdit && (
                            <button
                              onClick={() => onEdit(note)}
                              className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => onDelete(note.id)}
                              disabled={isDeletingId === note.id}
                              className="p-1.5 text-slate-400 hover:text-red-400 bg-slate-800 hover:bg-red-500/20 rounded transition-colors"
                            >
                              <AlertCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

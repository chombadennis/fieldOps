import React, { useState, useEffect } from 'react';
import { Search, ExternalLink, Filter, FileText, Eye, X } from 'lucide-react';
import { getCurrentUser } from '@/services/api';

interface TechDocumentsPanelProps {
  documents: any[];
}

export default function TechDocumentsPanel({ documents }: TechDocumentsPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDiscipline, setFilterDiscipline] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // State for inline preview
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  
  // State for current user to enforce smart conditional previews
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    getCurrentUser().then(user => setCurrentUser(user)).catch(console.error);
  }, []);

  // Extract unique filter values
  const uniqueDisciplines = Array.from(new Set(documents.map(d => d.metadata_map?.discipline).filter(Boolean)));
  const uniqueTypes = Array.from(new Set(documents.map(d => d.metadata_map?.document_type).filter(Boolean)));
  const uniqueStatuses = Array.from(new Set(documents.map(d => d.metadata_map?.status).filter(Boolean)));

  const filteredDocs = documents.filter(doc => {
    const meta = doc.metadata_map || {};
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (meta.document_number || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDiscipline = !filterDiscipline || meta.discipline === filterDiscipline;
    const matchesType = !filterType || meta.document_type === filterType;
    const matchesStatus = !filterStatus || meta.status === filterStatus;
    
    return matchesSearch && matchesDiscipline && matchesType && matchesStatus;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
      {/* Filters & Search */}
      <div className="p-5 border-b border-slate-800 bg-slate-900/50 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select 
            value={filterDiscipline} 
            onChange={(e) => setFilterDiscipline(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-2 focus:outline-none"
          >
            <option value="">All Disciplines</option>
            {uniqueDisciplines.map((d: any) => <option key={d} value={d}>{d}</option>)}
          </select>

          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-2 focus:outline-none"
          >
            <option value="">All Types</option>
            {uniqueTypes.map((t: any) => <option key={t} value={t}>{t}</option>)}
          </select>

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
              <th className="px-6 py-4 font-semibold">Document No.</th>
              <th className="px-6 py-4 font-semibold">Title</th>
              <th className="px-6 py-4 font-semibold">Discipline</th>
              <th className="px-6 py-4 font-semibold">Rev</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 text-right font-semibold">Open</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  <FileText className="w-8 h-8 mx-auto mb-3 opacity-20" />
                  No documents found matching the current filters.
                </td>
              </tr>
            ) : (
              filteredDocs.map((doc) => {
                const meta = doc.metadata_map || {};
                return (
                  <tr key={doc.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-200">
                      {meta.document_number || <span className="text-slate-600">-</span>}
                    </td>
                    <td className="px-6 py-4 font-semibold text-white">
                      <div>{meta.title || doc.name}</div>
                      {currentUser && doc.uploaded_by === currentUser.id && doc.cloud_email && (
                        <div className="text-xs text-slate-400 font-normal mt-1 flex items-center gap-1">
                          <span className="opacity-70">Source:</span> {doc.cloud_email}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {meta.discipline ? (
                        <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-md text-xs font-medium">
                          {meta.discipline}
                        </span>
                      ) : <span className="text-slate-600">-</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {meta.revision || <span className="text-slate-600">-</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {meta.status ? (
                        <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                          meta.status.toLowerCase().includes('approved') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          meta.status.toLowerCase().includes('review') ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          meta.status.toLowerCase().includes('reject') ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          'bg-slate-500/10 text-slate-300 border-slate-500/20'
                        }`}>
                          {meta.status}
                        </span>
                      ) : <span className="text-slate-600">-</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right flex justify-end gap-2">
                      {doc.file_url ? (
                        <>
                          {(!currentUser || doc.uploaded_by === currentUser.id) && (
                            <button 
                              onClick={() => setPreviewDoc(doc)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-colors"
                              title="Inline Preview"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <a 
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              if (currentUser && doc.uploaded_by !== currentUser.id) {
                                alert("You are opening a document linked by another user. If you do not have permission, Google/Microsoft will prompt you to request access.");
                              }
                            }}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:bg-slate-600 hover:text-white transition-colors"
                            title="Open in New Tab"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </>
                      ) : (
                        <span className="text-slate-600 text-xs italic mt-2">N/A</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Inline Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-900">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                  <FileText className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-lexend">{previewDoc.metadata_map?.title || previewDoc.name}</h3>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-slate-400">{previewDoc.metadata_map?.document_number || 'No Document Number'}</p>
                    {previewDoc.cloud_email && (
                      <p className="text-xs text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                        Linked via: {previewDoc.cloud_email}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <a 
                  href={previewDoc.file_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open in New Tab (Fallback)</span>
                </a>
                <button 
                  onClick={() => setPreviewDoc(null)} 
                  className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            {/* Iframe Body */}
            <div className="flex-1 bg-white relative">
              <iframe 
                src={previewDoc.file_url.includes('google.com') ? previewDoc.file_url.replace('/edit', '/preview').replace('/view', '/preview') : previewDoc.file_url} 
                className="absolute inset-0 w-full h-full border-0"
                title="Document Preview"
                allow="autoplay"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

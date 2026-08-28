import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send, AlertTriangle, FileSpreadsheet, Layers, Info, Trash2 } from 'lucide-react';
import MilestoneClaimsIntegrations from '@/components/MilestoneClaimsIntegrations';
import MilestoneClaimSheet from '@/components/MilestoneClaimSheet';
import { getDecoupledDocuments, updateProjectMilestoneClaim, deleteDecoupledDocument } from '@/services/api';

interface Note {
  id: number;
  content: string;
  department: string;
  is_issue?: boolean;
  priority?: string;
  author_name?: string;
  created_at?: string;
  documents?: any[];
}

interface Document {
  id: number;
  title: string;
  file_url: string;
  file_type?: string;
  department?: string;
  created_at?: string;
  integration_id?: number;
  claim_number?: string;
  status?: string;
  payment_status?: string;
  net_amount_due?: number;
  gross_amount_claimed?: number;
  values_map?: any;
}

interface MilestonesTabProps {
  projectId: number;
  notes: Note[];
  documents: Document[];
  onAddNote: (note: { content: string; department: string; is_issue: boolean; priority: string }) => Promise<void>;
  integrations?: any[];
  onRefresh?: () => void;
  globalLoading?: boolean;
  setGlobalLoading?: (loading: boolean) => void;
}

export default function MilestonesTab({
  projectId,
  notes = [],
  documents = [],
  onAddNote,
  integrations = [],
  onRefresh,
  globalLoading,
  setGlobalLoading,
}: MilestonesTabProps) {
  const [content, setContent] = useState('');
  const [isIssue, setIsIssue] = useState(false);
  const [priority, setPriority] = useState('Normal');
  const [posting, setPosting] = useState(false);
  const queryClient = useQueryClient();
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [claimToDelete, setClaimToDelete] = useState<any | null>(null);

  const handleDelete = async () => {
    if (!claimToDelete) return;
    setDeletingId(claimToDelete.id);
    try {
      await deleteDecoupledDocument(projectId, 'milestone_claims', claimToDelete.id);
      setClaimToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['documents', projectId, 'milestone_claims'] });
    } catch (err) {
      console.error('Failed to delete claim:', err);
      alert('Failed to delete claim');
    } finally {
      setDeletingId(null);
    }
  };

  const { data: activeDocuments = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['documents', projectId, 'milestone_claims'],
    queryFn: () => getDecoupledDocuments(projectId, 'milestone_claims')
  });

  const handlePostNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setPosting(true);
    try {
      await onAddNote({
        content,
        department: 'milestone_claims',
        is_issue: isIssue,
        priority: isIssue ? priority : 'Normal',
      });
      setContent('');
      setIsIssue(false);
      setPriority('Normal');
    } catch (err) {
      console.error(err);
    } finally {
      setPosting(false);
    }
  };

  // Filter notes for this workspace
  const filteredNotes = notes.filter((note) => note.department?.toLowerCase() === 'milestone_claims');

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header Summary Banner */}
      <div className="bg-gradient-to-r from-dark-teal-950 via-dark-teal-900 to-indigo-950 text-white rounded-3xl p-8 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="relative z-10">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Milestone Payments Module</span>
          <h2 className="text-xl font-bold font-lexend mt-1">Milestone Claims</h2>
          <p className="text-xs text-emerald-100/80 mt-1 max-w-xl leading-relaxed">
            Link and audit work progress weighting schedules. Support for Excel spreadsheets, Word templates, and visual PDF files with inline table overrides.
          </p>
        </div>
      </div>

      {/* Integrations panel */}
      <MilestoneClaimsIntegrations
        projectId={projectId}
        integrations={integrations}
        documents={documents}
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ['documents', projectId, 'milestone_claims'] });
          if (onRefresh) onRefresh();
        }}
        globalLoading={globalLoading}
        setGlobalLoading={setGlobalLoading}
      />

      {/* Main Table Breakdown List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center border-b border-gray-100 pb-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-400 font-inter">Active Milestone Claims</h3>
          <span className="text-[10px] font-bold text-dark-teal-700 bg-dark-teal-50 px-2 py-0.5 rounded border border-dark-teal-100">
            {activeDocuments.length} Claim{activeDocuments.length !== 1 ? 's' : ''} Active
          </span>
        </div>

        {loadingDocs ? (
          <div className="bg-white rounded-3xl p-12 border border-gray-100 text-center flex flex-col items-center justify-center space-y-2 text-gray-400 shadow-sm">
            <div className="w-8 h-8 border-4 border-dark-teal-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-semibold">Loading milestone claims from database...</p>
          </div>
        ) : activeDocuments.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 border border-gray-100 text-center shadow-sm space-y-3">
            <FileSpreadsheet className="w-12 h-12 text-slate-200 drop-shadow-sm mx-auto" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-gray-700">No Active Milestone Claims Found</h4>
              <p className="text-[11px] text-gray-400 max-w-md mx-auto">
                No database records exist for milestone claims. Connect a workbook or upload a PDF document in the panel below to initiate AI parsing.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {activeDocuments.map((doc: any) => (
              <div key={doc.id} className="bg-white/90 backdrop-blur-md rounded-3xl p-5 border border-gray-200/60 shadow-lg shadow-gray-200/30 hover:shadow-xl hover:-translate-y-1 hover:border-gray-300/60 transition-all duration-300 flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-dark-teal-50 rounded-xl text-dark-teal-800 border border-dark-teal-100">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold font-lexend text-gray-900 leading-tight">
                        {doc.title || 'Milestone Claim Document'}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {doc.file_type || 'Cloud Document'} • {doc.integration_id ? 'Linked' : 'Uploaded'} {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Recently'}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setSelectedClaim(doc)}
                      className="px-4 py-2 bg-gradient-to-b from-indigo-50 to-indigo-100/50 hover:from-indigo-100 hover:to-indigo-200/50 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-extrabold shadow-sm hover:shadow hover:-translate-y-0.5 transition-all duration-300 flex items-center shadow-sm"
                    >
                      View / Edit Claim
                    </button>
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-gradient-to-b from-white to-gray-50 hover:from-gray-50 hover:to-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-extrabold shadow-sm hover:shadow hover:-translate-y-0.5 transition-all duration-300 flex items-center"
                    >
                      View Source
                    </a>
                    {!doc.integration_id && (
                      <button
                        onClick={() => setClaimToDelete(doc)}
                        disabled={deletingId === doc.id}
                        className="p-2 bg-white hover:bg-red-50 text-red-500 hover:text-red-700 border border-gray-200 hover:border-red-200 rounded-xl transition-all duration-300 flex items-center justify-center disabled:opacity-50"
                        title="Delete Orphaned Claim Permanently"
                      >
                        {deletingId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Info grid */}
                <div className="grid grid-cols-5 gap-4 pt-4 border-t border-gray-50">
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Claim No</p>
                    <p className="text-sm font-bold text-gray-800">{doc.claim_number || 'Pending'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Valuation Date</p>
                    <p className="text-sm font-bold text-gray-800">{doc.valuation_date ? new Date(doc.valuation_date).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Status</p>
                    <p className="text-sm font-bold text-gray-800">
                      <span className={`px-2 py-1 rounded text-xs ${doc.status === 'Certified' ? 'bg-emerald-100 text-emerald-800' : doc.status === 'Submitted' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'}`}>
                        {doc.status || 'Draft'}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Payment</p>
                    <p className="text-sm font-bold text-gray-800">
                      <span className={`px-2 py-1 rounded text-xs ${doc.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : doc.payment_status === 'PARTIAL' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'}`}>
                        {doc.payment_status || 'UNPAID'}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Net Due</p>
                    <p className="text-sm font-bold text-dark-teal-600">${(doc.net_amount_due || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                  </div>
                </div>
              </div>
            ))}
            </div>
          )}
        </div>

        {selectedClaim && (
          <MilestoneClaimSheet
            claim={selectedClaim}
            onClose={() => setSelectedClaim(null)}
            onSave={async (data) => {
              if (setGlobalLoading) setGlobalLoading(true);
              try {
                await updateProjectMilestoneClaim(projectId, selectedClaim.id, data);
                setSelectedClaim(null);
                queryClient.invalidateQueries({ queryKey: ['documents', projectId, 'milestone_claims'] });
              } catch (err) {
                console.error('Failed to update claim:', err);
              } finally {
                if (setGlobalLoading) setGlobalLoading(false);
              }
            }}
          />
        )}

        {/* Delete Confirmation Modal */}
        {claimToDelete && (
          <div className="fixed inset-0 z-[100] bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-fade-in-up">
              <div className="p-6 sm:p-8">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-6">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-xl font-bold font-lexend text-gray-900 mb-2">Delete Orphaned Claim</h3>
                <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                  This will permanently delete the orphaned milestone claim and all associated extracted data from the database. This action cannot be undone.
                </p>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-8">
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Document</p>
                  <p className="text-sm font-bold text-gray-900">{claimToDelete.title}</p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setClaimToDelete(null)}
                    className="flex-1 px-4 py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-sm font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deletingId === claimToDelete.id}
                    className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-md transition flex items-center justify-center disabled:opacity-70"
                  >
                    {deletingId === claimToDelete.id ? <Loader2 className="w-5 h-5 animate-spin" /> : "Delete Permanently"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Discussions & Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Post note form */}
        <div className="lg:col-span-1 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4 self-start">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-400 font-inter">Add Workspace Note</h3>
          <form onSubmit={handlePostNote} className="space-y-4">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Log progress comments or flag claim revisions..."
              rows={3}
              className="w-full p-4 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-dark-teal-500/20 focus:border-dark-teal-500 focus:outline-none transition shadow-inner resize-none"
            />
            
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isIssue}
                  onChange={(e) => setIsIssue(e.target.checked)}
                  className="rounded text-dark-teal-600 focus:ring-dark-teal-500/20 w-4 h-4 border-gray-300"
                />
                <span className="text-xs font-semibold text-gray-600">Flag as Issue</span>
              </label>

              {isIssue && (
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="p-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-dark-teal-500"
                >
                  <option>Low</option>
                  <option>Normal</option>
                  <option>High</option>
                  <option>Urgent</option>
                </select>
              )}
            </div>

            <button
              type="submit"
              disabled={posting || !content.trim()}
              className="w-full py-3 bg-dark-teal-900 hover:bg-black disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-1 active:scale-95"
            >
              {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Post Notes / Log Issue
            </button>
          </form>
        </div>

        {/* Discussion logs */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-400 font-inter">Department Logs</h3>
          
          {filteredNotes.length === 0 ? (
            <div className="bg-gray-50/70 rounded-3xl p-8 text-center border border-dashed border-gray-200">
              <MessageSquare className="w-8 h-8 text-slate-200 drop-shadow-sm mx-auto mb-2" />
              <p className="text-xs text-gray-400 font-medium">No notes recorded for this milestone claim yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredNotes.map((note) => (
                <div
                  key={note.id}
                  className={`bg-white rounded-3xl p-5 border shadow-sm transition ${
                    note.is_issue ? 'border-red-200 bg-red-50/10' : 'border-gray-100'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-gray-900">{note.author_name || 'Team Member'}</span>
                      <span className="text-[10px] text-gray-400">
                        • {note.created_at ? new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                      </span>
                    </div>

                    {note.is_issue && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-red-50 text-red-700 border border-red-200">
                        <AlertTriangle className="w-3 h-3 mr-1" /> {note.priority || 'High'} Issue
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-700 leading-relaxed font-medium whitespace-pre-line">
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple loader helper in Lucide format
function Loader2({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
  );
}

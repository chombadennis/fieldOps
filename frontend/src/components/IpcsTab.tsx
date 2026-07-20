import React, { useState } from 'react';
import { MessageSquare, Send, AlertTriangle, FileCheck } from 'lucide-react';
import DocumentIntegrations from '@/components/DocumentIntegrations';
import LinkedDocumentsPanel from '@/components/LinkedDocumentsPanel';
import { unlinkProjectDocument } from '@/services/api';

interface IPC {
  id: number;
  certificate_number: string;
  amount_claimed: number;
  amount_certified?: number;
  status: string;
  issued_date?: string;
  period_start?: string;
  period_end?: string;
}

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
}

interface IpcsTabProps {
  projectId: number;
  ipcs: IPC[];
  notes: Note[];
  documents: Document[];
  onAddNote: (note: { content: string; department: string; is_issue: boolean; priority: string }) => Promise<void>;
  integrations?: any[];
  boqDocuments?: any[];
  onRefresh?: () => void;
  globalLoading?: boolean;
  setGlobalLoading?: (loading: boolean) => void;
}

export default function IpcsTab({
  projectId,
  ipcs = [],
  notes = [],
  documents = [],
  onAddNote,
  integrations,
  boqDocuments,
  onRefresh,
  globalLoading,
  setGlobalLoading,
}: IpcsTabProps) {
  const [content, setContent] = useState('');
  const [isIssue, setIsIssue] = useState(false);
  const [priority, setPriority] = useState('Normal');
  const [posting, setPosting] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<number | null>(null);

  const totalClaimed = ipcs.reduce((sum, i) => sum + (i.amount_claimed || 0), 0);
  const totalCertified = ipcs.reduce((sum, i) => sum + (i.amount_certified || 0), 0);

  const statusBadge = (st: string) => {
    switch (st) {
      case 'Certified':
      case 'Paid':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Submitted':
        return 'bg-dark-teal-50 text-dark-teal-700 border-dark-teal-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const handleUnlinkDocument = async (documentId: number) => {
    if (!onRefresh) return;
    setUnlinkingId(documentId);
    if (setGlobalLoading) setGlobalLoading(true);
    try {
      await unlinkProjectDocument(projectId, documentId);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Failed to unlink document.');
    } finally {
      setUnlinkingId(null);
      if (setGlobalLoading) setGlobalLoading(false);
    }
  };

  // Filter notes and docs for IPCs tab
  const filteredNotes = notes.filter((n) => n.department?.toUpperCase() === 'IPC');
  const filteredDocs = documents.filter((d) => d.department?.toUpperCase() === 'IPC');

  const handlePostNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setPosting(true);
    try {
      await onAddNote({
        content,
        department: 'IPC',
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

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-dark-teal-950 via-dark-teal-900 to-emerald-950 text-white rounded-3xl p-8 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="relative z-10">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Progress Claims</span>
          <h2 className="text-xl font-bold font-lexend mt-1">Interim Payment Certificates (IPCs)</h2>
          <p className="text-xs text-emerald-100/80 mt-1 max-w-lg">Submit, verify, and monitor progress payment claims for completed site works.</p>
        </div>

        <div className="flex items-center space-x-4 relative z-10">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 text-right">
            <p className="text-xs font-semibold text-emerald-200 uppercase">Total Certified / Claimed</p>
            <p className="text-sm font-bold font-lexend text-white mt-0.5">${totalCertified.toLocaleString()} / ${totalClaimed.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Cloud File Integration (Google Drive & OneDrive) */}
      {integrations && onRefresh && setGlobalLoading && (
        <DocumentIntegrations
          projectId={String(projectId)}
          integrations={integrations}
          onRefresh={onRefresh}
          globalLoading={!!globalLoading}
          setGlobalLoading={setGlobalLoading}
          moduleContext="ipc"
          activeTab="pmo"
          pmoSubTab="ipcs"
        />
      )}

      {/* Linked Documents Panel */}
      <LinkedDocumentsPanel
        title="Linked IPC Claims"
        documents={filteredDocs}
        onUnlink={handleUnlinkDocument}
        unlinkingId={unlinkingId}
        emptyMessage="No files linked to IPC claims yet."
      />

      {/* IPC Table / Cards */}
      {ipcs.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-gray-200 shadow-sm">
          <FileCheck className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold font-lexend text-gray-800">No Interim Certificates Issued</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            Connect a cloud spreadsheet above to issue your first IPC for work done on site.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-semibold">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-400 uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-4">Certificate #</th>
                  <th className="px-6 py-4">Amount Claimed</th>
                  <th className="px-6 py-4">Amount Certified</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Issued Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                {ipcs.map((ipc) => (
                  <tr key={ipc.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-6 py-4 font-extrabold font-lexend text-gray-900">{ipc.certificate_number}</td>
                    <td className="px-6 py-4 font-bold text-gray-800">${ipc.amount_claimed.toLocaleString()}</td>
                    <td className="px-6 py-4 font-bold text-emerald-600">
                      ${(ipc.amount_certified || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[11px] font-bold border ${statusBadge(ipc.status)}`}>
                        {ipc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-gray-400 font-medium">
                      {ipc.issued_date ? new Date(ipc.issued_date).toLocaleDateString() : 'Today'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Discussion & Note Form */}
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
        <h3 className="text-sm font-bold font-lexend text-gray-800">Add Discussion Note / Log Issue</h3>
        <form onSubmit={handlePostNote} className="space-y-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share an Interim Payment Certificate update or report a claiming issue..."
            rows={3}
            className="w-full p-4 bg-gray-50 border border-gray-150 rounded-2xl text-xs focus:ring-2 focus:ring-dark-teal-500/20 focus:border-dark-teal-500 focus:outline-none transition font-medium"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div className="flex items-center space-x-6">
              <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isIssue}
                  onChange={(e) => setIsIssue(e.target.checked)}
                  className="w-4 h-4 rounded text-dark-teal-900 border-gray-300 focus:ring-dark-teal-500"
                />
                <span className="text-xs font-bold text-gray-700">Flag as Site Issue</span>
              </label>

              {isIssue && (
                <div className="flex items-center space-x-2 animate-fade-in">
                  <span className="text-xs text-gray-400 font-semibold">Priority:</span>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="p-1.5 bg-gray-50 border border-gray-150 rounded-xl text-xs font-bold text-gray-700 focus:outline-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={posting || !content.trim()}
              className="px-5 py-3 bg-dark-teal-800 hover:bg-dark-teal-900 text-white font-bold rounded-xl text-xs shadow-md disabled:opacity-50 transition active:scale-95 flex items-center space-x-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{posting ? 'Posting...' : 'Post Entry'}</span>
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-inter">Discussion Feed</h4>
        {filteredNotes.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-gray-200">
            <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400 font-medium">No notes recorded for IPC claims yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                className={`bg-white rounded-3xl p-6 border shadow-sm transition ${
                  note.is_issue ? 'border-deep-crimson-200 bg-deep-crimson-50/20' : 'border-gray-100'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold font-lexend text-gray-900">{note.author_name || 'Team Member'}</span>
                    <span className="text-xs text-gray-400">• {note.created_at ? new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}</span>
                  </div>

                  {note.is_issue && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-deep-crimson-50 text-deep-crimson-700 border border-deep-crimson-200">
                      <AlertTriangle className="w-3 h-3 mr-1" /> {note.priority || 'High'} Issue
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line font-medium">{note.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

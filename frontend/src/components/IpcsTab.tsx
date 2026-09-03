import React, { useState } from 'react';
import { MessageSquare, AlertTriangle, FileCheck } from 'lucide-react';
import DocumentIntegrations from '@/components/DocumentIntegrations';
import LinkedDocumentsPanel from '@/components/LinkedDocumentsPanel';
import IpcValuationSheet from '@/components/IpcValuationSheet';
import DiscussionNoteInput from '@/components/DiscussionNoteInput';
import { renderSafeHtml } from '@/lib/sanitize';
import { unlinkProjectDocument, unlinkDecoupledDocument, deleteProjectDocument, deleteDecoupledDocument, updateProjectIPC } from '@/services/api';

interface IPC {
  id: number;
  certificate_number: string;
  gross_amount_claimed?: number;
  gross_amount_certified?: number;
  total_deductions?: number;
  net_amount_due?: number;
  cumulative_certified?: number;
  status: string;
  payment_status: string;
  unpaid_amount?: number;
  payment_date?: string;
  period_start?: string;
  period_end?: string;
  valuation_date?: string;
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
  uploaded_by?: number;
  cloud_email?: string;
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
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedIpc, setSelectedIpc] = useState<IPC | null>(null);
  const [editingNetDueId, setEditingNetDueId] = useState<number | null>(null);
  const [editingNetDueAmount, setEditingNetDueAmount] = useState<number>(0);

  // Custom UI Modals
  const [customAlert, setCustomAlert] = useState<{ title: string, message: string } | null>(null);
  const [customConfirm, setCustomConfirm] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null);

  const totalCertified = ipcs.reduce((sum, i) => sum + (i.net_amount_due || 0), 0);
  const totalPaid = ipcs.reduce((sum, ipc) => {
    const netDue = ipc.net_amount_due || 0;
    const unpaid = ipc.unpaid_amount ?? netDue;
    return sum + (netDue - unpaid);
  }, 0);

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
      await unlinkDecoupledDocument(projectId, 'ipc', documentId).catch(() => unlinkProjectDocument(projectId, documentId));
      await onRefresh();
    } catch (err) {
      console.error(err);
      alert('Failed to unlink document.');
    } finally {
      setUnlinkingId(null);
      if (setGlobalLoading) setGlobalLoading(false);
    }
  };

  const handleDeleteDocument = async (documentId: number) => {
    if (!onRefresh) return;
    setDeletingId(documentId);
    if (setGlobalLoading) setGlobalLoading(true);
    try {
      await deleteDecoupledDocument(projectId, 'ipc', documentId).catch(() => deleteProjectDocument(projectId, documentId));
      await onRefresh();
    } catch (err) {
      console.error(err);
      alert('Failed to delete document data.');
    } finally {
      setDeletingId(null);
      if (setGlobalLoading) setGlobalLoading(false);
    }
  };

  // Filter notes and docs for IPCs tab
  const filteredNotes = notes.filter((n) => n.department?.toUpperCase() === 'IPC');
  const filteredDocs = documents.filter((d) => d.department?.toUpperCase() === 'IPC');

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-3xl p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 -translate-y-12 -translate-x-12 w-64 h-64 bg-neon-cyan/10 rounded-full blur-3xl pointer-events-none mix-blend-screen" />

        <div className="relative z-10">
          <span className="text-xs font-semibold text-neon-cyan uppercase tracking-widest drop-shadow-[0_0_8px_rgba(0,243,255,0.5)]">Progress Claims</span>
          <h2 className="text-xl font-bold font-lexend mt-1 text-white drop-shadow-md">Interim Payment Certificates (IPCs)</h2>
          <p className="text-xs text-gray-400 mt-1 max-w-lg leading-relaxed">Submit, verify, and monitor progress payment claims for completed site works.</p>
        </div>

        <div className="flex items-center space-x-4 relative z-10">
          <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/5 text-right shadow-[0_4px_15px_rgba(0,0,0,0.3)]">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Net Certified / Paid</p>
            <p className="text-sm font-bold font-lexend text-white mt-0.5">${totalCertified.toLocaleString()} / <span className="text-neon-cyan">${totalPaid.toLocaleString()}</span></p>
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
          apiEndpoint="ipc"
        />
      )}

      {/* Linked Documents Panel */}
      <LinkedDocumentsPanel
        title="Linked IPC Claims"
        documents={filteredDocs}
        onUnlink={handleUnlinkDocument}
        onDelete={handleDeleteDocument}
        unlinkingId={unlinkingId}
        deletingId={deletingId}
        emptyMessage="No files linked to IPC claims yet."
        docType="ipc"
      />

      {/* IPC Table / Cards */}
      {ipcs.length === 0 ? (
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-12 text-center border border-dashed border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <FileCheck className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold font-lexend text-white drop-shadow-md">No Interim Certificates Issued</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            Connect a cloud spreadsheet above to issue your first IPC for work done on site.
          </p>
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-semibold">
              <thead className="bg-black/40 border-b border-white/10 text-gray-400 uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-4">Certificate #</th>
                  <th className="px-6 py-4">Net Amount Due</th>
                  <th className="px-6 py-4">Unpaid Balance</th>
                  <th className="px-6 py-4">Approval Status</th>
                  <th className="px-6 py-4 text-right">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-gray-300 font-medium">
                {ipcs.map((ipc) => (
                  <tr
                    key={ipc.id}
                    onClick={() => setSelectedIpc(ipc)}
                    className="transition hover:bg-white/5 cursor-pointer"
                  >
                    <td className="px-6 py-4 font-extrabold font-lexend text-white drop-shadow-md">{ipc.certificate_number}</td>
                    <td className="px-6 py-4 font-bold text-gray-300" onClick={(e) => e.stopPropagation()}>
                      {editingNetDueId === ipc.id ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            className="w-24 p-1 text-xs bg-black/60 border border-neon-cyan/50 text-white rounded font-bold focus:outline-none focus:ring-1 focus:ring-neon-cyan"
                            value={editingNetDueAmount}
                            onChange={(e) => setEditingNetDueAmount(Number(e.target.value))}
                          />
                          <button
                            className="text-[10px] bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan px-2 py-1 rounded hover:bg-neon-cyan hover:text-black transition"
                            onClick={async () => {
                              try {
                                await updateProjectIPC(projectId, ipc.id, { net_amount_due: editingNetDueAmount });
                                setEditingNetDueId(null);
                                if (onRefresh) onRefresh();
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                          >
                            Save
                          </button>
                          <button
                            className="text-[10px] bg-white/10 text-gray-400 border border-white/20 px-2 py-1 rounded hover:bg-white/20 hover:text-white transition"
                            onClick={() => setEditingNetDueId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div
                          className="flex items-center space-x-2 group cursor-pointer"
                          onClick={() => {
                            setCustomConfirm({
                              title: "Edit Source of Truth",
                              message: "WARNING: You are about to edit the original source of truth from the database for this IPC. Do you wish to continue?",
                              onConfirm: () => {
                                setEditingNetDueId(ipc.id);
                                setEditingNetDueAmount(ipc.net_amount_due || 0);
                              }
                            });
                          }}
                        >
                          <span className="text-neon-purple drop-shadow-[0_0_5px_rgba(188,19,254,0.3)]">${(ipc.net_amount_due || 0).toLocaleString()}</span>
                          <span className="opacity-0 group-hover:opacity-100 text-[10px] text-neon-cyan transition-opacity">Edit</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-red-400">
                      ${(ipc.unpaid_amount || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md border text-[11px] font-bold ${
                        ipc.status === 'Certified' ? 'bg-neon-cyan/20 border-neon-cyan/50 text-neon-cyan shadow-[0_0_10px_rgba(0,243,255,0.2)]' :
                        ipc.status === 'Submitted' ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]' :
                        'bg-white/10 border-white/20 text-gray-300'
                      }`}>
                        {ipc.status || 'Draft'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-xs font-medium">
                      {(() => {
                        const netDue = ipc.net_amount_due || 0;
                        const unpaid = ipc.unpaid_amount ?? netDue;

                        let displayStatus = 'UNPAID';
                        let badgeClass = 'bg-red-500/20 text-red-400 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]';

                        if (netDue > 0) {
                          if (unpaid <= 0) {
                            displayStatus = 'FULLY PAID';
                            badgeClass = 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/50 shadow-[0_0_10px_rgba(0,243,255,0.2)]';
                          } else if (unpaid < netDue) {
                            displayStatus = 'PARTIALLY PAID';
                            badgeClass = 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]';
                          }
                        } else {
                          if (ipc.payment_status === 'PAID') {
                            displayStatus = 'FULLY PAID';
                            badgeClass = 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/50 shadow-[0_0_10px_rgba(0,243,255,0.2)]';
                          }
                        }

                        return (
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold border tracking-wider ${badgeClass}`}>
                            {displayStatus}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Discussion & Note Form */}
      <DiscussionNoteInput 
        onAddNote={onAddNote}
        departmentKey="IPC"
        placeholder="Share an Interim Payment Certificate update or report a claiming issue..."
        variant="dark"
      />

      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 font-inter">Discussion Feed</h4>
        {filteredNotes.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-md rounded-3xl p-10 text-center border border-dashed border-white/10 shadow-sm">
            <MessageSquare className="w-8 h-8 text-gray-600 drop-shadow-sm mx-auto mb-2" />
            <p className="text-xs text-gray-500 font-medium">No notes recorded for IPC claims yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                className={`bg-white/5 backdrop-blur-md rounded-3xl p-6 border shadow-[0_4px_15px_rgba(0,0,0,0.2)] transition ${
                  note.is_issue ? 'border-neon-pink/50 bg-neon-pink/5' : 'border-white/10'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold font-lexend text-white drop-shadow-sm">{note.author_name || 'Team Member'}</span>
                    <span className="text-xs text-gray-500">• {note.created_at ? new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}</span>
                  </div>

                  {note.is_issue && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-neon-pink/20 text-neon-pink border border-neon-pink/50 shadow-[0_0_10px_rgba(255,0,127,0.3)]">
                      <AlertTriangle className="w-3 h-3 mr-1" /> {note.priority || 'High'} Issue
                    </span>
                  )}
                </div>

                <div 
                  className="text-xs text-gray-300 leading-relaxed font-medium note-content-html"
                  dangerouslySetInnerHTML={{ __html: renderSafeHtml(note.content) }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* IPC Editor Modal */}
      {selectedIpc && (
        <IpcValuationSheet
          ipc={selectedIpc}
          contractParams={{ vat_rate: 0.16 }}
          onClose={() => setSelectedIpc(null)}
          onSave={async (updatedData) => {
            try {
              await updateProjectIPC(projectId, selectedIpc.id, updatedData);
              setSelectedIpc(null);
              if (onRefresh) onRefresh();
            } catch (err) {
              console.error("Failed to update IPC:", err);
              alert("Failed to save IPC changes. Please try again.");
            }
          }}
        />
      )}
      {/* Custom Alert Modal */}
      {customAlert && (
        <div className="fixed inset-0 bg-[#030305]/80 backdrop-blur-md z-[70] flex items-center justify-center p-4">
          <div className="bg-[#030305] rounded-3xl p-6 max-w-sm w-full shadow-[0_0_50px_rgba(255,0,127,0.1)] animate-fade-in text-center border border-white/10">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
            <h3 className="text-lg font-bold font-lexend text-white mb-2">{customAlert.title}</h3>
            <p className="text-sm text-gray-400 font-medium mb-6">{customAlert.message}</p>
            <button
              onClick={() => setCustomAlert(null)}
              className="w-full bg-neon-cyan/20 border border-neon-cyan/50 hover:bg-neon-cyan hover:text-black text-neon-cyan font-bold py-3 px-4 rounded-xl transition shadow-[0_0_15px_rgba(0,243,255,0.2)]"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}

      {/* Custom Confirm Modal */}
      {customConfirm && (
        <div className="fixed inset-0 bg-[#030305]/80 backdrop-blur-md z-[70] flex items-center justify-center p-4">
          <div className="bg-[#030305] rounded-3xl p-6 max-w-sm w-full shadow-[0_0_50px_rgba(245,158,11,0.1)] animate-fade-in text-center border border-white/10">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
            <h3 className="text-lg font-bold font-lexend text-white mb-2">{customConfirm.title}</h3>
            <p className="text-sm text-gray-400 font-medium mb-6">{customConfirm.message}</p>
            <div className="flex space-x-3">
              <button
                onClick={() => setCustomConfirm(null)}
                className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold py-3 px-4 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  customConfirm.onConfirm();
                  setCustomConfirm(null);
                }}
                className="flex-1 bg-amber-500/20 hover:bg-amber-500 hover:text-black border border-amber-500/50 text-amber-400 font-bold py-3 px-4 rounded-xl transition shadow-[0_0_15px_rgba(245,158,11,0.3)]"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

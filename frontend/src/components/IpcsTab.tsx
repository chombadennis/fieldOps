import React, { useState } from 'react';
import { MessageSquare, Send, AlertTriangle, FileCheck } from 'lucide-react';
import DocumentIntegrations from '@/components/DocumentIntegrations';
import LinkedDocumentsPanel from '@/components/LinkedDocumentsPanel';
import IpcValuationSheet from '@/components/IpcValuationSheet';
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

  const totalClaimed = ipcs.reduce((sum, i) => sum + (i.gross_amount_claimed || 0), 0);
  const totalCertified = ipcs.reduce((sum, i) => sum + (i.net_amount_due || 0), 0);

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
                  <th className="px-6 py-4">Net Amount Due</th>
                  <th className="px-6 py-4">Unpaid Balance</th>
                  <th className="px-6 py-4">Approval Status</th>
                  <th className="px-6 py-4 text-right">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                {ipcs.map((ipc) => (
                  <tr
                    key={ipc.id}
                    onClick={() => {
                      if (ipc.status === 'Certified' || ipc.status === 'Paid') {
                        setSelectedIpc(ipc);
                      } else {
                        setCustomAlert({
                          title: "Action Blocked",
                          message: "You can only open the Valuation Sheet if the IPC is Certified or Paid."
                        });
                      }
                    }}
                    className={`transition ${ipc.status === 'Certified' || ipc.status === 'Paid' ? 'hover:bg-gray-50/50 cursor-pointer' : 'opacity-80'}`}
                  >
                    <td className="px-6 py-4 font-extrabold font-lexend text-gray-900">{ipc.certificate_number}</td>
                    <td className="px-6 py-4 font-bold text-gray-800" onClick={(e) => e.stopPropagation()}>
                      {editingNetDueId === ipc.id ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            className="w-24 p-1 text-xs border border-gray-300 rounded font-bold"
                            value={editingNetDueAmount}
                            onChange={(e) => setEditingNetDueAmount(Number(e.target.value))}
                          />
                          <button
                            className="text-[10px] bg-dark-teal-600 text-white px-2 py-1 rounded hover:bg-dark-teal-700"
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
                            className="text-[10px] bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300"
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
                          <span>${(ipc.net_amount_due || 0).toLocaleString()}</span>
                          <span className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-500 transition-opacity">Edit</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-red-500">
                      ${(ipc.unpaid_amount || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <select
                        className={`px-3 py-1 rounded-full text-[11px] font-bold border outline-none cursor-pointer ${statusBadge(ipc.status)}`}
                        value={ipc.status}
                        onChange={async (e) => {
                          // TODO: Role-Based Authorization Check
                          // Only authorized internal users (e.g. Project Managers, Admins) should be able to change 
                          // the status to 'Certified'. Check user role here before allowing the update.
                          const newStatus = e.target.value;

                          if (newStatus === 'Paid') {
                            const netDue = ipc.net_amount_due || 0;
                            const unpaid = ipc.unpaid_amount ?? netDue;
                            const isFullyPaid = (netDue > 0 && unpaid <= 0) || (netDue === 0 && ipc.payment_status === 'PAID');

                            if (!isFullyPaid) {
                              setCustomAlert({
                                title: "Invalid Status Update",
                                message: "Approval status can only be 'Paid' if the Payment Status is 'FULLY PAID'."
                              });
                              return;
                            }
                          }

                          try {
                            await updateProjectIPC(projectId, ipc.id, { status: newStatus });
                            if (onRefresh) onRefresh();
                          } catch (err) {
                            console.error("Failed to update status", err);
                          }
                        }}
                      >
                        <option value="Draft">Draft</option>
                        <option value="Submitted">Submitted</option>
                        <option value="Certified">Certified</option>
                        <option value="Paid">Paid</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-gray-400 font-medium">
                      {(() => {
                        const netDue = ipc.net_amount_due || 0;
                        const unpaid = ipc.unpaid_amount ?? netDue;

                        let displayStatus = 'UNPAID';
                        let badgeClass = 'bg-red-50 text-red-700 border-red-200';

                        if (netDue > 0) {
                          if (unpaid <= 0) {
                            displayStatus = 'FULLY PAID';
                            badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                          } else if (unpaid < netDue) {
                            displayStatus = 'PARTIALLY PAID';
                            badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                          }
                        } else {
                          if (ipc.payment_status === 'PAID') {
                            displayStatus = 'FULLY PAID';
                            badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                          }
                        }

                        return (
                          <span className={`px-3 py-1 rounded-full text-[11px] font-bold border ${badgeClass}`}>
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
              className="px-5 py-3 bg-gradient-to-r from-dark-teal-700 to-dark-teal-900 hover:from-dark-teal-600 hover:to-dark-teal-800 text-white font-extrabold rounded-xl text-xs shadow-lg shadow-dark-teal-900/30 disabled:opacity-50 disabled:shadow-none hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 active:scale-95 flex items-center space-x-1.5"
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
            <MessageSquare className="w-8 h-8 text-slate-200 drop-shadow-sm mx-auto mb-2" />
            <p className="text-xs text-gray-400 font-medium">No notes recorded for IPC claims yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                className={`bg-white rounded-3xl p-6 border shadow-sm transition ${note.is_issue ? 'border-deep-crimson-200 bg-deep-crimson-50/20' : 'border-gray-100'
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
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-fade-in text-center border border-gray-100">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold font-lexend text-gray-900 mb-2">{customAlert.title}</h3>
            <p className="text-sm text-gray-600 font-medium mb-6">{customAlert.message}</p>
            <button
              onClick={() => setCustomAlert(null)}
              className="w-full bg-dark-teal-800 hover:bg-dark-teal-900 text-white font-bold py-3 px-4 rounded-xl transition shadow-md"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}

      {/* Custom Confirm Modal */}
      {customConfirm && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-fade-in text-center border border-gray-100">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold font-lexend text-gray-900 mb-2">{customConfirm.title}</h3>
            <p className="text-sm text-gray-600 font-medium mb-6">{customConfirm.message}</p>
            <div className="flex space-x-3">
              <button
                onClick={() => setCustomConfirm(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  customConfirm.onConfirm();
                  setCustomConfirm(null);
                }}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-4 rounded-xl transition shadow-md"
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

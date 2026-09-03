'use client';

import { useState, useEffect } from 'react';
import { getCurrentUser } from '@/services/api';
import { FileText, Calendar, Eye, Trash2, AlertTriangle, X, Loader2, FileWarning, Info } from 'lucide-react';


interface BoqDocument {
  id: number;
  project_id: number;
  name: string;
  file_hash: string;
  origin?: string;
  created_at: string;
  preview_only?: boolean;
  validation_status?: string | null;
  validation_score?: number | null;
  validation_issues?: string[] | null;
  uploaded_by?: number;
  cloud_email?: string;
}

interface BoqDocumentListProps {
  documents: BoqDocument[];
  onViewItems: (boqId: number, docName: string) => void;
  onDeleteDocument?: (boqId: number) => Promise<void>;
  integrations?: any[];
}

export default function BoqDocumentList({ documents, onViewItems, onDeleteDocument, integrations }: BoqDocumentListProps) {
  const [docToDelete, setDocToDelete] = useState<BoqDocument | null>(null);
  const [docBlockedToDelete, setDocBlockedToDelete] = useState<BoqDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  // State for current user to enforce smart conditional previews
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    getCurrentUser().then(user => setCurrentUser(user)).catch(console.error);
  }, []);

  const handleDeleteClick = (doc: BoqDocument) => {
    setDocToDelete(doc);
  };

  const handleConfirmDelete = async () => {
    console.log("handleConfirmDelete called. docToDelete:", docToDelete, "onDeleteDocument:", typeof onDeleteDocument);
    if (!docToDelete || !onDeleteDocument) {
      console.log("Aborted handleConfirmDelete: docToDelete or onDeleteDocument is missing.");
      return;
    }
    setDeleting(true);
    try {
      console.log("Triggering onDeleteDocument callback for ID:", docToDelete.id);
      await onDeleteDocument(docToDelete.id);
      console.log("onDeleteDocument callback finished.");
      setDocToDelete(null); // Close modal only on success
    } catch (err) {
      console.error("Error in onDeleteDocument:", err);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getDocBadge = (origin?: string) => {
    if (origin === 'google_sheets' || origin === 'onedrive') {
      return (
        <span className="text-[10px] font-semibold bg-neon-purple/20 text-neon-purple border border-neon-purple/30 px-2 py-0.5 rounded-full whitespace-nowrap drop-shadow-[0_0_5px_rgba(188,19,254,0.3)]">
          Cloud Sync
        </span>
      );
    }
    return (
      <span className="text-[10px] font-semibold bg-white/10 text-white border border-white/20 px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm">
        Auto-Parsed
      </span>
    );
  };

  const importedDocs = documents.filter(d => !d.preview_only && d.validation_status !== 'rejected');
  const previewOnlyDocs = documents.filter(d => d.preview_only && d.validation_status !== 'rejected');

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-neon-cyan/20 border border-neon-cyan/30 rounded-xl flex items-center justify-center text-neon-cyan shadow-[0_0_15px_rgba(0,243,255,0.2)]">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-2xl font-bold font-lexend text-white drop-shadow-md">Attached Bills of Quantities</h2>
          <p className="text-sm text-gray-400 mt-0.5">Up to 5 documents per project</p>
        </div>
      </div>

      {importedDocs.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-white/10 rounded-2xl">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-base font-semibold">No BOQs linked yet.</p>
          <p className="text-sm text-gray-500 mt-1">Upload a PDF/Excel file or link a Google Sheet/OneDrive file to get started.</p>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {importedDocs.map((doc) => (
            <div key={doc.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 first:pt-0 last:pb-0 group">
              <div className="flex items-start space-x-3.5">
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-gray-400 group-hover:bg-neon-cyan/20 group-hover:text-neon-cyan group-hover:border-neon-cyan/30 transition-all shadow-sm">
                  <FileText className="w-5.5 h-5.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2.5">
                    <h4 className="font-bold text-white text-base truncate max-w-[200px] sm:max-w-[340px]" title={doc.name}>
                      {doc.name}
                    </h4>
                    {getDocBadge(doc.origin)}
                  </div>
                  {currentUser && doc.uploaded_by === currentUser.id && doc.cloud_email && (
                    <p className="text-[10px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20 mt-1 inline-flex items-center gap-1 w-fit">
                      <span className="opacity-70">Source:</span> {doc.cloud_email}
                    </p>
                  )}
                  <div className="flex items-center text-xs sm:text-sm text-gray-400 mt-1 space-x-3.5">
                    <span className="flex items-center font-medium">
                      <Calendar className="w-4 h-4 mr-1 text-gray-500" />
                      {formatDate(doc.created_at)}
                    </span>
                    <span className="truncate max-w-[140px] font-mono text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded text-gray-400">
                      SHA: {doc.file_hash.substring(0, 8)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="self-end sm:self-center flex items-center space-x-2 flex-shrink-0">
                {(!currentUser || doc.uploaded_by === currentUser.id) ? (
                  <button
                    onClick={() => onViewItems(doc.id, doc.name)}
                    className="flex items-center justify-center space-x-2 bg-white/5 border border-white/10 hover:border-neon-cyan/50 text-gray-300 hover:text-neon-cyan hover:bg-neon-cyan/10 font-bold py-2.5 px-4 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.2)] hover:shadow-[0_0_15px_rgba(0,243,255,0.15)] active:scale-[0.98] transition-all duration-100 text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View Items</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      alert("You are viewing a BOQ document linked by another user. If you do not have permission, Google/Microsoft will prompt you to request access.");
                      onViewItems(doc.id, doc.name);
                    }}
                    className="flex items-center justify-center space-x-2 bg-white/5 border border-amber-500/30 hover:border-amber-500/50 text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 font-bold py-2.5 px-4 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.2)] hover:shadow-[0_0_15px_rgba(245,158,11,0.15)] active:scale-[0.98] transition-all duration-100 text-sm"
                    title="This document was linked by another user"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View Items</span>
                  </button>
                )}
                {onDeleteDocument && (!currentUser || doc.uploaded_by === currentUser.id) && (
                  <button
                    onClick={() => handleDeleteClick(doc)}
                    className="p-2.5 border border-red-500/30 rounded-xl text-red-400 hover:bg-red-500/20 hover:border-red-500/50 active:scale-90 transition-all duration-100 shadow-[0_0_10px_rgba(0,0,0,0.2)]"
                    title="Delete BOQ document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}


      {/* Custom Confirmation Modal */}
      {docToDelete && (
        <div className="fixed inset-0 bg-[#030305]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#030305] rounded-2xl max-w-md w-full p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10 flex flex-col relative animate-scale-up">
            <button
              onClick={() => setDocToDelete(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white active:scale-95 transition-all duration-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-red-500/20 rounded-xl text-red-400 border border-red-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete BOQ Document</h3>
                <p className="text-xs text-red-400 font-semibold">This action is irreversible</p>
              </div>
            </div>

            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              You are about to perform an <span className="font-bold text-red-400">irreversible deletion</span> of the BOQ document <span className="font-bold text-white">"{docToDelete.name}"</span> from the database and all of its records will be deleted permanently. Do you wish to continue?
            </p>

            <div className="bg-blue-500/10 border border-blue-500/30 text-blue-200 text-xs p-3 rounded-xl mb-4">
              <span className="font-bold block mb-0.5 text-blue-400 uppercase tracking-wider text-[10px]">Cloud Storage Safeguard</span>
              Note: This action will <span className="font-bold text-blue-400">NOT</span> delete the actual file in your cloud drive.
            </div>

            {deleting && (
              <div className="flex items-center space-x-2 text-red-400 bg-red-900/20 border border-red-500/30 p-3 rounded-xl mb-6 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-red-400 flex-shrink-0" />
                <span className="text-[11px] font-semibold text-red-300">Deleting records from the database. Please hold on...</span>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                disabled={deleting}
                onClick={() => setDocToDelete(null)}
                className="flex-1 py-2.5 px-4 border border-white/10 hover:bg-white/5 rounded-xl text-xs font-semibold text-gray-300 active:scale-[0.98] transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold shadow-[0_0_15px_rgba(220,38,38,0.5)] active:scale-[0.98] transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Permanently</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Blocked Deletion Info Modal */}
      {docBlockedToDelete && (
        <div className="fixed inset-0 bg-[#030305]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#030305] rounded-2xl max-w-md w-full p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10 flex flex-col relative animate-scale-up">
            <button
              onClick={() => setDocBlockedToDelete(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white active:scale-95 transition-all duration-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-amber-500/20 rounded-xl text-amber-400 border border-amber-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Cannot Delete Document</h3>
                <p className="text-xs text-amber-400 font-semibold">Active cloud integration detected</p>
              </div>
            </div>

            <p className="text-sm text-gray-400 leading-relaxed mb-6">
              The document <span className="font-bold text-white">"{docBlockedToDelete.name}"</span> is currently linked to an active cloud integration. To delete it, you must first disconnect (unlink) the cloud workbook.
            </p>

            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs p-3 rounded-xl mb-6">
              <span className="font-bold block mb-0.5 text-amber-400 uppercase tracking-wider text-[10px]">Action Required:</span>
              Please go to the <span className="font-bold text-amber-400">Linked Workbooks</span> section at the top of the page, click the disconnect button (trash bin icon), and then try deleting this document again.
            </div>

            <button
              onClick={() => setDocBlockedToDelete(null)}
              className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-xl text-xs font-bold shadow-[0_0_15px_rgba(255,255,255,0.1)] active:scale-[0.98] transition-all duration-100"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

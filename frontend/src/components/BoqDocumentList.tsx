'use client';

import { useState } from 'react';
import { FileText, Calendar, Eye, Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';

interface BoqDocument {
  id: number;
  project_id: number;
  name: string;
  file_hash: string;
  origin?: string;
  created_at: string;
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

  const handleDeleteClick = (doc: BoqDocument) => {
    // Check if the document's origin is actively linked to a cloud integration
    const isLinked = integrations?.some(
      (integration) => integration.provider === doc.origin && integration.project_id === doc.project_id
    );

    if (isLinked) {
      setDocBlockedToDelete(doc);
      return;
    }

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
        <span className="text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-100 px-2 py-0.5 rounded-full whitespace-nowrap">
          Cloud Sync
        </span>
      );
    }
    return (
      <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full whitespace-nowrap">
        AI Parsed
      </span>
    );
  };

  return (
    <div className="bg-white shadow-md rounded-2xl p-6 border border-gray-100">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-crimson-violet-50 rounded-xl flex items-center justify-center text-crimson-violet-600">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Attached Bills of Quantities</h2>
          <p className="text-xs text-gray-500">Up to 5 documents per project</p>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-2xl">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No BOQs linked yet.</p>
          <p className="text-xs text-gray-400 mt-1">Upload a PDF/Excel file or link a Google Sheet/OneDrive file to get started.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {documents.map((doc) => (
            <div key={doc.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 first:pt-0 last:pb-0 group">
              <div className="flex items-start space-x-3">
                <div className="p-2.5 bg-gray-50 rounded-xl text-gray-500 group-hover:bg-crimson-violet-50 group-hover:text-crimson-violet-600 transition-colors">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-bold text-gray-800 truncate max-w-[200px] sm:max-w-[320px]" title={doc.name}>
                      {doc.name}
                    </h4>
                    {getDocBadge(doc.origin)}
                  </div>
                  <div className="flex items-center text-xs text-gray-400 mt-1 space-x-3">
                    <span className="flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1" />
                      {formatDate(doc.created_at)}
                    </span>
                    <span className="truncate max-w-[120px] font-mono text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                      SHA: {doc.file_hash.substring(0, 8)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="self-end sm:self-center flex items-center space-x-2 flex-shrink-0">
                <button
                  onClick={() => onViewItems(doc.id, doc.name)}
                  className="flex items-center justify-center space-x-2 bg-[#fcfcfc] border border-gray-200 hover:border-crimson-violet-300 text-gray-700 hover:text-crimson-violet-600 font-semibold py-2 px-4 rounded-xl shadow-sm hover:shadow active:scale-[0.98] transition-all duration-100 text-sm"
                >
                  <Eye className="w-4 h-4" />
                  <span>View Items</span>
                </button>
                {onDeleteDocument && (
                  <button
                    onClick={() => handleDeleteClick(doc)}
                    className="p-2 border border-red-200 rounded-xl text-red-600 hover:bg-red-50 hover:border-red-300 active:scale-90 transition-all duration-100 shadow-sm"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 flex flex-col relative animate-scale-up">
            <button
              onClick={() => setDocToDelete(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 active:scale-95 transition-all duration-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-red-50 rounded-xl text-red-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Delete BOQ Document</h3>
                <p className="text-xs text-gray-400">This action is irreversible</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              Are you sure you want to permanently delete the BOQ document <span className="font-bold text-gray-800">"{docToDelete.name}"</span>? This will delete the document and all of its parsed items from the FieldOps database permanently. This is not a recoverable operation.
            </p>

            <div className="bg-blue-50 border border-blue-100 text-blue-800 text-xs p-3 rounded-xl mb-4">
              <span className="font-bold block mb-0.5 text-blue-900 uppercase tracking-wider text-[10px]">Cloud Storage Safeguard</span>
              Note: This will <span className="font-bold text-blue-900">NOT</span> delete the actual file in your cloud drive (Google Drive/OneDrive). It only deletes it from the local database.
            </div>

            {deleting && (
              <div className="flex items-center space-x-2 text-red-650 bg-red-50/70 border border-red-100 p-3 rounded-xl mb-6 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-red-600 flex-shrink-0" />
                <span className="text-[11px] font-semibold text-red-700">Deleting records from the database. Please hold on...</span>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                disabled={deleting}
                onClick={() => setDocToDelete(null)}
                className="flex-1 py-2.5 px-4 border border-gray-200 hover:bg-gray-50 rounded-xl text-xs font-semibold text-gray-700 active:scale-[0.98] transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow active:scale-[0.98] transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 flex flex-col relative animate-scale-up">
            <button
              onClick={() => setDocBlockedToDelete(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 active:scale-95 transition-all duration-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Cannot Delete Document</h3>
                <p className="text-xs text-gray-400">Active cloud integration detected</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              The document <span className="font-bold text-gray-800">"{docBlockedToDelete.name}"</span> is currently linked to an active cloud integration. To delete it, you must first disconnect (unlink) the cloud workbook.
            </p>

            <div className="bg-amber-50 border border-amber-100 text-amber-800 text-xs p-3 rounded-xl mb-6">
              <span className="font-bold block mb-0.5 text-amber-900 uppercase tracking-wider text-[10px]">Action Required:</span>
              Please go to the <span className="font-bold text-amber-900">Linked Workbooks</span> section at the top of the page, click the disconnect button (trash bin icon), and then try deleting this document again.
            </div>

            <button
              onClick={() => setDocBlockedToDelete(null)}
              className="w-full py-2.5 px-4 bg-gray-850 hover:bg-gray-900 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow active:scale-[0.98] transition-all duration-100"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

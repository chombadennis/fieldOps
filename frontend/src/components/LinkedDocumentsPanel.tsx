import { useState, useEffect } from 'react';
import { getDocumentEmbedUrl, getDocumentStreamUrl } from '@/services/api';
import {
  Folder,
  FileSpreadsheet,
  FileText,
  Loader2,
  AlertTriangle,
  ExternalLink,
  X,
  Unlink,
  Eye,
  RotateCw,
  Edit,
  Trash2
} from 'lucide-react';

interface Document {
  id: number;
  title: string;
  file_url: string;
  file_type?: string;
  origin?: string;
  cloud_file_id?: string;
  department?: string;
  integration_id?: number;
  extracted_data?: any;
}

interface LinkedDocumentsPanelProps {
  documents: Document[];
  onUnlink: (documentId: number) => Promise<void>;
  onDelete?: (documentId: number) => Promise<void>;
  unlinkingId?: number | null;
  deletingId?: number | null;
  title: string;
  emptyMessage?: string;
  docType?: string;
  onEnterData?: (doc: Document) => void;
}

export default function LinkedDocumentsPanel({
  documents = [],
  onUnlink,
  onDelete,
  unlinkingId = null,
  deletingId = null,
  title,
  emptyMessage = "No linked documents yet.",
  docType,
  onEnterData
}: LinkedDocumentsPanelProps) {
  const [activeDocPreview, setActiveDocPreview] = useState<Document | null>(null);
  const [docToDelete, setDocToDelete] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [fetchedEmbedUrl, setFetchedEmbedUrl] = useState<string | null>(null);
  const [loadingEmbedUrl, setLoadingEmbedUrl] = useState<boolean>(false);

  useEffect(() => {
    if (!activeDocPreview) {
      setFetchedEmbedUrl(null);
      setLoadingEmbedUrl(false);
      return;
    }

    setLoadingEmbedUrl(true);
    getDocumentEmbedUrl(activeDocPreview.id, 'view', docType)
      .then((data) => {
        if (data?.url) {
          setFetchedEmbedUrl(data.url);
        } else {
          setFetchedEmbedUrl(null);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch authenticated embed URL:', err);
        setFetchedEmbedUrl(null);
      })
      .finally(() => {
        setLoadingEmbedUrl(false);
      });
  }, [activeDocPreview]);

  const isCadFile = (name: string, fileType?: string) => {
    const cadExtensions = ['.dwg', '.dxf', '.rvt', '.rfa', '.dgn', '.step', '.stp', '.iges', '.igs', '.cad'];
    const lowerName = name.toLowerCase();
    const matchesExtension = cadExtensions.some(ext => lowerName.endsWith(ext));
    const matchesType = fileType ? (fileType.toLowerCase().includes('cad') || fileType.toLowerCase().includes('dwg')) : false;
    return matchesExtension || matchesType;
  };

  // OneDrive / SharePoint explicitly blocks iframes with X-Frame-Options: DENY
  const isOneDriveUrl = (url: string) => {
    return url.includes('onedrive.live.com') || url.includes('sharepoint.com') || url.includes('1drv.ms');
  };

  const getEmbedUrl = (url: string, cloudFileId?: string, isSpreadsheet?: boolean) => {
    if (!url && !cloudFileId) return '';
    const targetUrl = url || '';

    let fileId = cloudFileId;
    if (!fileId && targetUrl.includes('google.com')) {
      const match = targetUrl.match(/(?:file\/d\/|id=)([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        fileId = match[1];
      }
    }

    if (fileId && (targetUrl.includes('google') || targetUrl.includes('drive') || !targetUrl)) {
      if (isSpreadsheet || targetUrl.includes('spreadsheets')) {
        return `https://docs.google.com/spreadsheets/d/${fileId}/preview`;
      }
      return `https://docs.google.com/viewer?srcid=${fileId}&pid=explorer&efh=false&a=v&chrome=false&embedded=true`;
    }

    // Google Sheets
    if (targetUrl.includes('docs.google.com/spreadsheets')) {
      if (targetUrl.includes('/edit')) {
        return targetUrl.replace(/\/edit.*$/, '/htmlembed');
      }
      return targetUrl + '/htmlembed';
    }
    // Google Docs
    if (targetUrl.includes('docs.google.com/document')) {
      if (targetUrl.includes('/edit')) {
        return targetUrl.split('/edit')[0] + '/preview';
      }
      return targetUrl + '/preview';
    }
    // Google Drive file with /file/d/
    if (targetUrl.includes('drive.google.com/file/d/')) {
      const fileId = targetUrl.split('/file/d/')[1]?.split('/')[0];
      if (fileId) {
        return `https://drive.google.com/file/d/${fileId}/preview`;
      }
    }
    // Google Drive file with id= parameter
    if (targetUrl.includes('drive.google.com') && targetUrl.includes('id=')) {
      const match = targetUrl.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/file/d/${match[1]}/preview`;
      }
    }

    // OneDrive/SharePoint — blocks iframe embedding, return null to trigger CTA
    if (targetUrl.includes('onedrive.live.com') || targetUrl.includes('sharepoint.com') || targetUrl.includes('1drv.ms')) {
      return null;
    }
    return targetUrl;
  };

  const handleRefreshPreview = async () => {
    if (!activeDocPreview) return;
    setLoadingEmbedUrl(true);
    try {
      const data = await getDocumentEmbedUrl(activeDocPreview.id, 'view', docType);
      if (data?.url) {
        setFetchedEmbedUrl(data.url);
      }
    } catch (err) {
      console.error('Failed to refresh authenticated embed URL:', err);
    } finally {
      setLoadingEmbedUrl(false);
      setPreviewKey((prev) => prev + 1);
    }
  };

  const handleUnlinkClick = async (docId: number) => {
    await onUnlink(docId);
    if (activeDocPreview?.id === docId) {
      setActiveDocPreview(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!docToDelete) return;
    setIsDeleting(true);
    try {
      // Unlink first
      await onUnlink(docToDelete.id);
      // Permanently delete document data if onDelete callback is provided
      if (onDelete) {
        await onDelete(docToDelete.id);
      }
      if (activeDocPreview?.id === docToDelete.id) {
        setActiveDocPreview(null);
      }
      setDocToDelete(null);
    } catch (err) {
      console.error('Failed to permanently delete document data:', err);
      alert('Failed to delete document data.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* List / Grid of Linked Documents */}
      <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] space-y-4">
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-white drop-shadow-md font-inter">{title}</h4>
          <span className="text-[11px] font-bold text-neon-cyan bg-neon-cyan/20 px-2.5 py-0.5 rounded-full border border-neon-cyan/50 shadow-[0_0_10px_rgba(0,243,255,0.2)]">
            {documents.length} {documents.length === 1 ? 'file' : 'files'}
          </span>
        </div>

        {documents.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl bg-black/20">
            <FileText className="w-8 h-8 text-gray-500 mx-auto mb-2" />
            <p className="text-xs text-gray-400 font-medium">{emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => {
              const isPreviewActive = activeDocPreview?.id === doc.id;
              const isUnlinking = unlinkingId === doc.id;
              const isDeletingThis = deletingId === doc.id;
              const isGoogle = doc.origin === 'google' || doc.file_url.includes('google.com');
              const isOneDrive = doc.origin === 'onedrive' || doc.file_url.includes('onedrive.live.com') || doc.file_url.includes('sharepoint.com');
              const isFolder = doc.file_type?.toLowerCase().includes('folder');

              // File Icon class
              const isSpreadsheet = doc.file_type?.toLowerCase().includes('sheet') || doc.file_type?.toLowerCase().includes('spreadsheet') || doc.title.toLowerCase().endsWith('.xlsx') || doc.title.toLowerCase().endsWith('.xls');

              return (
                <div
                  key={doc.id}
                  className={`rounded-xl p-5 border flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all duration-300 hover:shadow-[0_4px_15px_rgba(0,0,0,0.3)] ${isPreviewActive
                      ? 'border-neon-cyan ring-2 ring-neon-cyan/50 bg-neon-cyan/10 shadow-[0_0_15px_rgba(0,243,255,0.2)]'
                      : 'border-white/10 bg-white/5 hover:border-neon-cyan/50 hover:bg-white/10'
                    }`}
                >
                  <div className="flex items-start space-x-4 min-w-0 flex-1">
                    <div className={`p-2.5 rounded-xl flex-shrink-0 transition-all duration-300 ${isPreviewActive
                        ? 'bg-neon-cyan text-black shadow-[0_0_10px_rgba(0,243,255,0.5)]'
                        : isSpreadsheet
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                          : isFolder
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                            : 'bg-neon-purple/20 text-neon-purple border border-neon-purple/50'
                      }`}>
                      {isSpreadsheet ? (
                        <FileSpreadsheet className="w-5 h-5" />
                      ) : isFolder ? (
                        <Folder className="w-5 h-5" />
                      ) : (
                        <FileText className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-white text-sm truncate flex items-center space-x-2 flex-wrap gap-y-1">
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-white hover:text-neon-cyan transition-colors inline-flex items-center space-x-1 drop-shadow-md"
                          title="Open document in cloud workspace (Login required)"
                        >
                          <span className="truncate max-w-[150px] md:max-w-[200px] lg:max-w-[400px]">{doc.title}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        </a>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded capitalize ${isGoogle
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                            : isOneDrive
                              ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/50'
                              : 'bg-white/10 text-gray-300 border border-white/20'
                          }`}>
                          {isGoogle ? 'Google Drive' : isOneDrive ? 'OneDrive' : 'Cloud File'}
                        </span>
                      </h4>
                      <p className="text-[10px] text-gray-400 mt-1 uppercase font-semibold">
                        {doc.file_type || 'PDF Document'}
                      </p>
                      <p className="text-[10px] text-gray-400 hover:text-dark-teal-800 mt-0.5 font-medium transition-colors cursor-help" title="To modify contents, open file directly in cloud workspace.">
                        Click name to edit in cloud (Login required)
                      </p>
                      {onEnterData && (!doc.extracted_data || !doc.extracted_data.items || doc.extracted_data.items.length === 0) ? (
                        <div className="mt-2 flex items-center space-x-2">
                          <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/50 px-2 py-0.5 rounded font-bold uppercase shadow-[0_0_8px_rgba(239,68,68,0.2)]">No Data Saved</span>
                          <button
                            disabled={isUnlinking || isDeletingThis}
                            onClick={() => onEnterData(doc)}
                            className="text-[10px] bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan border border-neon-cyan/50 px-2 py-0.5 rounded font-bold uppercase transition-colors active:scale-95 shadow-[0_0_8px_rgba(0,243,255,0.2)] disabled:opacity-50"
                          >
                            Enter Data
                          </button>
                        </div>
                      ) : onEnterData ? (
                        <div className="mt-2 flex items-center space-x-2">
                           <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 px-2 py-0.5 rounded font-bold uppercase shadow-[0_0_8px_rgba(16,185,129,0.2)]">Data Saved</span>
                           <button
                             disabled={isUnlinking || isDeletingThis}
                             onClick={() => onEnterData(doc)}
                             className="text-[10px] bg-white/10 hover:bg-white/20 text-gray-300 border border-white/20 px-2 py-0.5 rounded font-bold uppercase transition-colors active:scale-95 disabled:opacity-50"
                           >
                             Update Data
                           </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-2 border-t lg:border-t-0 border-white/10 pt-3 lg:pt-0 w-full lg:w-auto">
                    <button
                      disabled={isUnlinking || isDeletingThis}
                      onClick={() => setActiveDocPreview(isPreviewActive ? null : doc)}
                      className={`py-1.5 px-3 border rounded-lg shadow-sm text-xs font-semibold flex items-center space-x-1.5 transition-all duration-200 disabled:opacity-50 ${isPreviewActive
                          ? 'bg-neon-cyan border-neon-cyan text-black hover:bg-white shadow-[0_0_10px_rgba(0,243,255,0.5)]'
                          : 'border-white/20 hover:border-neon-cyan/50 text-gray-300 bg-black/40 hover:bg-neon-cyan/10 hover:text-neon-cyan'
                        }`}
                      title={isPreviewActive ? 'Hide inline preview' : 'Open inline preview'}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{isPreviewActive ? 'Hide Preview' : 'Inline Preview'}</span>
                    </button>



                    {/* Delete Button */}
                    <button
                      disabled={isUnlinking || isDeletingThis}
                      onClick={() => setDocToDelete(doc)}
                      className="p-1.5 border border-red-500/50 hover:border-red-400 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 bg-black/40 shadow-[0_0_8px_rgba(239,68,68,0.15)]"
                      title="Delete document data permanently from database"
                    >
                      {isDeletingThis ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Custom Irreversible Deletion Warning Modal */}
      {docToDelete && (
        <div className="fixed inset-0 bg-[#030305]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#030305] rounded-2xl max-w-md w-full p-6 shadow-[0_0_50px_rgba(239,68,68,0.1)] border border-white/10 flex flex-col relative animate-scale-up">
            <button
              onClick={() => setDocToDelete(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white active:scale-95 transition-all duration-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-red-500/20 rounded-xl text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white drop-shadow-md">Irreversible Deletion Warning</h3>
                <p className="text-xs text-red-400 font-semibold">Database Data Purge</p>
              </div>
            </div>

            <p className="text-sm text-gray-300 leading-relaxed mb-4">
              You are about to perform an <span className="font-bold text-red-400">irreversible deletion</span> of the document <span className="font-bold text-white">"{docToDelete.title}"</span> from the database and all of its records will be deleted permanently. Do you wish to continue?
            </p>

            <div className="bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-xs p-3 rounded-xl mb-4 shadow-[0_0_15px_rgba(0,243,255,0.1)]">
              <span className="font-bold block mb-0.5 text-white uppercase tracking-wider text-[10px] drop-shadow-md">Cloud Storage Safeguard</span>
              Note: This action will <span className="font-bold text-white">NOT</span> delete the actual file in your cloud drive.
            </div>

            {isDeleting && (
              <div className="flex items-center space-x-2 text-red-400 bg-red-500/10 border border-red-500/30 p-3 rounded-xl mb-4 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-red-500 flex-shrink-0" />
                <span className="text-[11px] font-semibold">Unlinking and permanently deleting data from database...</span>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                disabled={isDeleting}
                onClick={() => setDocToDelete(null)}
                className="flex-1 py-2.5 px-4 border border-white/20 hover:bg-white/10 rounded-xl text-xs font-semibold text-gray-300 active:scale-[0.98] transition-all duration-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 px-4 bg-red-500/20 hover:bg-red-500 border border-red-500/50 hover:text-white text-red-400 rounded-xl text-xs font-semibold shadow-[0_0_10px_rgba(239,68,68,0.2)] active:scale-[0.98] transition-all duration-100 disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                {isDeleting ? (
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

      {/* Inline Document Preview Panel */}
      {activeDocPreview && (
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-6 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan rounded-xl shadow-[0_0_10px_rgba(0,243,255,0.2)]">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white font-lexend drop-shadow-md">{activeDocPreview.title}</h4>
                <p className="text-[10px] text-gray-400 font-bold uppercase">{activeDocPreview.file_type || 'Document'}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {(() => {
                const isDocSpreadsheet = activeDocPreview.file_type?.toLowerCase().includes('sheet') ||
                  activeDocPreview.file_type?.toLowerCase().includes('spreadsheet') ||
                  /\.(xlsx|xls|csv|ods|gsheet)$/i.test(activeDocPreview.title);

                const isGoogle = (activeDocPreview.origin && activeDocPreview.origin.toLowerCase().includes('google')) || activeDocPreview.file_url.includes('google.com');
                const isOneDrive = (activeDocPreview.origin && (activeDocPreview.origin.toLowerCase().includes('onedrive') || activeDocPreview.origin.toLowerCase().includes('microsoft'))) || isOneDriveUrl(activeDocPreview.file_url);

                if (isGoogle) {
                  return (
                    <a
                      href={activeDocPreview.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg active:scale-[0.98] transition-all text-xs font-bold shadow-sm"
                      title={isDocSpreadsheet ? "Open and edit spreadsheet directly in Google Sheets" : "Open document in Google Drive"}
                    >
                      {isDocSpreadsheet ? <Edit className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                      <span>{isDocSpreadsheet ? 'Edit in Google Sheets' : 'Open in Google Drive'}</span>
                    </a>
                  );
                }

                if (isOneDrive) {
                  return (
                    <a
                      href={activeDocPreview.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg active:scale-[0.98] transition-all text-xs font-bold shadow-sm"
                      title={isDocSpreadsheet ? "Open and edit spreadsheet directly in Excel Online" : "Open document in OneDrive"}
                    >
                      {isDocSpreadsheet ? <Edit className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                      <span>{isDocSpreadsheet ? 'Edit in Excel Online' : 'Open in OneDrive'}</span>
                    </a>
                  );
                }

                return (
                  <a
                    href={activeDocPreview.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-dark-teal-800 hover:bg-dark-teal-900 text-white rounded-lg active:scale-[0.98] transition-all text-xs font-bold shadow-sm"
                    title="Open file directly in cloud workspace"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Document</span>
                  </a>
                );
              })()}

              <div className="h-4 w-px bg-white/20 mx-1" />

              <button
                onClick={handleRefreshPreview}
                className="p-2 text-gray-400 hover:text-neon-cyan hover:bg-white/10 rounded-lg active:scale-95 transition-all"
                title="Refresh preview contents"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <a
                href={activeDocPreview.file_url}
                target="_blank"
                rel="noreferrer"
                className="p-2 text-gray-400 hover:text-neon-cyan hover:bg-white/10 rounded-lg active:scale-95 transition-all"
                title="Open in new window"
              >
                <ExternalLink className="w-4 h-4" />
              </a>

              <button
                onClick={() => setActiveDocPreview(null)}
                className="p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg active:scale-95 transition-all"
                title="Close Preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {loadingEmbedUrl ? (
            <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-2xl border border-gray-200 min-h-[500px] text-center">
              <Loader2 className="w-8 h-8 text-dark-teal-600 animate-spin mb-4" />
              <p className="text-xs font-semibold text-gray-600">Generating secure embed preview...</p>
            </div>
          ) : fetchedEmbedUrl ? (
            <div className="relative min-h-[800px] w-full bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 flex flex-col">
              <div className="bg-indigo-50/80 border-b border-indigo-100 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-indigo-950 gap-2 flex-shrink-0">
                <span className="font-medium">
                  {activeDocPreview.origin === 'onedrive' || (activeDocPreview.file_url || '').includes('sharepoint') || (activeDocPreview.file_url || '').includes('onedrive') || (activeDocPreview.file_url || '').includes('live.com')
                    ? 'OneDrive Document Preview'
                    : 'Google Drive Document Preview'}{' '}
                  (If your browser restricts 3rd-party iframe cookies for private files, open directly):
                </span>
              </div>
              <iframe
                key={previewKey}
                src={fetchedEmbedUrl}
                width="100%"
                height="800"
                className="border-none w-full flex-1 shadow-inner"
                allow="autoplay; clipboard-write; encrypted-media"
              />
            </div>
          ) : isCadFile(activeDocPreview.title, activeDocPreview.file_type) ? (
            <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-2xl border border-gray-200 min-h-[400px] text-center">
              <div className="p-4 bg-amber-50 text-amber-650 rounded-full mb-4">
                <FileText className="w-10 h-10" />
              </div>
              <h5 className="text-sm font-bold text-gray-800 font-lexend mb-2">Inline Preview Unavailable</h5>
              <p className="text-xs text-gray-500 max-w-sm mb-6 leading-relaxed">
                CAD models and DWG blueprints cannot be embedded or previewed inline. Please open the file directly in your cloud workspace to view and edit.
              </p>
              <a
                href={activeDocPreview.file_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center px-4 py-2.5 bg-dark-teal-800 hover:bg-dark-teal-900 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 space-x-1.5"
              >
                <span>Open CAD File in Workspace</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : isOneDriveUrl(activeDocPreview.file_url) ? (
            <div className="flex flex-col items-center justify-center p-12 bg-indigo-50/40 rounded-2xl border border-indigo-100 min-h-[400px] text-center">
              <div className="p-4 bg-indigo-100 text-indigo-600 rounded-full mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" viewBox="0 0 48 48" fill="none">
                  <path d="M27.3 16.3a10 10 0 0 1 18.2 5.9 7.5 7.5 0 0 1-1.5 14.8H12a8 8 0 0 1-1.5-15.8 12 12 0 0 1 16.8-4.9z" fill="#0078d4" />
                </svg>
              </div>
              <h5 className="text-sm font-bold text-gray-800 font-lexend mb-2">OneDrive Inline Preview Unavailable</h5>
              <p className="text-xs text-gray-500 max-w-sm mb-2 leading-relaxed">
                Microsoft OneDrive and SharePoint block embedded previews in third-party apps for security reasons (<span className="font-semibold">X-Frame-Options: DENY</span>).
              </p>
              <p className="text-xs text-gray-400 max-w-sm mb-6 leading-relaxed">
                To view or edit this file, open it directly in your OneDrive workspace. You will need to be signed in to your Microsoft account.
              </p>
              <a
                href={activeDocPreview.file_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center px-4 py-2.5 bg-[#0078d4] hover:bg-[#006cbf] text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 space-x-1.5"
              >
                <span>Open in OneDrive</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : (
            (() => {
              const isDocSpreadsheet = activeDocPreview.file_type?.toLowerCase().includes('sheet') ||
                activeDocPreview.file_type?.toLowerCase().includes('spreadsheet') ||
                /\.(xlsx|xls|csv|ods|gsheet)$/i.test(activeDocPreview.title);

              const iframeSrc = isDocSpreadsheet
                ? (fetchedEmbedUrl || getEmbedUrl(activeDocPreview.file_url, activeDocPreview.cloud_file_id, isDocSpreadsheet) || '')
                : getDocumentStreamUrl(activeDocPreview.id, docType);

              return (
                <iframe
                  key={previewKey}
                  src={iframeSrc}
                  width="100%"
                  height="800"
                  className="border-none w-full flex-1 shadow-inner"
                  allow="autoplay; clipboard-write; encrypted-media"
                />
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}

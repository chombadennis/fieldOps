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
  Edit
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
}

interface LinkedDocumentsPanelProps {
  documents: Document[];
  onUnlink: (documentId: number) => Promise<void>;
  unlinkingId: number | null;
  title: string;
  emptyMessage?: string;
  docType?: 'ipc' | 'regular';
}

export default function LinkedDocumentsPanel({
  documents = [],
  onUnlink,
  unlinkingId = null,
  title,
  emptyMessage = "No linked documents yet.",
  docType
}: LinkedDocumentsPanelProps) {
  const [activeDocPreview, setActiveDocPreview] = useState<Document | null>(null);
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

  return (
    <div className="space-y-6">
      {/* List / Grid of Linked Documents */}
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-inter">{title}</h4>
          <span className="text-[11px] font-bold text-dark-teal-700 bg-dark-teal-50 px-2.5 py-0.5 rounded-full border border-dark-teal-100">
            {documents.length} {documents.length === 1 ? 'file' : 'files'}
          </span>
        </div>

        {documents.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-gray-200 rounded-2xl">
            <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400 font-medium">{emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => {
              const isPreviewActive = activeDocPreview?.id === doc.id;
              const isUnlinking = unlinkingId === doc.id;
              const isGoogle = doc.origin === 'google' || doc.file_url.includes('google.com');
              const isOneDrive = doc.origin === 'onedrive' || doc.file_url.includes('onedrive.live.com') || doc.file_url.includes('sharepoint.com');
              const isFolder = doc.file_type?.toLowerCase().includes('folder');

              // File Icon class
              const isSpreadsheet = doc.file_type?.toLowerCase().includes('sheet') || doc.file_type?.toLowerCase().includes('spreadsheet') || doc.title.toLowerCase().endsWith('.xlsx') || doc.title.toLowerCase().endsWith('.xls');

              return (
                <div
                  key={doc.id}
                  className={`rounded-xl p-5 border flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all duration-300 hover:shadow-md ${isPreviewActive
                      ? 'border-dark-teal-500 ring-2 ring-dark-teal-500/20 bg-gradient-to-br from-dark-teal-50/10 to-white'
                      : 'border-gray-100 bg-gradient-to-br from-gray-50/50 to-white'
                    }`}
                >
                  <div className="flex items-start space-x-4 min-w-0 flex-1">
                    <div className={`p-2.5 rounded-xl flex-shrink-0 transition-all duration-300 ${isPreviewActive
                        ? 'bg-dark-teal-900 text-white'
                        : isSpreadsheet
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          : isFolder
                            ? 'bg-amber-50 text-amber-600 border border-amber-100'
                            : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
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
                      <h4 className="font-bold text-gray-800 text-sm truncate flex items-center space-x-2 flex-wrap gap-y-1">
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-dark-teal-900 hover:text-dark-teal-700 transition-colors inline-flex items-center space-x-1"
                          title="Open document in cloud workspace (Login required)"
                        >
                          <span className="truncate max-w-[150px] md:max-w-[200px] lg:max-w-[400px]">{doc.title}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        </a>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded capitalize ${isGoogle
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : isOneDrive
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                              : 'bg-slate-50 text-slate-700 border border-slate-100'
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
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-2 border-t lg:border-t-0 border-gray-50 pt-3 lg:pt-0 w-full lg:w-auto">
                    <button
                      onClick={() => setActiveDocPreview(isPreviewActive ? null : doc)}
                      className={`py-1.5 px-3 border rounded-lg shadow-sm text-xs font-semibold flex items-center space-x-1.5 transition-all duration-200 ${isPreviewActive
                          ? 'bg-dark-teal-900 border-dark-teal-900 text-white hover:bg-dark-teal-950'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                        }`}
                      title={isPreviewActive ? 'Hide inline preview' : 'Open inline preview'}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{isPreviewActive ? 'Hide Preview' : 'Inline Preview'}</span>
                    </button>

                    <button
                      disabled={isUnlinking}
                      onClick={() => handleUnlinkClick(doc.id)}
                      className="p-1.5 border border-red-100 hover:border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Disconnect document link"
                    >
                      {isUnlinking ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                      ) : (
                        <Unlink className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inline Document Preview Panel */}
      {activeDocPreview && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-md p-6 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-gray-150 pb-3">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-dark-teal-50 text-dark-teal-700 rounded-xl">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-800 font-lexend">{activeDocPreview.title}</h4>
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

              <div className="h-4 w-px bg-gray-200 mx-1" />

              <button
                onClick={handleRefreshPreview}
                className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg active:scale-95 transition-all"
                title="Refresh preview contents"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <a
                href={activeDocPreview.file_url}
                target="_blank"
                rel="noreferrer"
                className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg active:scale-95 transition-all"
                title="Open in new window"
              >
                <ExternalLink className="w-4 h-4" />
              </a>

              <button
                onClick={() => setActiveDocPreview(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg active:scale-95 transition-all"
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
                : getDocumentStreamUrl(activeDocPreview.id);

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

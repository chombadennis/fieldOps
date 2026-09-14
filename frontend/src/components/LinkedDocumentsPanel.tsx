import { useState, useEffect } from 'react';
import { getDocumentEmbedUrl, getDocumentStreamUrl, getCurrentUser, updateDocumentContext, getProjectNotes, createProjectNote, createProjectDocument, analyzeDocument, suggestContext } from '@/services/api';
import CollaborationPanel from '@/components/CollaborationPanel';
import DecisionActionLog from '@/components/DecisionActionLog';
import ArtifactIntelligencePanel from '@/components/ArtifactIntelligencePanel';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  Trash2,
  MessageSquarePlus,
  Check,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  ShieldCheck,
  History,
  ArrowRightCircle,
  BrainCircuit
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
  uploaded_by?: number;
  cloud_email?: string;
  context_description?: string;
  link_reason?: string;
  review_requested_from?: number[];
  supersedes_id?: number;
  revision_label?: string;
  is_archived?: boolean;
  ai_insights?: any;
  metadata_map?: any;
  name?: string;
}

interface LinkedDocumentsPanelProps {
  documents: Document[];
  projectId?: string | number;
  onUnlink: (documentId: number) => Promise<void>;
  onDelete?: (documentId: number) => Promise<void>;
  unlinkingId?: number | null;
  deletingId?: number | null;
  title: string;
  emptyMessage?: string;
  docType?: string;
  onEnterData?: (doc: Document) => void;
  onViewBoqItems?: (boqId: number, name: string) => void;
}

export default function LinkedDocumentsPanel({
  documents = [],
  projectId,
  onUnlink,
  onDelete,
  unlinkingId = null,
  deletingId = null,
  title,
  emptyMessage = "No linked documents yet.",
  docType,
  onEnterData,
  onViewBoqItems
}: LinkedDocumentsPanelProps) {
  const [activeDocPreview, setActiveDocPreview] = useState<Document | null>(null);
  const [docToDelete, setDocToDelete] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [fetchedEmbedUrl, setFetchedEmbedUrl] = useState<string | null>(null);
  const [loadingEmbedUrl, setLoadingEmbedUrl] = useState<boolean>(false);

  // Context editing state — keyed by document ID
  const [editingContextId, setEditingContextId] = useState<number | null>(null);
  const [contextDraft, setContextDraft] = useState<{ description: string; reason: string }>({ description: '', reason: '' });
  const [savingContextId, setSavingContextId] = useState<number | null>(null);
  const [localContext, setLocalContext] = useState<Record<number, { context_description?: string; link_reason?: string }>>({});
  const [suggestingContextId, setSuggestingContextId] = useState<number | null>(null);

  // Phase 2 & 3: Discussion Board & Decision Log state
  const [activeDiscussionDoc, setActiveDiscussionDoc] = useState<Document | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'discussion' | 'decisions' | 'insights'>('discussion');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const queryClient = useQueryClient();

  const { data: discussionNotes = [], isLoading: loadingNotes } = useQuery({
    queryKey: ['documentNotes', projectId, activeDiscussionDoc?.id],
    queryFn: () => getProjectNotes(projectId!, undefined, activeDiscussionDoc!.id),
    enabled: !!activeDiscussionDoc && !!projectId,
  });

  const handleAddDocumentNote = async (n: { content: string; department: string; is_issue: boolean; priority: string }) => {
    if (!projectId || !activeDiscussionDoc) return;
    await createProjectNote(projectId, {
      ...n,
      document_id: activeDiscussionDoc.id
    });
    queryClient.invalidateQueries({ queryKey: ['documentNotes', projectId, activeDiscussionDoc.id] });
  };

  // Phase 4: Revision Tracking
  const [showHistory, setShowHistory] = useState(false);
  const [supersedingDoc, setSupersedingDoc] = useState<Document | null>(null);
  const [supersedeDraft, setSupersedeDraft] = useState({ title: '', file_url: '', revision_label: '' });
  const [isSubmittingSupersede, setIsSubmittingSupersede] = useState(false);

  const handleSupersede = async () => {
    if (!projectId || !supersedingDoc || !supersedeDraft.title || !supersedeDraft.file_url) return;
    setIsSubmittingSupersede(true);
    try {
      await createProjectDocument(projectId, {
        title: supersedeDraft.title,
        file_url: supersedeDraft.file_url,
        file_type: 'link',
        origin: 'link',
        department: supersedingDoc.department,
        supersedes_id: supersedingDoc.id,
        revision_label: supersedeDraft.revision_label
      });
      // The parent relies on 'onUnlink' to trigger a refresh sometimes, but ideally we trigger a refetch
      // If `onUnlink` triggers fetch, we can call a generic onRefresh if available, or just reload.
      window.location.reload(); // Simple reload to get fresh data for now
    } catch (err) {
      console.error(err);
      alert('Failed to supersede document.');
    } finally {
      setIsSubmittingSupersede(false);
    }
  };

  // State for current user to enforce smart conditional previews
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    getCurrentUser().then(user => setCurrentUser(user)).catch(console.error);
  }, []);

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
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${showHistory ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}
            >
              <History className="w-3.5 h-3.5" />
              <span>View History</span>
            </button>
            <span className="text-[11px] font-bold text-neon-cyan bg-neon-cyan/20 px-2.5 py-0.5 rounded-full border border-neon-cyan/50 shadow-[0_0_10px_rgba(0,243,255,0.2)]">
              {documents.length} {documents.length === 1 ? 'file' : 'files'}
            </span>
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl bg-black/20">
            <FileText className="w-8 h-8 text-gray-500 mx-auto mb-2" />
            <p className="text-xs text-gray-400 font-medium">{emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {documents.filter(d => showHistory || !d.is_archived).map((doc) => {
              const isPreviewActive = activeDocPreview?.id === doc.id;
              const isUnlinking = unlinkingId === doc.id;
              const isDeletingThis = deletingId === doc.id;
              const isGoogle = doc.origin === 'google' || (doc.file_url && doc.file_url.includes('google.com'));
              const isOneDrive = doc.origin === 'onedrive' || (doc.file_url && (doc.file_url.includes('onedrive.live.com') || doc.file_url.includes('sharepoint.com')));
              const isFolder = doc.file_type?.toLowerCase().includes('folder');
              const newerDoc = documents.find(d => d.supersedes_id === doc.id);

              // File Icon class
              const isSpreadsheet = doc.file_type?.toLowerCase().includes('sheet') || doc.file_type?.toLowerCase().includes('spreadsheet') || doc.title.toLowerCase().endsWith('.xlsx') || doc.title.toLowerCase().endsWith('.xls');

              return (
                <div
                  key={doc.id}
                  className={`group rounded-xl p-5 border flex flex-col transition-all duration-300 hover:shadow-[0_4px_15px_rgba(0,0,0,0.3)] ${isPreviewActive
                      ? 'border-neon-cyan ring-2 ring-neon-cyan/50 bg-neon-cyan/10 shadow-[0_0_15px_rgba(0,243,255,0.2)]'
                      : doc.is_archived
                        ? 'border-white/5 bg-black/20 opacity-70'
                        : 'border-white/10 bg-white/5 hover:border-neon-cyan/50 hover:bg-white/10'
                    }`}
                >
                  {doc.is_archived && (
                    <div className="mb-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-black/40 px-2 py-1 rounded">
                      <span>Archived</span>
                      {newerDoc && (
                        <span className="flex items-center gap-1 text-indigo-400">
                          Superseded by <ArrowRightCircle className="w-3 h-3" /> {newerDoc.revision_label || newerDoc.title}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-start space-x-4 mb-4">
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
                        {doc.file_url ? (
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline text-white hover:text-neon-cyan transition-colors inline-flex items-center space-x-1 drop-shadow-md"
                            title="Open document in cloud workspace (Login required)"
                            onClick={(e) => {
                              if (currentUser && doc.uploaded_by !== currentUser.id) {
                                alert("You are opening a document linked by another user. If you do not have permission, Google/Microsoft will prompt you to request access.");
                              }
                            }}
                          >
                            <span className="truncate max-w-[150px] md:max-w-[100px] lg:max-w-[200px]">{doc.title}</span>
                            <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          </a>
                        ) : (
                          <span className="text-white drop-shadow-md truncate max-w-[150px] md:max-w-[100px] lg:max-w-[200px]">{doc.title}</span>
                        )}
                      </h4>
                      {doc.revision_label && (
                        <span className="inline-block bg-white/10 border border-white/20 text-white text-[9px] font-bold uppercase px-1.5 py-0.5 rounded mt-1">
                          {doc.revision_label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* --- Phase 1: Artifact Context Block --- */}
                  {(() => {
                    const saved = localContext[doc.id];
                    const displayDesc = saved?.context_description ?? doc.context_description;
                    const displayReason = saved?.link_reason ?? doc.link_reason;
                    const isEditing = editingContextId === doc.id;
                    const isSaving = savingContextId === doc.id;

                    return (
                      <div className="mt-auto mb-4">
                        {!isEditing && (displayDesc || displayReason) && (
                          <div className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 space-y-1">
                            {displayReason && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-neon-cyan bg-neon-cyan/10 border border-neon-cyan/30 px-2 py-0.5 rounded-full">
                                {displayReason}
                              </span>
                            )}
                            {displayDesc && (
                              <p className="text-xs text-gray-300 leading-relaxed mt-1">{displayDesc}</p>
                            )}
                            <button
                              onClick={() => {
                                setContextDraft({ description: displayDesc || '', reason: displayReason || '' });
                                setEditingContextId(doc.id);
                              }}
                              className="text-[10px] text-gray-500 hover:text-neon-cyan transition-colors flex items-center gap-1 mt-1"
                            >
                              <Edit className="w-2.5 h-2.5" /> Edit context
                            </button>
                          </div>
                        )}

                        {isEditing && (
                          <div className="bg-black/40 border border-neon-cyan/30 rounded-xl p-3 space-y-2 shadow-[0_0_12px_rgba(0,243,255,0.08)]">
                            <div className="flex justify-between items-center">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-neon-cyan">Add Context</p>
                              {projectId && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setSuggestingContextId(doc.id);
                                    try {
                                      const suggestion = await suggestContext(projectId as number, doc.id);
                                      setContextDraft({
                                        description: suggestion.description || contextDraft.description,
                                        reason: suggestion.reason || contextDraft.reason
                                      });
                                    } catch (e) {
                                      console.error("Failed to suggest context", e);
                                    } finally {
                                      setSuggestingContextId(null);
                                    }
                                  }}
                                  disabled={suggestingContextId === doc.id}
                                  className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-fuchsia-400 hover:text-white bg-fuchsia-500/10 hover:bg-fuchsia-500/30 border border-fuchsia-500/30 px-2 py-1 rounded transition-colors disabled:opacity-50"
                                >
                                  {suggestingContextId === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <BrainCircuit className="w-3 h-3" />}
                                  {suggestingContextId === doc.id ? 'Generating...' : 'Auto-Fill'}
                                </button>
                              )}
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400 block mb-1">Why was this linked?</label>
                              <input
                                type="text"
                                value={contextDraft.reason}
                                onChange={(e) => setContextDraft(d => ({ ...d, reason: e.target.value }))}
                                placeholder="e.g. Budget revision, New programme, Claim submitted"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-neon-cyan/50 transition-colors"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400 block mb-1">What is this document?</label>
                              <textarea
                                value={contextDraft.description}
                                onChange={(e) => setContextDraft(d => ({ ...d, description: e.target.value }))}
                                placeholder="Brief description of what this document represents..."
                                rows={2}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-neon-cyan/50 transition-colors resize-none"
                              />
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                disabled={isSaving}
                                onClick={async () => {
                                  if (!projectId) return;
                                  setSavingContextId(doc.id);
                                  try {
                                    await updateDocumentContext(projectId, doc.id, {
                                      context_description: contextDraft.description || undefined,
                                      link_reason: contextDraft.reason || undefined,
                                    });
                                    setLocalContext(prev => ({
                                      ...prev,
                                      [doc.id]: { context_description: contextDraft.description, link_reason: contextDraft.reason }
                                    }));
                                    setEditingContextId(null);
                                  } catch (e) {
                                    console.error('Failed to save context', e);
                                  } finally {
                                    setSavingContextId(null);
                                  }
                                }}
                                className="text-[10px] bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan border border-neon-cyan/50 px-3 py-1 rounded-lg font-bold uppercase transition-colors active:scale-95 flex items-center gap-1 disabled:opacity-50"
                              >
                                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                {isSaving ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={() => setEditingContextId(null)}
                                className="text-[10px] text-gray-400 hover:text-white transition-colors px-2 py-1"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {!isEditing && !displayDesc && !displayReason && (
                          <button
                            onClick={() => {
                              setContextDraft({ description: '', reason: '' });
                              setEditingContextId(doc.id);
                            }}
                            className="py-1 px-2.5 text-[10px] font-bold uppercase tracking-wider text-neon-cyan border border-neon-cyan/30 rounded-lg hover:bg-neon-cyan/10 hover:shadow-[0_0_10px_rgba(0,243,255,0.15)] transition-all flex items-center gap-1.5 mt-2 w-max"
                          >
                            <MessageSquarePlus className="w-3.5 h-3.5" /> Add context
                          </button>
                        )}
                      </div>
                    );
                  })()}
                  {/* --- End Phase 1 --- */}

                  <div className="flex flex-wrap items-center gap-2 mt-auto pt-3 border-t border-white/5">
                    {(!currentUser || doc.uploaded_by === currentUser.id) && (
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
                    )}
                    
                    {/* View BoQ/Schedule Items Button */}
                    {(doc.department === 'boq' || doc.department === 'activity_schedule') && onViewBoqItems && (
                      <button
                        disabled={isUnlinking || isDeletingThis}
                        onClick={() => onViewBoqItems(doc.extracted_data?.boq_id || doc.id, doc.title || doc.name || '')}
                        className="py-1.5 px-3 border border-emerald-500/50 rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 bg-emerald-500/10 shadow-[0_0_8px_rgba(16,185,129,0.15)] flex items-center space-x-1.5 text-xs font-semibold"
                        title={doc.department === 'boq' ? "View parsed BOQ items" : "View parsed Schedule items"}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
                        </svg>
                        <span>View Items</span>
                      </button>
                    )}

                    {/* Discuss Button Removed per user request */}

                    {/* Supersede Button */}
                    {!doc.is_archived && (
                      <button
                        disabled={isUnlinking || isDeletingThis}
                        onClick={() => {
                          setSupersedingDoc(doc);
                          setSupersedeDraft({ title: '', file_url: '', revision_label: '' });
                        }}
                        className="py-1.5 px-3 border border-amber-500/50 rounded-lg text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50 bg-amber-500/10 flex items-center space-x-1.5 text-xs font-semibold"
                        title="Upload a new version of this document"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>Supersede</span>
                      </button>
                    )}

                    {/* Delete Button */}
                    {(!currentUser || doc.uploaded_by === currentUser.id) && (
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
                    )}
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

      {/* Document Discussion Modal */}
      {activeDiscussionDoc && (
        <div className="fixed inset-0 bg-[#030305]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#030305] rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-[0_0_50px_rgba(99,102,241,0.1)] border border-white/10 relative overflow-hidden">
            <div className="p-6 border-b border-white/10 shrink-0 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white font-lexend flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-indigo-400" />
                  Artifact Operations Center
                </h3>
                <p className="text-xs text-gray-400 mt-1">Artifact: <span className="text-white font-semibold">{activeDiscussionDoc.title}</span></p>
                {/* Surface Context */}
                {(() => {
                  const saved = localContext[activeDiscussionDoc.id];
                  const displayDesc = saved?.context_description ?? activeDiscussionDoc.context_description;
                  const displayReason = saved?.link_reason ?? activeDiscussionDoc.link_reason;
                  if (displayDesc || displayReason) {
                    return (
                      <div className="mt-3 bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl max-w-xl">
                        {displayReason && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 rounded-full inline-block mb-1">
                            {displayReason}
                          </span>
                        )}
                        {displayDesc && <p className="text-xs text-gray-300">{displayDesc}</p>}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              <button
                onClick={() => setActiveDiscussionDoc(null)}
                className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex px-6 pt-2 border-b border-white/5 space-x-6">
              <button
                onClick={() => setActiveModalTab('discussion')}
                className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 ${activeModalTab === 'discussion' ? 'border-indigo-400 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
              >
                <MessageCircle className="w-4 h-4" /> Discussion Thread
              </button>
              <button
                onClick={() => setActiveModalTab('decisions')}
                className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 ${activeModalTab === 'decisions' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
              >
                <ShieldCheck className="w-4 h-4" /> Decisions & Actions
              </button>
              <button
                onClick={() => setActiveModalTab('insights')}
                className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 ${activeModalTab === 'insights' ? 'border-neon-cyan text-neon-cyan' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
              >
                <BrainCircuit className="w-4 h-4" /> Context Insights
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto grow">
                  <CollaborationPanel
                    projectId={projectId as number}
                    module={activeDiscussionDoc.department || 'General'}
                    moduleName={activeDiscussionDoc.title}
                  />

              {activeModalTab === 'decisions' && projectId && (
                <DecisionActionLog projectId={projectId as number} documentId={activeDiscussionDoc.id} />
              )}

              {activeModalTab === 'insights' && projectId && (
                <div className="space-y-4">
                  {!activeDiscussionDoc.ai_insights && (
                    <div className="flex justify-end mb-2">
                      <button
                        disabled={isAnalyzing}
                        onClick={async () => {
                          setIsAnalyzing(true);
                          try {
                            const updatedDoc = await analyzeDocument(projectId, activeDiscussionDoc.id);
                            setActiveDiscussionDoc(updatedDoc);
                            queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
                          } catch (e) {
                            console.error('Analysis failed', e);
                            alert('Failed to analyze document');
                          } finally {
                            setIsAnalyzing(false);
                          }
                        }}
                        className="py-2 px-4 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 rounded-xl text-xs font-bold tracking-widest uppercase flex items-center gap-2 hover:bg-neon-cyan hover:text-black transition-colors disabled:opacity-50"
                      >
                        {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                        {isAnalyzing ? 'Analyzing...' : 'Generate Context Insights'}
                      </button>
                    </div>
                  )}
                  <ArtifactIntelligencePanel document={activeDiscussionDoc} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Supersede Modal */}
      {supersedingDoc && (
        <div className="fixed inset-0 bg-[#030305]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#030305] rounded-3xl max-w-md w-full shadow-[0_0_50px_rgba(245,158,11,0.1)] border border-white/10 p-6 relative overflow-hidden">
            <h3 className="text-lg font-bold text-white font-lexend mb-4">Supersede Document</h3>
            <p className="text-xs text-gray-400 mb-6">You are replacing <span className="font-bold text-white">{supersedingDoc.title}</span>. The old document will be archived and this new link will take its place.</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase">New Document Title</label>
                <input
                  type="text"
                  placeholder="e.g. BoQ - Rev 2"
                  value={supersedeDraft.title}
                  onChange={e => setSupersedeDraft(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full mt-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase">Cloud Link (URL)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={supersedeDraft.file_url}
                  onChange={e => setSupersedeDraft(prev => ({ ...prev, file_url: e.target.value }))}
                  className="w-full mt-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase">Revision Label (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. v2.0"
                  value={supersedeDraft.revision_label}
                  onChange={e => setSupersedeDraft(prev => ({ ...prev, revision_label: e.target.value }))}
                  className="w-full mt-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-8">
              <button
                disabled={isSubmittingSupersede}
                onClick={() => setSupersedingDoc(null)}
                className="flex-1 py-2.5 px-4 border border-white/20 hover:bg-white/10 rounded-xl text-xs font-semibold text-gray-300"
              >
                Cancel
              </button>
              <button
                disabled={isSubmittingSupersede || !supersedeDraft.title || !supersedeDraft.file_url}
                onClick={handleSupersede}
                className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-bold disabled:opacity-50 flex justify-center items-center"
              >
                {isSubmittingSupersede ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Supersede'}
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
                <div className="flex items-center gap-3">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">{activeDocPreview.file_type || 'Document'}</p>
                  {activeDocPreview.cloud_email && (
                    <p className="text-[10px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                      Linked via: {activeDocPreview.cloud_email}
                    </p>
                  )}
                </div>
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

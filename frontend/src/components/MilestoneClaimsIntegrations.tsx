import React, { useState } from 'react';
import {
  FileSpreadsheet, Sparkles, RefreshCw, CheckCircle, AlertTriangle, ExternalLink, Link2, Unlink, Trash2, Eye, Shield, Loader2, X, Lock
} from 'lucide-react';
import {
  getGoogleAuthUrl, getOneDriveAuthUrl, deleteIntegration, previewMilestoneClaimExtraction, commitMilestoneClaimExtraction, getGlobalAuthToken, listCloudFiles, listCloudSheets, saveIntegration, validateMilestoneClaim, convertGoogleCloudFile
} from '@/services/api';
import MilestoneExtractionPreviewModal from './integrations/MilestoneExtractionPreviewModal';
import CloudConfigModal from './integrations/CloudConfigModal';
import EmbeddedSheetEditor from '@/components/EmbeddedSheetEditor';
import CloudConnectionCards from './integrations/CloudConnectionCards';

interface Integration {
  id: number;
  provider: string;
  spreadsheet_id: string;
  sheet_name: string;
  boq_name: string | null;
  last_synced_at: string | null;
  meta_data?: any;
  module?: string;
}

interface MilestoneClaimsIntegrationsProps {
  projectId: number;
  integrations: Integration[];
  documents: any[];
  onRefresh: () => void;
  globalLoading?: boolean;
  setGlobalLoading?: (val: boolean) => void;
}

export default function MilestoneClaimsIntegrations({
  projectId,
  integrations,
  documents,
  onRefresh,
  globalLoading,
  setGlobalLoading,
}: MilestoneClaimsIntegrationsProps) {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<'google' | 'onedrive' | null>(null);

  const [oauthProvider, setOauthProvider] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [boqName, setBoqName] = useState('');

  const [availableFiles, setAvailableFiles] = useState<any[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [navigationHistory, setNavigationHistory] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'Root Folder' }
  ]);
  const [fetchingFiles, setFetchingFiles] = useState(false);
  const [sheetsList, setSheetsList] = useState<{ id: string; name: string; has_headers: boolean }[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<{ [key: string]: boolean }>({});

  const [pendingFileDetails, setPendingFileDetails] = useState<{
    selectedFile: any;
    sheetsNames: string;
    isSpreadsheet: boolean;
    boqName: string;
  } | null>(null);
  const [fetchingSheets, setFetchingSheets] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [integrationToDelete, setIntegrationToDelete] = useState<Integration | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isCommitting, setIsCommitting] = React.useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [activeEditorId, setActiveEditorId] = useState<number | null>(null);
  const [rejectedDocumentContext, setRejectedDocumentContext] = useState<string | null>(null);
  const [warningFileContext, setWarningFileContext] = useState<any>(null);
  const [modalMessage, setModalMessage] = useState<{ type: 'info' | 'success' | 'error' | 'warning'; text: string } | null>(null);
  


  // ─── OAuth Setup (matches Budget flow) ───────────────────────────
  const handleOpenSetup = async (provider: 'google' | 'onedrive') => {
    const dbProvider = provider === 'google' ? 'google_sheets' : 'onedrive';

    const width = 600;
    const height = 650;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    const popup = window.open(
      'about:blank',
      'OAuthPopup',
      `width=${width},height=${height},top=${top},left=${left},status=no,resizable=yes,scrollbars=yes`
    );

    if (popup) {
      popup.document.write(`
        <html>
          <head>
            <title>Connecting...</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fafafa; color: #444; }
              .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #4f46e5; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin-bottom: 16px; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
          </head>
          <body>
            <div class="spinner"></div>
            <div id="status-msg">Checking existing connection...</div>
          </body>
        </html>
      `);
    }

    try {
      const authCheck = await getGlobalAuthToken(projectId, dbProvider);
      if (authCheck && authCheck.has_auth) {
        try {
          await listCloudFiles(dbProvider, authCheck.refresh_token, undefined, 'all', projectId, 'milestone_claims');
          setOauthProvider(dbProvider);
          setRefreshToken(authCheck.refresh_token);
          setShowConfigModal(true);
          setLoadingProvider(null);
          if (popup) popup.close();
          return;
        } catch (tokenErr) {
          console.warn(`Cached ${provider} token is expired, proceeding to re-authenticate...`);
        }
      }
    } catch (err) {
      console.error("Global auth check failed:", err);
    }

    if (popup) {
      try {
        const msgEl = popup.document.getElementById('status-msg');
        if (msgEl) {
          msgEl.innerText = "Connecting to " + (provider === 'google' ? 'Google' : 'Microsoft') + "...";
        }
      } catch (e) {
      }
    }

    try {
      let url = '';
      if (provider === 'google') {
        const res = await getGoogleAuthUrl(projectId, 'pmo', 'milestone_payments');
        url = res.url;
      } else {
        const res = await getOneDriveAuthUrl(projectId, 'pmo', 'milestone_payments');
        url = res.url;
      }

      if (popup) {
        const checkClosed = setInterval(() => {
          try {
            if (popup.closed) {
              clearInterval(checkClosed);
              setLoadingProvider(null);
            }
          } catch (e) {
            // ignore
          }
        }, 500);
        popup.location.href = url;
      } else {
        window.location.href = url;
      }
    } catch (err: any) {
      console.error(err);
      setActionError(`Failed to initiate ${provider} authentication flow.`);
      setLoadingProvider(null);
      if (popup) popup.close();
    }
  };

  // ─── OAuth callback listeners (matches Budget flow with BroadcastChannel) ───
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const provider = searchParams.get('oauth_provider');
      const token = searchParams.get('refresh_token');
      const err = searchParams.get('error');

      if (err) {
        if (window.opener) {
          window.opener.postMessage({ type: 'OAUTH_ERROR', error: decodeURIComponent(err) }, window.location.origin);
        } else {
          try {
            const bc = new BroadcastChannel('oauth_channel');
            bc.postMessage({ type: 'OAUTH_ERROR', error: decodeURIComponent(err) });
            bc.close();
          } catch (e) { /* ignore */ }
        }

        window.close();

        setTimeout(() => {
          if (!window.closed) {
            setActionError(`OAuth Authorization Failed: ${decodeURIComponent(err)}`);
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }, 500);

      } else if (provider && token) {
        if (window.opener) {
          window.opener.postMessage({ type: 'OAUTH_CALLBACK', provider, token }, window.location.origin);
        } else {
          try {
            const bc = new BroadcastChannel('oauth_channel');
            bc.postMessage({ type: 'OAUTH_CALLBACK', provider, token });
            bc.close();
          } catch (e) { /* ignore */ }
        }

        // Attempt to close the popup
        window.close();

        // If window.close() failed, render the dashboard here as fallback
        setTimeout(() => {
          if (!window.closed) {
            setOauthProvider(provider);
            setRefreshToken(token);
            setShowConfigModal(true);
            setLoadingProvider(null);
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }, 500);
      }
    }
  }, []);

  React.useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      // For window.postMessage, verify origin. BroadcastChannel doesn't have event.origin in the same way, 
      // but it's restricted to same-origin by the browser automatically.
      if (event.origin && event.origin !== window.location.origin && event.origin !== '') return;

      if (event.data?.type === 'OAUTH_CALLBACK') {
        const { provider, token } = event.data;
        setOauthProvider(provider);
        setRefreshToken(token);
        setShowConfigModal(true);
        setLoadingProvider(null);
      } else if (event.data?.type === 'OAUTH_ERROR') {
        setActionError(event.data.error || 'Authorization failed.');
        setLoadingProvider(null);
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('oauth_channel');
      bc.onmessage = handleOAuthMessage;
    } catch (e) { }

    return () => {
      window.removeEventListener('message', handleOAuthMessage);
      if (bc) bc.close();
    };
  }, []);

  // ─── File listing effect (matches Budget useEffect pattern) ──────
  React.useEffect(() => {
    let active = true;
    const fetchFiles = async () => {
      if (!showConfigModal || !oauthProvider || !refreshToken) return;
      setFetchingFiles(true);
      try {
        const files = await listCloudFiles(
          oauthProvider,
          refreshToken,
          currentFolderId || undefined,
          'all',
          projectId,
          'milestone_claims'
        );
        if (active) {
          setAvailableFiles(files || []);
        }
      } catch (err: any) {
        console.error('Failed to list files:', err);
        const detail = err?.response?.data?.detail;
        if (active) {
          setActionError(typeof detail === 'string' ? detail : 'Failed to list cloud files. Your session may have expired — try reconnecting.');
        }
      } finally {
        if (active) setFetchingFiles(false);
      }
    };
    fetchFiles();
    return () => { active = false; };
  }, [showConfigModal, oauthProvider, currentFolderId, projectId, refreshToken]);

  // ─── Sheet listing effect (matches Budget useEffect pattern) ─────
  React.useEffect(() => {
    let active = true;
    const fetchSheetsForFile = async () => {
      if (!spreadsheetId || !showConfigModal || !oauthProvider || !refreshToken) return;
      const file = availableFiles.find(f => f.id === spreadsheetId);
      if (!file) return;
      const isSpreadsheet = file.is_google_sheet || /\.(xlsx|xls|csv|ods|gsheet)$/i.test(file.name);
      if (!isSpreadsheet) {
        setSheetsList([]);
        // For non-spreadsheet files (PDF, Word), set pending details immediately
        setPendingFileDetails({
          selectedFile: file,
          sheetsNames: 'Main Content',
          isSpreadsheet: false,
          boqName: boqName || file.name
        });
        return;
      }
      setFetchingSheets(true);
      try {
        const res = await listCloudSheets({
          provider: oauthProvider,
          refresh_token: refreshToken,
          spreadsheet_id: spreadsheetId,
          check_headers: false
        });
        if (active) {
          const sheets = Array.isArray(res) ? res : (res?.sheets || []);
          setSheetsList(sheets);
          const initialSelection: { [key: string]: boolean } = {};
          sheets.forEach((s: any) => {
            initialSelection[s.name] = true;
          });
          setSelectedSheets(initialSelection);

          if (!boqName && file) {
            const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
            setBoqName(nameWithoutExt);
          }

          // Set pending file details
          const sheetsNames = sheets.map((s: any) => s.name).join(', ') || file.name;
          setPendingFileDetails({
            selectedFile: file,
            sheetsNames,
            isSpreadsheet: true,
            boqName: boqName || file.name
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setFetchingSheets(false);
      }
    };
    fetchSheetsForFile();
    return () => { active = false; };
  }, [spreadsheetId, availableFiles, showConfigModal, oauthProvider, projectId, refreshToken]);

  // ─── Navigation helpers ──────────────────────────────────────────
  const handleFolderClick = (id: string, name: string) => {
    setNavigationHistory(prev => [...prev, { id, name }]);
    setCurrentFolderId(id);
    setSpreadsheetId('');
  };
  const handleNavigateBack = () => {
    if (navigationHistory.length <= 1) return;
    const newHistory = [...navigationHistory];
    newHistory.pop();
    setNavigationHistory(newHistory);
    setCurrentFolderId(newHistory[newHistory.length - 1].id);
    setSpreadsheetId('');
  };
  const handleSelectFile = async (file: any) => {
    let targetId = typeof file === 'object' ? file.id : file;
    let targetName = file?.name || '';

    // Auto-convert Google Drive Excel (.xlsx) file immediately on click before fetching worksheets
    if (oauthProvider === 'google_sheets' && (targetName.toLowerCase().endsWith('.xlsx') || targetName.toLowerCase().endsWith('.xls'))) {
      setFetchingSheets(true);
      setModalMessage({ type: 'info', text: 'Converting Excel file to Google Sheets format...' });
      try {
        const converted = await convertGoogleCloudFile(oauthProvider, refreshToken || '', targetId);
        if (converted && converted.id) {
          targetId = converted.id;
          targetName = converted.name || targetName;
          setAvailableFiles(prev => prev.map(f => f.id === (file.id || file) ? { ...f, id: converted.id, name: targetName, is_google_sheet: true } : f));
        }
      } catch (convErr: any) {
        console.error('Google Sheets auto-conversion error:', convErr);
        setModalMessage({ type: 'error', text: 'Failed to convert file. Please save it as a native Google Sheet in Drive.' });
        setFetchingSheets(false);
        return;
      }
      setModalMessage(null);
    }

    setSpreadsheetId(targetId);
    if (targetName && !boqName) {
      setBoqName(targetName.replace(/\.[^/.]+$/, ""));
    }

    if (file.is_rejected) {
      setWarningFileContext(file);
      setShowConfigModal(false);
      return;
    }
  };
  const resetConfigModal = () => {
    setSpreadsheetId('');
    setCurrentFolderId(null);
    setNavigationHistory([{ id: null, name: 'Root Folder' }]);
    setSheetsList([]);
    setSelectedSheets({});
    setAvailableFiles([]);
    setBoqName('');
    setPendingFileDetails(null);
    setModalMessage(null);
  };

  const handleSheetSelection = (sheetName: string) => {
    setSelectedSheets(prev => {
      const next = { ...prev, [sheetName]: !prev[sheetName] };
      // Update pending file details with new sheet selection
      const activeNames = Object.keys(next).filter(k => next[k]).join(', ');
      if (pendingFileDetails) {
        setPendingFileDetails({
          ...pendingFileDetails,
          sheetsNames: activeNames || sheetName
        });
      }
      return next;
    });
  };

  const handleCloseConfig = () => {
    setShowConfigModal(false);
    resetConfigModal();
  };

  // ─── handleSaveConfig: Validate & Extract INSIDE modal with animated overlay ──
  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const selectedFile = availableFiles.find(f => f.id === spreadsheetId);
    if (!selectedFile) {
      setModalMessage({ type: 'error', text: 'Please select a document from your drive.' });
      return;
    }

    const isSpreadsheet = selectedFile.is_google_sheet || /\.(xlsx|xls|csv|ods|gsheet)$/i.test(selectedFile.name);
    const checkedSheets = sheetsList.filter(s => selectedSheets[s.name]);

    if (isSpreadsheet && checkedSheets.length === 0) {
      setModalMessage({ type: 'error', text: 'Please select at least one worksheet.' });
      return;
    }

    const sheetsNames = isSpreadsheet ? (checkedSheets.map(s => s.name).join(', ') || selectedFile.name) : selectedFile.name;
    const selectedSheetsList = isSpreadsheet ? checkedSheets.map(s => s.name) : [];

    setSavingConfig(true);
    if (setGlobalLoading) setGlobalLoading(true);

    // Show scanning overlay inside the CloudConfigModal
    setModalMessage({ type: 'info', text: 'Validating document as Milestone Claim…' });

    try {
      if (oauthProvider && refreshToken) {
        // Step 1: Validate the document first (decoupled from extraction)
        const validationResult = await validateMilestoneClaim(projectId, {
          project_id: typeof projectId === 'string' ? parseInt(projectId as any) : projectId,
          provider: oauthProvider,
          spreadsheet_id: selectedFile.id,
          filename: selectedFile.name,
          refresh_token: refreshToken,
          selected_sheets: selectedSheetsList.length > 0 ? selectedSheetsList : undefined
        });

        if (!validationResult.valid) {
          // Document is not a valid Milestone Claim — close modal, show rejection popup
          setModalMessage(null);
          setSavingConfig(false);
          if (setGlobalLoading) setGlobalLoading(false);
          setRejectedDocumentContext(validationResult.reason || 'Unknown Document');
          setShowConfigModal(false);
          return; // Do NOT proceed to extraction or save
        }

        // Step 2: Document is valid — update overlay and proceed to extraction preview
        setModalMessage({ type: 'info', text: 'Validation passed ✓ — Extracting schedule data…' });

        setPendingFileDetails({
          selectedFile,
          sheetsNames,
          isSpreadsheet,
          boqName: boqName || selectedFile.name
        });

        if (validationResult.extracted_data) {
          setModalMessage(null);
          setExtractedData(validationResult.extracted_data);
          setShowPreviewModal(true);
          setShowConfigModal(false);
        } else {
          setModalMessage({ type: 'error', text: 'Failed to extract Milestone Claim data from cloud document.' });
        }
      }
    } catch (err: any) {
      console.error(err);
      const detail = err?.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.error_code === 'INVALID_ACTIVITY_SCHEDULE_DOCUMENT') {
        setModalMessage(null);
        setSavingConfig(false);
        if (setGlobalLoading) setGlobalLoading(false);
        setRejectedDocumentContext(detail.identified_document_type || 'Invalid Document');
        setShowConfigModal(false);
        return;
      }

      // Show user-friendly error inside the modal overlay
      const errorMsg = typeof detail === 'string'
        ? detail
        : err?.response?.status
          ? `Server error (${err.response.status}): ${err.response.statusText || 'Please try again.'}`
          : err.code === 'ERR_NETWORK'
            ? 'Unable to reach the server. Please check your internet connection and try again.'
            : err.message?.includes('timeout')
              ? 'The request timed out. The document may be too large — please try a smaller file.'
              : 'Failed to process the document. Please try again.';
      setModalMessage({ type: 'error', text: errorMsg });
    } finally {
      setSavingConfig(false);
      if (setGlobalLoading) setGlobalLoading(false);
    }
  };

  // ─── handleConfirmCommit: Save integration + commit (matches Budget flow) ─────
  const handleConfirmCommit = async (metrics: any, finalItems: any[], finalTitle: string) => {
    setIsCommitting(true);
    setActionError(null);
    try {
      let integrationId = selectedIntegration?.id;

      // Save integration on commit (not before validation) — matches Budget flow
      if (!integrationId && pendingFileDetails && oauthProvider && refreshToken) {
        const sheetNameStr = pendingFileDetails.isSpreadsheet
          ? Object.keys(selectedSheets).filter(k => selectedSheets[k]).join(', ') || 'Sheet1'
          : 'Main Content';

        const savedInt = await saveIntegration({
          project_id: typeof projectId === 'string' ? parseInt(projectId as any) : projectId,
          provider: oauthProvider,
          spreadsheet_id: pendingFileDetails.selectedFile.id,
          sheet_name: sheetNameStr,
          boq_name: pendingFileDetails.boqName,
          refresh_token: refreshToken,
          module: 'milestone_claims'
        });
        integrationId = savedInt.integration_id;
      }

      const fileUrl = selectedIntegration?.provider === 'google_sheets'
        ? `https://docs.google.com/spreadsheets/d/${selectedIntegration.spreadsheet_id}`
        : pendingFileDetails?.selectedFile?.web_url || `cloud://${pendingFileDetails?.selectedFile?.id || selectedIntegration?.spreadsheet_id}`;

      await commitMilestoneClaimExtraction(projectId, {
        project_id: typeof projectId === 'string' ? parseInt(projectId as any) : projectId,
        integration_id: integrationId,
        file_url: fileUrl,
        title: finalTitle,
        metrics: metrics,
        items: finalItems
      });

      setPendingFileDetails(null);
      resetConfigModal();
      setModalSuccess('Milestone Claim data committed successfully.');
      onRefresh();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setActionError(typeof detail === 'string' ? detail : 'Failed to save Milestone Claim to database.');
    } finally {
      setIsCommitting(false);
    }
  };

  // ─── Delete / Disconnect ─────────────────────────────────────────
  const handleDisconnect = async (integrationId: number, purgeData: boolean = false) => {
    setDeletingId(integrationId);
    if (setGlobalLoading) setGlobalLoading(true);
    try {
      await deleteIntegration(integrationId, purgeData);
      setSuccess(purgeData ? 'Integration and database records deleted permanently.' : 'Integration disconnected successfully.');
      setTimeout(() => {
        setSuccess(null);
      }, 4000);
      onRefresh();
    } catch (err: any) {
      setActionError('Failed to disconnect spreadsheet.');
    } finally {
      setDeletingId(null);
      if (setGlobalLoading) setGlobalLoading(false);
    }
  };



  return (
    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">

      {/* Top Title & Connect Actions */}
      <CloudConnectionCards
        success={actionError ? null : (success ? success : null)}
        moduleContext="milestone_payments"
        departmentName="General"
        googleIntegration={integrations.find((i) => i.provider === 'google_sheets' || i.provider === 'google')}
        onedriveIntegration={integrations.find((i) => i.provider === 'onedrive')}
        isLoading={!!loadingProvider || !!globalLoading}
        handleOAuthInitiate={handleOpenSetup}
        formatGuidelines="Link schedules in PDF, Word, or Excel format from your Cloud Storage for AI-powered extraction and audit."
      />

      {/* Active Integrations List */}
      {integrations.length === 0 ? (
        <div className="bg-gray-50/70 rounded-2xl p-8 text-center border border-dashed border-gray-200">
          <FileSpreadsheet className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-gray-600">No linked cloud schedules yet.</p>
          <p className="text-[11px] text-gray-400 mt-1 max-w-sm mx-auto">
            Click one of the buttons above to link baseline workbooks or PDF milestone sheets from Google Drive or OneDrive.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-inter">Linked Documents</h4>
            <span className="text-[11px] font-bold text-dark-teal-700 bg-dark-teal-50 px-2.5 py-0.5 rounded-full border border-dark-teal-100">
              {integrations.length} {integrations.length > 1 ? 'documents' : 'document'}
            </span>
          </div>

          <div className="space-y-4">
            {integrations.map((integration) => {
              return (
                <div key={integration.id} className="space-y-2">
                  <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-sm flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-dark-teal-50 rounded-xl text-dark-teal-800 border border-dark-teal-100">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold font-lexend text-gray-900 leading-tight">
                          {integration.boq_name || 'Milestone Claim Document'}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-[10px] text-gray-400 font-medium capitalize">
                            Provider: {integration.provider.replace('_', ' ')} • Tab: {integration.sheet_name}
                          </span>
                          {integration.last_synced_at && (
                            <>
                              <span className="text-gray-300 hidden sm:inline">•</span>
                              <span className="text-[10px] text-gray-400 font-medium">
                                Linked: {new Date(integration.last_synced_at).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action toolbar — matches Budget tab icon-only pill layout */}
                    <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 p-1.5 rounded-2xl flex-shrink-0 shadow-inner">
                      <button
                        disabled={globalLoading || deletingId !== null}
                        onClick={() => setActiveEditorId(activeEditorId === integration.id ? null : integration.id)}
                        className={`p-2 rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 hover:shadow-sm ${activeEditorId === integration.id
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'hover:bg-white text-gray-600 hover:text-gray-900'
                          }`}
                        title={activeEditorId === integration.id ? 'Hide inline preview' : 'Open inline preview'}
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        disabled={globalLoading || deletingId !== null}
                        onClick={() => handleDisconnect(integration.id, false)}
                        className="p-2 hover:bg-white text-amber-600 hover:text-amber-800 rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm"
                        title="Unlink / Disconnect document link (keeps database records)"
                      >
                        <Unlink className="w-4 h-4" />
                      </button>

                      <button
                        disabled={globalLoading || deletingId !== null}
                        onClick={() => setIntegrationToDelete(integration)}
                        className="p-2 hover:bg-white text-red-655 hover:text-red-700 rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm flex items-center justify-center"
                        title="Delete document data permanently from database"
                      >
                        {deletingId === integration.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {activeEditorId === integration.id && (
                    <div className="animate-fade-in">
                      <EmbeddedSheetEditor
                        integrationId={integration.id}
                        provider={integration.provider}
                        spreadsheetId={integration.spreadsheet_id}
                        boqName={integration.boq_name || undefined}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete integration warning modal — matches Budget pattern */}
      {integrationToDelete && (
        <div className="fixed inset-0 bg-dark-teal-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-gray-100 p-8 flex flex-col relative overflow-hidden text-center">
            <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-bold font-lexend text-gray-900 mb-2">Delete Document Permanently</h3>
            <p className="text-sm text-gray-600 mb-6">
              This will permanently delete the linked document integration and all associated database records. The original file remains unchanged.
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Document: <strong className="text-gray-900">{integrationToDelete?.boq_name || integrationToDelete?.sheet_name}</strong>
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setIntegrationToDelete(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const id = integrationToDelete?.id;
                  setIntegrationToDelete(null);
                  if (id) await handleDisconnect(id, true);
                }}
                disabled={globalLoading || deletingId !== null}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl flex items-center gap-1 disabled:opacity-50 transition"
              >
                {deletingId === integrationToDelete?.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Rejection Modal — matches Budget pattern */}
      {rejectedDocumentContext && (
        <div className="fixed inset-0 bg-dark-teal-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-gray-100 p-8 flex flex-col relative overflow-hidden text-center">
            <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>

            <h3 className="text-xl font-bold font-lexend text-gray-900 mb-2">Document Validation Failed</h3>

            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              You attempted to link an Milestone Claim, but our system scanned the contents and identified this document as an <strong className="text-dark-teal-900 font-bold bg-dark-teal-50 px-2 py-0.5 rounded">{rejectedDocumentContext}</strong>.
            </p>

            <div className="bg-amber-50 p-4 rounded-xl text-xs text-amber-800 font-medium text-left mb-8 border border-amber-200/60">
              To protect project integrity, this document has been rejected and was not saved to the database. Please select a valid Milestone Claim, Milestones, or Payment Schedule document.
            </div>

            <button
              onClick={() => {
                setRejectedDocumentContext(null);
                // Clear the rejected file's selection state so scanning doesn't restart
                setSpreadsheetId('');
                setSheetsList([]);
                setSelectedSheets({});
                setBoqName('');
                setShowConfigModal(true);
              }}
              className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-xl text-sm font-bold shadow-md transition active:scale-95"
            >
              Acknowledge & Try Again
            </button>
          </div>
        </div>
      )}

      {/* Action Success Banner */}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-emerald-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Action Error Banner */}
      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Preview Modal */}
      <MilestoneExtractionPreviewModal
        showModal={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        onConfirm={handleConfirmCommit}
        extractedData={extractedData}
        isSaving={isCommitting}
        documentTitle={pendingFileDetails?.boqName || selectedIntegration?.boq_name || undefined}
        documentUrl={
          pendingFileDetails?.selectedFile?.web_url ||
          (selectedIntegration?.provider === 'google_sheets'
            ? `https://docs.google.com/spreadsheets/d/${selectedIntegration?.spreadsheet_id}`
            : undefined)
        }
        actionError={actionError}
        onClearError={() => setActionError(null)}
        actionSuccess={modalSuccess}
        onSuccessClose={() => {
          setModalSuccess(null);
          setShowPreviewModal(false);
        }}
      />

      {/* Active Validation Rejection Modal */}
      {rejectedDocumentContext && (
        <div className="fixed inset-0 bg-dark-teal-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-gray-100 p-8 flex flex-col relative overflow-hidden text-center">
            <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>

            <h3 className="text-xl font-bold font-lexend text-gray-900 mb-2">Document Validation Failed</h3>

            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              You attempted to link an Milestone Claim, but our system scanned the contents and identified this document as an <strong className="text-dark-teal-900 font-bold bg-dark-teal-50 px-2 py-0.5 rounded">{rejectedDocumentContext}</strong>.
            </p>

            <div className="bg-amber-50 p-4 rounded-xl text-xs text-amber-800 font-medium text-left mb-8 border border-amber-200/60">
              To protect project integrity, this document has been rejected and was not saved to the database. Please select a valid Milestone Claim document.
            </div>

            <button
              onClick={() => {
                setRejectedDocumentContext(null);
                // Clear the rejected file's selection state so scanning doesn't restart
                setSpreadsheetId('');
                setSheetsList([]);
                setSelectedSheets({});
                setBoqName('');
                setShowConfigModal(true);
              }}
              className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-xl text-sm font-bold shadow-md transition active:scale-95"
            >
              Acknowledge & Try Again
            </button>
          </div>
        </div>
      )}

      {/* Historical Rejection Modal — Warning but allows proceeding */}
      {warningFileContext && (
        <div className="fixed inset-0 bg-dark-teal-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-gray-100 p-8 flex flex-col relative overflow-hidden text-center">
            <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>

            <h3 className="text-xl font-bold font-lexend text-gray-900 mb-2">Document Flagged</h3>

            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              This document was previously flagged as a <strong className="text-dark-teal-900 font-bold bg-dark-teal-50 px-2 py-0.5 rounded">{warningFileContext.rejected_reason || 'Invalid Document'}</strong> and may not be a valid Milestone Claim.
            </p>

            <div className="bg-amber-50 p-4 rounded-xl text-xs text-amber-800 font-medium text-left mb-8 border border-amber-200/60">
              If you have updated the document or believe this was an error, you can choose to rescan it. Otherwise, please select a different file.
            </div>

            <div className="flex flex-col space-y-3">
              <button
                onClick={() => {
                  setWarningFileContext(null);
                  setShowConfigModal(true);
                }}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transition active:scale-95 flex items-center justify-center space-x-2"
              >
                <span>Rescan Document</span>
              </button>
              
              <button
                onClick={() => {
                  setWarningFileContext(null);
                  setSpreadsheetId('');
                  setSheetsList([]);
                  setSelectedSheets({});
                  setBoqName('');
                  setShowConfigModal(true);
                }}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-sm font-bold shadow-sm transition active:scale-95"
              >
                Back to Files
              </button>
            </div>
          </div>
        </div>
      )}

      <CloudConfigModal
        moduleContext="milestone_claims"
        showConfigModal={showConfigModal}
        modalMessage={modalMessage}
        oauthProvider={oauthProvider}
        availableFiles={availableFiles}
        spreadsheetId={spreadsheetId}
        boqName={boqName}
        setBoqName={setBoqName}
        refreshToken={refreshToken}
        navigationHistory={navigationHistory}
        fetchingFiles={fetchingFiles}
        formatGuidelines="Permitted documents: Spreadsheets (.xlsx, .xls), PDF (.pdf), or Word (.docx, .doc)."
        isFileAllowed={(file: any) => {
          if (file.type === 'folder') return true;
          return file.is_google_sheet || (file.name && file.name.toLowerCase().match(/\.(xlsx|xls|pdf|docx|doc)$/));
        }}
        handleSaveConfig={handleSaveConfig}
        handleNavigateBack={handleNavigateBack}
        handleFolderClick={handleFolderClick}
        handleSelectFile={handleSelectFile}
        resetConfigModal={resetConfigModal}
        handleCloseConfig={handleCloseConfig}
        sheetsList={sheetsList}
        selectedSheets={selectedSheets}
        handleSheetSelection={handleSheetSelection}
        fetchingSheets={fetchingSheets}
        savingConfig={savingConfig}
      />
    </div>
  );
}

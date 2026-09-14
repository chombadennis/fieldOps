import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet, Sparkles, RefreshCw, CheckCircle, AlertTriangle, ExternalLink, Link2, Unlink, Trash2, Eye, Shield, Loader2, X, Lock,
  MessageCircle, History, FileText, RotateCw
} from 'lucide-react';
import {
  getGoogleAuthUrl, getOneDriveAuthUrl, deleteIntegration, previewMilestoneClaimExtraction, commitMilestoneClaimExtraction, getGlobalAuthToken, listCloudFiles, listCloudSheets, saveIntegration, validateMilestoneClaim, convertGoogleCloudFile, getCurrentUser,
  getDecoupledDocuments, updateProjectMilestoneClaim
} from '@/services/api';
import MilestoneExtractionPreviewModal from './integrations/MilestoneExtractionPreviewModal';
import CloudConfigModal from './integrations/CloudConfigModal';
import EmbeddedSheetEditor from '@/components/EmbeddedSheetEditor';
import CloudConnectionCards from './integrations/CloudConnectionCards';
import MilestoneClaimSheet from '@/components/MilestoneClaimSheet';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface Integration {
  id: number;
  provider: string;
  spreadsheet_id: string;
  sheet_name: string;
  boq_name: string | null;
  last_synced_at: string | null;
  meta_data?: any;
  module?: string;
  user_id?: number;
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
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    getCurrentUser().then(setCurrentUser).catch(console.error);
  }, []);

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

  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState<any[]>([]);

  const [success, setSuccess] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [activeEditorId, setActiveEditorId] = useState<number | null>(null);
  const [rejectedDocumentContext, setRejectedDocumentContext] = useState<string | null>(null);
  const [warningFileContext, setWarningFileContext] = useState<any>(null);
  const [modalMessage, setModalMessage] = useState<{ type: 'info' | 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Evolution features state
  const [activeClaimsIntegrationId, setActiveClaimsIntegrationId] = useState<number | null>(null);
  const [activeClaimsTitle, setActiveClaimsTitle] = useState<string>('');
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
  const queryClient = useQueryClient();

  const { data: activeClaimsData = [], isLoading: loadingActiveClaims } = useQuery({
    queryKey: ['milestone_claims_modal', projectId, activeClaimsIntegrationId],
    queryFn: () => getDecoupledDocuments(projectId, 'milestone_claims'),
    enabled: !!activeClaimsIntegrationId,
  });
  


  // ─── OAuth Setup (matches Budget flow) ───────────────────────────
  const handleOpenSetup = async (provider: 'google' | 'onedrive') => {
    setPendingProvider(provider);
    const dbProvider = provider === 'google' ? 'google_sheets' : 'onedrive';

    setLoadingProvider(provider);

    try {
      const authCheck = await getGlobalAuthToken(projectId, dbProvider);
      if (authCheck && authCheck.has_auth) {
        if (authCheck.accounts && authCheck.accounts.length > 0) {
          setAvailableAccounts(authCheck.accounts);
          setShowAccountSelector(true);
          // Modal handles the loading spinner cleanup
          return;
        }
      }
    } catch (err) {
      console.error("Global auth check failed:", err);
    }

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
            <div id="status-msg">Connecting to ${provider === 'google' ? 'Google' : 'Microsoft'}...</div>
          </body>
        </html>
      `);
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
      if (showConfigModal && oauthProvider && refreshToken) {
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
    <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] space-y-6">

      {/* Top Title & Connect Actions */}
      <CloudConnectionCards
        success={actionError ? null : (success ? success : null)}
        moduleContext="milestone_payments"
        departmentName="General"
        googleIntegration={integrations.find((i) => i.provider === 'google_sheets' || i.provider === 'google')}
        onedriveIntegration={integrations.find((i) => i.provider === 'onedrive')}
        isLoading={!!loadingProvider || !!globalLoading}
        handleOAuthInitiate={handleOpenSetup}
        formatGuidelines="Link schedules in PDF, Word, or Excel format from your Cloud Storage for system-powered extraction and review."
      />

      {/* Active Integrations List */}
      {integrations.length === 0 ? (
        <div className="bg-black/20 rounded-2xl p-8 text-center border border-dashed border-white/10">
          <FileSpreadsheet className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-xs font-bold text-gray-300">No linked cloud schedules yet.</p>
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
                  <div className="bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_20px_rgba(0,243,255,0.2)] hover:border-neon-cyan/60 transition-all duration-300 flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-neon-cyan/20 rounded-xl text-neon-cyan border border-neon-cyan/50 shadow-[0_0_10px_rgba(0,243,255,0.2)]">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold font-lexend text-white drop-shadow-md leading-tight">
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
                        {currentUser && integration.user_id === currentUser.id && integration.meta_data?.cloud_email && (
                          <p className="text-xs text-gray-400 mt-1 truncate"><span className="font-semibold text-slate-400">Source:</span> {integration.meta_data.cloud_email}</p>
                        )}
                      </div>
                    </div>

                    {/* Action toolbar — icon-only pill: inline preview + delete */}
                    <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 p-1.5 rounded-2xl flex-shrink-0 shadow-inner">
                      <button
                        disabled={globalLoading || deletingId !== null}
                        onClick={() => {
                          if (currentUser && integration.user_id !== currentUser.id) {
                            alert("You cannot inline preview because you are not the owner, but you can open the document in a new tab and request viewing access from the owner.");
                          } else {
                            setActiveEditorId(activeEditorId === integration.id ? null : integration.id);
                          }
                        }}
                        className={`p-2 rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 hover:shadow-sm ${activeEditorId === integration.id
                          ? 'bg-neon-purple text-white shadow-[0_0_10px_rgba(188,19,254,0.4)]'
                          : 'hover:bg-neon-purple hover:text-white text-gray-400 hover:shadow-[0_0_10px_rgba(188,19,254,0.4)]'
                          }`}
                        title={activeEditorId === integration.id ? 'Hide inline preview' : 'Open inline preview'}
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        disabled={globalLoading || deletingId !== null}
                        onClick={() => setIntegrationToDelete(integration)}
                        className="p-2 hover:bg-red-500 text-red-400 hover:text-white rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_10px_rgba(239,68,68,0.4)] flex items-center justify-center"
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

                  {/* Evolution feature action buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-white/10">
                    {/* View Items — opens Active Milestone Claims modal */}
                    <button
                      disabled={globalLoading || deletingId !== null}
                      onClick={() => {
                        setActiveClaimsIntegrationId(integration.id);
                        setActiveClaimsTitle(integration.boq_name || 'Active Milestone Claims');
                      }}
                      className="py-1.5 px-3 border border-emerald-500/50 rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 bg-emerald-500/10 shadow-[0_0_8px_rgba(16,185,129,0.15)] flex items-center space-x-1.5 text-xs font-semibold"
                      title="View active milestone claims for this document"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
                      </svg>
                      <span>View Items</span>
                    </button>

                    <button
                      disabled={globalLoading || deletingId !== null}
                      onClick={() => {
                        alert("Discussion board for linked claim workbooks is being initialized.");
                      }}
                      className="py-1.5 px-3 border rounded-lg bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 transition-colors flex items-center space-x-1.5 text-xs font-semibold"
                      title="Discuss Workbook"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Discuss</span>
                    </button>

                    <button
                      disabled={globalLoading || deletingId !== null}
                      onClick={() => {
                        alert("Version history tracking for live cloud workbooks is currently active in the background.");
                      }}
                      className="py-1.5 px-3 border rounded-lg bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20 transition-colors flex items-center space-x-1.5 text-xs font-semibold"
                      title="View Version History"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>History</span>
                    </button>

                    <button
                      disabled={globalLoading || deletingId !== null}
                      onClick={() => handleOpenSetup(integration.provider as any)}
                      className="py-1.5 px-3 border rounded-lg bg-neon-pink/10 border-neon-pink/30 text-neon-pink hover:bg-neon-pink/20 transition-colors flex items-center space-x-1.5 text-xs font-semibold"
                      title="Supersede with New Workbook"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Supersede</span>
                    </button>
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

      {/* Active Milestone Claims Modal — opened via View Items button */}
      {activeClaimsIntegrationId && (
        <div className="fixed inset-0 bg-[#030305]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#030305] rounded-3xl max-w-6xl w-full max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(16,185,129,0.1)] border border-white/10 relative overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/10 shrink-0 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white font-lexend flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  Active Milestone Claims
                </h3>
                <p className="text-xs text-gray-400 mt-1">Source: <span className="text-white font-semibold">{activeClaimsTitle}</span></p>
              </div>
              <button
                onClick={() => { setActiveClaimsIntegrationId(null); setSelectedClaim(null); }}
                className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto grow space-y-6">
              {loadingActiveClaims ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-gray-400 font-semibold">Loading milestone claims...</p>
                </div>
              ) : activeClaimsData.length === 0 ? (
                <div className="bg-white/5 rounded-2xl p-10 text-center border border-dashed border-white/10">
                  <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <h4 className="text-xs font-bold text-white mb-1">No Active Milestone Claims Found</h4>
                  <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
                    No database records exist yet. The system may still be processing the document.
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  {activeClaimsData.map((doc: any) => {
                    // Dynamic extra columns from items values_map
                    const allItemKeys = Array.from(new Set(
                      (doc.items || []).flatMap((item: any) => Object.keys(item.values_map || {}))
                    )) as string[];

                    return (
                      <div key={doc.id} className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.3)] overflow-hidden">
                        {/* Claim Header */}
                        <div className="p-5 flex items-center justify-between border-b border-white/10">
                          <div className="flex items-center space-x-3">
                            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                              <FileSpreadsheet className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold font-lexend text-white leading-tight">
                                {doc.title || 'Milestone Claim Document'}
                              </h4>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {doc.file_type?.toUpperCase() || 'Cloud Document'} • {doc.integration_id ? 'Linked' : 'Uploaded'} {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Recently'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setSelectedClaim(doc)}
                              className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-extrabold shadow hover:-translate-y-0.5 transition-all duration-200"
                            >
                              View / Edit Claim
                            </button>
                            {doc.file_url && (
                              <a
                                href={doc.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-xl text-xs font-extrabold shadow hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Source
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Status / meta strip */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/5">
                          {[
                            { label: 'Claim No', value: doc.claim_number || '—', color: 'text-white' },
                            { label: 'Status', value: doc.status || 'Draft', color: doc.status === 'Certified' ? 'text-emerald-400' : doc.status === 'Submitted' ? 'text-amber-400' : 'text-gray-400' },
                            { label: 'Payment', value: doc.payment_status || 'UNPAID', color: doc.payment_status === 'PAID' ? 'text-emerald-400' : doc.payment_status === 'PARTIAL' ? 'text-blue-400' : 'text-red-400' },
                            { label: 'Valuation Date', value: doc.valuation_date || '—', color: 'text-white' },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="bg-black/20 p-3">
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">{label}</p>
                              <p className={`text-sm font-bold ${color}`}>{value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Financial totals */}
                        <div className="grid grid-cols-3 gap-px bg-white/5">
                          <div className="bg-black/20 p-4 text-center">
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Gross Claimed</p>
                            <p className="text-base font-black text-white">${(doc.gross_amount_claimed || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          </div>
                          <div className="bg-black/20 p-4 text-center">
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Retention Deducted</p>
                            <p className="text-base font-black text-amber-400">${(doc.retention_deducted || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          </div>
                          <div className="bg-emerald-950/40 p-4 text-center border-l border-emerald-500/20">
                            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">Net Amount Due</p>
                            <p className="text-base font-black text-emerald-400">${(doc.net_amount_due || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          </div>
                        </div>

                        {/* Line Items Table */}
                        {doc.items && doc.items.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-black/40 border-b border-white/10">
                                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-16">ID</th>
                                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">Description</th>
                                  <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">% Complete</th>
                                  <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">Amount Claimed</th>
                                  {allItemKeys.map((key: string) => (
                                    <th key={key} className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                                      {key.replace(/_/g, ' ')}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {doc.items.map((item: any, idx: number) => (
                                  <tr
                                    key={item.id || idx}
                                    className={`border-b border-white/5 transition-colors hover:bg-white/5 ${idx % 2 === 0 ? 'bg-black/10' : 'bg-transparent'}`}
                                  >
                                    <td className="px-4 py-2.5 text-gray-400 font-mono font-bold">{item.activity_id || idx + 1}</td>
                                    <td className="px-4 py-2.5 text-gray-200 max-w-xs">
                                      <span className="block truncate" title={item.description}>{item.description}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                      <span className={`font-bold ${(item.percentage_complete_this_period || 0) >= 100 ? 'text-emerald-400' : (item.percentage_complete_this_period || 0) > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
                                        {(item.percentage_complete_this_period || 0).toFixed(1)}%
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-bold text-white">
                                      ${(item.amount_claimed_this_period || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    {allItemKeys.map((key: string) => (
                                      <td key={key} className="px-4 py-2.5 text-right text-gray-300">
                                        {item.values_map?.[key] !== undefined && item.values_map?.[key] !== null ? String(item.values_map[key]) : '—'}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-black/40 border-t border-white/10">
                                  <td colSpan={2} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">{doc.items.length} Items</td>
                                  <td className="px-4 py-3 text-right text-[10px] font-bold text-gray-400">—</td>
                                  <td className="px-4 py-3 text-right font-black text-emerald-400">
                                    ${doc.items.reduce((sum: number, item: any) => sum + (item.amount_claimed_this_period || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  {allItemKeys.map((key: string) => <td key={key} />)}
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        ) : (
                          <div className="px-5 py-6 text-center text-xs text-gray-500 border-t border-white/5">
                            No line items extracted for this claim yet.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MilestoneClaimSheet modal — opened from View Items modal */}
      {selectedClaim && (
        <MilestoneClaimSheet
          claim={selectedClaim}
          onClose={() => setSelectedClaim(null)}
          onSave={async (data) => {
            try {
              await updateProjectMilestoneClaim(projectId, selectedClaim.id, data);
              setSelectedClaim(null);
              queryClient.invalidateQueries({ queryKey: ['milestone_claims_modal', projectId, activeClaimsIntegrationId] });
              queryClient.invalidateQueries({ queryKey: ['documents', projectId, 'milestone_claims'] });
            } catch (err) {
              console.error('Failed to update claim:', err);
            }
          }}
        />
      )}

      {/* Delete integration warning modal — matches Budget pattern */}
      {integrationToDelete && (
        <div className="fixed inset-0 bg-dark-teal-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-black/90 backdrop-blur-xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-3xl w-full max-w-md p-8 flex flex-col relative overflow-hidden text-center">
            <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-bold font-lexend text-white drop-shadow-md mb-2">Delete Document Permanently</h3>
            <p className="text-sm text-gray-300 mb-6">
              This will permanently delete the linked document integration and all associated database records. The original file remains unchanged.
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Document: <strong className="text-gray-900">{integrationToDelete?.boq_name || integrationToDelete?.sheet_name}</strong>
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setIntegrationToDelete(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition"
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
          <div className="bg-black/90 backdrop-blur-xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-3xl w-full max-w-md p-8 flex flex-col relative overflow-hidden text-center">
            <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>

            <h3 className="text-xl font-bold font-lexend text-white drop-shadow-md mb-2">Document Validation Failed</h3>

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
          <div className="bg-black/90 backdrop-blur-xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-3xl w-full max-w-md p-8 flex flex-col relative overflow-hidden text-center">
            <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>

            <h3 className="text-xl font-bold font-lexend text-white drop-shadow-md mb-2">Document Validation Failed</h3>

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
          <div className="bg-black/90 backdrop-blur-xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-3xl w-full max-w-md p-8 flex flex-col relative overflow-hidden text-center">
            <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>

            <h3 className="text-xl font-bold font-lexend text-white drop-shadow-md mb-2">Document Flagged</h3>

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
    
      {/* Account Selector Modal */}
      {showAccountSelector && (
        <div className="fixed inset-0 bg-dark-teal-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-700/50 p-6 flex flex-col relative overflow-hidden text-center">
            <h3 className="text-xl font-bold font-lexend text-white mb-4">Select Account</h3>
            <p className="text-sm text-slate-400 mb-6">You have multiple accounts connected. Which one would you like to browse?</p>
            
            <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto custom-scrollbar">
              {availableAccounts.map((acc, idx) => (
                <button
                  key={idx}
                  onClick={async () => {
                    setShowAccountSelector(false);
                    setLoadingProvider(acc.provider === 'google_sheets' ? 'google' : 'onedrive');
                    try {
                      const dbProvider = acc.provider;
                      await listCloudFiles(dbProvider, acc.refresh_token, undefined, 'all', projectId, 'milestone_claims');
                      setOauthProvider(dbProvider);
                      setRefreshToken(acc.refresh_token);
                      setShowConfigModal(true);
                    } catch(err) {
                      console.error(err);
                      setActionError(`Failed to authenticate and fetch files for ${acc.email}.`);
                    } finally {
                      setLoadingProvider(null);
                    }
                  }}
                  className="w-full flex items-center p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mr-4 shrink-0">
                    {acc.provider === 'google_sheets' ? (
                       <svg className="w-5 h-5 text-neon-cyan" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-2 10H7v-2h10v2m0-4H7V7h10v2m0 8H7v-2h10v2z" /></svg>
                    ) : (
                       <svg className="w-5 h-5 text-neon-purple" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" /></svg>
                    )}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="text-white font-bold truncate">{acc.email}</div>
                    <div className="text-xs text-gray-400 capitalize">{acc.provider.replace('_', ' ')}</div>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setShowAccountSelector(false);
                // Trigger oauth flow
                if (pendingProvider) {
                   const popup = window.open('about:blank', 'OAuthPopup', 'width=600,height=650,status=no,resizable=yes,scrollbars=yes');
                   if (popup) popup.document.write('<html><body><div style="font-family:sans-serif; text-align:center; padding-top: 50px;">Redirecting to Auth...</div></body></html>');
                   // Call the backend to get URL and redirect popup
                   (async () => {
                     try {
                       let url = '';
                       // This requires access to getGoogleAuthUrl etc. The files have them imported.
                       if (pendingProvider === 'google') {
                         const res = await getGoogleAuthUrl(projectId, 'pmo');
                         url = res.url;
                       } else {
                         const res = await getOneDriveAuthUrl(projectId, 'pmo');
                         url = res.url;
                       }
                       if (popup) {
                         popup.location.href = url;
                         const checkClosed = setInterval(() => {
                           try {
                             if (popup.closed) {
                               clearInterval(checkClosed);
                               // Refresh token state or reload
                               window.location.reload();
                             }
                           } catch (e) {}
                         }, 500);
                       }
                     } catch(err) {
                       if (popup) popup.close();
                     }
                   })();
                }
              }}
              className="w-full py-3 bg-white/5 hover:bg-white/10 text-white border border-white/20 rounded-xl text-sm font-bold shadow-md transition active:scale-95 mb-3"
            >
              + Link a different account
            </button>
            <button
              onClick={() => {
                setShowAccountSelector(false);
                setLoadingProvider(null);
              }}
              className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-xl text-sm font-bold shadow-md transition active:scale-95"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
</div>
  );
}

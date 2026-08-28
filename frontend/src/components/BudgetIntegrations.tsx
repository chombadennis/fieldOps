import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet, Sparkles, RefreshCw, CheckCircle, AlertTriangle, ExternalLink, Link2, Unlink, Trash2, Eye, Shield, Loader2, X, Layers, Lock
} from 'lucide-react';
import {
  getGoogleAuthUrl, getOneDriveAuthUrl, listActiveIntegrationSheets, deleteIntegration, previewBudgetExtraction, commitBudgetExtraction, getGlobalAuthToken, listCloudFiles, listCloudSheets, saveIntegration, validateBudget, updateIntegrationModule
} from '@/services/api';
import BudgetExtractionPreviewModal from './integrations/BudgetExtractionPreviewModal';
import BudgetBundleSetupModal from './integrations/BudgetBundleSetupModal';
import WorkbookInlinePreviewDrawer from './integrations/WorkbookInlinePreviewDrawer';
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

interface PersistedBundleConfig {
  tracking_mode?: string;
  expected_count?: number;
  linked_count?: number;
  is_complete?: boolean;
}

interface BudgetIntegrationsProps {
  projectId: number;
  integrations: Integration[];
  documents: any[];
  masterMatrix: any[];
  persistedBundleConfig?: PersistedBundleConfig;
  onRefresh: () => void;
  globalLoading?: boolean;
  setGlobalLoading?: (val: boolean) => void;
  moduleContext?: string;
  tabsRibbon?: React.ReactNode;
}

export default function BudgetIntegrations({
  projectId,
  integrations,
  documents,
  masterMatrix,
  persistedBundleConfig,
  onRefresh,
  globalLoading,
  setGlobalLoading,
  moduleContext = 'budget',
  tabsRibbon
}: BudgetIntegrationsProps) {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<'google' | 'onedrive' | null>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [bundleConfig, setBundleConfig] = useState<{ isBundle: boolean; expectedCount: number; tradeLabel: string }>({
    isBundle: false,
    expectedCount: 1,
    tradeLabel: 'General Master Budget',
  });

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
  const [extractingIntegrationId, setExtractingIntegrationId] = useState<number | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeEditorId, setActiveEditorId] = useState<number | null>(null);
  const [rejectedDocumentContext, setRejectedDocumentContext] = useState<string | null>(null);
  const [warningFileContext, setWarningFileContext] = useState<any>(null);



  const handleOpenSetup = async (provider: 'google' | 'onedrive') => {
    const dbProvider = provider === 'google' ? 'google_sheets' : 'onedrive';

    setLoadingProvider(provider);
    setActionError(null);
    setPendingProvider(provider);

    // 1. Open the popup synchronously immediately within the click handler to avoid popup blockers
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

    let hasValidToken = false;

    try {
      // 2. Check if a valid cached token exists in the database
      const authCheck = await getGlobalAuthToken(projectId, dbProvider);
      if (authCheck && authCheck.has_auth) {
        try {
          await listCloudFiles(dbProvider, authCheck.refresh_token, undefined, 'spreadsheets', projectId);
          // Token is valid!
          hasValidToken = true;
          setOauthProvider(dbProvider);
          setRefreshToken(authCheck.refresh_token);
          setShowSetupModal(true);
          setLoadingProvider(null);

          // Close the popup since we don't need it
          if (popup) popup.close();
          return;
        } catch (tokenErr) {
          console.warn(`Cached ${provider} token is expired, proceeding to re-authenticate...`);
        }
      }
    } catch (err) {
      console.error("Global auth check failed:", err);
    }

    // 3. No valid token found — proceed with OAuth flow inside the already opened popup
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
        const res = await getGoogleAuthUrl(projectId, 'pmo', 'budgets');
        url = res.url;
      } else {
        const res = await getOneDriveAuthUrl(projectId, 'pmo', 'budgets');
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
            // Ignore COOP errors
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

  // Check URL parameters on mount to capture OAuth returns
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
          } catch (e) {
            // ignore
          }
        }
        
        // Attempt to close the popup
        window.close();
        
        // If window.close() failed (often happens if browser blocks script close),
        // fallback to just showing the error in the current window.
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
          } catch (e) {
            // ignore
          }
        }
        
        // Attempt to close the popup
        window.close();
        
        // If window.close() failed, render the dashboard here as fallback
        setTimeout(() => {
          if (!window.closed) {
            setOauthProvider(provider);
            setRefreshToken(token);
            setShowSetupModal(true);
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
        setShowSetupModal(true);
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
    } catch (e) {
      // ignore
    }

    return () => {
      window.removeEventListener('message', handleOAuthMessage);
      if (bc) bc.close();
    };
  }, []);

  const handleConfirmSetup = async (config: { isBundle: boolean; expectedCount: number; tradeLabel: string }) => {
    setShowSetupModal(false);
    setBundleConfig(config);
    setShowConfigModal(true);
  };

  React.useEffect(() => {
    let active = true;
    const fetchFiles = async () => {
      if (!showConfigModal || !oauthProvider || !refreshToken) return;
      setFetchingFiles(true);
      try {
        const filterType = 'spreadsheets';
        const files = await listCloudFiles(
          oauthProvider,
          refreshToken,
          currentFolderId || undefined,
          filterType,
          projectId
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

  React.useEffect(() => {
    let active = true;
    const fetchSheetsForFile = async () => {
      if (!spreadsheetId || !showConfigModal || !oauthProvider || !refreshToken) return;
      const file = availableFiles.find(f => f.id === spreadsheetId);
      if (!file) return;
      const isSpreadsheet = file.is_google_sheet || /\.(xlsx|xls|csv|ods|gsheet)$/i.test(file.name);
      if (!isSpreadsheet) {
        setSheetsList([]);
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
            initialSelection[s.id] = true;
          });
          setSelectedSheets(initialSelection);

          if (!boqName && file) {
            const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
            setBoqName(nameWithoutExt);
          }
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
  const handleSelectFile = (file: any) => {
    const fileId = typeof file === 'object' ? file.id : file;
    setSpreadsheetId(fileId);
  };
  const resetConfigModal = () => {
    setSpreadsheetId('');
    setCurrentFolderId(null);
    setNavigationHistory([{ id: null, name: 'Root Folder' }]);
    setSheetsList([]);
    setSelectedSheets({});
    setAvailableFiles([]);
    setBoqName('');
  };

  const handleSheetSelection = (sheetId: string) => {
    setSelectedSheets(prev => ({
      ...prev,
      [sheetId]: !prev[sheetId]
    }));
  };

  const handleCloseConfig = () => {
    setShowConfigModal(false);
    resetConfigModal();
  };

  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let selectedFile = availableFiles.find(f => f.id === spreadsheetId);
    if (!selectedFile) {
      setActionError('Please select a document from your drive.');
      return;
    }

    const isSpreadsheet = selectedFile.is_google_sheet || /\.(xlsx|xls|csv|ods|gsheet)$/i.test(selectedFile.name);
    const checkedSheets = sheetsList.filter(s => selectedSheets[s.id]);

    if (isSpreadsheet && checkedSheets.length === 0) {
      setActionError('Please select at least one worksheet.');
      return;
    }

    const sheetsNames = isSpreadsheet ? (checkedSheets.map(s => s.name).join(', ') || selectedFile.name) : selectedFile.name;
    setSavingConfig(true);
    if (setGlobalLoading) setGlobalLoading(true);

    try {
      if (oauthProvider && refreshToken) {
        // Step 1: Validate the document first (decoupled from extraction)
        const validationResult = await validateBudget({
          project_id: projectId,
          provider: oauthProvider,
          spreadsheet_id: selectedFile.id,
          refresh_token: refreshToken,
          trade_label: bundleConfig.tradeLabel,
        });

        if (!validationResult.valid) {
          // Document is not a budget — show rejection modal with OK only
          setRejectedDocumentContext(validationResult.reason || 'Unknown Document');
          setShowConfigModal(false);
          return; // Do NOT proceed to extraction
        }

        // Step 2: Document is valid — proceed to extraction preview
        setPendingFileDetails({
          selectedFile,
          sheetsNames,
          isSpreadsheet,
          boqName: boqName || selectedFile.name
        });

        const res = await previewBudgetExtraction({
          project_id: projectId,
          provider: oauthProvider,
          spreadsheet_id: selectedFile.id,
          refresh_token: refreshToken,
          trade_label: bundleConfig.tradeLabel,
        });

        if (res?.extracted_data) {
          setExtractedData(res.extracted_data);
          setShowPreviewModal(true);
          setShowConfigModal(false);
        } else {
          setActionError('Failed to extract Budget data from cloud workbook.');
        }
      }
    } catch (err: any) {
      console.error(err);
      const detail = err?.response?.data?.detail;
      if (detail && detail.error_code === 'INVALID_BUDGET_DOCUMENT') {
        setRejectedDocumentContext(detail.identified_document_type);
        setShowConfigModal(false);
      } else {
        setActionError(typeof detail === 'string' ? detail : err.message || 'Failed to save linked document.');
      }
    } finally {
      setSavingConfig(false);
      if (setGlobalLoading) setGlobalLoading(false);
    }
  };

  const handleRunAiExtraction = async (integration: Integration) => {
    setExtractingIntegrationId(integration.id);
    setSelectedIntegration(integration);
    if (setGlobalLoading) setGlobalLoading(true);

    try {
      const res = await previewBudgetExtraction({
        project_id: projectId,
        provider: integration.provider,
        spreadsheet_id: integration.spreadsheet_id,
      });

      if (res?.extracted_data) {
        setExtractedData(res.extracted_data);
        setShowPreviewModal(true);
      } else {
        setActionError('Failed to extract Budget data from cloud workbook.');
      }
    } catch (err: any) {
      setActionError(err.response?.data?.detail || 'Budget extraction failed.');
    } finally {
      setExtractingIntegrationId(null);
      if (setGlobalLoading) setGlobalLoading(false);
    }
  };

  const handleConfirmCommit = async (finalData: any) => {
    setIsCommitting(true);
    if (setGlobalLoading) setGlobalLoading(true);
    try {
      let integrationId = selectedIntegration?.id;
      const targetModule = finalData.module || moduleContext;

      if (!integrationId && pendingFileDetails && oauthProvider && refreshToken) {
        const savedInt = await saveIntegration({
          project_id: typeof projectId === 'string' ? parseInt(projectId) : projectId,
          provider: oauthProvider,
          spreadsheet_id: pendingFileDetails.selectedFile.id,
          sheet_name: pendingFileDetails.sheetsNames,
          refresh_token: refreshToken,
          boq_name: pendingFileDetails.boqName,
          module: targetModule,
          trade_label: finalData.trade_label || bundleConfig.tradeLabel,
          tracking_mode: bundleConfig.isBundle ? 'split' : 'single'
        });
        integrationId = savedInt.integration_id;
      }

      await commitBudgetExtraction({
        project_id: projectId,
        original_contract_sum: finalData.original_contract_sum,
        appraised_budget: finalData.appraised_budget,
        earned_value: finalData.earned_value,
        remaining_balance: finalData.remaining_balance,
        percent_used: finalData.percent_used,
        categories: finalData.categories,
        integration_id: integrationId,
        module: targetModule,
        title: (targetModule === 'progress' ? '[Progress] ' : targetModule === 'cost' ? '[Cost] ' : '[Budget] ') + (pendingFileDetails?.boqName || selectedIntegration?.boq_name || 'Master Budget & EVM'),
        trade_label: finalData.trade_label || bundleConfig.tradeLabel,
        expected_count: bundleConfig.expectedCount,
        project_title_found: finalData.project_metadata?.extracted_project_name,
      });

      setShowPreviewModal(false);
      setPendingFileDetails(null);
      resetConfigModal();
      setSuccess('Budget workbook data committed successfully and Master Table reconciled.');
      setTimeout(() => {
        setSuccess(null);
      }, 4000);
      onRefresh();
    } catch (err: any) {
      setActionError(err.response?.data?.detail || 'Failed to save Budget to database.');
    } finally {
      setIsCommitting(false);
      if (setGlobalLoading) setGlobalLoading(false);
    }
  };

  const handleUpdateModule = async (integrationId: number, newModule: string) => {
    if (setGlobalLoading) setGlobalLoading(true);
    setActionError(null);
    setSuccess(null);
    try {
      await updateIntegrationModule(integrationId, newModule);
      setSuccess(`Updated workbook destination tag to '${newModule === 'progress' ? 'Work Progress Calculations' : 'Project Budget'}'.`);
      setTimeout(() => {
        setSuccess(null);
      }, 4000);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setActionError(err.response?.data?.detail || 'Failed to update workbook tag.');
    } finally {
      if (setGlobalLoading) setGlobalLoading(false);
    }
  };

  const handleDisconnect = async (integrationId: number, purgeData: boolean = false) => {
    if (purgeData) {
      // Confirmation handled by modal UI
    }
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

  // Compute quota from persisted bundle config
  const pExpected = persistedBundleConfig?.expected_count || 1;
  const pLinked = persistedBundleConfig?.linked_count || 0;
  const remainingSlots = Math.max(0, pExpected - pLinked);
  const isQuotaFull = pLinked >= pExpected && pLinked > 0;
  const hasPersistedConfig = !!(persistedBundleConfig && pLinked > 0);

  return (
    <div className="space-y-6">
      {/* Top Title & Connect Actions */}
      <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <CloudConnectionCards
          success={actionError ? null : (success ? success : null)}
          moduleContext="budget"
          departmentName="Budget"
          googleIntegration={integrations.find((i) => i.provider === 'google_sheets')}
          onedriveIntegration={integrations.find((i) => i.provider === 'onedrive')}
          isLoading={!!loadingProvider || !!globalLoading}
          handleOAuthInitiate={handleOpenSetup}
          formatGuidelines="To sync successfully, your budget spreadsheets must have recognizable headings like Description, Amount, Quantity, etc."
        />
      </div>

      {tabsRibbon && (
        <div className="pt-2 pb-2">
          {tabsRibbon}
        </div>
      )}

      {/* Active Integrations List */}
      <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] space-y-6">
      {integrations.length === 0 ? (
        <div className="bg-black/20 rounded-2xl p-8 text-center border border-dashed border-white/10">
          <FileSpreadsheet className="w-10 h-10 text-gray-600 drop-shadow-sm mx-auto mb-2" />
          <p className="text-xs font-bold text-gray-300">No cloud budget workbooks linked yet.</p>
          <p className="text-[11px] text-gray-500 mt-1 max-w-sm mx-auto">
            Click one of the buttons above to link your master or trade budget spreadsheets from Google Sheets or OneDrive.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-white/10 pb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 font-inter">Linked Workbooks</h4>
            <span className="text-[11px] font-bold text-neon-cyan bg-neon-cyan/20 px-2.5 py-0.5 rounded-full border border-neon-cyan/50 shadow-[0_0_10px_rgba(0,243,255,0.2)]">
              {integrations.length} {integrations.length > 1 ? 'workbooks' : 'workbook'}
            </span>
          </div>

          <div className="space-y-4">
            {integrations.map((integration) => {
              const isExtracting = extractingIntegrationId === integration.id;
              // Find matching matrix entry for this integration
              const matchedMatrix = masterMatrix.find((m) => m.integration_id === integration.id) || {
                integration_id: integration.id,
                trade_label: integration.boq_name || 'Trade Workbook',
                title: integration.boq_name || 'Master Budget Sheet',
                summary_metrics: {},
                categories: []
              };

              return (
                <div key={integration.id} className="space-y-2">
                  <div className="bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_20px_rgba(0,243,255,0.2)] hover:border-neon-cyan/60 transition-all duration-300 flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-neon-cyan/20 rounded-xl text-neon-cyan border border-neon-cyan/50 shadow-[0_0_10px_rgba(0,243,255,0.2)]">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold font-lexend text-white drop-shadow-md leading-tight">
                          {integration.boq_name || 'Master Budget Sheet'}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-[10px] text-gray-400 font-medium capitalize">
                            Provider: {integration.provider.replace('_', ' ')} • Tab: {integration.sheet_name}
                          </span>
                          <span className="text-gray-600 drop-shadow-sm hidden sm:inline">•</span>
                          <div className="flex items-center space-x-1">
                            <span className="text-[9px] font-bold text-gray-500 uppercase">Tag:</span>
                            <select
                              value={integration.module === 'progress' ? 'progress' : 'budget'}
                              onChange={(e) => handleUpdateModule(integration.id, e.target.value)}
                              disabled={globalLoading}
                              className="p-1 px-1.5 bg-black/40 border border-white/20 rounded-lg text-[10px] font-bold text-white hover:bg-black/60 focus:border-neon-cyan transition focus:outline-none cursor-pointer"
                            >
                              <option value="budget">Project Budget</option>
                              <option value="progress">Work Progress</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 p-1.5 rounded-2xl flex-shrink-0 shadow-inner">
                      <button
                        disabled={globalLoading || deletingId !== null}
                        onClick={() => setActiveEditorId(activeEditorId === integration.id ? null : integration.id)}
                        className={`p-2 rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 ${activeEditorId === integration.id
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
                        title="Delete workbook data permanently from database"
                      >
                        {deletingId === integration.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-red-400" />
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

                  {/* Inline Preview Table Drawer for this specific workbook */}
                  <WorkbookInlinePreviewDrawer
                    projectId={projectId}
                    onRefresh={onRefresh}
                    workbookData={matchedMatrix}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {integrationToDelete && (
        <div className="fixed inset-0 bg-dark-teal-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-gray-100 p-8 flex flex-col relative overflow-hidden text-center">
            <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-bold font-lexend text-gray-900 mb-2">Delete Workbook Permanently</h3>
            <p className="text-sm text-gray-600 mb-6">
              This will permanently delete the workbook integration and all associated database records. The original spreadsheet file remains unchanged.
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Workbook: <strong className="text-gray-900">{integrationToDelete?.boq_name || integrationToDelete?.sheet_name}</strong>
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

      {/* Validation Rejection Modal */}
      {rejectedDocumentContext && (
        <div className="fixed inset-0 bg-dark-teal-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-gray-100 p-8 flex flex-col relative overflow-hidden text-center">
            <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>

            <h3 className="text-xl font-bold font-lexend text-gray-900 mb-2">Document Validation Failed</h3>

            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              You attempted to link a Budget workbook, but our system scanned the contents and identified this document as an <strong className="text-dark-teal-900 font-bold bg-dark-teal-50 px-2 py-0.5 rounded">{rejectedDocumentContext}</strong>.
            </p>

            <div className="bg-amber-50 p-4 rounded-xl text-xs text-amber-800 font-medium text-left mb-8 border border-amber-200/60">
              To protect project integrity, this document has been rejected and was not saved to the database. Please select a valid Budget or EVM document.
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

      {/* Historical Rejection Modal — OK button only, no Proceed Anyway */}
      {warningFileContext && (
        <div className="fixed inset-0 bg-dark-teal-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-gray-100 p-8 flex flex-col relative overflow-hidden text-center">
            <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>

            <h3 className="text-xl font-bold font-lexend text-gray-900 mb-2">Document Rejected</h3>

            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              This document was previously flagged as a <strong className="text-dark-teal-900 font-bold bg-dark-teal-50 px-2 py-0.5 rounded">{warningFileContext.rejected_reason || 'Invalid Document'}</strong> and cannot be used as a Budget workbook.
            </p>

            <div className="bg-amber-50 p-4 rounded-xl text-xs text-amber-800 font-medium text-left mb-8 border border-amber-200/60">
              To protect project integrity, this document has been blocked. Please select a valid Budget or EVM document instead.
            </div>

            <button
              onClick={() => {
                setWarningFileContext(null);
                // Clear the rejected file's selection state so scanning doesn't restart
                setSpreadsheetId('');
                setSheetsList([]);
                setSelectedSheets({});
                setBoqName('');
                setShowConfigModal(true);
              }}
              className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-xl text-sm font-bold shadow-md transition active:scale-95"
            >
              OK
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
      </div>

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

      {/* Setup Bundle & Trade Modal */}
      <BudgetBundleSetupModal
        showModal={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        onConfirm={handleConfirmSetup}
        provider={pendingProvider || 'google'}
        currentLinkedCount={integrations.length}
        persistedBundleConfig={persistedBundleConfig}
      />

      {/* Interactive 150-Row Validation Preview Modal */}
      <BudgetExtractionPreviewModal
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
        tradeLabel={bundleConfig.tradeLabel}
        expectedCount={bundleConfig.expectedCount}
        currentWorkbookIndex={
          selectedIntegration ? integrations.findIndex((i) => i.id === selectedIntegration.id) + 1 : 1
        }
        initialModule={moduleContext}
      />

      <CloudConfigModal
        moduleContext="budget"
        showConfigModal={showConfigModal}
        modalMessage={null}
        oauthProvider={oauthProvider}
        availableFiles={availableFiles}
        spreadsheetId={spreadsheetId}
        boqName={boqName}
        setBoqName={setBoqName}
        refreshToken={refreshToken}
        navigationHistory={navigationHistory}
        fetchingFiles={fetchingFiles}
        formatGuidelines="Only .xlsx and .xls files are permitted."
        isFileAllowed={(file: any) => {
          if (file.type === 'folder') return true;
          return file.is_google_sheet || (file.name && file.name.toLowerCase().match(/\.(xlsx|xls|csv)$/));
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

import React, { useState } from 'react';
import {
  FileSpreadsheet, Sparkles, RefreshCw, CheckCircle, AlertTriangle, ExternalLink, Link2, Unlink, Trash2, Eye, Shield, Loader2, X, Layers
} from 'lucide-react';
import {
  getGoogleAuthUrl, getOneDriveAuthUrl, listActiveIntegrationSheets, deleteIntegration, previewBudgetExtraction, commitBudgetExtraction, getGlobalAuthToken, listCloudFiles, listCloudSheets, saveIntegration, validateBudget
} from '@/services/api';
import BudgetExtractionPreviewModal from './integrations/BudgetExtractionPreviewModal';
import BudgetBundleSetupModal from './integrations/BudgetBundleSetupModal';
import WorkbookInlinePreviewDrawer from './integrations/WorkbookInlinePreviewDrawer';
import CloudConfigModal from './integrations/CloudConfigModal';

interface Integration {
  id: number;
  provider: string;
  spreadsheet_id: string;
  sheet_name: string;
  boq_name?: string;
  last_synced_at?: string;
  meta_data?: any;
}

interface BudgetIntegrationsProps {
  projectId: number;
  integrations: Integration[];
  documents?: any[];
  onRefresh: () => void;
  globalLoading?: boolean;
  setGlobalLoading?: (loading: boolean) => void;
  masterMatrix?: any[];
}

export default function BudgetIntegrations({
  projectId,
  integrations = [],
  documents = [],
  onRefresh,
  globalLoading,
  setGlobalLoading,
  masterMatrix = [],
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

  const [extractingIntegrationId, setExtractingIntegrationId] = useState<number | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectedDocumentContext, setRejectedDocumentContext] = useState<string | null>(null);
  const [warningFileContext, setWarningFileContext] = useState<any>(null);

  const handleOpenSetup = async (provider: 'google' | 'onedrive') => {
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
    const dbProvider = provider === 'google' ? 'google_sheets' : 'onedrive';

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
          msgEl.innerText = `Connecting to ${provider === 'google' ? 'Google' : 'Microsoft'}...`;
        }
      } catch (e) {
        // Ignore cross-origin context issues if document is unloaded/reloading
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
          } catch (e) {
            // ignore
          }
        }
        
        window.close();
        
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
      if (event.origin && event.origin !== window.location.origin) return;

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
    } catch (e) { }

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
  const handleSelectFile = (fileId: string) => {
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
      
      if (!integrationId && pendingFileDetails && oauthProvider && refreshToken) {
        const savedInt = await saveIntegration({
          project_id: typeof projectId === 'string' ? parseInt(projectId) : projectId,
          provider: oauthProvider,
          spreadsheet_id: pendingFileDetails.selectedFile.id,
          sheet_name: pendingFileDetails.sheetsNames,
          refresh_token: refreshToken,
          boq_name: pendingFileDetails.boqName,
          module: 'budgets',
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
        title: pendingFileDetails?.boqName || selectedIntegration?.boq_name || 'Master Budget & EVM',
        trade_label: finalData.trade_label || bundleConfig.tradeLabel,
        expected_count: bundleConfig.expectedCount,
        project_title_found: finalData.project_metadata?.extracted_project_name,
      });

      setShowPreviewModal(false);
      setPendingFileDetails(null);
      resetConfigModal();
      onRefresh();
    } catch (err: any) {
      setActionError(err.response?.data?.detail || 'Failed to save Budget to database.');
    } finally {
      setIsCommitting(false);
      if (setGlobalLoading) setGlobalLoading(false);
    }
  };

  const handleDisconnect = async (integrationId: number, purgeData: boolean = false) => {
    if (setGlobalLoading) setGlobalLoading(true);
    try {
      await deleteIntegration(integrationId, purgeData);
      onRefresh();
    } catch (err: any) {
      setActionError('Failed to disconnect spreadsheet.');
    } finally {
      if (setGlobalLoading) setGlobalLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">

      {/* Top Title & Connect Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-dark-teal-700 font-inter">
              Cloud Budget Integrations
            </span>
            {integrations.length > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-dark-teal-50 text-dark-teal-800 border border-dark-teal-200 text-[10px] font-bold">
                <Layers className="w-3 h-3 mr-1" /> {integrations.length} of {bundleConfig.expectedCount || 1} Linked
              </span>
            )}
          </div>
          <h3 className="text-base font-bold font-lexend text-gray-900 mt-0.5">Live Spreadsheet Sync & Extraction</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Connect your Google Drive or OneDrive budget workbooks (up to 5 trade workbooks) for 150-row scanning and cross-workbook reconciliation.
          </p>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0">
          <button
            onClick={() => handleOpenSetup('google')}
            disabled={!!loadingProvider || globalLoading}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 active:scale-95 disabled:opacity-50"
          >
            {loadingProvider === 'google' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            <span>Connect Google Sheets</span>
          </button>
          <button
            onClick={() => handleOpenSetup('onedrive')}
            disabled={!!loadingProvider || globalLoading}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 active:scale-95 disabled:opacity-50"
          >
            {loadingProvider === 'onedrive' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            <span>Connect OneDrive</span>
          </button>
        </div>
      </div>

      {/* Active Integrations List */}
      {integrations.length === 0 ? (
        <div className="bg-gray-50/70 rounded-2xl p-8 text-center border border-dashed border-gray-200">
          <FileSpreadsheet className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-gray-600">No cloud budget workbooks linked yet.</p>
          <p className="text-[11px] text-gray-400 mt-1 max-w-sm mx-auto">
            Click one of the buttons above to link your master or trade budget spreadsheets from Google Sheets or OneDrive.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Linked Workbooks ({integrations.length})</span>

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
                  <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-dark-teal-50 rounded-xl text-dark-teal-800 border border-dark-teal-100">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold font-lexend text-gray-900 leading-tight">
                          {integration.boq_name || 'Master Budget Sheet'}
                        </h4>
                        <p className="text-[10px] text-gray-400 mt-0.5 capitalize">
                          Provider: {integration.provider.replace('_', ' ')} • Tab: {integration.sheet_name}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleRunAiExtraction(integration)}
                        className="px-3 py-1.5 bg-dark-teal-50 hover:bg-dark-teal-100 text-dark-teal-700 rounded-lg text-[10px] font-bold transition flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview Data</span>
                      </button>

                      <button
                        onClick={() => handleDisconnect(integration.id, true)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                        title="Disconnect & Purge Data"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Preview Table Drawer for this specific workbook */}
                  <WorkbookInlinePreviewDrawer workbookData={matchedMatrix} />
                </div>
              );
            })}
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

      {/* Setup Bundle & Trade Modal */}
      <BudgetBundleSetupModal
        showModal={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        onConfirm={handleConfirmSetup}
        provider={pendingProvider || 'google'}
        currentLinkedCount={integrations.length}
      />

      {/* Interactive 150-Row Validation Preview Modal */}
      <BudgetExtractionPreviewModal
        showModal={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        onConfirm={handleConfirmCommit}
        extractedData={extractedData}
        isSaving={isCommitting}
        documentTitle={pendingFileDetails?.boqName || selectedIntegration?.boq_name}
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

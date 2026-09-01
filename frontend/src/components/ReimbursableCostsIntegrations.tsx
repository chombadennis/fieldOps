'use client';

import { useEffect, useState } from 'react';
import { listCloudSheets, saveIntegration, triggerSyncImport, previewIpcExtraction, getGoogleAuthUrl, getOneDriveAuthUrl, createProjectDocument, createDecoupledDocument, convertGoogleCloudFile, listCloudFiles, deleteIntegration, checkIntegrationUpdate, listActiveIntegrationSheets, dismissIntegrationSheets, checkIpcExists, getGlobalAuthToken } from '@/services/api';
import IpcExtractionPreviewModal from './integrations/IpcExtractionPreviewModal';
import { Folder, FileSpreadsheet, FileText, ChevronRight, ArrowLeft, Loader2, Trash2, AlertTriangle, ExternalLink, X, Unlink, Eye, Sparkles, Paperclip, RefreshCw, Link2, Layers, Lock } from 'lucide-react';
import EmbeddedSheetEditor from '@/components/EmbeddedSheetEditor';


import { Integration, DocumentIntegrationsProps } from './integrations/types';
import ActiveIntegrationsList from './integrations/ActiveIntegrationsList';
import CloudConnectionCards from './integrations/CloudConnectionCards';
import CloudConfigModal from './integrations/CloudConfigModal';
import ManualEntryModal from './integrations/ManualEntryModal';


export default function ReimbursableCostsIntegrations({
  projectId,
  integrations,
  onRefresh,
  globalLoading,
  setGlobalLoading,
  moduleContext,
  departmentName = 'General',
  apiEndpoint,
  activeTab,
  pmoSubTab,
  titlePrefix,
  departmentKey,
}: DocumentIntegrationsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [outOfSyncMap, setOutOfSyncMap] = useState<{ [id: number]: boolean }>({});
  const [newSheetsMap, setNewSheetsMap] = useState<{ [id: number]: string[] }>({});
  const [disconnectingId, setDisconnectingId] = useState<number | null>(null);
  const [integrationToDelete, setIntegrationToDelete] = useState<Integration | null>(null);
  const [ipcReExtractModalIntegration, setIpcReExtractModalIntegration] = useState<Integration | null>(null);
  const [dismissedNewSheets, setDismissedNewSheets] = useState<{ [id: number]: boolean }>({});
  const [activeEditorId, setActiveEditorId] = useState<number | null>(null);
  const [activeAuditIntegration, setActiveAuditIntegration] = useState<Integration | null>(null);
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);


  // Form states for linking spreadsheet after OAuth redirect callback
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [boqName, setBoqName] = useState('');
  const [trackingMode, setTrackingMode] = useState('split');
  const [ipcCertificateNumber, setIpcCertificateNumber] = useState('');
  const [sheetsList, setSheetsList] = useState<{ id: string; name: string; has_headers: boolean }[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<{ [id: string]: boolean }>({});
  const [fetchingSheets, setFetchingSheets] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<{ id: string; name: string; type: 'folder' | 'file'; web_url?: string; is_google_sheet?: boolean; mime_type?: string }[]>([]);
  const [fetchingFiles, setFetchingFiles] = useState(false);
  const [preScanWarning, setPreScanWarning] = useState<{
    show: boolean;
    certificateNumber: string | null;
    selectedFile: any;
    sheetsNames: string;
    isSpreadsheet: boolean;
  } | null>(null);

  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [activeConfigIntegrationId, setActiveConfigIntegrationId] = useState<number | null>(null);
  const isLoading = loading || globalLoading;

  const getAllowedFormats = () => {
    if (moduleContext === 'budget' || departmentName === 'Budget') {
      if (titlePrefix === '[Budget]') return ['.xlsx', '.xls', '.csv'];
      if (titlePrefix === '[Progress]') return ['.xlsx', '.xls', '.csv'];
      if (titlePrefix === '[Cost]') return ['.xlsx', '.xls', '.csv', '.pdf'];
      return ['.xlsx', '.xls', '.csv'];
    }

    if (pmoSubTab === 'activity_schedule') return ['.xlsx', '.xls', '.csv'];
    if (pmoSubTab === 'milestone_payments') return ['.pdf', '.doc', '.docx'];
    if (pmoSubTab === 'rate_schedule') return ['.xlsx', '.xls', '.csv'];
    if (pmoSubTab === 'reimbursable_costs') return ['.pdf', '.jpg', '.jpeg', '.png'];
    if (pmoSubTab === 'scheduling') return ['.xlsx', '.xls', '.csv', '.pdf', '.mpp'];

    const lowerDept = (departmentName || '').toLowerCase();
    if (lowerDept.includes('tech') || lowerDept.includes('engineering')) return ['.pdf', '.dwg', '.jpg', '.png', '.jpeg'];
    if (lowerDept.includes('field')) return ['.pdf', '.doc', '.docx', '.jpg', '.png', '.jpeg'];
    if (lowerDept.includes('hr') || lowerDept.includes('legal')) return ['.pdf', '.doc', '.docx', '.xlsx', '.xls'];

    if (moduleContext === 'ipc') return ['.xlsx', '.xls'];

    return ['*'];
  };

  const allowedFormats = getAllowedFormats();
  const formatGuidelines = allowedFormats.includes('*')
    ? 'Any document format (PDFs, Word documents, spreadsheets, etc.) can be linked directly.'
    : `Only ${allowedFormats.join(', ')} files are permitted in this section. Unsupported files are hidden.`;

  const isFileAllowed = (file: any) => {
    if (file.type === 'folder') return true;
    if (allowedFormats.includes('*')) return true;

    const fileName = (file.name || '').toLowerCase();
    if (file.is_google_sheet) {
      return allowedFormats.includes('.xlsx') || allowedFormats.includes('.xls') || allowedFormats.includes('.csv');
    }

    return allowedFormats.some(ext => fileName.endsWith(ext));
  };

  // Overlay message inside the config modal (progress / success / error / warning)
  const [modalMessage, setModalMessage] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null);
  // Cancel-during-import warning dialog
  const [showCancelWarning, setShowCancelWarning] = useState(false);
  // Per-integration sync result shown on the workbook card
  const [syncResultMap, setSyncResultMap] = useState<{ [id: number]: { type: 'success' | 'error'; text: string } | null }>({});
  // Import-sheet confirmation (replaces window.confirm)
  const [importSheetWarning, setImportSheetWarning] = useState<{ integration: any; sheetName: string } | null>(null);



  // Folder navigation states
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [navigationHistory, setNavigationHistory] = useState<{ id: string; name: string }[]>([]);

  // IPC Extraction state
  const [showIpcPreviewModal, setShowIpcPreviewModal] = useState(false);
  const [ipcExtractionData, setIpcExtractionData] = useState<any>(null);
  const [pendingIpcFileDetails, setPendingIpcFileDetails] = useState<any>(null);

  // Fetch spreadsheets/folders when the OAuth setup completes or folder changes
  useEffect(() => {
    const loadFiles = async () => {
      if (showConfigModal && oauthProvider && refreshToken) {
        setFetchingFiles(true);
        setError(null);
        try {
          const filterType = moduleContext === 'ipc' ? 'spreadsheets' : 'all';
          const files = await listCloudFiles(oauthProvider, refreshToken, currentFolderId || undefined, filterType);
          setAvailableFiles(files);
        } catch (err) {
          setError('Failed to fetch files from drive.');
          console.error(err);
        } finally {
          setFetchingFiles(false);
        }
      }
    };
    loadFiles();
  }, [showConfigModal, oauthProvider, refreshToken, currentFolderId, moduleContext]);

  const expectedModule = moduleContext === 'department' ? departmentName.toLowerCase() : moduleContext;
  const visibleIntegrations = integrations.filter(i => {
    if (i.id === deletingId) return false;
    return i.module === expectedModule;
  });

  // Check if spreadsheets are out of sync on load/refresh, and poll every 30 seconds
  useEffect(() => {
    const checkUpdates = async () => {
      const updates: { [id: number]: boolean } = {};
      const newSheets: { [id: number]: string[] } = {};
      for (const integration of visibleIntegrations) {
        if (deletingId === integration.id) continue;
        try {
          const res = await checkIntegrationUpdate(integration.id);
          updates[integration.id] = res.has_updates;
          newSheets[integration.id] = res.new_sheets || [];
        } catch (e) {
          console.error(`Failed to check updates for integration ${integration.id}:`, e);
        }
      }
      setOutOfSyncMap(updates);
      setNewSheetsMap(newSheets);
    };

    if (visibleIntegrations.length > 0) {
      checkUpdates();

      // Poll remote spreadsheet updates every 30 seconds in the background
      const intervalId = setInterval(() => {
        checkUpdates();
      }, 30000);

      return () => clearInterval(intervalId);
    }
  }, [integrations, deletingId]);

  const [syncingName, setSyncingName] = useState('');
  const [progressMessage, setProgressMessage] = useState('Connecting…');

  // Cycle through progress messages when active sync is running
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    const messages = moduleContext === 'ipc' ? [
      'Verifying IPC Document Type',
      `Scanning Worksheets for Certificate No ${ipcCertificateNumber || '...'}`,
      'Reading Cell Matrix',
      'Checking Advance Recovery Sheet',
      'Sanitizing Financial Values',
      'Building Editable Preview Grid'
    ] : [
      'Connecting to sheet',
      'Reading worksheet',
      'Evaluating worksheet',
      'Checking structure',
      'Verifying format',
      'Processing columns',
      'Comparing schema'
    ];
    let index = 0;

    const isSyncActive = loading || globalLoading || syncingId !== null;

    if (isSyncActive) {
      setProgressMessage(messages[0]);
      interval = setInterval(() => {
        index = (index + 1) % messages.length;
        setProgressMessage(messages[index]);
      }, 2500);
    } else {
      setProgressMessage('Connecting');
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading, globalLoading, syncingId, moduleContext, ipcCertificateNumber]);

  // Fetch sheet names when a spreadsheet is selected
  useEffect(() => {
    const loadSheets = async () => {
      const selectedFile = availableFiles.find(f => f.id === spreadsheetId);
      const isSpreadsheet = selectedFile && (
        selectedFile.is_google_sheet ||
        /\.(xlsx|xls|csv|ods|gsheet)$/i.test(selectedFile.name)
      );

      if (spreadsheetId && oauthProvider && refreshToken && isSpreadsheet) {
        setFetchingSheets(true);
        setError(null);
        try {
          const sheets = await listCloudSheets({
            provider: oauthProvider,
            refresh_token: refreshToken,
            spreadsheet_id: spreadsheetId,
            check_headers: false,
          });
          setSheetsList(sheets);
          const initialSelection: { [id: string]: boolean } = {};
          sheets.forEach((s: any) => {
            initialSelection[s.id] = true;
          });
          setSelectedSheets(initialSelection);

          // Auto-populate BOQ Name if blank
          if (!boqName && selectedFile) {
            const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
            setBoqName(nameWithoutExt);
          }
        } catch (err: any) {
          console.error(err);
          setError(err.response?.data?.detail || 'Failed to fetch worksheets from the selected file.');
        } finally {
          setFetchingSheets(false);
        }
      } else {
        setSheetsList([]);
        setSelectedSheets({});
        setFetchingSheets(false);
        if (selectedFile && !boqName) {
          const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
          setBoqName(nameWithoutExt);
        }
      }
    };
    loadSheets();
  }, [spreadsheetId, oauthProvider, refreshToken, availableFiles]);

  const handleSelectFile = async (file: any) => {
    if (file.type === 'folder') {
      handleFolderClick(file.id, file.name);
      return;
    }

    let targetId = file.id;
    let targetName = file.name;
    let conversionFailed = false;

    // Reject CSVs immediately for OneDrive as Microsoft Graph doesn't support them
    if (oauthProvider === 'onedrive' && file.name.toLowerCase().endsWith('.csv')) {
      setError("Microsoft OneDrive integration can only read native Excel Workbooks (.xlsx). The file you selected (CSV) is not supported. Please open the file in OneDrive, save it as an Excel Workbook (.xlsx), and then select the new file.");
      setSheetsList([]);
      setSpreadsheetId('');
      return;
    }

    // Auto-convert Google Drive Excel (.xlsx) and CSV (.csv) files immediately on click before fetching worksheets
    if (oauthProvider === 'google_sheets' && (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls') || file.name.toLowerCase().endsWith('.csv'))) {
      setFetchingSheets(true);
      setError(null);
      try {
        const converted = await convertGoogleCloudFile(oauthProvider, refreshToken || '', file.id);
        if (converted && converted.id) {
          targetId = converted.id;
          targetName = converted.name || file.name;
          setAvailableFiles(prev => prev.map(f => f.id === file.id ? { ...f, id: converted.id, name: targetName, is_google_sheet: true } : f));
        } else {
          conversionFailed = true;
        }
      } catch (convErr: any) {
        console.error('Google Sheets auto-conversion error:', convErr);
        conversionFailed = true;
        setError('Auto-conversion requires Google Drive file permissions. Please reconnect Google Drive or open Google Drive and select File > Save as Google Sheets.');
      } finally {
        setFetchingSheets(false);
      }
    }

    if (!conversionFailed) {
      setSpreadsheetId(targetId);
      if (!boqName) {
        const nameWithoutExt = targetName.replace(/\.[^/.]+$/, "");
        setBoqName(nameWithoutExt);
      }
    }
  };


  // Check URL parameters on mount to capture OAuth returns
  useEffect(() => {
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
            setError(`OAuth Authorization Failed: ${decodeURIComponent(err)}`);
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
            setShowConfigModal(true);
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }, 500);
      }
    }
  }, []);

  // Listen to message events from popup window
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      // For window.postMessage, verify origin. BroadcastChannel doesn't have event.origin in the same way, 
      // but it's restricted to same-origin by the browser automatically.
      if (event.origin && event.origin !== window.location.origin) return;
      
      if (event.data?.type === 'OAUTH_CALLBACK') {
        const { provider, token } = event.data;
        setOauthProvider(provider);
        setRefreshToken(token);
        setShowConfigModal(true);
        setLoading(false);
      } else if (event.data?.type === 'OAUTH_ERROR') {
        setError(event.data.error || 'Authorization failed.');
        setLoading(false);
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

  const handleFolderClick = (id: string, name: string) => {
    setNavigationHistory((prev) => [...prev, { id, name }]);
    setCurrentFolderId(id);
    setSpreadsheetId(''); // Reset selected file when moving into a subfolder
  };

  const handleNavigateBack = () => {
    setNavigationHistory((prev) => {
      const updated = prev.slice(0, -1);
      const parentFolder = updated[updated.length - 1];
      setCurrentFolderId(parentFolder ? parentFolder.id : null);
      return updated;
    });
    setSpreadsheetId('');
  };

  const resetConfigModal = () => {
    setShowConfigModal(false);
    setModalMessage(null);
    setCurrentFolderId(null);
    setNavigationHistory([]);
    setAvailableFiles([]);
    setSpreadsheetId('');
    setBoqName('');
    setSheetsList([]);
    setSelectedSheets({});
    setActiveConfigIntegrationId(null);
  };

  /**
   * Dismiss new sheets that the user deliberately left unchecked when closing
   * the configure modal for an existing integration.
   */
  const dismissUncheckedNewSheets = async (integrationId: number) => {
    const currentNewSheets = newSheetsMap[integrationId] || [];
    if (currentNewSheets.length === 0) return;
    // Sheets that exist in the newSheets list but were NOT checked by user = skip
    const unchecked = currentNewSheets.filter((name) => {
      const matching = sheetsList.find((s) => s.name === name);
      return !matching || !selectedSheets[matching.id];
    });
    if (unchecked.length > 0) {
      await handleDismissAlert(integrationId, unchecked);
    }
  };

  const handleCloseConfig = () => {
    if (loading) {
      setShowCancelWarning(true);
      return;
    }
    // If this was triggered from a new-sheet alert, dismiss unchecked ones
    if (activeConfigIntegrationId !== null) {
      dismissUncheckedNewSheets(activeConfigIntegrationId);
    }
    resetConfigModal();
  };

  const handleConfirmCancel = () => {
    setShowCancelWarning(false);
    setLoading(false);
    setGlobalLoading(false);
    resetConfigModal();
  };

  const handleOAuthInitiate = async (provider: 'google' | 'onedrive') => {
    const dbProvider = provider === 'google' ? 'google_sheets' : 'onedrive';

    setLoading(true);
    setError(null);
    
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
          const filterType = moduleContext === 'ipc' ? 'spreadsheets' : 'all';
          await listCloudFiles(dbProvider, authCheck.refresh_token, undefined, filterType, projectId, moduleContext);
          setOauthProvider(dbProvider);
          setRefreshToken(authCheck.refresh_token);
          setShowConfigModal(true);
          setLoading(false);

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
          msgEl.innerText = `Connecting to ${provider === 'google' ? 'Google' : 'Microsoft'}...`;
        }
      } catch (e) {
        // ignore
      }
    }

    try {
      let url = '';
      if (provider === 'google') {
        const res = await getGoogleAuthUrl(projectId, activeTab, pmoSubTab);
        url = res.url;
      } else {
        const res = await getOneDriveAuthUrl(projectId, activeTab, pmoSubTab);
        url = res.url;
      }

      if (popup) {
        const checkClosed = setInterval(() => {
          try {
            if (popup.closed) {
              clearInterval(checkClosed);
              setLoading(false);
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
      setError(`Failed to initiate ${provider} authentication flow.`);
      setLoading(false);
      if (popup) popup.close();
    }
  };

  const executeIpcExtractionPreview = async (selectedFile: any, sheetsNames: string, isSpreadsheet: boolean) => {
    setLoading(true);
    setGlobalLoading(true);
    setPreScanWarning(null);
    setModalMessage({ type: 'info', text: 'Scanning and classifying document... If confirmed as an IPC, data will be extracted for preview' });
    try {
        const previewResult = await previewIpcExtraction({
          project_id: typeof projectId === 'string' ? parseInt(projectId) : projectId,
          provider: oauthProvider as string,
          spreadsheet_id: selectedFile.id,
          refresh_token: refreshToken || undefined,
          ipc_certificate_number: ipcCertificateNumber
        });

        setPendingIpcFileDetails({
          selectedFile,
          sheetsNames,
          isSpreadsheet
        });
        setIpcExtractionData({
          ...previewResult.extracted_data,
          legacy_exists: previewResult.legacy_exists
        });
        setShowIpcPreviewModal(true);
        setModalMessage(null);
        setLoading(false);
        setGlobalLoading(false);
    } catch (err: any) {
        console.error(err);
        setModalMessage({ type: 'error', text: err?.response?.data?.detail || err.message || 'Failed to extract IPC data.' });
        setLoading(false);
        setGlobalLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    let selectedFile = availableFiles.find(f => f.id === spreadsheetId);
    if (!selectedFile || !selectedFile.web_url) {
      setModalMessage({ type: 'error', text: 'Please select a document from your drive.' });
      return;
    }

    const isSpreadsheet = selectedFile.is_google_sheet || /\.(xlsx|xls|csv|ods|gsheet)$/i.test(selectedFile.name);
    const checkedSheets = sheetsList.filter(s => selectedSheets[s.id]);

    if (isSpreadsheet && checkedSheets.length === 0) {
      setModalMessage({ type: 'error', text: 'Please select at least one worksheet.' });
      return;
    }

    const sheetsNames = isSpreadsheet ? (checkedSheets.map(s => s.name).join(', ') || selectedFile.name) : selectedFile.name;
    setSyncingName(sheetsNames);
    setLoading(true);
    setGlobalLoading(true);
    setModalMessage({ type: 'info', text: isSpreadsheet ? 'Linking spreadsheet…' : 'Linking document…' });
    try {
      if (oauthProvider === 'google_sheets' && isSpreadsheet && (selectedFile.name.toLowerCase().endsWith('.xlsx') || selectedFile.name.toLowerCase().endsWith('.xls'))) {
        setModalMessage({ type: 'info', text: 'Converting Excel file to native Google Sheets format...' });
        try {
          const converted = await convertGoogleCloudFile(oauthProvider, refreshToken || '', selectedFile.id);
          if (converted && converted.id) {
            selectedFile = {
              id: converted.id,
              name: converted.name || selectedFile.name,
              type: 'file',
              web_url: converted.web_url || selectedFile.web_url
            };
          }
        } catch (convErr: any) {
          console.error('Google Sheets auto-conversion fallback:', convErr);
        }
      }

      // If this is an IPC module, intercept here to preview the extraction
      if (moduleContext === 'ipc') {
        if (!ipcCertificateNumber) {
          setModalMessage({ type: 'error', text: 'IPC Certificate Number is required.' });
          setLoading(false);
          setGlobalLoading(false);
          return;
        }

        setModalMessage({ type: 'info', text: 'Verifying database status...' });
        try {
          const existsCheck = await checkIpcExists(typeof projectId === 'string' ? parseInt(projectId) : projectId, selectedFile.id);
          if (existsCheck.exists) {
            setPreScanWarning({
              show: true,
              certificateNumber: existsCheck.certificate_number,
              selectedFile,
              sheetsNames,
              isSpreadsheet
            });
            setModalMessage(null);
            setLoading(false);
            setGlobalLoading(false);
            return;
          }
        } catch (checkErr) {
          console.error("Check exists failed:", checkErr);
        }

        await executeIpcExtractionPreview(selectedFile, sheetsNames, isSpreadsheet);
        return; // Halt here until they confirm in the modal
      }

      // Normal flow continues here for BoQ and other documents
      await finalizeDocumentSave(selectedFile, sheetsNames, isSpreadsheet, null);

    } catch (err: any) {
      console.error(err);
      setModalMessage({ type: 'error', text: err?.response?.data?.detail || err.message || 'Failed to link document.' });
      setLoading(false);
      setGlobalLoading(false);
    }
  };

  const handleIpcPreviewConfirm = async (finalData: any) => {
    setShowIpcPreviewModal(false);
    setLoading(true);
    setGlobalLoading(true);
    setModalMessage({ type: 'info', text: 'Saving extracted IPC data...' });
    if (pendingIpcFileDetails) {
      await finalizeDocumentSave(
        pendingIpcFileDetails.selectedFile,
        pendingIpcFileDetails.sheetsNames,
        pendingIpcFileDetails.isSpreadsheet,
        finalData
      );
    }
  };

  const finalizeDocumentSave = async (
    targetFile: any,
    sheetsNames: string,
    isSpreadsheet: boolean,
    extractedData: any
  ) => {
    try {
      setLoading(true);
      setGlobalLoading(true);
      setModalMessage({ type: 'info', text: 'Finalizing database link...' });

      let integrationId: number | undefined;
      if (showConfigModal && oauthProvider && refreshToken) {
        const savedInt = await saveIntegration({
          project_id: typeof projectId === 'string' ? parseInt(projectId) : projectId,
          provider: oauthProvider,
          spreadsheet_id: targetFile.id,
          sheet_name: sheetsNames,
          refresh_token: refreshToken || undefined,
          boq_name: boqName || targetFile.name,
          module: moduleContext === 'department' ? departmentName?.toLowerCase() : moduleContext,
          ipc_certificate_number: moduleContext === 'ipc' ? ipcCertificateNumber : undefined
        });
        integrationId = savedInt.integration_id;
      }

      const fileExt = targetFile.name.split('.').pop()?.toUpperCase() || 'Cloud File';
      const finalTitle = boqName || targetFile.name;

      const docPayload = {
        title: titlePrefix ? `${titlePrefix} ${finalTitle}` : finalTitle,
        file_url: targetFile.web_url || '',
        file_type: isSpreadsheet ? 'Cloud File' : fileExt,
        department: moduleContext === 'department' ? departmentName : moduleContext?.toUpperCase(),
        cloud_file_id: targetFile.id,
        origin: oauthProvider || undefined,
        integration_id: integrationId,
        // We'll pass extractedData here so createDecoupledDocument can update the IPC model
        extracted_data: extractedData
      };

      if (apiEndpoint) {
        await createDecoupledDocument(projectId, apiEndpoint, docPayload);
      } else {
        await createProjectDocument(projectId, docPayload);
      }

      let successMsg = isSpreadsheet ? 'Spreadsheet linked successfully!' : 'Document linked successfully!';
      if (moduleContext === 'ipc' && extractedData) {
        successMsg = 'IPC data saved and document linked successfully!';
      }
      setModalMessage({ type: 'success', text: successMsg });
      
      onRefresh();
      setTimeout(() => {
        setShowConfigModal(false);
        setShowIpcPreviewModal(false);
        setPendingIpcFileDetails(null);
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setModalMessage({ type: 'error', text: err?.response?.data?.detail || err.message || 'Failed to save linked document.' });
    } finally {
      setLoading(false);
      setGlobalLoading(false);
    }
  };

  const handleConfirmIpcData = async (editedData: any) => {
    if (!pendingIpcFileDetails) return;
    const { selectedFile, sheetsNames, isSpreadsheet } = pendingIpcFileDetails;
    await finalizeDocumentSave(selectedFile, sheetsNames, isSpreadsheet, editedData);
  };

  const handleManualEntrySave = async (title: string, payload: any) => {
    try {
      setLoading(true);
      setGlobalLoading(true);

      const docPayload = {
        title: titlePrefix ? `${titlePrefix} ${title}` : title,
        file_url: `manual://${Date.now()}`,
        file_type: 'manual',
        department: moduleContext === 'department' ? departmentName : moduleContext?.toUpperCase(),
        origin: 'manual_entry',
        extracted_data: {
          items: [
            {
              description: payload.description || departmentName,
              values_map: payload
            }
          ]
        }
      };

      if (apiEndpoint) {
        await createDecoupledDocument(projectId, apiEndpoint, docPayload);
      } else {
        await createProjectDocument(projectId, docPayload);
      }

      setSuccess('Manual entry created successfully!');
      onRefresh();
      setShowManualEntryModal(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail || err.message || 'Failed to create manual entry.');
    } finally {
      setLoading(false);
      setGlobalLoading(false);
    }
  };

  const handleLinkAsDocument = async (file: any) => {
    if (!file.web_url) return;
    setLoading(true);
    setGlobalLoading(true);
    setModalMessage({ type: 'info', text: `Linking '${file.name}' to ${departmentName} Documents...` });
    try {
      let targetFile = file;
      if (oauthProvider === 'google_sheets' && (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls'))) {
        setModalMessage({ type: 'info', text: 'Converting Excel file to native Google Sheets format...' });
        try {
          const converted = await convertGoogleCloudFile(oauthProvider, refreshToken || '', file.id);
          if (converted && converted.id) {
            targetFile = {
              ...file,
              id: converted.id,
              name: converted.name || file.name,
              web_url: converted.web_url || file.web_url
            };
          }
        } catch (convErr: any) {
          console.error('Google Sheets auto-conversion fallback:', convErr);
        }
      }

      let integrationId: number | undefined;
      if (showConfigModal && oauthProvider && refreshToken) {
        const savedInt = await saveIntegration({
          project_id: typeof projectId === 'string' ? parseInt(projectId) : projectId,
          provider: oauthProvider,
          spreadsheet_id: targetFile.id,
          sheet_name: targetFile.name,
          refresh_token: refreshToken || undefined,
          boq_name: targetFile.name,
          module: moduleContext === 'department' ? departmentName?.toLowerCase() : moduleContext,
          ipc_certificate_number: moduleContext === 'ipc' ? ipcCertificateNumber : undefined
        });
        integrationId = savedInt.integration_id;
      }

      const docPayload2 = {
        title: targetFile.name,
        file_url: targetFile.web_url,
        file_type: targetFile.name.split('.').pop()?.toUpperCase() || 'Cloud File',
        department: departmentName,
        cloud_file_id: targetFile.id,
        origin: oauthProvider || undefined,
        integration_id: integrationId,
      };

      if (apiEndpoint) {
        await createDecoupledDocument(projectId, apiEndpoint, docPayload2);
      } else {
        await createProjectDocument(projectId, docPayload2);
      }

      setModalMessage({ type: 'success', text: `Successfully linked '${targetFile.name}' to department documents!` });
      setTimeout(() => {
        setShowConfigModal(false);
        onRefresh();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setModalMessage({ type: 'error', text: err?.response?.data?.detail || 'Failed to link document.' });
    } finally {
      setLoading(false);
      setGlobalLoading(false);
    }
  };

  const handleManualSync = async (integrationId: number) => {
    const integration = integrations.find(i => i.id === integrationId);
    let sheetName = 'worksheet';
    if (integration?.sheet_name) {
      try {
        const parsed = JSON.parse(integration.sheet_name);
        if (Array.isArray(parsed) && parsed.length > 0) {
          sheetName = parsed.map((s: any) => s.name).join(', ');
        }
      } catch (e) {
        sheetName = integration.sheet_name;
      }
    }
    setSyncingName(sheetName);
    setSyncingId(integrationId);
    setSyncResultMap(prev => ({ ...prev, [integrationId]: null }));
    try {
      const syncResult = await triggerSyncImport(integrationId);
      onRefresh();
      if (syncResult?.preview_only) {
        const issues = (syncResult.validation_issues || []).slice(0, 2).join(' • ');
        setSyncResultMap(prev => ({
          ...prev, [integrationId]: {
            type: 'error',
            text: `Linked for preview only — not saved to database. This workbook does not meet BoQ structure requirements.${issues ? ` (${issues})` : ''
              }`,
          }
        }));
      } else {
        setSyncResultMap(prev => ({ ...prev, [integrationId]: { type: 'success', text: 'Sync complete! Items saved to database.' } }));
      }
    } catch (err) {
      setSyncResultMap(prev => ({ ...prev, [integrationId]: { type: 'error', text: 'Failed to trigger manual synchronization.' } }));
    } finally {
      setSyncingId(null);
    }
  };

  const getIpcReExtractLogs = (integration: Integration): number[] => {
    try {
      const logs: string[] = (integration as any).reextract_logs || [];
      const now = Date.now();
      return logs
        .map(ts => new Date(ts).getTime())
        .filter(t => !isNaN(t) && now - t < 24 * 60 * 60 * 1000);
    } catch (e) {
      return [];
    }
  };

  const handleOpenIpcReExtractModal = (integration: Integration) => {
    setIpcReExtractModalIntegration(integration);
  };

  const handleConfirmIpcReExtract = async () => {
    if (!ipcReExtractModalIntegration) return;
    const integration = ipcReExtractModalIntegration;
    setIpcReExtractModalIntegration(null);

    setLoading(true);
    setGlobalLoading(true);
    setSyncingId(integration.id);
    setModalMessage({ type: 'info', text: 'Re-extracting IPC document data via AI...' });
    try {
      const selectedFile = {
        id: integration.spreadsheet_id,
        name: integration.boq_name || 'IPC Document',
        type: 'file',
        web_url: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/integrations/${integration.id}/open`
      };
      setOauthProvider(integration.provider);
      setRefreshToken(integration.refresh_token || null);
      setPendingIpcFileDetails({
        selectedFile,
        sheetsNames: integration.sheet_name,
        isSpreadsheet: true
      });

      const previewResult = await previewIpcExtraction({
        project_id: typeof projectId === 'string' ? parseInt(projectId) : projectId,
        provider: integration.provider,
        spreadsheet_id: integration.spreadsheet_id,
        ipc_certificate_number: integration.boq_name || '',
        refresh_token: undefined
      });

      setIpcExtractionData(previewResult.extracted_data);
      setShowIpcPreviewModal(true);
    } catch (err: any) {
      console.error("IPC Re-extraction failed:", err);
      setError(err?.response?.data?.detail || err.message || "IPC Re-extraction failed.");
    } finally {
      setLoading(false);
      setGlobalLoading(false);
      setSyncingId(null);
    }
  };

  const handleDisconnectClick = (integrationId: number) => {
    setDisconnectingId(integrationId);
  };

  const confirmDisconnect = async () => {
    if (disconnectingId === null) return;
    const id = disconnectingId;
    setDisconnectingId(null);
    setDeletingId(id);

    // Close preview/modal if open for this integration
    if (activeEditorId === id) setActiveEditorId(null);
    if (activeAuditIntegration?.id === id) setActiveAuditIntegration(null);

    setLoading(true);
    setGlobalLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteIntegration(id);
      setSuccess('Integration disconnected successfully.');
      onRefresh();
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      setError('Failed to disconnect integration.');
      onRefresh();
    } finally {
      setDeletingId(null);
      setLoading(false);
      setGlobalLoading(false);
    }
  };

  const handleConfirmDeleteIntegration = async () => {
    if (!integrationToDelete) return;
    const id = integrationToDelete.id;
    setDeletingId(id);

    if (activeEditorId === id) setActiveEditorId(null);
    if (activeAuditIntegration?.id === id) setActiveAuditIntegration(null);

    setLoading(true);
    setGlobalLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteIntegration(id, true);
      setSuccess('Workbook data and all associated database records deleted permanently.');
      await onRefresh();
      setIntegrationToDelete(null); // Close modal only after refresh completes
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      setError('Failed to delete workbook data from database.');
      await onRefresh();
      setIntegrationToDelete(null); // Close modal even on error
    } finally {
      setDeletingId(null);
      setLoading(false);
      setGlobalLoading(false);
    }
  };

  const handleOpenConfigForActive = async (integration: any, preCheckSheetName?: string) => {
    setOauthProvider(integration.provider);
    setSpreadsheetId(integration.spreadsheet_id);
    setBoqName(integration.boq_name || '');
    setRefreshToken(integration.refresh_token || null);
    setShowConfigModal(true);
    setFetchingSheets(true);
    setError(null);
    setActiveConfigIntegrationId(integration.id);
    try {
      const sheets = await listActiveIntegrationSheets(integration.id);
      setSheetsList(sheets);

      // Parse currently selected sheets
      let currentChecked: any[] = [];
      try {
        currentChecked = JSON.parse(integration.sheet_name);
      } catch (e) { }

      const selection: { [id: string]: boolean } = {};
      sheets.forEach((s: any) => {
        const isAlreadyLinked = currentChecked.some((cc: any) => cc.id === s.id || cc.name === s.name);
        const isClickedSheet = !!(preCheckSheetName && s.name === preCheckSheetName);
        selection[s.id] = isAlreadyLinked || isClickedSheet;
      });
      setSelectedSheets(selection);
    } catch (err) {
      setError('Failed to load worksheets for spreadsheet.');
      console.error(err);
    } finally {
      setFetchingSheets(false);
    }
  };

  const handleImportSheetClick = (integration: any, sheetName: string) => {
    setImportSheetWarning({ integration, sheetName });
  };

  const handleConfirmImportSheet = () => {
    if (!importSheetWarning) return;
    const { integration, sheetName } = importSheetWarning;
    setImportSheetWarning(null);
    handleOpenConfigForActive(integration, sheetName);
  };

  const handleDismissAlert = async (integrationId: number, sheetNames: string[]) => {
    // Optimistically update UI immediately
    setDismissedNewSheets((prev) => ({ ...prev, [integrationId]: true }));
    // Clear from local map so they're gone even within current session
    setNewSheetsMap((prev) => ({ ...prev, [integrationId]: [] }));
    // Persist to backend so they never reappear on refresh
    try {
      await dismissIntegrationSheets(integrationId, sheetNames);
    } catch (e) {
      console.error('Failed to persist dismissed sheets:', e);
    }
  };

  const renderSheetNames = (sheetNameJson: string) => {
    try {
      const parsed = JSON.parse(sheetNameJson);
      if (Array.isArray(parsed)) {
        return parsed.map((s: any) => s.name).join(', ');
      }
    } catch (e) { }
    return sheetNameJson;
  };

  // Find active integrations
  const googleIntegration = integrations.find((i) => i.provider === 'google_sheets');
  const onedriveIntegration = integrations.find((i) => i.provider === 'onedrive');

  const showList = false;
  const showConnect = true;

  return (
    <div className="space-y-6">
      {/* Connect providers cards */}
      {showConnect && (
        <CloudConnectionCards
          success={success}
          moduleContext={moduleContext}
          departmentName={departmentName}
          googleIntegration={googleIntegration}
          onedriveIntegration={onedriveIntegration}
          isLoading={isLoading}
          handleOAuthInitiate={handleOAuthInitiate}
          formatGuidelines={formatGuidelines}
          onManualEntryClick={apiEndpoint === 'field_ops' ? () => setShowManualEntryModal(true) : undefined}
        />
      )}

      {/* Active Integrations list */}
      {showList && visibleIntegrations.length > 0 && (
        <div className="bg-slate-900 shadow-xl rounded-2xl p-6 border border-slate-700/50 transition-all duration-300">
          <h2 className="text-xl font-bold text-slate-200 mb-4 flex items-center space-x-2">
            <span>Linked Workbooks</span>
            <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
              {visibleIntegrations.length} Active
            </span>
          </h2>
          <div className="space-y-4">
            {visibleIntegrations.map((integration) => {
              const isGoogle = integration.provider === 'google_sheets';
              const isPreviewOnly = integration.preview_only;
              const validationScore = integration.validation_score;
              const validationIssues = integration.validation_issues;
              const isSyncing = syncingId === integration.id;

              // Compute premium styles dynamically
              const cardClass = isSyncing
                ? "bg-gradient-to-r from-indigo-50/30 via-white to-indigo-50/10 border-indigo-500/40 shadow-sm animate-pulse"
                : isPreviewOnly
                  ? "bg-gradient-to-br from-amber-50/10 to-white border-amber-100 hover:shadow-md"
                  : "bg-gradient-to-br from-emerald-50/5 to-white border-emerald-500/30/70 hover:shadow-md";

              const iconClass = isSyncing
                ? "bg-indigo-100 text-indigo-600 animate-spin"
                : isPreviewOnly
                  ? "bg-amber-50 text-amber-600 border border-amber-100"
                  : isGoogle
                    ? "bg-emerald-900/20 text-emerald-600 border border-emerald-500/30"
                    : "bg-indigo-50 text-indigo-600 border border-indigo-500/30";

              return (
                <div key={integration.id} className="space-y-2">
                  <div className={`rounded-xl p-5 border flex flex-col md:flex-row md:items-start md:justify-between gap-4 transition-all duration-300 ${cardClass}`}>
                    <div className="flex items-start space-x-4 min-w-0">
                      <div className={`p-2.5 rounded-xl flex-shrink-0 transition-all duration-300 ${iconClass}`}>
                        {isSyncing ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : isGoogle ? (
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-2 10H7v-2h10v2m0-4H7V7h10v2m0 8H7v-2h10v2z" />
                          </svg>
                        ) : (
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-slate-200 text-sm truncate flex items-center space-x-2 flex-wrap gap-y-1">
                          <a
                            href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/integrations/${integration.id}/open`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline text-indigo-650 hover:text-indigo-850 transition-colors inline-flex items-center space-x-1"
                            title={`Open in ${isGoogle ? 'Google Sheets' : 'Excel Online'}. Note: Ensure your browser is logged in to the account containing this file.`}
                          >
                            <span>{integration.boq_name || 'Spreadsheet BOQ'}</span>
                            <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                          </a>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${isGoogle ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
                            {isGoogle ? 'Google Sheets' : 'OneDrive'}
                          </span>
                          {isPreviewOnly ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              Preview Only
                            </span>
                          ) : null}
                          {outOfSyncMap[integration.id] && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                              <AlertTriangle className="w-2.5 h-2.5 mr-1" />
                              Out of Sync (Edits in cloud)
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-slate-400 mt-1 truncate"><span className="font-semibold text-slate-400">File ID:</span> {integration.spreadsheet_id}</p>
                        <p className="text-xs text-slate-400 mt-0.5 truncate"><span className="font-semibold text-slate-400">Worksheets:</span> {renderSheetNames(integration.sheet_name)}</p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {isSyncing ? (
                            <span className="text-indigo-650 font-bold animate-pulse flex items-center space-x-1 text-xs">
                              <Loader2 className="w-3 h-3 animate-spin mr-1 text-indigo-500" />
                              Sync in progress… updating database structure
                            </span>
                          ) : (
                            <>
                              Last Synced: {integration.last_synced_at ? new Date(integration.last_synced_at).toLocaleString() : 'Never'}
                              <span className="text-slate-200 drop-shadow-sm mx-1.5">•</span>
                              <span
                                className="text-slate-400 font-medium cursor-help hover:text-indigo-600 transition-colors"
                                title={`Important: Ensure your web browser is signed in to the ${isGoogle ? 'Google' : 'Microsoft'} account containing this file, otherwise access will be denied.`}
                              >
                                Click name to edit in cloud (Login required)
                              </span>
                            </>
                          )}
                        </p>

                        {isPreviewOnly && !isSyncing && (
                          <div className="mt-3 bg-amber-50/40 border border-amber-100 rounded-xl p-3.5 max-w-xl">
                            {validationScore !== null && validationScore !== undefined && (
                              <div className="mb-1.5">
                                <span className="text-[10px] bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded border border-amber-200 inline-block">
                                  Match Score: {Math.round(validationScore * 100)}%
                                </span>
                              </div>
                            )}
                            <p className="text-xs text-amber-850 leading-relaxed mb-2">
                              This workbook is linked for <strong>read-only sheet preview</strong> because its structure does not match the database BoQ checklist.
                            </p>
                            {validationIssues && validationIssues.length > 0 && (
                              <ul className="space-y-1 pl-1">
                                {validationIssues.map((issue: string, i: number) => (
                                  <li key={i} className="text-xs text-amber-900 flex items-start space-x-1.5">
                                    <span className="font-extrabold text-amber-500 select-none mt-0.5">•</span>
                                    <span>{issue}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}

                        {newSheetsMap[integration.id] && newSheetsMap[integration.id].length > 0 && (
                          <>
                            {!dismissedNewSheets[integration.id] ? (
                              <div className="mt-2 bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-xs text-amber-800 flex items-start space-x-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <span className="font-semibold">New worksheets detected:</span> {newSheetsMap[integration.id].join(', ')}.
                                  <div className="mt-2 flex space-x-2">
                                    <button
                                      disabled={isLoading}
                                      onClick={() => handleOpenConfigForActive(integration)}
                                      className="text-[10px] bg-amber-600 hover:bg-amber-700 text-white font-semibold py-1 px-2.5 rounded transition-colors disabled:opacity-50"
                                    >
                                      Configure
                                    </button>
                                    <button
                                      disabled={isLoading}
                                      onClick={() => handleDismissAlert(integration.id, newSheetsMap[integration.id] || [])}
                                      className="text-[10px] bg-slate-900 border border-amber-200 hover:bg-amber-100 text-amber-900 font-semibold py-1 px-2.5 rounded transition-colors disabled:opacity-50"
                                    >
                                      Clear Alert
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-3 bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-xs space-y-2">
                                <span className="font-semibold text-slate-300 block">Available Worksheets (Not Imported):</span>
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {newSheetsMap[integration.id].map((sheetName) => (
                                    <div key={sheetName} className="flex items-center space-x-2 bg-slate-900 border border-slate-700/50 rounded-lg py-1 px-2.5 text-slate-300">
                                      <span className="font-mono text-xs">{sheetName}</span>
                                      <button
                                        disabled={isLoading}
                                        onClick={() => handleImportSheetClick(integration, sheetName)}
                                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline disabled:opacity-50"
                                      >
                                        Import
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-800/50 border border-slate-700/50 p-1.5 rounded-2xl flex-shrink-0 shadow-inner">
                      <button
                        disabled={isLoading || syncingId !== null || deletingId !== null}
                        onClick={() => setActiveEditorId(activeEditorId === integration.id ? null : integration.id)}
                        className={`p-2 rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 hover:shadow-sm ${activeEditorId === integration.id
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'hover:bg-slate-900 text-slate-400 hover:text-white'
                          }`}
                        title={activeEditorId === integration.id ? 'Hide inline preview' : 'Open inline preview'}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {moduleContext === 'ipc' ? (
                        outOfSyncMap[integration.id] ? (
                          <button
                            disabled={isLoading || syncingId !== null || deletingId !== null}
                            onClick={() => handleOpenIpcReExtractModal(integration)}
                            title="Edits detected in cloud! Click to re-extract IPC data via AI"
                            className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 border border-amber-600 text-white hover:from-amber-600 hover:to-amber-700 rounded-xl shadow-sm text-xs font-bold flex items-center space-x-1 transition-all duration-200 animate-pulse active:scale-95 disabled:opacity-50"
                          >
                            {syncingId === integration.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5 text-amber-100" />
                            )}
                            <span className="text-[11px]">{syncingId === integration.id ? 'Extracting...' : 'Re-extract IPC'}</span>
                          </button>
                        ) : (
                          <div
                            title="Workbook is up to date with cloud file. Re-extraction activates automatically when cloud edits are detected."
                            className="px-3 py-1.5 bg-emerald-900/20 border border-emerald-200 text-emerald-400 rounded-xl text-[11px] font-bold flex items-center space-x-1.5 opacity-80 cursor-not-allowed select-none"
                          >
                            <svg className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Synced</span>
                          </div>
                        )
                      ) : (
                        <button
                          disabled={isLoading || syncingId !== null || deletingId !== null}
                          onClick={() => handleManualSync(integration.id)}
                          title={syncingId === integration.id ? `Syncing worksheets: ${syncingName}` : "Sync workbook data"}
                          className="p-2 hover:bg-slate-900 text-indigo-750 hover:text-indigo-905 rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm"
                        >
                          <RefreshCw className={`w-4 h-4 ${syncingId === integration.id ? 'animate-spin text-indigo-200' : ''}`} />
                        </button>
                      )}

                      <button
                        disabled={isLoading || syncingId !== null || deletingId !== null}
                        onClick={() => setIntegrationToDelete(integration)}
                        className="p-2 hover:bg-slate-900 text-red-600 hover:text-red-700 rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm"
                        title="Delete workbook data permanently from database"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {/* Per-card sync result */}
                  {syncResultMap[integration.id] && (
                    <div className={`mt-1 rounded-xl px-4 py-3 flex items-start space-x-3 text-sm ${syncResultMap[integration.id]?.type === 'success'
                      ? 'bg-green-50 border border-green-100 text-green-800'
                      : 'bg-red-50 border border-red-100 text-red-800'
                      }`}>
                      {syncResultMap[integration.id]?.type === 'success' ? (
                        <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      )}
                      <p className="flex-1 text-xs font-semibold">{syncResultMap[integration.id]?.text}</p>
                      <button
                        onClick={() => setSyncResultMap(prev => ({ ...prev, [integration.id]: null }))}
                        className="text-gray-400 hover:text-slate-400 flex-shrink-0 ml-2"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
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


        <CloudConfigModal
          moduleContext={moduleContext}
          trackingMode={trackingMode}
          setTrackingMode={setTrackingMode}
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
          formatGuidelines={formatGuidelines}
          isFileAllowed={isFileAllowed}
          handleSaveConfig={handleSaveConfig}
          handleNavigateBack={handleNavigateBack}
          handleFolderClick={handleFolderClick}
          handleSelectFile={handleSelectFile}
          resetConfigModal={resetConfigModal}
          handleCloseConfig={handleCloseConfig}
          sheetsList={sheetsList}
          selectedSheets={selectedSheets}
          setSelectedSheets={setSelectedSheets}
          fetchingSheets={fetchingSheets}
          savingConfig={loading}
          ipcCertificateNumber={ipcCertificateNumber}
          setIpcCertificateNumber={setIpcCertificateNumber}
          onClose={() => {
            setShowConfigModal(false);
            setModalMessage(null);
          }}
        />
      {/* Cancel Import Warning Modal */}
      {showCancelWarning && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-700/50 animate-scale-up">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-200">Cancel Import?</h3>
                <p className="text-xs text-gray-400">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-3">If you cancel now, the following will happen:</p>
            <ul className="text-sm text-slate-400 space-y-1.5 mb-6">
              <li className="flex items-start space-x-2"><span className="text-red-500 font-bold">•</span><span>The workbook will <strong>not</strong> be linked to this project.</span></li>
              <li className="flex items-start space-x-2"><span className="text-red-500 font-bold">•</span><span>Any data already fetched will be <strong>discarded</strong>.</span></li>
              <li className="flex items-start space-x-2"><span className="text-red-500 font-bold">•</span><span>You will need to start the linking process <strong>again</strong>.</span></li>
            </ul>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowCancelWarning(false)}
                className="flex-1 py-2.5 px-4 border border-indigo-500/40 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-xs font-semibold text-indigo-700 active:scale-[0.98] transition-all duration-100"
              >
                Continue Import
              </button>
              <button
                onClick={handleConfirmCancel}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-sm active:scale-[0.98] transition-all duration-100"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Pre-Scan Warning Modal */}
      {preScanWarning && preScanWarning.show && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-700/50 animate-scale-up">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-200">Legacy Data Detected</h3>
                <p className="text-xs text-gray-400">Database conflict</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              This document already exists and has data in the database {preScanWarning.certificateNumber ? `with IPC number ${preScanWarning.certificateNumber}` : 'as an IPC'}. Do you want to overwrite it?
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setPreScanWarning(null)}
                className="flex-1 py-2.5 px-4 border border-slate-700/50 hover:bg-slate-800/50 rounded-xl text-xs font-semibold text-slate-300 active:scale-[0.98] transition-all duration-100"
              >
                Cancel
              </button>
              <button
                onClick={() => executeIpcExtractionPreview(preScanWarning.selectedFile, preScanWarning.sheetsNames, preScanWarning.isSpreadsheet)}
                className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-sm active:scale-[0.98] transition-all duration-100"
              >
                Continue Rescan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Sheet Confirmation Modal */}
      {importSheetWarning && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-700/50 animate-scale-up">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-200">Import Worksheet</h3>
                <p className="text-xs text-gray-400">Add to your linked workbook</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              The worksheet <strong className="text-slate-200">&ldquo;{importSheetWarning.sheetName}&rdquo;</strong> has not been imported yet.
              Importing it will add it to your linked workbook and make it available for BoQ data extraction and syncing.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setImportSheetWarning(null)}
                className="flex-1 py-2.5 px-4 border border-slate-700/50 hover:bg-slate-800/50 rounded-xl text-xs font-semibold text-slate-300 active:scale-[0.98] transition-all duration-100"
              >
                Not Now
              </button>
              <button
                onClick={handleConfirmImportSheet}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm active:scale-[0.98] transition-all duration-100"
              >
                Import Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Disconnect Confirmation Modal */}
      {disconnectingId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-700/50 flex flex-col relative animate-scale-up">
            <button
              onClick={() => setDisconnectingId(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-slate-400 active:scale-95 transition-all duration-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-red-50 rounded-xl text-red-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-200">Disconnect Spreadsheet</h3>
                <p className="text-xs text-gray-400">Syncing will be disabled</p>
              </div>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Are you sure you want to disconnect this spreadsheet? This will stop automatic syncing, but your imported items will remain in the database.
            </p>

            <div className="flex space-x-3">
              <button
                onClick={() => setDisconnectingId(null)}
                className="flex-1 py-2.5 px-4 border border-slate-700/50 hover:bg-slate-800/50 rounded-xl text-xs font-semibold text-slate-300 active:scale-[0.98] transition-all duration-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmDisconnect}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow active:scale-[0.98] transition-all duration-100"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Irreversible Deletion Warning Modal */}
      {integrationToDelete !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-700/50 animate-scale-up relative">
            <button
              onClick={() => setIntegrationToDelete(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-slate-400 active:scale-95 transition-all duration-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-red-100 rounded-xl text-red-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Irreversible Deletion Warning</h3>
                <p className="text-xs text-red-600 font-semibold">Permanent Database Purge</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              You are about to perform an irreversible deletion of the document data for{' '}
              <strong className="text-white font-semibold">{integrationToDelete.boq_name || 'Spreadsheet BOQ'}</strong>{' '}
              from the database and all of its records will be deleted permanently. Do you wish to continue?
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6">
              <p className="text-[11px] font-semibold text-amber-900 leading-relaxed">
                Cloud Storage Safeguard: <span className="font-normal text-amber-800">Note: This action will NOT delete the actual file in your cloud drive.</span>
              </p>
            </div>

            {isLoading && (
              <div className="flex items-center space-x-2 text-red-650 bg-red-50/70 border border-red-100 p-3 rounded-xl mb-4 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-red-600 flex-shrink-0" />
                <span className="text-[11px] font-semibold text-red-700">Unlinking and permanently deleting data from database...</span>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                disabled={isLoading}
                onClick={() => setIntegrationToDelete(null)}
                className="flex-1 py-2.5 px-4 border border-slate-700/50 hover:bg-slate-800/50 rounded-xl text-xs font-semibold text-slate-300 active:scale-[0.98] transition-all duration-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={isLoading}
                onClick={handleConfirmDeleteIntegration}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow active:scale-[0.98] transition-all duration-100 disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                {isLoading ? (
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

      <ManualEntryModal
        isOpen={showManualEntryModal}
        onClose={() => setShowManualEntryModal(false)}
        onSave={handleManualEntrySave}
        isLoading={isLoading}
        departmentKey={departmentKey || departmentName}
        departmentName={departmentName}
      />
    </div>
  );
}

